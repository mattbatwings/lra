import { assetURL, fetchArrayBufferRaw, fetchJSONRaw, getLastFetchTimestampForPath } from "./github";
import {
  ArchiveComment,
  ArchiveConfig,
  ArchiveConfigJSON,
  ArchivedPostReference,
  ArchiveEntryData,
  ChannelRef,
  DictionaryConfig,
  DictionaryEntry,
  IndexEntry,
  IndexedDictionaryEntry,
  IndexedPost,
  DEFAULT_GLOBAL_TAGS,
  getEntryUpdatedAt,
} from "./types";
import { deserializePersistentIndex, type PersistentIndex } from "./utils/persistentIndex";
import { disableLiveFetch } from "./runtimeFlags";
import {
  ARCHIVE_CACHE_TTL_MS,
  DICTIONARY_CACHE_TTL_MS,
  DICTIONARY_PREFETCH_MAX,
  ENTRY_PREFETCH_MAX,
  ENTRY_PREFETCH_TTL_MS,
} from "./cacheConstants";

export type ArchiveListItem = IndexedPost & { slug: string };

export type ArchiveIndex = {
  config: ArchiveConfig;
  channels: ChannelRef[];
  posts: ArchiveListItem[];
};

export type DictionaryIndex = {
  config: DictionaryConfig;
  entries: IndexedDictionaryEntry[];
};

const archiveConfigCache = new Map<string, Promise<ArchiveConfigJSON | null>>();

type ArchiveIndexCache = {
  index: ArchiveIndex;
  fetchedAt: number;
  updatedAt: number;
};

let archiveIndexClientCache: ArchiveIndexCache | null = null;
let archiveIndexPrefetchPromise: Promise<ArchiveIndex | null> | null = null;
let lastArchiveFetchAt = 0;

type DictionaryIndexCache = {
  index: DictionaryIndex;
  fetchedAt: number;
  updatedAt: number;
};

let dictionaryIndexClientCache: DictionaryIndexCache | null = null;
let dictionaryIndexPrefetchPromise: Promise<DictionaryIndex | null> | null = null;
let lastDictionaryFetchAt = 0;

function getArchiveIndexUpdatedAt(index: ArchiveIndex): number {
  const configUpdated = index.config.updatedAt ?? 0;
  if (configUpdated) return configUpdated;
  let maxEntryUpdated = 0;
  for (const post of index.posts) {
    const ts = getEntryUpdatedAt(post.entry);
    if (typeof ts === "number" && ts > maxEntryUpdated) maxEntryUpdated = ts;
  }
  return maxEntryUpdated;
}

export function getCachedArchiveIndex(): ArchiveIndexCache | null {
  return archiveIndexClientCache;
}

export function setCachedArchiveIndex(index: ArchiveIndex, fetchedAt = Date.now()): ArchiveIndexCache {
  const cache: ArchiveIndexCache = {
    index,
    fetchedAt,
    updatedAt: getArchiveIndexUpdatedAt(index),
  };
  archiveIndexClientCache = cache;
  return cache;
}

export function getLastArchiveFetchAt() {
  return lastArchiveFetchAt;
}

function getDictionaryIndexUpdatedAt(index: DictionaryIndex): number {
  let maxUpdatedAt = 0;
  for (const entry of index.entries) {
    const ts = entry.index.updatedAt ?? 0;
    if (ts > maxUpdatedAt) maxUpdatedAt = ts;
  }
  return maxUpdatedAt;
}

export function getCachedDictionaryIndex(): DictionaryIndexCache | null {
  return dictionaryIndexClientCache;
}

export function setCachedDictionaryIndex(index: DictionaryIndex, fetchedAt = Date.now()): DictionaryIndexCache {
  const cache: DictionaryIndexCache = {
    index,
    fetchedAt,
    updatedAt: getDictionaryIndexUpdatedAt(index),
  };
  dictionaryIndexClientCache = cache;
  return cache;
}

export function getLastDictionaryFetchAt() {
  return lastDictionaryFetchAt;
}

export async function prefetchArchiveIndex(ttlMs = ARCHIVE_CACHE_TTL_MS): Promise<ArchiveIndex | null> {
  const cached = getCachedArchiveIndex();
  if (cached && Date.now() - cached.fetchedAt < ttlMs) return cached.index;
  if (archiveIndexPrefetchPromise) return archiveIndexPrefetchPromise;
  archiveIndexPrefetchPromise = (async () => {
    try {
      const idx = await fetchArchiveIndex();
      const fetchedAt = getLastArchiveFetchAt() || Date.now();
      setCachedArchiveIndex(idx, fetchedAt);
      return idx;
    } catch {
      return null;
    } finally {
      archiveIndexPrefetchPromise = null;
    }
  })();
  return archiveIndexPrefetchPromise;
}

