/**
 * Proposal PDF Group 1 — frozen-version renderer tests.
 *
 * Run: npx tsx --test app/lib/proposalPdfRender.test.ts app/lib/proposalPdfFilename.test.ts app/lib/proposalPdfInput.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { PDFDocument } from "pdf-lib";

import {
  buildProposalPdfFilename,
  formatProposalPdfFrozenDate,
  sanitizeProposalPdfFilenameSegment,
} from "./proposalPdfFilename";
import {
  buildProposalPdfRenderInput,
  buildProposalPdfSignatureOverlayFromAcceptance,
} from "./proposalPdfInput";
import { renderProposalPdf } from "./proposalPdfRender";
import {
  PROPOSAL_PDF_ARTIFACT_SENT,
  PROPOSAL_PDF_ARTIFACT_SIGNED_FINAL,
  ProposalPdfError,
} from "./proposalPdfTypes";
import type { ProposalPaymentTerms } from "./proposalPaymentTerms";
import type {
  ProposalLineItemRow,
  ProposalPageRow,
  ProposalVersionGraph,
} from "./proposalRecordStore";
import type { ProposalSignatureMarkV1 } from "./proposalSignatureMark";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY = "22222222-2222-4222-8222-222222222222";
const PROPOSAL_ID = "33333333-3333-4333-8333-333333333333";
const VERSION_V1 = "55555555-5555-4555-8555-555555555555";
const VERSION_V2 = "66666666-6666-4666-8666-666666666666";
const TEMPLATE_OPT_A = "77777777-7777-4777-8777-777777777777";
const TEMPLATE_OPT_B = "88888888-8888-4888-8888-888888888888";
const RUNTIME_OPT_A = "99999999-9999-4999-8999-999999999999";
const RUNTIME_OPT_B = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PAGE_ESTIMATE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

/** Minimal valid 1×1 PNG. */
const TINY_PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  )
);

const PAYMENT_TERMS: ProposalPaymentTerms = {
  depositMode: "percent",
  depositPercentBps: 1000,
  depositFixedCents: null,
  depositDueTrigger: "on_acceptance",
  balanceDueTrigger: "on_completion",
};

function textIndexHas(index: string[] | undefined, needle: string | RegExp): boolean {
  if (!index) return false;
  if (typeof needle === "string") {
    return index.some((line) => line.includes(needle));
  }
  return index.some((line) => needle.test(line));
}

function textIndexLacks(index: string[] | undefined, needle: string | RegExp): boolean {
  return !textIndexHas(index, needle);
}

function baseLine(overrides: Partial<ProposalLineItemRow> = {}): ProposalLineItemRow {
  return {
    id: "12121212-1212-4212-8212-121212121212",
    company_id: COMPANY_ID,
    proposal_option_id: RUNTIME_OPT_A,
    source_template_item_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    catalog_item_id: null,
    catalog_seed_key: null,
    section_id: null,
    page_id: PAGE_ESTIMATE,
    sort_order: 0,
    customer_name: "Tear-off and disposal",
    description: null,
    role: null,
    quantity: 1,
    quantity_display_label: "1",
    quantity_source_label: null,
    unit: "EA",
    customer_unit_price_cents: 50000,
    customer_line_total_cents: 50000,
    pricing_status: "priced",
    visible_to_customer: true,
    measurement_quantity_key: null,
    created_at: "2026-08-14T12:00:00.000Z",
    updated_at: "2026-08-14T12:00:00.000Z",
    ...overrides,
  };
}

