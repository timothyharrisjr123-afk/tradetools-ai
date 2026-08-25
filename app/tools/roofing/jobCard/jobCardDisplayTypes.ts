export type JobCardTimeInStageTone =
  | "fresh"
  | "normal"
  | "aged"
  | "very_aged"
  | "neutral";

export type JobCardDisplayModel = {
  customerName: string;
  address: string;
  stageLabel: string;
  dispositionLabel: string | null;
  valueLabel: string | null;
  lastUpdatedDisplay: string | null;
  timeInStage: string | null;
  timeInStageTone: JobCardTimeInStageTone;
  reportLabel: string;
  proposalLabel: string;
  tasksLabel: string;
};

export function jobCardTimeInStageToneClass(
  tone: JobCardTimeInStageTone
): string {
  switch (tone) {
    case "very_aged":
      return "text-rose-400/60";
    case "aged":
      return "text-amber-700/55";
    case "normal":
      return "text-slate-400";
    case "fresh":
      return "text-emerald-600/65";
    default:
      return "text-slate-400";
  }
}
