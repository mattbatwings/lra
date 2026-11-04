import type { Attachment } from "@/lib/types";
import type { ArchiveListItem } from "@/lib/archive";
import { AttachmentCard } from "../ui/Attachments";
import type { CsvViewerState, LightboxState, PdfViewerState } from "./types";

type Props = {
  post: ArchiveListItem;
  attachments: Array<Attachment & { path?: string }>;
  setLightbox: (lightbox: LightboxState) => void;
  onViewPdf: (pdf: PdfViewerState) => void;
  onViewCsv: (csv: CsvViewerState) => void;
};

export function PostAttachmentsSection({ post, attachments, setLightbox, onViewPdf, onViewCsv }: Props) {
  if (!attachments.length) return null;

  return (
    <section className="space-y-3">
      <h3 className="text-xl font-semibold tracking-wide text-gray-700 dark:text-gray-200">Attachments</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {attachments.map((att) => (
          <AttachmentCard
            key={att.id}
            att={att}
            post={post}
            onView={(img) =>
              setLightbox({
                src: img.path || img.url,
                alt: att.description || att.name,
                mode: "single",
              })
            }
            onViewPdf={(pdf) => onViewPdf(pdf)}
            onViewCsv={(csv) => onViewCsv(csv)}
          />
        ))}
      </div>
    </section>
  );
}
