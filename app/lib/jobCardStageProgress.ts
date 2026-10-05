/**
 * Core Flow 1 / Slice 2 — Job Card header progress (pure, informational).
 *
 * Maps 1:1 onto the canonical job stages; it is never a control and never a
 * second stage model. Dispositions (on hold, lost, closed) are a separate
 * badge: they mute the strip rather than add a step.
 */

import {
  CANONICAL_JOB_STAGES,
  CANONICAL_JOB_STAGE_LABELS,
  type CanonicalJobStage,
} from "@/app/lib/jobLifecycleTypes";

export type JobCardStageProgressStep = {
  stage: CanonicalJobStage;
  label: string;
  state: "done" | "current" | "upcoming";
};

export type JobCardStageProgress = {
  steps: JobCardStageProgressStep[];
  currentLabel: string;
  /** A non-active disposition: the reached stage is kept but reads paused. */
  muted: boolean;
};

export function buildJobCardStageProgress(input: {
  stage: CanonicalJobStage | null;
  disposition: string | null;
}): JobCardStageProgress | null {
  const { stage } = input;
  if (!stage) return null;
  const currentIndex = CANONICAL_JOB_STAGES.indexOf(stage);
  if (currentIndex < 0) return null;
  const disposition = String(input.disposition ?? "").trim().toLowerCase();
  return {
    steps: CANONICAL_JOB_STAGES.map((value, index) => ({
      stage: value,
      label: CANONICAL_JOB_STAGE_LABELS[value],
      state: index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming",
    })),
    currentLabel: CANONICAL_JOB_STAGE_LABELS[stage],
    muted: disposition !== "" && disposition !== "active",
  };
}
