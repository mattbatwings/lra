import { assetURL } from "@/lib/github";

export type EmbeddingsEntryRaw = {
  identifier: string;
  embedding: string;
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

let worker: Worker | null = null;
let workerInitialized = false;
const pendingRequests = new Map<string, PendingRequest>();
const loadedKeys = new Set<string>();

const initWorker = () => {
  if (worker) return;
  worker = new Worker(new URL("../workers/embeddingSearchWorker", import.meta.url));
  workerInitialized = true;

  worker.addEventListener("message", (event: MessageEvent) => {
    const data = event.data as { type?: string; requestId?: string; scores?: Array<{ identifier: string; score: number }> };
    if (!data?.type || !data.requestId) return;
    const pending = pendingRequests.get(data.requestId);
    if (!pending) return;
    pendingRequests.delete(data.requestId);
    if (data.type === "getScoresComplete") {
      pending.resolve(data.scores ?? []);
      return;
    }
    if (data.type === "setEmbeddingsComplete") {
      pending.resolve(true);
      return;
    }
    if (data.type === "getScoresError") {
      pending.reject(new Error("Embedding search failed"));
    }
  });

  worker.addEventListener("error", () => {
    pendingRequests.forEach((pending) => pending.reject(new Error("Embedding worker error")));
    pendingRequests.clear();
  });
};

const sendRequest = <T>(message: Record<string, unknown>) => {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Embedding search is unavailable on the server"));
  }
  initWorker();
  const requestId = `${message.type}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return new Promise<T>((resolve, reject) => {
    pendingRequests.set(requestId, { resolve: resolve as (value: unknown) => void, reject });
    worker?.postMessage({ ...message, requestId });
  });
};

export const buildEmbeddingsUrl = (relPath: string) => assetURL("", "", relPath);

export const ensureEmbeddingsLoaded = async (key: string, relPath: string) => {
  if (loadedKeys.has(key)) return true;
  if (typeof window === "undefined") return false;
  initWorker();
  const res = await fetch(buildEmbeddingsUrl(relPath));
  if (!res.ok) throw new Error(`Failed to load embeddings: ${res.status}`);
  const entries = (await res.json()) as EmbeddingsEntryRaw[];
  await sendRequest<boolean>({ type: "setEmbeddings", key, entries });
  loadedKeys.add(key);
  return true;
};

export const getScores = async (key: string, query: string) => {
  return sendRequest<Array<{ identifier: string; score: number }>>({ type: "getScores", key, query });
};

export const isWorkerReady = () => workerInitialized;