export async function prefetchPostCardImages(posts: ArchiveListItem[]): Promise<void> {
  // dynamic import getPreviewByCode to avoid circular dependency
  const { getPreviewByCode } = await import("./previews");
  posts.forEach((post) => {
    const preview = getPreviewByCode(post.entry.codes[0]);
    const heroSrc = post.entry.mainImagePath
        ? assetURL(post.channel.path, post.entry.path, post.entry.mainImagePath)
        : null;
    
    const isUsingOptimizedPreview = preview && heroSrc === preview.sourceUrl;
    const displaySrc = isUsingOptimizedPreview ? preview.localPath : heroSrc;
    if (displaySrc) {
      const img = new Image();
      img.src = displaySrc;
    }
  });
}


export async function prefetchIndexAndLatestPosts(): Promise<void> {
  const index = await prefetchArchiveIndex();
  if (!index) return;
  // sort posts by newest updated
  index.posts.sort((a, b) => {
    const aUpdated = a.entry.updatedAt;
    const bUpdated = b.entry.updatedAt;
    return bUpdated - aUpdated;
  });
  
  // prefetch post card images for first 12 posts
  const postsToPrefetch = index.posts.slice(0, 12);
  await prefetchPostCardImages(postsToPrefetch);
}

export async function prefetchDictionaryIndex(ttlMs = DICTIONARY_CACHE_TTL_MS): Promise<DictionaryIndex | null> {
  const cached = getCachedDictionaryIndex();
  if (cached && Date.now() - cached.fetchedAt < ttlMs) return cached.index;
  if (dictionaryIndexPrefetchPromise) return dictionaryIndexPrefetchPromise;
  dictionaryIndexPrefetchPromise = (async () => {
    try {
      const idx = await fetchDictionaryIndex();
      const fetchedAt = getLastDictionaryFetchAt() || Date.now();
      setCachedDictionaryIndex(idx, fetchedAt);
      return idx;
    } catch {
      return null;
    } finally {
      dictionaryIndexPrefetchPromise = null;
    }
  })();
  return dictionaryIndexPrefetchPromise;
}

async function fetchArchiveConfig(): Promise<ArchiveConfigJSON | null> {
  if (typeof window !== "undefined") return null;
  const key = "archive-config";
  const cached = archiveConfigCache.get(key);
  if (cached) return cached;
  const promise = (async () => {
    try {
      return await fetchJSONRaw<ArchiveConfigJSON>("config.json");
    } catch {
      return null;
    }
  })();
  archiveConfigCache.set(key, promise);
  return promise;
}

