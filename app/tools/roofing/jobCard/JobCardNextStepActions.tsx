"use client";

import { Eye, FileText, RotateCcw, Ruler, type LucideIcon } from "lucide-react";
import type {
  JobCardNextStep,
  JobCardNextStepAction,
  JobCardNextStepCommand,
} from "@/app/lib/jobCardNextStep";
import {
  OVERVIEW_NEUTRAL_ACTION,
  OVERVIEW_PRIMARY_ACTION,
  OVERVIEW_TEXT_ACTION,
} from "./jobCardOverviewStyles";

const PRIMARY_ICONS: Partial<Record<JobCardNextStepCommand["type"], LucideIcon>> = {
  open_measurement_capture: Ruler,
  open_prepare_proposal: FileText,
  navigate: Eye,
  retry: RotateCcw,
};

/** The next step's controls inside the Overview hero: one primary, quiet secondaries. */
export default function JobCardNextStepActions({
  step,
  onCommand,
}: {
  step: JobCardNextStep;
  onCommand: (command: JobCardNextStepCommand, action: JobCardNextStepAction) => void;
}) {
  const { primary, secondary } = step;
  if (!primary && secondary.length === 0) return null;
  const Icon = primary ? (PRIMARY_ICONS[primary.command.type] ?? null) : null;
  const retry = primary?.command.type === "retry";

  return (
    <div
      className="flex flex-col items-stretch gap-1 sm:items-end"
      data-jobcard-next-step-actions={step.kind}
    >
      {primary ? (
        <button
          type="button"
          className={retry ? `${OVERVIEW_NEUTRAL_ACTION} w-full sm:w-auto` : OVERVIEW_PRIMARY_ACTION}
          onClick={() => onCommand(primary.command, primary)}
          data-jobcard-next-step-primary={primary.id}
        >
          {Icon ? <Icon className="h-4 w-4" strokeWidth={2} aria-hidden /> : null}
          {primary.label}
        </button>
      ) : null}
      {secondary.length > 0 ? (
        <div className="-mx-2.5 flex flex-wrap items-center gap-x-1 sm:justify-end">
          {secondary.map((action) => (
            <button
              key={action.id}
              type="button"
              className={OVERVIEW_TEXT_ACTION}
              onClick={() => onCommand(action.command, action)}
              data-jobcard-next-step-secondary={action.id}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
