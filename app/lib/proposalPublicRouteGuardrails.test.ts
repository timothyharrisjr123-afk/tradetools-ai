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

function readPublicRouteSource(filename: string): string {
  return readFileSync(new URL(filename, PUBLIC_ROUTE_DIR), "utf8");
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
    assert.doesNotMatch(source, /get\("job"\)|get\("proposal"\)|get\("version"\)/);
    assert.doesNotMatch(source, /getDraftGraph\(/);
    assert.doesNotMatch(source, /loadSaved/);
    assert.doesNotMatch(source, /approve\/\[token\]/);
  });

  test("page passes document or error only — view envelope stays server-side", () => {
    const source = readPublicRouteSource("page.tsx");
    assert.match(source, /<PublicProposalPage document=\{result\.document\}/);
    assert.match(source, /<PublicProposalErrorPage error=\{result\.error\}/);
    assert.doesNotMatch(source, /result\.tracking/);
    assert.doesNotMatch(source, /rawToken|raw_token|token_hash/);
  });

  test("public shell does not import FieldDive app chrome or builder preview", () => {
    const files = [
      "page.tsx",
      "PublicProposalPage.tsx",
      "PublicProposalErrorPage.tsx",
      "PublicProposalHeader.tsx",
      "PublicProposalCoverSection.tsx",
      "PublicProposalDocumentPages.tsx",
      "PublicProposalEstimateSection.tsx",
      "PublicProposalFutureActions.tsx",
      "PublicProposalFooter.tsx",
    ];

    for (const file of files) {
      const source = readPublicRouteSource(file);
      assert.doesNotMatch(source, /FieldDiveAppShell/);
      assert.doesNotMatch(source, /RoofingClient/);
      assert.doesNotMatch(source, /ProposalBuilder/);
      assert.doesNotMatch(source, /ProposalCustomerPreviewClient/);
      assert.doesNotMatch(source, /getDraftGraph\(/);
      assert.doesNotMatch(source, /createAdminClient/);
    }
  });

  test("future actions component has no interactive behavior", () => {
    const source = readPublicRouteSource("PublicProposalFutureActions.tsx");
    assert.match(source, /aria-disabled="true"/);
    assert.doesNotMatch(source, /onClick/);
    assert.doesNotMatch(source, /<form/);
    assert.doesNotMatch(source, /fetch\(/);
    assert.doesNotMatch(source, /<Link/);
    assert.doesNotMatch(source, /href=/);
  });

  test("route layout provides public light surface without app shell", () => {
    const layout = readFileSync(PUBLIC_LAYOUT, "utf8");
    assert.match(layout, /bg-slate-100/);
    assert.doesNotMatch(layout, /FieldDiveAppShell/);
  });
});

describe("public proposal client payload audit", () => {
  test("document VM serializes without forbidden identifiers", () => {
    const vm = buildProposalPublicProposalDocumentViewModel(baseDto());
    const serialized = JSON.stringify(vm);

    assert.doesNotMatch(serialized, /"token_hash"\s*:/);
    assert.doesNotMatch(serialized, /"raw_token"\s*:/);
    assert.doesNotMatch(serialized, /"token_id"\s*:/);
    assert.doesNotMatch(serialized, /"company_id"\s*:/);
    assert.doesNotMatch(serialized, /"proposal_id"\s*:/);
    assert.doesNotMatch(serialized, /"proposal_version_id"\s*:/);
    assert.doesNotMatch(serialized, /"job_id"\s*:/);
    assert.doesNotMatch(serialized, /internal_unit_cost/);
  });

  test("future actions in document VM are deferred only", () => {
    const vm = buildProposalPublicProposalDocumentViewModel(baseDto());
    assert.equal(vm.futureActions.length, 3);
    for (const action of vm.futureActions) {
      assert.equal(action.availability, "deferred");
    }
  });
});
