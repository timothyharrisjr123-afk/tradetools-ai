"use client";

import type { JobCardProposalRowView } from "./jobCardProposalsTabModel";
import {
  JOB_CARD_PROPOSALS_ADD_LABEL,
  JOB_CARD_PROPOSALS_CREATE_LABEL,
  JOB_CARD_PROPOSALS_EMPTY_BODY,
  JOB_CARD_PROPOSALS_EMPTY_TITLE,
  JOB_CARD_PROPOSALS_OPEN_LABEL,
  JOB_CARD_PROPOSALS_PRIMARY_BUTTON_CLASS,
  JOB_CARD_PROPOSALS_SECONDARY_BUTTON_CLASS,
} from "./jobCardProposalsTabModel";

type JobCardProposalsTabProps = {
  rows: readonly JobCardProposalRowView[];
  /** Gate for Block 3 Continue — measurement/template/package ready. */
  createReadyForBlock3?: boolean;
  onAddProposal: () => void;
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
  createReadyForBlock3 = false,
  onAddProposal,
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
                <p
                  className="truncate text-[14px] font-semibold text-slate-900"
                  data-jobcard-proposal-row-title
                >
                  {row.title}
                </p>
                <p
                  className="mt-0.5 truncate text-[12px] text-slate-500"
                  data-jobcard-proposal-row-meta
                >
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