export function slugifyName(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildEntrySlug(entry: IndexEntry) {
  const base = entry.codes[0];
  const name = entry.name ? slugifyName(entry.name) : "";
  if (!base) return name;
  if (!name) return base;
  return `${base}-${name}`;
}

export function buildEntrySlugFromReference(entry: ArchivedPostReference) {
  const base = entry.code;
  const name = entry.name ? slugifyName(entry.name) : "";
  if (!base) return name;
  if (!name) return base;
  return `${base}-${name}`;
}

export function slugMatchesEntry(slug: string, entry: IndexEntry) {
  const lowerSlug = slug.toLowerCase();
  const entrySlug = buildEntrySlug(entry).toLowerCase();
  if (lowerSlug === entrySlug) return true;
  const slugCode = getPostCodeFromSlug(lowerSlug);
  if (!slugCode) return false;
  return entry.codes.some((code) => code.toLowerCase() === slugCode);
}

function persistentIndexToArchive(idx: PersistentIndex, archiveConfig?: ArchiveConfigJSON | null): ArchiveIndex {
  const categories = idx.all_categories || [];
  const tags = idx.all_tags || [];
  const authors = idx.all_authors || [];

  const channels: ChannelRef[] = idx.channels.map((channel) => ({
    code: channel.code,
    name: channel.name,
    description: channel.description,
    category: categories[channel.category] || "",
    path: channel.path,
    availableTags: Array.from(new Set(channel.tags.map((tagIdx) => tags[tagIdx]).filter(Boolean))),
  }));

  const posts: ArchiveListItem[] = [];
  let maxEntryUpdatedAt = 0;
  idx.channels.forEach((channel, i) => {
    const channelRef = channels[i];
    channel.entries.forEach((entry) => {
      const codes = entry.codes;
      const entryRef: IndexEntry = {
        id: entry.id,
        name: entry.name,
        codes,
        tags: Array.from(new Set(entry.tags.map((tagIdx) => tags[tagIdx]).filter(Boolean))),
        authors: Array.from(new Set(entry.authors.map((authorIdx) => authors[authorIdx]).filter(Boolean))),
        updatedAt: entry.updated_at,
        archivedAt: entry.archived_at,
        path: entry.path,
        mainImagePath: entry.main_image_path
      };
      const entryUpdatedAt = getEntryUpdatedAt(entryRef) ?? 0;
      if (entryUpdatedAt > maxEntryUpdatedAt) maxEntryUpdatedAt = entryUpdatedAt;
      posts.push({ channel: channelRef, entry: entryRef, slug: buildEntrySlug(entryRef) });
    });
  });

  posts.sort((a, b) => (getEntryUpdatedAt(b.entry) ?? 0) - (getEntryUpdatedAt(a.entry) ?? 0));

  const archiveUpdatedAt = Math.max(idx.updated_at ?? 0, maxEntryUpdatedAt);
  const config: ArchiveConfig = {
    postStyle: idx.schemaStyles || {},
    updatedAt: archiveUpdatedAt,
    allTags: tags,
    allAuthors: authors,
    allCategories: categories,
    globalTags: archiveConfig?.globalTags?.length ? archiveConfig.globalTags : DEFAULT_GLOBAL_TAGS,
  };

  return { config, channels, posts };
}

export async function fetchArchiveIndex(): Promise<ArchiveIndex> {
  const archiveConfig = await fetchArchiveConfig();
  const cached = await readArchiveIndexCache();
  if (cached) return applyGlobalTagsToArchive(cached, archiveConfig);
  const buffer = await fetchArrayBufferRaw("persistent.idx");
  lastArchiveFetchAt = getLastFetchTimestampForPath("persistent.idx") || Date.now();
  const idx = deserializePersistentIndex(buffer);
  return persistentIndexToArchive(idx, archiveConfig);
}

export type PostWithArchive = {
  archive: ArchiveIndex;
  post: ArchiveListItem;
  data: ArchiveEntryData;
};

const archiveIndexCache = new Map<string, Promise<ArchiveIndex>>();
const postPayloadCache = new Map<string, Promise<ArchiveEntryData>>();
const entryPrefetchCache = new Map<string, { promise: Promise<ArchiveEntryData | null>; fetchedAt: number }>();
const dictionaryPrefetchCache = new Map<string, { promise: Promise<DictionaryEntry | null>; fetchedAt: number }>();

function prunePrefetchCache<T>(
  cache: Map<string, { promise: Promise<T | null>; fetchedAt: number }>,
  maxSize: number,
  ttlMs: number,
) {
  if (cache.size === 0) return;
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.fetchedAt > ttlMs) cache.delete(key);
  }
  if (cache.size <= maxSize) return;
  const overflow = cache.size - maxSize;
  const entries = Array.from(cache.entries()).sort((a, b) => a[1].fetchedAt - b[1].fetchedAt);
  for (let i = 0; i < overflow; i += 1) {
    cache.delete(entries[i][0]);
  }
}

export async function fetchPostData(
  channelPath: string,
  entry: IndexEntry
): Promise<ArchiveEntryData> {
  const path = `${channelPath}/${entry.path}/data.json`;
  return fetchJSONRaw<ArchiveEntryData>(path);
}

export function prefetchArchiveEntryData(
  post: ArchiveListItem,
  ttlMs = ENTRY_PREFETCH_TTL_MS,
): Promise<ArchiveEntryData | null> {
  if (disableLiveFetch) return Promise.resolve(null);
  const path = `${post.channel.path}/${post.entry.path}/data.json`;
  prunePrefetchCache(entryPrefetchCache, ENTRY_PREFETCH_MAX, ttlMs);
  const cached = entryPrefetchCache.get(path);
  if (cached && Date.now() - cached.fetchedAt < ttlMs) return cached.promise;
  const promise = fetchPostData(post.channel.path, post.entry)
    .then((data) => data)
    .catch(() => null);
  entryPrefetchCache.set(path, { promise, fetchedAt: Date.now() });
  return promise;
}

export function prefetchArchiveEntryMainImage(
  post: ArchiveListItem,
  data: ArchiveEntryData | null,
) {
  // return null; // skip for now.
  if (!data || !data.images.length || !data.images[0].path) return;
  const imageUrl = assetURL(post.channel.path, post.entry.path, data.images[0].path);
  
  // make a dummy image element to preload
  const img = new Image();
  img.src = imageUrl;
}

export function prefetchArchiveEntryWithMainImage(
  post: ArchiveListItem,
) {
  return prefetchArchiveEntryData(post).then((data) => {
    if (data) {
      prefetchArchiveEntryMainImage(post, data);
    }
    return data;
  });
}

