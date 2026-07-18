"use client";

import { useState, type ReactNode } from "react";
import type {
  ProposalSetupAction,
  ProposalSetupChecklistResult,
} from "@/app/lib/proposalSetupChecklist";
import type { ProposalTemplate } from "@/app/lib/proposalTemplateTypes";
import type { JobCardProposalSetupPackages } from "./jobCardProposalSetup";
import { JOB_CARD_CREATE_PROPOSAL_EXPLAINER } from "./jobCardProposalSetup";
import JobCardProposalIncludedReview from "./JobCardProposalIncludedReview";

type JobCardProposalSetupCardProps = {
  jobLabel: string;
  measurementReady: boolean;
  measurementLabel: string;
  templateReady: boolean;
  templateName: string | null;
  templates: readonly ProposalTemplate[];
  selectedTemplateId: string | null;
  onSelectTemplate: (templateId: string) => void;
  packageSetup: JobCardProposalSetupPackages;
  onSelectPackage: (optionId: string) => void;
  checklist: ProposalSetupChecklistResult;
  createEnabled: boolean;
  isLaunching?: boolean;
  launchError?: string | null;
  hasExistingDraft: boolean;
  fixTemplateHref: string | null;
  fixCatalogHref: string | null;
  onSelectTab: (tab: "overview" | "measurements" | "proposals") => void;
  onNavigate: (href: string) => void;
  onNormalizeJobCard: (href: string) => void;
  onCreateOrOpen: () => void;
  onOpenBuilder: (href: string) => void;
};

function SetupRow({
  step,
  label,
  children,
}: {
  step: number;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1" data-jobcard-setup-step={step}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {step}. {label}
      </p>
      {children}
    </div>
  );
}

