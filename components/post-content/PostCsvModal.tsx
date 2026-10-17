'use client';

import { Suspense, useEffect } from "react";
import dynamic from "next/dynamic";
import type { CsvViewerState } from "./types";

const LazyCsvViewer = dynamic(() => import("../archive/CsvViewer").then((mod) => ({ default: mod.CsvViewer })), {
  ssr: false,
});

type Props = {
  csvViewer: CsvViewerState;
  onClose: () => void;
};

export function PostCsvModal({ csvViewer, onClose }: Props) {
  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-gray-950" onClick={onClose}>
      <div
        className="relative flex h-dvh w-screen flex-col overflow-hidden bg-white dark:bg-gray-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex min-h-12 items-center justify-between gap-3 border-b px-4 py-2 dark:border-gray-800">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100" title={csvViewer.title || undefined}>
              {csvViewer.title || "Spreadsheet Attachment"}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <a
              href={csvViewer.src}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border bg-white px-3 py-1 text-sm shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
            >
              Download
            </a>
            <button
              type="button"
              className="rounded-full border bg-white px-3 py-1 text-sm font-semibold shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden bg-gray-50 dark:bg-gray-900">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-sm text-gray-700 dark:text-gray-200">
                Loading spreadsheet viewer…
              </div>
            }
          >
            <LazyCsvViewer key={csvViewer.src} src={csvViewer.src} title={csvViewer.title} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
