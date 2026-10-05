/**
 * Core Flow 1 / Slice 2 — Job Card Overview next step (pure).
 *
 * Derives the one contextual "what matters next" for the Overview hero from
 * reads the Job Card already has: the situation, the lifecycle primary, the
 * current measurement, and the proposal list. It reads no data and writes
 * nothing; every action is a navigation or an existing workspace opener.
 *
 * Measurement is not a universal prerequisite: whether a proposal path needs
 * one is an input (`JobCardProposalPath`), never assumed here.
 */

import type { JobCardOverviewPrimaryAction } from "@/app/lib/jobCardForwardLifecycleAction";
import type { JobCardOverviewStateView } from "@/app/lib/jobCardOverviewComposition";
import type { JobCardOverviewHeroIcon } from "@/app/lib/jobCardOverviewPresentation";
import {
  JOB_CARD_SITUATION_PROPOSAL_FACTS_UNAVAILABLE,
  type JobCardOverviewSituationKind,
} from "@/app/lib/jobCardOverviewSituation";

export type JobCardProposalPath = {
  /** "required": this path prices from a measurement; "optional": it can be quoted without one. */
  measurement: "required" | "optional";
};

/**
 * Temporary compatibility: today's only proposal path is the measured reroof
 * starter. Repair, fixed-price, and known-scope paths pass "optional".
 */
export const CURRENT_JOB_PROPOSAL_PATH: JobCardProposalPath = { measurement: "required" };

export type JobCardNextStepMeasurement =
  | { status: "loading" }
  | { status: "error" }
  | { status: "none" }
  /** Saved measurements exist but none is current for this job. */
  | { status: "not_current" }
  | { status: "incomplete"; quantityLine: string; editable: boolean }
  | { status: "ready"; quantityLine: string; savedOn: string | null };

export type JobCardNextStepWorkspace = "measurements" | "proposals" | "attachments";

export type JobCardNextStepRetryRead = "job" | "measurements" | "proposals" | "proposal_facts";

export type JobCardNextStepCommand =
  /** Capture lives in the Measurements workspace; it opens there. */
  | { type: "open_measurement_capture"; mode: "add" | "edit"; workspace: "measurements" }
  | { type: "open_prepare_proposal" }
  | { type: "open_workspace"; tab: JobCardNextStepWorkspace }
  | { type: "navigate"; href: string }
  | { type: "retry"; read: JobCardNextStepRetryRead };

export type JobCardNextStepAction = {
  id: string;
  label: string;
  command: JobCardNextStepCommand;
};

export type JobCardNextStepKind =
  | "loading"
  | "unavailable"
  | "add_measurement"
  | "finish_measurement"
  | "choose_measurement"
  | "prepare_proposal"
  | "review_proposal"
  | "proposal_sent"
  /** The lifecycle resolver owns the primary (approve, schedule, start, complete…). */
  | "lifecycle"
  /** The situation copy stands alone; nothing for this viewer to do here. */
  | "situation";

export type JobCardNextStep = {
  kind: JobCardNextStepKind;
  status: "loading" | "ready" | "error";
  /** Replaces the situation headline; null keeps the situation's own copy. */
  title: string | null;
  context: string[];
  primary: JobCardNextStepAction | null;
  secondary: JobCardNextStepAction[];
  /** Where the work continues, when that is a Job Card workspace. */
  workspace: JobCardNextStepWorkspace | null;
  lifecycleOwnsPrimary: boolean;
  /** The context already states the measurement; other regions should not repeat it. */
  contextShowsMeasurement: boolean;
  look: { tone: "active" | "quiet"; icon: JobCardOverviewHeroIcon } | null;
  /** Which read decided this step (diagnostics and tests). */
  reason: string;
};

export type JobCardNextStepInput = {
  situationKind: JobCardOverviewSituationKind;
  jobRead: "loading" | "ready" | "error";
  lifecyclePrimary: JobCardOverviewPrimaryAction | null;
  proposalPath: JobCardProposalPath;
  measurement: JobCardNextStepMeasurement;
  /** "error" only when the read failed with no last-known proposals. */
  proposalsRead: "loading" | "ready" | "error";
  draft: { previewHref: string; builderHref: string } | null;
  canAuthorProposals: boolean;
  suppressCommercial: boolean;
};

export const JOB_CARD_NEXT_STEP_RETRY_CONTEXT = "Check your connection and try again." as const;

