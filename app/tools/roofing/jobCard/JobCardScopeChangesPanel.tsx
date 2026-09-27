"use client";

import { useState } from "react";
import InlineNotice from "@/app/components/ui/InlineNotice";
import LoadingState from "@/app/components/ui/LoadingState";
import MoneyRow from "@/app/components/ui/MoneyRow";
import { buttonClass } from "@/app/components/ui/buttonStyles";
import {
  FORM_INPUT,
  FORM_LABEL,
  FORM_LABEL_TEXT,
  FORM_OPTIONAL,
  FORM_TEXTAREA,
} from "@/app/components/ui/formStyles";
import {
  JOB_CARD_PROPOSE_SCOPE_CHANGE_LABEL,
  JOB_CARD_SCOPE_CHANGES_HEADING,
  SCOPE_CHANGE_BASIS_UNAVAILABLE_MESSAGE,
  SCOPE_CHANGE_GET_REVIEW_LINK_LABEL,
  SCOPE_CHANGE_PROPOSE_ACTION_LABEL,
  buildScopeChangeEditorTotals,
  buildScopeChangeHistoryRow,
  describeScopeChangeProposeOutcome,
  hydrateScopeChangeDraftLines,
  resolveScopeChangeEditorBasis,
  scopeChangeHistoryTotalCopy,
  sumClientLineDeltasCents,
  type ScopeChangeEditorBasis,
  type ScopeChangeProposeOutcome,
} from "@/app/lib/jobScopeChangeViewModel";
import type {
  JobScopeChangeClientRow,
  JobScopeChangeLineClient,
  JobScopeChangesState,
} from "@/app/lib/useJobScopeChanges";

type JobCardScopeChangesPanelProps = {
  /** Draft create / edit / void (scope_changes.write). */
  canAuthor: boolean;
  /** Propose and customer review link (scope_changes.issue). */
  canIssue: boolean;
  canProposeNew: boolean;
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
  basis,
  thisChangeDeltaCents,
}: {
  basis: ScopeChangeEditorBasis;
  thisChangeDeltaCents: number;
}) {
  if (basis.status !== "ready") {
    return (
      <div className="space-y-2" data-scope-change-totals data-basis={basis.status}>
        <dl className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
          <MoneyRow label="This change" cents={thisChangeDeltaCents} format="delta" />
          <MoneyRow
            label="Current contract total"
            cents={null}
            unknownLabel={basis.status === "loading" ? "Checking…" : "Unavailable"}
          />
        </dl>
        {basis.status === "unavailable" ? (
          <InlineNotice tone="warning" data-scope-change-basis-unavailable>
            {SCOPE_CHANGE_BASIS_UNAVAILABLE_MESSAGE}
          </InlineNotice>
        ) : null}
      </div>
    );
  }
  const totals = buildScopeChangeEditorTotals({
    originalAgreementCents: basis.originalAgreementCents,
    previouslyAuthorizedDeltasCents: basis.previouslyAuthorizedDeltasCents,
    thisChangeDeltaCents,
  });
  return (
    <dl
      className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm"
      data-scope-change-totals
      data-basis="ready"
    >
      <MoneyRow label="Original agreement" cents={totals.originalAgreementCents} />
      <MoneyRow
        label="Previously authorized changes"
        cents={totals.previouslyAuthorizedDeltasCents}
        format="delta"
        data-scope-change-previously-authorized
      />
      <MoneyRow label="Current contract total" cents={totals.currentContractCents} />
      <MoneyRow
        label="This change"
        cents={totals.thisChangeDeltaCents}
        format="delta"
        data-scope-change-this-delta
      />
      <MoneyRow
        label="Proposed new total"
        hint="Not applied until the customer approves"
        cents={totals.proposedNewTotalCents}
        emphasis
        data-scope-change-proposed-total
      />
    </dl>
  );
}

