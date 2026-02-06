'use client';

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { computeAuthorCounts, computeChannelCounts, computeTagCounts, filterPosts, getPostAuthorsNormalized } from "@/lib/filtering";
import { type ArchiveListItem } from "@/lib/archive";
import { DEFAULT_GLOBAL_TAGS, type ChannelRef, type GlobalTag, type SortKey, type Tag } from "@/lib/types";
import { normalize } from "@/lib/utils/strings";
import { getSpecialTagMeta, sortTagObjectsForDisplay } from "@/lib/utils/tagDisplay";
import { disablePagination } from "@/lib/runtimeFlags";
import {
  getArchiveFiltersFromUrl,
  readArchiveSession,
  replaceArchiveFiltersInHistory,
  writeArchiveSession,
} from "@/lib/urlState";
import { getArchiveSlugInfo } from "@/lib/utils/urls";

type AuthorOption = {
  name: string;
  norm: string;
  count: number;
  selected: boolean;
};

type Options = {
  posts: ArchiveListItem[];
  channels: ChannelRef[];
  globalTags: GlobalTag[];
  pageNumber: number;
  pageSize: number;
  pageCount?: number;
  isPostOpen: boolean;
  isArchivePostURL: boolean;
  hydrated: boolean;
  semanticSearch?: {
    enabled: boolean;
    query: string;
    scoreById: Record<string, number>;
    forceDisabled?: boolean;
  };
};

type FilterState = {
  q: string;
  committedQ: string;
  tagMode: "OR" | "AND";
  tagState: Record<string, -1 | 0 | 1>;
  selectedChannels: string[];
  selectedAuthors: string[];
  sortKey: SortKey;
};

const isUrlStateActive = (state: ReturnType<typeof getArchiveFiltersFromUrl>) =>
  Boolean(
    state.committedQ ||
    state.sortKey !== "newest" ||
    state.tagMode !== "AND" ||
    Object.keys(state.tagState).length > 0 ||
    state.selectedChannels.length > 0 ||
    state.selectedAuthors.length > 0,
  );

const toFilterState = (state: Partial<FilterState>): FilterState => ({
  q: state.q || "",
  committedQ: state.committedQ ?? state.q ?? "",
  tagMode: state.tagMode === "OR" ? "OR" : "AND",
  tagState: state.tagState || {},
  selectedChannels: state.selectedChannels || [],
  selectedAuthors: state.selectedAuthors || [],
  sortKey: state.sortKey || "newest",
});

const buildInitialState = (fromSession: ReturnType<typeof readArchiveSession>) => {
  const fromUrl = getArchiveFiltersFromUrl();
  if (isUrlStateActive(fromUrl)) {
    return {
      filters: toFilterState(fromUrl),
      scrollY: typeof fromSession?.scrollY === "number" ? fromSession.scrollY : null,
    };
  }
  return fromSession
    ? { filters: toFilterState(fromSession), scrollY: typeof fromSession.scrollY === "number" ? fromSession.scrollY : null }
    : { filters: toFilterState(fromUrl), scrollY: null as number | null };
};

const buildPersistedState = (state: FilterState, scrollY?: number) => ({
  q: state.q,
  committedQ: state.committedQ,
  tagMode: state.tagMode,
  tagState: state.tagState,
  selectedChannels: state.selectedChannels,
  selectedAuthors: state.selectedAuthors,
  sortKey: state.sortKey,
  scrollY,
});



