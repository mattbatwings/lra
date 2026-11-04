'use client';

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { DictionaryCard } from "@/components/ui/LinkHelpers";
import { type IndexedDictionaryEntry } from "@/lib/types";
import { normalize } from "@/lib/utils/strings";

const GRID_GAP = 12;
export const CARD_HEIGHT = 120;
const ROW_HEIGHT = CARD_HEIGHT + GRID_GAP;
const SCROLLBAR_FUDGE = 20;

function getColumnCount(width: number) {
  const effectiveWidth = width + SCROLLBAR_FUDGE;
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

type Props = {
  entries: IndexedDictionaryEntry[];
  onOpen(entry: IndexedDictionaryEntry): void;
  aiRecommendedScores?: Record<string, number>;
};

export function VirtualizedDictionaryGrid({ entries, onOpen, aiRecommendedScores = {} }: Props) {
  const { ref: containerRef, width } = useElementWidth<HTMLDivElement>();
  const [scrollMargin, setScrollMargin] = useState(0);

  const columnCount = useMemo(() => {
    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 0;
    const effectiveWidth = Math.max(width, viewportWidth);
    return getColumnCount(effectiveWidth);
  }, [width]);

  const rowCount = useMemo(() => Math.ceil(entries.length / columnCount), [entries.length, columnCount]);

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
    overscan: 3,
    scrollMargin,
    useFlushSync: false,
    initialOffset: 0,
  });

  if (!entries.length) return null;

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, width: "100%", position: "relative" }}>
        {virtualizer.getVirtualItems().map((item) => {
          const start = item.index * columnCount;
          const rowItems = entries.slice(start, start + columnCount);
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
                  height: CARD_HEIGHT,
                }}
              >
                {rowItems.map((entry) => (
                  <div key={entry.index.id} style={{ height: CARD_HEIGHT }}>
                    <DictionaryCard
                      entry={entry}
                      onOpen={onOpen}
                      aiScore={aiRecommendedScores[normalize(entry.index.id)]}
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
