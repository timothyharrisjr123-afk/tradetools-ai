/**
 * Pure Proposal Builder guidance model (3J4B1).
 *
 * Single source of truth for guided step states, next required action,
 * lifecycle lock copy, and click targets. UI-independent — no React or DB types.
 */

export type ProposalBuilderGuidanceStepId =
  | "measurement"
  | "template"
  | "package"
  | "quantities"
  | "pricing"
  | "pages"
  | "preview"
  | "send"
  | "sign"
  | "payment"
  | "production";

export type ProposalBuilderGuidanceState =
  | "ready"
  | "selected"
  | "attention"
  | "blocked"
  | "locked"
  | "future";

export type ProposalBuilderGuidanceTarget =
  | "workspace:overview"
  | "workspace:options"
  | "workspace:sections"
  | "workspace:line-items"
  | "workspace:quantities"
  | "page:cover"
  | "page:estimate"
  | "page:terms"
  | "page:warranty"
  | "page:project-overview"
  | "page:project-photos"
  | "action:refresh-pricing"
  | "action:preview"
  | "action:send"
  | "action:sign"
  | "action:payment"
  | "action:production"
  | "none";

export type ProposalBuilderGuardrailStatus =
  | "pass"
  | "attention"
  | "blocked"
  | "unknown";

export type ProposalBuilderGuidanceInput = {
  hasPersistedProposal: boolean;
  selectedOptionId: string | null;
  templateReady: boolean;
  measurementReady: boolean;
  measurementStale: boolean;
  pricingComplete: boolean;
  blockingLineCount: number;
  guardrailStatus: ProposalBuilderGuardrailStatus;
  hasProposalPages: boolean;
  hasPlaceholderPages: boolean;
  previewEnabled: boolean;
  sendEnabled: boolean;
  signEnabled: boolean;
  paymentEnabled: boolean;
  productionEnabled: boolean;
};

export type ProposalBuilderGuidanceStep = {
  id: ProposalBuilderGuidanceStepId;
  label: string;
  state: ProposalBuilderGuidanceState;
  shortStatusLabel: string;
  description: string;
  target: ProposalBuilderGuidanceTarget;
  lockedReason: string | null;
  isClickableNow: boolean;
};

export type ProposalBuilderNextActionId =
  | "measurement_stale"
  | "choose_package"
  | "resolve_pricing_blockers"
  | "review_profitability"
  | "review_proposal_pages"
  | "open_customer_preview"
  | "ready_for_preview"
  | "review_proposal";

export type ProposalBuilderNextAction = {
  id: ProposalBuilderNextActionId;
  title: string;
  description: string;
  ctaLabel: string;
  target: ProposalBuilderGuidanceTarget;
  priority: number;
  disabled: boolean;
  disabledReason: string | null;
};

export type ProposalBuilderLifecycleActionId =
  | "preview"
  | "send"
  | "sign"
  | "payment"
  | "production";

export type ProposalBuilderLifecycleLock = {
  actionId: ProposalBuilderLifecycleActionId;
  label: string;
  state: ProposalBuilderGuidanceState;
  lockedReason: string | null;
  unlockSummary: string;
  target: ProposalBuilderGuidanceTarget;
};

export type ProposalBuilderGuidance = {
  steps: ProposalBuilderGuidanceStep[];
  nextAction: ProposalBuilderNextAction;
  lifecycleLocks: ProposalBuilderLifecycleLock[];
  previewUnlockSummary: string;
  isReadyForPreviewWhenEnabled: boolean;
};

const STEP_LABELS: Record<ProposalBuilderGuidanceStepId, string> = {
  measurement: "Measurement",
  template: "Template",
  package: "Package",
  quantities: "Quantities",
  pricing: "Line Items / Pricing",
  pages: "Pages",
  preview: "Preview",
  send: "Send",
  sign: "Sign / Approval",
  payment: "Payment",
  production: "Production",
};

const LIFECYCLE_LABELS: Record<ProposalBuilderLifecycleActionId, string> = {
  preview: "Preview",
  send: "Send",
  sign: "Sign / Approval",
  payment: "Payment",
  production: "Production",
};

