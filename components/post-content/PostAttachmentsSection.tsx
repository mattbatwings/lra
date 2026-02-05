import type { Attachment } from "@/lib/types";
import { AttachmentCard } from "../ui/Attachments";
import type { LightboxState, PdfViewerState } from "./types";

type Props = {
  attachments: Array<Attachment & { path?: string }>;
  setLightbox: (lightbox: LightboxState) => void;
  onViewPdf: (pdf: PdfViewerState) => void;
};

export function PostAttachmentsSection({ attachments, setLightbox, onViewPdf }: Props) {
  if (!attachments.length) return null;

  return (
    <section className="space-y-3">
      <h3 className="text-xl font-semibold tracking-wide text-gray-700 dark:text-gray-200">Attachments</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            onViewPdf={(pdf) => onViewPdf(pdf)}
          />
        ))}
      </div>
    </section>
  );
}
