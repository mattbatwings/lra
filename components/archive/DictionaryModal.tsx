'use client';

import { useEffect, useMemo, useState } from "react";
import { RelativeTime } from "../ui/RelativeTime";
import { disableLiveFetch } from "@/lib/runtimeFlags";
import { getCachedArchiveIndex, prefetchArchiveEntryWithMainImage, prefetchArchiveIndex, type ArchiveListItem } from "@/lib/archive";
import { getEntryArchivedAt, getEntryUpdatedAt, type IndexedDictionaryEntry } from "@/lib/types";
import { transformOutputWithReferencesForWebsite } from "@/lib/utils/references";
import Link from "next/link";
import { ForesightPrefetchLink } from "../ui/ForesightPrefetchLink";
import { ChannelBadge } from "../ui/ChannelBadge";
import { MarkdownText } from "../ui/LinkHelpers";

type Props = {
  entry: IndexedDictionaryEntry;
  onClose(): void;
  closeHref?: string;
  dictionaryTooltips?: Record<string, string>;
  onLinkClick?(e: React.MouseEvent<HTMLAnchorElement, MouseEvent>): void;
  variant?: "modal" | "inline";
  currentPost?: ArchiveListItem | null;
};

export function DictionaryModal({ entry, onClose, closeHref, dictionaryTooltips, onLinkClick, variant = "modal", currentPost }: Props) {
  const decorated = entry.data
    ? transformOutputWithReferencesForWebsite(entry.data.definition, entry.data.references || [], (id) => dictionaryTooltips?.[id])
    : "";
  const referencedCodes = useMemo(
    () => (entry.data as { referencedBy?: string[] } | undefined)?.referencedBy || [],
    [entry],
  );
  const cachedArchive = getCachedArchiveIndex()?.index ?? null;
  const referencedByFromCache = useMemo(() => {
    if (!referencedCodes.length || !cachedArchive) return [];
    const byCode = new Map(cachedArchive.posts.map((post) => [post.entry.codes[0], post]));
    return referencedCodes.map((code) => ({ code, post: byCode.get(code) }));
  }, [cachedArchive, referencedCodes]);
  const [referencedByLive, setReferencedByLive] = useState<{
    key: string;
    items: Array<{ code: string; post?: ArchiveListItem }>;
  } | null>(null);
  const referencedBy = referencedByLive?.key === entry.index.id
    ? referencedByLive.items
    : referencedByFromCache;
  const referencedByResolved = referencedByLive?.key === entry.index.id;
  const isInline = variant === "inline";

  useEffect(() => {
    if (disableLiveFetch) return;
    if (!referencedCodes.length) return;
    let cancelled = false;
    prefetchArchiveIndex()
      .then((archive) => {
        if (cancelled || !archive) return;
        const byCode = new Map(archive.posts.map((post) => [post.entry.codes[0], post]));
        setReferencedByLive({
          key: entry.index.id,
          items: referencedCodes.map((code) => ({ code, post: byCode.get(code) })),
        });
      })
      .catch(() => { });
    return () => {
      cancelled = true;
    };
  }, [entry, referencedCodes]);

  const content = (
    <article
      className="relative z-10 w-full max-w-3xl rounded-2xl border bg-white p-0 shadow-xl dark:border-gray-800 dark:bg-gray-900"
      onClick={(e) => e.stopPropagation()}
    >
      <header className="flex items-start justify-between gap-3 border-b p-4">
        <div className="space-y-2">
          <h3 className="text-lg font-bold">{entry.index.terms[0] || entry.index.id}</h3>
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <RelativeTime ts={entry.index.updatedAt} prefix="Updated" />
          </div>
          {entry.index.terms.length > 1 ? (
            <div className="flex flex-wrap gap-1">
              {entry.index.terms.slice(1).map((term, i) => (
                <span
                  key={i}
                  className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                >
                  Alias: {term}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {closeHref ? (
          <Link
            href={closeHref}
            prefetch={false}
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
              event.preventDefault();
              onClose();
            }}
            className="rounded-full border px-3 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Close
          </Link>
        ) : (
          <button onClick={onClose} className="rounded-full border px-3 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
            Close
          </button>
        )}
      </header>
      <div className="p-4">
        {entry.data ? (
          <div className="flex flex-col gap-4 text-sm">
            {entry.data.definition ? (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold tracking-wide text-gray-600 dark:text-gray-300">Definition</h4>
                <MarkdownText text={decorated} onLinkClick={onLinkClick} />
              </div>
            ) : null}
            {referencedCodes.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold tracking-wide text-gray-600 dark:text-gray-300">Referenced By</h4>
                {referencedBy.length > 0 ? (
                  <div className="space-y-2">
                    {referencedBy.map(({ code, post }) => {
                      if (!post) {
                        return (
                          <div key={code} className="flex items-center justify-between rounded-lg border px-3 py-2 dark:border-gray-800">
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-700 dark:bg-gray-800 dark:text-gray-200">{code}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">Not found in archive</span>
                          </div>
                        );
                      }
                      const updated = getEntryUpdatedAt(post.entry) ?? getEntryArchivedAt(post.entry);

                      if (currentPost && post.slug === currentPost.slug) {
                        return (
                          <div
                            key={code}
                            className="flex w-full items-start justify-between gap-3 rounded-lg border px-3 py-2 text-left transition hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/60"

                          >
                            <div className="space-y-1">
                              <div className="text-sm font-semibold leading-tight">{post.entry.name}</div>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                                <ChannelBadge ch={post.channel} />
                                <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                                  {post.entry.codes[0]}
                                </span>
                                {updated !== undefined ? <RelativeTime ts={updated} /> : null}
                              </div>
                            </div>
                            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Viewing</span>
                          </div>
                        );
                      }

                      return (
                        <ForesightPrefetchLink
                          key={code}
                          href={`/archives/${post.slug}`}
                          className="flex w-full items-start justify-between gap-3 rounded-lg border px-3 py-2 text-left transition hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/60"
                          onClick={onLinkClick}
                          beforePrefetch={() => {
                           prefetchArchiveEntryWithMainImage(post);
                          }}
                        >
                          <div className="space-y-1">
                            <div className="text-sm font-semibold leading-tight">{post.entry.name}</div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                              <ChannelBadge ch={post.channel} />
                              <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                                {post.entry.codes[0]}
                              </span>
                              {updated !== undefined ? <RelativeTime ts={updated} /> : null}
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Open</span>
                        </ForesightPrefetchLink>
                      );
                    })}
                  </div>
                ) : referencedByResolved ? (
                  <div className="rounded-lg border px-3 py-2 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
                    No referenced posts found.
                  </div>
                ) : (
                  <div className="rounded-lg border px-3 py-2 text-xs text-gray-600 dark:border-gray-800 dark:text-gray-300">
                    <div className="font-medium">Referenced codes</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {referencedCodes.map((code) => (
                        <span
                          key={code}
                          className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                        >
                          {code}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                      Open the archives to search by code.
                    </div>
                    <div className="mt-2">
                      <Link
                        prefetch={false}
                        href="/archives"
                        className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Go to archives
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {entry.data.statusURL ? (
                <a
                  href={entry.data.statusURL}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border px-3 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  View Discord Thread
                </a>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500">
            {disableLiveFetch ? "Definition unavailable in static snapshot." : "Loading term..."}
          </div>
        )}
      </div>
    </article>
  );

  if (isInline) {
    return (
      <div className="mx-auto flex w-full max-w-3xl justify-center p-4">
        {content}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/50 p-4" onClick={onClose}>
      {closeHref ? (
        <Link
          href={closeHref}
          prefetch={false}
          className="absolute inset-0"
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
            event.preventDefault();
            onClose();
          }}
        >
          <span className="sr-only">Close</span>
        </Link>
      ) : null}
      {content}
    </div>
  );
}
