'use client';

import { useEffect } from "react";

const RELOAD_KEY = "__app_reload_on_chunk_error__";

function shouldReloadOnce() {
  try {
    if (sessionStorage.getItem(RELOAD_KEY)) return false;
    sessionStorage.setItem(RELOAD_KEY, "1");
    return true;
  } catch {
    return true;
  }
}

function isChunkLoadErrorMessage(message: string) {
  return (
    message.includes("Loading chunk") ||
    message.includes("ChunkLoadError") ||
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Importing a module script failed")
  );
}

export function AutoReloadOnChunkError() {
  useEffect(() => {
    const onError = (event: Event) => {
      const e = event as ErrorEvent;
      const msg = String(e?.message || "");
      if (isChunkLoadErrorMessage(msg) && shouldReloadOnce()) {
        window.location.reload();
      }
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const msg =
        typeof reason === "string"
          ? reason
          : String(reason?.message || reason || "");
      if (isChunkLoadErrorMessage(msg) && shouldReloadOnce()) {
        window.location.reload();
      }
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
