"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { JobCardManualMeasurementFields } from "@/app/lib/jobCardManualMeasurementDraft";
import {
  JOB_CARD_ADD_MEASUREMENT_LABEL,
  JOB_CARD_CURRENT_MEASUREMENT_LABEL,
  JOB_CARD_DETAILS_LABEL,
  JOB_CARD_EARLIER_MEASUREMENTS_LABEL,
  JOB_CARD_EDIT_MEASUREMENT_LABEL,
  JOB_CARD_MAKE_CURRENT_CONFIRM_BODY,
  JOB_CARD_MAKE_CURRENT_CONFIRM_SET,
  JOB_CARD_MAKE_CURRENT_CONFIRM_TITLE,
  JOB_CARD_MAKE_CURRENT_LABEL,
  JOB_CARD_MEASUREMENTS_EMPTY,
  JOB_CARD_REVIEW_PROPOSAL_LABEL,
  buildMeasurementHistoryRows,
  buildMeasurementReportSummary,
  formatMakeCurrentConfirmIdentity,
  wouldMakeDraftProposalStale,
  type MeasurementDetailGroup,
  type MeasurementProposalBinding,
  type MeasurementProposalRef,
} from "@/app/lib/jobCardMeasurementReportModel";
import type { MeasurementRecord } from "@/app/lib/measurementTypes";
import JobCardMeasurementCapture from "@/app/tools/roofing/jobCard/JobCardMeasurementCapture";

type JobCardMeasurementsWorkspaceProps = {
  records: readonly MeasurementRecord[];
  selectedId: string | null;
  loading?: boolean;
  capturing?: boolean;
  captureInitial?: Partial<JobCardManualMeasurementFields> | null;
  captureTitle?: string;
  saving?: boolean;
  saveError?: string | null;
  selectBusy?: boolean;
  binding?: MeasurementProposalBinding | null;
  draftProposal?: MeasurementProposalRef | null;
  onAddMeasurement: () => void;
  onEditMeasurement?: () => void;
  onCancelCapture?: () => void;
  onSaveMeasurement: (fields: JobCardManualMeasurementFields) => void;
  onMakeCurrent: (measurementId: string) => void;
  onReviewProposal?: (href: string) => void;
  /** Visual-review / test seed only. Does not persist selection. */
  initialDetailsOpen?: boolean;
  initialViewingId?: string | null;
  initialPendingCurrentId?: string | null;
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 text-base font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}

