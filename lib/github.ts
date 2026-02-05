import { siteConfig } from "./siteConfig";
import { BaseAttachment, DEFAULT_BRANCH, DEFAULT_OWNER, DEFAULT_REPO } from "./types";

export function getRawURL(owner: string, repo: string, branch: string, path: string) {
  const safe = encodeURI(path.replace(/^\/+/, ""));
  return `https://raw.githubusercontent.com/${owner}/${repo}/refs/heads/${branch}/${safe}`;
}

export function getMediaURL(owner: string, repo: string, branch: string, path: string) {
  const safe = encodeURI(path.replace(/^\/+/, ""));
  return `https://media.githubusercontent.com/media/${owner}/${repo}/refs/heads/${branch}/${safe}`;
}

const lastFetchTimestamps = new Map<string, number>();

export function joinAssetPath(channelPath: string, entryPath: string, rel: string) {
  return [channelPath, entryPath, rel].join("/").replace(/\/{2,}/g, "/").replace(/^\/+/, "");
}

export function assetURL(
  channelPath: string,
  entryPath: string,
  rel: string,
) {
  const joined = joinAssetPath(channelPath, entryPath, rel);
  return getRawURL(DEFAULT_OWNER, DEFAULT_REPO, DEFAULT_BRANCH, joined);
}

export function attachmentURL(
  channelPath: string,
  entryPath: string,
  attachment: BaseAttachment,
) {
  if (attachment.downloadUrl) {
    return attachment.downloadUrl;
  }

  if (!attachment.path) {
    return attachment.url;
  }

  // check extension
  const extension = attachment.name.split(".").pop() ?? "";
  const lfsExtensions = siteConfig.lfsExtensions;
  const shouldUseLFS = lfsExtensions.includes(extension.toLowerCase());
  const joined = joinAssetPath(channelPath, entryPath, attachment.path);
  return shouldUseLFS
    ? getMediaURL(DEFAULT_OWNER, DEFAULT_REPO, DEFAULT_BRANCH, joined)
    : getRawURL(DEFAULT_OWNER, DEFAULT_REPO, DEFAULT_BRANCH, joined);
}

export async function fetchJSONRaw<T>(
  path: string,
  cache: RequestCache = "no-cache",
): Promise<T> {
  const url = getRawURL(DEFAULT_OWNER, DEFAULT_REPO, DEFAULT_BRANCH, path);
  const res = await fetch(url, { cache });
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  const fetchedAt = Number(res.headers.get("x-st2-sw-fetched-at")) || Date.now();
  lastFetchTimestamps.set(url, fetchedAt);
  return res.json();
}

export async function fetchArrayBufferRaw(
  path: string,
  cache: RequestCache = "no-cache",
): Promise<ArrayBuffer> {
  const url = getRawURL(DEFAULT_OWNER, DEFAULT_REPO, DEFAULT_BRANCH, path);
  const res = await fetch(url, { cache });
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  const fetchedAt = Number(res.headers.get("x-st2-sw-fetched-at")) || Date.now();
  lastFetchTimestamps.set(url, fetchedAt);
  return res.arrayBuffer();
}

export function getLastFetchTimestampForPath(path: string) {
  const url = getRawURL(DEFAULT_OWNER, DEFAULT_REPO, DEFAULT_BRANCH, path);
  return lastFetchTimestamps.get(url) ?? 0;
}

export async function asyncPool<T, R>(limit: number, items: T[], fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  const workers: Promise<void>[] = [];
  async function work() {
    while (i < items.length) {
      const cur = i++;
      results[cur] = await fn(items[cur], cur);
    }
  }
  for (let k = 0; k < Math.max(1, Math.min(limit, items.length)); k++) workers.push(work());
  await Promise.allSettled(workers);
  return results;
}