const PREVIEW_ROADMAP_LOCK_COPY =
  "Preview is locked in this roadmap phase until customer preview is enabled.";

export const CUSTOMER_PREVIEW_READY_COPY = "Customer preview is ready.";
export const CONTRACTOR_PREVIEW_REVIEW_COPY =
  "Draft preview for contractor review only — pricing or scope is not customer-ready.";
export const CONTRACTOR_PREVIEW_REVIEW_REASON =
  "Draft is not customer-ready — resolve blockers before sending.";

function hasSelectedPackage(input: ProposalBuilderGuidanceInput): boolean {
  return (input.selectedOptionId ?? "").trim().length > 0;
}

function pagesReady(input: ProposalBuilderGuidanceInput): boolean {
  return input.hasProposalPages && !input.hasPlaceholderPages;
}

function pricingHardComplete(input: ProposalBuilderGuidanceInput): boolean {
  return input.pricingComplete && input.blockingLineCount === 0;
}

function deriveIsReadyForPreviewWhenEnabled(input: ProposalBuilderGuidanceInput): boolean {
  if (!input.measurementReady || input.measurementStale) return false;
  if (!input.templateReady) return false;
  if (!hasSelectedPackage(input)) return false;
  if (!pricingHardComplete(input)) return false;
  if (input.guardrailStatus === "attention" || input.guardrailStatus === "blocked") {
    return false;
  }
  if (!pagesReady(input)) return false;
  return true;
}

function derivePreviewUnlockSummary(input: ProposalBuilderGuidanceInput): string {
  if (input.previewEnabled) {
    if (deriveIsReadyForPreviewWhenEnabled(input)) {
      return CUSTOMER_PREVIEW_READY_COPY;
    }
    return CONTRACTOR_PREVIEW_REVIEW_COPY;
  }

  const blockers: string[] = [];

  if (!input.measurementReady) {
    blockers.push("save a proposal-ready measurement");
  } else if (input.measurementStale) {
    blockers.push("refresh draft pricing after the measurement change");
  }

  if (!input.templateReady) {
    blockers.push("complete template setup");
  }

  if (!hasSelectedPackage(input)) {
    blockers.push("choose a customer-facing package");
  }

  if (input.blockingLineCount > 0) {
    blockers.push(
      `resolve ${input.blockingLineCount} pricing blocker${input.blockingLineCount === 1 ? "" : "s"}`
    );
  } else if (!input.pricingComplete) {
    blockers.push("complete line item pricing");
  }

  if (input.guardrailStatus === "attention") {
    blockers.push("review contractor-only profitability");
  } else if (input.guardrailStatus === "blocked") {
    blockers.push("resolve profitability guardrail blockers");
  }

  if (!input.hasProposalPages) {
    blockers.push("add proposal pages");
  } else if (input.hasPlaceholderPages) {
    blockers.push("replace placeholder proposal pages with content");
  }

  if (blockers.length === 0) {
    return PREVIEW_ROADMAP_LOCK_COPY;
  }

  return `Preview unlocks when you ${blockers.join(", ")}.`;
}

function derivePreviewLockedReason(input: ProposalBuilderGuidanceInput): string {
  if (input.previewEnabled) {
    if (deriveIsReadyForPreviewWhenEnabled(input)) {
      return "";
    }
    return CONTRACTOR_PREVIEW_REVIEW_REASON;
  }

  if (input.blockingLineCount > 0) {
    return `${input.blockingLineCount} line item${input.blockingLineCount === 1 ? "" : "s"} need pricing or quantity attention before Preview can unlock.`;
  }

  return PREVIEW_ROADMAP_LOCK_COPY;
}

