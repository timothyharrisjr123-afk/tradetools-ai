"use client";

import {
  BOARD_DRAG_THRESHOLD_PX,
  isBoardCardLifecycleActionTarget,
  pointerDeltaIsDrag,
} from "@/app/lib/boardGuardedMovement";
import { CalendarPlus, CheckCircle2, CircleAlert, MapPin, Play, UserCircle } from "lucide-react";
import { useEffect, useRef } from "react";
import type { JobsBoardCardModel } from "../jobsBoardUtils";

/**
 * Lifecycle actions read differently at a glance across many cards:
 * planning (cool outline), start now (dark), close out (quiet emerald).
 */
const BOARD_ACTION_BASE =
  "pointer-events-auto mt-2 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-60";
const BOARD_ACTION_PLAN = `${BOARD_ACTION_BASE} border border-blue-200 bg-white text-blue-700 hover:border-blue-300 hover:bg-blue-50/60`;
const BOARD_ACTION_START = `${BOARD_ACTION_BASE} border border-slate-900 bg-slate-900 text-white hover:bg-slate-800`;
const BOARD_ACTION_COMPLETE = `${BOARD_ACTION_BASE} border border-emerald-200 bg-emerald-50/70 text-emerald-800 hover:border-emerald-300 hover:bg-emerald-50`;
const BOARD_ACTION_ICON = "h-3.5 w-3.5 shrink-0";

type JobsBoardCardProps = {
  model: JobsBoardCardModel;
  onOpen: () => void;
  onScheduleJob?: () => void;
  onStartWork?: () => void;
  onCompleteJob?: () => void;
  onApproveJob?: () => void;
  dragEnabled?: boolean;
  isDragging?: boolean;
  onBoardDragStart?: () => void;
  onBoardDragMove?: (clientX: number, clientY: number) => void;
  onBoardDragEnd?: (clientX: number, clientY: number) => void;
  onBoardDragCancel?: () => void;
  /** Muted styling for legacy estimate cards. */
  subdued?: boolean;
};

const ICON_CLASS = "h-4 w-4 shrink-0 text-slate-400/90";
const ICON_STROKE = 1.75;

function formatTimeInStageFooter(label: string | null): string | null {
  if (!label) return null;
  if (label === "• Just entered" || label === "• New") return "Just entered stage";
  if (label.includes("in stage")) return label;
  return `${label} in stage`;
}

function assigneeDisplay(label: string | null | undefined): string | null {
  const trimmed = label?.trim();
  return trimmed ? trimmed : null;
}

