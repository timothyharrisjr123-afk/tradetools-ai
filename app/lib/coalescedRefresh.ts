/**
 * Coalesced refresh controller for deduplicating focus/pageshow/visibility loads.
 * Pure logic — no React dependency.
 */

export type CoalescedRefreshState = {
  generation: number;
  inFlight: boolean;
  pending: boolean;
};

export function createInitialCoalescedRefreshState(): CoalescedRefreshState {
  return { generation: 0, inFlight: false, pending: false };
}

/** Mark a new refresh request; returns the generation token for this run. */
export function beginCoalescedRefresh(
  state: CoalescedRefreshState
): { state: CoalescedRefreshState; generation: number; shouldRun: boolean } {
  if (state.inFlight) {
    return {
      state: { ...state, pending: true },
      generation: state.generation,
      shouldRun: false,
    };
  }
  const generation = state.generation + 1;
  return {
    state: { ...state, generation, inFlight: true, pending: false },
    generation,
    shouldRun: true,
  };
}

/** Complete a refresh run; schedules one follow-up if requests coalesced while in-flight. */
export function finishCoalescedRefresh(
  state: CoalescedRefreshState,
  completedGeneration: number
): { state: CoalescedRefreshState; runAgain: boolean; nextGeneration: number | null } {
  if (completedGeneration !== state.generation) {
    return { state, runAgain: false, nextGeneration: null };
  }
  const pending = state.pending;
  const nextGeneration = pending ? state.generation + 1 : null;
  return {
    state: {
      generation: nextGeneration ?? state.generation,
      inFlight: pending,
      pending: false,
    },
    runAgain: pending,
    nextGeneration,
  };
}

/** Drop stale async results when a newer generation superseded this run. */
export function isCoalescedRefreshCurrent(
  state: CoalescedRefreshState,
  generation: number
): boolean {
  return generation === state.generation;
}

export function invalidateCoalescedRefresh(
  state: CoalescedRefreshState
): CoalescedRefreshState {
  return {
    generation: state.generation + 1,
    inFlight: false,
    pending: false,
  };
}
