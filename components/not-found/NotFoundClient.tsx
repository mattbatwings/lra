'use client';

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Footer } from "@/components/layout/Footer";
import { getArchiveSlugInfo, getDictionarySlugInfo } from "@/lib/utils/urls";
import { siteConfig } from "@/lib/siteConfig";

type NotFoundKind = "archive" | "dictionary";

const resolveKindAndSlug = (pathname: string | null) => {
  if (!pathname) return { kind: null, slug: null };
  const url = new URL(
    pathname,
    typeof window === "undefined" ? "https://example.invalid" : window.location.origin,
  );
  const archiveSlug = getArchiveSlugInfo(url).slug;
  if (archiveSlug) return { kind: "archive" as const, slug: archiveSlug };
  const dictionarySlug = getDictionarySlugInfo(url).slug;
  if (dictionarySlug) return { kind: "dictionary" as const, slug: dictionarySlug };
  return { kind: null, slug: null };
};

function NotFoundResolverFallback() {
  const pathname = usePathname();
  const { kind, slug } = useMemo(() => resolveKindAndSlug(pathname), [pathname]);
  if (kind && slug) {
    return <PendingLookup kind={kind} slug={slug} />;
  }
  return <GenericNotFound />;
}

const NotFoundResolver = dynamic(() => import("./NotFoundResolver"), {
  ssr: false,
  loading: () => <NotFoundResolverFallback />,
});

function PendingLookup({ kind, slug }: { kind?: NotFoundKind | null; slug?: string | null }) {
  const fallbackHref = kind === "dictionary" ? "/dictionary" : kind === "archive" ? "/archives" : siteConfig.siteOrigin;

  const kindLabel = kind === "dictionary" ? "dictionary" : kind === "archive" ? "archive" : "page";
  const slugLabel = slug?.trim() || "…";
  return (
    <>
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Looking for this page…</h1>
        <p className="max-w-xl text-sm text-gray-600 dark:text-gray-300">
          Hold on while we check the {kindLabel} for{" "}
          <code className="rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800">{slugLabel}</code>.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="rounded-full border px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
          >
            Go back
          </button>
          <Link
            href={fallbackHref}
            prefetch={false}
            className="rounded-full border px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
          >
            {kind === "dictionary" ? "Back to dictionary" : kind === "archive" ? "Back to archive" : "Back to home"}
          </Link>
        </div>
        <p className="text-xs text-gray-500">
          {kind === "archive"
            ? "Checking for a newer archive entry…"
            : kind === "dictionary"
              ? "Checking for a matching dictionary entry…"
              : "Checking for a matching page…"}
        </p>
      </main>
      <Footer />
    </>
  );
}

function GenericNotFound() {
  const fallbackHref = "/";
  return (
    <>
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">404 – Page Not Found</h1>
        <p className="max-w-xl text-sm text-gray-600 dark:text-gray-300">The page you are looking for does not exist.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="rounded-full border px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
          >
            Go back
          </button>
          <Link
            href={fallbackHref}
            prefetch={false}
            className="rounded-full border px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
          >
            Back to home
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}

export default function NotFoundClient() {
  const pathname = usePathname();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
  }, []);
  const { kind, slug } = useMemo(
    () => resolveKindAndSlug(hydrated ? pathname : null),
    [hydrated, pathname],
  );

  if (!hydrated) {
    return <PendingLookup />;
  }

  if (kind && slug) {
    return <NotFoundResolver kind={kind} slug={slug} />;
  }

  return <GenericNotFound />;
}
