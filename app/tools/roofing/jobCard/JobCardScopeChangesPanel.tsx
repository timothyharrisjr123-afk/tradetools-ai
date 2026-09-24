"use client";

import { useMemo, useState } from "react";
import { formatUsdFromCents } from "@/app/lib/jobPaymentMoney";
import {
  JOB_CARD_PROPOSE_SCOPE_CHANGE_LABEL,
  JOB_CARD_SCOPE_CHANGES_HEADING,
  buildScopeChangeEditorTotals,
  buildScopeChangeHistoryRow,
  formatScopeChangeDeltaLabel,
  sumLineDeltasCents,
} from "@/app/lib/jobScopeChangeViewModel";
import {
  JOB_CARD_PROPOSALS_PRIMARY_BUTTON_CLASS,
  JOB_CARD_PROPOSALS_ROW_PRIMARY_BUTTON_CLASS,
  JOB_CARD_PROPOSALS_SECONDARY_BUTTON_CLASS,
} from "@/app/tools/roofing/jobCard/jobCardProposalsTabModel";
import type {
  JobScopeChangeClientRow,
  JobScopeChangeLineClient,
  JobScopeChangesState,
} from "@/app/lib/useJobScopeChanges";

type JobCardScopeChangesPanelProps = {
  canAuthor: boolean;
  canProposeNew: boolean;
  originalAgreementCents: number | null;
  scopeChanges: JobScopeChangesState;
};

type DraftLine = JobScopeChangeLineClient;

function emptyLine(kind: "add" | "remove" = "add"): DraftLine {
  return {
    changeKind: kind,
    description: "",
    quantity: null,
    unit: null,
    unitPriceCents: null,
    lineDeltaCents: 0,
    sortOrder: 0,
  };
}