function deriveMeasurementStep(input: ProposalBuilderGuidanceInput): ProposalBuilderGuidanceStep {
  let state: ProposalBuilderGuidanceState;
  let shortStatusLabel: string;
  let description: string;
  let target: ProposalBuilderGuidanceTarget;
  let lockedReason: string | null = null;
  let isClickableNow = false;

  if (!input.measurementReady) {
    state = "blocked";
    shortStatusLabel = "Blocked";
    description = "Save a proposal-ready measurement on the Job Card before building.";
    target = "none";
    lockedReason = "Measurement is not proposal-ready.";
  } else if (input.measurementStale) {
    state = "attention";
    shortStatusLabel = "Changed";
    description = "The job measurement changed since this draft pricing snapshot was saved.";
    target = "action:refresh-pricing";
    isClickableNow = input.hasPersistedProposal;
  } else {
    state = "ready";
    shortStatusLabel = "Ready";
    description = "Measurement is ready for this proposal.";
    target = "workspace:quantities";
    isClickableNow = true;
  }

  return {
    id: "measurement",
    label: STEP_LABELS.measurement,
    state,
    shortStatusLabel,
    description,
    target,
    lockedReason,
    isClickableNow,
  };
}

function deriveTemplateStep(input: ProposalBuilderGuidanceInput): ProposalBuilderGuidanceStep {
  if (input.templateReady) {
    return {
      id: "template",
      label: STEP_LABELS.template,
      state: "ready",
      shortStatusLabel: "Ready",
      description: "Template is installed and ready for this proposal.",
      target: "workspace:sections",
      lockedReason: null,
      isClickableNow: true,
    };
  }

  return {
    id: "template",
    label: STEP_LABELS.template,
    state: "blocked",
    shortStatusLabel: "Blocked",
    description: "Install and price the starter proposal template before continuing.",
    target: "none",
    lockedReason: "Template setup is incomplete.",
    isClickableNow: false,
  };
}

function derivePackageStep(input: ProposalBuilderGuidanceInput): ProposalBuilderGuidanceStep {
  if (hasSelectedPackage(input)) {
    return {
      id: "package",
      label: STEP_LABELS.package,
      state: "selected",
      shortStatusLabel: "Selected",
      description: "A customer-facing package is selected for this proposal.",
      target: "workspace:options",
      lockedReason: null,
      isClickableNow: true,
    };
  }

  return {
    id: "package",
    label: STEP_LABELS.package,
    state: "attention",
    shortStatusLabel: "Choose",
    description: "Pick the customer-facing option your homeowner will see.",
    target: "page:estimate",
    lockedReason: null,
    isClickableNow: true,
  };
}

function deriveQuantitiesStep(input: ProposalBuilderGuidanceInput): ProposalBuilderGuidanceStep {
  if (!input.measurementReady) {
    return {
      id: "quantities",
      label: STEP_LABELS.quantities,
      state: "blocked",
      shortStatusLabel: "Blocked",
      description: "Quantities depend on a proposal-ready measurement.",
      target: "none",
      lockedReason: "Measurement is not proposal-ready.",
      isClickableNow: false,
    };
  }

  if (input.measurementStale) {
    return {
      id: "quantities",
      label: STEP_LABELS.quantities,
      state: "attention",
      shortStatusLabel: "Changed",
      description: "Review quantity details and refresh draft pricing if needed.",
      target: "workspace:quantities",
      lockedReason: null,
      isClickableNow: true,
    };
  }

  return {
    id: "quantities",
    label: STEP_LABELS.quantities,
    state: "ready",
    shortStatusLabel: "Ready",
    description: "Measurement quantities are available for review.",
    target: "workspace:quantities",
    lockedReason: null,
    isClickableNow: true,
  };
}

function derivePricingStep(input: ProposalBuilderGuidanceInput): ProposalBuilderGuidanceStep {
  const hasBlockers = input.blockingLineCount > 0 || !input.pricingComplete;

  if (hasBlockers) {
    return {
      id: "pricing",
      label: STEP_LABELS.pricing,
      state: "blocked",
      shortStatusLabel: "Blocked",
      description:
        input.blockingLineCount > 0
          ? `${input.blockingLineCount} line item${input.blockingLineCount === 1 ? "" : "s"} need pricing or quantity attention.`
          : "Line item pricing is incomplete for the selected package.",
      target: "workspace:line-items",
      lockedReason:
        input.blockingLineCount > 0
          ? `${input.blockingLineCount} pricing blocker${input.blockingLineCount === 1 ? "" : "s"} remain.`
          : "Pricing is incomplete.",
      isClickableNow: true,
    };
  }

  if (input.guardrailStatus === "attention") {
    return {
      id: "pricing",
      label: STEP_LABELS.pricing,
      state: "attention",
      shortStatusLabel: "Review",
      description: "Pricing is complete, but contractor-only profitability needs review.",
      target: "workspace:line-items",
      lockedReason: null,
      isClickableNow: true,
    };
  }

  return {
    id: "pricing",
    label: STEP_LABELS.pricing,
    state: "ready",
    shortStatusLabel: "Ready",
    description: "Line item pricing is complete for the selected package.",
    target: "workspace:line-items",
    lockedReason: null,
    isClickableNow: true,
  };
}

