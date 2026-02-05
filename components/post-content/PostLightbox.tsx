import Image from "next/image";
import type { Image as ArchiveImage } from "@/lib/types";
import type { LightboxState } from "./types";

const DEFAULT_ASPECT = "16/9";

type Props = {
  lightbox: LightboxState;
  images: Array<ArchiveImage & { path?: string }>;
  activeImageIndex: number;
  setActiveImageIndex: React.Dispatch<React.SetStateAction<number>>;
  setLightbox: (lightbox: LightboxState) => void;
  onClose: () => void;
  imageAspect?: string;
};

export function PostLightbox({
  lightbox,
  images,
  activeImageIndex,
  setActiveImageIndex,
  setLightbox,
  onClose,
  imageAspect = DEFAULT_ASPECT,
}: Props) {
  const activeImage = images[activeImageIndex] || null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="relative w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
        <div className="relative w-full overflow-hidden rounded-xl bg-black" style={{ aspectRatio: imageAspect, maxHeight: "80vh" }}>
          <Image src={lightbox.src} alt={lightbox.alt} fill className="object-contain" sizes="90vw" unoptimized />
          {lightbox.mode === "gallery" && images.length > 1 ? (
            <>
              <button
                type="button"
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border bg-white/80 px-3 py-1 text-sm shadow-sm hover:bg-white dark:border-gray-700 dark:bg-gray-900/80"
                onClick={() =>
                  setActiveImageIndex((idx) => {
                    const next = Math.max(0, idx - 1);
                    setLightbox({
                      src: images[next].path || images[next].url,
                      alt: images[next].description || images[next].name,
                      index: next,
                      mode: "gallery",
                    });
                    return next;
                  })
                }
              >
                ←
              </button>
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border bg-white/80 px-3 py-1 text-sm shadow-sm hover:bg-white dark:border-gray-700 dark:bg-gray-900/80"
                onClick={() =>
                  setActiveImageIndex((idx) => {
                    const next = Math.min(images.length - 1, idx + 1);
                    setLightbox({
                      src: images[next].path || images[next].url,
                      alt: images[next].description || images[next].name,
                      index: next,
                      mode: "gallery",
                    });
                    return next;
                  })
                }
              >
                →
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="absolute right-3 top-3 rounded-full border bg-white/80 px-2 py-1 text-xs shadow-sm hover:bg-white dark:border-gray-700 dark:bg-gray-900/80"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            Close
          </button>
        </div>
        {lightbox.mode === "gallery" ? (
          activeImage?.description ? <p className="mt-2 text-sm text-white/80">{activeImage.description}</p> : null
        ) : lightbox.alt ? (
          <p className="mt-2 text-sm text-white/80">{lightbox.alt}</p>
        ) : null}
        {lightbox.mode === "gallery" && images.length > 1 ? (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {images.map((img, index) => (
              <button
                key={img.id}
                type="button"
                onClick={() => {
                  setActiveImageIndex(index);
                  setLightbox({
                    src: img.path || img.url,
                    alt: img.description || img.name,
                    index,
                    mode: "gallery",
                  });
                }}
                className={`relative h-16 w-28 shrink-0 overflow-hidden rounded-lg border ${
                  index === activeImageIndex ? "border-blue-400" : "border-white/10 hover:border-white/40"
                }`}
                title={img.description || img.name}
              >
                <Image src={img.path || img.url} alt={img.description || img.name} fill className="object-contain" sizes="112px" unoptimized />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
