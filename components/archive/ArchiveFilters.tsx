'use client';

import { useEffect, useMemo, useState } from "react";
import { type ChannelRef } from "@/lib/types";
import { clsx } from "@/lib/utils/classNames";

type Props = {
  channels: ChannelRef[];
  selectedChannels: string[];
  channelCounts: Record<string, number>;
  authorOptions: Array<{ name: string; norm: string; count: number; selected: boolean }>;
  authorQuery: string;
  onToggleChannel(code: string): void;
  onResetFilters(): void;
  onToggleAuthor(name: string): void;
  onAuthorQueryChange(val: string): void;
  onClearAuthors(): void;
};

export function ArchiveFilters({
  channels,
  selectedChannels,
  channelCounts,
  authorOptions,
  authorQuery,
  onToggleChannel,
  onResetFilters,
  onToggleAuthor,
  onAuthorQueryChange,
  onClearAuthors,
}: Props) {
  const groupedChannels = useMemo(() => {
    const order: string[] = [];
    const groups: Record<string, ChannelRef[]> = {};
    for (const ch of channels) {
      const category = ch.category?.trim() || "Other";
      if (!groups[category]) {
        groups[category] = [];
        order.push(category);
      }
      groups[category].push(ch);
    }
    return order.map((category) => ({ category, channels: groups[category] }));
  }, [channels]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const singleCategory = groupedChannels.length === 1;
    const next: Record<string, boolean> = {};
    groupedChannels.forEach((g) => {
      const prev = openGroups[g.category];
      next[g.category] = prev ?? (singleCategory || g.channels.some((ch) => selectedChannels.includes(ch.code)));
    });
    setOpenGroups(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupedChannels.map((g) => g.category).join("|"), selectedChannels.join(",")]);

  return (
    <div className="w-full space-y-3 pb-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">Channels</span>
        <button
          type="button"
          onClick={onResetFilters}
          className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
        >
          Reset filters
        </button>
      </div>
      <div className="flex flex-col gap-3">
        {groupedChannels.map((group) => {
          const total = group.channels.reduce((sum, ch) => sum + (channelCounts[ch.code] || 0), 0);
          const selectedInGroup = group.channels.filter((ch) => selectedChannels.includes(ch.code));
          const defaultOpen = group.channels.some((ch) => selectedChannels.includes(ch.code));
          const isOpen = openGroups[group.category] ?? defaultOpen;
          return (
            <details
              key={group.category}
              className="group select-none rounded-lg border border-gray-200 bg-white/70 shadow-sm dark:border-gray-700 dark:bg-gray-900/60"
              open={isOpen}
              onToggle={(e) => {
                const target = e.currentTarget as HTMLDetailsElement;
                setOpenGroups((prev) => ({ ...prev, [group.category]: target.open }));
              }}
            >
              <summary className="flex cursor-pointer flex-col gap-1 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 10 10"
                      className="h-3 w-3 text-gray-500 transition-transform duration-150 group-open:rotate-90"
                    >
                      <path d="M3 1l4 4-4 4V1z" fill="currentColor" />
                    </svg>
                    <span className="text-[11px] uppercase tracking-wide">{group.category}</span>
                  </span>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">Total {total}</span>
                </div>
                {!isOpen && selectedInGroup.length > 0 ? (
                  <div className="text-[11px] font-normal text-gray-600 dark:text-gray-300">
                    Selected: {selectedInGroup.map((ch) => ch.name || ch.code).join(", ")}
                  </div>
                ) : null}
              </summary>
              <div className="border-t border-gray-200 px-3 py-2 dark:border-gray-700">
                <div className="flex flex-col gap-2 select-none">
                  {group.channels.map((ch) => {
                    const selected = selectedChannels.includes(ch.code);
                    return (
                      <label
                        key={ch.code}
                        title={ch.description}
                        className={clsx(
                          "grid w-full cursor-pointer grid-cols-[auto,1fr] items-start gap-x-3 gap-y-1 rounded-md border px-2 py-2 text-xs",
                          selected
                            ? "border-blue-500 bg-blue-50 text-gray-900 dark:border-blue-400 dark:bg-blue-900/40 dark:text-white"
                            : "border-gray-200 bg-white text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100",
                        )}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={selected}
                          onChange={() => onToggleChannel(ch.code)}
                        />
                        <div className="flex items-center gap-1">
                          <span className="font-semibold">{ch.code}</span>
                          <span className={selected ? "text-gray-800 dark:text-white" : "text-gray-600 dark:text-gray-200"}>{ch.name}</span>
                          <span
                            className={clsx(
                              "ml-1 rounded px-1 text-[10px]",
                              selected
                                ? "bg-blue-100 text-blue-900 dark:bg-blue-800 dark:text-blue-50"
                                : "bg-black/10 text-gray-700 dark:bg-white/10 dark:text-gray-100",
                            )}
                          >
                            {channelCounts[ch.code] || 0}
                          </span>
                        </div>
                        <p
                          className={clsx(
                            "col-span-2 text-left text-xs",
                            selected ? "text-gray-700 dark:text-gray-200" : "text-gray-600 dark:text-gray-300",
                          )}
                        >
                          {ch.description}
                        </p>
                      </label>
                    );
                  })}
                </div>
              </div>
            </details>
          );
        })}
      </div>
      <div className="mt-2 space-y-2 rounded-lg border border-gray-200 bg-white/70 p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900/60">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">Authors</span>
          {authorOptions.some((opt) => opt.selected) ? (
            <button
              type="button"
              onClick={onClearAuthors}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
            >
              Clear
            </button>
          ) : null}
        </div>
        <div className="relative">
          <input
            value={authorQuery}
            onChange={(e) => onAuthorQueryChange(e.target.value)}
            placeholder="Search authors"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
          />
          <div className="mt-2 max-h-52 space-y-1 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 text-sm dark:border-gray-800 dark:bg-gray-900">
            {authorOptions.length ? (
              authorOptions.map((author) => (
                <button
                  key={author.norm}
                  type="button"
                  onClick={() => onToggleAuthor(author.name)}
                  className={clsx(
                    "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left transition",
                    author.selected
                      ? "bg-blue-50 font-semibold text-blue-800 ring-1 ring-blue-200 dark:bg-blue-900/50 dark:text-blue-100 dark:ring-blue-700"
                      : "hover:bg-gray-50 dark:hover:bg-gray-800/70",
                  )}
                >
                  <span className="truncate">{author.name}</span>
                  <span
                    className={clsx(
                      "rounded-full px-2 text-[10px] font-semibold",
                      author.selected
                        ? "bg-blue-100 text-blue-900 dark:bg-blue-800 dark:text-blue-50"
                        : "bg-black/10 text-gray-700 dark:bg-white/10 dark:text-gray-100",
                    )}
                  >
                    {author.count}
                  </span>
                </button>
              ))
            ) : (
              <div className="px-1 py-2 text-xs text-gray-500 dark:text-gray-400">No authors match.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