function derivePagesStep(input: ProposalBuilderGuidanceInput): ProposalBuilderGuidanceStep {
  if (!input.hasProposalPages) {
    return {
      id: "pages",
      label: STEP_LABELS.pages,
      state: "future",
      shortStatusLabel: "Soon",
      description: "Proposal pages will appear here once page content is available.",
      target: "page:estimate",
      lockedReason: "Proposal pages are not available yet.",
      isClickableNow: false,
    };
  }

  if (input.hasPlaceholderPages) {
    return {
      id: "pages",
      label: STEP_LABELS.pages,
      state: "attention",
      shortStatusLabel: "Needs content",
      description: "Some customer-facing pages are placeholders or need content.",
      target: "page:terms",
      lockedReason: null,
      isClickableNow: true,
    };
  }

  return {
    id: "pages",
    label: STEP_LABELS.pages,
    state: "ready",
    shortStatusLabel: "Ready",
    description: "Customer-facing proposal pages are ready for review.",
    target: "page:estimate",
    lockedReason: null,
    isClickableNow: true,
  };
}

function derivePreviewLifecycleStep(
  input: ProposalBuilderGuidanceInput,
  previewUnlockSummary: string,
  previewLockedReason: string,
  isReadyForPreviewWhenEnabled: boolean
): ProposalBuilderGuidanceStep {
  if (!input.previewEnabled) {
    return deriveLifecycleStep(
      "preview",
      false,
      previewLockedReason,
      previewUnlockSummary,
      "action:preview"
    );
  }

  if (isReadyForPreviewWhenEnabled) {
    return {
      id: "preview",
      label: STEP_LABELS.preview,
      state: "ready",
      shortStatusLabel: "Ready",
      description: CUSTOMER_PREVIEW_READY_COPY,
      target: "action:preview",
      lockedReason: null,
      isClickableNow: true,
    };
  }

  return {
    id: "preview",
    label: STEP_LABELS.preview,
    state: "attention",
    shortStatusLabel: "Review",
    description: CONTRACTOR_PREVIEW_REVIEW_COPY,
    target: "action:preview",
    lockedReason: CONTRACTOR_PREVIEW_REVIEW_REASON,
    isClickableNow: true,
  };
}

function derivePreviewLifecycleLock(
  input: ProposalBuilderGuidanceInput,
  previewUnlockSummary: string,
  previewLockedReason: string,
  isReadyForPreviewWhenEnabled: boolean
): ProposalBuilderLifecycleLock {
  if (!input.previewEnabled) {
    return deriveLifecycleLock(
      "preview",
      false,
      previewLockedReason,
      previewUnlockSummary,
      "action:preview"
    );
  }

  if (isReadyForPreviewWhenEnabled) {
    return {
      actionId: "preview",
      label: LIFECYCLE_LABELS.preview,
      state: "ready",
      lockedReason: null,
      unlockSummary: CUSTOMER_PREVIEW_READY_COPY,
      target: "action:preview",
    };
  }

  return {
    actionId: "preview",
    label: LIFECYCLE_LABELS.preview,
    state: "attention",
    lockedReason: CONTRACTOR_PREVIEW_REVIEW_REASON,
    unlockSummary: CONTRACTOR_PREVIEW_REVIEW_COPY,
    target: "action:preview",
  };
}