function HistoryList({
  rows,
  canAuthor,
  busyRowId,
  onGetReviewLink,
}: {
  rows: readonly JobScopeChangeClientRow[];
  canAuthor: boolean;
  busyRowId: string | null;
  onGetReviewLink: (row: JobScopeChangeClientRow) => void;
}) {
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
        const view = buildScopeChangeHistoryRow({
          change: {
            id: row.id,
            status: row.status as never,
            price_delta_cents: row.priceDeltaCents,
            basis_contract_total_cents: row.basisContractTotalCents,
            reason: row.reason,
            proposed_at: row.proposedAt,
            authorized_at: row.authorizedAt,
            created_at: row.createdAt,
          },
        });
        return (
          <li
            key={row.id}
            className="flex flex-wrap items-start justify-between gap-3 py-3"
            data-scope-change-history-row={row.status}
          >
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
              <p className="text-[13px] text-slate-500" data-scope-change-history-total>
                {scopeChangeHistoryTotalCopy(row.status, view.newTotalLabel)}
              </p>
            </div>
            {canAuthor && row.status === "proposed" ? (
              <button
                type="button"
                className={buttonClass("secondary", { size: "sm" })}
                disabled={busyRowId === row.id}
                onClick={() => onGetReviewLink(row)}
                data-scope-change-get-review-link
              >
                {busyRowId === row.id ? "Creating link…" : SCOPE_CHANGE_GET_REVIEW_LINK_LABEL}
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function DraftEditor({
  basis,
  initial,
  busy,
  error,
  onCancel,
  onSave,
  onPropose,
  onVoid,
}: {
  basis: ScopeChangeEditorBasis;
  initial: {
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
  /** Null when the viewer may draft but not issue (scope_changes.issue). */
  onPropose:
    | ((payload: { reason: string; timingNote: string; lines: DraftLine[] }) => Promise<void>)
    | null;
  onVoid: (() => Promise<void>) | null;
}) {
  const [reason, setReason] = useState(initial?.reason ?? "");
  const [timingNote, setTimingNote] = useState(initial?.timingNote ?? "");
  const [lines, setLines] = useState<DraftLine[]>(
    initial?.lines?.length ? initial.lines : [emptyLine("add")]
  );
  const delta = sumClientLineDeltasCents(lines);
  const proposeBlocked = basis.status !== "ready";

  return (
    <div
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-4"
      data-scope-change-draft-editor
    >
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-slate-900">
          Scope change draft
        </h3>
        <p className="text-sm text-slate-600">
          Add or remove structured work. Proposing creates a customer review
          link for you to share — no email is sent, and the contract total does
          not change until the customer approves.
        </p>
      </div>

      <label className={FORM_LABEL}>
        <span className={FORM_LABEL_TEXT}>Reason</span>
        <textarea
          className={FORM_TEXTAREA}
          value={reason}
          maxLength={500}
          onChange={(e) => setReason(e.target.value)}
          data-scope-change-reason
        />
      </label>

      <label className={FORM_LABEL}>
        <span className={FORM_LABEL_TEXT}>
          Timing note <span className={FORM_OPTIONAL}>(optional)</span>
        </span>
        <input
          className={FORM_INPUT}
          value={timingNote}
          maxLength={240}
          onChange={(e) => setTimingNote(e.target.value)}
          data-scope-change-timing
        />
      </label>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-700">Lines</p>
          <div className="flex gap-2">
            <button
              type="button"
              className={buttonClass("secondary", { size: "sm" })}
              onClick={() => setLines((prev) => [...prev, emptyLine("add")])}
            >
              Add work
            </button>
            <button
              type="button"
              className={buttonClass("secondary", { size: "sm" })}
              onClick={() => setLines((prev) => [...prev, emptyLine("remove")])}
            >
              Remove work
            </button>
          </div>
        </div>
        <ul className="space-y-3">
          {lines.map((line, index) => (
            <li
              key={line.id ?? `line-${index}`}
              className="space-y-2 rounded-lg border border-slate-100 p-3"
              data-scope-change-line
            >
              <div className="grid gap-2 sm:grid-cols-[8rem_1fr_auto]">
                <label className={FORM_LABEL}>
                  <span className={FORM_LABEL_TEXT}>Change</span>
                  <select
                    className={FORM_INPUT}
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
                </label>
                <label className={FORM_LABEL}>
                  <span className={FORM_LABEL_TEXT}>Description</span>
                  <input
                    className={FORM_INPUT}
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
                </label>
                <div className="flex items-end">
                  <button
                    type="button"
                    className={buttonClass("quiet", { size: "sm" })}
                    onClick={() =>
                      setLines((prev) => prev.filter((_, i) => i !== index))
                    }
                    disabled={lines.length <= 1}
                    aria-label={`Delete line ${index + 1}`}
                  >
                    Delete line
                  </button>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <label className={FORM_LABEL}>
                  <span className={FORM_LABEL_TEXT}>
                    Quantity <span className={FORM_OPTIONAL}>(optional)</span>
                  </span>
                  <input
                    className={FORM_INPUT}
                    type="number"
                    inputMode="decimal"
                    step="any"
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
                <label className={FORM_LABEL}>
                  <span className={FORM_LABEL_TEXT}>
                    Unit <span className={FORM_OPTIONAL}>(optional)</span>
                  </span>
                  <input
                    className={FORM_INPUT}
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
                <label className={FORM_LABEL}>
                  <span className={FORM_LABEL_TEXT}>
                    {line.changeKind === "remove" ? "Credit ($)" : "Price ($)"}
                  </span>
                  <input
                    className={FORM_INPUT}
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    placeholder="0.00"
                    value={
                      line.lineDeltaCents === 0
                        ? ""
                        : (Math.abs(line.lineDeltaCents) / 100).toString()
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

      <TotalsBlock basis={basis} thisChangeDeltaCents={delta} />

      {error ? (
        <InlineNotice tone="error" data-scope-change-error>
          {error}
        </InlineNotice>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {onPropose ? (
          <button
            type="button"
            className={buttonClass("primary")}
            disabled={busy || proposeBlocked}
            onClick={() => void onPropose({ reason, timingNote, lines })}
            data-scope-change-propose
          >
            {busy ? "Working…" : SCOPE_CHANGE_PROPOSE_ACTION_LABEL}
          </button>
        ) : null}
        <button
          type="button"
          className={buttonClass("secondary")}
          disabled={busy}
          onClick={() => void onSave({ reason, timingNote, lines })}
          data-scope-change-save
        >
          Save draft
        </button>
        {onVoid ? (
          <button
            type="button"
            className={buttonClass("quiet")}
            disabled={busy}
            onClick={() => void onVoid()}
            data-scope-change-void
          >
            Void draft
          </button>
        ) : null}
        <button
          type="button"
          className={buttonClass("quiet")}
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function ProposeOutcomeNotice({
  outcome,
  onDismiss,
}: {
  outcome: ScopeChangeProposeOutcome;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);
  if (outcome.kind === "link_missing") {
    return (
      <InlineNotice
        tone="warning"
        data-scope-change-review-link-missing
        action={
          <button type="button" className={buttonClass("quiet", { size: "sm" })} onClick={onDismiss}>
            Dismiss
          </button>
        }
      >
        {outcome.message}
      </InlineNotice>
    );
  }
  return (
    <InlineNotice
      tone="info"
      data-scope-change-review-link
      action={
        <button type="button" className={buttonClass("quiet", { size: "sm" })} onClick={onDismiss}>
          Dismiss
        </button>
      }
    >
      <p>{outcome.message}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className={buttonClass("secondary", { size: "sm" })}
          data-scope-change-copy-review-link
          onClick={() => {
            void navigator.clipboard
              ?.writeText(outcome.url)
              .then(() => setCopied(true))
              .catch(() => setCopied(false));
          }}
        >
          {copied ? "Link copied" : "Copy link"}
        </button>
        <a
          className={buttonClass("quiet", { size: "sm" })}
          href={outcome.url}
          target="_blank"
          rel="noreferrer"
        >
          Open review page
        </a>
      </div>
    </InlineNotice>
  );
}

export default function JobCardScopeChangesPanel({
  canAuthor,
  canIssue,
  canProposeNew,
  scopeChanges,
}: JobCardScopeChangesPanelProps) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ScopeChangeProposeOutcome | null>(null);
  const [linkBusyRowId, setLinkBusyRowId] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);

  const basis = resolveScopeChangeEditorBasis({
    loadStatus: scopeChanges.loadStatus,
    contractTotalCents: scopeChanges.contractTotalCents,
    rows: scopeChanges.rows,
  });

  const draftRow =
    scopeChanges.rows.find((row) => row.id === activeDraftId) ??
    scopeChanges.rows.find((row) => row.status === "draft") ??
    null;

  const hasProposed = scopeChanges.rows.some((row) => row.status === "proposed");
  const showProposeCta =
    canAuthor && canProposeNew && !hasProposed && !editing;

  async function getReviewLink(row: JobScopeChangeClientRow) {
    setLinkBusyRowId(row.id);
    setLinkError(null);
    try {
      const replay = await scopeChanges.runAction({
        scopeChangeId: row.id,
        action: "propose",
        expectedRowVersion: row.rowVersion,
      });
      if (!replay.ok) {
        setLinkError(replay.message ?? "The review link could not be created.");
        return;
      }
      setOutcome(describeScopeChangeProposeOutcome(replay.publicReviewUrl));
    } finally {
      setLinkBusyRowId(null);
    }
  }

  return (
    <section
      className="mt-8 space-y-4 border-t border-slate-100 pt-6"
      data-jobcard-scope-changes
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            {JOB_CARD_SCOPE_CHANGES_HEADING}
          </h3>
          <p className="text-sm text-slate-600">
            Changes to the accepted agreement. The contract total only changes
            when the customer approves.
          </p>
        </div>
        {showProposeCta ? (
          <button
            type="button"
            className={buttonClass("secondary")}
            data-jobcard-propose-scope-change
            onClick={() => {
              setActiveDraftId(draftRow?.id ?? null);
              setEditing(true);
              setError(null);
              setOutcome(null);
            }}
          >
            {draftRow ? "Continue scope change draft" : JOB_CARD_PROPOSE_SCOPE_CHANGE_LABEL}
          </button>
        ) : null}
      </div>

      {outcome ? (
        <ProposeOutcomeNotice outcome={outcome} onDismiss={() => setOutcome(null)} />
      ) : null}
      {linkError ? (
        <InlineNotice tone="error" data-scope-change-review-link-error>
          {linkError}
        </InlineNotice>
      ) : null}

      {editing ? (
        <DraftEditor
          key={draftRow?.id ?? "new"}
          basis={basis}
          initial={
            draftRow
              ? {
                  reason: draftRow.reason ?? "",
                  timingNote: draftRow.timingNote ?? "",
                  lines: hydrateScopeChangeDraftLines(draftRow.lines),
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
          onPropose={!canIssue ? null : async ({ reason, timingNote, lines }) => {
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
                setActiveDraftId(scopeChangeId);
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
                setError(
                  `${proposed.message ?? "Propose failed."} Your draft is saved.`
                );
                return;
              }
              setOutcome(describeScopeChangeProposeOutcome(proposed.publicReviewUrl));
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

      {scopeChanges.loadStatus === "loading" && scopeChanges.rows.length === 0 ? (
        <LoadingState label="Loading scope changes…" />
      ) : scopeChanges.loadStatus === "error" ? (
        <InlineNotice tone="error" data-scope-change-load-error>
          {scopeChanges.error ?? "Scope changes could not be loaded."}
        </InlineNotice>
      ) : (
        <HistoryList
          rows={scopeChanges.rows}
          canAuthor={canIssue}
          busyRowId={linkBusyRowId}
          onGetReviewLink={(row) => void getReviewLink(row)}
        />
      )}
    </section>
  );
}