function sentGraph(overrides: {
  versionId?: string;
  versionNumber?: number;
  frozenAt?: string;
  versionKind?: string;
  companyId?: string;
  selectedOptionId?: string;
  lineItems?: ProposalLineItemRow[];
  pages?: ProposalPageRow[];
  optionTotalCents?: number;
  optionLabel?: string;
  secondOption?: boolean;
} = {}): ProposalVersionGraph {
  const versionId = overrides.versionId ?? VERSION_V1;
  const companyId = overrides.companyId ?? COMPANY_ID;
  const selectedOptionId = overrides.selectedOptionId ?? RUNTIME_OPT_A;
  const optionTotal = overrides.optionTotalCents ?? 1875750;

  const pages: ProposalPageRow[] = overrides.pages ?? [
    {
      id: PAGE_ESTIMATE,
      company_id: companyId,
      proposal_version_id: versionId,
      page_type: "estimate",
      sort_order: 10,
      title: "Estimate",
      customer_title: null,
      visible_to_customer: true,
      source_template_section_id: null,
      content_json: {},
      settings_json: { show_line_prices: true, show_option_totals: true },
      created_at: "2026-08-14T12:00:00.000Z",
      updated_at: "2026-08-14T12:00:00.000Z",
    },
    {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      company_id: companyId,
      proposal_version_id: versionId,
      page_type: "terms",
      sort_order: 20,
      title: "Terms",
      customer_title: "Terms & conditions",
      visible_to_customer: true,
      source_template_section_id: null,
      content_json: {
        body_markdown:
          "Payment is due as stated. Workmanship coverage is confirmed at install.",
      },
      settings_json: {},
      created_at: "2026-08-14T12:00:00.000Z",
      updated_at: "2026-08-14T12:00:00.000Z",
    },
    {
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      company_id: companyId,
      proposal_version_id: versionId,
      page_type: "photos",
      sort_order: 30,
      title: "Photos",
      customer_title: null,
      visible_to_customer: true,
      source_template_section_id: null,
      content_json: {},
      settings_json: {},
      created_at: "2026-08-14T12:00:00.000Z",
      updated_at: "2026-08-14T12:00:00.000Z",
    },
    {
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      company_id: companyId,
      proposal_version_id: versionId,
      page_type: "pdf_attachment",
      sort_order: 40,
      title: "Attachments",
      customer_title: null,
      visible_to_customer: true,
      source_template_section_id: null,
      content_json: {},
      settings_json: {},
      created_at: "2026-08-14T12:00:00.000Z",
      updated_at: "2026-08-14T12:00:00.000Z",
    },
  ];

  const options = [
    {
      id: RUNTIME_OPT_A,
      company_id: companyId,
      proposal_version_id: versionId,
      source_template_option_id: TEMPLATE_OPT_A,
      name: "Enhanced",
      customer_label: overrides.optionLabel ?? "Enhanced",
      description: "Balanced protection for your home.",
      sort_order: 0,
      is_default: true,
      visible_to_customer: true,
      customer_subtotal_cents: optionTotal,
      discount_cents: 0,
      sales_tax_cents: 0,
      customer_total_cents: optionTotal,
      pricing_complete: true,
      blocking_line_count: 0,
      guardrail_outcome: "ok",
      selected_at: null,
      created_at: "2026-08-14T12:00:00.000Z",
      updated_at: "2026-08-14T12:00:00.000Z",
    },
  ];

  if (overrides.secondOption) {
    options.push({
      id: RUNTIME_OPT_B,
      company_id: companyId,
      proposal_version_id: versionId,
      source_template_option_id: TEMPLATE_OPT_B,
      name: "Premium",
      customer_label: "Premium",
      description: "Top-tier package.",
      sort_order: 1,
      is_default: false,
      visible_to_customer: true,
      customer_subtotal_cents: 2200000,
      discount_cents: 0,
      sales_tax_cents: 0,
      customer_total_cents: 2200000,
      pricing_complete: true,
      blocking_line_count: 0,
      guardrail_outcome: "ok",
      selected_at: null,
      created_at: "2026-08-14T12:00:00.000Z",
      updated_at: "2026-08-14T12:00:00.000Z",
    });
  }

  const lineItems =
    overrides.lineItems ??
    [
      baseLine({ company_id: companyId, proposal_option_id: selectedOptionId }),
      baseLine({
        id: "14141414-1414-4414-8414-141414141414",
        company_id: companyId,
        proposal_option_id: selectedOptionId,
        source_template_item_id: "15151515-1515-4515-8515-151515151515",
        sort_order: 1,
        customer_name: "Hidden line",
        visible_to_customer: false,
        customer_line_total_cents: 999,
      }),
      baseLine({
        id: "16161616-1616-4616-8616-161616161616",
        company_id: companyId,
        proposal_option_id: selectedOptionId,
        source_template_item_id: "17171717-1717-4717-8717-171717171717",
        sort_order: 2,
        customer_name: "Omitted line",
        pricing_status: "omitted",
        customer_line_total_cents: null,
      }),
      baseLine({
        id: "18181818-1818-4818-8818-181818181818",
        company_id: companyId,
        proposal_option_id: selectedOptionId,
        source_template_item_id: "19191919-1919-4919-8919-191919191919",
        sort_order: 3,
        customer_name: "Ridge vent upgrade",
        role: "upgrade",
        upgrade_selection_state: "selected",
        customer_unit_price_cents: 45000,
        customer_line_total_cents: 45000,
      } as ProposalLineItemRow),
      baseLine({
        id: "20202020-2020-4202-8202-202020202020",
        company_id: companyId,
        proposal_option_id: selectedOptionId,
        source_template_item_id: "21212121-2121-4212-8212-212121212121",
        sort_order: 4,
        customer_name: "Unselected skylight",
        role: "upgrade",
        upgrade_selection_state: "not_selected",
        customer_line_total_cents: 120000,
      } as ProposalLineItemRow),
    ];

  return {
    proposal: {
      id: PROPOSAL_ID,
      company_id: companyId,
      job_id: "22222222-2222-4222-8222-222222222222",
      customer_id: null,
      template_id: "66666666-6666-4666-8666-666666666666",
      status: "sent",
      current_draft_version_id: versionId,
      latest_sent_version_id: versionId,
      signed_version_id: null,
      selected_option_id: selectedOptionId,
      measurement_record_id: null,
      pricing_policy_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      proposal_number: "P-1042",
      title: "Roof replacement",
      created_by: null,
      updated_by: null,
      created_at: "2026-08-14T12:00:00.000Z",
      updated_at: "2026-08-14T12:00:00.000Z",
      draft_content_changed_at: "2026-08-14T12:00:00.000Z",
      archived_at: null,
      deleted_at: null,
    },
    version: {
      id: versionId,
      company_id: companyId,
      proposal_id: PROPOSAL_ID,
      version_number: overrides.versionNumber ?? 1,
      version_kind: overrides.versionKind ?? "sent",
      parent_version_id: null,
      frozen_at: overrides.frozenAt ?? "2026-08-14T16:30:00.000Z",
      context_echo: {
        company_name: "Harris Roofing",
        company_phone: "555-0100",
        company_email: "hello@harris.example",
        company_logo_url: null,
        customer_name: "Babby D",
        customer_email: "babby@example.com",
        address_formatted: "123 Main St",
        job_name: "Babby D roof",
        proposal_number: "P-1042",
      },
      policy_echo: { configured: true },
      created_by: null,
      created_at: "2026-08-14T12:00:00.000Z",
    },
    pages,
    options,
    lineItems,
    internalSummaries: [],
  } as ProposalVersionGraph;
}

