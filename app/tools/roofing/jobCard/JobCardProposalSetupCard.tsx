"use client";

import { useState, type ReactNode } from "react";
import type {
  ProposalSetupAction,
  ProposalSetupChecklistResult,
} from "@/app/lib/proposalSetupChecklist";
import type { ProposalTemplate } from "@/app/lib/proposalTemplateTypes";
import type {
  JobCardDraftOpenSummary,
  JobCardProposalSetupPackages,
} from "./jobCardProposalSetup";
import {
  JOB_CARD_CREATE_ANOTHER_EXPLAINER,
  JOB_CARD_CREATE_ANOTHER_HEADLINE,
  JOB_CARD_CREATE_PROPOSAL_EXPLAINER,
  JOB_CARD_DRAFT_PACKAGE_CHANGE_NOTE,
  JOB_CARD_EXISTING_DRAFT_INTERNAL_NOTE,
  JOB_CARD_OPEN_PROPOSAL_EXPLAINER,
  formatJobCardDraftUpdatedLabel,
  looksLikeInternalDraftTitle,
} from "./jobCardProposalSetup";
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
  /** Enable create / create-another CTA (payload + gates). */
  createEnabled: boolean;
  isLaunching?: boolean;
  /** True while force-create is in flight. */
  isCreatingNew?: boolean;
  launchError?: string | null;
  hasExistingDraft: boolean;
  /** When set with hasExistingDraft, shows the existing-draft summary. */
  draftOpenSummary?: JobCardDraftOpenSummary | null;
  fixTemplateHref: string | null;
  fixCatalogHref: string | null;
  onSelectTab: (tab: "overview" | "measurements" | "proposals") => void;
  onNavigate: (href: string) => void;
  onNormalizeJobCard: (href: string) => void;
  /**
   * Open existing draft (reuse path) when a draft exists.
   * When no draft exists, may still be used as legacy create — prefer onCreateNewDraft.
   */
  onCreateOrOpen: () => void;
  /** Always create a distinct new draft (bypass reuse). */
  onCreateNewDraft: () => void;
  onOpenBuilder: (href: string) => void;
};

