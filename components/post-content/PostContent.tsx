'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import { DictionaryModal } from "../archive/DictionaryModal";
import { RelativeTime } from "../ui/RelativeTime";
import { fetchCommentsData, fetchDictionaryEntry, prefetchArchiveEntryData } from "@/lib/archive";
import { getDictionaryIdFromSlug } from "@/lib/dictionary";
import { getArchiveSlugInfo, getDictionarySlugInfo } from "@/lib/utils/urls";
import { assetURL, attachmentURL } from "@/lib/github";
import { type ArchiveListItem } from "@/lib/archive";
import { disableLiveFetch } from "@/lib/runtimeFlags";
import { type ArchiveEntryData, type ArchiveComment, type Author, type GlobalTag, type IndexedDictionaryEntry, type Reference, type StyleInfo } from "@/lib/types";
import { siteConfig } from "@/lib/siteConfig";
import { AuthorsLine, EndorsersLine } from "../ui/Authors";
import { ChannelBadge } from "../ui/ChannelBadge";
import { RecordRenderer } from "../ui/LinkHelpers";
import { TagList } from "../ui/Tags";
import { PostGallery } from "./PostGallery";
import { PostAcknowledgements } from "./PostAcknowledgements";
import { PostAttachmentsSection } from "./PostAttachmentsSection";
import { PostCommentsSection } from "./PostCommentsSection";
import { PostPdfModal } from "./PostPdfModal";
import { PostLightbox } from "./PostLightbox";
import type { LightboxState, PdfPageInfo, PdfViewerState } from "./types";
import { applyTempHistoryState, buildHistoryState, getHistoryState, getTempHistoryState, saveTempHistoryState } from "@/lib/urlState";

type Props = {
  post: ArchiveListItem;
  preloadImage?: boolean;
  data?: ArchiveEntryData;
  schemaStyles?: Record<string, StyleInfo>;
  dictionaryTooltips?: Record<string, string>;
  globalTags?: GlobalTag[];
  onLinkClick?(e: React.MouseEvent<HTMLAnchorElement, MouseEvent>): void;
};

