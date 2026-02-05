import type { ArchiveComment } from "@/lib/types";
import { attachmentURL } from "@/lib/github";
import { replaceAttachmentsInText } from "@/lib/utils/attachments";
import { AttachmentCard } from "../ui/Attachments";
import { AuthorInline } from "../ui/Authors";
import { MarkdownText } from "../ui/LinkHelpers";
import { RelativeTime } from "../ui/RelativeTime";
import type { LightboxState, PdfViewerState } from "./types";

type Props = {
  comments: ArchiveComment[];
  channelPath: string;
  entryPath: string;
  onLinkClick(e: React.MouseEvent<HTMLAnchorElement, MouseEvent>): void;
  setLightbox: (lightbox: LightboxState) => void;
  onViewPdf: (pdf: PdfViewerState) => void;
};

export function PostCommentsSection({
  comments,
  channelPath,
  entryPath,
  onLinkClick,
  setLightbox,
  onViewPdf,
}: Props) {
  if (!comments.length) return null;

  return (
    <section className="space-y-3">
      <h3 className="text-xl font-semibold tracking-wide text-gray-700 dark:text-gray-200">Comments</h3>
      <ol className="space-y-3">
        {comments.map((c) => {
          const attachments = (c.attachments || []).map((att) => ({
            ...att,
            path: att.path ? attachmentURL(channelPath, entryPath, att) : att.path,
          }));
          return (
            <li key={c.id} className="rounded-xl border p-3 dark:border-gray-800">
              <div className="flex items-center justify-between gap-2">
                <AuthorInline a={c.sender} />
                <RelativeTime className="text-xs text-gray-500" ts={c.timestamp} />
              </div>
              {c.content ? (
                <div className="mt-2 text-sm">
                  <MarkdownText text={replaceAttachmentsInText(c.content, attachments)} onLinkClick={onLinkClick} />
                </div>
              ) : null}
              {attachments.length ? (
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {attachments.map((att) => (
                    <AttachmentCard
                      key={att.id}
                      att={att}
                      onView={() =>
                        setLightbox({
                          src: att.path || att.url,
                          alt: att.description || att.name,
                          mode: "single",
                        })
                      }
                      onViewPdf={onViewPdf}
                    />
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
