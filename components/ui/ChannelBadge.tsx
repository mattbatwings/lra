'use client';

import React from "react";

export function ChannelBadge({ ch }: { ch: { code: string; name: string; description?: string } }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-gray-700 dark:text-white" title={ch.description}>
      <span className="font-semibold">{ch.code}</span>
      <span className="text-gray-500 dark:text-white">{ch.name}</span>
    </span>
  );
}
