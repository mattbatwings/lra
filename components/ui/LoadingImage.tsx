'use client';

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

type LoadingImageProps = ImageProps & {
  spinnerLabel?: string;
};

export function LoadingImage({
  alt,
  className,
  onLoad,
  onError,
  spinnerLabel = "Loading image",
  src,
  ...props
}: LoadingImageProps) {
  const srcKey = typeof src === "string" ? src : "src" in src ? src.src : String(src);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const loaded = loadedSrc === srcKey;

  return (
    <>
      {!loaded ? (
        <div
          className="loading-image-spinner pointer-events-none absolute inset-0 z-10 flex items-center justify-center opacity-0"
          role="status"
          aria-label={spinnerLabel}
        >
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700 dark:border-gray-700 dark:border-t-gray-100" />
        </div>
      ) : null}
      <Image
        {...props}
        src={src}
        alt={alt}
        className={className}
        onLoad={(event) => {
          setLoadedSrc(srcKey);
          onLoad?.(event);
        }}
        onError={(event) => {
          setLoadedSrc(srcKey);
          onError?.(event);
        }}
      />
    </>
  );
}
