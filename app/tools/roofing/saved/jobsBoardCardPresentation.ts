/**
 * Job Board card presentation (pure). Decides which already-derived card facts
 * lead a card in each lane and which stay quiet or are omitted. Reads no data
 * and never changes lifecycle, eligibility, or payment meaning. Lane `paid` is
 * the legacy key for Complete, not payment truth.
 */

import type { BoardColumnKey, JobsBoardCardModel } from "./jobsBoardUtils";

/** `paused`: production facts on a job whose disposition (e.g. on hold) stops active work. */
export type JobsBoardCardStateTone = "planned" | "active" | "paused" | "complete";

export type JobsBoardCardStateFact = {
  tone: JobsBoardCardStateTone;
  text: string;
};

export type JobsBoardCardPresentation = {
  /** Quiet earlier fact shown above the state fact so history reads in chronological order. */
  precedingFact: string | null;
  /** The one lane-specific fact that should read first after identity. */
  stateFact: JobsBoardCardStateFact | null;
  /** Quiet supporting line under the state fact (e.g. planned window during production). */
  supportingFact: string | null;
  showOwner: boolean;
  showProposalPresence: boolean;
  showTimeInStage: boolean;
};

const PREPARATION_LANES = new Set<BoardColumnKey>(["estimate", "leads"]);
const RESPONSIBILITY_LANES = new Set<BoardColumnKey>([
  "approved",
  "deposit_paid",
  "scheduled",
  "in_progress",
]);

function isAssigned(label: string | null | undefined): boolean {
  const trimmed = label?.trim();
  return Boolean(trimmed) && trimmed !== "Unassigned";
}

function withoutPlannedPrefix(label: string): string {
  return label.replace(/^Planned · /, "");
}

export function buildJobsBoardCardPresentation(
  model: Pick<
    JobsBoardCardModel,
    | "columnKey"
    | "assigneeLabel"
    | "scheduleLabel"
    | "productionStartedLabel"
    | "completedAtLabel"
    | "dispositionLabel"
  >
): JobsBoardCardPresentation {
  const lane = model.columnKey ?? null;
  const assigned = isAssigned(model.assigneeLabel);
  const base: JobsBoardCardPresentation = {
    precedingFact: null,
    stateFact: null,
    supportingFact: model.scheduleLabel ?? null,
    showOwner: lane ? RESPONSIBILITY_LANES.has(lane) || assigned : assigned,
    showProposalPresence: lane ? PREPARATION_LANES.has(lane) : true,
    showTimeInStage: true,
  };

  if (lane === "scheduled") {
    return {
      ...base,
      stateFact: model.scheduleLabel
        ? { tone: "planned", text: withoutPlannedPrefix(model.scheduleLabel) }
        : null,
      supportingFact: null,
    };
  }
  if (lane === "in_progress") {
    return {
      ...base,
      stateFact: {
        tone: model.dispositionLabel ? "paused" : "active",
        text: model.productionStartedLabel
          ? `Started ${model.productionStartedLabel}`
          : "Work in progress",
      },
      supportingFact: model.scheduleLabel
        ? `Planned ${withoutPlannedPrefix(model.scheduleLabel)}`
        : null,
    };
  }
  if (lane === "paid") {
    return {
      ...base,
      precedingFact: model.productionStartedLabel
        ? `Started ${model.productionStartedLabel}`
        : null,
      stateFact: {
        tone: "complete",
        text: model.completedAtLabel
          ? `Completed ${model.completedAtLabel}`
          : "Work complete",
      },
      supportingFact: null,
      showTimeInStage: false,
    };
  }
  return base;
}
