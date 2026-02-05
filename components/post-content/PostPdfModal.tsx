import { Suspense } from "react";
import dynamic from "next/dynamic";
import type { PdfPageInfo, PdfViewerState } from "./types";

const LazyPdfViewer = dynamic(() => import("../archive/PdfViewer").then((mod) => ({ default: mod.PdfViewer })), {
  ssr: false,
});

type Props = {
  pdfViewer: PdfViewerState;
  pdfPageInfo: PdfPageInfo;
  onClose: () => void;
  onPageChange: (page: number, total: number) => void;
};

export function PostPdfModal({ pdfViewer, pdfPageInfo, onClose, onPageChange }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-1 sm:p-2" onClick={onClose}>
      <div
        className="relative flex h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-gray-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3 dark:border-gray-800">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100" title={pdfViewer.title || undefined}>
              {pdfViewer.title || "PDF Attachment"}
            </p>
            {pdfPageInfo.total ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Page {pdfPageInfo.page} / {pdfPageInfo.total}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 gap-2">
            <a
              href={pdfViewer.src}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border bg-white/80 px-3 py-1 text-sm shadow-sm hover:bg-white dark:border-gray-700 dark:bg-gray-900/80"
            >
              Download
            </a>
            <button
              type="button"
              className="rounded-full border bg-white/80 px-3 py-1 text-sm font-semibold shadow-sm hover:bg-white dark:border-gray-700 dark:bg-gray-900/80"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden bg-gray-50 dark:bg-gray-900">
          <Suspense
            fallback={<div className="flex h-full items-center justify-center text-sm text-gray-700 dark:text-gray-200">Loading PDF viewer…</div>}
          >
            <LazyPdfViewer key={pdfViewer.src} src={pdfViewer.src} onPageChange={onPageChange} />
          </Suspense>
        </div>
        {pdfViewer.description ? (
          <div className="border-t px-4 py-3 text-sm text-gray-700 dark:border-gray-800 dark:text-gray-300">
            {pdfViewer.description}
          </div>
        ) : null}
      </div>
    </div>
  );
}
