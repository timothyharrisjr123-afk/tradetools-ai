/**
 * Coalesced refresh controller contracts.
 *
 * Run: npx tsx --test app/lib/coalescedRefresh.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  beginCoalescedRefresh,
  createInitialCoalescedRefreshState,
  finishCoalescedRefresh,
  invalidateCoalescedRefresh,
  isCoalescedRefreshCurrent,
} from "./coalescedRefresh";

describe("coalescedRefresh", () => {
  test("focus + pageshow close together coalesce into one in-flight run", () => {
    let state = createInitialCoalescedRefreshState();
    const first = beginCoalescedRefresh(state);
    state = first.state;
    assert.equal(first.shouldRun, true);
    assert.equal(first.generation, 1);

    const second = beginCoalescedRefresh(state);
    state = second.state;
    assert.equal(second.shouldRun, false);
    assert.equal(state.pending, true);
    assert.equal(state.inFlight, true);
  });

  test("visibilitychange while in-flight does not start duplicate generation", () => {
    let state = createInitialCoalescedRefreshState();
    state = beginCoalescedRefresh(state).state;
    const dup = beginCoalescedRefresh(state);
    state = dup.state;
    assert.equal(dup.shouldRun, false);
    assert.equal(state.generation, 1);
  });

  test("stale response cannot overwrite newer result", () => {
    let state = createInitialCoalescedRefreshState();
    const run1 = beginCoalescedRefresh(state);
    state = run1.state;
    state = invalidateCoalescedRefresh(state);
    assert.equal(isCoalescedRefreshCurrent(state, run1.generation), false);
    assert.equal(isCoalescedRefreshCurrent(state, state.generation), true);
  });

  test("explicit invalidation bumps generation and clears in-flight", () => {
    let state = createInitialCoalescedRefreshState();
    state = beginCoalescedRefresh(state).state;
    const before = state.generation;
    state = invalidateCoalescedRefresh(state);
    assert.equal(state.inFlight, false);
    assert.equal(state.pending, false);
    assert.equal(state.generation, before + 1);
  });

  test("finish schedules one follow-up when requests coalesced in-flight", () => {
    let state = createInitialCoalescedRefreshState();
    const run = beginCoalescedRefresh(state);
    state = run.state;
    state = beginCoalescedRefresh(state).state;
    const finish = finishCoalescedRefresh(state, run.generation);
    state = finish.state;
    assert.equal(finish.runAgain, true);
    assert.equal(finish.nextGeneration, 2);
    assert.equal(state.inFlight, true);
  });
});
