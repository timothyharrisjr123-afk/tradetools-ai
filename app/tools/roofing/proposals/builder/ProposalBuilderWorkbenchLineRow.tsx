import type {
  WorkbenchAttentionLine,
  WorkbenchAttentionReason,
  WorkbenchScopeLine,
} from "@/app/lib/proposalBuilderWorkbenchEstimatePresenter";
import {
  WORKBENCH_EDIT_OPTION_CHIP_ENABLED,
  WORKBENCH_EDIT_OPTION_CHIP_SECONDARY,
  WORKBENCH_EDIT_QUANTITY_ACTION,
  WORKBENCH_REMOVE_FROM_OPTION_ACTION,
  WORKBENCH_LINE_AMOUNT,
  WORKBENCH_LINE_AMOUNT_ATTENTION,
  WORKBENCH_LINE_AMOUNT_INCLUDED,
  WORKBENCH_LINE_GRID,
  WORKBENCH_LINE_NAME,
  WORKBENCH_LINE_QTY,
  WORKBENCH_LINE_QTY_VALUE,
  WORKBENCH_LINE_ROW,
  WORKBENCH_SCOPE_REVIEW_PILL,
} from "./proposalBuilderConstants";
import ProposalBuilderWorkbenchLineDetails from "./ProposalBuilderWorkbenchLineDetails";

function attentionReasonLabel(reason: WorkbenchAttentionReason): string {
  switch (reason) {
    case "missing_catalog":
      return "Missing catalog";
    case "needs_quantity":
      return "Needs quantity";
    case "not_priced":
      return "Not priced";
    case "missing_pricing_view":
      return "Pricing unavailable";
  }
}

function HardBlockerReasonBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-amber-200/80 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">
      {label}
    </span>
  );
}

function ScopeReviewReasonBadge({ label }: { label: string }) {
  return <span className={WORKBENCH_SCOPE_REVIEW_PILL}>{label}</span>;
}

function isIncludedAmount(label: string): boolean {
  return label === "Included" || label === "In package";
}

type ScopeLineRowProps = {
  variant: "scope";
  line: WorkbenchScopeLine;
  compact?: boolean;
  /** Use `div` when the parent already provides the listitem wrapper. */
  as?: "li" | "div";
  onEditQuantity?: () => void;
  onRemoveFromOption?: () => void;
};

type HardBlockerLineRowProps = {
  variant: "hard_blocker";
  line: WorkbenchAttentionLine;
  compact?: boolean;
};

type ScopeReviewLineRowProps = {
  variant: "scope_review";
  line: WorkbenchAttentionLine;
  compact?: boolean;
};

type LegacyAttentionLineRowProps = {
  variant: "attention";
  line: WorkbenchAttentionLine;
  compact?: boolean;
};

type ProposalBuilderWorkbenchLineRowProps =
  | ScopeLineRowProps
  | HardBlockerLineRowProps
  | ScopeReviewLineRowProps
  | LegacyAttentionLineRowProps;

function AttentionLineContent({
  line,
  compact,
  reviewMode,
}: {
  line: WorkbenchAttentionLine;
  compact: boolean;
  reviewMode: boolean;
}) {
  return (
    <div className={compact ? "min-w-0" : WORKBENCH_LINE_GRID}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <p className={WORKBENCH_LINE_NAME}>{line.name}</p>
          {line.reasons.map((reason) =>
            reviewMode ? (
              <ScopeReviewReasonBadge key={reason} label={attentionReasonLabel(reason)} />
            ) : (
              <HardBlockerReasonBadge key={reason} label={attentionReasonLabel(reason)} />
            )
          )}
        </div>
        {!compact ? (
          <ProposalBuilderWorkbenchLineDetails detailMeta={line.detailMeta} />
        ) : null}
      </div>
      {!compact ? (
        <>
          <p className={WORKBENCH_LINE_QTY}>
            <span className="block text-[10px] uppercase tracking-wide text-slate-400">Qty</span>
            <span className={line.qtyUnresolved ? "text-slate-400" : WORKBENCH_LINE_QTY_VALUE}>
              {line.qtyLabel}
            </span>
          </p>
          <p
            className={
              isIncludedAmount(line.amountLabel)
                ? WORKBENCH_LINE_AMOUNT_INCLUDED
                : WORKBENCH_LINE_AMOUNT_ATTENTION
            }
          >
            {line.amountLabel}
          </p>
        </>
      ) : null}
    </div>
  );
}

export default function ProposalBuilderWorkbenchLineRow(
  props: ProposalBuilderWorkbenchLineRowProps
) {
  const compact = props.compact ?? false;

  if (
    props.variant === "attention" ||
    props.variant === "hard_blocker" ||
    props.variant === "scope_review"
  ) {
    const { line } = props;
    const reviewMode =
      props.variant === "scope_review" || line.attentionKind === "scope_review";

    return (
      <div className={compact ? "" : WORKBENCH_LINE_ROW}>
        <AttentionLineContent line={line} compact={compact} reviewMode={reviewMode} />
      </div>
    );
  }

  const { line, onEditQuantity, onRemoveFromOption } = props;
  const Row = props.as === "div" ? "div" : "li";
  const hasAttention = line.attentionReasons.length > 0;
  const amountClass = hasAttention
    ? WORKBENCH_LINE_AMOUNT_ATTENTION
    : isIncludedAmount(line.amountLabel)
      ? WORKBENCH_LINE_AMOUNT_INCLUDED
      : WORKBENCH_LINE_AMOUNT;

  return (
    <Row className={WORKBENCH_LINE_ROW}>
      <div className={WORKBENCH_LINE_GRID}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <p className={WORKBENCH_LINE_NAME}>{line.name}</p>
            {hasAttention
              ? line.attentionReasons.map((reason) => (
                  <HardBlockerReasonBadge key={reason} label={attentionReasonLabel(reason)} />
                ))
              : null}
            {onEditQuantity ? (
              <button
                type="button"
                onClick={onEditQuantity}
                className={WORKBENCH_EDIT_OPTION_CHIP_ENABLED}
              >
                {WORKBENCH_EDIT_QUANTITY_ACTION}
              </button>
            ) : null}
            {onRemoveFromOption ? (
              <button
                type="button"
                onClick={onRemoveFromOption}
                className={WORKBENCH_EDIT_OPTION_CHIP_SECONDARY}
              >
                {WORKBENCH_REMOVE_FROM_OPTION_ACTION}
              </button>
            ) : null}
          </div>
          <p className={`${WORKBENCH_LINE_QTY} mt-0.5 sm:hidden`}>
            Qty{" "}
            <span className={line.qtyUnresolved ? "text-slate-400" : WORKBENCH_LINE_QTY_VALUE}>
              {line.qtyLabel}
            </span>
          </p>
          <ProposalBuilderWorkbenchLineDetails detailMeta={line.detailMeta} />
        </div>

        <p className={`${WORKBENCH_LINE_QTY} hidden sm:block`}>
          <span className="block text-[10px] uppercase tracking-wide text-slate-400">Qty</span>
          <span className={line.qtyUnresolved ? "text-slate-400" : WORKBENCH_LINE_QTY_VALUE}>
            {line.qtyLabel}
          </span>
        </p>

        <p className={amountClass}>{line.amountLabel}</p>
      </div>
    </Row>
  );
}