export function useArchiveFilters({
  posts,
  channels,
  globalTags,
  pageNumber,
  pageSize,
  pageCount,
  isPostOpen,
  isArchivePostURL,
  hydrated,
  semanticSearch,
}: Options) {
  const router = useRouter();
  const pathname = usePathname();
  const pendingScrollRef = useRef<number | null>(null);
  const [q, setQ] = useState("");
  const [committedQ, setCommittedQ] = useState("");
  const [tagMode, setTagMode] = useState<"OR" | "AND">("AND");
  const [tagState, setTagState] = useState<Record<string, -1 | 0 | 1>>({});
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([]);
  const [authorQuery, setAuthorQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [dictionaryQuery, setDictionaryQuery] = useState("");
  const [dictionarySort, setDictionarySort] = useState<"az" | "updated">("az");
  const skipUrlSyncRef = useRef(true);
  const scrollSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollToTop = () => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    const body = document.body;
    const prevRootBehavior = root.style.scrollBehavior;
    const prevBodyBehavior = body.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    body.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
    root.style.scrollBehavior = prevRootBehavior;
    body.style.scrollBehavior = prevBodyBehavior;
  };

  const applyFilterState = (state: FilterState) => {
    setQ(state.q);
    setCommittedQ(state.committedQ);
    setTagMode(state.tagMode);
    setTagState(state.tagState);
    setSelectedChannels(state.selectedChannels);
    setSelectedAuthors(state.selectedAuthors);
    setSortKey(state.sortKey);
  };

  useEffect(() => {
    if (isArchivePostURL || isPostOpen) return;

    startTransition(() => {
      const next = buildInitialState(readArchiveSession());
      applyFilterState(next.filters);
      if (next.scrollY) pendingScrollRef.current = next.scrollY;
    });
  }, [isArchivePostURL, isPostOpen]);

  useEffect(() => {
    if (isArchivePostURL) return;
    const handlePopState = () => {
      setTimeout(() => {
        const parsed = toFilterState(getArchiveFiltersFromUrl());
        startTransition(() => {
          applyFilterState(parsed);
        });
      }, 1);
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isArchivePostURL, pendingScrollRef]);

  useEffect(() => {
    if (skipUrlSyncRef.current) return;
    if (isPostOpen || isArchivePostURL) return;

    // check if we have post slug in url - if so, skip updating url state
    const url = new URL(window.location.href);
    const slug = getArchiveSlugInfo(url)?.slug;
    if (slug) return;
    replaceArchiveFiltersInHistory(buildPersistedState({
      q,
      committedQ,
      tagMode,
      tagState,
      selectedChannels,
      selectedAuthors,
      sortKey,
    }, typeof window === "undefined" ? undefined : window.scrollY), pathname);
  }, [committedQ, sortKey, tagMode, tagState, selectedChannels, selectedAuthors, q, router, pathname, isPostOpen, isArchivePostURL]);

  useEffect(() => {
    if (skipUrlSyncRef.current) return;
    if (typeof window === "undefined" || isArchivePostURL) return;
    writeArchiveSession(buildPersistedState({
      q,
      committedQ,
      tagMode,
      tagState,
      selectedChannels,
      selectedAuthors,
      sortKey,
    }, typeof window === "undefined" ? undefined : window.scrollY));
  }, [q, committedQ, tagMode, tagState, selectedChannels, selectedAuthors, sortKey, isArchivePostURL]);

  useEffect(() => {
    skipUrlSyncRef.current = false;
  }, []);

  useEffect(() => {
    if (isArchivePostURL || isPostOpen || typeof window === "undefined") return;
    if (skipUrlSyncRef.current) return;

    const handleScroll = () => {
      if (scrollSaveTimeoutRef.current) {
        clearTimeout(scrollSaveTimeoutRef.current);
      }
      scrollSaveTimeoutRef.current = setTimeout(() => {
        if (isArchivePostURL || isPostOpen) return;
        writeArchiveSession(buildPersistedState({
          q,
          committedQ,
          tagMode,
          tagState,
          selectedChannels,
          selectedAuthors,
          sortKey,
        }, window.scrollY));
      }, 100);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollSaveTimeoutRef.current) {
        clearTimeout(scrollSaveTimeoutRef.current);
        scrollSaveTimeoutRef.current = null;
      }
    };
  }, [q, committedQ, tagMode, tagState, selectedChannels, selectedAuthors, sortKey, isArchivePostURL, isPostOpen]);

  const commitSearch = () => {
    if (isArchivePostURL) return;
    const nextQ = q;
    setCommittedQ(nextQ);
    if (skipUrlSyncRef.current) return;
    if (isPostOpen) return;
    const nextState = buildPersistedState({
      q,
      committedQ: nextQ,
      tagMode,
      tagState,
      selectedChannels,
      selectedAuthors,
      sortKey,
    }, typeof window === "undefined" ? undefined : window.scrollY);
    replaceArchiveFiltersInHistory(nextState, pathname);
    if (typeof window !== "undefined") {
      writeArchiveSession(nextState);
    }
  };

  const includeTags = useMemo(
    () => (isArchivePostURL ? [] : Object.keys(tagState).filter((k) => tagState[k] === 1).map(normalize)),
    [isArchivePostURL, tagState],
  );
  const excludeTags = useMemo(
    () => (isArchivePostURL ? [] : Object.keys(tagState).filter((k) => tagState[k] === -1).map(normalize)),
    [isArchivePostURL, tagState],
  );
  const normalizedSelectedAuthors = useMemo(
    () => (isArchivePostURL ? [] : selectedAuthors.map(normalize)),
    [isArchivePostURL, selectedAuthors],
  );

  const allTags = useMemo<Tag[]>(() => {
    if (isArchivePostURL) return [];
    const channelPool = selectedChannels.length
      ? channels.filter((ch) => selectedChannels.includes(ch.code) || selectedChannels.includes(ch.name))
      : channels;
    const fromChannels = channelPool.flatMap((ch) => ch.availableTags || []);
    const authorSet = normalizedSelectedAuthors.length ? new Set(normalizedSelectedAuthors) : null;
    const postsPool = posts.filter((p) => {
      const matchesChannel =
        !selectedChannels.length || selectedChannels.includes(p.channel.code) || selectedChannels.includes(p.channel.name);
      if (!matchesChannel) return false;
      if (!authorSet) return true;
      const authors = getPostAuthorsNormalized(p);
      return authors.some((a) => authorSet.has(a));
    });
    const fromEntryRefs = postsPool.flatMap((p) => p.entry.tags || []);
    const fromGlobals = (globalTags?.length ? globalTags : DEFAULT_GLOBAL_TAGS).map((tag) => tag.name);
    const names = Array.from(new Set([...fromGlobals, ...fromChannels, ...fromEntryRefs]));
    let tags = sortTagObjectsForDisplay(names.map((n) => ({ id: n, name: n })), globalTags);
    if (!selectedChannels.length && !selectedAuthors.length) {
      tags = tags.filter((tag) => !!getSpecialTagMeta(tag.name, globalTags));
    }
    return tags;
  }, [channels, posts, selectedAuthors.length, selectedChannels, normalizedSelectedAuthors, globalTags, isArchivePostURL]);

  const availableAuthors = useMemo(() => {
    if (isArchivePostURL) return [] as string[];
    const map = new Map<string, string>();
    posts.forEach((p) => {
      (p.entry.authors || []).forEach((name) => {
        const norm = normalize(name);
        if (!map.has(norm)) map.set(norm, name);
      });
    });
    selectedAuthors.forEach((name) => {
      const norm = normalize(name);
      if (!map.has(norm)) map.set(norm, name);
    });
    return Array.from(map.values());
  }, [posts, selectedAuthors, isArchivePostURL]);

  const authorSearchTerm = useMemo(
    () => (isArchivePostURL ? "" : authorQuery.trim().toLowerCase()),
    [authorQuery, isArchivePostURL],
  );
  const regularFilteredPosts = useMemo(() => {
    if (isArchivePostURL) return [] as ArchiveListItem[];
    return filterPosts(posts, { q, includeTags, excludeTags, selectedChannels, selectedAuthors, sortKey, tagMode });
  }, [posts, q, includeTags, excludeTags, selectedChannels, selectedAuthors, sortKey, tagMode, isArchivePostURL]);

  const authorCounts = useMemo(
    () => (isArchivePostURL ? {} : computeAuthorCounts(regularFilteredPosts)),
    [regularFilteredPosts, isArchivePostURL],
  );

  const semanticAppendData = useMemo(() => {
    if (isArchivePostURL) {
      return { appended: [] as ArchiveListItem[], recommendedCodes: {} as Record<string, true>, recommendedScores: {} as Record<string, number> };
    }
    const trimmed = q.trim();
    const semanticScores = semanticSearch?.scoreById ?? {};
    const semanticReady = !!semanticSearch?.enabled && Object.keys(semanticScores).length > 0;
    if (!semanticReady || semanticSearch?.forceDisabled || !trimmed) {
      return { appended: [] as ArchiveListItem[], recommendedCodes: {} as Record<string, true>, recommendedScores: {} as Record<string, number> };
    }

    const baseList = filterPosts(posts, {
      q: "",
      includeTags,
      excludeTags,
      selectedChannels,
      selectedAuthors,
      sortKey,
      tagMode,
    });

    const scored: Array<{ post: ArchiveListItem; score: number }> = baseList.reduce(
      (acc, post) => {
        const codes = post.entry.codes || [];
        let bestScore: number | null = null;
        codes.forEach((code) => {
          const score = semanticScores[normalize(code)];
          if (typeof score === "number" && (bestScore === null || score > bestScore)) {
            bestScore = score;
          }
        });
        if (bestScore !== null) {
          acc.push({ post, score: bestScore });
        }
        return acc;
      },
      [] as Array<{ post: ArchiveListItem; score: number }>,
    );

    const selected = scored.slice().sort((a, b) => b.score - a.score);
    const semanticPosts = selected.map((item) => item.post);

    const regularSet = new Set(regularFilteredPosts.map((post) => normalize(post.entry.codes?.[0] || "")));
    const appended = semanticPosts.filter((post) => !regularSet.has(normalize(post.entry.codes?.[0] || "")));
    const selectedScores = new Map(selected.map((item) => [item.post, item.score] as const));
    const recommendedCodes: Record<string, true> = {};
    const recommendedScores: Record<string, number> = {};
    appended.forEach((post) => {
      const code = normalize(post.entry.codes?.[0] || "");
      if (!code) return;
      recommendedCodes[code] = true;
      const scoreEntry = selectedScores.get(post);
      if (typeof scoreEntry === "number") recommendedScores[code] = scoreEntry;
    });

    return { appended, recommendedCodes, recommendedScores };
  }, [posts, q, includeTags, excludeTags, selectedChannels, selectedAuthors, sortKey, tagMode, isArchivePostURL, semanticSearch, regularFilteredPosts]);

  const filteredPosts = useMemo(() => {
    if (isArchivePostURL) return [] as ArchiveListItem[];
    if (semanticSearch?.forceDisabled) return regularFilteredPosts;
    return [...regularFilteredPosts, ...semanticAppendData.appended];
  }, [isArchivePostURL, semanticSearch?.forceDisabled, regularFilteredPosts, semanticAppendData.appended]);

  const semanticRecommendedCodes = semanticAppendData.recommendedCodes;
  const semanticRecommendedScores = semanticAppendData.recommendedScores;

  const semanticApplied = useMemo(() => {
    if (semanticSearch?.forceDisabled) return false;
    return semanticAppendData.appended.length > 0;
  }, [semanticSearch?.forceDisabled, semanticAppendData.appended.length]);

  const authorOptions = useMemo<AuthorOption[]>(() => {
    if (isArchivePostURL) return [];
    const selectedSet = new Set(normalizedSelectedAuthors);
    return availableAuthors
      .map((name) => {
        const norm = normalize(name);
        return {
          name,
          norm,
          count: authorCounts[norm] || 0,
          selected: selectedSet.has(norm),
        };
      })
      .filter((opt) => {
        if (opt.selected) return true;
        const hasMatches = (opt.count || 0) > 0;
        if (!hasMatches) return false;
        if (!authorSearchTerm) return true;
        return opt.norm.includes(authorSearchTerm);
      })
      .sort((a, b) => {
        if (a.selected !== b.selected) return a.selected ? -1 : 1;
        if ((b.count || 0) !== (a.count || 0)) return (b.count || 0) - (a.count || 0);
        return a.name.localeCompare(b.name);
      });
  }, [availableAuthors, authorCounts, normalizedSelectedAuthors, authorSearchTerm, isArchivePostURL]);

  const pageTotal = isArchivePostURL ? 0 : (pageCount ?? 0);
  const showPagination = !isArchivePostURL && !disablePagination && pageTotal > 1 && (pageNumber > 0 || !hydrated);

  const pagedPosts = useMemo(() => {
    if (isArchivePostURL) return [] as ArchiveListItem[];
    const start = Math.max(0, Math.max(pageNumber - 1, 0) * pageSize);
    return filteredPosts.slice(start, start + pageSize);
  }, [filteredPosts, pageNumber, pageSize, isArchivePostURL]);

  useEffect(() => {
    if (!hydrated || isPostOpen) return;
    const y = pendingScrollRef.current;
    if (y === null || Number.isNaN(y)) return;
    requestAnimationFrame(() => {
      const nextY = pendingScrollRef.current;
      if (nextY === null || Number.isNaN(nextY)) return;
      window.scrollTo(0, nextY);
      pendingScrollRef.current = null;
    });
  }, [filteredPosts.length, hydrated, isPostOpen, pendingScrollRef]);

  const pagination = showPagination ? (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm text-gray-600 dark:text-gray-300">
      {pageNumber > 1 ? (
        <a
          className="rounded-full border border-gray-300 px-3 py-1 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          href={`/archives/page/${pageNumber - 1}`}
        >
          ← Previous
        </a>
      ) : (
        <span className="rounded-full border border-transparent px-3 py-1 text-sm font-semibold text-gray-400">← Previous</span>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {Array.from({ length: pageTotal }, (_, i) => {
          const page = i + 1;
          const href = `/archives/page/${page}`;
          return (page === pageNumber || (page === 1 && pageNumber === 0)) ? (
            <span
              key={page}
              className="rounded-full border border-blue-500 bg-blue-500 px-3 py-1 text-xs font-semibold text-white shadow-sm"
              aria-current="page"
            >
              {page}
            </span>
          ) : (
            <a
              key={page}
              className="rounded-full border border-transparent px-3 py-1 text-xs font-semibold text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:text-gray-200 dark:hover:border-gray-600 dark:hover:bg-gray-800"
              href={href}
            >
              {page}
            </a>
          );
        })}
      </div>
      {pageNumber < pageTotal ? (
        <a
          className="rounded-full border border-gray-300 px-3 py-1 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          href={`/archives/page/${pageNumber + 1}`}
        >
          Next →
        </a>
      ) : (
        <span className="rounded-full border border-transparent px-3 py-1 text-sm font-semibold text-gray-400">Next →</span>
      )}
    </div>
  ) : null;

  const channelCounts = useMemo(
    () => (isArchivePostURL ? {} : computeChannelCounts(filteredPosts)),
    [filteredPosts, isArchivePostURL],
  );
  const tagCounts = useMemo(
    () => (isArchivePostURL ? {} : computeTagCounts(regularFilteredPosts)),
    [regularFilteredPosts, isArchivePostURL],
  );

  const handleToggleTag = (tagName: string, rightClick: boolean) => {
    scrollToTop();
    setTagState((prev) => {
      const cur = prev[tagName] || 0;
      const next = rightClick ? (cur === -1 ? 0 : -1) : cur === 1 ? 0 : 1;
      return { ...prev, [tagName]: next };
    });
  };

  const toggleAuthor = (name: string) => {
    setSelectedAuthors((prev) => {
      const norm = normalize(name);
      const exists = prev.some((a) => normalize(a) === norm);
      if (exists) return prev.filter((a) => normalize(a) !== norm);
      return [...prev, name];
    });
  };

  const clearAuthors = () => {
    setSelectedAuthors([]);
    setAuthorQuery("");
  };

  const resetFilters = () => {
    setSelectedChannels([]);
    setSelectedAuthors([]);
    setAuthorQuery("");
    setTagState({});
    setTagMode("AND");
    setQ("");
    setCommittedQ("");
    setSortKey("newest");
  };

  return {
    search: {
      q,
      setQ,
      commitSearch,
    },
    tags: {
      mode: tagMode,
      setMode: (mode: "OR" | "AND") => {
        scrollToTop();
        setTagMode(mode);
      },
      state: tagState,
      setState: setTagState,
      all: allTags,
      counts: tagCounts,
      toggle: handleToggleTag,
    },
    channels: {
      selected: selectedChannels,
      setSelected: setSelectedChannels,
      counts: channelCounts,
      toggle: (code: string) => {
        scrollToTop();
        setSelectedChannels((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
      },
    },
    authors: {
      query: authorQuery,
      setQuery: setAuthorQuery,
      options: authorOptions,
      toggle: toggleAuthor,
      clear: clearAuthors,
      selected: selectedAuthors,
      setSelected: setSelectedAuthors,
    },
    sort: {
      key: sortKey,
      setKey: setSortKey,
    },
    dictionary: {
      query: dictionaryQuery,
      setQuery: setDictionaryQuery,
      sort: dictionarySort,
      setSort: setDictionarySort,
    },
    results: {
      filtered: filteredPosts,
      paged: pagedPosts,
      aiRecommendedCodes: semanticRecommendedCodes,
      aiRecommendedScores: semanticRecommendedScores,
    },
    semantic: {
      applied: semanticApplied,
      forceDisabled: !!semanticSearch?.forceDisabled,
    },
    pagination: {
      show: showPagination,
      node: pagination,
    },
    reset: resetFilters,
    includeTags,
    excludeTags,
  };
}

export type ArchiveFiltersModel = ReturnType<typeof useArchiveFilters>;
