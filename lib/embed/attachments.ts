import type { ArchiveListItem } from "../archive";
import type { Attachment } from "../types";
import { attachmentURL } from "../github";
import { siteConfig } from "../siteConfig";
import { absoluteHttpUrl, type AttachmentKind, type EmbedAttachment, type EmbedPost } from "./protocol";

/** Classifies an attachment; the attachment card and the embed protocol both use this. */
export function attachmentKind(att: Attachment): AttachmentKind {
  const name = att.name || "";
  const contentType = att.contentType?.toLowerCase() || "";
  if (att.youtube) return "youtube";
  if (att.litematic || /\.litematic$/i.test(name)) return "litematic";
  if (att.schematic || /\.(schem|schematic|nbt)$/i.test(name)) return "schematic";
  // WDL detection relies on parsed metadata; a ZIP name alone does not imply a world download.
  if (att.wdl) return "wdl";
  if (contentType.startsWith("video/") || /\.(mp4|webm|m3u8|mpd)$/i.test(name)) return "video";
  if (contentType.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name)) return "image";
  if (contentType.includes("pdf") || /\.pdf$/i.test(name)) return "pdf";
  if (contentType.includes("csv") || /\.(csv|tsv)$/i.test(name)) return "csv";
  return "other";
}

export function embedPost(post: ArchiveListItem): EmbedPost {
  return { id: post.entry.id, code: post.entry.codes[0], title: post.entry.name, url: `${siteConfig.siteUrl}/archives/${encodeURIComponent(post.slug)}/` };
}
export function embedAttachment(att: Attachment, post: ArchiveListItem): EmbedAttachment {
  const url = absoluteHttpUrl(attachmentURL(post.channel.path, post.entry.path, att), siteConfig.siteUrl);
  return {
    id: att.id, kind: attachmentKind(att), name: att.name,
    downloadUrl: att.canDownload ? url : null, sourceUrl: att.url, canDownload: att.canDownload && !!url,
    contentType: att.contentType, sizeBytes: att.size, litematic: att.litematic, schematic: att.schematic, wdl: att.wdl,
  };
}
