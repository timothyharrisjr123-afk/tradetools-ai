"use client";

import {
  attentionHeadline,
  type JobAttentionSafeItem,
} from "@/app/lib/jobAttentionReadModel";
import {
  ChevronDown,
  CircleAlert,
  ExternalLink,
  Mail,
  Phone,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

type JobCardNextActionPanelProps = {
  items: JobAttentionSafeItem[];
  selectedItem: JobAttentionSafeItem | null;
  focusRequested: boolean;
  fallbackPhone?: string | null;
  fallbackEmail?: string | null;
  pendingAttentionId?: string | null;
  onSelect: (attentionId: string) => void;
  onMarkRead: (attentionId: string) => Promise<boolean>;
  onMarkSeen: (item: JobAttentionSafeItem) => Promise<void>;
  onDismiss: (item: JobAttentionSafeItem) => Promise<void>;
  onReviewProposal: (item: JobAttentionSafeItem) => void;
};

const PRIMARY_BUTTON =
  "inline-flex min-h-10 items-center justify-center rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60";
const SECONDARY_BUTTON =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60";

function relativeAge(iso: string): string {
  const elapsed = Math.max(0, Date.now() - Date.parse(iso));
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function normalizedContactHref(
  kind: "phone" | "email",
  value: string | null
): string | null {
  const normalized = (value ?? "").trim();
  if (!normalized) return null;
  return kind === "phone"
    ? `tel:${normalized.replace(/[^\d+*#,;]/g, "")}`
    : `mailto:${normalized}`;
}

async function settleReadWithoutBlocking(
  read: Promise<boolean>
): Promise<void> {
  await Promise.race([
    read.catch(() => false),
    new Promise<boolean>((resolve) => {
      window.setTimeout(() => resolve(false), 250);
    }),
  ]);
}

export default function JobCardNextActionPanel({
  items,
  selectedItem,
  focusRequested,
  fallbackPhone = null,
  fallbackEmail = null,
  pendingAttentionId = null,
  onSelect,
  onMarkRead,
  onMarkSeen,
  onDismiss,
  onReviewProposal,
}: JobCardNextActionPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const focusedAttentionRef = useRef<string | null>(null);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    if (
      !focusRequested ||
      !selectedItem ||
      focusedAttentionRef.current === selectedItem.id
    ) {
      return;
    }
    focusedAttentionRef.current = selectedItem.id;
    panelRef.current?.focus({ preventScroll: false });
    void onMarkRead(selectedItem.id).catch(() => false);
  }, [focusRequested, onMarkRead, selectedItem]);

  if (!selectedItem) return null;

  const phone =
    selectedItem.request.customerPhone?.trim() ||
    fallbackPhone?.trim() ||
    null;
  const email =
    selectedItem.request.customerEmail?.trim() ||
    fallbackEmail?.trim() ||
    null;
  const phoneHref = normalizedContactHref("phone", phone);
  const emailHref = normalizedContactHref("email", email);
  const others = items.filter((item) => item.id !== selectedItem.id);
  const pending = pendingAttentionId === selectedItem.id;

  const openContact = async (href: string) => {
    await settleReadWithoutBlocking(onMarkRead(selectedItem.id));
    window.location.href = href;
  };

  return (
    <section
      ref={panelRef}
      tabIndex={-1}
      aria-labelledby="job-card-next-action-heading"
      className="border-b border-amber-200/80 bg-amber-50/70 px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400 sm:px-6"
      data-jobcard-next-action
      data-attention-id={selectedItem.id}
      data-attention-status={selectedItem.status}
    >
      <div className="mx-auto flex max-w-[96rem] flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <CircleAlert
              className="h-4 w-4 shrink-0 text-amber-700"
              aria-hidden
            />
            <p
              id="job-card-next-action-heading"
              className="text-[11px] font-semibold uppercase tracking-[0.1em] text-amber-800"
            >
              Needs attention
            </p>
            <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
              {selectedItem.severity}
            </span>
            <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
              {selectedItem.status === "open" ? "New" : "Seen"}
            </span>
            <span className="text-[11px] text-slate-500">
              {relativeAge(selectedItem.openedAt)}
            </span>
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-950">
            {attentionHeadline(selectedItem)}
          </p>
          {selectedItem.request.messagePreview ? (
            <p
              className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-700"
              data-attention-message-preview
            >
              {selectedItem.request.messagePreview}
            </p>
          ) : null}
          <p className="mt-1 text-[11px] text-slate-500">
            Dismissal removes this active action. Request history is retained.
          </p>
        </div>

        <div
          className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end"
          aria-busy={pending}
        >
          {phoneHref ? (
            <button
              type="button"
              className={SECONDARY_BUTTON}
              onClick={() => {
                void openContact(phoneHref);
              }}
            >
              <Phone className="h-3.5 w-3.5" aria-hidden />
              Call customer
            </button>
          ) : null}
          {emailHref ? (
            <button
              type="button"
              className={SECONDARY_BUTTON}
              onClick={() => {
                void openContact(emailHref);
              }}
            >
              <Mail className="h-3.5 w-3.5" aria-hidden />
              Email customer
            </button>
          ) : null}
          <button
            type="button"
            className={SECONDARY_BUTTON}
            onClick={() => {
              void settleReadWithoutBlocking(onMarkRead(selectedItem.id))
                .then(() => onReviewProposal(selectedItem))
                .catch(() => undefined);
            }}
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            Review proposal
          </button>
          {selectedItem.status === "open" ? (
            <button
              type="button"
              className={PRIMARY_BUTTON}
              disabled={pending}
              onClick={() => {
                void settleReadWithoutBlocking(
                  onMarkRead(selectedItem.id)
                )
                  .then(() => onMarkSeen(selectedItem))
                  .catch(() => undefined);
              }}
            >
              Mark seen
            </button>
          ) : null}
          <button
            type="button"
            className={SECONDARY_BUTTON}
            disabled={pending}
            onClick={() => {
              void settleReadWithoutBlocking(
                onMarkRead(selectedItem.id)
                )
                  .then(() => onDismiss(selectedItem))
                  .catch(() => undefined);
            }}
          >
            Dismiss
          </button>
        </div>
      </div>

      {others.length > 0 ? (
        <div className="mx-auto mt-2 max-w-[96rem]">
          <button
            type="button"
            className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
            aria-expanded={showMore}
            onClick={() => setShowMore((value) => !value)}
          >
            View {others.length} more
            <ChevronDown
              className={`h-3.5 w-3.5 transition ${showMore ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
          {showMore ? (
            <div
              className="mt-1 grid gap-1 sm:grid-cols-2"
              data-jobcard-additional-attention
            >
              {others.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="min-w-0 rounded-md border border-amber-200/80 bg-white px-3 py-2 text-left hover:border-amber-300"
                  onClick={() => {
                    onSelect(item.id);
                    window.requestAnimationFrame(() => {
                      panelRef.current?.focus({ preventScroll: true });
                      void onMarkRead(item.id).catch(() => false);
                    });
                    setShowMore(false);
                  }}
                >
                  <span className="block truncate text-xs font-semibold text-slate-900">
                    {attentionHeadline(item)}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-slate-500">
                    {item.status === "open" ? "New" : "Seen"} ·{" "}
                    {relativeAge(item.openedAt)}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