describe("proposalPdfFilename", () => {
  test("sanitizes unsafe characters and collapses whitespace", () => {
    assert.equal(
      sanitizeProposalPdfFilenameSegment('Harris / Roofing<>:"', "Company"),
      "Harris-Roofing"
    );
  });

  test("uses frozen_at UTC date and signed suffix", () => {
    assert.equal(formatProposalPdfFrozenDate("2026-08-14T16:30:00.000Z"), "2026-08-14");
    const name = buildProposalPdfFilename({
      companyName: "Harris Roofing",
      customerName: "Babby D",
      frozenAt: "2026-08-14T16:30:00.000Z",
      artifactType: PROPOSAL_PDF_ARTIFACT_SIGNED_FINAL,
      versionNumber: 2,
    });
    assert.equal(name, "Harris-Roofing_Babby-D_Proposal_2026-08-14_v2_Signed.pdf");
    assert.doesNotMatch(name, /[0-9a-f]{8}-[0-9a-f]{4}/i);
  });

  test("omits version ordinal for version 1", () => {
    const name = buildProposalPdfFilename({
      companyName: "Harris Roofing",
      customerName: "Babby D",
      frozenAt: "2026-08-14T16:30:00.000Z",
      artifactType: PROPOSAL_PDF_ARTIFACT_SENT,
      versionNumber: 1,
    });
    assert.equal(name, "Harris-Roofing_Babby-D_Proposal_2026-08-14.pdf");
  });
});