export function PostContent({ post, data, schemaStyles, dictionaryTooltips, globalTags, onLinkClick, preloadImage }: Props) {
  const [liveState, setLiveState] = useState<ArchiveEntryData | null>(null);
  const baseData = data;
  const currentData = liveState ? liveState : baseData;
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [pdfViewer, setPdfViewer] = useState<PdfViewerState | null>(null);
  const [pdfPageInfo, setPdfPageInfo] = useState<PdfPageInfo>({ page: 1, total: 0 });
  const [activeDictionary, setActiveDictionary] = useState<IndexedDictionaryEntry | null>(null);
  const activeDictionaryRef = useRef<IndexedDictionaryEntry | null>(null);
  const dictionaryRequestRef = useRef<symbol | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [comments, setComments] = useState<ArchiveComment[] | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const numComments = currentData?.num_comments ?? 0;
  const basePath = siteConfig.basePath || "";
  const expectedPathname = `${basePath}/archives/${encodeURIComponent(post.slug)}`;

  useEffect(() => {
    if (disableLiveFetch) return;
    let cancelled = false;
    prefetchArchiveEntryData(post)
      .then((fresh) => {
        if (!cancelled) setLiveState(fresh);
      })
      .catch(() => { });
    return () => {
      cancelled = true;
    };
  }, [post, setLiveState]);

  useEffect(() => {
    if (disableLiveFetch) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setComments(null);
      setCommentsLoading(false);
      return;
    }
    if (numComments === 0) {
      setComments([]);
      setCommentsLoading(false);
      return;
    }
    let cancelled = false;
    setComments(null);
    setCommentsLoading(true);
    fetchCommentsData(post.channel.path, post.entry)
      .then((items) => {
        if (!cancelled) setComments(items);
      })
      .catch(() => {
        if (!cancelled) setComments([]);
      })
      .finally(() => {
        if (!cancelled) setCommentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [post.channel.path, post.entry, numComments]);

  useEffect(() => {
    activeDictionaryRef.current = activeDictionary;
  }, [activeDictionary]);

  const handlePdfPageChange = useCallback((page: number, total: number) => {
    setPdfPageInfo((prev) => (prev.page === page && prev.total === total ? prev : { page, total }));
  }, []);

  const closePdfViewer = useCallback(() => {
    setPdfViewer(null);
    setPdfPageInfo({ page: 1, total: 0 });
  }, []);

  const setDidQueryParam = useCallback((did: string | null) => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const currentDid = sp.get("did");
    if (currentDid === did) return;

    if (did) {
      sp.set("did", did);
    } else {
      sp.delete("did");
    }

    const hash = window.location.hash;
    const path = window.location.pathname || expectedPathname;
    const query = sp.toString();
    const next = query ? `${path}?${query}${hash}` : `${path}${hash}`;
    const current = `${window.location.pathname}${window.location.search}${hash}`;
    if (next === current) return;
    // Avoid triggering Next.js navigation on non-prerendered archive pages.
    const currentState = getHistoryState();
    const nextState = buildHistoryState({
      ...currentState,
      lastDictionaryId: currentDid || undefined,
      backCount: currentState.backCount ? currentState.backCount + 1 : 2,
    });
    window.history.pushState(nextState, "", next);
  }, [expectedPathname]);

  const closeDictionaryEntry = useCallback(() => {
    dictionaryRequestRef.current = null;
    setActiveDictionary(null);
    setDidQueryParam(null);
  }, [setDidQueryParam]);

  const openDictionaryEntry = useCallback((did: string) => {
    const trimmed = did.trim();
    if (!trimmed) return false;
    if (activeDictionaryRef.current?.index.id === trimmed && activeDictionaryRef.current.data) {
      setDidQueryParam(trimmed);
      return true;
    }

    const requestToken = Symbol("dictionary-request");
    dictionaryRequestRef.current = requestToken;
    setDidQueryParam(trimmed);

    if (disableLiveFetch) {
      setActiveDictionary({
        index: { id: trimmed, terms: [trimmed], summary: "", updatedAt: Date.now() },
        data: undefined as never,
      });
      return true;
    }

    fetchDictionaryEntry(trimmed)
      .then((entryData) => {
        if (dictionaryRequestRef.current !== requestToken) return;
        setActiveDictionary({
          index: {
            id: entryData.id,
            terms: entryData.terms,
            summary: entryData.definition?.slice(0, 140) || "",
            updatedAt: entryData.updatedAt,
          },
          data: entryData,
        });
      })
      .catch(() => {
        if (dictionaryRequestRef.current !== requestToken) return;
        setActiveDictionary({
          index: { id: trimmed, terms: [trimmed], summary: "", updatedAt: Date.now() },
          data: undefined as never,
        });
      });
    return true;
  }, [setDidQueryParam]);

  const onLinkClickWrapper = useCallback((e: React.MouseEvent<HTMLAnchorElement, MouseEvent>): void => {
    const href = e.currentTarget.href;
    if (!href) return;
    let url: URL;
    try {
      url = new URL(href, window.location.href);
    } catch {
      return;
    }
    if (url.origin !== window.location.origin) return;
    let did = url.searchParams.get("did");
    if (!did) {
      const { slug } = getDictionarySlugInfo(url);
      if (slug) did = getDictionaryIdFromSlug(slug);
    }
    if (did) {
      openDictionaryEntry(did);
      e.preventDefault();
      return;
    }
    if (onLinkClick) {
      onLinkClick(e);
    } else {
      // check if archive link and handle internally
      const archiveSlug = getArchiveSlugInfo(url).slug;
      if (!archiveSlug) return;
     

      // set state for temp history
      const currentState = getHistoryState();
      const nextState = buildHistoryState({
        ...currentState,
        lastPostCode: currentData?.code,
        lastDictionaryId: undefined,
        lastBackCount: currentState.backCount,
        backCount: undefined,
      });

      saveTempHistoryState(nextState, url.href);
    }
  }, [currentData, onLinkClick, openDictionaryEntry]);

  // also set session storage on beforeunload to handle hard reloads
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleBeforeUnload = () => {
      const currentTempHistoryState = getTempHistoryState();
      if (currentTempHistoryState) return;
      // check to make sure post matches current url
      const url = new URL(window.location.href);
      const slug = getArchiveSlugInfo(url).slug;
      if (slug !== post.slug) return;
      saveTempHistoryState(getHistoryState(), url.href);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [currentData, post.slug]);

  useEffect(() => {
    if (typeof window === "undefined" || onLinkClick) return;
    applyTempHistoryState();
  },[onLinkClick]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const did = sp.get("did");
    if (did) {
      queueMicrotask(() => openDictionaryEntry(did));
    }
    const normalizePath = (value: string) => (value === "/" ? "/" : value.replace(/\/+$/, ""));

    const handleURLState = () => {
      setTimeout(() => {
        if (normalizePath(window.location.pathname) !== normalizePath(expectedPathname)) return;
        const nextParams = new URLSearchParams(window.location.search);
        const nextDid = nextParams.get("did");
        if (nextDid) {
          openDictionaryEntry(nextDid);
        } else {
          dictionaryRequestRef.current = null;
          setActiveDictionary(null);
        }
      }, 1)
    };
    window.addEventListener("popstate", handleURLState);
    return () => {
      window.removeEventListener("popstate", handleURLState);
    };
  }, [expectedPathname, openDictionaryEntry, setDidQueryParam]);

  const images = currentData?.images?.map((img) => ({
    ...img,
    path: img.path ? assetURL(post.channel.path, post.entry.path, img.path) : img.url,
  })) ?? [];
  const imageAspect = "16/9";

  const attachments = currentData?.attachments?.map((att) => ({
    ...att,
    path: att.path ? attachmentURL(post.channel.path, post.entry.path, att) : att.path,
  })) ?? [];

  const updatedAt = currentData?.updatedAt ?? post.entry.updatedAt;
  const archivedAt = currentData?.archivedAt ?? post.entry.archivedAt;
  const acknowledgements = currentData
    ? (currentData as { acknowledgements?: Array<Partial<Author> & { reason?: string }> }).acknowledgements || []
    : [];
  const authorReferences = currentData
    ? (currentData as { author_references?: Reference[] }).author_references
    : undefined;

  return (
    <article className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-3 border-b pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Archive Entry</p>
            <h1 className="text-3xl font-bold leading-tight text-gray-900 dark:text-white">{post.entry.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <ChannelBadge ch={post.channel} />
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-mono dark:bg-gray-800">{post.entry.codes[0]}</span>
              {(updatedAt !== undefined && updatedAt !== archivedAt) ? (
                <RelativeTime className="text-gray-700 dark:text-gray-200" prefix="Updated" ts={updatedAt} />
              ) : null}
              {archivedAt !== undefined ? (
                <RelativeTime className="text-gray-700 dark:text-gray-200" prefix="Archived" ts={archivedAt} />
              ) : null}
            </div>
          </div>
        </div>
        <TagList tags={post.entry.tags || []} globalTags={globalTags} />
        {currentData ? (
          <div className="flex flex-col gap-2">
            <AuthorsLine authors={currentData.authors || []} />
            <EndorsersLine endorsers={currentData.endorsers || []} />
          </div>
        ) : null}
      </header>

      <PostGallery
        preloadImage={preloadImage}
        images={images}
        activeImageIndex={activeImageIndex}
        setActiveImageIndex={setActiveImageIndex}
        setLightbox={setLightbox}
        imageAspect={imageAspect}
      />

      {currentData?.records ? (
        <RecordRenderer
          records={currentData.records}
          recordStyles={currentData.styles}
          schemaStyles={schemaStyles}
          references={currentData.references}
          dictionaryTooltips={dictionaryTooltips}
          onLinkClick={onLinkClickWrapper}
        />
      ) : (
        <div className="text-sm text-gray-500">Loading post body...</div>
      )}

      <PostAcknowledgements
        acknowledgements={acknowledgements}
        authorReferences={authorReferences}
        dictionaryTooltips={dictionaryTooltips}
        onLinkClick={onLinkClickWrapper}
      />

      <PostAttachmentsSection
        attachments={attachments}
        setLightbox={setLightbox}
        onViewPdf={(pdf) => {
          setPdfPageInfo({ page: 1, total: 0 });
          setPdfViewer(pdf);
        }}
      />

      {commentsLoading ? (
        <div className="text-sm text-gray-500">Loading comments...</div>
      ) : comments?.length ? (
        <PostCommentsSection
          comments={comments}
          channelPath={post.channel.path}
          entryPath={post.entry.path}
          onLinkClick={onLinkClickWrapper}
          setLightbox={setLightbox}
          onViewPdf={(pdf) => {
            setPdfPageInfo({ page: 1, total: 0 });
            setPdfViewer(pdf);
          }}
        />
      ) : null}

      {currentData?.post?.threadURL ? (
        <a
          href={currentData.post.threadURL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-fit items-center gap-2 rounded-full border px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          View Discord Thread
        </a>
      ) : null}

      {pdfViewer ? (
        <PostPdfModal
          pdfViewer={pdfViewer}
          pdfPageInfo={pdfPageInfo}
          onClose={closePdfViewer}
          onPageChange={handlePdfPageChange}
        />
      ) : null}

      {lightbox ? (
        <PostLightbox
          lightbox={lightbox}
          images={images}
          activeImageIndex={activeImageIndex}
          setActiveImageIndex={setActiveImageIndex}
          setLightbox={setLightbox}
          onClose={() => setLightbox(null)}
          imageAspect={imageAspect}
        />
      ) : null}

      {activeDictionary ? (
        <DictionaryModal
          entry={activeDictionary}
          onClose={closeDictionaryEntry}
          dictionaryTooltips={dictionaryTooltips}
          onLinkClick={onLinkClickWrapper}
          currentPost={post}
        />
      ) : null}
    </article>
  );
}