function TotalsBlock({
  originalAgreementCents,
  previouslyAuthorizedDeltasCents,
  thisChangeDeltaCents,
}: {
  originalAgreementCents: number;
  previouslyAuthorizedDeltasCents: number;
  thisChangeDeltaCents: number;
}) {
  const totals = buildScopeChangeEditorTotals({
    originalAgreementCents,
    previouslyAuthorizedDeltasCents,
    thisChangeDeltaCents,
  });
  const rows: { label: string; value: string }[] = [
    {
      label: "Original agreement",
      value: formatUsdFromCents(totals.originalAgreementCents),
    },
    {
      label: "Previously authorized changes",
      value: formatScopeChangeDeltaLabel(totals.previouslyAuthorizedDeltasCents),
    },
    {
      label: "Current contract total",
      value: formatUsdFromCents(totals.currentContractCents),
    },
    {
      label: "This change",
      value: formatScopeChangeDeltaLabel(totals.thisChangeDeltaCents),
    },
    {
      label: "Proposed new total",
      value: formatUsdFromCents(totals.proposedNewTotalCents),
    },
  ];
  return (
    <dl
      className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm"
      data-scope-change-totals
    >
      {rows.map((row) => (
        <div key={row.label} className="flex items-start justify-between gap-3">
          <dt className="text-slate-500">{row.label}</dt>
          <dd className="font-semibold text-slate-900">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function HistoryList({ rows }: { rows: readonly JobScopeChangeClientRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-500" data-scope-change-history-empty>
        No scope changes yet.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-slate-100" data-scope-change-history>
      {rows.map((row) => {
        const view = buildScopeChangeHistoryRow({ change: {
          id: row.id,
          status: row.status as never,
          price_delta_cents: row.priceDeltaCents,
          basis_contract_total_cents: row.basisContractTotalCents,
          reason: row.reason,
          proposed_at: row.proposedAt,
          authorized_at: row.authorizedAt,
          created_at: row.createdAt,
        }});
        return (
          <li key={row.id} className="flex items-start justify-between gap-3 py-3">
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-semibold text-slate-900">
                {view.statusLabel}
                <span className="ml-2 font-medium text-slate-600">
                  {view.deltaLabel}
                </span>
              </p>
              {view.reason ? (
                <p className="truncate text-sm text-slate-600">{view.reason}</p>
              ) : null}
              <p className="text-xs text-slate-500">
                New total {view.newTotalLabel}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function DraftEditor({
  originalAgreementCents,
  previouslyAuthorizedDeltasCents,
  initial,
  busy,
  error,
  onCancel,
  onSave,
  onPropose,
  onVoid,
}: {
  originalAgreementCents: number;
  previouslyAuthorizedDeltasCents: number;
  initial: {
    scopeChangeId: string | null;
    rowVersion: number;
    reason: string;
    timingNote: string;
    lines: DraftLine[];
  } | null;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (payload: {
    reason: string;
    timingNote: string;
    lines: DraftLine[];
  }) => Promise<void>;
  onPropose: (payload: {
    reason: string;
    timingNote: string;
    lines: DraftLine[];
  }) => Promise<void>;
  onVoid: (() => Promise<void>) | null;
}) {
  const [reason, setReason] = useState(initial?.reason ?? "");
  const [timingNote, setTimingNote] = useState(initial?.timingNote ?? "");
  const [lines, setLines] = useState<DraftLine[]>(
    initial?.lines?.length ? initial.lines : [emptyLine("add")]
  );
  const delta = sumLineDeltasCents(lines);

  return (
    <div
      className="space-y-4 rounded-md border border-slate-200 bg-white p-4"
      data-scope-change-draft-editor
    >
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-slate-900">
          Scope change draft
        </h3>
        <p className="text-sm text-slate-600">
          Add or remove structured work. Sending asks for customer approval — it
          does not change the contract total until authorized.
        </p>
      </div>

      <label className="block space-y-1 text-sm">
        <span className="font-medium text-slate-700">Reason</span>
        <textarea
          className="min-h-[72px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
          value={reason}
          maxLength={500}
          onChange={(e) => setReason(e.target.value)}
          data-scope-change-reason
        />
      </label>

      <label className="block space-y-1 text-sm">
        <span className="font-medium text-slate-700">
          Timing note <span className="font-normal text-slate-400">(optional)</span>
        </span>
        <input
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
          value={timingNote}
          maxLength={240}
          onChange={(e) => setTimingNote(e.target.value)}
          data-scope-change-timing
        />
      </label>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-700">Lines</p>
          <div className="flex gap-2">
            <button
              type="button"
              className={JOB_CARD_PROPOSALS_SECONDARY_BUTTON_CLASS}
              onClick={() => setLines((prev) => [...prev, emptyLine("add")])}
            >
              Add line
            </button>
            <button
              type="button"
              className={JOB_CARD_PROPOSALS_SECONDARY_BUTTON_CLASS}
              onClick={() => setLines((prev) => [...prev, emptyLine("remove")])}
            >
              Remove line
            </button>
          </div>
        </div>
        <ul className="space-y-3">
          {lines.map((line, index) => (
            <li
              key={`line-${index}`}
              className="space-y-2 rounded-md border border-slate-100 p-3"
              data-scope-change-line
            >
              <div className="grid gap-2 sm:grid-cols-[7rem_1fr_auto]">
                <select
                  className="rounded-md border border-slate-200 px-2 py-2 text-sm"
                  value={line.changeKind}
                  data-scope-change-line-kind
                  onChange={(e) => {
                    const changeKind = e.target.value as "add" | "remove";
                    setLines((prev) =>
                      prev.map((row, i) =>
                        i === index
                          ? {
                              ...row,
                              changeKind,
                              lineDeltaCents:
                                changeKind === "add"
                                  ? Math.abs(row.lineDeltaCents)
                                  : -Math.abs(row.lineDeltaCents),
                            }
                          : row
                      )
                    );
                  }}
                >
                  <option value="add">Add</option>
                  <option value="remove">Remove</option>
                </select>
                <input
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Description"
                  value={line.description}
                  maxLength={240}
                  data-scope-change-line-description
                  onChange={(e) => {
                    const description = e.target.value;
                    setLines((prev) =>
                      prev.map((row, i) =>
                        i === index ? { ...row, description } : row
                      )
                    );
                  }}
                />
                <button
                  type="button"
                  className={JOB_CARD_PROPOSALS_SECONDARY_BUTTON_CLASS}
                  onClick={() =>
                    setLines((prev) => prev.filter((_, i) => i !== index))
                  }
                  disabled={lines.length <= 1}
                >
                  Remove
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="block space-y-1 text-sm">
                  <span className="text-slate-500">Quantity (optional)</span>
                  <input
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                    type="number"
                    step="any"
                    placeholder="Qty"
                    value={line.quantity ?? ""}
                    data-scope-change-line-quantity
                    onChange={(e) => {
                      const raw = e.target.value;
                      const quantity =
                        raw.trim() === ""
                          ? null
                          : Number.isFinite(Number(raw))
                            ? Number(raw)
                            : null;
                      setLines((prev) =>
                        prev.map((row, i) =>
                          i === index ? { ...row, quantity } : row
                        )
                      );
                    }}
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="text-slate-500">Unit (optional)</span>
                  <input
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                    placeholder="e.g. lf, sheets"
                    value={line.unit ?? ""}
                    maxLength={40}
                    data-scope-change-line-unit
                    onChange={(e) => {
                      const unit = e.target.value.trim() ? e.target.value : null;
                      setLines((prev) =>
                        prev.map((row, i) =>
                          i === index ? { ...row, unit } : row
                        )
                      );
                    }}
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="text-slate-500">Line delta ($)</span>
                  <input
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={
                      line.lineDeltaCents === 0
                        ? ""
                        : (line.lineDeltaCents / 100).toString()
                    }
                    data-scope-change-line-delta
                    onChange={(e) => {
                      const dollars = Number(e.target.value);
                      const cents = Number.isFinite(dollars)
                        ? Math.round(dollars * 100)
                        : 0;
                      setLines((prev) =>
                        prev.map((row, i) =>
                          i === index
                            ? {
                                ...row,
                                lineDeltaCents:
                                  row.changeKind === "remove"
                                    ? -Math.abs(cents)
                                    : Math.abs(cents),
                              }
                            : row
                        )
                      );
                    }}
                  />
                </label>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <TotalsBlock
        originalAgreementCents={originalAgreementCents}
        previouslyAuthorizedDeltasCents={previouslyAuthorizedDeltasCents}
        thisChangeDeltaCents={delta}
      />

      {error ? (
        <p className="text-sm text-red-700" data-scope-change-error>
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={JOB_CARD_PROPOSALS_ROW_PRIMARY_BUTTON_CLASS}
          disabled={busy}
          onClick={() => void onSave({ reason, timingNote, lines })}
          data-scope-change-save
        >
          Save draft
        </button>
        <button
          type="button"
          className={JOB_CARD_PROPOSALS_PRIMARY_BUTTON_CLASS}
          disabled={busy}
          onClick={() => void onPropose({ reason, timingNote, lines })}
          data-scope-change-propose
        >
          Propose / Send
        </button>
        {onVoid ? (
          <button
            type="button"
            className={JOB_CARD_PROPOSALS_SECONDARY_BUTTON_CLASS}
            disabled={busy}
            onClick={() => void onVoid()}
            data-scope-change-void
          >
            Void
          </button>
        ) : null}
        <button
          type="button"
          className={JOB_CARD_PROPOSALS_SECONDARY_BUTTON_CLASS}
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function JobCardScopeChangesPanel({
  canAuthor,
  canProposeNew,
  originalAgreementCents,
  scopeChanges,
}: JobCardScopeChangesPanelProps) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publicReviewUrl, setPublicReviewUrl] = useState<string | null>(null);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);

  const authorizedSum = useMemo(
    () =>
      scopeChanges.rows
        .filter((row) => row.status === "authorized")
        .reduce((sum, row) => sum + row.priceDeltaCents, 0),
    [scopeChanges.rows]
  );

  const draftRow =
    scopeChanges.rows.find((row) => row.id === activeDraftId) ??
    scopeChanges.rows.find((row) => row.status === "draft") ??
    null;

  const hasProposed = scopeChanges.rows.some((row) => row.status === "proposed");
  const showProposeCta =
    canAuthor && canProposeNew && !hasProposed && !editing;

  const baseAgreement = originalAgreementCents ?? 0;
  const previouslyAuthorized =
    scopeChanges.contractTotalCents != null && originalAgreementCents != null
      ? scopeChanges.contractTotalCents - originalAgreementCents
      : authorizedSum;

  return (
    <section
      className="mt-8 space-y-4 border-t border-slate-100 pt-6"
      data-jobcard-scope-changes
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            {JOB_CARD_SCOPE_CHANGES_HEADING}
          </h3>
          <p className="text-sm text-slate-600">
            Additive changes to the accepted agreement. Propose does not update
            the contract total until the customer authorizes.
          </p>
        </div>
        {showProposeCta ? (
          <button
            type="button"
            className={JOB_CARD_PROPOSALS_PRIMARY_BUTTON_CLASS}
            data-jobcard-propose-scope-change
            onClick={() => {
              setActiveDraftId(draftRow?.id ?? null);
              setEditing(true);
              setError(null);
              setPublicReviewUrl(null);
            }}
          >
            {JOB_CARD_PROPOSE_SCOPE_CHANGE_LABEL}
          </button>
        ) : null}
      </div>

      {publicReviewUrl ? (
        <div
          className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-950"
          data-scope-change-review-link
        >
          Customer review link ready.{" "}
          <a
            className="font-semibold underline"
            href={publicReviewUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open review page
          </a>
        </div>
      ) : null}

      {editing ? (
        <DraftEditor
          originalAgreementCents={baseAgreement}
          previouslyAuthorizedDeltasCents={Math.max(0, previouslyAuthorized)}
          initial={
            draftRow
              ? {
                  scopeChangeId: draftRow.id,
                  rowVersion: draftRow.rowVersion,
                  reason: draftRow.reason ?? "",
                  timingNote: draftRow.timingNote ?? "",
                  lines: [emptyLine("add")],
                }
              : null
          }
          busy={busy}
          error={error}
          onCancel={() => {
            setEditing(false);
            setError(null);
          }}
          onSave={async ({ reason, timingNote, lines }) => {
            setBusy(true);
            setError(null);
            try {
              if (draftRow) {
                const result = await scopeChanges.saveDraft({
                  scopeChangeId: draftRow.id,
                  expectedRowVersion: draftRow.rowVersion,
                  reason,
                  timingNote,
                  lines,
                });
                if (!result.ok) {
                  setError(result.message ?? "Save failed.");
                  return;
                }
              } else {
                const result = await scopeChanges.createDraft({
                  reason,
                  timingNote,
                  lines,
                });
                if (!result.ok) {
                  setError(result.message ?? "Create failed.");
                  return;
                }
                setActiveDraftId(result.scopeChangeId ?? null);
              }
            } finally {
              setBusy(false);
            }
          }}
          onPropose={async ({ reason, timingNote, lines }) => {
            setBusy(true);
            setError(null);
            try {
              let scopeChangeId = draftRow?.id ?? null;
              let rowVersion = draftRow?.rowVersion ?? 1;
              if (!scopeChangeId) {
                const created = await scopeChanges.createDraft({
                  reason,
                  timingNote,
                  lines,
                });
                if (!created.ok || !created.scopeChangeId) {
                  setError(created.message ?? "Create failed.");
                  return;
                }
                scopeChangeId = created.scopeChangeId;
                rowVersion = created.rowVersion ?? 1;
              } else {
                const saved = await scopeChanges.saveDraft({
                  scopeChangeId,
                  expectedRowVersion: rowVersion,
                  reason,
                  timingNote,
                  lines,
                });
                if (!saved.ok) {
                  setError(saved.message ?? "Save failed.");
                  return;
                }
                rowVersion = saved.rowVersion ?? rowVersion + 1;
              }
              const proposed = await scopeChanges.runAction({
                scopeChangeId,
                action: "propose",
                expectedRowVersion: rowVersion,
              });
              if (!proposed.ok) {
                setError(proposed.message ?? "Propose failed.");
                return;
              }
              setPublicReviewUrl(proposed.publicReviewUrl ?? null);
              setEditing(false);
            } finally {
              setBusy(false);
            }
          }}
          onVoid={
            draftRow
              ? async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    const result = await scopeChanges.runAction({
                      scopeChangeId: draftRow.id,
                      action: "void",
                      expectedRowVersion: draftRow.rowVersion,
                    });
                    if (!result.ok) {
                      setError(result.message ?? "Void failed.");
                      return;
                    }
                    setEditing(false);
                  } finally {
                    setBusy(false);
                  }
                }
              : null
          }
        />
      ) : null}

      {scopeChanges.loadStatus === "loading" ? (
        <p className="text-sm text-slate-500">Loading scope changes…</p>
      ) : scopeChanges.error ? (
        <p className="text-sm text-red-700">{scopeChanges.error}</p>
      ) : (
        <HistoryList rows={scopeChanges.rows} />
      )}
    </section>
  );
}