function DetailGroups({ groups }: { groups: readonly MeasurementDetailGroup[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2" data-jobcard-measurement-detail-groups>
      {groups.map((group) => (
        <section key={group.id} data-jobcard-measurement-detail-group={group.id}>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {group.title}
          </h4>
          <dl className="mt-1.5 space-y-1">
            {group.items.map((item) => (
              <div
                key={`${group.id}-${item.label}`}
                className="flex items-baseline justify-between gap-3 text-sm"
              >
                <dt className="text-slate-500">{item.label}</dt>
                <dd className="tabular-nums font-medium text-slate-800">{item.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

export default function JobCardMeasurementsWorkspace({
  records,
  selectedId,
  loading = false,
  capturing = false,
  captureInitial = null,
  captureTitle,
  saving = false,
  saveError = null,
  selectBusy = false,
  binding = null,
  draftProposal = null,
  onAddMeasurement,
  onEditMeasurement,
  onCancelCapture,
  onSaveMeasurement,
  onMakeCurrent,
  onReviewProposal,
  initialDetailsOpen = false,
  initialViewingId = null,
  initialPendingCurrentId = null,
}: JobCardMeasurementsWorkspaceProps) {
  const current = useMemo(
    () => records.find((row) => row.id === selectedId) ?? null,
    [records, selectedId]
  );
  const summary = current ? buildMeasurementReportSummary(current) : null;
  const earlier = useMemo(
    () => buildMeasurementHistoryRows({ records, currentId: selectedId }),
    [records, selectedId]
  );
  const [detailsOpen, setDetailsOpen] = useState(initialDetailsOpen);
  const [viewingId, setViewingId] = useState<string | null>(initialViewingId);
  const [pendingCurrentId, setPendingCurrentId] = useState<string | null>(
    initialPendingCurrentId
  );

  const requestMakeCurrent = (measurementId: string) => {
    const record = records.find((row) => row.id === measurementId);
    if (!record) return;
    const row = earlier.find((item) => item.id === measurementId);
    if (!row?.canMakeCurrent) return;
    if (wouldMakeDraftProposalStale({ draft: draftProposal, candidate: record })) {
      setViewingId(measurementId);
      setPendingCurrentId(measurementId);
      return;
    }
    onMakeCurrent(measurementId);
  };

  const confirmMakeCurrent = () => {
    if (!pendingCurrentId) return;
    const id = pendingCurrentId;
    setPendingCurrentId(null);
    onMakeCurrent(id);
  };

  const metaParts = summary
    ? [summary.storiesLabel, summary.sourceLabel, summary.dateLabel].filter(Boolean)
    : [];

  return (
    <div className="space-y-5" data-jobcard-measurements-workspace="true">
      {summary ? (
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {JOB_CARD_CURRENT_MEASUREMENT_LABEL}
          </p>
          {!capturing ? (
            <div className="flex shrink-0 items-center gap-2">
              {summary.canEdit && onEditMeasurement ? (
                <button
                  type="button"
                  className="inline-flex min-h-[44px] items-center rounded-md px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={onEditMeasurement}
                  data-jobcard-edit-measurement="true"
                >
                  {JOB_CARD_EDIT_MEASUREMENT_LABEL}
                </button>
              ) : null}
              <button
                type="button"
                className="inline-flex min-h-[44px] shrink-0 items-center rounded-md bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800"
                onClick={onAddMeasurement}
                data-jobcard-add-measurement="true"
              >
                {JOB_CARD_ADD_MEASUREMENT_LABEL}
              </button>
            </div>
          ) : null}
        </div>
      ) : !capturing ? (
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-slate-600" data-jobcard-measurements-empty>
            {JOB_CARD_MEASUREMENTS_EMPTY}
          </p>
          <button
            type="button"
            className="inline-flex min-h-[44px] shrink-0 items-center rounded-md bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800"
            onClick={onAddMeasurement}
            data-jobcard-add-measurement="true"
          >
            {JOB_CARD_ADD_MEASUREMENT_LABEL}
          </button>
        </div>
      ) : null}

      {summary ? (
        <div className="space-y-3" data-jobcard-measurement-current="true">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {summary.name}
              <span className="ml-2 text-xs font-medium text-slate-500">
                {summary.statusLabel}
              </span>
            </p>
          </div>
          <div
            className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4"
            data-jobcard-measurement-metrics
          >
            {summary.areaLabel ? <Metric label="Area" value={summary.areaLabel} /> : null}
            {summary.squaresLabel ? (
              <Metric label="Squares" value={summary.squaresLabel} />
            ) : null}
            {summary.wasteLabel ? <Metric label="Waste" value={summary.wasteLabel} /> : null}
            {summary.pitchLabel ? <Metric label="Pitch" value={summary.pitchLabel} /> : null}
          </div>
          {metaParts.length > 0 ? (
            <p className="text-xs text-slate-500" data-jobcard-measurement-meta>
              {metaParts.join(" · ")}
            </p>
          ) : null}
          {binding?.kind !== "none" && binding?.message ? (
            <div
              className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600"
              data-jobcard-measurement-binding={binding.kind}
            >
              <span>{binding.message}</span>
              {binding.kind === "draft_earlier" && binding.reviewHref && onReviewProposal ? (
                <button
                  type="button"
                  className="min-h-[44px] font-semibold text-slate-900 underline-offset-2 hover:underline"
                  onClick={() => onReviewProposal(binding.reviewHref!)}
                  data-jobcard-measurement-review-proposal="true"
                >
                  {JOB_CARD_REVIEW_PROPOSAL_LABEL}
                </button>
              ) : null}
            </div>
          ) : null}
          {summary.detailGroups.length > 0 ? (
            <div>
              <button
                type="button"
                className="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-slate-800"
                onClick={() => setDetailsOpen((open) => !open)}
                aria-expanded={detailsOpen}
                data-jobcard-measurement-details-toggle={detailsOpen ? "open" : "closed"}
              >
                {JOB_CARD_DETAILS_LABEL}
                <ChevronDown
                  className={`h-4 w-4 text-slate-500 transition ${detailsOpen ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
              {detailsOpen ? (
                <div className="mt-2" data-jobcard-measurement-details="true">
                  <DetailGroups groups={summary.detailGroups} />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {capturing ? (
        <div
          className="max-w-xl rounded-lg border border-slate-200 bg-white p-4"
          data-jobcard-measurement-capture-panel="true"
        >
          <JobCardMeasurementCapture
            initial={captureInitial}
            saving={saving}
            error={saveError}
            onCancel={onCancelCapture}
            onSave={onSaveMeasurement}
            title={captureTitle ?? (captureInitial ? "Edit measurement" : "Add measurement")}
          />
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading measurements</p>
      ) : earlier.length > 0 ? (
        <div data-jobcard-measurement-history="true">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {JOB_CARD_EARLIER_MEASUREMENTS_LABEL}
          </h3>
          <ul className="mt-2 divide-y divide-slate-100 border-t border-slate-100">
            {earlier.map((item) => {
              const expanded = viewingId === item.id;
              const confirming = pendingCurrentId === item.id;
              return (
                <li key={item.id} className="py-2.5">
                  <button
                    type="button"
                    className="flex w-full min-h-[44px] items-start justify-between gap-3 text-left"
                    onClick={() => {
                      setViewingId((prev) => (prev === item.id ? null : item.id));
                      if (pendingCurrentId && pendingCurrentId !== item.id) {
                        setPendingCurrentId(null);
                      }
                    }}
                    data-jobcard-measurement-option="other"
                    data-jobcard-measurement-history-row={item.id}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-900">
                        {item.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {item.quantityLine}
                        {item.dateLabel
                          ? ` · ${item.sourceLabel} · ${item.dateLabel}`
                          : ` · ${item.sourceLabel}`}
                        {` · ${item.statusLabel}`}
                      </span>
                    </span>
                  </button>
                  {expanded ? (
                    <div
                      className="mt-2 space-y-3 pl-0 sm:pl-1"
                      data-jobcard-measurement-history-view={item.id}
                    >
                      {item.detailGroups.length > 0 ? (
                        <DetailGroups groups={item.detailGroups} />
                      ) : null}
                      {confirming ? (
                        <div
                          className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5"
                          data-jobcard-make-current-confirm="true"
                          data-jobcard-make-current-confirm-for={item.id}
                          role="alertdialog"
                          aria-labelledby={`jobcard-make-current-title-${item.id}`}
                        >
                          <p
                            id={`jobcard-make-current-title-${item.id}`}
                            className="text-sm font-semibold text-slate-900"
                          >
                            {JOB_CARD_MAKE_CURRENT_CONFIRM_TITLE}
                          </p>
                          <p
                            className="mt-1 text-xs text-slate-600"
                            data-jobcard-make-current-confirm-identity
                          >
                            {formatMakeCurrentConfirmIdentity(item)}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            {JOB_CARD_MAKE_CURRENT_CONFIRM_BODY}
                          </p>
                          <div className="mt-2.5 flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              className="inline-flex min-h-[44px] items-center rounded-md px-3 text-sm font-semibold text-slate-600 hover:bg-white"
                              onClick={() => setPendingCurrentId(null)}
                              data-jobcard-make-current-cancel
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              className="inline-flex min-h-[44px] items-center rounded-md bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800"
                              onClick={confirmMakeCurrent}
                              disabled={selectBusy}
                              data-jobcard-make-current-confirm-set
                            >
                              {JOB_CARD_MAKE_CURRENT_CONFIRM_SET}
                            </button>
                          </div>
                        </div>
                      ) : item.canMakeCurrent ? (
                        <button
                          type="button"
                          className="inline-flex min-h-[44px] items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                          onClick={() => requestMakeCurrent(item.id)}
                          disabled={selectBusy}
                          data-jobcard-make-current={item.id}
                        >
                          {JOB_CARD_MAKE_CURRENT_LABEL}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
