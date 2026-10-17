import type { SortKey } from "../types";
import { siteConfig } from "../siteConfig";

export const EMBED_NAMESPACE = siteConfig.embedNamespace;
export const EMBED_VERSION = 1;
export const EMBED_CAPABILITIES = ["attachmentActions", "viewSchematic", "actionResults", "navigation", "state", "filters", "appearance"] as const;
export const ATTACHMENT_KINDS = ["litematic", "schematic", "wdl", "youtube", "video", "image", "pdf", "csv", "other"] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];
/** Kinds that get the built-in or parent schematic viewer. */
export const SCHEMATIC_VIEWER_KINDS: readonly AttachmentKind[] = ["litematic", "schematic"];
type DownloadMode = "keep" | "replace" | "hide";
export type EmbedAction = { id: string; label: string; kinds: AttachmentKind[] };
export type EmbedConfig = {
  actions: EmbedAction[];
  download: Record<AttachmentKind, DownloadMode>;
  viewSchematic: { mode: "builtin" | "parent" | "hidden"; label: string };
  appearance: { compact: boolean; hideNavigation: boolean; hideFooter: boolean; theme: "light" | "dark" | "system" };
  actionTimeoutMs: number;
};
export const DEFAULT_EMBED_CONFIG: EmbedConfig = {
  actions: [],
  download: Object.fromEntries(ATTACHMENT_KINDS.map((kind) => [kind, "keep"])) as Record<AttachmentKind, DownloadMode>,
  viewSchematic: { mode: "builtin", label: "View Schematic" },
  appearance: { compact: false, hideNavigation: false, hideFooter: false, theme: "system" },
  actionTimeoutMs: 60_000,
};
export type EmbedFilters = {
  q: string; channels: string[]; authors: string[]; tags: string[]; excludeTags: string[];
  tagMode: "AND" | "OR"; sort: SortKey;
};
export type EmbedPost = { id: string; code: string; title: string; url: string };
export type EmbedAttachment = {
  id: string; kind: AttachmentKind; name: string; downloadUrl: string | null;
  sourceUrl: string; canDownload: boolean; contentType: string; sizeBytes?: number;
  litematic?: { version?: string; size?: string; error?: string };
  schematic?: { version?: string; size?: string; error?: string };
  wdl?: { version?: string; error?: string };
};
export type AttachmentContext = { location: "post" | "comment"; commentId?: string };
export type EmbedPostState = { post: EmbedPost; attachments: EmbedAttachment[]; loading: boolean };
export class EmbedError extends Error {
  constructor(public code: string, message: string) { super(message); }
}
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new EmbedError("INVALID_ARGUMENT", "Expected an object.");
  return value as Record<string, unknown>;
}
export function textValue(value: unknown, name: string, max = 200): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new EmbedError("INVALID_ARGUMENT", `${name} must be a nonempty string of at most ${max} characters.`);
  return value;
}
function choice<T extends string>(value: unknown, choices: readonly T[], name: string): T {
  if (!choices.includes(value as T)) throw new EmbedError("INVALID_ARGUMENT", `Invalid ${name}.`);
  return value as T;
}
function bool(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") throw new EmbedError("INVALID_ARGUMENT", `${name} must be a boolean.`);
  return value;
}
function stringList(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || value.length > 100) throw new EmbedError("INVALID_ARGUMENT", `${name} must be an array with at most 100 items.`);
  return [...new Set(value.map((item) => textValue(item, name)))];
}
function knownKeys(value: Record<string, unknown>, keys: string[]) {
  if (Object.keys(value).some((key) => !keys.includes(key))) throw new EmbedError("INVALID_ARGUMENT", "Unknown configuration field.");
}
export function parseConfig(input: unknown): EmbedConfig {
  const value = record(input);
  knownKeys(value, ["actions", "download", "viewSchematic", "appearance", "actionTimeoutMs"]);
  const result: EmbedConfig = structuredClone(DEFAULT_EMBED_CONFIG);
  if (value.actions !== undefined) {
    if (!Array.isArray(value.actions) || value.actions.length > 12) throw new EmbedError("INVALID_ARGUMENT", "At most 12 actions are supported.");
    result.actions = value.actions.map((item) => {
      const action = record(item);
      knownKeys(action, ["id", "label", "kinds"]);
      const id = textValue(action.id, "action id", 64);
      if (!/^[a-zA-Z0-9_-]+$/.test(id) || id === "view-schematic") throw new EmbedError("INVALID_ARGUMENT", "Invalid or reserved action id.");
      const kinds = stringList(action.kinds, "kinds").map((kind) => choice<AttachmentKind>(kind, ATTACHMENT_KINDS, "attachment kind"));
      if (!kinds.length) throw new EmbedError("INVALID_ARGUMENT", "An action needs at least one attachment kind.");
      return { id, label: textValue(action.label, "action label", 80), kinds };
    });
    if (new Set(result.actions.map((action) => action.id)).size !== result.actions.length) throw new EmbedError("INVALID_ARGUMENT", "Action ids must be unique.");
  }
  if (value.download !== undefined) {
    const download = record(value.download);
    knownKeys(download, [...ATTACHMENT_KINDS]);
    for (const kind of ATTACHMENT_KINDS) {
      if (download[kind] !== undefined) result.download[kind] = choice(download[kind], ["keep", "replace", "hide"], "download mode");
      if (result.download[kind] === "replace" && !result.actions.some((action) => action.kinds.includes(kind))) throw new EmbedError("INVALID_ARGUMENT", `Replacing ${kind} downloads requires a matching action.`);
    }
  }
  if (value.viewSchematic !== undefined) {
    const view = record(value.viewSchematic);
    knownKeys(view, ["mode", "label"]);
    if (view.mode !== undefined) result.viewSchematic.mode = choice(view.mode, ["builtin", "parent", "hidden"], "viewer mode");
    if (view.label !== undefined) result.viewSchematic.label = textValue(view.label, "viewer label", 80);
  }
  if (value.appearance !== undefined) {
    const appearance = record(value.appearance);
    knownKeys(appearance, ["compact", "hideNavigation", "hideFooter", "theme"]);
    for (const key of ["compact", "hideNavigation", "hideFooter"] as const) if (appearance[key] !== undefined) result.appearance[key] = bool(appearance[key], key);
    if (appearance.theme !== undefined) result.appearance.theme = choice(appearance.theme, ["light", "dark", "system"], "theme");
  }
  if (value.actionTimeoutMs !== undefined) {
    if (!Number.isInteger(value.actionTimeoutMs) || (value.actionTimeoutMs as number) < 1000 || (value.actionTimeoutMs as number) > 300_000) throw new EmbedError("INVALID_ARGUMENT", "actionTimeoutMs must be an integer from 1000 to 300000.");
    result.actionTimeoutMs = value.actionTimeoutMs as number;
  }
  return result;
}
export function parseFilters(input: unknown): EmbedFilters {
  const value = record(input);
  knownKeys(value, ["q", "channels", "authors", "tags", "excludeTags", "tagMode", "sort"]);
  if (value.q !== undefined && (typeof value.q !== "string" || value.q.length > 1000)) throw new EmbedError("INVALID_ARGUMENT", "q must be a string of at most 1000 characters.");
  const result: EmbedFilters = {
    q: (value.q as string | undefined) ?? "",
    channels: stringList(value.channels ?? [], "channels"), authors: stringList(value.authors ?? [], "authors"),
    tags: stringList(value.tags ?? [], "tags"), excludeTags: stringList(value.excludeTags ?? [], "excludeTags"),
    tagMode: choice(value.tagMode ?? "AND", ["AND", "OR"], "tag mode"),
    sort: choice(value.sort ?? "newest", ["newest", "oldest", "archived", "archivedOldest", "az"], "sort"),
  };
  if ([...result.channels, ...result.authors, ...result.tags, ...result.excludeTags].some((item) => item.includes(","))) throw new EmbedError("INVALID_ARGUMENT", "Filter list values cannot contain commas.");
  return result;
}
export function filtersSearch(filters: EmbedFilters): string {
  const search = new URLSearchParams();
  if (filters.q) search.set("q", filters.q);
  if (filters.sort !== "newest") search.set("sort", filters.sort);
  if (filters.tagMode !== "AND") search.set("tagMode", filters.tagMode);
  for (const [key, values] of [["channels", filters.channels], ["authors", filters.authors], ["tags", filters.tags], ["xtags", filters.excludeTags]] as const) {
    if (values.length) search.set(key, values.join(","));
  }
  return search.toString();
}
export function absoluteHttpUrl(value: string, base: string): string | null {
  try { const url = new URL(value, base); return ["http:", "https:"].includes(url.protocol) ? url.href : null; } catch { return null; }
}
