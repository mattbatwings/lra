'use client';

import Image from "next/image";
import type { Author } from "@/lib/types";
import { getAuthorIconURL, getAuthorName } from "@/lib/utils/authors";
import React from "react";

export function AuthorsLine({ authors }: { authors: Author[] }) {
  const visible = authors?.filter((a) => !a.dontDisplay) || [];
  if (!visible.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
      <span className="font-medium">Authors:</span>
      {visible.slice(0, 3).map((a, i) => (
        <AuthorInline key={`au-${i}`} a={a} />
      ))}
      {visible.length > 3 && <span>+{visible.length - 3}</span>}
    </div>
  );
}

export function EndorsersLine({ endorsers }: { endorsers: Author[] }) {
  const vis = endorsers || [];
  if (!vis.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
      <span className="font-medium">Endorsed by:</span>
      {vis.slice(0, 4).map((a, i) => (
        <AuthorInline key={`en-${i}`} a={a} />
      ))}
      {vis.length > 4 && <span>+{vis.length - 4}</span>}
    </div>
  );
}

export function AuthorInline({ a }: { a: Author }) {
  const name = getAuthorName(a);
  const iconURL = getAuthorIconURL(a);

  return (
    <span className="inline-flex items-center gap-1 text-sm text-gray-800 dark:text-gray-100">
      {iconURL ? (
        <Image src={iconURL} alt="" className="h-4 w-4 rounded-full" width={16} height={16} unoptimized />
      ) : (
        <span className="inline-block h-4 w-4 rounded-full bg-gray-300" />
      )}
      {a.url ? (
        <a href={a.url} target="_blank" rel="noreferrer" className="hover:underline">
          {name}
        </a>
      ) : (
        name
      )}
    </span>
  );
}
