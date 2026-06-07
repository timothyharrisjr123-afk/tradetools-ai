/**
 * Pricing Trust Hardening — proposalStaleness pure helper tests.
 *
 * Run: npx tsx --test app/lib/proposalStaleness.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  deriveProposalPricingStale,
  PROPOSAL_PRICING_STALE_BANNER_COPY,
} from "./proposalStaleness";

const MEAS_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MEAS_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("deriveProposalPricingStale", () => {
  test("Golden #1: snapshot 2300 measurement, current 2500 measurement -> stale (measurement_changed)", () => {
    const result = deriveProposalPricingStale({
      snapshotMeasurementId: MEAS_A,
      currentMeasurementId: MEAS_B,
    });
    assert.equal(result.stale, true);
    assert.equal(result.reason, "measurement_changed");
  });

  test("equal measurement ids -> not stale", () => {
    const result = deriveProposalPricingStale({
      snapshotMeasurementId: MEAS_A,
      currentMeasurementId: MEAS_A,
    });
    assert.equal(result.stale, false);
    assert.equal(result.reason, null);
  });

  test("no current measurement -> not stale (nothing to compare)", () => {
    assert.deepEqual(
      deriveProposalPricingStale({
        snapshotMeasurementId: MEAS_A,
        currentMeasurementId: null,
      }),
      { stale: false, reason: null }
    );
    assert.deepEqual(
      deriveProposalPricingStale({
        snapshotMeasurementId: MEAS_A,
        currentMeasurementId: "   ",
      }),
      { stale: false, reason: null }
    );
  });

  test("snapshot id missing but current present -> stale (measurement_unknown)", () => {
    const result = deriveProposalPricingStale({
      snapshotMeasurementId: null,
      currentMeasurementId: MEAS_A,
    });
    assert.equal(result.stale, true);
    assert.equal(result.reason, "measurement_unknown");
  });

  test("both ids null -> not stale", () => {
    assert.deepEqual(
      deriveProposalPricingStale({
        snapshotMeasurementId: null,
        currentMeasurementId: null,
      }),
      { stale: false, reason: null }
    );
  });

  test("equal ids, current measurement newer -> stale (measurement_updated)", () => {
    const result = deriveProposalPricingStale({
      snapshotMeasurementId: MEAS_A,
      currentMeasurementId: MEAS_A,
      snapshotUpdatedAt: "2026-06-06T00:00:00.000Z",
      measurementUpdatedAt: "2026-06-07T00:00:00.000Z",
    });
    assert.equal(result.stale, true);
    assert.equal(result.reason, "measurement_updated");
  });

  test("equal ids, measurement not newer -> not stale", () => {
    const result = deriveProposalPricingStale({
      snapshotMeasurementId: MEAS_A,
      currentMeasurementId: MEAS_A,
      snapshotUpdatedAt: "2026-06-07T00:00:00.000Z",
      measurementUpdatedAt: "2026-06-06T00:00:00.000Z",
    });
    assert.equal(result.stale, false);
    assert.equal(result.reason, null);
  });

  test("equal ids, invalid/absent timestamps ignored -> not stale", () => {
    const result = deriveProposalPricingStale({
      snapshotMeasurementId: MEAS_A,
      currentMeasurementId: MEAS_A,
      snapshotUpdatedAt: "not-a-date",
      measurementUpdatedAt: "also-not-a-date",
    });
    assert.equal(result.stale, false);
    assert.equal(result.reason, null);
  });

  test("Golden #13: after a refresh records the current measurement id, detection clears", () => {
    const beforeRefresh = deriveProposalPricingStale({
      snapshotMeasurementId: MEAS_A,
      currentMeasurementId: MEAS_B,
    });
    assert.equal(beforeRefresh.stale, true);

    // Refresh re-snapshots context_echo.measurement_record_id := current id.
    const afterRefresh = deriveProposalPricingStale({
      snapshotMeasurementId: MEAS_B,
      currentMeasurementId: MEAS_B,
    });
    assert.equal(afterRefresh.stale, false);
    assert.equal(afterRefresh.reason, null);
  });

  test("banner copy matches product requirement", () => {
    assert.equal(
      PROPOSAL_PRICING_STALE_BANNER_COPY,
      "Proposal pricing is based on an older measurement. Refresh draft pricing."
    );
  });
});
