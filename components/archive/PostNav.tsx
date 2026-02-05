'use client';

import { prefetchArchiveEntryWithMainImage, prefetchArchiveIndex, prefetchIndexAndLatestPosts } from "@/lib/archive";
import { ForesightPrefetchLink } from "../ui/ForesightPrefetchLink";
import { useEffect, useState } from "react";
import { getHistoryState } from "@/lib/urlState";
import { useRouter } from "next/navigation";

type Props = {
  prefetch: boolean;
  goHome?(): void;
  resync?(): void;
}

export function PostNav({ prefetch, goHome, resync }: Props) {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = requestAnimationFrame(() => {
      setHydrated(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);


  let backText = "← Back to archives";
  const state = hydrated ? getHistoryState() : null;
  if (state && state.lastPostCode) {
    backText = `← Back to ${state.lastPostCode}`;
  }

  const handleBackClick = () => {
    const state = hydrated ? getHistoryState() : null;

    if (!state || (!state.lastPostCode && !state.archiveListHref)) {
      router.push("/archives");
      return;
    }

    const backCount = state.backCount || 1;
    const lastBackCount = state.lastBackCount ? state.lastBackCount - 1 : 0;
    const total = backCount + lastBackCount;
    if (total > 1) {
      window.history.go(-total);
    } else {
      window.history.back();
    }
  }

  const handleHomeClick = () => {
    router.push("/archives");
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl items-center justify-between">
      <ForesightPrefetchLink
        href="/archives"
        className="rounded-full border px-3 py-1 text-sm transition hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-gray-900"
        onClick={(event) => {
          event.preventDefault();
          handleBackClick();
          if (resync) {
            resync();
          }
        }}
        beforePrefetch={(e) => {
          const state = hydrated ? getHistoryState() : null;

          if (!state || (!state.lastPostCode && !state.archiveListHref)) {
            if (!prefetch) {
              e.cancel();
            } else {
              prefetchIndexAndLatestPosts();
            }
            return;
          }

          // prefetch post
          (async () => {
            const index = await prefetchArchiveIndex();
            if (!index) return;
            const post = index.posts.find((p) => p.entry.codes.includes(state.lastPostCode!));
            if (post) {
              prefetchArchiveEntryWithMainImage(post);
            }
          })();

          if (!prefetch) {
            e.cancel();
          }
        }}
      >
        {backText}
      </ForesightPrefetchLink>
      <ForesightPrefetchLink
        href="/archives"
        className="text-sm text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
        onClick={(event) => {
          event.preventDefault();
          if (goHome) {
            goHome();
          } else {
            handleHomeClick();
          }
          if (resync) {
            resync();
          }
        }}
        beforePrefetch={
          (e) => {
            if (!prefetch) {
              e.cancel();
            } else {
              prefetchIndexAndLatestPosts();
            }
          }
        }
      >
        Archive home
      </ForesightPrefetchLink>
    </div>
  );
}
