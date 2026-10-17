export type AttachmentKind = "litematic" | "schematic" | "wdl" | "youtube" | "video" | "image" | "pdf" | "csv" | "other";
export interface CatalogEmbedConfig {
  actions?: Array<{ id: string; label: string; kinds: AttachmentKind[] }>;
  download?: Partial<Record<AttachmentKind, "keep" | "replace" | "hide">>;
  viewSchematic?: { mode?: "builtin" | "parent" | "hidden"; label?: string };
  appearance?: { compact?: boolean; hideNavigation?: boolean; hideFooter?: boolean; theme?: "light" | "dark" | "system" };
  actionTimeoutMs?: number;
}
export type ResolvedCatalogEmbedConfig = {
  actions: NonNullable<CatalogEmbedConfig["actions"]>;
  download: Required<NonNullable<CatalogEmbedConfig["download"]>>;
  viewSchematic: Required<NonNullable<CatalogEmbedConfig["viewSchematic"]>>;
  appearance: Required<NonNullable<CatalogEmbedConfig["appearance"]>>;
  actionTimeoutMs: number;
};
export interface CatalogFilters {
  q?: string;
  channels?: string[];
  authors?: string[];
  tags?: string[];
  excludeTags?: string[];
  tagMode?: "AND" | "OR";
  sort?: "newest" | "oldest" | "archived" | "archivedOldest" | "az";
}
export interface CatalogPost { id: string; code: string; title: string; url: string }
export interface CatalogAttachment {
  id: string;
  kind: AttachmentKind;
  name: string;
  downloadUrl: string | null;
  sourceUrl: string;
  canDownload: boolean;
  contentType: string;
  sizeBytes?: number;
  litematic?: { version?: string; size?: string; error?: string };
  schematic?: { version?: string; size?: string; error?: string };
  wdl?: { version?: string; error?: string };
}
interface Envelope { namespace: string; version: 1; sessionId: string }
export interface CatalogReady extends Envelope { type: "ready"; capabilities: string[] }
export interface CatalogConnected extends Envelope { type: "connected"; capabilities: string[] }
export interface CatalogPostChanged extends Envelope {
  type: "postChanged";
  post: CatalogPost | null;
  attachments: CatalogAttachment[];
  loading: boolean;
}
export interface CatalogAction extends Envelope {
  type: "action";
  requestId: string;
  actionId: string;
  post: CatalogPost;
  attachment: CatalogAttachment;
  context: { location: "post" | "comment"; commentId?: string };
}
export interface CatalogState {
  url: string;
  post: CatalogPost | null;
  attachments: CatalogAttachment[];
  loading: boolean;
  filters: Required<CatalogFilters>;
}
export class CatalogEmbedError extends Error { code: string; constructor(code: string, message: string) }
export interface CatalogEmbedClient {
  readonly ready: Promise<CatalogReady>;
  on(type: "connected", handler: (event: CatalogConnected) => void): () => void;
  on(type: "postChanged", handler: (event: CatalogPostChanged) => void): () => void;
  on(type: "action", handler: (event: CatalogAction) => void): () => void;
  on(type: "error", handler: (error: CatalogEmbedError) => void): () => void;
  configure(config: CatalogEmbedConfig): Promise<ResolvedCatalogEmbedConfig>;
  getState(): Promise<CatalogState>;
  openPost(selector: { id: string; code?: never } | { code: string; id?: never }): Promise<{ accepted: true; href: string }>;
  showArchive(filters?: CatalogFilters): Promise<{ accepted: true; href: string; filters: Required<CatalogFilters> }>;
  setFilters(filters: CatalogFilters): Promise<{ accepted: true; href: string; filters: Required<CatalogFilters> }>;
  reportAction(actionRequestId: string, status: "pending" | "success" | "failure", message?: string): Promise<null>;
  reconnect(): void;
  destroy(): void;
}
export function createCatalogEmbed(iframe: HTMLIFrameElement, options?: {
  origin?: string;
  /** Must match the site's embed namespace (siteConfig.embedNamespace). */
  namespace?: string;
  config?: CatalogEmbedConfig;
  timeoutMs?: number;
  connectTimeoutMs?: number;
}): CatalogEmbedClient;
