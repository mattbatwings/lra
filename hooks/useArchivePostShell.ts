'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import {
  findPostBySlug,
  getCachedDictionaryIndex,
  prefetchArchiveEntryData,
  prefetchDictionaryIndex,
  type ArchiveListItem,
} from "@/lib/archive";
import { siteConfig } from "@/lib/siteConfig";
import { getArchiveSlugInfo, getURLFromMouseEvent } from "@/lib/utils/urls";
import type { ArchiveEntryData, IndexedDictionaryEntry } from "@/lib/types";
import { buildHistoryState, getHistoryState } from "@/lib/urlState";

type Options = {
  posts: ArchiveListItem[];
  archiveRootHref: string;
  setIsArchivePostURL(value: boolean): void;
};

const buildDictionaryTooltips = (entries: IndexedDictionaryEntry[] | null) => {
  if (!entries?.length) return {};
  const tooltips: Record<string, string> = {};
  entries.forEach((entry) => {
    const summary = entry.index.summary?.trim();
    if (summary) tooltips[entry.index.id] = summary;
  });
  return tooltips;
};

const isPlainLeftClick = (event?: MouseEvent<HTMLAnchorElement>) => {
  if (!event) return true;
  return !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0);
};

const extractArchiveSlugFromUrl = (url: URL) => getArchiveSlugInfo(url).slug;

const getCurrentHref = () => {
  if (typeof window === "undefined") return "";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
};

const syncDocumentTitle = (post: ArchiveListItem | null, titleRef: React.MutableRefObject<string | null>) => {
  if (typeof document === "undefined") return;
  if (!post) {
    if (titleRef.current !== null) {
      document.title = titleRef.current;
      titleRef.current = null;
    }
    return;
  }
  if (titleRef.current === null) {
    titleRef.current = document.title;
  }
  document.title = `${post.entry.name} | ${siteConfig.siteName}`;
};

