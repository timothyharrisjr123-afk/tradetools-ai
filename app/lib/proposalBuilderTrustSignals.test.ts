/**
 * Slice A — Builder-internal quantity preflight trust composer tests.
 *
 * Run: npx tsx --test app/lib/proposalBuilderTrustSignals.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import type { ProposalBuilderQuantityPreflightMetadata } from "./proposalBuilderQuantityPreflightMetadata";
import {
  composeProposalBuilderInternalTrustSignals,
  composeQuantityPreflightTrustSignal,
} from "./proposalBuilderTrustSignals";
import { deriveProposalPricingStale } from "./proposalStaleness";
import { buildLineItemSnapshots } from "./proposalSnapshotBuilder";

function meta(
  overrides: Partial<ProposalBuilderQuantityPreflightMetadata> = {}
): ProposalBuilderQuantityPreflightMetadata {
  return {
    status: "current",
    staleCount: 0,
    unknownCount: 0,
    currentCount: 1,
    ...overrides,
  };
}

describe("composeQuantityPreflightTrustSignal", () => {
  test("1. current maps to ok", () => {
    const signal = composeQuantityPreflightTrustSignal({
      quantityPreflight: meta({ status: "current", currentCount: 1 }),
    });
    assert.ok(signal);
    assert.equal(signal!.status, "current");
    assert.equal(signal!.severity, "ok");
    assert.deepEqual(signal!.reasonCodes, []);
  });

  test("2. unknown maps to neutral", () => {
    const signal = composeQuantityPreflightTrustSignal({
      quantityPreflight: meta({
        status: "unknown",
        unknownCount: 1,
        currentCount: 0,
      }),
    });
    assert.equal(signal!.status, "unknown");
    assert.equal(signal!.severity, "neutral");
    assert.ok(signal!.reasonCodes.includes("quantity_preflight_unknown"));
  });

  test("3. stale maps to needs_review", () => {
    const signal = composeQuantityPreflightTrustSignal({
      quantityPreflight: meta({
        status: "stale",
        staleCount: 1,
        currentCount: 0,
      }),
    });
    assert.equal(signal!.status, "stale");
    assert.equal(signal!.severity, "needs_review");
    assert.ok(signal!.reasonCodes.includes("quantity_preflight_stale"));
  });

  test("4. unknown is not stale", () => {
    const signal = composeQuantityPreflightTrustSignal({
      quantityPreflight: meta({ status: "unknown", unknownCount: 1 }),
    });
    assert.notEqual(signal!.status, "stale");
    assert.notEqual(signal!.severity, "needs_review");
    assert.equal(signal!.severity, "neutral");
  });

  test("5. stale does not block", () => {
    const signal = composeQuantityPreflightTrustSignal({
      quantityPreflight: meta({ status: "stale", staleCount: 1 }),
    });
    assert.equal(signal!.shouldBlock, false);
  });

  test("6. stale does not auto-refresh", () => {
    const signal = composeQuantityPreflightTrustSignal({
      quantityPreflight: meta({ status: "stale", staleCount: 1 }),
    });
    assert.equal(signal!.shouldAutoRefresh, false);
  });

  test("7. metadata is customerVisible false", () => {
    for (const status of ["current", "unknown", "stale"] as const) {
      const signal = composeQuantityPreflightTrustSignal({
        quantityPreflight: meta({ status }),
      });
      assert.equal(signal!.customerVisible, false);
    }
  });

  test("8. measurement/pricing stale remains separate", () => {
    const pricing = deriveProposalPricingStale({
      snapshotMeasurementId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      currentMeasurementId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    });
    assert.equal(pricing.stale, true);
    assert.equal(pricing.reason, "measurement_changed");

    const quantityTrust = composeQuantityPreflightTrustSignal({
      quantityPreflight: meta({ status: "current" }),
    });
    assert.equal(quantityTrust!.status, "current");
    assert.equal(quantityTrust!.severity, "ok");

    // Composer module must not import or wrap pricing staleness detector.
    const src = readFileSync(
      path.join(process.cwd(), "app/lib/proposalBuilderTrustSignals.ts"),
      "utf8"
    );
    assert.equal(src.includes('from "@/app/lib/proposalStaleness"'), false);
    assert.equal(src.includes('from "./proposalStaleness"'), false);
    assert.equal(/import\s+\{[^}]*deriveProposalPricingStale/.test(src), false);
  });

  test("9. customer/public DTOs do not include quantity preflight trust", () => {
    const customerLines = buildLineItemSnapshots({
      company_id: "11111111-1111-4111-8111-111111111111",
      lines: [
        {
          source_template_item_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          catalog_item_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          catalog_seed_key: null,
          section_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
          sort_order: 0,
          customer_name: "Shingles",
          description: null,
          role: null,
          quantity: 24,
          quantity_display_label: "24 SQ",
          quantity_source_label: "Measurement",
          unit: "SQ",
          customer_unit_price_cents: 500,
          customer_line_total_cents: 12000,
          pricing_status: "priced",
          visible_to_customer: true,
          measurement_quantity_key: null,
        },
      ],
    });
    const keys = Object.keys(customerLines[0] ?? {});
    assert.equal(keys.includes("quantityPreflightTrust"), false);
    assert.equal(keys.includes("quantityPreflight"), false);

    const customerPreviewSrc = readFileSync(
      path.join(process.cwd(), "app/lib/proposalCustomerPreviewViewModel.ts"),
      "utf8"
    );
    const sendGateSrc = readFileSync(
      path.join(process.cwd(), "app/lib/proposalSendGateReadiness.ts"),
      "utf8"
    );
    assert.equal(customerPreviewSrc.includes("proposalBuilderTrustSignals"), false);
    assert.equal(customerPreviewSrc.includes("quantityPreflightTrust"), false);
    assert.equal(sendGateSrc.includes("proposalBuilderTrustSignals"), false);
    assert.equal(sendGateSrc.includes("quantityPreflightTrust"), false);
  });

  test("10. Builder still resolves when quantity preflight is null", () => {
    const signal = composeQuantityPreflightTrustSignal({
      quantityPreflight: null,
    });
    assert.ok(signal);
    assert.equal(signal!.status, "unknown");
    assert.equal(signal!.severity, "neutral");
    assert.equal(signal!.shouldBlock, false);
    assert.equal(signal!.shouldAutoRefresh, false);
    assert.equal(signal!.customerVisible, false);

    const bundle = composeProposalBuilderInternalTrustSignals({
      quantityPreflight: null,
    });
    assert.equal(bundle.quantityPreflightTrust?.severity, "neutral");
  });

  test("11. trust composer has no raw/whole semantics (mode-agnostic metadata only)", () => {
    const src = readFileSync(
      path.join(process.cwd(), "app/lib/proposalBuilderTrustSignals.ts"),
      "utf8"
    );
    assert.equal(src.includes("raw_plus_waste"), false);
    assert.equal(src.includes("whole"), false);
    assert.match(src, /shouldBlock: false/);
    assert.match(src, /shouldAutoRefresh: false/);
    assert.match(src, /customerVisible: false/);

    // Stale trust never enables raw/whole semantics.
    const signal = composeQuantityPreflightTrustSignal({
      quantityPreflight: meta({ status: "stale", staleCount: 1 }),
    });
    assert.equal(signal!.shouldBlock, false);
    assert.equal(signal!.shouldAutoRefresh, false);
  });
});

describe("composeProposalBuilderInternalTrustSignals", () => {
  test("returns sibling quantity trust bundle only", () => {
    const bundle = composeProposalBuilderInternalTrustSignals({
      quantityPreflight: meta({ status: "stale", staleCount: 2 }),
    });
    assert.equal(bundle.quantityPreflightTrust?.status, "stale");
    assert.equal(bundle.quantityPreflightTrust?.severity, "needs_review");
    assert.equal(
      Object.keys(bundle).join(","),
      "quantityPreflightTrust"
    );
  });
});
