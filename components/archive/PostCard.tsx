'use client';

import Image from "next/image";
import type { MouseEvent } from "react";
import { RelativeTime } from "../ui/RelativeTime";
import { prefetchArchiveEntryWithMainImage, type ArchiveListItem } from "@/lib/archive";
import { getEntryArchivedAt, getEntryUpdatedAt, type GlobalTag, type SortKey } from "@/lib/types";
import { assetURL } from "@/lib/github";
import { getPreviewByCode } from "@/lib/previews";
import { ForesightPrefetchLink } from "../ui/ForesightPrefetchLink";
import { ChannelBadge } from "../ui/ChannelBadge";
import { TagList } from "../ui/Tags";

type Props = {
  post: ArchiveListItem;
  sortKey: SortKey;
  globalTags?: GlobalTag[];
  aiRecommended?: boolean;
  aiScore?: number;
  onNavigate?(post: ArchiveListItem, event: MouseEvent<HTMLAnchorElement>): boolean | void;
};

export function PostCard({ post, sortKey, onNavigate, globalTags, aiRecommended = false, aiScore }: Props) {
  const preview = getPreviewByCode(post.entry.codes[0]);
  const heroSrc = post.entry.mainImagePath
    ? assetURL(post.channel.path, post.entry.path, post.entry.mainImagePath)
    : null;

  const isUsingOptimizedPreview = preview && heroSrc === preview.sourceUrl;
  const displaySrc = isUsingOptimizedPreview ? preview.localPath : heroSrc;

  const updatedAt = getEntryUpdatedAt(post.entry);
  const archivedAt = getEntryArchivedAt(post.entry);
  const showArchivedTime = sortKey === "archived" || sortKey === "archivedOldest";
  const displayTs = showArchivedTime ? archivedAt ?? updatedAt : updatedAt ?? archivedAt;

  const authorNames = post.entry.authors;
  const authorsLine =
    authorNames.length > 0
      ? `${authorNames[0]}${authorNames[1] ? ", " + authorNames[1] : ""}${authorNames.length > 2 ? ` +${authorNames.length - 2}` : ""}`
      : undefined;

  return (
    <article className="group flex h-full min-h-95 flex-col rounded-2xl bg-white transition hover:shadow-md dark:bg-gray-900">
      <ForesightPrefetchLink
        href={`/archives/${post.slug}`}
        className="flex h-full w-full flex-col text-left"
        onClick={(event) => {
          const handled = onNavigate?.(post, event);
          if (handled) {
            event.preventDefault();
          }
        }}
        beforePrefetch={(e) => {
          prefetchArchiveEntryWithMainImage(post);
          if (onNavigate) e.cancel()
        }}
      >
        <div className="relative aspect-video min-h-45 w-full rounded-t-2xl bg-black/7 dark:bg-white/5">
          {aiRecommended ? (
            <span className="absolute left-2 top-2 z-10 rounded-full bg-gray-200/80 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-gray-600 shadow-sm backdrop-blur-sm dark:bg-gray-800/70 dark:text-gray-300">
              AI{typeof aiScore === "number" ? ` ${aiScore.toFixed(2)}` : ""}
            </span>
          ) : null}
          <div className="h-full w-full overflow-hidden rounded-t-2xl">
            {displaySrc ? (
              <Image
                src={displaySrc}
                alt={post.entry.name || "thumbnail"}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                className="object-contain"
                unoptimized
                preload={false}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-gray-700 dark:text-gray-200">{post.entry ? "No image" : "Loading..."}</div>
            )}
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2 p-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 text-sm font-semibold">{post.entry.name}</h3>
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-mono text-gray-600 dark:bg-gray-800 dark:text-gray-300">{post.entry.codes[0]}</span>
          </div>
          {authorsLine ? <div className="min-h-4 text-xs text-gray-600 dark:text-gray-300">{authorsLine}</div> : <div className="min-h-4" />}
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-200">
            <ChannelBadge ch={post.channel} />
            <div className="flex flex-col items-end text-right">
              {displayTs !== undefined ? <RelativeTime ts={displayTs} /> : null}
            </div>
          </div>
          <div className="min-h-13.5">
            <TagList tags={post.entry.tags || []} globalTags={globalTags} />
          </div>
        </div>
      </ForesightPrefetchLink>
    </article>
  );
}