const ADD_MEASUREMENT: JobCardNextStepAction = {
  id: "add_measurement",
  label: "Add measurement",
  command: { type: "open_measurement_capture", mode: "add", workspace: "measurements" },
};
const PREPARE_PROPOSAL: JobCardNextStepAction = {
  id: "prepare_proposal",
  label: "Prepare proposal",
  command: { type: "open_prepare_proposal" },
};
const ADD_PHOTOS: JobCardNextStepAction = {
  id: "add_photos",
  label: "Add photos",
  command: { type: "open_workspace", tab: "attachments" },
};
const VIEW_MEASUREMENT: JobCardNextStepAction = {
  id: "view_measurement",
  label: "View measurement",
  command: { type: "open_workspace", tab: "measurements" },
};
const REVIEW_MEASUREMENTS: JobCardNextStepAction = {
  id: "review_measurements",
  label: "Review measurements",
  command: { type: "open_workspace", tab: "measurements" },
};
const VIEW_PROPOSALS: JobCardNextStepAction = {
  id: "view_proposals",
  label: "View proposals",
  command: { type: "open_workspace", tab: "proposals" },
};

function step(
  partial: Pick<JobCardNextStep, "kind" | "reason"> & Partial<JobCardNextStep>
): JobCardNextStep {
  return {
    status: "ready",
    title: null,
    context: [],
    primary: null,
    secondary: [],
    workspace: null,
    lifecycleOwnsPrimary: false,
    contextShowsMeasurement: false,
    look: null,
    ...partial,
  };
}

function unavailable(
  read: JobCardNextStepRetryRead,
  title: string,
  reason: string
): JobCardNextStep {
  return step({
    kind: "unavailable",
    status: "error",
    title,
    context: [JOB_CARD_NEXT_STEP_RETRY_CONTEXT],
    primary: { id: `retry_${read}`, label: "Try again", command: { type: "retry", read } },
    look: { tone: "quiet", icon: "unknown" },
    reason,
  });
}

function measurementContext(m: { quantityLine: string; savedOn?: string | null }): string {
  return ["Measurement", m.quantityLine, m.savedOn ? `Saved ${m.savedOn}` : null]
    .filter(Boolean)
    .join(" · ");
}

function readyToPrepare(
  measurement: Extract<JobCardNextStepMeasurement, { status: "ready" }>,
  reason: string
): JobCardNextStep {
  return step({
    kind: "prepare_proposal",
    title: "Ready to prepare the proposal",
    context: [measurementContext(measurement)],
    primary: PREPARE_PROPOSAL,
    secondary: [VIEW_MEASUREMENT, ADD_PHOTOS],
    contextShowsMeasurement: true,
    look: { tone: "active", icon: "proposal" },
    reason,
  });
}

function finishMeasurementAction(editable: boolean): JobCardNextStepAction {
  return editable
    ? {
        id: "finish_measurement",
        label: "Finish measurement",
        command: { type: "open_measurement_capture", mode: "edit", workspace: "measurements" },
      }
    : { ...REVIEW_MEASUREMENTS, id: "review_measurement", label: "Review measurement" };
}

