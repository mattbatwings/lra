'use client';

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AttachmentContext, EmbedAttachment, EmbedPost } from "@/lib/embed/protocol";
import { useEmbed } from "./EmbedProvider";

export function AttachmentAction({ id, label, post, attachment, context }: {
  id: string; label: string; post: EmbedPost; attachment: EmbedAttachment; context: AttachmentContext;
}) {
  const { performAction } = useEmbed();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const statusId = useId();
  const tooltipId = `${statusId}-tooltip`;
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number; width: number } | null>(null);
  const [state, setState] = useState<{ status: "pending" | "success" | "failure"; message: string } | null>(null);
  // YouTube attachments have no file; parents receive sourceUrl instead.
  const unavailable = !attachment.canDownload && attachment.kind !== "youtube";
  const message = unavailable ? "Direct file unavailable." : state?.message;
  const tooltipOpen = !!message && (hovered || focused);
  const updatePosition = useCallback(() => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(256, window.innerWidth - 16);
    setPosition({
      left: Math.max(8, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 8)),
      top: rect.top - 8,
      width,
    });
  }, []);

  useEffect(() => {
    if (!tooltipOpen) return;
    const frame = requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [tooltipOpen, updatePosition]);

  return (
    <div
      ref={wrapperRef}
      className="inline-flex max-w-full items-center"
      onMouseEnter={() => { updatePosition(); setHovered(true); }}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => { updatePosition(); setFocused(true); }}
      onBlurCapture={() => setFocused(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape") { setHovered(false); setFocused(false); }
      }}
    >
      <button
        type="button"
        aria-describedby={message ? (tooltipOpen && position ? tooltipId : statusId) : undefined}
        disabled={unavailable || state?.status === "pending"}
        className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-gray-800"
        onClick={async () => {
          setState({ status: "pending", message: "Working…" });
          const result = await performAction({ actionId: id, post, attachment, context }, (message) => setState({ status: "pending", message }));
          setState(result);
        }}
      >
        {label}
      </button>
      <span id={statusId} role="status" aria-live="polite" className="sr-only">
        {message}
      </span>
      {tooltipOpen && position ? createPortal(
        <span
          id={tooltipId}
          role="tooltip"
          className={`pointer-events-none fixed z-60 -translate-y-full rounded-lg border px-3 py-2 text-xs wrap-break-word shadow-lg ${state?.status === "failure" ? "border-red-700 bg-red-950 text-red-100" : "border-gray-700 bg-gray-900 text-white"}`}
          style={position}
        >
          {message}
        </span>,
        document.body,
      ) : null}
    </div>
  );
}
