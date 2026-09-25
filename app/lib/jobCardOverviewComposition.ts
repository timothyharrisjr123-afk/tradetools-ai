/**
 * Phase 12.5 — Job Card Overview composition (pure).
 *
 * Turns the resolved situation plus already-read facts into one structured
 * state region and decides which Overview region owns each fact. It reads no
 * data, adds no lifecycle state, and never changes eligibility: it only
 * decides placement. Unknown reads stay unknown ("Checking…", "unavailable"),
 * never empty.
 */

import type {
  JobCardOverviewSituation,
  JobCardOverviewSituationKind,
} from "@/app/lib/jobCardOverviewSituation";

export type JobCardOverviewFactKey = "planned" | "started" | "completed" | "lead";

export type JobCardOverviewFact = {
  key: JobCardOverviewFactKey;
  label: string;
  text: string;
  /** Supporting line under the fact (timezone). */
  meta?: string | null;
  /** Absent/unknown facts read quieter than known ones. */
  quiet?: boolean;
};

export type JobCardOverviewStateView = {
  kind: JobCardOverviewSituationKind;
  title: string;
  notes: string[];
  facts: JobCardOverviewFact[];
};

/** Where the money summary lives on Overview (one owner). */
export type JobCardOverviewMoneyPlacement =
  /** Active work: supporting summary after the work context. */
  | "supporting"
  /** Complete: the leading closeout region owns money. */
  | "closeout"
  /** Nothing accepted yet: only once an agreement total exists. */
  | "agreement_only";

export type JobCardOverviewComposition = {
  state: JobCardOverviewStateView | null;
  /** Lead (and Assign) renders in the state region instead of the brief. */
  leadInState: boolean;
  /** Planned window renders in the state region; lower plan summary yields. */
  scheduleInState: boolean;
  /** Brief renders its own quiet planned/lead details row. */
  briefShowsScheduleLead: boolean;
  /** Planned window in that row; after completion the work-history record owns it. */
  briefShowsPlanned: boolean;
  showAuthorizedWork: boolean;
  authorizedWorkHeading: string;
  money: JobCardOverviewMoneyPlacement;
};

export type JobCardOverviewCompositionInput = {
  situation: JobCardOverviewSituation;
  schedule: {
    status: "loading" | "ready" | "error";
    windowLabel: string | null;
    timezone: string | null;
  };
  /** Formatted actual start; null when absent or unparseable. */
  productionStartedLabel: string | null;
  /** Formatted completion date; null when absent or unparseable. */
  completedDateLabel: string | null;
  productionLeadLabel: string;
  crewLabel?: string | null;
};

export const JOB_CARD_OVERVIEW_AUTHORIZED_WORK_HEADING = "Authorized work" as const;
/** Customer accepted, contractor has not approved: not yet authorized for work. */
export const JOB_CARD_OVERVIEW_ACCEPTED_WORK_HEADING = "Accepted work" as const;
export const JOB_CARD_OVERVIEW_SCHEDULE_CHECKING = "Checking schedule…" as const;
export const JOB_CARD_OVERVIEW_SCHEDULE_UNAVAILABLE = "Schedule unavailable" as const;
export const JOB_CARD_OVERVIEW_START_UNAVAILABLE = "Start time unavailable" as const;
export const JOB_CARD_OVERVIEW_COMPLETION_UNAVAILABLE = "Completion date unavailable" as const;

/** Nothing has been accepted yet: an authorized-work block would only say "none". */
const NO_SCOPE_KINDS = new Set<JobCardOverviewSituationKind>([
  "intake",
  "proposal_draft",
  "proposal_sent",
  "proposal_none",
]);

const COMPLETE_KINDS = new Set<JobCardOverviewSituationKind>([
  "complete_balance",
  "complete_settled",
  "complete_money_unknown",
]);

function plannedFact(
  schedule: JobCardOverviewCompositionInput["schedule"]
): JobCardOverviewFact | null {
  if (schedule.windowLabel) {
    return {
      key: "planned",
      label: "Planned",
      text: schedule.windowLabel,
      meta: schedule.timezone,
    };
  }
  if (schedule.status === "loading") {
    return { key: "planned", label: "Planned", text: JOB_CARD_OVERVIEW_SCHEDULE_CHECKING, quiet: true };
  }
  if (schedule.status === "error") {
    return { key: "planned", label: "Planned", text: JOB_CARD_OVERVIEW_SCHEDULE_UNAVAILABLE, quiet: true };
  }
  return null;
}

function leadFact(label: string, crewLabel: string | null | undefined): JobCardOverviewFact {
  const crew = String(crewLabel ?? "").trim();
  return {
    key: "lead",
    label: "Production lead",
    text: label,
    meta: crew || null,
    quiet: label === "Unassigned",
  };
}

export function buildJobCardOverviewComposition(
  input: JobCardOverviewCompositionInput
): JobCardOverviewComposition {
  const { situation } = input;
  const kind = situation.kind;
  const base: JobCardOverviewComposition = {
    state: situation.headline
      ? { kind, title: situation.headline, notes: [...situation.details], facts: [] }
      : null,
    leadInState: false,
    scheduleInState: false,
    briefShowsScheduleLead: true,
    briefShowsPlanned: !COMPLETE_KINDS.has(kind),
    showAuthorizedWork: !NO_SCOPE_KINDS.has(kind),
    authorizedWorkHeading:
      kind === "accepted_awaiting_approval"
        ? JOB_CARD_OVERVIEW_ACCEPTED_WORK_HEADING
        : JOB_CARD_OVERVIEW_AUTHORIZED_WORK_HEADING,
    money: NO_SCOPE_KINDS.has(kind) ? "agreement_only" : "supporting",
  };

  if (situation.closeoutLeads) {
    return { ...base, state: null, money: "closeout" };
  }
  if (!base.state) return base;

  const facts: JobCardOverviewFact[] = [];
  if (kind === "approved") {
    facts.push(leadFact(input.productionLeadLabel, input.crewLabel));
    return {
      ...base,
      state: { ...base.state, facts },
      leadInState: true,
      briefShowsScheduleLead: false,
    };
  }
  if (kind === "scheduled" || kind === "production") {
    const planned = plannedFact(input.schedule);
    if (planned) facts.push(planned);
    if (kind === "production") {
      facts.push({
        key: "started",
        label: "Started",
        text: input.productionStartedLabel ?? JOB_CARD_OVERVIEW_START_UNAVAILABLE,
        quiet: !input.productionStartedLabel,
      });
    }
    facts.push(leadFact(input.productionLeadLabel, input.crewLabel));
    return {
      ...base,
      state: { ...base.state, facts },
      leadInState: true,
      scheduleInState: true,
      briefShowsScheduleLead: false,
    };
  }
  if (COMPLETE_KINDS.has(kind)) {
    facts.push({
      key: "completed",
      label: "Completed",
      text: input.completedDateLabel ?? JOB_CARD_OVERVIEW_COMPLETION_UNAVAILABLE,
      quiet: !input.completedDateLabel,
    });
    return { ...base, state: { ...base.state, facts }, money: "closeout" };
  }
  return base;
}