/** Before any proposal exists: measurement and proposal preparation. */
function resolvePreProposalStep(input: JobCardNextStepInput): JobCardNextStep {
  const { measurement } = input;
  if (input.proposalsRead === "error") {
    return unavailable("proposals", "Couldn't load this job's proposals", "proposals_read_failed");
  }
  if (!input.canAuthorProposals) {
    return step({ kind: "situation", reason: "viewer_cannot_author_proposals" });
  }
  if (measurement.status === "loading") {
    return step({ kind: "loading", status: "loading", reason: "measurement_read_pending" });
  }
  if (measurement.status === "error") {
    return unavailable("measurements", "Couldn't load this job's measurement", "measurement_read_failed");
  }
  if (measurement.status === "ready") {
    return readyToPrepare(measurement, "measurement_ready");
  }

  if (input.proposalPath.measurement === "optional") {
    const measurementSecondary =
      measurement.status === "none"
        ? ADD_MEASUREMENT
        : measurement.status === "incomplete"
          ? finishMeasurementAction(measurement.editable)
          : REVIEW_MEASUREMENTS;
    return step({
      kind: "prepare_proposal",
      title: "Ready to prepare the proposal",
      primary: PREPARE_PROPOSAL,
      secondary: [ADD_PHOTOS, measurementSecondary],
      look: { tone: "active", icon: "proposal" },
      reason: `measurement_optional_${measurement.status}`,
    });
  }

  if (measurement.status === "incomplete") {
    return step({
      kind: "finish_measurement",
      title: "Finish the measurement",
      context: [measurementContext(measurement), "Some quantities are still missing."],
      primary: finishMeasurementAction(measurement.editable),
      secondary: [PREPARE_PROPOSAL, ADD_PHOTOS],
      workspace: "measurements",
      contextShowsMeasurement: true,
      look: { tone: "active", icon: "measurement" },
      reason: "measurement_incomplete",
    });
  }
  if (measurement.status === "not_current") {
    return step({
      kind: "choose_measurement",
      title: "Choose this job's measurement",
      context: ["Saved measurements exist, but none is set as current."],
      primary: REVIEW_MEASUREMENTS,
      secondary: [PREPARE_PROPOSAL, ADD_PHOTOS],
      workspace: "measurements",
      look: { tone: "active", icon: "measurement" },
      reason: "measurement_not_current",
    });
  }
  return step({
    kind: "add_measurement",
    title: "Get this job ready for a proposal",
    context: ["Measure the roof first, or prepare a proposal now."],
    primary: ADD_MEASUREMENT,
    secondary: [PREPARE_PROPOSAL, ADD_PHOTOS],
    workspace: "measurements",
    look: { tone: "active", icon: "measurement" },
    reason: "measurement_required_none",
  });
}

export function resolveJobCardNextStep(input: JobCardNextStepInput): JobCardNextStep {
  if (input.jobRead === "error") {
    return unavailable("job", "Couldn't load this job", "job_read_failed");
  }
  if (input.lifecyclePrimary) {
    return step({ kind: "lifecycle", lifecycleOwnsPrimary: true, reason: "lifecycle_resolver" });
  }
  const kind = input.situationKind;
  if (kind === "loading") {
    if (input.jobRead === "ready" && input.proposalsRead === "error") {
      return unavailable("proposals", "Couldn't load this job's proposals", "proposals_read_failed");
    }
    return step({ kind: "loading", status: "loading", reason: "situation_pending" });
  }
  if (input.suppressCommercial) {
    return step({ kind: "situation", reason: "commercial_suppressed" });
  }
  if (kind === "proposal_facts_unavailable") {
    return unavailable("proposal_facts", JOB_CARD_SITUATION_PROPOSAL_FACTS_UNAVAILABLE, "acceptance_read_failed");
  }
  if (kind === "intake" || kind === "proposal_none") {
    return resolvePreProposalStep(input);
  }
  if (kind === "proposal_draft") {
    if (!input.draft) {
      return step({ kind: "situation", secondary: [VIEW_PROPOSALS], workspace: "proposals", reason: "draft_href_missing" });
    }
    return step({
      kind: "review_proposal",
      title: "Proposal draft in progress",
      context: ["Not sent to the customer yet."],
      primary: { id: "review_proposal", label: "Review proposal", command: { type: "navigate", href: input.draft.previewHref } },
      secondary: input.canAuthorProposals
        ? [{ id: "edit_proposal", label: "Edit proposal", command: { type: "navigate", href: input.draft.builderHref } }]
        : [],
      workspace: "proposals",
      look: { tone: "active", icon: "proposal" },
      reason: "draft_proposal",
    });
  }
  if (kind === "proposal_sent") {
    return step({
      kind: "proposal_sent",
      secondary:
        input.draft && input.canAuthorProposals
          ? [
              { id: "review_revision", label: "Review revision", command: { type: "navigate", href: input.draft.previewHref } },
              VIEW_PROPOSALS,
            ]
          : [VIEW_PROPOSALS],
      workspace: "proposals",
      reason: "proposal_sent",
    });
  }
  return step({ kind: "situation", reason: `situation_${kind}` });
}

/** Hero copy: the next step's title/context when it has one, else the situation's. */
export function jobCardNextStepHeroCopy(
  state: JobCardOverviewStateView | null,
  next: JobCardNextStep | null
): { title: string; notes: string[] } | null {
  if (next?.title) return { title: next.title, notes: next.context };
  if (!state) return null;
  return { title: state.title, notes: state.notes };
}
