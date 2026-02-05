import Image from "next/image";
import { useRef } from "react";
import type { Image as ArchiveImage } from "@/lib/types";
import type { LightboxState } from "./types";
import { preload } from "react-dom";

const DEFAULT_ASPECT = "16/9";

type Props = {
  preloadImage?: boolean;
  images: Array<ArchiveImage & { path?: string }>;
  activeImageIndex: number;
  setActiveImageIndex: React.Dispatch<React.SetStateAction<number>>;
  setLightbox: (lightbox: LightboxState) => void;
  imageAspect?: string;
};

export function PostGallery({
  preloadImage,
  images,
  activeImageIndex,
  setActiveImageIndex,
  setLightbox,
  imageAspect = DEFAULT_ASPECT,
}: Props) {
  const activeImage = images[activeImageIndex] || null;
  const dragStartRef = useRef<number | null>(null);
  const didDragRef = useRef(false);

  if (!images.length) return null;

  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative w-full overflow-hidden rounded-xl bg-black/5 dark:bg-white/5"
        style={{ aspectRatio: imageAspect, maxHeight: "70vh" }}
        onPointerDown={(e) => {
          dragStartRef.current = e.clientX;
          didDragRef.current = false;
        }}
        onPointerUp={(e) => {
          if (dragStartRef.current === null) return;
          const delta = e.clientX - dragStartRef.current;
          dragStartRef.current = null;
          if (Math.abs(delta) < 40) return;
          didDragRef.current = true;
          setActiveImageIndex((idx) => {
            if (delta < 0) return Math.min(images.length - 1, idx + 1);
            return Math.max(0, idx - 1);
          });
        }}
        onClick={() => {
          if (!activeImage || didDragRef.current) return;
          setLightbox({
            src: activeImage.path || activeImage.url,
            alt: activeImage.description || activeImage.name,
            index: activeImageIndex,
            mode: "gallery",
          });
        }}
      >
        {activeImage ? (
          <Image
            src={activeImage.path || activeImage.url}
            alt={activeImage.description || activeImage.name}
            fill
            className="object-contain"
            sizes="100vw"
            unoptimized
            preload={preloadImage}
            fetchPriority={preloadImage ? "high" : "auto"}
          />
        ) : null}
        {images.length > 1 ? (
          <>
            <button
              type="button"
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border bg-white/80 px-3 py-1 text-sm shadow-sm hover:bg-white dark:border-gray-700 dark:bg-gray-900/80"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setActiveImageIndex((idx) => Math.max(0, idx - 1));
              }}
            >
              ←
            </button>
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border bg-white/80 px-3 py-1 text-sm shadow-sm hover:bg-white dark:border-gray-700 dark:bg-gray-900/80"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setActiveImageIndex((idx) => Math.min(images.length - 1, idx + 1));
              }}
            >
              →
            </button>
            <div className="absolute bottom-2 right-3 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
              {activeImageIndex + 1} / {images.length}
            </div>
          </>
        ) : null}
        <button
          type="button"
          className="absolute right-3 top-3 rounded-full border bg-white/80 px-2 py-1 text-xs shadow-sm hover:bg-white dark:border-gray-700 dark:bg-gray-900/80"
          onClick={() => {
            if (!activeImage) return;
            setLightbox({
              src: activeImage.path || activeImage.url,
              alt: activeImage.description || activeImage.name,
              index: activeImageIndex,
              mode: "gallery",
            });
          }}
        >
          View
        </button>
      </div>
      {activeImage?.description ? (
        <p className="text-sm text-gray-600 dark:text-gray-300">{activeImage.description}</p>
      ) : null}
      {images.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, index) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActiveImageIndex(index)}
              className={`relative h-16 w-28 shrink-0 overflow-hidden rounded-lg border ${
                index === activeImageIndex
                  ? "border-blue-500 dark:border-blue-400"
                  : "border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500"
              }`}
              title={img.description || img.name}
            >
              <Image
                src={img.path || img.url}
                alt={img.description || img.name}
                fill
                className="object-contain"
                sizes="112px"
                unoptimized
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
