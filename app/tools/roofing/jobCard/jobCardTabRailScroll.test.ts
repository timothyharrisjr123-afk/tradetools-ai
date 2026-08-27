/**
 * Job Card tab rail — keep the active tab visible on a 390-wide scroller.
 * Run: npx tsx --test app/tools/roofing/jobCard/jobCardTabRailScroll.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { jobCardTabRailScrollDelta } from "./jobCardTabRailScroll";

const RAIL_390 = { left: 0, right: 390 };

describe("jobCardTabRailScrollDelta", () => {
  test("Payments past the right edge scrolls just enough into view", () => {
    const payments = { left: 412, right: 502 };
    const delta = jobCardTabRailScrollDelta(RAIL_390, payments);
    assert.equal(delta, payments.right - (RAIL_390.right - 8));
    assert.ok(delta > 0);
  });

  test("Overview past the left edge scrolls back into view", () => {
    const overview = { left: -80, right: 12 };
    const delta = jobCardTabRailScrollDelta(RAIL_390, overview);
    assert.equal(delta, overview.left - (RAIL_390.left + 8));
    assert.ok(delta < 0);
  });

  test("a fully visible tab does not move the rail", () => {
    const overview = { left: 20, right: 110 };
    assert.equal(jobCardTabRailScrollDelta(RAIL_390, overview), 0);
  });

  test("desktop-wide rail with every tab visible is a no-op", () => {
    const desktop = { left: 0, right: 1280 };
    const attachments = { left: 980, right: 1090 };
    assert.equal(jobCardTabRailScrollDelta(desktop, attachments), 0);
  });
});