function SetupStep({
  step,
  label,
  ready,
  detail,
  action,
  children,
}: {
  step: number;
  label: string;
  ready: boolean;
  detail: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2.5"
      data-jobcard-setup-step={step}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {step}. {label}
          </p>
          <p className="mt-0.5 truncate text-[12px] font-medium text-slate-900">{detail}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
            ready
              ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
              : "bg-amber-50 text-amber-800 ring-amber-200"
          }`}
        >
          {ready ? "Ready" : "Needs attention"}
        </span>
      </div>
      {action ? <div className="mt-1.5">{action}</div> : null}
      {children ? <div className="mt-2">{children}</div> : null}
    </div>
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
    | "onCreateNewDraft"
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
    handlers.onCreateNewDraft();
    return;
  }
  if (action.actionType === "open_builder" && action.href) {
    handlers.onOpenBuilder(action.href);
  }
}

function CreateProposalFields({
  measurementReady,
  measurementLabel,
  templateReady,
  templateName,
  templates,
  selectedTemplateId,
  onSelectTemplate,
  packageSetup,
  onSelectPackage,
  fixTemplateHref,
  onSelectTab,
  onNavigate,
  showTemplatePicker,
}: {
  measurementReady: boolean;
  measurementLabel: string;
  templateReady: boolean;
  templateName: string | null;
  templates: readonly ProposalTemplate[];
  selectedTemplateId: string | null;
  onSelectTemplate: (templateId: string) => void;
  packageSetup: JobCardProposalSetupPackages;
  onSelectPackage: (optionId: string) => void;
  fixTemplateHref: string | null;
  onSelectTab: (tab: "overview" | "measurements" | "proposals") => void;
  onNavigate: (href: string) => void;
  showTemplatePicker: boolean;
}) {
  const [showIncluded, setShowIncluded] = useState(false);
  const packageNeedsAttention =
    packageSetup.selected != null && packageSetup.selected.issueCount > 0;
  const templateStepReady = templateReady && !packageNeedsAttention;

  return (
    <div className="space-y-2" data-jobcard-create-fields>
      <SetupStep
        step={1}
        label="Measurement"
        ready={measurementReady}
        detail={measurementLabel || "No measurement selected"}
        action={
          !measurementReady ? (
            <button
              type="button"
              onClick={() => onSelectTab("measurements")}
              className="text-[11px] font-semibold text-cyan-700 hover:text-cyan-900"
            >
              Go to Measurements
            </button>
          ) : null
        }
      />

      <SetupStep
        step={2}
        label="Template"
        ready={templateStepReady}
        detail={templateName?.trim() || "No template selected"}
        action={
          !templateReady && fixTemplateHref ? (
            <button
              type="button"
              onClick={() => onNavigate(fixTemplateHref)}
              className="text-[11px] font-semibold text-cyan-700 hover:text-cyan-900"
            >
              Fix template
            </button>
          ) : null
        }
      >
        {showTemplatePicker ? (
          <select
            className="w-full max-w-md rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] text-slate-800"
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
      </SetupStep>

      <SetupStep
        step={3}
        label="Package"
        ready={packageSetup.selected != null && !packageNeedsAttention}
        detail={packageSetup.selected?.label ?? "Select a package"}
      >
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
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                    selected
                      ? "border-slate-900 bg-slate-900 text-white"
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
      </SetupStep>

      <SetupStep
        step={4}
        label="Included items"
        ready={Boolean(packageSetup.selected) && packageSetup.includedItemCount > 0}
        detail={
          packageSetup.selected
            ? `${packageSetup.includedItemCount} Catalog item${
                packageSetup.includedItemCount === 1 ? "" : "s"
              }${
                packageSetup.customerFacingLine
                  ? ` · ${packageSetup.customerFacingLine}`
                  : ""
              }`
            : "No package selected"
        }
        action={
          packageSetup.selected ? (
            <button
              type="button"
              onClick={() => setShowIncluded((v) => !v)}
              className="text-[11px] font-semibold text-cyan-700 hover:text-cyan-900"
              data-jobcard-review-included
            >
              {showIncluded ? "Hide included items" : "Review included items"}
            </button>
          ) : null
        }
      >
        <div data-jobcard-included-summary>
          <JobCardProposalIncludedReview
            open={showIncluded}
            packageLabel={packageSetup.selected?.label ?? null}
            items={packageSetup.includedItems}
            fixTemplateHref={fixTemplateHref}
            onClose={() => setShowIncluded(false)}
            onFixTemplate={onNavigate}
          />
        </div>
      </SetupStep>
    </div>
  );
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
  isCreatingNew,
  launchError,
  hasExistingDraft,
  draftOpenSummary = null,
  fixTemplateHref,
  fixCatalogHref,
  onSelectTab,
  onNavigate,
  onNormalizeJobCard,
  onCreateOrOpen,
  onCreateNewDraft,
  onOpenBuilder,
}: JobCardProposalSetupCardProps) {
  const primary = checklist.primaryAction;
  const hasDraftSummary = hasExistingDraft && draftOpenSummary != null;
  const setupMode = hasDraftSummary ? "open_and_create" : "create";
  const isLaunchAction =
    primary.actionType === "create_proposal" || primary.actionType === "open_builder";
  const showOpening = Boolean(isLaunching) && !isCreatingNew;
  const showCreating = Boolean(isCreatingNew) || (Boolean(isLaunching) && !hasDraftSummary);

  const packageNeedsAttention =
    packageSetup.selected != null && packageSetup.selected.issueCount > 0;
  const templateStepReady = templateReady && !packageNeedsAttention;
  const createSetupReady =
    measurementReady && templateStepReady && createEnabled && packageSetup.selected != null;

  const headline = hasDraftSummary
    ? "Proposals for this job"
    : createSetupReady
      ? "Ready to create draft"
      : "Needs attention";

  const statusPillLabel = hasDraftSummary
    ? "Draft saved"
    : createSetupReady
      ? "Ready to create draft"
      : "Needs attention";

  const showTemplatePicker = templates.length > 1;
  const showBlockers = !hasDraftSummary && !isLaunchAction && !checklist.quiet;
  const updatedLabel = hasDraftSummary
    ? formatJobCardDraftUpdatedLabel(draftOpenSummary.updatedAt)
    : null;
  const internalTitle = hasDraftSummary
    ? looksLikeInternalDraftTitle(draftOpenSummary.title)
    : false;

  const openEnabled = hasDraftSummary && !showOpening && !showCreating;
  const createCtaEnabled =
    !showOpening &&
    !showCreating &&
    (hasDraftSummary
      ? createEnabled
      : !primary.disabled &&
        primary.actionType !== "none" &&
        (primary.actionType !== "create_proposal" || createEnabled));

  const createCtaLabel = showCreating
    ? "Creating proposal…"
    : hasDraftSummary
      ? "Create new proposal draft"
      : "Create proposal draft";

  return (
    <div
      className="space-y-3"
      data-jobcard-proposal-setup
      data-jobcard-setup-mode={setupMode}
    >
      {hasDraftSummary ? (
        <div
          className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm"
          data-jobcard-existing-draft-card
        >
          <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 px-4 py-3.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Existing draft
                </p>
                <p
                  className="mt-0.5 text-base font-semibold tracking-tight text-slate-950"
                  data-jobcard-setup-headline
                >
                  {draftOpenSummary.title?.trim() || "Untitled proposal draft"}
                </p>
                <p className="mt-0.5 text-[12px] text-slate-600">
                  For {jobLabel || "this job"} — open in Builder to continue this draft.
                </p>
              </div>
              <span
                className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-200"
                data-jobcard-setup-status-pill
              >
                {statusPillLabel}
              </span>
            </div>
          </div>

          <div className="space-y-2 px-4 py-3" data-jobcard-draft-open-summary>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Package
                </p>
                <p className="mt-0.5 truncate text-[12px] font-medium text-slate-900">
                  {draftOpenSummary.packageLabel ?? "Package on file"}
                </p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </p>
                <p className="mt-0.5 truncate text-[12px] font-medium text-slate-900">
                  {draftOpenSummary.statusLabel}
                </p>
              </div>
              {updatedLabel ? (
                <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2.5 sm:col-span-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Last updated
                  </p>
                  <p className="mt-0.5 truncate text-[12px] font-medium text-slate-900">
                    {updatedLabel}
                  </p>
                </div>
              ) : null}
            </div>
            {draftOpenSummary.templateName ? (
              <p className="text-[11px] text-slate-500">
                Source template:{" "}
                <span className="font-medium text-slate-700">
                  {draftOpenSummary.templateName}
                </span>
              </p>
            ) : null}
            {internalTitle ? (
              <p
                className="text-[11px] leading-snug text-amber-800/90"
                data-jobcard-existing-draft-internal-note
              >
                {JOB_CARD_EXISTING_DRAFT_INTERNAL_NOTE}
              </p>
            ) : null}
            <p
              className="text-[11px] leading-snug text-slate-500"
              data-jobcard-draft-package-change-note
            >
              {JOB_CARD_DRAFT_PACKAGE_CHANGE_NOTE}
            </p>
          </div>

          <div className="border-t border-slate-100 px-4 py-3.5" data-jobcard-open-cta-zone>
            <p className="text-[12px] leading-snug text-slate-600" data-jobcard-open-explainer>
              {JOB_CARD_OPEN_PROPOSAL_EXPLAINER}
            </p>
            <div className="mt-2.5">
              <button
                type="button"
                disabled={!openEnabled}
                aria-busy={showOpening || undefined}
                onClick={onCreateOrOpen}
                className={
                  openEnabled
                    ? "inline-flex items-center rounded-md border border-slate-900 bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
                    : "inline-flex cursor-not-allowed items-center rounded-md border border-slate-200 bg-slate-100 px-3.5 py-2 text-sm font-semibold text-slate-400"
                }
                data-jobcard-open-cta
              >
                {showOpening ? "Opening proposal…" : "Open in Builder"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div
        className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm"
        data-jobcard-create-new-card
      >
        <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50 via-white to-cyan-50/40 px-4 py-3.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {hasDraftSummary ? "New proposal" : "Proposal setup"}
              </p>
              <p
                className="mt-0.5 text-base font-semibold tracking-tight text-slate-950"
                data-jobcard-create-headline
              >
                {hasDraftSummary
                  ? JOB_CARD_CREATE_ANOTHER_HEADLINE
                  : headline}
              </p>
              <p className="mt-0.5 text-[12px] text-slate-600">
                {hasDraftSummary
                  ? `For ${jobLabel || "this job"} — choose template and package for a new draft.`
                  : `For ${jobLabel || "this job"} — confirm template and package, then create the draft.`}
              </p>
            </div>
            {!hasDraftSummary ? (
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ${
                  createSetupReady
                    ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                    : "bg-amber-50 text-amber-800 ring-amber-200"
                }`}
                data-jobcard-setup-status-pill
              >
                {statusPillLabel}
              </span>
            ) : null}
          </div>
        </div>

        <div className="px-4 py-3">
          <CreateProposalFields
            measurementReady={measurementReady}
            measurementLabel={measurementLabel}
            templateReady={templateReady}
            templateName={templateName}
            templates={templates}
            selectedTemplateId={selectedTemplateId}
            onSelectTemplate={onSelectTemplate}
            packageSetup={packageSetup}
            onSelectPackage={onSelectPackage}
            fixTemplateHref={fixTemplateHref}
            onSelectTab={onSelectTab}
            onNavigate={onNavigate}
            showTemplatePicker={showTemplatePicker}
          />
        </div>

        <div className="border-t border-slate-100 px-4 py-3.5" data-jobcard-setup-cta-zone>
          <p className="text-[12px] leading-snug text-slate-600" data-jobcard-create-explainer>
            {hasDraftSummary
              ? JOB_CARD_CREATE_ANOTHER_EXPLAINER
              : JOB_CARD_CREATE_PROPOSAL_EXPLAINER}
          </p>
          <div className="mt-2.5">
            <button
              type="button"
              disabled={!createCtaEnabled}
              aria-busy={showCreating || undefined}
              onClick={() => {
                if (hasDraftSummary) {
                  if (!createEnabled) return;
                  onCreateNewDraft();
                  return;
                }
                if (primary.actionType === "create_proposal") {
                  if (!createEnabled) return;
                  onCreateNewDraft();
                  return;
                }
                runSetupAction(primary, {
                  onSelectTab,
                  onNavigate,
                  onNormalizeJobCard,
                  onCreateOrOpen,
                  onCreateNewDraft,
                  onOpenBuilder,
                });
              }}
              className={
                createCtaEnabled
                  ? "inline-flex items-center rounded-md border border-slate-900 bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
                  : "inline-flex cursor-not-allowed items-center rounded-md border border-slate-200 bg-slate-100 px-3.5 py-2 text-sm font-semibold text-slate-400"
              }
              data-jobcard-create-cta
            >
              {!hasDraftSummary && !isLaunchAction && !showCreating
                ? primary.label
                : createCtaLabel}
            </button>
          </div>
          {!hasDraftSummary && !isLaunchAction ? (
            <p className="mt-1.5 text-[11px] text-slate-500">
              {primary.helperText ?? checklist.statusText}
            </p>
          ) : null}
          {launchError ? <p className="mt-1.5 text-[11px] text-red-600">{launchError}</p> : null}

          {showBlockers ? (
            <div
              className="mt-3 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2"
              data-jobcard-setup-blockers
            >
              <p className="text-[11px] font-semibold text-amber-900">Fix before creating</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
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
                        onCreateNewDraft,
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
      </div>
    </div>
  );
}
