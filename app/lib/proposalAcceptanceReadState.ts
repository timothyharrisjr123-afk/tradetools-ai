/**
 * Job Card proposal-acceptance read truth (pure).
 *
 * A failed read is never "no acceptance". Facts are known only after a read
 * for the current job has succeeded; a later failed refresh keeps that
 * last-known truth instead of erasing it.
 */

export type ProposalAcceptanceReadStatus = "loading" | "ready" | "error";

export type ProposalAcceptanceReadState = {
  status: ProposalAcceptanceReadStatus;
  /** A read for the current job has succeeded at least once. */
  resolved: boolean;
};

export function createInitialProposalAcceptanceReadState(): ProposalAcceptanceReadState {
  return { status: "loading", resolved: false };
}

export function beginProposalAcceptanceRead(
  previous: ProposalAcceptanceReadState
): ProposalAcceptanceReadState {
  return { status: "loading", resolved: previous.resolved };
}

export function applyProposalAcceptanceReadSuccess(): ProposalAcceptanceReadState {
  return { status: "ready", resolved: true };
}

export function applyProposalAcceptanceReadFailure(
  previous: ProposalAcceptanceReadState
): ProposalAcceptanceReadState {
  return { status: "error", resolved: previous.resolved };
}

/** Acceptance facts (including a confirmed zero) may drive presentation. */
export function proposalAcceptanceFactsKnown(state: ProposalAcceptanceReadState): boolean {
  return state.resolved;
}

/** The read failed and there is no last-known truth to fall back on. */
export function proposalAcceptanceFactsUnavailable(
  state: ProposalAcceptanceReadState
): boolean {
  return state.status === "error" && !state.resolved;
}

export function acceptedProposalIdsFromRows(
  rows: readonly { proposal_id?: string | null }[]
): Record<string, boolean> {
  const acceptedIds: Record<string, boolean> = {};
  for (const row of rows) {
    const proposalId = (row.proposal_id ?? "").trim();
    if (proposalId) acceptedIds[proposalId] = true;
  }
  return acceptedIds;
}