function StatusBadge({ ready, readyLabel, blockedLabel }: {
  ready: boolean;
  readyLabel: string;
  blockedLabel: string;
}) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
        ready
          ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
          : "bg-amber-50 text-amber-800 ring-amber-200"
      }`}
    >
      {ready ? readyLabel : blockedLabel}
    </span>
  );
}

function runSetupAction(
  action: ProposalSetupAction,
  handlers: Pick<
    JobCardProposalSetupCardProps,
    | "onSelectTab"
    | "onNavigate"
    | "onNormalizeJobCard"
    | "onCreateOrOpen"
    | "onOpenBuilder"
  >
) {
  if (action.disabled || action.actionType === "none") return;
  if (action.actionType === "job_card_tab" && action.targetTab) {
    handlers.onSelectTab(action.targetTab);
    return;
  }
  if (action.actionType === "normalize_job_card" && action.href) {
    handlers.onNormalizeJobCard(action.href);
    return;
  }
  if (action.actionType === "route" && action.href) {
    handlers.onNavigate(action.href);
    return;
  }
  if (action.actionType === "create_proposal") {
    handlers.onCreateOrOpen();
    return;
  }
  if (action.actionType === "open_builder" && action.href) {
    handlers.onOpenBuilder(action.href);
  }
}

export default function JobCardProposalSetupCard({
  jobLabel,
  measurementReady,
  measurementLabel,
  templateReady,
  templateName,
  templates,
  selectedTemplateId,
  onSelectTemplate,
  packageSetup,
  onSelectPackage,
  checklist,
  createEnabled,
  isLaunching,
  launchError,
  hasExistingDraft,
  fixTemplateHref,
  fixCatalogHref,
  onSelectTab,
  onNavigate,
  onNormalizeJobCard,
  onCreateOrOpen,
  onOpenBuilder,
}: JobCardProposalSetupCardProps) {
  const [showIncluded, setShowIncluded] = useState(false);
  const primary = checklist.primaryAction;
  const isLaunchAction =
    primary.actionType === "create_proposal" || primary.actionType === "open_builder";
  const showLaunching = Boolean(isLaunching) && isLaunchAction;

  const primaryLabel = showLaunching
    ? hasExistingDraft || primary.actionType === "open_builder"
      ? "Opening proposal…"
      : "Creating proposal…"
    : hasExistingDraft || primary.actionType === "open_builder"
      ? "Open proposal draft"
      : "Create proposal draft";

  const packageNeedsAttention =
    packageSetup.selected != null && packageSetup.selected.issueCount > 0;
  const blockersIncomplete = checklist.items.filter(
    (item) =>
      item.isActiveBlocker ||
      (item.status !== "complete" && item.status !== "optional")
  );

  const showTemplatePicker = templates.length > 1;

  return (
    <div
      className="rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm"
      data-jobcard-proposal-setup
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">Proposal setup</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            For {jobLabel || "this job"} — confirm what goes on the quote, then create or open
            the draft.
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        <SetupRow step={1} label="Measurement">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              ready={measurementReady}
              readyLabel="Ready"
              blockedLabel="Missing"
            />
            <span className="text-[11px] text-slate-700">{measurementLabel}</span>
            {!measurementReady ? (
              <button
                type="button"
                onClick={() => onSelectTab("measurements")}
                className="text-[11px] font-semibold text-cyan-700 hover:text-cyan-900"
              >
                Go to Measurements
              </button>
            ) : null}
          </div>
        </SetupRow>

        <SetupRow step={2} label="Template">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                ready={templateReady && !packageNeedsAttention}
                readyLabel="Ready"
                blockedLabel="Needs attention"
              />
              <span className="text-[11px] font-medium text-slate-800">
                {templateName?.trim() || "No template selected"}
              </span>
            </div>
            {showTemplatePicker ? (
              <select
                className="w-full max-w-sm rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-800"
                value={selectedTemplateId ?? ""}
                onChange={(e) => {
                  const next = e.target.value;
                  if (next) onSelectTemplate(next);
                }}
                data-jobcard-template-select
              >
                {templates.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            ) : null}
            {!templateReady && fixTemplateHref ? (
              <button
                type="button"
                onClick={() => onNavigate(fixTemplateHref)}
                className="text-[11px] font-semibold text-cyan-700 hover:text-cyan-900"
              >
                Fix template
              </button>
            ) : null}
          </div>
        </SetupRow>

        <SetupRow step={3} label="Package">
          {packageSetup.choices.length > 0 ? (
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label="Package options"
              data-jobcard-package-selector
            >
              {packageSetup.choices.map((choice) => {
                const selected = choice.optionId === packageSetup.selectedOptionId;
                return (
                  <button
                    key={choice.optionId}
                    type="button"
                    onClick={() => onSelectPackage(choice.optionId)}
                    className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold ${
                      selected
                        ? "border-cyan-700 bg-cyan-700 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    {choice.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-[11px] text-slate-500">
              Packages appear after a template is ready.
            </p>
          )}
        </SetupRow>

        <SetupRow step={4} label="Included summary">
          <div data-jobcard-included-summary>
            <p className="text-[11px] text-slate-700">
              {packageSetup.selected
                ? `${packageSetup.includedItemCount} Catalog item${
                    packageSetup.includedItemCount === 1 ? "" : "s"
                  }`
                : "No package selected"}
              {packageSetup.customerFacingLine
                ? ` · ${packageSetup.customerFacingLine}`
                : ""}
            </p>
            {packageSetup.selected ? (
              <button
                type="button"
                onClick={() => setShowIncluded((v) => !v)}
                className="mt-1 text-[11px] font-semibold text-cyan-700 hover:text-cyan-900"
                data-jobcard-review-included
              >
                {showIncluded ? "Hide included items" : "Review included items"}
              </button>
            ) : null}
            <JobCardProposalIncludedReview
              open={showIncluded}
              packageLabel={packageSetup.selected?.label ?? null}
              items={packageSetup.includedItems}
              fixTemplateHref={fixTemplateHref}
              onClose={() => setShowIncluded(false)}
              onFixTemplate={onNavigate}
            />
          </div>
        </SetupRow>

        <SetupRow step={5} label="Create / open proposal">
          <p className="text-[11px] leading-snug text-slate-600" data-jobcard-create-explainer>
            {JOB_CARD_CREATE_PROPOSAL_EXPLAINER}
          </p>
          <div className="mt-2 flex flex-wrap items-start gap-2">
            <button
              type="button"
              disabled={
                showLaunching ||
                primary.disabled ||
                primary.actionType === "none" ||
                (isLaunchAction && !createEnabled)
              }
              aria-busy={showLaunching || undefined}
              onClick={() => {
                if (isLaunchAction) {
                  if (!createEnabled) return;
                  onCreateOrOpen();
                  return;
                }
                runSetupAction(primary, {
                  onSelectTab,
                  onNavigate,
                  onNormalizeJobCard,
                  onCreateOrOpen,
                  onOpenBuilder,
                });
              }}
              className={
                !showLaunching &&
                !primary.disabled &&
                primary.actionType !== "none" &&
                (!isLaunchAction || createEnabled)
                  ? "inline-flex items-center rounded-md border border-cyan-700 bg-cyan-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-cyan-800"
                  : "inline-flex cursor-not-allowed items-center rounded-md border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-400"
              }
              data-jobcard-create-cta
            >
              {isLaunchAction ? primaryLabel : primary.label}
            </button>
          </div>
          {!isLaunchAction ? (
            <p className="mt-1 text-[10px] text-slate-500">
              {primary.helperText ?? checklist.statusText}
            </p>
          ) : null}
          {launchError ? (
            <p className="mt-1 text-[11px] text-red-600">{launchError}</p>
          ) : null}
        </SetupRow>
      </div>

      {!checklist.quiet && blockersIncomplete.length > 0 ? (
        <div
          className="mt-3 rounded-md border border-amber-200 bg-amber-50/70 px-2.5 py-2"
          data-jobcard-setup-blockers
        >
          <p className="text-[11px] font-semibold text-amber-900">Needs attention</p>
          <ul className="mt-1 space-y-1">
            {blockersIncomplete.slice(0, 4).map((item) => (
              <li key={item.id} className="text-[10px] text-amber-900">
                <span className="font-medium">{item.label}</span>
                {item.detail ? ` — ${item.detail}` : ""}
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap gap-2">
            {primary.actionType !== "create_proposal" &&
            primary.actionType !== "open_builder" ? (
              <button
                type="button"
                disabled={primary.disabled}
                onClick={() =>
                  runSetupAction(primary, {
                    onSelectTab,
                    onNavigate,
                    onNormalizeJobCard,
                    onCreateOrOpen,
                    onOpenBuilder,
                  })
                }
                className="text-[11px] font-semibold text-cyan-700 hover:text-cyan-900"
              >
                {primary.label}
              </button>
            ) : null}
            {fixCatalogHref && checklist.activeBlockerId === "catalog" ? (
              <button
                type="button"
                onClick={() => onNavigate(fixCatalogHref)}
                className="text-[11px] font-semibold text-cyan-700 hover:text-cyan-900"
              >
                Open Catalog
              </button>
            ) : null}
            {fixTemplateHref && checklist.activeBlockerId === "template" ? (
              <button
                type="button"
                onClick={() => onNavigate(fixTemplateHref)}
                className="text-[11px] font-semibold text-cyan-700 hover:text-cyan-900"
              >
                Fix template
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <p className="mt-3 text-[10px] leading-snug text-slate-400">
        Templates and Catalog are company setup. Stay on this job unless something needs fixing.
      </p>
    </div>
  );
}
