/**
 * 3J0b — proposal record / line snapshot shape guards (no DB).
 *
 * Run: npx tsx --test app/lib/proposalRecordTypes.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { ProposalLineItemSnapshot } from "./proposalLineSnapshotTypes";
import { PROPOSAL_LINE_CUSTOMER_FORBIDDEN_KEYS } from "./proposalLineSnapshotTypes";
import type { ProposalLineItemRow } from "./proposalRecordStore";
import type { ProposalRecord } from "./proposalRecordTypes";

describe("proposalRecordTypes", () => {
  test("ProposalRecord includes version pointer fields", () => {
    const sample: ProposalRecord = {
      id: "p1",
      company_id: "c1",
      job_id: "j1",
      customer_id: null,
      template_id: "t1",
      status: "draft",
      current_draft_version_id: "v1",
      latest_sent_version_id: null,
      signed_version_id: null,
      selected_option_id: null,
      measurement_record_id: null,
      pricing_policy_id: null,
      proposal_number: null,
      title: null,
      created_by: null,
      updated_by: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      archived_at: null,
      deleted_at: null,
    };
    assert.equal(sample.current_draft_version_id, "v1");
  });
});

describe("proposalLineSnapshotTypes customer boundary", () => {
  test("ProposalLineItemSnapshot keys exclude internal financial fields", () => {
    const line: ProposalLineItemSnapshot = {
      id: "l1",
      company_id: "c1",
      proposal_option_id: "o1",
      source_template_item_id: null,
      catalog_item_id: null,
      catalog_seed_key: null,
      section_id: null,
      page_id: null,
      sort_order: 0,
      customer_name: "Shingles",
      description: null,
      role: "standard",
      quantity: 24,
      quantity_display_label: "24",
      quantity_source_label: "Roof squares",
      unit: "SQ",
      customer_unit_price_cents: 50000,
      customer_line_total_cents: 1200000,
      pricing_status: "priced",
      visible_to_customer: true,
      measurement_quantity_key: "roof_squares",
    };

    const keys = Object.keys(line);
    for (const forbidden of PROPOSAL_LINE_CUSTOMER_FORBIDDEN_KEYS) {
      assert.ok(!keys.includes(forbidden), `forbidden key present: ${forbidden}`);
    }
    assert.ok(
      !keys.includes("quantity_resolution_echo"),
      "customer snapshot must not include quantity_resolution_echo"
    );
  });
});

describe("proposalRecordStore line row awareness (S3B)", () => {
  test("ProposalLineItemRow accepts null and object quantity_resolution_echo", () => {
    const withNull: ProposalLineItemRow = {
      id: "l1",
      company_id: "c1",
      proposal_option_id: "o1",
      source_template_item_id: null,
      catalog_item_id: null,
      catalog_seed_key: null,
      section_id: null,
      page_id: null,
      sort_order: 0,
      customer_name: "Shingles",
      description: null,
      role: "standard",
      quantity: 24,
      quantity_display_label: "24",
      quantity_source_label: "Roof squares",
      unit: "SQ",
      customer_unit_price_cents: 50000,
      customer_line_total_cents: 1200000,
      pricing_status: "priced",
      visible_to_customer: true,
      measurement_quantity_key: "roof_squares",
      quantity_resolution_echo: null,
      created_at: "2026-07-16T00:00:00Z",
      updated_at: "2026-07-16T00:00:00Z",
    };
    assert.equal(withNull.quantity_resolution_echo, null);

    const withObject: ProposalLineItemRow = {
      ...withNull,
      quantity_resolution_echo: {
        quantity_mode: "adjusted_measurement",
        source_measurement_key: "adjusted_roof_squares",
        source_measurement_value: 24,
        coverage_rate_used: null,
        waste_pct_used: null,
        rounding_mode_used: "exact",
        resolved_purchase_quantity: 24,
      },
    };
    assert.equal(
      withObject.quantity_resolution_echo?.quantity_mode,
      "adjusted_measurement"
    );
  });
});
