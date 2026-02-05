'use client';

import type { MouseEvent, RefObject } from "react";
import { ArchiveFilters } from "./ArchiveFilters";
import { PostCard } from "./PostCard";
import { VirtualizedGrid } from "./VirtualizedGrid";
import type { ArchiveListItem } from "@/lib/archive";
import type { ChannelRef, GlobalTag } from "@/lib/types";
import type { ArchiveFiltersModel } from "@/hooks/useArchiveFilters";
import { normalize } from "@/lib/utils/strings";
import { TagChip } from "../ui/Tags";

type Props = {
  visible: boolean;
  sidebarRef: RefObject<HTMLElement | null>;
  channelsList: ChannelRef[];
  filters: ArchiveFiltersModel;
  error: string | null;
  globalTags: GlobalTag[];
  pageSize: number;
  pageNumber: number;
  hydrated: boolean;
  totalPosts: number;
  onNavigate(post: ArchiveListItem, event?: MouseEvent<HTMLAnchorElement>): boolean | void;
};

export function ArchiveListView({
  visible,
  sidebarRef,
  channelsList,
  filters,
  error,
  globalTags,
  pageSize,
  pageNumber,
  hydrated,
  totalPosts,
  onNavigate,
}: Props) {
  const {
    tags,
    authors,
    channels: channelFilters,
    results,
    pagination,
    sort,
    reset,
  } = filters;
  const filteredPosts = results.filtered;
  const pagedPosts = results.paged;
  const aiRecommendedCodes = results.aiRecommendedCodes ?? {};
  const aiRecommendedScores = results.aiRecommendedScores ?? {};
  const showPagination = pagination.show;
  const rangeStart = Math.min(filteredPosts.length, Math.max(0, Math.max(pageNumber - 1, 0) * pageSize + 1));
  const rangeEnd = Math.min(filteredPosts.length, Math.max(pageNumber, 1) * pageSize);

  return (
    <div className="mx-auto w-full px-2 pb-16 pt-4 sm:px-4 lg:px-6" style={{ contentVisibility: visible ? "visible" : "hidden" }}>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8 lg:min-h-screen">
        <aside ref={sidebarRef} className="lg:w-80 xl:w-96 shrink-0 lg:sticky lg:top-24 pr-1 sidebar-scroll">
          <div className="sidebar-scroll-inner lg:max-h-[calc(100vh-80px)]">
            <ArchiveFilters
              channels={channelsList}
              selectedChannels={channelFilters.selected}
              channelCounts={channelFilters.counts}
              authorOptions={authors.options}
              authorQuery={authors.query}
              onToggleChannel={channelFilters.toggle}
              onResetFilters={reset}
              onToggleAuthor={authors.toggle}
              onAuthorQueryChange={authors.setQuery}
              onClearAuthors={authors.clear}
            />
          </div>
        </aside>

        <div className="flex-1 lg:pt-1.5">
          {error ? <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}

          <div role="navigation">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium">Tags</span>
              <div className="inline-flex items-center gap-2 text-xs">
                <label className="inline-flex items-center gap-1">
                  <input type="radio" name="tagMode" value="AND" checked={tags.mode === "AND"} onChange={() => tags.setMode("AND")} />
                  <span>Match all</span>
                </label>
                <label className="inline-flex items-center gap-1">
                  <input type="radio" name="tagMode" value="OR" checked={tags.mode === "OR"} onChange={() => tags.setMode("OR")} />
                  <span>Match any</span>
                </label>
                <span className="text-gray-500">Tip: right-click on tag to exclude</span>
              </div>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              {tags.all.map((tag) => (
                <TagChip
                  key={tag.id}
                  tag={tag}
                  state={tags.state[tag.name] || 0}
                  count={tags.counts[normalize(tag.name)] || 0}
                  globalTags={globalTags}
                  onToggle={(rightClick) => tags.toggle(tag.name, rightClick)}
                />
              ))}
            </div>
            <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              {showPagination ? (
                <span>
                  Showing {rangeStart}-{rangeEnd} of {filteredPosts.length}/{totalPosts} posts
                </span>
              ) : (
                <span>
                  Showing 1-{filteredPosts.length} of {filteredPosts.length}/{totalPosts} posts
                </span>
              )}
            </div>
          </div>

          <div role="main">
            {(hydrated && pageNumber === 0) ? (
              <>
                <VirtualizedGrid
                  enabled={visible}
                  posts={filteredPosts}
                  sortKey={sort.key}
                  globalTags={globalTags}
                  onNavigate={onNavigate}
                  aiRecommendedCodes={aiRecommendedCodes}
                  aiRecommendedScores={aiRecommendedScores}
                />
                {pagination.node}
              </>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {pagedPosts.map((post) => (
                    <PostCard
                      key={`${post.channel.path}/${post.entry.path}`}
                      post={post}
                      sortKey={sort.key}
                      globalTags={globalTags}
                      aiRecommended={(post.entry.codes || []).some((code) => aiRecommendedCodes[normalize(code)])}
                      aiScore={aiRecommendedScores[normalize(post.entry.codes?.[0] || "")]}
                      onNavigate={onNavigate}
                    />
                  ))}
                </div>
                {pagination.node}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
