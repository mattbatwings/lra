'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { prefetchArchiveIndex } from "@/lib/archive";
import { siteConfig } from "@/lib/siteConfig";
import { stripBasePath } from "@/lib/utils/urls";
import { extractFiltersFromSearch } from "@/lib/filtering";
import { writeArchiveSession } from "@/lib/urlState";
import {
  DEFAULT_EMBED_CONFIG, EMBED_CAPABILITIES, EMBED_NAMESPACE, EMBED_VERSION, EmbedError,
  filtersSearch, parseConfig, parseFilters, record, textValue,
  type AttachmentContext, type EmbedAttachment, type EmbedConfig, type EmbedPost, type EmbedPostState,
} from "@/lib/embed/protocol";

type ActionOutcome = { status: "success" | "failure"; message: string };
type ActionPayload = { actionId: string; post: EmbedPost; attachment: EmbedAttachment; context: AttachmentContext };
type PendingAction = {
  key: string; timer: ReturnType<typeof setTimeout>; resolve(result: ActionOutcome): void;
  progress(message: string): void;
};
type EmbedContextValue = {
  connected: boolean;
  config: EmbedConfig;
  publishPost(state: EmbedPostState | null): void;
  registerNavigation(handler: (href: string) => void): () => void;
  performAction(payload: ActionPayload, progress: (message: string) => void): Promise<ActionOutcome>;
};
const EmbedContext = createContext<EmbedContextValue | null>(null);
export function useEmbed() {
  const value = useContext(EmbedContext);
  if (!value) throw new Error("EmbedProvider is missing.");
  return value;
}