export default function JobsBoardCard({
  model,
  onOpen,
  onScheduleJob,
  onStartWork,
  onCompleteJob,
  onApproveJob,
  dragEnabled = false,
  isDragging = false,
  onBoardDragStart,
  onBoardDragMove,
  onBoardDragEnd,
  onBoardDragCancel,
  subdued = false,
}: JobsBoardCardProps) {
  const stageFooter = formatTimeInStageFooter(model.timeInStage);
  const assignee = assigneeDisplay(model.assigneeLabel);
  const pointerRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    dragging: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const dragListenersRef = useRef<{
    move: (event: PointerEvent) => void;
    up: (event: PointerEvent) => void;
  } | null>(null);

  useEffect(() => {
    return () => {
      const listeners = dragListenersRef.current;
      if (!listeners) return;
      window.removeEventListener("pointermove", listeners.move);
      window.removeEventListener("pointerup", listeners.up);
      window.removeEventListener("pointercancel", listeners.up);
    };
  }, []);

  function detachDragListeners() {
    const listeners = dragListenersRef.current;
    if (!listeners) return;
    window.removeEventListener("pointermove", listeners.move);
    window.removeEventListener("pointerup", listeners.up);
    window.removeEventListener("pointercancel", listeners.up);
    dragListenersRef.current = null;
  }

  return (
    <article
      className={
        "relative flex w-full flex-col rounded-lg border bg-white transition " +
        (isDragging ? "opacity-40 " : "") +
        (subdued
          ? "border-slate-200/70 shadow-none hover:border-slate-300/80 hover:bg-slate-50/40"
          : "border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.06)] hover:border-slate-300/90 hover:shadow-[0_2px_6px_rgba(15,23,42,0.07)]")
      }
      data-board-card-dragging={isDragging ? "true" : undefined}
    >
      <button
        type="button"
        className={
          "absolute inset-0 z-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/50 " +
          (dragEnabled ? "cursor-grab active:cursor-grabbing" : "")
        }
        aria-label={`Open job card for ${model.customerName}`}
        aria-grabbed={isDragging ? true : undefined}
        data-board-open-job
        onPointerDown={(event) => {
          if (!dragEnabled || event.button !== 0 || event.pointerType !== "mouse") {
            return;
          }
          if (isBoardCardLifecycleActionTarget(event.target)) return;
          detachDragListeners();
          pointerRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            dragging: false,
          };
          const move = (moveEvent: PointerEvent) => {
            const pointer = pointerRef.current;
            if (!pointer || pointer.pointerId !== moveEvent.pointerId) return;
            if (!pointer.dragging) {
              if (
                !pointerDeltaIsDrag(
                  moveEvent.clientX - pointer.startX,
                  moveEvent.clientY - pointer.startY,
                  BOARD_DRAG_THRESHOLD_PX
                )
              ) {
                return;
              }
              pointer.dragging = true;
              suppressClickRef.current = true;
              onBoardDragStart?.();
            }
            onBoardDragMove?.(moveEvent.clientX, moveEvent.clientY);
          };
          const up = (upEvent: PointerEvent) => {
            const pointer = pointerRef.current;
            pointerRef.current = null;
            detachDragListeners();
            if (pointer?.dragging) {
              if (upEvent.type === "pointercancel") onBoardDragCancel?.();
              else onBoardDragEnd?.(upEvent.clientX, upEvent.clientY);
            }
          };
          dragListenersRef.current = { move, up };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up);
          window.addEventListener("pointercancel", up);
        }}
        onClick={(event) => {
          if (suppressClickRef.current) {
            event.preventDefault();
            event.stopPropagation();
            suppressClickRef.current = false;
            return;
          }
          onOpen();
        }}
      />
      <div className="relative z-10 flex flex-1 flex-col pointer-events-none">
      <div className="shrink-0 px-4 pb-3 pt-3.5">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <h3
            className={
              "min-w-0 flex-1 truncate text-sm font-semibold leading-snug " +
              (subdued ? "text-slate-700" : "text-slate-900")
            }
          >
            {model.customerName}
          </h3>
          {model.sourceBadge ? (
            <span className="shrink-0 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
              {model.sourceBadge}
            </span>
          ) : null}
        </div>
        <div className="mt-1.5 flex min-w-0 items-start gap-2">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400/90" strokeWidth={ICON_STROKE} aria-hidden />
          {model.address ? (
            <p className="min-w-0 line-clamp-2 text-xs leading-relaxed text-slate-500">{model.address}</p>
          ) : (
            <p className="text-xs text-slate-400">No address on file</p>
          )}
        </div>
        {model.dispositionLabel ? (
          <p
            className="mt-1 text-[11px] font-medium text-slate-600"
            data-board-disposition={model.dispositionLabel}
          >
            {model.dispositionLabel}
          </p>
        ) : null}
        {model.attention ? (
          <div
            className={
              model.showApproveAction
                ? "mt-1.5 flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-slate-700"
                : "mt-1.5 flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-amber-800"
            }
            aria-label={model.attention.accessibleLabel}
            data-jobs-board-attention
            data-attention-count={model.attention.activeCount}
            data-attention-treatment={
              model.showApproveAction ? "normal" : "warning"
            }
          >
            {model.showApproveAction ? null : (
              <CircleAlert
                className="h-3.5 w-3.5 shrink-0"
                strokeWidth={ICON_STROKE}
                aria-hidden
              />
            )}
            <span className="truncate">{model.attention.label}</span>
            {model.attention.activeCount > 1 ? (
              <span
                className={
                  model.showApproveAction
                    ? "shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 tabular-nums text-slate-600"
                    : "shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 tabular-nums"
                }
              >
                {model.attention.activeCount}
              </span>
            ) : null}
          </div>
        ) : null}
        
        {model.scheduleLabel ? (
          <p className="mt-1.5 text-xs font-medium text-slate-600" data-board-schedule-meta>
            {model.scheduleLabel}
          </p>
        ) : null}
        {model.scheduleIntegrityLabel ? (
          <p
            className="mt-1.5 text-xs font-semibold text-amber-800"
            data-board-schedule-integrity
          >
            {model.scheduleIntegrityLabel}
          </p>
        ) : null}
        {model.productionStartedLabel ? (
          <p
            className="mt-1.5 text-xs font-semibold text-slate-700"
            data-board-production-started
          >
            Work started · {model.productionStartedLabel}
          </p>
        ) : null}
        {model.completedAtLabel ? (
          <p
            className="mt-1.5 text-xs font-semibold text-slate-800"
            data-board-work-completed
          >
            Completed · {model.completedAtLabel}
          </p>
        ) : null}
        {model.showApproveAction && onApproveJob ? (
          <button
            type="button"
            disabled={model.approveBusy}
            className="pointer-events-auto mt-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/70 disabled:opacity-60"
            onClick={(event) => {
              event.stopPropagation();
              onApproveJob();
            }}
            data-board-approve-job
          >
            {model.approveBusy ? "Approving…" : "Approve"}
          </button>
        ) : null}
        {model.showScheduleAction && onScheduleJob ? (
          <button
            type="button"
            className={BOARD_ACTION_PLAN}
            data-board-schedule-job
            onClick={(event) => {
              event.stopPropagation();
              onScheduleJob();
            }}
          >
            <CalendarPlus className={BOARD_ACTION_ICON} strokeWidth={ICON_STROKE} aria-hidden />
            Schedule job
          </button>
        ) : null}
        {model.showStartWorkAction && onStartWork ? (
          <button
            type="button"
            disabled={model.startWorkBusy}
            className={BOARD_ACTION_START}
            onClick={(event) => {
              event.stopPropagation();
              onStartWork();
            }}
            data-board-start-work
          >
            <Play className={BOARD_ACTION_ICON} strokeWidth={ICON_STROKE} aria-hidden />
            {model.startWorkBusy ? "Starting…" : "Start work"}
          </button>
        ) : null}
        {model.showCompleteJobAction && onCompleteJob ? (
          <button
            type="button"
            disabled={model.completeJobBusy}
            className={BOARD_ACTION_COMPLETE}
            onClick={(event) => {
              event.stopPropagation();
              onCompleteJob();
            }}
            data-board-complete-job
          >
            <CheckCircle2 className={BOARD_ACTION_ICON} strokeWidth={ICON_STROKE} aria-hidden />
            {model.completeJobBusy ? "Completing…" : "Complete job"}
          </button>
        ) : null}
      </div>

      <footer className="mt-auto space-y-1 border-t border-slate-100 px-4 py-2.5 text-[13px] leading-snug">
        {assignee ? (
          <div
            className="flex min-w-0 items-center gap-2 text-slate-600"
            data-board-card-owner
          >
            <UserCircle className={ICON_CLASS} strokeWidth={ICON_STROKE} aria-hidden />
            <span className="truncate">
              <span className="text-slate-400">Production lead · </span>
              {assignee}
            </span>
          </div>
        ) : null}
        <p
          className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-[12px] text-slate-400"
          data-board-card-meta
        >
          <span className="truncate">{model.proposalStatus.label}</span>
          {model.tasksLabel ? (
            <>
              <span aria-hidden>·</span>
              <span className="truncate">Tasks {model.tasksLabel}</span>
            </>
          ) : null}
          {stageFooter ? (
            <>
              <span aria-hidden>·</span>
              <span className="truncate" data-board-card-age>
                {stageFooter}
              </span>
            </>
          ) : null}
        </p>
      </footer>
      </div>
    </article>
  );
}