export function useArchivePostShell({ posts, archiveRootHref, setIsArchivePostURL }: Options) {
  const [openPost, setOpenPost] = useState<ArchiveListItem | null>(null);
  const [openData, setOpenData] = useState<ArchiveEntryData | null>(null);
  const [openDictionaryTooltips, setOpenDictionaryTooltips] = useState<Record<string, string>>({});
  const [openError, setOpenError] = useState<string | null>(null);
  const openRequestRef = useRef<symbol | null>(null);
  const listUrlRef = useRef<string | null>(null);
  const titleRef = useRef<string | null>(null);

  useEffect(() => {
    syncDocumentTitle(openPost, titleRef);
  }, [openPost]);

  const resetOpenState = useCallback(() => {
    setIsArchivePostURL(false);
    setOpenPost(null);
    setOpenData(null);
    setOpenError(null);
    openRequestRef.current = null;
    setOpenDictionaryTooltips({});
  }, [setIsArchivePostURL]);

  const loadPost = useCallback((post: ArchiveListItem) => {
    setOpenPost(post);
    setOpenData(null);
    setOpenError(null);
    const requestToken = Symbol("archive-entry");
    openRequestRef.current = requestToken;
    const cachedDictionary = getCachedDictionaryIndex()?.index ?? null;
    if (cachedDictionary) {
      setOpenDictionaryTooltips(buildDictionaryTooltips(cachedDictionary.entries));
    }

    Promise.all([prefetchArchiveEntryData(post), prefetchDictionaryIndex()])
      .then(([postData, dictionary]) => {
        if (openRequestRef.current !== requestToken) return;
        if (dictionary?.entries?.length) {
          setOpenDictionaryTooltips(buildDictionaryTooltips(dictionary.entries));
        }
        if (postData) {
          setOpenData(postData);
          setOpenError(null);
        } else {
          setOpenError("We could not load this entry.");
        }
      })
      .catch((err) => {
        if (openRequestRef.current !== requestToken) return;
        setOpenError((err as Error).message || "Unable to load this entry.");
      });
    requestAnimationFrame(() => window.scrollTo(0, 0));
  }, []);

  const openPostFromList = useCallback((post: ArchiveListItem, event?: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainLeftClick(event)) return false;
    if (typeof window === "undefined") return true;
    const archiveRootPath = archiveRootHref.endsWith("/") ? archiveRootHref : `${archiveRootHref}/`;
    const archiveRootPathNoTrailing = archiveRootPath.replace(/\/+$/, "");
    const currentHref = getCurrentHref();
    if (!openPost) {
      listUrlRef.current = currentHref;
    }
    const nextHref = `${archiveRootPathNoTrailing}/${encodeURIComponent(post.slug)}/`;
    const currentState = getHistoryState();
    const nextState = buildHistoryState({
      archiveListHref: listUrlRef.current || currentHref,
      lastPostCode: openPost?.entry.codes[0] || undefined,
      lastBackCount: currentState.backCount,
      backCount: undefined,
      lastDictionaryId: undefined,
    });
    window.history.pushState(nextState, "", nextHref);
    loadPost(post);
    return true;
  }, [archiveRootHref, loadPost, openPost]);

  const onLinkClick = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    const url = getURLFromMouseEvent(event);
    if (!url) return;
    const slug = extractArchiveSlugFromUrl(url);
    if (!slug) return;
    const match = findPostBySlug(posts, slug);
    if (!match) return;
    openPostFromList(match);
    event.preventDefault();
  }, [openPostFromList, posts]);

  const openPostFromUrl = useCallback((post: ArchiveListItem) => {
    if (openPost?.slug === post.slug) return;
    const archiveRootPath = archiveRootHref.endsWith("/") ? archiveRootHref : `${archiveRootHref}/`;
    if (typeof window !== "undefined" && !listUrlRef.current) {
      const historyState = getHistoryState();
      listUrlRef.current = historyState.archiveListHref || archiveRootPath;
    }
    loadPost(post);
  }, [archiveRootHref, loadPost, openPost]);

  const closePostFromUrl = useCallback(() => {
    if (!openPost) return;
    resetOpenState();
  }, [openPost, resetOpenState]);

  const syncFromLocation = useCallback(() => {
    if (typeof window === "undefined") return;
    const slug = extractArchiveSlugFromUrl(new URL(window.location.href));
    if (!slug) {
      closePostFromUrl();
      return;
    }
    const match = findPostBySlug(posts, slug);
    if (!match) return;
    openPostFromUrl(match);
  }, [closePostFromUrl, openPostFromUrl, posts]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncFromLocationAsync = () => {
      setTimeout(() => {
        syncFromLocation();
      }, 1);
    };
    syncFromLocationAsync();
    window.addEventListener("popstate", syncFromLocationAsync);
    window.addEventListener("pageshow", syncFromLocationAsync);
    return () => {
      window.removeEventListener("popstate", syncFromLocationAsync);
      window.removeEventListener("pageshow", syncFromLocationAsync);
    };
  }, [closePostFromUrl, openPostFromUrl, posts, syncFromLocation]);

  const goHome = useCallback(() => {
    if (typeof window === "undefined") return;
    const archiveRootPath = archiveRootHref.endsWith("/") ? archiveRootHref : `${archiveRootHref}/`;

    const nextState = buildHistoryState({
      archiveListHref: listUrlRef.current || undefined,
      lastPostCode: openPost?.entry.codes[0] || undefined,
      lastBackCount: undefined,
      backCount: undefined,
      lastDictionaryId: undefined,
    });
    window.history.pushState(nextState, "", archiveRootPath);
    resetOpenState();
  }, [archiveRootHref, openPost, resetOpenState]);

  return {
    openPost,
    openData,
    openDictionaryTooltips,
    openError,
    isPostOpen: Boolean(openPost),
    openPostFromList,
    onLinkClick,
    goHome
  };
}
