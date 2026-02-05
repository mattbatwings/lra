'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { HeaderBar } from "../layout/HeaderBar";
import { ArchivePostView } from "./ArchivePostView";
import { ArchiveListView } from "./ArchiveListView";
import { useArchiveData } from "@/hooks/useArchiveData";
import { useArchiveFilters } from "@/hooks/useArchiveFilters";
import { useArchivePostShell } from "@/hooks/useArchivePostShell";
import { type ArchiveIndex } from "@/lib/archive";
import { DEFAULT_GLOBAL_TAGS, type GlobalTag } from "@/lib/types";
import { siteConfig } from "@/lib/siteConfig";
import { Footer } from "@/components/layout/Footer";
import { getArchiveSlugInfo } from "@/lib/utils/urls";
import { normalize } from "@/lib/utils/strings";
import { ensureEmbeddingsLoaded, getScores } from "@/lib/semanticSearch";

type Props = {
  initialArchive: ArchiveIndex;
  pageNumber: number;
  pageSize: number;
  pageCount?: number;
};

const ARCHIVE_EMBEDDINGS_KEY = "archive-embeddings";

let hasHydratedArchiveShell = false;

export function ArchiveShell({
  initialArchive,
  pageNumber = 0,
  pageSize,
  pageCount,
}: Props) {

  const [hydrated, setHydrated] = useState(hasHydratedArchiveShell);
  const [isArchivePostURL, setIsArchivePostURL] = useState(false);
  const [aiSearchAvailable, setAiSearchAvailable] = useState(false);
  const [semanticSearch, setSemanticSearch] = useState<{ query: string; scoreById: Record<string, number> } | null>(null);
  const [semanticForceDisabled, setSemanticForceDisabled] = useState(false);
  const [aiWorkerRequested, setAiWorkerRequested] = useState(false);
  const [archiveSearchFocused, setArchiveSearchFocused] = useState(false);
  const pendingQueryRef = useRef<string>("");
  
  useEffect(() => {
    hasHydratedArchiveShell = true;

    const canSetScroll = typeof window !== "undefined" && "scrollRestoration" in window.history;
    const previousScrollRestoration = canSetScroll ? window.history.scrollRestoration : null;
    if (canSetScroll) {
      window.history.scrollRestoration = "manual";
    }

    const url = new URL(window.location.href);
    const slug = getArchiveSlugInfo(url)?.slug;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsArchivePostURL(!!slug);

    setHydrated(true);
    return () => {
      if (canSetScroll && previousScrollRestoration) {
        window.history.scrollRestoration = previousScrollRestoration;
      }
    };
  }, []);

  useEffect(() => {
    if (!aiWorkerRequested) return;
    let cancelled = false;
    ensureEmbeddingsLoaded(ARCHIVE_EMBEDDINGS_KEY, "embeddings.json")
      .then(() => {
        if (!cancelled) setAiSearchAvailable(true);
      })
      .catch(() => {
        if (!cancelled) {
          setAiSearchAvailable(false);
          setSemanticSearch(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [aiWorkerRequested]);

  const { posts, channels, error, config, refreshArchiveIndex } = useArchiveData({ initial: initialArchive });
  const archiveConfig = config ?? initialArchive.config;
  const globalTags = useMemo<GlobalTag[]>(
    () => archiveConfig.globalTags?.length ? archiveConfig.globalTags : DEFAULT_GLOBAL_TAGS,
    [archiveConfig.globalTags],
  );
  const sidebarShellRef = useRef<HTMLElement | null>(null);
  const archiveRootHref = `${siteConfig.basePath || ""}/archives`;


  const {
    openPost,
    openData,
    openDictionaryTooltips,
    openError,
    isPostOpen,
    openPostFromList,
    onLinkClick,
    goHome,
  } = useArchivePostShell({ posts, archiveRootHref, setIsArchivePostURL });

  const filters = useArchiveFilters({
    posts,
    channels,
    globalTags,
    pageNumber,
    pageSize,
    pageCount,
    isPostOpen,
    isArchivePostURL,
    hydrated,
    semanticSearch: {
      enabled: aiSearchAvailable,
      query: semanticSearch?.query ?? "",
      scoreById: semanticSearch?.scoreById ?? {},
      forceDisabled: semanticForceDisabled,
    },
  });

  useEffect(() => {
    if (aiWorkerRequested) return;
    if (filters.search.q.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAiWorkerRequested(true);
    }
  }, [aiWorkerRequested, filters.search.q]);

  useEffect(() => {
    if (!aiSearchAvailable) return;
    const trimmed = filters.search.q.trim();
    if (!trimmed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSemanticSearch(null);
      return;
    }
    const timeout = setTimeout(() => {
      pendingQueryRef.current = trimmed;
      getScores(ARCHIVE_EMBEDDINGS_KEY, trimmed)
        .then((scores) => {
          const scoreById: Record<string, number> = {};
          scores.forEach((entry) => {
            scoreById[normalize(entry.identifier)] = entry.score;
          });
          setSemanticSearch({ query: pendingQueryRef.current, scoreById });
        })
        .catch(() => {
          setSemanticSearch(null);
        });
    }, 100);

    return () => clearTimeout(timeout);
  }, [filters.search.q, aiSearchAvailable]);

  const handleArchiveHomeClick = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    e.preventDefault();
    filters.reset();
    refreshArchiveIndex();
    const sidebar = sidebarShellRef.current;
    if (sidebar) sidebar.scrollTo({ top: 0 });
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0 });
    }
  };

  useEffect(() => {
    const el = sidebarShellRef.current;
    if (!el) return;
    if (el.scrollTop !== 0) el.scrollTo({ top: 0 });
  }, [
    filters.authors.selected,
    filters.channels.selected,
    filters.tags.state,
    filters.tags.mode,
    filters.results.filtered.length,
  ]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">

      {(!isPostOpen && !isArchivePostURL) ? (
        <HeaderBar
          siteName={siteConfig.siteName}
          view="archive"
          logoSrc={siteConfig.logoSrc}
          discordInviteUrl={siteConfig.discordInviteUrl}
          filters={filters}
          aiSearchAvailable={aiSearchAvailable}
          aiSearchApplied={filters.semantic.applied}
          onAiSearchToggle={() => {
            if (!aiSearchAvailable) return;
            setSemanticForceDisabled((prev) => !prev);
          }}
          onArchiveSearchFocus={() => {
            setArchiveSearchFocused(true);
            setAiWorkerRequested(true);
          }}
          onArchiveSearchBlur={() => setArchiveSearchFocused(false)}
          archiveSearchFocused={archiveSearchFocused}
          onLogoClick={handleArchiveHomeClick}
          onArchiveClick={handleArchiveHomeClick}
        />
      ) : null}

      {isPostOpen ? (
        <ArchivePostView
          post={openPost}
          data={openData}
          dictionaryTooltips={openDictionaryTooltips}
          error={openError}
          globalTags={globalTags}
          archiveConfig={archiveConfig}
          onLinkClick={onLinkClick}
          goHome={goHome}
        />
      ) : null}

      <ArchiveListView
        visible={!isPostOpen && !isArchivePostURL}
        sidebarRef={sidebarShellRef}
        channelsList={channels}
        filters={filters}
        error={error}
        globalTags={globalTags}
        pageSize={pageSize}
        pageNumber={pageNumber}
        hydrated={hydrated}
        totalPosts={posts.length}
        onNavigate={(post, event) => {
          filters.search.commitSearch();
          return openPostFromList(post, event);
        }}
      />


      <Footer />
    </div>
  );
}
