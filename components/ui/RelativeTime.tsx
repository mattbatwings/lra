'use client';

import { formatDate, timeAgo } from "@/lib/utils/dates";

type Props = {
  ts: number;
  prefix?: string;
  className?: string;
};

export function RelativeTime({ ts, prefix, className }: Props) {
  const formatted = formatDate(ts);
  const isClient =typeof window !== "undefined";
  const text = isClient ? timeAgo(ts) : formatted;
  const content = prefix ? `${prefix} ${text}` : text;

  return (
    <span className={className} suppressHydrationWarning={true} title={formatted}>
      {content}
    </span>
  );
}
