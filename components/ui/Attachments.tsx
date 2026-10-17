'use client';

import Image from "next/image";
import React, { useState } from "react";
import { getYouTubeEmbedURL } from "@/lib/utils/media";
import type { Attachment, Image as ArchiveImage } from "@/lib/types";
import type { ArchiveListItem } from "@/lib/archive";
import { SCHEMATIC_VIEWER_KINDS, type AttachmentContext, type EmbedConfig } from "@/lib/embed/protocol";
import { attachmentURL } from "@/lib/github";
import { embedAttachment, embedPost } from "@/lib/embed/attachments";
import { useEmbed } from "../embed/EmbedProvider";
import { AttachmentAction } from "../embed/AttachmentAction";

type PdfPreviewRequest = { src: string; title?: string; description?: string };
type CsvPreviewRequest = { src: string; title?: string; description?: string };

export function AttachmentCard({
  att,
  post,
  context = { location: "post" },
  onView,
  onViewPdf,
  onViewCsv,
}: {
  att: Attachment;
  post: ArchiveListItem;
  context?: AttachmentContext;
  onView?(img: ArchiveImage): void;
  onViewPdf?(pdf: PdfPreviewRequest): void;
  onViewCsv?(csv: CsvPreviewRequest): void;
}) {
  const { connected, config } = useEmbed();
  const file = embedAttachment(att, post);
  const postInfo = embedPost(post);
  const resolvedURL = attachmentURL(post.channel.path, post.entry.path, att);
  const href = att.canDownload ? resolvedURL : att.url;
  const sourceURL = resolvedURL;
  const isSchematic = SCHEMATIC_VIEWER_KINDS.includes(file.kind);
  const schematicURL = isSchematic && sourceURL ? `https://llamamc.org/renderer?url=${encodeURIComponent(sourceURL)}` : null;
  const customActions = connected ? config.actions.filter((action) => action.kinds.includes(file.kind)) : [];
  const downloadMode = connected ? config.download[file.kind] : "keep";
  const viewerMode = connected ? config.viewSchematic.mode : "builtin";
  const useParentViewer = isSchematic && viewerMode === "parent";
  const useBuiltinViewer = isSchematic && viewerMode === "builtin";
  const isVideo = file.kind === "video";
  const kind = file.kind === "youtube"
    ? "YouTube"
    : file.kind === "litematic"
      ? "Litematic"
      : file.kind === "schematic"
        ? "Schematic"
        : file.kind === "wdl"
          ? "WDL"
          : isVideo
            ? "Video"
            : att.contentType?.toUpperCase() || "FILE";
  const ext = (att.name?.split(".")?.pop() || "").toUpperCase();
  const title = att.youtube?.title || att.name;
  const embedSrc = att.youtube ? getYouTubeEmbedURL(att.url) : null;
  const videoEmbedSrc = isVideo && sourceURL ? `https://faststream.online/player/#${sourceURL}` : null;
  const isImage = file.kind === "image";
  const isPdf = file.kind === "pdf";
  const pdfSource = isPdf ? sourceURL : null;
  const isCsv = file.kind === "csv";
  const csvSource = isCsv ? sourceURL : null;
  const imageForView: ArchiveImage = { ...att, path: sourceURL };
  const [schematicConfig, setSchematicConfig] = useState<EmbedConfig | null>(null);

  const schemInfo = att.schematic || att.litematic;
  return (
    <>
      <article className="flex h-full flex-col overflow-hidden rounded-xl border bg-white dark:border-gray-800 dark:bg-gray-900">
        {att.youtube ? (
          <div className="bg-black">
            {embedSrc ? (
              <iframe
                src={embedSrc}
                title={title}
                className="aspect-video w-full"
                frameBorder={0}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <a href={att.url} target="_blank" rel="noreferrer" className="block bg-black/5">
                <Image src={att.youtube!.thumbnail_url} alt={title} className="aspect-video w-full object-contain" width={att.youtube!.thumbnail_width} height={att.youtube!.thumbnail_height} unoptimized />
              </a>
            )}
          </div>
        ) : null}
        {videoEmbedSrc ? (
          <div className="bg-black">
            <iframe src={videoEmbedSrc} title={title} className="aspect-video w-full" frameBorder={0} allowFullScreen />
          </div>
        ) : null}
        {isImage && onView && att.canDownload ? <ImageThumb img={imageForView} onClick={() => onView(imageForView)} /> : null}

        <div className="flex flex-1 flex-col gap-2 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-mono text-gray-700 dark:bg-gray-800 dark:text-gray-200">
              {kind}
              {ext && !att.youtube ? ` · ${ext}` : ""}
            </span>
          </div>
          <h5 className="text-sm font-semibold leading-snug wrap-break-word">{title}</h5>
          {!att.youtube && <div className="text-[11px] text-gray-500 wrap-break-word">{att.name}</div>}
          {att.description && <div className="text-xs text-gray-700 dark:text-gray-300 wrap-break-word">{att.description}</div>}

          {schemInfo ? (
            <ul className="mt-1 text-xs text-gray-600 dark:text-gray-300">
              {schemInfo.version && (
                <li>
                  <span className="font-medium">Version:</span> {schemInfo.version}
                </li>
              )}
              {schemInfo.size && (
                <li>
                  <span className="font-medium">Size:</span> {schemInfo.size}
                </li>
              )}
              {schemInfo.error && <li className="text-red-600">{schemInfo.error}</li>}
            </ul>
          ) : null}
          {att.wdl ? (
            <ul className="mt-1 text-xs text-gray-600 dark:text-gray-300">
              {att.wdl.version && (
                <li>
                  <span className="font-medium">Minecraft:</span> {att.wdl.version}
                </li>
              )}
              {att.wdl.error && <li className="text-red-600">{att.wdl.error}</li>}
            </ul>
          ) : null}
          {att.youtube ? (
            <ul className="mt-1 text-xs text-gray-600 dark:text-gray-300">
              <li>
                <span className="font-medium">By:</span>{" "}
                {att.youtube.author_url ? (
                  <a className="underline" href={att.youtube.author_url} target="_blank" rel="noreferrer">
                    {att.youtube.author_name}
                  </a>
                ) : (
                  att.youtube.author_name
                )}
              </li>
              {att.youtube.width && att.youtube.height ? (
                <li>
                  <span className="font-medium">Resolution:</span> {att.youtube.width}×{att.youtube.height}
                </li>
              ) : null}
            </ul>
          ) : null}

          <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
            {useParentViewer ? (
              <AttachmentAction key={`view-${JSON.stringify(config)}`} id="view-schematic" label={config.viewSchematic.label} post={postInfo} attachment={file} context={context} />
            ) : useBuiltinViewer ? (
              <button
                type="button"
                onClick={() => schematicURL && setSchematicConfig(config)}
                disabled={!schematicURL}
                className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-gray-800"
              >
                {connected ? config.viewSchematic.label : "View Schematic"}
              </button>
            ) : null}
            {isPdf && pdfSource && onViewPdf ? (
              <button
                type="button"
                onClick={() => onViewPdf({ src: pdfSource, title, description: att.description })}
                className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                View PDF
              </button>
            ) : null}
            {isCsv && csvSource && onViewCsv ? (
              <button
                type="button"
                onClick={() => onViewCsv({ src: csvSource, title, description: att.description })}
                className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                View Spreadsheet
              </button>
            ) : null}
            {customActions.map((action) => (
              <AttachmentAction key={`${action.id}-${JSON.stringify(config)}`} id={action.id} label={action.label} post={postInfo} attachment={file} context={context} />
            ))}
            {downloadMode !== "keep" ? null : att.canDownload ? (
              <a href={href} download className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
                Download
              </a>
            ) : (
              <a href={href} target="_blank" rel="noreferrer" className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
                Open
              </a>
            )}
          </div>
        </div>
      </article>
      {schematicConfig === config && schematicURL && useBuiltinViewer ? (
        <div className="fixed inset-0 z-50 bg-black/80" onClick={() => setSchematicConfig(null)}>
          <div className="relative h-full w-full" onClick={(e) => e.stopPropagation()}>
            <iframe src={schematicURL} title={title ? `${title} schematic` : "Schematic viewer"} className="h-full w-full border-0 bg-white" allowFullScreen />
            <button
              type="button"
              className="absolute right-4 top-4 rounded-full border bg-white/80 px-3 py-1 text-sm font-semibold shadow-sm hover:bg-white dark:border-gray-700 dark:bg-gray-900/80"
              onClick={() => setSchematicConfig(null)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function ImageThumb({ img, onClick }: { img: ArchiveImage; onClick?(): void }) {
  const src = img.path ? img.path : img.url;
  return (
    <button className="block overflow-hidden rounded-lg border bg-black/5 dark:bg-white/5" onClick={onClick} title={img.description}>
      <Image src={src} alt={img.description || img.name} width={640} height={360} className="h-40 w-full object-contain" unoptimized />
    </button>
  );
}