function deriveLifecycleStep(
  id: Extract<
    ProposalBuilderGuidanceStepId,
    "preview" | "send" | "sign" | "payment" | "production"
  >,
  enabled: boolean,
  lockedReason: string,
  unlockSummary: string,
  target: ProposalBuilderGuidanceTarget
): ProposalBuilderGuidanceStep {
  if (enabled) {
    return {
      id,
      label: STEP_LABELS[id],
      state: "ready",
      shortStatusLabel: "Ready",
      description: `${STEP_LABELS[id]} is available.`,
      target,
      lockedReason: null,
      isClickableNow: true,
    };
  }

  if (id === "production") {
    return {
      id,
      label: STEP_LABELS[id],
      state: "future",
      shortStatusLabel: "Future",
      description: "Production handoff begins from the Job Card after approval or payment.",
      target: "action:production",
      lockedReason: "Begins from the Job Card after approval/payment.",
      isClickableNow: false,
    };
  }

  return {
    id,
    label: STEP_LABELS[id],
    state: "locked",
    shortStatusLabel: "Locked",
    description: unlockSummary,
    target,
    lockedReason,
    isClickableNow: false,
  };
}

function deriveLifecycleLock(
  actionId: ProposalBuilderLifecycleActionId,
  enabled: boolean,
  lockedReason: string,
  unlockSummary: string,
  target: ProposalBuilderGuidanceTarget
): ProposalBuilderLifecycleLock {
  return {
    actionId,
    label: LIFECYCLE_LABELS[actionId],
    state: enabled ? "ready" : actionId === "production" ? "future" : "locked",
    lockedReason: enabled ? null : lockedReason,
    unlockSummary,
    target,
  };
}

function deriveNextAction(input: ProposalBuilderGuidanceInput): ProposalBuilderNextAction {
  if (input.measurementReady && input.measurementStale) {
    return {
      id: "measurement_stale",
      title: "Measurement changed",
      description: "Pricing uses an older saved snapshot.",
      ctaLabel: "Refresh draft pricing",
      target: "action:refresh-pricing",
      priority: 1,
      disabled: !input.hasPersistedProposal,
      disabledReason: input.hasPersistedProposal
        ? null
        : "Save a proposal draft before refreshing pricing.",
    };
  }

  if (!hasSelectedPackage(input)) {
    return {
      id: "choose_package",
      title: "Choose a package",
      description: "Pick the customer-facing option for this proposal.",
      ctaLabel: "Choose package",
      target: "page:estimate",
      priority: 2,
      disabled: false,
      disabledReason: null,
    };
  }

  if (input.blockingLineCount > 0 || !input.pricingComplete) {
    const count = Math.max(input.blockingLineCount, input.pricingComplete ? 0 : 1);
    const blockerCount = input.blockingLineCount > 0 ? input.blockingLineCount : count;
    return {
      id: "resolve_pricing_blockers",
      title: "Resolve pricing blockers",
      description: input.previewEnabled
        ? `${blockerCount} line item${blockerCount === 1 ? "" : "s"} need pricing or quantity attention before this draft is customer-ready.`
        : `${blockerCount} line item${blockerCount === 1 ? "" : "s"} need pricing or quantity attention before Preview can unlock.`,
      ctaLabel: "Open Line Items",
      target: "workspace:line-items",
      priority: 3,
      disabled: false,
      disabledReason: null,
    };
  }

  if (input.guardrailStatus === "attention") {
    return {
      id: "review_profitability",
      title: "Review profitability",
      description: "This option needs contractor-only pricing review before it is ready.",
      ctaLabel: "Review pricing",
      target: "workspace:line-items",
      priority: 4,
      disabled: false,
      disabledReason: null,
    };
  }

  if (input.previewEnabled) {
    return {
      id: "open_customer_preview",
      title: "Preview customer view",
      description: input.hasPlaceholderPages
        ? "Review this draft as the customer will see it. Empty pages can be filled afterward. Send stays locked."
        : "Review this draft as the customer will see it. Send stays locked.",
      ctaLabel: "Open Preview",
      target: "action:preview",
      priority: 5,
      disabled: false,
      disabledReason: null,
    };
  }

  if (input.hasPlaceholderPages) {
    return {
      id: "review_proposal_pages",
      title: "Review proposal pages",
      description: "Some customer-facing pages are placeholders or need content.",
      ctaLabel: "Review pages",
      target: "page:terms",
      priority: 6,
      disabled: false,
      disabledReason: null,
    };
  }

  if (deriveIsReadyForPreviewWhenEnabled(input) && !input.previewEnabled) {
    return {
      id: "ready_for_preview",
      title: "Ready for Preview",
      description:
        "Required Builder checks are complete. Preview remains locked in this roadmap phase.",
      ctaLabel: "Preview locked",
      target: "action:preview",
      priority: 7,
      disabled: true,
      disabledReason: PREVIEW_ROADMAP_LOCK_COPY,
    };
  }

  return {
    id: "review_proposal",
    title: "Review proposal",
    description: "Check the Builder details before continuing.",
    ctaLabel: "Open Overview",
    target: "workspace:overview",
    priority: 8,
    disabled: false,
    disabledReason: null,
  };
}

