'use client';

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PostContent } from "@/components/post-content/PostContent";
import { PostNav } from "@/components/archive/PostNav";
import { DictionaryModal } from "@/components/archive/DictionaryModal";
import { Footer } from "@/components/layout/Footer";
import {
  buildEntrySlug,
  findPostBySlug,
  type ArchiveListItem,
  prefetchDictionaryEntryData,
  prefetchArchiveIndex,
  prefetchDictionaryIndex,
  prefetchArchiveEntryData,
} from "@/lib/archive";
import { buildDictionarySlug, findDictionaryEntryBySlug } from "@/lib/dictionary";
import { siteConfig } from "@/lib/siteConfig";
import { disableLiveFetch } from "@/lib/runtimeFlags";
import { type ArchiveEntryData, type IndexedDictionaryEntry } from "@/lib/types";

type Props = {
  kind: "archive" | "dictionary";
  slug: string;
};

export default function NotFoundResolver({ kind, slug }: Props) {
  const router = useRouter();
  const [hasResolved, setHasResolved] = useState(false);
  const [post, setPost] = useState<ArchiveListItem | null>(null);
  const [data, setData] = useState<ArchiveEntryData | null>(null);
  const [dictionaryTooltips, setDictionaryTooltips] = useState<Record<string, string>>({});
  const [dictionaryEntry, setDictionaryEntry] = useState<IndexedDictionaryEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestKeyRef = useRef<string | null>(null);
  const dictionaryIndexRef = useRef<IndexedDictionaryEntry[] | null>(null);
  const inflightDictionaryRef = useRef<Promise<IndexedDictionaryEntry[]> | null>(null);

  const normalizedSlug = useMemo(() => slug.replace(/\/+$/, ""), [slug]);
  const archiveSlug = kind === "archive" ? normalizedSlug : null;
  const dictionarySlug = kind === "dictionary" ? normalizedSlug : null;

  const canonicalTitle = useMemo(() => {
    if (post && data) {
      return `${post.entry.name} | ${siteConfig.siteName}`;
    }
    if (dictionaryEntry) {
      const primaryTerm = dictionaryEntry.index.terms?.[0] ?? dictionaryEntry.index.id;
      return `${primaryTerm} | ${siteConfig.siteName} Dictionary`;
    }
    return null;
  }, [dictionaryEntry, data, post]);

  useEffect(() => {
    if (!canonicalTitle || typeof document === "undefined") return;
    const previousTitle = document.title;
    document.title = canonicalTitle;
    return () => {
      document.title = previousTitle;
    };
  }, [canonicalTitle]);

  useEffect(() => {
    const lookupSlug = archiveSlug ?? dictionarySlug;
    const lookupKind = archiveSlug ? "archive" : dictionarySlug ? "dictionary" : null;
    if (!lookupSlug || !lookupKind) {
      setHasResolved(true);
      return;
    }
    if (disableLiveFetch) {
      setError("Live fetching is disabled.");
      setHasResolved(true);
      return;
    }

    const requestKey = `${lookupKind}:${lookupSlug.toLowerCase()}`;
    if (requestKeyRef.current === requestKey) return;
    requestKeyRef.current = requestKey;

    let cancelled = false;
    setHasResolved(false);
    setError(null);
    setDictionaryEntry(null);
    setDictionaryTooltips({});
    if (lookupKind === "archive") {
      setPost(null);
      setData(null);
    }

    const ensureDictionaryIndex = async () => {
      if (dictionaryIndexRef.current) return dictionaryIndexRef.current;
      if (inflightDictionaryRef.current) return inflightDictionaryRef.current;
      const promise = prefetchDictionaryIndex().then((dictionary) => {
        if (!dictionary) throw new Error("Failed to load dictionary index");
        dictionaryIndexRef.current = dictionary.entries;
        return dictionary.entries;
      });
      inflightDictionaryRef.current = promise;
      try {
        return await promise;
      } finally {
        inflightDictionaryRef.current = null;
      }
    };

    async function run() {
      try {
        if (lookupKind === "archive") {
          const archive = await prefetchArchiveIndex();
          if (cancelled || !lookupSlug || !archive) return;
          const found = findPostBySlug(archive.posts, lookupSlug);
          if (!found) {
            setError("We could not find this entry in the archive.");
            return;
          }
          const [postData, dictionaryEntries] = await Promise.all([
            prefetchArchiveEntryData(found),
            ensureDictionaryIndex(),
          ]);
          if (cancelled) return;
          const tooltips: Record<string, string> = {};
          dictionaryEntries.forEach((entry) => {
            const summary = entry.index.summary?.trim();
            if (summary) tooltips[entry.index.id] = summary;
          });
          setDictionaryTooltips(tooltips);
          setPost(found);
          setData(postData);
          const canonicalSlug = buildEntrySlug(found.entry);
          if (canonicalSlug && canonicalSlug !== lookupSlug) {
            const canonicalKey = `archive:${canonicalSlug.toLowerCase()}`;
            requestKeyRef.current = canonicalKey;
            router.replace(`/archives/${encodeURIComponent(canonicalSlug)}/`);
          }
        } else {
          const dictionaryEntries = await ensureDictionaryIndex();
          if (cancelled || !lookupSlug) return;
          const entryIndex = findDictionaryEntryBySlug(
            dictionaryEntries.map((entry) => entry.index),
            lookupSlug,
          );
          if (!entryIndex) {
            setError("We could not find this dictionary entry.");
            return;
          }
          const tooltipMap: Record<string, string> = {};
          dictionaryEntries.forEach((entry) => {
            const summary = entry.index.summary?.trim();
            if (summary) tooltipMap[entry.index.id] = summary;
          });
          setDictionaryTooltips(tooltipMap);
          let entryData: Awaited<ReturnType<typeof prefetchDictionaryEntryData>> | null = null;
          try {
            entryData = await prefetchDictionaryEntryData(entryIndex.id);
          } catch {
            // ignore and fallback to index-only entry
          }
          if (cancelled) return;
          setDictionaryEntry(entryData ? { index: entryIndex, data: entryData } : { index: entryIndex });
          const canonicalSlug = buildDictionarySlug(entryIndex);
          if (canonicalSlug && canonicalSlug !== lookupSlug) {
            const canonicalKey = `dictionary:${canonicalSlug.toLowerCase()}`;
            requestKeyRef.current = canonicalKey;
            router.replace(`/dictionary/${encodeURIComponent(canonicalSlug)}/`);
          }
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message || "Unable to load content.");
      } finally {
        if (!cancelled) {
          setHasResolved(true);
        }
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [archiveSlug, dictionarySlug, router]);

  const isArchivePath = Boolean(archiveSlug);
  const isDictionaryPath = Boolean(dictionarySlug);
  const lookupSlug = archiveSlug ?? dictionarySlug ?? "";
  const fallbackHref = isDictionaryPath ? "/dictionary/" : "/archives/";
  const showNotFound =
    hasResolved &&
    ((isArchivePath && (!post || !data)) || (isDictionaryPath && !dictionaryEntry) || Boolean(error));

  if (archiveSlug && post && data) {
    return (
      <>
        <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 pb-16 pt-10 lg:px-6">
          <PostNav prefetch={true} />
          <PostContent post={post} data={data} dictionaryTooltips={dictionaryTooltips} />
        </main>
        <Footer />
      </>
    );
  }

  if (dictionarySlug && dictionaryEntry) {
    return (
      <>
        <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 pb-16 pt-10 lg:px-6">
          <DictionaryModal
            entry={dictionaryEntry}
            dictionaryTooltips={dictionaryTooltips}
            onClose={() => {
              setDictionaryEntry(null);
              router.push("/dictionary/");
            }}
            variant="inline"
          />
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        {!hasResolved ? (
          <>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Looking for this page…</h1>
            <p className="max-w-xl text-sm text-gray-600 dark:text-gray-300">
              Hold on while we check the {isArchivePath ? "archive" : "dictionary"} for{" "}
              <code className="rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800">{lookupSlug}</code>.
            </p>
          </>
        ) : showNotFound ? (
          <>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">404 – Page Not Found</h1>
            <p className="max-w-xl text-sm text-gray-600 dark:text-gray-300">
              We looked for <code className="rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800">{lookupSlug}</code> in the{" "}
              {isArchivePath ? "archive" : "dictionary"} but could not render it.
              {error ? ` ${error}` : " Try again in a few moments."}
            </p>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Found it</h1>
            <p className="max-w-xl text-sm text-gray-600 dark:text-gray-300">
              We located this {isArchivePath ? "archive entry" : "dictionary entry"}. Redirecting you to the canonical page…
            </p>
          </>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-full border px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
          >
            Go back
          </button>
          <Link
            href={fallbackHref}
            prefetch={false}
            className="rounded-full border px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
          >
            {isDictionaryPath ? "Back to dictionary" : "Back to archive"}
          </Link>
        </div>
        {!hasResolved ? (
          <p className="text-xs text-gray-500">
            {isArchivePath ? "Checking for a newer archive entry…" : "Checking for a matching dictionary entry…"}
          </p>
        ) : null}
      </main>
      <Footer />
    </>
  );
}