export function EmbedProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const [config, setConfig] = useState(DEFAULT_EMBED_CONFIG);
  const configRef = useRef(config);
  const connection = useRef<{ origin: string; sessionId: string } | null>(null);
  const postState = useRef<EmbedPostState | null>(null);
  const navigation = useRef<((href: string) => void) | null>(null);
  const navigationSequence = useRef(0);
  const pending = useRef(new Map<string, PendingAction>());

  const send = useCallback((message: Record<string, unknown>) => {
    const peer = connection.current;
    if (peer) window.parent.postMessage({ namespace: EMBED_NAMESPACE, version: EMBED_VERSION, sessionId: peer.sessionId, ...message }, peer.origin);
  }, []);
  const publishPost = useCallback((state: EmbedPostState | null) => {
    if (JSON.stringify(postState.current) === JSON.stringify(state)) return;
    postState.current = state;
    send({ type: "postChanged", post: state?.post ?? null, attachments: state?.attachments ?? [], loading: state?.loading ?? false });
  }, [send]);
  const registerNavigation = useCallback((handler: (href: string) => void) => {
    navigation.current = handler;
    return () => { if (navigation.current === handler) navigation.current = null; };
  }, []);
  const finishAction = useCallback((id: string, result: ActionOutcome) => {
    const action = pending.current.get(id);
    if (!action) return;
    clearTimeout(action.timer);
    pending.current.delete(id);
    action.resolve(result);
  }, []);
  const cancelActions = useCallback(() => {
    for (const id of pending.current.keys()) finishAction(id, { status: "failure", message: "Action cancelled because the connection or configuration changed." });
  }, [finishAction]);
  const performAction = useCallback((payload: ActionPayload, progress: (message: string) => void): Promise<ActionOutcome> => {
    if (!connection.current) return Promise.resolve({ status: "failure", message: "The parent is not connected." });
    const key = JSON.stringify([payload.post.id, payload.context.location, payload.context.commentId, payload.attachment.id, payload.actionId]);
    if ([...pending.current.values()].some((item) => item.key === key)) return Promise.resolve({ status: "failure", message: "This action is already running." });
    const requestId = crypto.randomUUID();
    return new Promise((resolve) => {
      const timer = setTimeout(() => finishAction(requestId, { status: "failure", message: "The parent did not finish this action in time." }), configRef.current.actionTimeoutMs);
      pending.current.set(requestId, { key, timer, resolve, progress });
      send({ type: "action", requestId, ...payload });
    });
  }, [finishAction, send]);

  useEffect(() => {
    const navigate = (href: string) => {
      publishPost(null);
      if (navigation.current) navigation.current(href);
      else router.push(stripBasePath(href));
    };
    const handleMessage = async (event: MessageEvent) => {
      if (window.parent === window || event.source !== window.parent || !/^https?:\/\//.test(event.origin)) return;
      const message = event.data;
      if (!message || typeof message !== "object" || message.namespace !== EMBED_NAMESPACE) return;
      if (connection.current && event.origin !== connection.current.origin) return;
      if (message.type === "connect") {
        if (message.version !== EMBED_VERSION) {
          window.parent.postMessage({ namespace: EMBED_NAMESPACE, version: EMBED_VERSION, type: "error", requestId: message.requestId, code: "UNSUPPORTED_VERSION", message: "Only embed API version 1 is supported." }, event.origin);
          return;
        }
        if (!connection.current) {
          connection.current = { origin: event.origin, sessionId: crypto.randomUUID() };
          setConnected(true);
        }
        send({ type: "ready", capabilities: EMBED_CAPABILITIES });
        return;
      }
      if (!connection.current) return;
      // Ignore unrelated/stale traffic before examining its payload.
      if (message.version !== EMBED_VERSION || message.sessionId !== connection.current.sessionId) return;
      let requestId: string;
      try { requestId = textValue(message.requestId, "requestId", 128); } catch { return; }
      try {
        let result: unknown = null;
        switch (message.type) {
          case "configure": {
            const next = parseConfig(message.payload);
            cancelActions();
            configRef.current = next;
            setConfig(next);
            result = next;
            break;
          }
          case "disconnect": {
            cancelActions();
            const reset = structuredClone(DEFAULT_EMBED_CONFIG);
            configRef.current = reset;
            setConfig(reset);
            setConnected(false);
            break;
          }
          case "getState": {
            const parsed = extractFiltersFromSearch(new URLSearchParams(window.location.search), ["newest", "oldest", "archived", "archivedOldest", "az"]);
            const tags = Object.keys(parsed.tagState);
            result = {
              url: window.location.href,
              post: postState.current?.post ?? null,
              attachments: postState.current?.attachments ?? [],
              loading: postState.current?.loading ?? false,
              filters: { q: parsed.q, channels: parsed.selectedChannels, authors: parsed.selectedAuthors, tags: tags.filter((tag) => parsed.tagState[tag] === 1), excludeTags: tags.filter((tag) => parsed.tagState[tag] === -1), tagMode: parsed.tagMode, sort: parsed.sortKey ?? "newest" },
            };
            break;
          }
          case "openPost": {
            const input = record(message.payload);
            const hasId = input.id !== undefined;
            if (hasId === (input.code !== undefined)) throw new EmbedError("INVALID_ARGUMENT", "Provide exactly one of id or code.");
            const value = textValue(hasId ? input.id : input.code, hasId ? "id" : "code");
            const sequence = ++navigationSequence.current;
            const archive = await prefetchArchiveIndex();
            if (sequence !== navigationSequence.current) throw new EmbedError("SUPERSEDED", "A newer navigation request replaced this request.");
            if (!archive) throw new EmbedError("LOAD_FAILED", "Unable to load the archive index.");
            const match = archive.posts.find((post) => hasId ? post.entry.id === value : post.entry.codes.some((code) => code.toLowerCase() === value.toLowerCase()));
            if (!match) throw new EmbedError("NOT_FOUND", "Post not found.");
            const href = `${siteConfig.basePath}/archives/${encodeURIComponent(match.slug)}/`;
            navigate(href);
            result = { accepted: true, href };
            break;
          }
          case "showArchive":
          case "setFilters": {
            const filters = parseFilters(message.payload ?? {});
            ++navigationSequence.current;
            writeArchiveSession({ q: filters.q, committedQ: filters.q, selectedChannels: filters.channels, selectedAuthors: filters.authors, tagMode: filters.tagMode, tagState: Object.fromEntries([...filters.tags.map((tag) => [tag, 1]), ...filters.excludeTags.map((tag) => [tag, -1])]) as Record<string, -1 | 0 | 1>, sortKey: filters.sort });
            const query = filtersSearch(filters);
            const href = `${siteConfig.basePath}/archives/${query ? `?${query}` : ""}`;
            navigate(href);
            result = { accepted: true, href, filters };
            break;
          }
          case "actionResult": {
            const input = record(message.payload);
            const actionRequestId = textValue(input.actionRequestId, "actionRequestId", 128);
            const action = pending.current.get(actionRequestId);
            if (!action) throw new EmbedError("NOT_FOUND", "Action is no longer pending.");
            if (!["pending", "success", "failure"].includes(input.status as string)) throw new EmbedError("INVALID_ARGUMENT", "Invalid action status.");
            const status = input.status as "pending" | "success" | "failure";
            const messageText = input.message === undefined ? (status === "pending" ? "Working…" : status === "success" ? "Done." : "The action failed.") : textValue(input.message, "message", 500);
            if (status === "pending") action.progress(messageText);
            else finishAction(actionRequestId, { status, message: messageText });
            break;
          }
          default: throw new EmbedError("UNKNOWN_COMMAND", "Unknown embed command.");
        }
        send({ type: "response", requestId, result });
        if (message.type === "disconnect") connection.current = null;
      } catch (error) {
        send({ type: "error", requestId, code: error instanceof EmbedError ? error.code : "INTERNAL_ERROR", message: error instanceof Error ? error.message : "Unable to complete command." });
      }
    };
    window.addEventListener("message", handleMessage);
    return () => { window.removeEventListener("message", handleMessage); cancelActions(); };
  }, [router, send, cancelActions, finishAction, publishPost]);

  useEffect(() => {
    const root = document.documentElement;
    if (!connected) return;
    root.dataset.embed = "true";
    root.dataset.embedCompact = String(config.appearance.compact);
    root.dataset.embedHideNavigation = String(config.appearance.hideNavigation);
    root.dataset.embedHideFooter = String(config.appearance.hideFooter);
    root.dataset.theme = config.appearance.theme;
    return () => {
      for (const key of ["embed", "embedCompact", "embedHideNavigation", "embedHideFooter", "theme"]) delete root.dataset[key];
    };
  }, [connected, config.appearance]);

  const value = useMemo(() => ({ connected, config, publishPost, registerNavigation, performAction }), [connected, config, publishPost, registerNavigation, performAction]);
  return <EmbedContext.Provider value={value}>{children}</EmbedContext.Provider>;
}