export function deriveProposalBuilderGuidance(
  input: ProposalBuilderGuidanceInput
): ProposalBuilderGuidance {
  const previewLockedReason = derivePreviewLockedReason(input);
  const previewUnlockSummary = derivePreviewUnlockSummary(input);
  const isReadyForPreviewWhenEnabled = deriveIsReadyForPreviewWhenEnabled(input);

  const previewStep = derivePreviewLifecycleStep(
    input,
    previewUnlockSummary,
    previewLockedReason,
    isReadyForPreviewWhenEnabled
  );

  const sendStep = deriveLifecycleStep(
    "send",
    input.sendEnabled,
    "Available after Preview.",
    input.sendEnabled ? "Send is available." : "Send unlocks after Preview.",
    "action:send"
  );

  const signStep = deriveLifecycleStep(
    "sign",
    input.signEnabled,
    "Available after Send.",
    input.signEnabled ? "Sign / Approval is available." : "Sign / Approval unlocks after Send.",
    "action:sign"
  );

  const paymentStep = deriveLifecycleStep(
    "payment",
    input.paymentEnabled,
    "Available after Sign / Approval.",
    input.paymentEnabled
      ? "Payment is available."
      : "Payment unlocks after Sign / Approval.",
    "action:payment"
  );

  const productionStep = deriveLifecycleStep(
    "production",
    input.productionEnabled,
    "Begins from the Job Card after approval/payment.",
    input.productionEnabled
      ? "Production handoff is available from the Job Card."
      : "Production handoff begins from the Job Card after approval or payment.",
    "action:production"
  );

  const lifecycleLocks: ProposalBuilderLifecycleLock[] = [
    derivePreviewLifecycleLock(
      input,
      previewUnlockSummary,
      previewLockedReason,
      isReadyForPreviewWhenEnabled
    ),
    deriveLifecycleLock(
      "send",
      input.sendEnabled,
      "Available after Preview.",
      input.sendEnabled ? "Send is available." : "Send unlocks after Preview.",
      "action:send"
    ),
    deriveLifecycleLock(
      "sign",
      input.signEnabled,
      "Available after Send.",
      input.signEnabled ? "Sign / Approval is available." : "Sign / Approval unlocks after Send.",
      "action:sign"
    ),
    deriveLifecycleLock(
      "payment",
      input.paymentEnabled,
      "Available after Sign / Approval.",
      input.paymentEnabled
        ? "Payment is available."
        : "Payment unlocks after Sign / Approval.",
      "action:payment"
    ),
    deriveLifecycleLock(
      "production",
      input.productionEnabled,
      "Begins from the Job Card after approval/payment.",
      input.productionEnabled
        ? "Production handoff is available from the Job Card."
        : "Production handoff begins from the Job Card after approval or payment.",
      "action:production"
    ),
  ];

  return {
    steps: [
      deriveMeasurementStep(input),
      deriveTemplateStep(input),
      derivePackageStep(input),
      deriveQuantitiesStep(input),
      derivePricingStep(input),
      derivePagesStep(input),
      previewStep,
      sendStep,
      signStep,
      paymentStep,
      productionStep,
    ],
    nextAction: deriveNextAction(input),
    lifecycleLocks,
    previewUnlockSummary,
    isReadyForPreviewWhenEnabled,
  };
}
