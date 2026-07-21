/**
 * R18C4B — public proposal route guardrail tests.
 *
 * Run: npx tsx --test app/lib/proposalPublicRouteGuardrails.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { buildProposalPublicProposalDocumentViewModel } from "@/app/lib/proposalPublicProposalViewModel";
import type { ProposalPublicGraphDto } from "@/app/lib/proposalPublicGraphDto";

const PUBLIC_ROUTE_DIR = new URL("../p/[token]/", import.meta.url);
const PUBLIC_LAYOUT = new URL("../p/layout.tsx", import.meta.url);
const PACKET_DIR = new URL("../components/proposal-packet/", import.meta.url);

function readPublicRouteSource(filename: string): string {
  return readFileSync(new URL(filename, PUBLIC_ROUTE_DIR), "utf8");
}

function readPacketSource(filename: string): string {
  return readFileSync(new URL(filename, PACKET_DIR), "utf8");
}

const TEMPLATE_OPT_A = "77777777-7777-4777-8777-777777777777";

function baseDto(): ProposalPublicGraphDto {
  return {
    version_kind: "sent",
    frozen_at: "2026-06-26T12:00:00.000Z",
    context_echo: {
      company_name: "Summit Roofing",
      customer_name: "Jane Homeowner",
      address_formatted: "123 Main St",
      template_name: "Roof Replacement",
    },
    policy_echo: {},
    selected_template_option_id: TEMPLATE_OPT_A,
    pages: [
      {
        page_type: "terms",
        sort_order: 10,
        title: "Terms",
        customer_title: "Terms & Conditions",
        visible_to_customer: true,
        content_json: { body_markdown: "Standard terms." },
        settings_json: {},
      },
    ],
    options: [
      {
        source_template_option_id: TEMPLATE_OPT_A,
        name: "Standard",
        customer_label: "Standard",
        sort_order: 0,
        visible_to_customer: true,
        customer_subtotal_cents: 10000,
        discount_cents: 0,
        sales_tax_cents: 0,
        customer_total_cents: 10000,
        line_items: [
          {
            source_template_item_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            customer_name: "Shingles",
            description: null,
            quantity: 1,
            quantity_display_label: "1",
            unit: "SQ",
            customer_unit_price_cents: 10000,
            customer_line_total_cents: 10000,
            pricing_status: "priced",
            visible_to_customer: true,
            line_presentation_group: "included",
            upgrade_selection_state: null,
            upgrade_effect: null,
          },
        ],
      },
    ],
    displayPolicy: {
      showLinePrices: true,
      showOptionTotals: true,
      showSectionHeadings: true,
    },
  };
}

describe("public proposal route source guardrails", () => {
  test("page reads token from params only and uses server orchestrator", () => {
    const source = readPublicRouteSource("page.tsx");
    assert.match(source, /params:\s*Promise<\{\s*token:\s*string\s*\}>/);
    assert.match(source, /loadPublicProposalByToken\(token\)/);
    assert.match(source, /from "@\/app\/lib\/proposalPublicAccessOrchestrator\.server"/);
    assert.doesNotMatch(source, /searchParams/);
    assert.doesNotMatch(source, /getDraftGraph\(/);
  });

  test("page passes document or error only — view envelope stays server-side", () => {
    const source = readPublicRouteSource("page.tsx");
    assert.match(source, /<PublicProposalPage document=\{result\.document\}/);
    assert.match(source, /<PublicProposalErrorPage error=\{result\.error\}/);
    assert.doesNotMatch(source, /result\.tracking/);
  });

  test("public page renders shared ProposalPacket", () => {
    const source = readPublicRouteSource("PublicProposalPage.tsx");
    assert.match(source, /ProposalPacket/);
    assert.match(source, /document\.packet/);
    assert.doesNotMatch(source, /PublicProposalEstimateSection/);
  });

  test("shared packet components do not import FieldDive app chrome or builder preview", () => {
    const files = [
      "ProposalPacket.tsx",
      "ProposalPacketCover.tsx",
      "ProposalPacketEstimate.tsx",
      "ProposalPacketComparison.tsx",
      "ProposalPacketDetails.tsx",
    ];

    for (const file of files) {
      const source = readPacketSource(file);
      assert.doesNotMatch(source, /FieldDiveAppShell/);
      assert.doesNotMatch(source, /ProposalBuilder/);
      assert.doesNotMatch(source, /getDraftGraph\(/);
    }
  });

  test("public page does not render deferred Sign/PDF/Payment UI", () => {
    const source = readPublicRouteSource("PublicProposalPage.tsx");
    assert.doesNotMatch(source, /FutureActions/);
    assert.doesNotMatch(source, /payment_deposit/);
  });

  test("route layout provides public light surface without app shell", () => {
    const layout = readFileSync(PUBLIC_LAYOUT, "utf8");
    assert.match(layout, /min-h-screen/);
    assert.match(layout, /bg-/);
    assert.doesNotMatch(layout, /FieldDiveAppShell/);
  });
});

describe("public proposal client payload audit", () => {
  test("document VM includes shared packet and serializes safely", () => {
    const vm = buildProposalPublicProposalDocumentViewModel(baseDto());
    assert.ok(vm.packet.cover);
    assert.ok(vm.packet.estimate);

    const serialized = JSON.stringify(vm);
    assert.doesNotMatch(serialized, /"token_hash"\s*:/);
    assert.doesNotMatch(serialized, /"proposal_id"\s*:/);
  });

  test("future actions in document VM are deferred only", () => {
    const vm = buildProposalPublicProposalDocumentViewModel(baseDto());
    assert.equal(vm.futureActions.length, 3);
    for (const action of vm.futureActions) {
      assert.equal(action.availability, "deferred");
    }
  });
});
