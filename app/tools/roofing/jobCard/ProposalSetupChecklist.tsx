"use client";

import { useState } from "react";
import type {
  ProposalSetupAction,
  ProposalSetupChecklistItem,
  ProposalSetupChecklistResult,
  ProposalSetupItemStatus,
} from "@/app/lib/proposalSetupChecklist";

type ProposalSetupChecklistProps = {
  checklist: ProposalSetupChecklistResult;
  onSelectTab: (tab: "overview" | "measurements" | "proposals") => void;
  onNavigate: (href: string) => void;
  onCreateProposal: () => void;
  onOpenBuilder: (href: string) => void;
  launchError?: string | null;
};

function statusLabel(status: ProposalSetupItemStatus): string {
  switch (status) {
    case "complete":
      return "Complete";
    case "needs_action":
      return "Needs action";
    case "blocked":
      return "Blocked";
    case "optional":
      return "Optional";
    case "unknown":
      return "Unknown";
    default:
      return status;
  }
}

function statusClassName(status: ProposalSetupItemStatus): string {
  switch (status) {
    case "complete":
      return "text-emerald-700";
    case "needs_action":
      return "text-amber-800";
    case "blocked":
      return "text-red-700";
    case "optional":
      return "text-slate-500";
    case "unknown":
      return "text-slate-500";
    default:
      return "text-slate-600";
  }
}

function SetupActionButton({
  action,
  variant,
  onSelectTab,
  onNavigate,
  onCreateProposal,
  onOpenBuilder,
}: {
  action: ProposalSetupAction;
  variant: "primary" | "secondary";
  onSelectTab: ProposalSetupChecklistProps["onSelectTab"];
  onNavigate: ProposalSetupChecklistProps["onNavigate"];
  onCreateProposal: ProposalSetupChecklistProps["onCreateProposal"];
  onOpenBuilder: ProposalSetupChecklistProps["onOpenBuilder"];
}) {
  const base =
    variant === "primary"
      ? "inline-flex items-center rounded-md border border-cyan-700 bg-cyan-700 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
      : "inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-cyan-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div>
      <button
        type="button"
        disabled={action.disabled || action.actionType === "none"}
        className={base}
        onClick={() => {
          if (action.disabled || action.actionType === "none") return;
          if (action.actionType === "job_card_tab" && action.targetTab) {
            onSelectTab(action.targetTab);
            return;
          }
          if (action.actionType === "route" && action.href) {
            onNavigate(action.href);
            return;
          }
          if (action.actionType === "create_proposal") {
            onCreateProposal();
            return;
          }
          if (action.actionType === "open_builder" && action.href) {
            onOpenBuilder(action.href);
          }
        }}
      >
        {action.label}
      </button>
      {action.helperText ? (
        <p
          className={`mt-0.5 text-[10px] leading-snug ${variant === "primary" ? "text-slate-600" : "text-slate-500"}`}
        >
          {action.helperText}
        </p>
      ) : null}
    </div>
  );
}

function ChecklistItemRow({ item }: { item: ProposalSetupChecklistItem }) {
  return (
    <div
      className={`flex items-start justify-between gap-2 text-[11px] ${item.isActiveBlocker ? "rounded border border-amber-200 bg-amber-50/60 px-2 py-1" : ""}`}
    >
      <div>
        <span className="font-medium text-slate-800">{item.label}</span>
        {item.detail ? (
          <p className="mt-0.5 text-[10px] leading-snug text-slate-500">{item.detail}</p>
        ) : null}
      </div>
      <span className={`shrink-0 font-medium ${statusClassName(item.status)}`}>
        {statusLabel(item.status)}
      </span>
    </div>
  );
}

export default function ProposalSetupChecklist({
  checklist,
  onSelectTab,
  onNavigate,
  onCreateProposal,
  onOpenBuilder,
  launchError,
}: ProposalSetupChecklistProps) {
  const [showDetails, setShowDetails] = useState(false);

  const incompleteItems = checklist.items.filter(
    (item) => item.status !== "complete" && item.status !== "optional"
  );
  const detailItems = showDetails
    ? checklist.items
    : incompleteItems.length > 0
      ? incompleteItems
      : checklist.items.filter((item) => item.isActiveBlocker);

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p
            className={`text-[11px] font-medium ${checklist.quiet ? "text-emerald-700" : "text-slate-800"}`}
          >
            {checklist.statusText}
          </p>
          {!checklist.quiet && checklist.activeBlockerId ? (
            <p className="mt-0.5 text-[10px] text-slate-500">
              Complete the step below to unblock proposal creation.
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className="text-[10px] font-semibold text-cyan-700 hover:text-cyan-900"
        >
          {showDetails ? "Hide setup details" : "Show setup details"}
        </button>
      </div>

      {detailItems.length > 0 ? (
        <div className="mt-2 space-y-1">
          {detailItems.map((item) => (
            <ChecklistItemRow key={item.id} item={item} />
          ))}
        </div>
      ) : null}

      <div className="mt-2">
        <SetupActionButton
          action={checklist.primaryAction}
          variant="primary"
          onSelectTab={onSelectTab}
          onNavigate={onNavigate}
          onCreateProposal={onCreateProposal}
          onOpenBuilder={onOpenBuilder}
        />
      </div>

      {checklist.secondaryActions.length > 0 ? (
        <div className="mt-2 space-y-1">
          {checklist.secondaryActions.map((action) => (
            <SetupActionButton
              key={action.id}
              action={action}
              variant="secondary"
              onSelectTab={onSelectTab}
              onNavigate={onNavigate}
              onCreateProposal={onCreateProposal}
              onOpenBuilder={onOpenBuilder}
            />
          ))}
        </div>
      ) : null}

      {launchError ? (
        <p className="mt-2 text-[11px] text-red-600">{launchError}</p>
      ) : null}
    </div>
  );
}
