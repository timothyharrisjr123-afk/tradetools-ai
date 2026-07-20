"use client";

import type { JobCardProposalRowView } from "./jobCardProposalsTabModel";
import {
  JOB_CARD_PROPOSALS_ADD_LABEL,
  JOB_CARD_PROPOSALS_CREATE_LABEL,
  JOB_CARD_PROPOSALS_EMPTY_BODY,
  JOB_CARD_PROPOSALS_EMPTY_TITLE,
  JOB_CARD_PROPOSALS_ENTRY_PLACEHOLDER,
  JOB_CARD_PROPOSALS_ENTRY_PLACEHOLDER_HINT,
  JOB_CARD_PROPOSALS_OPEN_LABEL,
  JOB_CARD_PROPOSALS_PRIMARY_BUTTON_CLASS,
  JOB_CARD_PROPOSALS_SECONDARY_BUTTON_CLASS,
} from "./jobCardProposalsTabModel";

type JobCardProposalsTabProps = {
  rows: readonly JobCardProposalRowView[];
  showEntryPlaceholder: boolean;
  /** Block 3 gate signal only — Block 2 does not create from + Proposal. */
  createReadyForBlock3?: boolean;
  onAddProposal: () => void;
  onDismissEntryPlaceholder: () => void;
  onOpenProposal: (proposalId: string) => void;
};

function AddProposalButton({
  onClick,
  label = JOB_CARD_PROPOSALS_ADD_LABEL,
  compact,
}: {
  onClick: () => void;
  label?: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        compact
          ? JOB_CARD_PROPOSALS_PRIMARY_BUTTON_CLASS
          : `${JOB_CARD_PROPOSALS_PRIMARY_BUTTON_CLASS} w-full sm:w-auto`
      }
      data-jobcard-add-proposal
    >
      {label}
    </button>
  );
}

export default function JobCardProposalsTab({
  rows,
  showEntryPlaceholder,
  createReadyForBlock3 = false,
  onAddProposal,
  onDismissEntryPlaceholder,
  onOpenProposal,
}: JobCardProposalsTabProps) {
  const hasRows = rows.length > 0;

  return (
    <div
      className="space-y-4"
      data-jobcard-proposals-tab
      data-jobcard-proposals-v1
      data-jobcard-create-ready-for-block3={createReadyForBlock3 ? "true" : "false"}
    >
      {showEntryPlaceholder ? (
        <div
          className="rounded-lg border border-blue-100 bg-blue-50/50 px-4 py-3"
          data-jobcard-proposal-entry-placeholder
          role="status"
        >
          <p className="text-[13px] font-medium text-slate-900">
            {JOB_CARD_PROPOSALS_ENTRY_PLACEHOLDER_HINT}
          </p>
          <p className="mt-1 text-[12px] text-slate-600">
            {JOB_CARD_PROPOSALS_ENTRY_PLACEHOLDER}
          </p>
          <button
            type="button"
            className={`mt-3 ${JOB_CARD_PROPOSALS_SECONDARY_BUTTON_CLASS}`}
            onClick={onDismissEntryPlaceholder}
            data-jobcard-proposal-entry-dismiss
          >
            Not now
          </button>
        </div>
      ) : null}

      {hasRows ? (
        <div className="space-y-2" data-jobcard-proposal-list>
          {rows.map((row) => (
            <div
              key={row.proposalId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3.5 py-3"
              data-jobcard-proposal-list-row
              data-proposal-id={row.proposalId}
            >
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-slate-900">
                  {row.title}
                </p>
                <p className="mt-0.5 truncate text-[12px] text-slate-500">
                  {row.metaLine}
                </p>
              </div>
              <button
                type="button"
                className={JOB_CARD_PROPOSALS_SECONDARY_BUTTON_CLASS}
                onClick={() => onOpenProposal(row.proposalId)}
                data-jobcard-proposal-open
              >
                {JOB_CARD_PROPOSALS_OPEN_LABEL}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div
          className="rounded-lg border border-dashed border-slate-200 bg-slate-50/40 px-4 py-8 text-center"
          data-jobcard-proposals-empty
        >
          <p className="text-[15px] font-semibold text-slate-900">
            {JOB_CARD_PROPOSALS_EMPTY_TITLE}
          </p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-slate-600">
            {JOB_CARD_PROPOSALS_EMPTY_BODY}
          </p>
          <div className="mt-4 flex justify-center">
            <AddProposalButton
              onClick={onAddProposal}
              label={JOB_CARD_PROPOSALS_CREATE_LABEL}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function JobCardProposalsAddHeaderButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <AddProposalButton onClick={onClick} compact />
  );
}
