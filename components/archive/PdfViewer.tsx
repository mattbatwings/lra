'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

export function PdfViewer({ src, onPageChange }: { src: string; onPageChange?(page: number, total: number): void }) {
  const [numPages, setNumPages] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>();
  const [currentPage, setCurrentPage] = useState(1);
  const currentPageRef = useRef(1);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const updateWidth = () => {
      if (!containerRef.current) return;
      setWidth(containerRef.current.clientWidth);
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  const updatePageFromScroll = useCallback(() => {
    if (!containerRef.current || !numPages) return;
    const viewport = containerRef.current.getBoundingClientRect();
    const viewportTop = viewport.top;
    const viewportBottom = viewport.bottom;
    let bestPage = currentPageRef.current;
    let bestRatio = 0;
    pageRefs.current.forEach((el, idx) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const visible = Math.min(rect.bottom, viewportBottom) - Math.max(rect.top, viewportTop);
      if (visible <= 0) return;
      const ratio = Math.min(1, visible / rect.height);
      if (ratio > bestRatio) {
        bestRatio = ratio;
        bestPage = idx + 1;
      }
    });
    if (bestPage !== currentPageRef.current) {
      currentPageRef.current = bestPage;
      setCurrentPage(bestPage);
    }
  }, [numPages]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handle = () => updatePageFromScroll();
    el.addEventListener("scroll", handle);
    window.addEventListener("resize", handle);
    handle();
    return () => {
      el.removeEventListener("scroll", handle);
      window.removeEventListener("resize", handle);
    };
  }, [updatePageFromScroll]);

  useEffect(() => {
    if (!numPages) return;
    updatePageFromScroll();
  }, [numPages, updatePageFromScroll]);

  useEffect(() => {
    if (!onPageChange) return;
    onPageChange(currentPage, numPages);
  }, [currentPage, numPages, onPageChange]);

  return (
    <div ref={containerRef} className="h-full overflow-auto bg-white dark:bg-gray-950">
      <Document
        file={src}
        onLoadSuccess={({ numPages }) => {
          setNumPages(numPages);
          setError(null);
          currentPageRef.current = 1;
          setCurrentPage(1);
        }}
        onLoadError={(err) => setError(err?.message || "Failed to load PDF")}
        loading={<div className="flex h-full items-center justify-center text-sm text-gray-600 dark:text-gray-300">Loading PDF…</div>}
      >
        {Array.from({ length: numPages }, (_, idx) => {
          const targetWidth = width ? Math.min(width - 32, 1200) : undefined;
          return (
            <div key={idx} className="relative flex justify-center px-4 py-5">
              <div
                ref={(el) => {
                  pageRefs.current[idx] = el;
                }}
                data-page={idx + 1}
                className="relative w-full max-w-5xl overflow-hidden rounded-sm bg-white ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800"
              >
                <Page pageNumber={idx + 1} width={targetWidth} />
              </div>
            </div>
          );
        })}
      </Document>
      {error ? <div className="p-3 text-sm text-red-600">{error}</div> : null}
    </div>
  );
}

export default PdfViewer;
