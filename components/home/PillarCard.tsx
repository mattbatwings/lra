"use client";

import { ForesightPrefetchLink } from "@/components/ui/ForesightPrefetchLink";
import { prefetchIndexAndLatestPosts } from "@/lib/archive";

type Pillar = {
  title: string;
  body: string;
  href: string;
  cta: string;
};

type PillarCardProps = {
  pillar: Pillar;
};

export function PillarCard({ pillar }: PillarCardProps) {
  const isExternal = pillar.href.startsWith("http");
  const card = (
    <div className="flex h-full flex-col justify-between rounded-lg border border-gray-200 bg-white p-5 transition hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700">
      <div className="space-y-2">
        <div className="text-sm font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
          {pillar.title}
        </div>
        <p className="text-sm leading-relaxed text-gray-900 dark:text-gray-200">{pillar.body}</p>
      </div>
      <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-sky-700 transition dark:text-sky-300">
        {pillar.cta}
        <span aria-hidden="true">→</span>
      </span>
    </div>
  );

  if (isExternal) {
    return (
      <a href={pillar.href} target="_blank" rel="noreferrer" className="h-full">
        {card}
      </a>
    );
  }

  return (
    <ForesightPrefetchLink
      href={pillar.href}
      className="h-full"
      beforePrefetch={() => {
        if (pillar.href === "/archives/") {
          prefetchIndexAndLatestPosts();
        }
      }}
    >
      {card}
    </ForesightPrefetchLink>
  );
}
