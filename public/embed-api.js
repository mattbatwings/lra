/** Logical Redstone Archive embed API v1. Dependency-free ES module for the parent page. */
// Must match the site's siteConfig.embedNamespace; override per iframe with options.namespace.
const defaultNamespace = "logical-redstone-archive";
const version = 1;

export class CatalogEmbedError extends Error {
  constructor(code, message) { super(message); this.name = "CatalogEmbedError"; this.code = code; }
}

export function createCatalogEmbed(iframe, options = {}) {
  if (!iframe || iframe.tagName !== "IFRAME") throw new TypeError("Expected an iframe element.");
  const origin = new URL(options.origin ?? iframe.src, window.location.href).origin;
  if (!/^https?:\/\//.test(origin)) throw new TypeError("The catalog must have an HTTP(S) origin.");
  const namespace = options.namespace ?? defaultNamespace;
  if (typeof namespace !== "string" || !namespace) throw new TypeError("namespace must be a nonempty string.");
  const timeoutMs = options.timeoutMs ?? 15000;
  let configuration = structuredClone(options.config ?? {});
  let sessionId = null;
  let initialized = false;
  let destroyed = false;
  let connectTimer;
  let connectDeadline;
  let resolveReady;
  let rejectReady;
  let ready;
  const listeners = new Map();
  const pending = new Map();

  function emit(type, message) {
    for (const handler of listeners.get(type) ?? []) {
      try { handler(message); } catch (error) { setTimeout(() => { throw error; }); }
    }
  }
  function post(message) {
    iframe.contentWindow?.postMessage({ namespace, version, sessionId, ...message }, origin);
  }
  function clearPending(reason) {
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(reason); }
    pending.clear();
  }
  function rawRequest(type, payload) {
    if (destroyed) return Promise.reject(new CatalogEmbedError("DESTROYED", "The embed client has been destroyed."));
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(requestId);
        reject(new CatalogEmbedError("TIMEOUT", `${type} timed out.`));
      }, timeoutMs);
      pending.set(requestId, { resolve, reject, timer });
      post({ type, requestId, payload });
    });
  }
  async function request(type, payload) {
    if (destroyed) throw new CatalogEmbedError("DESTROYED", "The embed client has been destroyed.");
    await ready;
    return rawRequest(type, payload);
  }
  function start() {
    if (destroyed) return;
    rejectReady?.(new CatalogEmbedError("RECONNECTED", "The catalog document reloaded."));
    clearPending(new CatalogEmbedError("RECONNECTED", "The catalog document reloaded."));
    clearInterval(connectTimer);
    clearTimeout(connectDeadline);
    sessionId = null;
    initialized = false;
    ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
    // Consumers can use events instead of awaiting ready.
    void ready.catch(() => {});
    const connect = () => post({ type: "connect" });
    connect();
    connectTimer = setInterval(connect, 250);
    connectDeadline = setTimeout(() => {
      clearInterval(connectTimer);
      const error = new CatalogEmbedError("TIMEOUT", "The catalog did not connect in time.");
      rejectReady(error);
      emit("error", error);
    }, options.connectTimeoutMs ?? 15000);
  }
  async function onMessage(event) {
    if (destroyed || event.origin !== origin || event.source !== iframe.contentWindow) return;
    const message = event.data;
    if (!message || message.namespace !== namespace || message.version !== version) return;
    if (message.type === "ready" && typeof message.sessionId === "string") {
      if (message.sessionId === sessionId) return;
      clearInterval(connectTimer);
      clearTimeout(connectDeadline);
      if (sessionId) {
        start();
        clearInterval(connectTimer);
        clearTimeout(connectDeadline);
      }
      sessionId = message.sessionId;
      const initializingSession = sessionId;
      try {
        await rawRequest("configure", configuration);
        if (sessionId !== initializingSession || destroyed) return;
        initialized = true;
        resolveReady(message);
        emit("connected", { ...message, type: "connected" });
        // The post may have rendered before the parent connected.
        const state = await rawRequest("getState");
        if (sessionId === initializingSession) emit("postChanged", { namespace, version, ...state, type: "postChanged", sessionId });
      } catch (error) {
        if (sessionId !== initializingSession || destroyed) return;
        rejectReady(error);
        emit("error", error);
      }
      return;
    }
    if (message.sessionId !== sessionId) return;
    if (message.type === "response" || message.type === "error") {
      const item = pending.get(message.requestId);
      if (!item) return;
      pending.delete(message.requestId);
      clearTimeout(item.timer);
      if (message.type === "error") item.reject(new CatalogEmbedError(message.code, message.message));
      else item.resolve(message.result);
    } else if (initialized) emit(message.type, message);
  }
  window.addEventListener("message", onMessage);
  iframe.addEventListener("load", start);
  start();
  return {
    get ready() { return ready; },
    on(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
      return () => listeners.get(type)?.delete(handler);
    },
    async configure(config) {
      const snapshot = structuredClone(config);
      const result = await request("configure", snapshot);
      configuration = snapshot;
      return result;
    },
    getState: () => request("getState"),
    openPost: (selector) => request("openPost", selector),
    showArchive: (filters = {}) => request("showArchive", filters),
    setFilters: (filters) => request("setFilters", filters),
    reportAction: (actionRequestId, status, message) => request("actionResult", { actionRequestId, status, message }),
    reconnect: start,
    destroy() {
      if (destroyed) return;
      if (sessionId) post({ type: "disconnect", requestId: crypto.randomUUID() });
      destroyed = true;
      clearInterval(connectTimer);
      clearTimeout(connectDeadline);
      const error = new CatalogEmbedError("DESTROYED", "The embed client has been destroyed.");
      rejectReady?.(error);
      clearPending(error);
      window.removeEventListener("message", onMessage);
      iframe.removeEventListener("load", start);
      listeners.clear();
    },
  };
}
