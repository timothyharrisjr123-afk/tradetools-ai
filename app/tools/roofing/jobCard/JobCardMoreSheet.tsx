"use client";

import { useEffect, useId, useRef } from "react";
import {
  JOB_CARD_MORE_DESTINATIONS,
  type JobCardMoreDestinationId,
} from "./jobCardMobileNav";

type JobCardMoreSheetProps = {
  open: boolean;
  activeDestination: JobCardMoreDestinationId | null;
  onClose: () => void;
  onSelect: (destination: JobCardMoreDestinationId) => void;
};

export default function JobCardMoreSheet({
  open,
  activeDestination,
  onClose,
  onSelect,
}: JobCardMoreSheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const first = panelRef.current?.querySelector<HTMLElement>(
      "[data-jobcard-more-destination]"
    );
    first?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] min-[1200px]:hidden"
      data-jobcard-more-sheet
      role="presentation"
    >
      <button
        type="button"
        aria-label="Close more destinations"
        className="absolute inset-0 bg-slate-900/35"
        data-jobcard-more-backdrop
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-jobcard-more-panel
        className="absolute inset-x-0 bottom-0 max-h-[min(78vh,32rem)] overflow-y-auto rounded-t-2xl border border-slate-200/90 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_30px_rgba(15,23,42,0.12)]"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" aria-hidden />
        <h2
          id={titleId}
          className="px-1 text-sm font-semibold text-slate-900"
        >
          More
        </h2>
        <p className="mt-0.5 px-1 text-xs text-slate-500">
          Calendar, measurements, proposals, payments, and activity
        </p>
        <ul className="mt-3 space-y-1 pb-2" role="list">
          {JOB_CARD_MORE_DESTINATIONS.map((destination) => {
            const isActive = activeDestination === destination.id;
            return (
              <li key={destination.id}>
                <button
                  type="button"
                  data-jobcard-more-destination={destination.id}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => onSelect(destination.id)}
                  className={`flex min-h-12 w-full items-center justify-between rounded-lg px-3 text-left text-[15px] font-medium transition ${
                    isActive
                      ? "bg-slate-900 text-white"
                      : "text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  <span>{destination.label}</span>
                  {isActive ? (
                    <span className="text-xs font-medium text-white/80">
                      Current
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