describe("proposalPdfInput guards", () => {
  test("rejects draft version", () => {
    const graph = sentGraph({ versionKind: "draft", frozenAt: null as unknown as string });
    graph.version.frozen_at = null;
    assert.throws(
      () =>
        buildProposalPdfRenderInput({
          graph,
          proposalVersionId: VERSION_V1,
          companyId: COMPANY_ID,
          artifactType: PROPOSAL_PDF_ARTIFACT_SENT,
          paymentTerms: null,
        }),
      (err: unknown) =>
        err instanceof ProposalPdfError && err.code === "non_sent_version"
    );
  });

  test("rejects version id mismatch — no latest-pointer fallback", () => {
    const graph = sentGraph({ versionId: VERSION_V1 });
    assert.throws(
      () =>
        buildProposalPdfRenderInput({
          graph,
          proposalVersionId: VERSION_V2,
          companyId: COMPANY_ID,
          artifactType: PROPOSAL_PDF_ARTIFACT_SENT,
          paymentTerms: null,
        }),
      (err: unknown) =>
        err instanceof ProposalPdfError && err.code === "invalid_version"
    );
  });

  test("rejects company mismatch", () => {
    const graph = sentGraph();
    assert.throws(
      () =>
        buildProposalPdfRenderInput({
          graph,
          proposalVersionId: VERSION_V1,
          companyId: OTHER_COMPANY,
          artifactType: PROPOSAL_PDF_ARTIFACT_SENT,
          paymentTerms: null,
        }),
      (err: unknown) =>
        err instanceof ProposalPdfError && err.code === "company_mismatch"
    );
  });

  test("v1 input remains distinct when v2 graph exists", () => {
    const v1 = buildProposalPdfRenderInput({
      graph: sentGraph({
        versionId: VERSION_V1,
        versionNumber: 1,
        optionTotalCents: 1875750,
        optionLabel: "Enhanced",
      }),
      proposalVersionId: VERSION_V1,
      companyId: COMPANY_ID,
      artifactType: PROPOSAL_PDF_ARTIFACT_SENT,
      paymentTerms: PAYMENT_TERMS,
    });
    const v2 = buildProposalPdfRenderInput({
      graph: sentGraph({
        versionId: VERSION_V2,
        versionNumber: 2,
        optionTotalCents: 1999900,
        optionLabel: "Premium",
        frozenAt: "2026-08-20T10:00:00.000Z",
      }),
      proposalVersionId: VERSION_V2,
      companyId: COMPANY_ID,
      artifactType: PROPOSAL_PDF_ARTIFACT_SENT,
      paymentTerms: null,
    });
    assert.equal(v1.proposalVersionId, VERSION_V1);
    assert.equal(v2.proposalVersionId, VERSION_V2);
    assert.equal(v1.packet.estimate?.label, "Enhanced");
    assert.equal(v2.packet.estimate?.label, "Premium");
    assert.equal(v1.packet.selectedTotalCents, 1875750);
    assert.equal(v2.packet.selectedTotalCents, 1999900);
  });

  test("omits hidden/omitted/unselected upgrade lines from packet scope", () => {
    const input = buildProposalPdfRenderInput({
      graph: sentGraph(),
      proposalVersionId: VERSION_V1,
      companyId: COMPANY_ID,
      artifactType: PROPOSAL_PDF_ARTIFACT_SENT,
      paymentTerms: null,
    });
    const names = [
      ...(input.packet.estimate?.includedDetails ?? []).flatMap((g) =>
        g.lines.map((l) => l.name)
      ),
      ...(input.packet.upgrades?.items ?? []).map((i) => i.name),
    ];
    assert.ok(names.some((n) => /Tear-off/i.test(n)));
    assert.ok(names.some((n) => /Ridge vent/i.test(n)));
    assert.ok(!names.some((n) => /Hidden line/i.test(n)));
    assert.ok(!names.some((n) => /Omitted line/i.test(n)));
    assert.ok(!names.some((n) => /Unselected skylight/i.test(n)));
  });

  test("payment terms are version-scoped on the packet", () => {
    const input = buildProposalPdfRenderInput({
      graph: sentGraph(),
      proposalVersionId: VERSION_V1,
      companyId: COMPANY_ID,
      artifactType: PROPOSAL_PDF_ARTIFACT_SENT,
      paymentTerms: PAYMENT_TERMS,
    });
    assert.deepEqual(input.packet.paymentTerms, PAYMENT_TERMS);
  });

  test("authored text pages included; placeholder photo/pdf pages omitted", () => {
    const input = buildProposalPdfRenderInput({
      graph: sentGraph(),
      proposalVersionId: VERSION_V1,
      companyId: COMPANY_ID,
      artifactType: PROPOSAL_PDF_ARTIFACT_SENT,
      paymentTerms: null,
    });
    const titles = (input.packet.details?.tabs ?? []).map((t) => t.title);
    assert.ok(titles.some((t) => /Terms/i.test(t)));
    assert.ok(!titles.some((t) => /Photos/i.test(t)));
    assert.ok(!titles.some((t) => /Attachments/i.test(t)));
  });

  test("sent artifact strips signature even when overlay provided", () => {
    const overlay = buildProposalPdfSignatureOverlayFromAcceptance({
      acceptedAt: "2026-08-15T18:00:00.000Z",
      signedAt: "2026-08-15T18:01:00.000Z",
      signerPrintedName: "Babby D",
    });
    const input = buildProposalPdfRenderInput({
      graph: sentGraph(),
      proposalVersionId: VERSION_V1,
      companyId: COMPANY_ID,
      artifactType: PROPOSAL_PDF_ARTIFACT_SENT,
      paymentTerms: null,
      signatureOverlay: overlay,
    });
    assert.equal(input.signatureOverlay, null);
    assert.equal(input.packet.acceptance.status, "open");
  });

  test("signed_final requires overlay and keeps acceptance status", () => {
    assert.throws(
      () =>
        buildProposalPdfRenderInput({
          graph: sentGraph(),
          proposalVersionId: VERSION_V1,
          companyId: COMPANY_ID,
          artifactType: PROPOSAL_PDF_ARTIFACT_SIGNED_FINAL,
          paymentTerms: null,
        }),
      (err: unknown) =>
        err instanceof ProposalPdfError && err.code === "malformed_content"
    );

    const overlay = buildProposalPdfSignatureOverlayFromAcceptance({
      acceptedAt: "2026-08-15T18:00:00.000Z",
      signedAt: "2026-08-15T18:01:00.000Z",
      signerPrintedName: "Babby D",
    });
    const input = buildProposalPdfRenderInput({
      graph: sentGraph(),
      proposalVersionId: VERSION_V1,
      companyId: COMPANY_ID,
      artifactType: PROPOSAL_PDF_ARTIFACT_SIGNED_FINAL,
      paymentTerms: null,
      signatureOverlay: overlay,
    });
    assert.equal(input.signatureOverlay?.status, "signed");
    assert.equal(input.packet.acceptance.status, "signed");
    assert.equal(input.packet.acceptance.signerDisplayName, "Babby D");
  });
});

