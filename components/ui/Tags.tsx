'use client';

import { clsx } from "@/lib/utils/classNames";
import { getSpecialTagMeta, sortTagsForDisplay } from "@/lib/utils/tagDisplay";
import type { GlobalTag, Tag } from "@/lib/types";
import React from "react";

function buildTagStyle(color?: string): React.CSSProperties | undefined {
  if (!color) return undefined;
  return {
    "--tag-color": color,
    "--tag-bg-light": `color-mix(in lab, ${color} 12%, white)`,
    "--tag-bg-dark": `color-mix(in lab, ${color} 18%, black)`,
    "--tag-text-light": `color-mix(in srgb, ${color} 40%, black)`,
    "--tag-text-dark": `color-mix(in srgb, ${color} 65%, white)`,
  } as React.CSSProperties;
}

export type TagChipProps = {
  tag: Tag;
  state: -1 | 0 | 1;
  count?: number;
  onToggle?(rightClick: boolean): void;
  globalTags?: GlobalTag[];
};

export function TagChip({
  tag,
  state,
  count,
  onToggle,
  globalTags,
}: TagChipProps) {
  const meta = getSpecialTagMeta(tag.name, globalTags);
  const metaStyle = meta?.color ? buildTagStyle(meta.color) : undefined;
  const base = "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs transition-colors";
  const cls =
    state === 1
      ? meta
        ? "text-[color:var(--tag-text-light)] bg-[var(--tag-color)]"
        : "bg-blue-600 text-white border-blue-600 shadow-sm"
      : state === -1
        ? "bg-red-600 text-white border-red-600 shadow-sm"
        : meta
          ? "text-[color:var(--tag-text-light)] dark:text-[color:var(--tag-text-dark)] bg-[var(--tag-bg-light)] dark:bg-[var(--tag-bg-dark)]"
          : "text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900";
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        if (onToggle) onToggle(e.type === "contextmenu");
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        if (onToggle) onToggle(true);
      }}
      className={clsx(base, cls)}
      style={metaStyle}
      title={state === -1 ? "Excluded" : state === 1 ? "Included" : "Not selected"}
    >
      {meta?.icon && <span className="text-[12px]">{meta.icon}</span>}
      <span>{tag.name}</span>
      {typeof count === "number" && <span className="rounded bg-black/10 px-1 text-[10px] dark:bg-white/10">{count}</span>}
    </button>
  );
}

export function TagPill({ name, globalTags }: { name: string; globalTags?: GlobalTag[] }) {
  const meta = getSpecialTagMeta(name, globalTags);
  const metaStyle = meta?.color ? buildTagStyle(meta.color) : undefined;
  const base = "inline-flex h-5 items-center gap-1 rounded-full border px-2 text-[10px] font-semibold leading-none whitespace-nowrap";
  const cls = meta
    ? "text-[color:var(--tag-text-light)] dark:text-[color:var(--tag-text-dark)] bg-[var(--tag-bg-light)] dark:bg-[var(--tag-bg-dark)]"
    : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
  return (
    <span className={clsx(base, cls)} style={metaStyle}>
      {meta?.icon && <span className="text-[12px]">{meta.icon}</span>}
      <span>{name}</span>
    </span>
  );
}

export function TagList({ tags, globalTags }: { tags: string[]; globalTags?: GlobalTag[] }) {
  if (!tags?.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {sortTagsForDisplay(tags, globalTags).map((name) => (
        <TagPill key={name} name={name} globalTags={globalTags} />
      ))}
    </div>
  );
}
