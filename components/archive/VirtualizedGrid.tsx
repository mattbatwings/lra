'use client';

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { PostCard } from "./PostCard";
import { type ArchiveListItem } from "@/lib/archive";
import { type GlobalTag, type SortKey } from "@/lib/types";
import { normalize } from "@/lib/utils/strings";

const GRID_GAP = 16;
const CARD_HEIGHT = 380;
const SCROLLBAR_FUDGE = 20;
const ROW_HEIGHT = CARD_HEIGHT + GRID_GAP;

type Props = {
  enabled: boolean;
  posts: ArchiveListItem[];
  sortKey: SortKey;
  globalTags?: GlobalTag[];
  aiRecommendedCodes?: Record<string, true>;
  aiRecommendedScores?: Record<string, number>;
  onNavigate?(post: ArchiveListItem, event: MouseEvent<HTMLAnchorElement>): boolean | void;
};

function getColumnCount(width: number) {
  const effectiveWidth = width + SCROLLBAR_FUDGE;
  if (effectiveWidth >= 1536) return 5;
  if (effectiveWidth >= 1280) return 4;
  if (effectiveWidth >= 1024) return 3;
  if (effectiveWidth >= 640) return 2;
  return 1;
}

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const update = () => {
      const nextWidth = element.getBoundingClientRect().width;
      setWidth((prev) => (prev === nextWidth ? prev : nextWidth));
    };

    update();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }

    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

export function VirtualizedGrid({ enabled, posts, sortKey, onNavigate, globalTags, aiRecommendedCodes = {}, aiRecommendedScores = {} }: Props) {
  const { ref: containerRef, width } = useElementWidth<HTMLDivElement>();
  const [scrollMargin, setScrollMargin] = useState(0);

  const columnCount = useMemo(() => {
    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 0;
    const effectiveWidth = Math.max(width, viewportWidth);
    return getColumnCount(effectiveWidth);
  }, [width]);

  const rowCount = useMemo(() => Math.ceil(posts.length / columnCount), [posts.length, columnCount]);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const element = containerRef.current;
    if (!element) return;
    const next = element.getBoundingClientRect().top + window.scrollY;
    setScrollMargin((prev) => (Math.abs(prev - next) > 1 ? next : prev));
  }, [containerRef]);

  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => ROW_HEIGHT,
    overscan: 2,
    scrollMargin,
    useFlushSync: false,
    enabled
  });

  if (!posts.length) return null;

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((item) => {
          const start = item.index * columnCount;
          const rowItems = posts.slice(start, start + columnCount);
          return (
            <div
              key={item.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${item.size}px`,
                transform: `translateY(${item.start - virtualizer.options.scrollMargin}px)`,
                paddingBottom: GRID_GAP,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gap: GRID_GAP,
                  gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                  alignItems: "stretch",
                }}
              >
                {rowItems.map((p) => (
                  <div key={`${p.channel.path}/${p.entry.path}`} style={{ height: CARD_HEIGHT }}>
                    <PostCard
                      post={p}
                      onNavigate={onNavigate}
                      sortKey={sortKey}
                      globalTags={globalTags}
                      aiRecommended={(p.entry.codes || []).some((code) => aiRecommendedCodes[normalize(code)])}
                      aiScore={aiRecommendedScores[normalize(p.entry.codes?.[0] || "")]}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
