const CACHE_VERSION = "v1";
const INDEX_CACHE = `st2-archive-index-${CACHE_VERSION}`;
const META_CACHE = `st2-archive-index-meta-${CACHE_VERSION}`;
// __CACHE_CONSTANTS_START__
const INDEX_TTL_MS = 300000;
const ENTRY_TTL_MS = 600000;
const DICTIONARY_ENTRY_TTL_MS = 1800000;
// __CACHE_CONSTANTS_END__

const INDEX_SUFFIXES = [
  "/persistent.idx",
  "/config.json",
  "/dictionary/config.json",
];
const ENTRY_SUFFIXES = [
  "/data.json",
  "/comments.json",
];
const DICTIONARY_ENTRY_SEGMENT = "/dictionary/entries/";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => {
      if (key === INDEX_CACHE || key === META_CACHE) return null;
      if (key.startsWith("st2-archive-index-") || key.startsWith("st2-archive-index-meta-")) {
        return caches.delete(key);
      }
      return null;
    }));
    await self.clients.claim();
  })());
});

function shouldHandle(url) {
  if (!url || (url.protocol !== "http:" && url.protocol !== "https:")) return false;
  const path = url.pathname;
  if (INDEX_SUFFIXES.some((suffix) => path.endsWith(suffix))) return true;
  if (ENTRY_SUFFIXES.some((suffix) => path.endsWith(suffix))) return true;
  if (path.includes(DICTIONARY_ENTRY_SEGMENT) && path.endsWith(".json")) return true;
  return false;
}

function getTTLForPath(path) {
  if (path.includes(DICTIONARY_ENTRY_SEGMENT) && path.endsWith(".json")) return DICTIONARY_ENTRY_TTL_MS;
  if (ENTRY_SUFFIXES.some((suffix) => path.endsWith(suffix))) return ENTRY_TTL_MS;
  if (INDEX_SUFFIXES.some((suffix) => path.endsWith(suffix))) return INDEX_TTL_MS;
  return INDEX_TTL_MS;
}

function metaRequest(request) {
  const base = (self.registration && self.registration.scope) ? self.registration.scope : `${self.location.origin}/`;
  const url = new URL("__sw-meta__", base);
  url.searchParams.set("u", request.url);
  return new Request(url.toString(), { method: "GET" });
}

async function getMetaTimestamp(metaCache, request) {
  const metaResponse = await metaCache.match(metaRequest(request));
  if (!metaResponse) return 0;
  const text = await metaResponse.text();
  const ts = Number(text);
  return Number.isFinite(ts) ? ts : 0;
}

async function setMetaTimestamp(metaCache, request, timestamp) {
  await metaCache.put(metaRequest(request), new Response(String(timestamp)));
}

// async function updateCache(request, cache, metaCache) {
//   try {
//     const response = await fetch(request);
//     if (response && response.ok) {
//       await cache.put(request, response.clone());
//       await setMetaTimestamp(metaCache, request, Date.now());
//     }
//   } catch {
//     // ignore update failures
//   }
// }

async function withFetchedAtHeader(response, fetchedAt) {
  if (!response || response.type === "opaque") return response;
  if (!fetchedAt || !Number.isFinite(fetchedAt)) return response;
  const headers = new Headers(response.headers);
  headers.set("x-st2-sw-fetched-at", String(fetchedAt));
  const body = await response.clone().arrayBuffer();
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (!request || request.method !== "GET") return;
  const url = new URL(request.url);
  if (!shouldHandle(url)) return;

  event.respondWith((async () => {
    const cache = await caches.open(INDEX_CACHE);
    const metaCache = await caches.open(META_CACHE);
    const cached = await cache.match(request);
    const fetchedAt = cached ? await getMetaTimestamp(metaCache, request) : 0;
    const age = fetchedAt ? Date.now() - fetchedAt : Number.POSITIVE_INFINITY;
    const ttlMs = getTTLForPath(url.pathname);

    if (cached && age < ttlMs) {
      // event.waitUntil(updateCache(request, cache, metaCache));
      return withFetchedAtHeader(cached, fetchedAt);
    }

    try {
      const response = await fetch(request);
      if (response && response.ok) {
        const now = Date.now();
        await cache.put(request, response.clone());
        await setMetaTimestamp(metaCache, request, now);
        return withFetchedAtHeader(response, now);
      }
      if (cached) return cached;
      return response;
    } catch (error) {
      if (cached) return withFetchedAtHeader(cached, fetchedAt);
      throw error;
    }
  })());
});