export async function fetchPostWithArchive(
  slug: string
): Promise<PostWithArchive | null> {
  // first, fetch archive index
  const indexKey = "archive-index";
  const archivePromise =
    archiveIndexCache.get(indexKey) ??
    (async () => {
      const idx = await fetchArchiveIndex();
      archiveIndexCache.set(indexKey, Promise.resolve(idx));
      return idx;
    })();
  archiveIndexCache.set(indexKey, archivePromise);
  const archiveIndex = await archivePromise;


  // then, find post by slug
  const key = slug.toLowerCase();
  const match = findPostBySlug(archiveIndex.posts, slug);
  if (!match) return null;

  // check cache for post payload
  const cachedPayload = postPayloadCache.get(key);
  if (cachedPayload) {
    return {
      archive: archiveIndex,
      post: match,
      data: await cachedPayload,
    }
  }

  const promise = (async () => {
    const data = await fetchPostData(match.channel.path, match.entry);
    return data;
  })();

  postPayloadCache.set(key, promise);

  return {
    archive: archiveIndex,
    post: match,
    data: await promise,
  };
}

export async function fetchCommentsData(
  channelPath: string,
  entry: IndexEntry
): Promise<ArchiveComment[]> {
  const path = `${channelPath}/${entry.path}/comments.json`;
  try {
    return await fetchJSONRaw<ArchiveComment[]>(path);
  } catch {
    return [];
  }
}

export async function fetchDictionaryIndex(): Promise<DictionaryIndex> {
  const cached = await readDictionaryIndexCache();
  if (cached) return cached;
  const config = await fetchJSONRaw<DictionaryConfig>("dictionary/config.json");
  lastDictionaryFetchAt = getLastFetchTimestampForPath("dictionary/config.json") || Date.now();
  const entries: IndexedDictionaryEntry[] = config.entries
    .map((index) => ({ index }))
    .sort((a, b) => {
      const aTerm = (a.index.terms?.[0] || "").toLowerCase();
      const bTerm = (b.index.terms?.[0] || "").toLowerCase();
      if (aTerm && bTerm) return aTerm.localeCompare(bTerm);
      return aTerm ? -1 : bTerm ? 1 : 0;
    });
  return { config, entries };
}

async function readArchiveIndexCache(): Promise<ArchiveIndex | null> {
  if (typeof window !== "undefined") return null;
  try {
    const { readFile } = await import("node:fs/promises");
    const path = await import("node:path");
    const file = path.join(process.cwd(), "lib", "generated", "archive-index.json");
    const raw = await readFile(file, "utf-8");
    const parsed = JSON.parse(raw) as ArchiveIndex;
    if (!parsed || !Array.isArray(parsed.posts)) return null;
    if (!parsed.config?.postStyle) return null;
    if (!Array.isArray(parsed.config.allAuthors)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function applyGlobalTagsToArchive(base: ArchiveIndex, archiveConfig?: ArchiveConfigJSON | null): ArchiveIndex {
  const globalTags = archiveConfig?.globalTags?.length ? archiveConfig.globalTags : DEFAULT_GLOBAL_TAGS;
  if (base.config.globalTags === globalTags) return base;
  return { ...base, config: { ...base.config, globalTags } };
}

async function readDictionaryIndexCache(): Promise<DictionaryIndex | null> {
  if (typeof window !== "undefined") return null;
  try {
    const { readFile } = await import("node:fs/promises");
    const path = await import("node:path");
    const file = path.join(process.cwd(), "lib", "generated", "dictionary-index.json");
    const raw = await readFile(file, "utf-8");
    const parsed = JSON.parse(raw) as DictionaryIndex;
    if (!parsed || !Array.isArray(parsed.entries)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function fetchDictionaryEntry(
  id: string
): Promise<DictionaryEntry> {
  const path = `dictionary/entries/${id}.json`;
  return fetchJSONRaw<DictionaryEntry>(path);
}

export function prefetchDictionaryEntryData(
  id: string,
  ttlMs = ENTRY_PREFETCH_TTL_MS,
): Promise<DictionaryEntry | null> {
  if (disableLiveFetch) return Promise.resolve(null);
  const key = id.trim();
  if (!key) return Promise.resolve(null);
  prunePrefetchCache(dictionaryPrefetchCache, DICTIONARY_PREFETCH_MAX, ttlMs);
  const cached = dictionaryPrefetchCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < ttlMs) return cached.promise;
  const promise = fetchDictionaryEntry(key)
    .then((data) => data)
    .catch(() => null);
  dictionaryPrefetchCache.set(key, { promise, fetchedAt: Date.now() });
  return promise;
}

export function findPostBySlug(posts: ArchiveListItem[], slug: string): ArchiveListItem | undefined {
  const lower = slug.toLowerCase();
  return posts.find((p) => p.slug.toLowerCase() === lower || slugMatchesEntry(lower, p.entry));
}

export function getPostCodeFromSlug(slug: string): string | null {
  const parts = slug.split("-");
  if (parts.length === 0) return null;
  return parts[0];
}