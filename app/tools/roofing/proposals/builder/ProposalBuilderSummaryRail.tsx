import {
  formatCatalogReadinessLabel,
  type CatalogReadinessSummary,
} from "@/app/lib/catalogReadiness";
import {
  formatProposalQuantitiesDisplay,
  type MeasurementProposalHandoff,
} from "@/app/lib/measurementProposalHandoff";
import type { ProposalBuilderOptionInternalView, ProposalBuilderOptionStatus } from "@/app/lib/proposalBuilderPricingPreview";
import type { ProposalTemplateReadiness } from "@/app/lib/proposalTemplateTypes";
import { formatProposalTemplateReadinessLabel } from "@/app/lib/proposalTemplateReadiness";
import { proposalTemplateReadinessStatusPillClass } from "@/app/lib/proposalTemplateReadiness";
import { catalogReadinessStatusPillClass } from "@/app/tools/roofing/templates/templatesConstants";
import type * as React from "react";
import { ArrowRight, ChevronDown, Lock } from "lucide-react";
import type {
  ProposalBuilderGuidance,
  ProposalBuilderGuidanceTarget,
} from "@/app/lib/proposalBuilderGuidance";
import {
  presentBuilderQuantityStatus,
} from "@/app/lib/proposalBuilderQuantityStatusCopy";
import type { QuantityPreflightTrustSignal } from "@/app/lib/proposalBuilderTrustSignals";
import {
  builderGuidedStepDotClass,
  builderGuidedStepPillClass,
  BUILDER_GUIDED_STEP_ROW,
  BUILDER_GUIDED_STEP_ROW_CLICKABLE,
  BUILDER_GUIDED_STEP_ROW_STATIC,
  BUILDER_NEXT_ACTION_CARD,
  BUILDER_NEXT_ACTION_CTA,
  BUILDER_NEXT_ACTION_CTA_DISABLED,
  BUILDER_NEXT_ACTION_DESC,
  BUILDER_NEXT_ACTION_KICKER,
  BUILDER_NEXT_ACTION_TITLE,
  BUILDER_RAIL_GUIDED_PATH_TITLE,
} from "./proposalBuilderConstants";
import {
  BUILDER_RAIL_BLOCKING_LINES_LABEL,
  BUILDER_RAIL_CARD,
  BUILDER_RAIL_GROUP_HEADING,
  BUILDER_RAIL_GUARDRAIL_LABEL,
  BUILDER_RAIL_PRICING_CONFIDENCE_TITLE,
  BUILDER_RAIL_PRICING_STATUS_LABEL,
  BUILDER_RAIL_SETUP_READINESS_TITLE,
  BUILDER_RAIL_STAT,
  formatOptionPricingTabStatusLabel,
  formatPricingPolicyConfiguredLabel,
  guardrailOutcomePillClass,
  guardrailRailMessage,
  guardrailRailStatusLabel,
  resolveBuilderRailActionsNote,
} from "./proposalBuilderConstants";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";

type ProposalBuilderSummaryRailProps = {
  /** 3J4B3: guided-flow model (single source of truth). Null until shell ready. */
  guidance?: ProposalBuilderGuidance | null;
  /** 3J4B3: routes a guided target to existing setters/handlers only. */
  onGuidanceNavigate?: (target: ProposalBuilderGuidanceTarget) => void;
  measurementHandoff: MeasurementProposalHandoff | null;
  catalogReadiness: CatalogReadinessSummary;
  templateReadiness: ProposalTemplateReadiness;
  starterGraph: ProposalTemplateGraph | null;
  /** Selected option pricing status — words only, no dollars. */
  selectedOptionPricingStatus: ProposalBuilderOptionStatus | null;
  /** 3I-3C: selected option internal profitability (contractor-only). */
  selectedOptionInternal: ProposalBuilderOptionInternalView | null;
  /** 3I-3B3c: company pricing policy configured (status-only; no policy detail). */
  pricingPolicyConfigured?: boolean;
  /** 3I-3B3c: resolver fetch finished — drives Checking vs Configured/Not configured. */
  pricingPolicyLoadComplete?: boolean;
  /** 3J4C4: quantities reflect a saved snapshot rather than the live measurement. */
  isPersistedSnapshot?: boolean;
  /** 3J4C4: snapshot quantity display when isPersistedSnapshot is true. */
  snapshotMeasurementDisplay?: string | null;
  /** 3J4C4: persisted draft id, surfaced in the ambient "About" disclosure. */
  proposalId?: string | null;
  /**
   * Phase 6: contractor-only quantity preflight trust (read-only status).
   * Non-blocking; no auto-refresh; not customer-facing.
   */
  quantityPreflightTrust?: QuantityPreflightTrustSignal | null;
};

function pricingPolicyRailStatusLabel(
  loadComplete: boolean,
  configured: boolean
): string {
  if (!loadComplete) return "Checking…";
  return formatPricingPolicyConfiguredLabel(configured);
}

function RailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${BUILDER_RAIL_STAT} flex items-baseline justify-between gap-2`}>
      <p className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="truncate text-right text-xs font-medium text-slate-900">{value}</p>
    </div>
  );
}

function RailGroupHeading({ title }: { title: string }) {
  return <p className={`${BUILDER_RAIL_GROUP_HEADING} pb-0.5`}>{title}</p>;
}

/**
 * 3J4C2: collapsible inspector section. Uses native <details> so the rail reads
 * as an ambient helper (collapsed by default) rather than a permanent diagnostics
 * ladder — no client state required.
 */
function InspectorDisclosure({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="group border-t border-slate-100 pt-2" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
        <span className={BUILDER_RAIL_GROUP_HEADING}>{title}</span>
        <ChevronDown
          className="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="mt-1.5">{children}</div>
    </details>
  );
}

function NextActionCard({
  guidance,
  onNavigate,
}: {
  guidance: ProposalBuilderGuidance;
  onNavigate?: (target: ProposalBuilderGuidanceTarget) => void;
}) {
  const action = guidance.nextAction;
  const canClick = !action.disabled && action.target !== "none" && Boolean(onNavigate);

  return (
    <div className={BUILDER_NEXT_ACTION_CARD}>
      <p className={BUILDER_NEXT_ACTION_KICKER}>Next action</p>
      <p className={BUILDER_NEXT_ACTION_TITLE}>{action.title}</p>
      <p className={BUILDER_NEXT_ACTION_DESC}>{action.description}</p>
      {canClick ? (
        <button
          type="button"
          onClick={() => onNavigate?.(action.target)}
          className={BUILDER_NEXT_ACTION_CTA}
        >
          {action.ctaLabel}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : (
        <button
          type="button"
          disabled
          className={BUILDER_NEXT_ACTION_CTA_DISABLED}
          title={action.disabledReason ?? undefined}
        >
          <Lock className="h-3.5 w-3.5" aria-hidden />
          {action.ctaLabel}
        </button>
      )}
    </div>
  );
}

function GuidedPath({
  guidance,
  onNavigate,
}: {
  guidance: ProposalBuilderGuidance;
  onNavigate?: (target: ProposalBuilderGuidanceTarget) => void;
}) {
  return (
    <div className="space-y-1">
      <ol className="space-y-0.5">
        {guidance.steps.map((step) => {
          const clickable = step.isClickableNow && step.target !== "none";
          const dotClass = builderGuidedStepDotClass(step.state);
          const pillClass = builderGuidedStepPillClass(step.state);

          const inner = (
            <>
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} aria-hidden />
              <span className="truncate text-xs font-medium text-slate-700">{step.label}</span>
              <span className={pillClass}>{step.shortStatusLabel}</span>
            </>
          );

          if (clickable && onNavigate) {
            return (
              <li key={step.id}>
                <button
                  type="button"
                  onClick={() => onNavigate(step.target)}
                  className={`${BUILDER_GUIDED_STEP_ROW} ${BUILDER_GUIDED_STEP_ROW_CLICKABLE}`}
                  title={step.description}
                >
                  {inner}
                </button>
              </li>
            );
          }

          return (
            <li key={step.id}>
              <div
                className={`${BUILDER_GUIDED_STEP_ROW} ${BUILDER_GUIDED_STEP_ROW_STATIC}`}
                title={step.lockedReason ?? step.description}
              >
                {inner}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default function ProposalBuilderSummaryRail({
  guidance = null,
  onGuidanceNavigate,
  measurementHandoff,
  catalogReadiness,
  templateReadiness,
  starterGraph,
  selectedOptionPricingStatus,
  pricingPolicyConfigured = false,
  pricingPolicyLoadComplete = false,
  isPersistedSnapshot = false,
  snapshotMeasurementDisplay,
  proposalId,
  quantityPreflightTrust = null,
}: ProposalBuilderSummaryRailProps) {
  const quantitiesDisplay = isPersistedSnapshot
    ? (snapshotMeasurementDisplay ?? "").trim() || "—"
    : measurementHandoff
      ? formatProposalQuantitiesDisplay(measurementHandoff.quantities)
      : "—";
  const measurementStatus = measurementHandoff?.proposalReady ? "Ready" : "Not ready";
  const catalogLabel = formatCatalogReadinessLabel(catalogReadiness);
  const templateLabel = formatProposalTemplateReadinessLabel(templateReadiness);
  const templateName = starterGraph?.template.name ?? "Starter template";
  const aboutText =
    (starterGraph?.template.description ?? "").trim() ||
    "Starter roof replacement template with Standard, Enhanced, and Premium customer-facing options.";
  const draftStatusLine = proposalId
    ? "Saved draft — building the job-specific proposal."
    : "No saved draft yet — previewing this job's proposal setup.";
  const quantityStatus = presentBuilderQuantityStatus(quantityPreflightTrust);

  const guardrailChecking = selectedOptionPricingStatus == null;
  const guardrailOutcome = selectedOptionPricingStatus?.guardrailOutcome ?? null;
  const guardrailPillKey = guardrailChecking
    ? "checking"
    : guardrailOutcome ?? "checking";
  const previewAvailable =
    guidance?.lifecycleLocks?.find((lock) => lock.actionId === "preview")?.state === "ready";
  const guardrailMessage = guardrailRailMessage(
    guardrailOutcome,
    guardrailChecking,
    previewAvailable
  );

  return (
    <div className={`${BUILDER_RAIL_CARD} space-y-3`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        Proposal helper
      </p>

      {guidance ? (
        <NextActionCard guidance={guidance} onNavigate={onGuidanceNavigate} />
      ) : null}

      {/* Pricing readiness stays visible — it explains inline blockers and draft readiness. */}
      <div className="space-y-1 border-t border-slate-100 pt-2">
        <RailGroupHeading title={BUILDER_RAIL_PRICING_CONFIDENCE_TITLE} />
        <RailStat
          label="Pricing policy"
          value={pricingPolicyRailStatusLabel(
            pricingPolicyLoadComplete,
            pricingPolicyConfigured
          )}
        />
        {selectedOptionPricingStatus ? (
          <>
            <RailStat
              label={BUILDER_RAIL_PRICING_STATUS_LABEL}
              value={formatOptionPricingTabStatusLabel(
                selectedOptionPricingStatus.pricingComplete
              )}
            />
            <RailStat
              label={BUILDER_RAIL_BLOCKING_LINES_LABEL}
              value={String(selectedOptionPricingStatus.blockingLineCount)}
            />
          </>
        ) : null}
        <div className={`${BUILDER_RAIL_STAT} flex items-center justify-between gap-2`}>
          <p className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-slate-500">
            {BUILDER_RAIL_GUARDRAIL_LABEL}
          </p>
          <span className={guardrailOutcomePillClass(guardrailPillKey)}>
            {guardrailRailStatusLabel(guardrailOutcome, guardrailChecking, previewAvailable)}
          </span>
        </div>
        {guardrailMessage ? (
          <p className="px-0.5 text-[11px] leading-snug text-slate-600">{guardrailMessage}</p>
        ) : null}
        {/* Phase 6: contractor-only quantity trust — informational, non-blocking. */}
        <div
          className="space-y-0.5"
          data-builder-quantity-status={quantityStatus.status}
          data-builder-quantity-status-severity={quantityStatus.severity}
          data-builder-quantity-status-block={String(quantityStatus.shouldBlock)}
          data-builder-quantity-status-autorefresh={String(
            quantityStatus.shouldAutoRefresh
          )}
        >
          <RailStat label={quantityStatus.label} value={quantityStatus.statusLabel} />
          <p className="px-0.5 text-[11px] leading-snug text-slate-500">
            {quantityStatus.helperText}
          </p>
        </div>
      </div>

      {/* Setup readiness facts and the guided path are ambient — collapsed by
          default so the inspector helps without becoming a dashboard. */}
      <InspectorDisclosure title={BUILDER_RAIL_SETUP_READINESS_TITLE}>
        <div className="space-y-1">
          <RailStat label="Measurement" value={measurementStatus} />
          <RailStat label="Quantities" value={quantitiesDisplay} />
          {measurementHandoff?.selectedLabel ? (
            <RailStat label="Record" value={measurementHandoff.selectedLabel} />
          ) : null}
          <div className={`${BUILDER_RAIL_STAT} flex items-center justify-between gap-2`}>
            <p className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-slate-500">
              Catalog
            </p>
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
              <span className={catalogReadinessStatusPillClass(catalogReadiness.state)}>
                {catalogLabel}
              </span>
              <span className="text-[11px] text-slate-600">{catalogReadiness.activeItemCount} active</span>
            </div>
          </div>
          <div className={`${BUILDER_RAIL_STAT} flex items-center justify-between gap-2`}>
            <p className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-slate-500">
              Template
            </p>
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
              <span className={proposalTemplateReadinessStatusPillClass(templateReadiness.status)}>
                {templateLabel}
              </span>
              <span className="truncate text-[11px] text-slate-600" title={templateName}>
                {templateName}
              </span>
            </div>
          </div>
          {isPersistedSnapshot ? (
            <p className="pt-0.5 text-[11px] leading-snug text-slate-500">
              Quantities reflect the saved proposal snapshot, not the live job measurement.
            </p>
          ) : null}
        </div>
      </InspectorDisclosure>

      {guidance ? (
        <InspectorDisclosure title={BUILDER_RAIL_GUIDED_PATH_TITLE}>
          <GuidedPath guidance={guidance} onNavigate={onGuidanceNavigate} />
        </InspectorDisclosure>
      ) : null}

      <InspectorDisclosure title="About this proposal">
        <p className="text-xs text-slate-400">{draftStatusLine}</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{aboutText}</p>
        {proposalId ? (
          <p className="mt-2 text-[10px] leading-snug text-slate-400">
            <span className="font-medium uppercase tracking-wide">Draft ID</span>{" "}
            <code className="break-all font-mono text-slate-500">{proposalId}</code>
          </p>
        ) : null}
      </InspectorDisclosure>

      <p className="pt-0.5 text-[10px] leading-snug text-slate-400">
        {resolveBuilderRailActionsNote(Boolean(previewAvailable))}
      </p>
    </div>
  );
}
