/**
 * Phase 12.5 — state-dependent Job Card Overview headline (pure).
 *
 * Composes existing truth only: canonical stage, disposition, proposal facts,
 * schedule presence, production start, and payment remaining. It adds no
 * status, no attention engine, and never promotes financial state over
 * operational state. Loading returns no headline rather than a guess.
 */

import { JOB_CARD_AWAITING_CONTRACTOR_APPROVAL } from "@/app/lib/jobCardForwardLifecycleAction";
import { JOB_PAYMENT_MIN_AMOUNT_CENTS } from "@/app/lib/jobPaymentTypes";
import { JOB_CARD_SCOPE_CHANGE_PENDING_OVERVIEW_LABEL } from "@/app/lib/jobScopeChangeViewModel";

export type JobCardOverviewSituationKind =
  | "loading"
  | "intake"
  | "proposal_draft"
  | "proposal_sent"
  | "proposal_none"
  /** Acceptance truth could not be read; never presented as "no acceptance". */
  | "proposal_facts_unavailable"
  | "accepted_awaiting_approval"
  | "approved"
  | "scheduled"
  | "production"
  | "complete_balance"
  | "complete_settled"
  | "complete_money_unknown"
  | "on_hold"
  | "lost"
  | "closed"
  | "closed_during_production";

export type JobCardOverviewSituationInput = {
  stage: string | null;
  disposition: string | null;
  hasDraftProposal: boolean;
  hasSentProposal: boolean;
  acceptedAwaitingApproval: boolean;
  signed: boolean;
  hasActiveSchedule: boolean;
  productionStartedAt: string | null;
  pendingScopeChange: boolean;
  /** Proposal/acceptance reads settled; pre-approval headlines wait for them. */
  proposalFactsReady: boolean;
  /** A proposal/acceptance read failed with no last-known truth to fall back on. */
  proposalFactsUnavailable?: boolean;
  /** Null when payment truth is unknown or still loading. */
  remainingCents: number | null;
  suppressCommercial: boolean;
};

export type JobCardOverviewSituation = {
  kind: JobCardOverviewSituationKind;
  headline: string | null;
  details: string[];
  /** Completed jobs lead with closeout/payment instead of the field brief. */
  closeoutLeads: boolean;
};

export const JOB_CARD_SITUATION_PENDING_SCOPE_DETAIL =
  `${JOB_CARD_SCOPE_CHANGE_PENDING_OVERVIEW_LABEL} — review in Proposals` as const;

export const JOB_CARD_SITUATION_PROPOSAL_FACTS_UNAVAILABLE =
  "Customer response couldn't be checked" as const;
export const JOB_CARD_SITUATION_PROPOSAL_FACTS_RETRY =
  "Reload the page to check again." as const;

function norm(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

export function resolveJobCardOverviewSituation(
  input: JobCardOverviewSituationInput
): JobCardOverviewSituation {
  const stage = norm(input.stage);
  const disposition = norm(input.disposition);
  const commercial = !input.suppressCommercial;
  const pendingDetail =
    commercial && input.pendingScopeChange ? [JOB_CARD_SITUATION_PENDING_SCOPE_DETAIL] : [];

  if (!stage) {
    return { kind: "loading", headline: null, details: [], closeoutLeads: false };
  }

  if (disposition === "closed" && stage === "production") {
    return {
      kind: "closed_during_production",
      headline: "Closed while work was in progress",
      details: ["Reopen the job to finish and complete the work."],
      closeoutLeads: false,
    };
  }
  if (disposition === "on_hold") {
    return {
      kind: "on_hold",
      headline: "On hold",
      details: ["Stage, schedule, and commitments are kept. Resume when ready."],
      closeoutLeads: false,
    };
  }
  if (disposition === "lost") {
    return {
      kind: "lost",
      headline: "Marked lost",
      details: ["Records are kept. Reopen the job if the customer comes back."],
      closeoutLeads: false,
    };
  }
  if (disposition === "closed" && stage !== "complete") {
    return {
      kind: "closed",
      headline: "Closed",
      details: ["Records are kept. Reopen the job to continue."],
      closeoutLeads: false,
    };
  }

  if (stage === "complete") {
    if (!commercial) {
      return { kind: "complete_money_unknown", headline: "Work complete", details: [], closeoutLeads: false };
    }
    const remaining = input.remainingCents;
    const kind: JobCardOverviewSituationKind =
      remaining == null
        ? "complete_money_unknown"
        : remaining >= JOB_PAYMENT_MIN_AMOUNT_CENTS
          ? "complete_balance"
          : "complete_settled";
    return { kind, headline: null, details: [], closeoutLeads: true };
  }

  if (stage === "production") {
    return {
      kind: "production",
      headline: "Work in progress",
      details: pendingDetail,
      closeoutLeads: false,
    };
  }
  if (stage === "scheduled") {
    return {
      kind: "scheduled",
      headline: input.hasActiveSchedule ? "Scheduled" : "Scheduled — date not loaded",
      details: pendingDetail,
      closeoutLeads: false,
    };
  }
  if (stage === "approved") {
    return {
      kind: "approved",
      headline: "Approved — ready to schedule",
      details: pendingDetail,
      closeoutLeads: false,
    };
  }

  if (!commercial) {
    return {
      kind: stage === "intake" ? "intake" : "proposal_none",
      headline: "Not yet approved for work",
      details: [],
      closeoutLeads: false,
    };
  }

  // Pending acceptance is positive canonical evidence; it never waits on other reads.
  if (input.acceptedAwaitingApproval) {
    return {
      kind: "accepted_awaiting_approval",
      headline: "Customer accepted proposal",
      details: [
        ...(input.signed ? ["Signed"] : []),
        JOB_CARD_AWAITING_CONTRACTOR_APPROVAL,
        ...pendingDetail,
      ],
      closeoutLeads: false,
    };
  }
  if (!input.proposalFactsReady) {
    if (input.proposalFactsUnavailable) {
      return {
        kind: "proposal_facts_unavailable",
        headline: JOB_CARD_SITUATION_PROPOSAL_FACTS_UNAVAILABLE,
        details: [JOB_CARD_SITUATION_PROPOSAL_FACTS_RETRY],
        closeoutLeads: false,
      };
    }
    return { kind: "loading", headline: null, details: [], closeoutLeads: false };
  }
  if (input.hasSentProposal) {
    return {
      kind: "proposal_sent",
      headline: "Proposal sent — waiting on the customer",
      details: input.hasDraftProposal
        ? ["A revision draft is in progress and has not been sent."]
        : ["Nothing to do until the customer responds."],
      closeoutLeads: false,
    };
  }
  if (input.hasDraftProposal) {
    return {
      kind: "proposal_draft",
      headline: "Proposal draft in progress",
      details: ["Not sent to the customer yet."],
      closeoutLeads: false,
    };
  }
  if (stage === "intake") {
    return {
      kind: "intake",
      headline: "Get this job ready for a proposal",
      details: ["Add a measurement or prepare a proposal when you're ready."],
      closeoutLeads: false,
    };
  }
  return {
    kind: "proposal_none",
    headline: "No proposal yet",
    details: ["Prepare a proposal from Proposals."],
    closeoutLeads: false,
  };
}

export function formatJobCardOverviewSituationLabel(
  situation: JobCardOverviewSituation
): string | null {
  if (!situation.headline) return null;
  return [situation.headline, ...situation.details].join("\n");
}
