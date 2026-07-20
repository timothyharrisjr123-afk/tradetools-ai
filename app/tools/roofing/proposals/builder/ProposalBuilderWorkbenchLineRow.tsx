import type {
  WorkbenchAttentionLine,
  WorkbenchAttentionReason,
  WorkbenchScopeLine,
} from "@/app/lib/proposalBuilderWorkbenchEstimatePresenter";
import {
  WORKBENCH_EDIT_OPTION_CHIP_ENABLED,
  WORKBENCH_EDIT_OPTION_CHIP_SECONDARY,
  WORKBENCH_EDIT_QUANTITY_ACTION,
  WORKBENCH_EDIT_QUANTITY_LINK,
  WORKBENCH_REMOVE_FROM_OPTION_ACTION,
  WORKBENCH_SET_QUANTITY_ACTION,
  WORKBENCH_LINE_AMOUNT,
  WORKBENCH_LINE_AMOUNT_ATTENTION,
  WORKBENCH_LINE_AMOUNT_INCLUDED,
  WORKBENCH_LINE_GRID,
  WORKBENCH_LINE_NAME,
  WORKBENCH_LINE_QTY,
  WORKBENCH_LINE_QTY_VALUE,
  WORKBENCH_LINE_ROW,
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

function isIncludedAmount(label: string): boolean {
  return label === "Included" || label === "In package";
}

type ScopeLineRowProps = {
  variant: "scope";
  line: WorkbenchScopeLine;
  compact?: boolean;
  /** Use `div` when the parent already provides the listitem wrapper. */
  as?: "li" | "div";
  /** Hide contractor Details disclosure for document-like rows. */
  hideDetails?: boolean;
  /** Hide attention reason chips on primary rows (details / drawer hold context). */
  hideAttentionBadges?: boolean;
  /**
   * When true, omit the row’s own 3-col grid — parent supplies Included-estimate columns.
   * Renders name + quiet Edit quantity only in the item cell.
   */
  itemCellOnly?: boolean;
  onEditQuantity?: () => void;
  /** Defaults to Edit quantity; use Set quantity before a manual qty exists. */
  editQuantityLabel?: typeof WORKBENCH_SET_QUANTITY_ACTION | typeof WORKBENCH_EDIT_QUANTITY_ACTION;
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
          {!reviewMode
            ? line.reasons.map((reason) => (
                <HardBlockerReasonBadge key={reason} label={attentionReasonLabel(reason)} />
              ))
            : null}
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

function ScopeItemMeta({
  line,
  hideAttentionBadges,
  onEditQuantity,
  quantityActionLabel,
  onRemoveFromOption,
}: {
  line: WorkbenchScopeLine;
  hideAttentionBadges: boolean;
  onEditQuantity?: () => void;
  quantityActionLabel: string;
  onRemoveFromOption?: () => void;
}) {
  const hasAttention = line.attentionReasons.length > 0;
  const quietEdit =
    Boolean(onEditQuantity) && quantityActionLabel === WORKBENCH_EDIT_QUANTITY_ACTION;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <p className={WORKBENCH_LINE_NAME}>{line.name}</p>
      {hasAttention && !hideAttentionBadges
        ? line.attentionReasons.map((reason) => (
            <HardBlockerReasonBadge key={reason} label={attentionReasonLabel(reason)} />
          ))
        : null}
      {onEditQuantity ? (
        quietEdit ? (
          <button
            type="button"
            onClick={onEditQuantity}
            className={WORKBENCH_EDIT_QUANTITY_LINK}
            data-builder-edit-quantity
          >
            {WORKBENCH_EDIT_QUANTITY_ACTION}
          </button>
        ) : (
          <button
            type="button"
            onClick={onEditQuantity}
            className={WORKBENCH_EDIT_OPTION_CHIP_ENABLED}
            data-builder-set-quantity
          >
            {quantityActionLabel}
          </button>
        )
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
  const hideDetails = props.hideDetails === true;
  const hideAttentionBadges = props.hideAttentionBadges === true;
  const itemCellOnly = props.itemCellOnly === true;
  const hasAttention = line.attentionReasons.length > 0;
  const amountClass = hasAttention
    ? WORKBENCH_LINE_AMOUNT_ATTENTION
    : isIncludedAmount(line.amountLabel)
      ? WORKBENCH_LINE_AMOUNT_INCLUDED
      : WORKBENCH_LINE_AMOUNT;
  const quantityActionLabel = props.editQuantityLabel ?? WORKBENCH_EDIT_QUANTITY_ACTION;

  if (itemCellOnly) {
    return (
      <div className="min-w-0" data-builder-estimate-item-cell>
        <ScopeItemMeta
          line={line}
          hideAttentionBadges={hideAttentionBadges}
          onEditQuantity={onEditQuantity}
          quantityActionLabel={quantityActionLabel}
          onRemoveFromOption={onRemoveFromOption}
        />
        {hideDetails ? null : (
          <ProposalBuilderWorkbenchLineDetails detailMeta={line.detailMeta} />
        )}
      </div>
    );
  }

  return (
    <Row className={WORKBENCH_LINE_ROW}>
      <div className={WORKBENCH_LINE_GRID}>
        <div className="min-w-0">
          <ScopeItemMeta
            line={line}
            hideAttentionBadges={hideAttentionBadges}
            onEditQuantity={onEditQuantity}
            quantityActionLabel={quantityActionLabel}
            onRemoveFromOption={onRemoveFromOption}
          />
          <p className={`${WORKBENCH_LINE_QTY} mt-0.5 sm:hidden`}>
            Qty{" "}
            <span className={line.qtyUnresolved ? "text-slate-400" : WORKBENCH_LINE_QTY_VALUE}>
              {line.qtyLabel}
            </span>
          </p>
          {hideDetails ? null : (
            <ProposalBuilderWorkbenchLineDetails detailMeta={line.detailMeta} />
          )}
        </div>

        <p className={`${WORKBENCH_LINE_QTY} hidden sm:block`}>
          <span className={line.qtyUnresolved ? "text-slate-400" : WORKBENCH_LINE_QTY_VALUE}>
            {line.qtyLabel}
          </span>
        </p>

        <p className={amountClass}>{line.amountLabel}</p>
      </div>
    </Row>
  );
}