describe("proposalPdfRender", () => {
  test("renders valid non-empty PDF with selectable frozen presenter text", async () => {
    const input = buildProposalPdfRenderInput({
      graph: sentGraph(),
      proposalVersionId: VERSION_V1,
      companyId: COMPANY_ID,
      artifactType: PROPOSAL_PDF_ARTIFACT_SENT,
      paymentTerms: PAYMENT_TERMS,
    });
    const result = await renderProposalPdf(input, {
      fetchLogo: async () => ({ ok: false, reason: "skip" }),
      includeTextIndex: true,
    });
    assert.ok(result.bytes.byteLength > 500);
    assert.equal(Buffer.from(result.bytes.subarray(0, 4)).toString("utf8"), "%PDF");
    assert.equal(result.filename, "Harris-Roofing_Babby-D_Proposal_2026-08-14.pdf");
    assert.equal(result.artifactType, PROPOSAL_PDF_ARTIFACT_SENT);
    assert.ok(textIndexHas(result.textIndex, "Harris Roofing"));
    assert.ok(textIndexHas(result.textIndex, "Babby D"));
    assert.ok(textIndexHas(result.textIndex, "Enhanced"));
    assert.ok(textIndexHas(result.textIndex, "Tear-off and disposal"));
    assert.ok(textIndexHas(result.textIndex, "Ridge vent upgrade"));
    assert.ok(textIndexHas(result.textIndex, "Payment terms"));
    assert.ok(textIndexHas(result.textIndex, /Terms/));
    assert.ok(textIndexLacks(result.textIndex, "Hidden line"));
    assert.ok(textIndexLacks(result.textIndex, "Unselected skylight"));
    assert.ok(textIndexLacks(result.textIndex, VERSION_V1));
    assert.ok(textIndexLacks(result.textIndex, "/p/"));
    assert.ok(textIndexLacks(result.textIndex, "Signed by"));
    const loaded = await PDFDocument.load(result.bytes);
    assert.ok(loaded.getPageCount() >= 1);
  });

  test("signed_final includes acceptance overlay; sent does not", async () => {
    const mark: ProposalSignatureMarkV1 = {
      version: 1,
      strokes: [
        [
          { x: 0.1, y: 0.5 },
          { x: 0.9, y: 0.5 },
        ],
      ],
    };
    const overlay = buildProposalPdfSignatureOverlayFromAcceptance({
      acceptedAt: "2026-08-15T18:00:00.000Z",
      signedAt: "2026-08-15T18:01:00.000Z",
      signerPrintedName: "Babby D",
      drawnMark: mark,
    });
    const signedInput = buildProposalPdfRenderInput({
      graph: sentGraph(),
      proposalVersionId: VERSION_V1,
      companyId: COMPANY_ID,
      artifactType: PROPOSAL_PDF_ARTIFACT_SIGNED_FINAL,
      paymentTerms: null,
      signatureOverlay: overlay,
    });
    const signed = await renderProposalPdf(signedInput, {
      fetchLogo: async () => ({ ok: false, reason: "skip" }),
      includeTextIndex: true,
    });
    assert.match(signed.filename, /_Signed\.pdf$/);
    assert.ok(textIndexHas(signed.textIndex, "Acceptance"));
    assert.ok(textIndexHas(signed.textIndex, "Signed by: Babby D"));

    const sentLater = await renderProposalPdf(
      buildProposalPdfRenderInput({
        graph: sentGraph(),
        proposalVersionId: VERSION_V1,
        companyId: COMPANY_ID,
        artifactType: PROPOSAL_PDF_ARTIFACT_SENT,
        paymentTerms: null,
        signatureOverlay: overlay,
      }),
      { fetchLogo: async () => ({ ok: false, reason: "skip" }), includeTextIndex: true }
    );
    assert.ok(textIndexLacks(sentLater.textIndex, "Signed by"));
    assert.ok(textIndexLacks(sentLater.textIndex, "Acceptance"));
  });

  test("logo success embeds image; logo failure continues", async () => {
    const input = buildProposalPdfRenderInput({
      graph: sentGraph(),
      proposalVersionId: VERSION_V1,
      companyId: COMPANY_ID,
      artifactType: PROPOSAL_PDF_ARTIFACT_SENT,
      paymentTerms: null,
    });
    input.packet.cover.company.logoUrl = "https://cdn.example/logo.png";

    const withLogo = await renderProposalPdf(input, {
      fetchLogo: async () => ({ ok: true, bytes: TINY_PNG, mime: "image/png" }),
      includeTextIndex: true,
    });
    assert.ok(withLogo.bytes.byteLength > 500);

    const withoutLogo = await renderProposalPdf(input, {
      fetchLogo: async () => ({ ok: false, reason: "fetch_failed" }),
      includeTextIndex: true,
    });
    assert.ok(withoutLogo.bytes.byteLength > 500);
    assert.ok(textIndexHas(withoutLogo.textIndex, "Harris Roofing"));
  });

  test("long scope and long terms paginate without clipping", async () => {
    const longTerms = Array.from({ length: 40 }, (_, i) =>
      `Clause ${i + 1}: The homeowner acknowledges detailed warranty language for item ${i + 1}.`
    ).join("\n\n");
    const manyLines = Array.from({ length: 60 }, (_, i) =>
      baseLine({
        id: `12121212-1212-4212-8212-${String(i).padStart(12, "0")}`,
        source_template_item_id: `ffffffff-ffff-4fff-8fff-${String(i).padStart(12, "0")}`,
        sort_order: i,
        customer_name: `Scope line item number ${i + 1} for the roofing project`,
        customer_line_total_cents: 1000 + i,
      })
    );
    const graph = sentGraph({
      lineItems: manyLines,
      pages: [
        {
          id: PAGE_ESTIMATE,
          company_id: COMPANY_ID,
          proposal_version_id: VERSION_V1,
          page_type: "estimate",
          sort_order: 10,
          title: "Estimate",
          customer_title: null,
          visible_to_customer: true,
          source_template_section_id: null,
          content_json: {},
          settings_json: { show_line_prices: true, show_option_totals: true },
          created_at: "2026-08-14T12:00:00.000Z",
          updated_at: "2026-08-14T12:00:00.000Z",
        },
        {
          id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          company_id: COMPANY_ID,
          proposal_version_id: VERSION_V1,
          page_type: "warranty",
          sort_order: 20,
          title: "Warranty",
          customer_title: "Warranty",
          visible_to_customer: true,
          source_template_section_id: null,
          content_json: { body_markdown: longTerms },
          settings_json: {},
          created_at: "2026-08-14T12:00:00.000Z",
          updated_at: "2026-08-14T12:00:00.000Z",
        },
      ],
    });
    const input = buildProposalPdfRenderInput({
      graph,
      proposalVersionId: VERSION_V1,
      companyId: COMPANY_ID,
      artifactType: PROPOSAL_PDF_ARTIFACT_SENT,
      paymentTerms: null,
    });
    const result = await renderProposalPdf(input, {
      fetchLogo: async () => ({ ok: false, reason: "skip" }),
      includeTextIndex: true,
    });
    assert.ok(result.pageCount >= 2);
    assert.ok(textIndexHas(result.textIndex, "Scope line item number 1"));
    assert.ok(textIndexHas(result.textIndex, "Scope line item number 60"));
    assert.ok(textIndexHas(result.textIndex, "Clause 1:"));
    assert.ok(textIndexHas(result.textIndex, "Clause 40:"));
  });
});

describe("proposalPdf legacy isolation", () => {
  test("new PDF modules do not import legacy estimate PDF builder", () => {
    const files = [
      "app/lib/proposalPdfTypes.ts",
      "app/lib/proposalPdfFilename.ts",
      "app/lib/proposalPdfInput.ts",
      "app/lib/proposalPdfText.ts",
      "app/lib/proposalPdfLogo.ts",
      "app/lib/proposalPdfRender.ts",
    ];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /from ["'].*RoofingClient/);
      assert.doesNotMatch(source, /generateProposalPdfBytes/);
      assert.doesNotMatch(source, /estimate\/send/);
    }
  });

  test("Job Card still does not import pdf-lib", () => {
    const source = readFileSync("app/tools/roofing/jobCard/JobCardClient.tsx", "utf8");
    assert.doesNotMatch(source, /pdf-lib/);
  });

  test("draft Preview still has no Download PDF", () => {
    const source = readFileSync(
      "app/tools/roofing/proposals/preview/ProposalCustomerPreviewClient.tsx",
      "utf8"
    );
    assert.doesNotMatch(source, /Download PDF/);
  });

  test("Group 1 did not add download routes", () => {
    const render = readFileSync("app/lib/proposalPdfRender.ts", "utf8");
    assert.doesNotMatch(render, /\/api\/proposals\/.*pdf/);
    assert.doesNotMatch(render, /Save PDF/);
  });
});
