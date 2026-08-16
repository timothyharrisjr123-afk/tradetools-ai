/**
 * R18C4A — proposalPublicAccessOrchestrator.server tests.
 *
 * Run: npx tsx --test app/lib/proposalPublicAccessOrchestrator.server.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { hashProposalPublicAccessToken } from "./proposalPublicAccessTokenHash";
import { loadPublicProposalByToken } from "./proposalPublicAccessOrchestrator";
import type { ProposalPublicGraphDto } from "./proposalPublicGraphDto";
import type { ProposalVersionGraph } from "./proposalRecordStore";
import { ProposalRecordStoreError } from "./proposalRecordStore";

const RAW_TOKEN = "fielddive-r18c4a-public-token-value";
const TOKEN_ID = "11111111-1111-4111-8111-111111111111";
const COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const PROPOSAL_ID = "33333333-3333-4333-8333-333333333333";
const VERSION_ID = "44444444-4444-4444-8444-444444444444";
const TEMPLATE_OPT_A = "77777777-7777-4777-8777-777777777777";
const RUNTIME_OPT_A = "99999999-9999-4999-8999-999999999999";

function minimalPacketStub() {
  return {
    cover: {
      proposalLabel: "Your roofing proposal",
      headline: "Roof Replacement",
      confidenceCopy: "A clear roof replacement proposal prepared for your home.",
      coverMediaUrl: null,
      company: {
        companyName: "Summit Roofing",
        preparedByLabel: "Summit Roofing",
        logoUrl: null,
        logoMonogram: "SR",
        brandPrimaryColor: null,
        brandSecondaryColor: null,
      },
      preparedFor: {
        customerName: "Jane Homeowner",
        customerEmail: null,
        customerPhone: null,
        hasAnyField: true,
      },
      project: {
        jobName: null,
        propertyAddress: "123 Main St",
        hasAnyField: true,
      },
    },
    estimate: null,
    comparison: null,
    upgrades: null,
    details: null,
    contact: null,
    footerMetadata: null,
    acceptance: { status: "open" as const, acceptedOnLabel: null },
  };
}

function resolveSuccess() {
  return {
    ok: true as const,
    token_id: TOKEN_ID,
    company_id: COMPANY_ID,
    proposal_id: PROPOSAL_ID,
    proposal_version_id: VERSION_ID,
    purpose: "customer_view",
    status: "active",
    expires_at: "2026-12-31T23:59:59.000Z",
  };
}

function versionGraph(): ProposalVersionGraph {
  return {
    proposal: {
      id: PROPOSAL_ID,
      company_id: COMPANY_ID,
      selected_option_id: RUNTIME_OPT_A,
      proposal_number: "P-100",
      title: "Roof Replacement",
    } as ProposalVersionGraph["proposal"],
    version: {
      id: VERSION_ID,
      company_id: COMPANY_ID,
      proposal_id: PROPOSAL_ID,
      version_kind: "sent",
      frozen_at: "2026-06-26T12:00:00.000Z",
      context_echo: {
        company_name: "Summit Roofing",
        customer_name: "Jane Homeowner",
        address_formatted: "123 Main St",
        template_name: "Roof Replacement",
      },
      policy_echo: {},
    } as ProposalVersionGraph["version"],
    pages: [
      {
        page_type: "estimate",
        sort_order: 10,
        title: "Estimate",
        customer_title: null,
        visible_to_customer: true,
        content_json: {},
        settings_json: {},
      } as ProposalVersionGraph["pages"][number],
    ],
    options: [
      {
        id: RUNTIME_OPT_A,
        source_template_option_id: TEMPLATE_OPT_A,
        name: "Standard",
        customer_label: "Standard",
        description: null,
        sort_order: 0,
        is_default: true,
        visible_to_customer: true,
        customer_subtotal_cents: 10000,
        discount_cents: 0,
        sales_tax_cents: 0,
        customer_total_cents: 10000,
      } as ProposalVersionGraph["options"][number],
    ],
    lineItems: [
      {
        proposal_option_id: RUNTIME_OPT_A,
        source_template_item_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        customer_name: "Shingles",
        visible_to_customer: true,
        pricing_status: "priced",
        customer_line_total_cents: 10000,
        customer_unit_price_cents: 10000,
        quantity: 1,
        quantity_display_label: "1",
        unit: "SQ",
      } as ProposalVersionGraph["lineItems"][number],
    ],
    internalSummaries: [],
  };
}

function publicDto(): ProposalPublicGraphDto {
  return {
    version_kind: "sent",
    frozen_at: "2026-06-26T12:00:00.000Z",
    context_echo: versionGraph().version.context_echo as Record<string, unknown>,
    policy_echo: {},
    selected_template_option_id: TEMPLATE_OPT_A,
    pages: [
      {
        page_type: "estimate",
        sort_order: 10,
        title: "Estimate",
        customer_title: null,
        visible_to_customer: true,
        content_json: {},
        settings_json: {},
      },
    ],
    options: [
      {
        source_template_option_id: TEMPLATE_OPT_A,
        name: "Standard",
        customer_label: "Standard",
        description: null,
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

describe("loadPublicProposalByToken", () => {
  test("success call order: resolve → graph → DTO → VM → record", async () => {
    const calls: string[] = [];
    let resolveRawToken = "";
    let recordRawToken = "";

    const result = await loadPublicProposalByToken(
      RAW_TOKEN,
      {},
      {
        resolveToken: async (rawToken) => {
          calls.push("resolve");
          resolveRawToken = rawToken;
          return resolveSuccess();
        },
        getVersionGraph: async () => {
          calls.push("graph");
          return versionGraph();
        },
        buildDto: () => {
          calls.push("dto");
          return publicDto();
        },
        buildDocumentViewModel: (dto) => {
          calls.push("vm");
          assert.equal(dto.selected_template_option_id, TEMPLATE_OPT_A);
          return {
            kind: "document",
            packet: minimalPacketStub(),
            meta: {
              statusLabel: "Review proposal",
              versionKind: "sent",
              frozenAt: dto.frozen_at,
              proposalTitle: "Roof Replacement",
            },
            header: {
              company: {
                companyName: "Summit Roofing",
                logoUrl: null,
                logoMonogram: "SR",
                brandPrimaryColor: null,
                brandSecondaryColor: null,
                hasAnyField: true,
              },
              statusLabel: "Review proposal",
              identity: {
                customerName: "Jane Homeowner",
                propertyAddress: "123 Main St",
                proposalNumber: null,
                hasAnyField: true,
              },
            },
            cover: {
              headline: "Roof Replacement",
              company: {
                companyName: "Summit Roofing",
                phone: null,
                email: null,
                website: null,
                license: null,
                address: null,
                hasAnyField: true,
              },
              customer: {
                customerName: "Jane Homeowner",
                customerEmail: null,
                customerPhone: null,
                hasAnyField: true,
              },
              project: {
                jobName: null,
                propertyAddress: "123 Main St",
                hasAnyField: true,
              },
              packageSummary: {
                packageName: "Standard",
                totalDisplay: "$100.00",
                hasTotal: true,
              },
              heroContent: null,
            },
            pages: [],
            estimate: {
              layout: "selected_primary",
              primaryPackage: null,
              alternateOptions: [],
              optionalUpgrades: [],
              selectedOption: null,
              displayPolicy: dto.displayPolicy,
            },
            futureActions: [],
            footer: {
              company: {
                companyName: "Summit Roofing",
                phone: null,
                email: null,
                website: null,
                license: null,
                address: null,
                hasAnyField: true,
              },
              supportMessage: "Contact your contractor with any questions about this proposal.",
            },
          };
        },
        recordView: async (rawToken) => {
          calls.push("record");
          recordRawToken = rawToken;
          return {
            ok: true,
            event_type: "first_view",
            token_id: TOKEN_ID,
            proposal_id: PROPOSAL_ID,
            proposal_version_id: VERSION_ID,
          };
        },
      }
    );

    assert.equal(result.ok, true);
    assert.deepEqual(calls, ["resolve", "graph", "dto", "vm", "record"]);
    assert.equal(resolveRawToken, RAW_TOKEN);
    assert.equal(recordRawToken, RAW_TOKEN);
    if (result.ok) {
      assert.equal(result.tracking.view_recorded, true);
      assert.equal(result.tracking.view_event_type, "first_view");
      assert.equal(result.document.kind, "document");
      assert.doesNotMatch(JSON.stringify(result.document), /token_id/);
    }
  });

  test("resolve failure returns safe error and does not load graph or record", async () => {
    let graphCalled = false;
    let recordCalled = false;

    const result = await loadPublicProposalByToken(RAW_TOKEN, {}, {
      resolveToken: async () => ({ ok: false, code: "expired" }),
      getVersionGraph: async () => {
        graphCalled = true;
        return versionGraph();
      },
      buildDto: () => publicDto(),
      buildDocumentViewModel: () => ({
        kind: "document",
        packet: minimalPacketStub(),
        meta: { statusLabel: "Review proposal", versionKind: "sent", frozenAt: null, proposalTitle: null },
        header: {
          company: { companyName: null, logoUrl: null, logoMonogram: null, brandPrimaryColor: null, brandSecondaryColor: null, hasAnyField: false },
          statusLabel: "Review proposal",
          identity: { customerName: null, propertyAddress: null, proposalNumber: null, hasAnyField: false },
        },
        cover: {
          headline: null,
          company: { companyName: null, phone: null, email: null, website: null, license: null, address: null, hasAnyField: false },
          customer: { customerName: null, customerEmail: null, customerPhone: null, hasAnyField: false },
          project: { jobName: null, propertyAddress: null, hasAnyField: false },
          packageSummary: { packageName: null, totalDisplay: null, hasTotal: false },
          heroContent: null,
        },
        pages: [],
        estimate: { layout: "selected_primary", primaryPackage: null, alternateOptions: [], optionalUpgrades: [], selectedOption: null, displayPolicy: { showLinePrices: true, showOptionTotals: true, showSectionHeadings: true } },
        futureActions: [],
        footer: { company: { companyName: null, phone: null, email: null, website: null, license: null, address: null, hasAnyField: false }, supportMessage: "Contact your contractor with any questions about this proposal." },
      }),
      recordView: async () => {
        recordCalled = true;
        return { ok: true, event_type: "view", token_id: TOKEN_ID, proposal_id: PROPOSAL_ID, proposal_version_id: VERSION_ID };
      },
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "expired_token");
    }
    assert.equal(graphCalled, false);
    assert.equal(recordCalled, false);
  });

  test("graph null returns safe error and does not record", async () => {
    let recordCalled = false;

    const result = await loadPublicProposalByToken(RAW_TOKEN, {}, {
      resolveToken: async () => resolveSuccess(),
      getVersionGraph: async () => null,
      buildDto: () => publicDto(),
      buildDocumentViewModel: () => ({
        kind: "document",
        packet: minimalPacketStub(),
        meta: { statusLabel: "Review proposal", versionKind: "sent", frozenAt: null, proposalTitle: null },
        header: {
          company: { companyName: null, logoUrl: null, logoMonogram: null, brandPrimaryColor: null, brandSecondaryColor: null, hasAnyField: false },
          statusLabel: "Review proposal",
          identity: { customerName: null, propertyAddress: null, proposalNumber: null, hasAnyField: false },
        },
        cover: {
          headline: null,
          company: { companyName: null, phone: null, email: null, website: null, license: null, address: null, hasAnyField: false },
          customer: { customerName: null, customerEmail: null, customerPhone: null, hasAnyField: false },
          project: { jobName: null, propertyAddress: null, hasAnyField: false },
          packageSummary: { packageName: null, totalDisplay: null, hasTotal: false },
          heroContent: null,
        },
        pages: [],
        estimate: { layout: "selected_primary", primaryPackage: null, alternateOptions: [], optionalUpgrades: [], selectedOption: null, displayPolicy: { showLinePrices: true, showOptionTotals: true, showSectionHeadings: true } },
        futureActions: [],
        footer: { company: { companyName: null, phone: null, email: null, website: null, license: null, address: null, hasAnyField: false }, supportMessage: "Contact your contractor with any questions about this proposal." },
      }),
      recordView: async () => {
        recordCalled = true;
        return { ok: true, event_type: "view", token_id: TOKEN_ID, proposal_id: PROPOSAL_ID, proposal_version_id: VERSION_ID };
      },
    });

    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, "graph_unavailable");
    assert.equal(recordCalled, false);
  });

  test("requireSentVersion rejection returns graph_unavailable and does not record", async () => {
    let recordCalled = false;

    const result = await loadPublicProposalByToken(RAW_TOKEN, {}, {
      resolveToken: async () => resolveSuccess(),
      getVersionGraph: async () => {
        throw new ProposalRecordStoreError("Version is not sent");
      },
      buildDto: () => publicDto(),
      buildDocumentViewModel: () => ({
        kind: "document",
        packet: minimalPacketStub(),
        meta: { statusLabel: "Review proposal", versionKind: "sent", frozenAt: null, proposalTitle: null },
        header: {
          company: { companyName: null, logoUrl: null, logoMonogram: null, brandPrimaryColor: null, brandSecondaryColor: null, hasAnyField: false },
          statusLabel: "Review proposal",
          identity: { customerName: null, propertyAddress: null, proposalNumber: null, hasAnyField: false },
        },
        cover: {
          headline: null,
          company: { companyName: null, phone: null, email: null, website: null, license: null, address: null, hasAnyField: false },
          customer: { customerName: null, customerEmail: null, customerPhone: null, hasAnyField: false },
          project: { jobName: null, propertyAddress: null, hasAnyField: false },
          packageSummary: { packageName: null, totalDisplay: null, hasTotal: false },
          heroContent: null,
        },
        pages: [],
        estimate: { layout: "selected_primary", primaryPackage: null, alternateOptions: [], optionalUpgrades: [], selectedOption: null, displayPolicy: { showLinePrices: true, showOptionTotals: true, showSectionHeadings: true } },
        futureActions: [],
        footer: { company: { companyName: null, phone: null, email: null, website: null, license: null, address: null, hasAnyField: false }, supportMessage: "Contact your contractor with any questions about this proposal." },
      }),
      recordView: async () => {
        recordCalled = true;
        return { ok: true, event_type: "view", token_id: TOKEN_ID, proposal_id: PROPOSAL_ID, proposal_version_id: VERSION_ID };
      },
    });

    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, "graph_unavailable");
    assert.equal(recordCalled, false);
  });

  test("view model throw returns internal_error and does not record", async () => {
    let recordCalled = false;

    const result = await loadPublicProposalByToken(RAW_TOKEN, {}, {
      resolveToken: async () => resolveSuccess(),
      getVersionGraph: async () => versionGraph(),
      buildDto: () => publicDto(),
      buildDocumentViewModel: () => {
        throw new Error("vm failed");
      },
      recordView: async () => {
        recordCalled = true;
        return { ok: true, event_type: "view", token_id: TOKEN_ID, proposal_id: PROPOSAL_ID, proposal_version_id: VERSION_ID };
      },
    });

    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, "internal_error");
    assert.equal(recordCalled, false);
  });

  test("record failure returns internal_error", async () => {
    const result = await loadPublicProposalByToken(RAW_TOKEN, {}, {
      resolveToken: async () => resolveSuccess(),
      getVersionGraph: async () => versionGraph(),
      buildDto: () => publicDto(),
      buildDocumentViewModel: () => ({
        kind: "document",
        packet: minimalPacketStub(),
        meta: {
          statusLabel: "Review proposal",
          versionKind: "sent",
          frozenAt: null,
          proposalTitle: null,
        },
        header: {
          company: {
            companyName: null,
            logoUrl: null,
            logoMonogram: null,
            brandPrimaryColor: null,
            brandSecondaryColor: null,
            hasAnyField: false,
          },
          statusLabel: "Review proposal",
          identity: {
            customerName: null,
            propertyAddress: null,
            proposalNumber: null,
            hasAnyField: false,
          },
        },
        cover: {
          headline: null,
          company: {
            companyName: null,
            phone: null,
            email: null,
            website: null,
            license: null,
            address: null,
            hasAnyField: false,
          },
          customer: {
            customerName: null,
            customerEmail: null,
            customerPhone: null,
            hasAnyField: false,
          },
          project: {
            jobName: null,
            propertyAddress: null,
            hasAnyField: false,
          },
          packageSummary: {
            packageName: null,
            totalDisplay: null,
            hasTotal: false,
          },
          heroContent: null,
        },
        pages: [],
        estimate: {
          layout: "selected_primary",
          primaryPackage: null,
          alternateOptions: [],
          optionalUpgrades: [],
          selectedOption: null,
          displayPolicy: {
            showLinePrices: true,
            showOptionTotals: true,
            showSectionHeadings: true,
          },
        },
        futureActions: [],
        footer: {
          company: {
            companyName: null,
            phone: null,
            email: null,
            website: null,
            license: null,
            address: null,
            hasAnyField: false,
          },
          supportMessage: "Contact your contractor with any questions about this proposal.",
        },
      }),
      recordView: async () => ({ ok: false, code: "invalid_payload" }),
    });

    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, "internal_error");
  });

  test("whitespace-only token rejected before RPC", async () => {
    let resolveCalled = false;
    const result = await loadPublicProposalByToken("   ", {}, {
      resolveToken: async () => {
        resolveCalled = true;
        return resolveSuccess();
      },
      getVersionGraph: async () => versionGraph(),
      buildDto: () => publicDto(),
      buildDocumentViewModel: () => ({
        kind: "document",
        packet: minimalPacketStub(),
        meta: { statusLabel: "Review proposal", versionKind: "sent", frozenAt: null, proposalTitle: null },
        header: {
          company: { companyName: null, logoUrl: null, logoMonogram: null, brandPrimaryColor: null, brandSecondaryColor: null, hasAnyField: false },
          statusLabel: "Review proposal",
          identity: { customerName: null, propertyAddress: null, proposalNumber: null, hasAnyField: false },
        },
        cover: {
          headline: null,
          company: { companyName: null, phone: null, email: null, website: null, license: null, address: null, hasAnyField: false },
          customer: { customerName: null, customerEmail: null, customerPhone: null, hasAnyField: false },
          project: { jobName: null, propertyAddress: null, hasAnyField: false },
          packageSummary: { packageName: null, totalDisplay: null, hasTotal: false },
          heroContent: null,
        },
        pages: [],
        estimate: { layout: "selected_primary", primaryPackage: null, alternateOptions: [], optionalUpgrades: [], selectedOption: null, displayPolicy: { showLinePrices: true, showOptionTotals: true, showSectionHeadings: true } },
        futureActions: [],
        footer: { company: { companyName: null, phone: null, email: null, website: null, license: null, address: null, hasAnyField: false }, supportMessage: "Contact your contractor with any questions about this proposal." },
      }),
      recordView: async () => ({
        ok: true,
        event_type: "view",
        token_id: TOKEN_ID,
        proposal_id: PROPOSAL_ID,
        proposal_version_id: VERSION_ID,
      }),
    });

    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, "invalid_token");
    assert.equal(resolveCalled, false);
  });

  test("raw token passed exact to resolve and record on success", async () => {
    const exactToken = "AbCdEf_-123.base64url";
    const tokens: string[] = [];

    await loadPublicProposalByToken(exactToken, {}, {
      resolveToken: async (rawToken) => {
        tokens.push(rawToken);
        return resolveSuccess();
      },
      getVersionGraph: async () => versionGraph(),
      buildDto: () => publicDto(),
      buildDocumentViewModel: () => ({
        kind: "document",
        packet: minimalPacketStub(),
        meta: {
          statusLabel: "Review proposal",
          versionKind: "sent",
          frozenAt: null,
          proposalTitle: null,
        },
        header: {
          company: {
            companyName: null,
            logoUrl: null,
            logoMonogram: null,
            brandPrimaryColor: null,
            brandSecondaryColor: null,
            hasAnyField: false,
          },
          statusLabel: "Review proposal",
          identity: {
            customerName: null,
            propertyAddress: null,
            proposalNumber: null,
            hasAnyField: false,
          },
        },
        cover: {
          headline: null,
          company: {
            companyName: null,
            phone: null,
            email: null,
            website: null,
            license: null,
            address: null,
            hasAnyField: false,
          },
          customer: {
            customerName: null,
            customerEmail: null,
            customerPhone: null,
            hasAnyField: false,
          },
          project: {
            jobName: null,
            propertyAddress: null,
            hasAnyField: false,
          },
          packageSummary: {
            packageName: null,
            totalDisplay: null,
            hasTotal: false,
          },
          heroContent: null,
        },
        pages: [],
        estimate: {
          layout: "selected_primary",
          primaryPackage: null,
          alternateOptions: [],
          optionalUpgrades: [],
          selectedOption: null,
          displayPolicy: {
            showLinePrices: true,
            showOptionTotals: true,
            showSectionHeadings: true,
          },
        },
        futureActions: [],
        footer: {
          company: {
            companyName: null,
            phone: null,
            email: null,
            website: null,
            license: null,
            address: null,
            hasAnyField: false,
          },
          supportMessage: "Contact your contractor with any questions about this proposal.",
        },
      }),
      recordView: async (rawToken) => {
        tokens.push(rawToken);
        return {
          ok: true,
          event_type: "view",
          token_id: TOKEN_ID,
          proposal_id: PROPOSAL_ID,
          proposal_version_id: VERSION_ID,
        };
      },
    });

    assert.deepEqual(tokens, [exactToken, exactToken]);
    assert.equal(hashProposalPublicAccessToken(exactToken).length, 64);
  });
});

describe("forbidden exposure guardrails", () => {
  test("orchestrator core source does not import app/tools or React", () => {
    const source = readFileSync(
      new URL("./proposalPublicAccessOrchestrator.ts", import.meta.url),
      "utf8"
    );
    assert.doesNotMatch(source, /from "react"/);
    assert.doesNotMatch(source, /app\/tools/);
    assert.doesNotMatch(source, /getDraftGraph\(/);
  });

  test("server entry module imports server-only and public version graph loader", () => {
    const source = readFileSync(
      new URL("./proposalPublicAccessOrchestrator.server.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /import "server-only"/);
    assert.match(source, /getPublicProposalVersionGraph/);
    assert.match(source, /proposalVersionGraphStore\.server/);
    assert.doesNotMatch(source, /from "@\/app\/lib\/supabaseClient"/);
    assert.doesNotMatch(source, /from "@\/app\/lib\/proposalRecordStore"/);
  });

  test("public route page exists and follows R18C4B guardrails", () => {
    const source = readFileSync(
      new URL("../p/[token]/page.tsx", import.meta.url),
      "utf8"
    );
    assert.match(source, /loadPublicProposalByToken/);
    assert.match(source, /PublicProposalPage document=\{result\.document\}/);
    assert.match(source, /publicAccessToken=\{token\}/);
    assert.doesNotMatch(source, /result\.tracking/);
    assert.doesNotMatch(source, /searchParams/);
    assert.doesNotMatch(source, /getDraftGraph\(/);
  });
});

describe("R3D signed/accepted overlay", () => {
  function documentVm() {
    return {
      kind: "document" as const,
      packet: minimalPacketStub(),
      meta: {
        statusLabel: "Review proposal" as const,
        versionKind: "sent" as const,
        frozenAt: "2026-06-26T12:00:00.000Z",
        proposalTitle: "Roof Replacement",
      },
      header: {
        company: {
          companyName: "Summit Roofing",
          logoUrl: null,
          logoMonogram: "SR",
          brandPrimaryColor: null,
          brandSecondaryColor: null,
          hasAnyField: true,
        },
        statusLabel: "Review proposal" as const,
        identity: {
          customerName: "Jane Homeowner",
          propertyAddress: "123 Main St",
          proposalNumber: null,
          hasAnyField: true,
        },
      },
      cover: {
        headline: "Roof Replacement",
        company: {
          companyName: "Summit Roofing",
          phone: null,
          email: null,
          website: null,
          license: null,
          address: null,
          hasAnyField: true,
        },
        customer: {
          customerName: "Jane Homeowner",
          customerEmail: null,
          customerPhone: null,
          hasAnyField: true,
        },
        project: {
          jobName: null,
          propertyAddress: "123 Main St",
          hasAnyField: true,
        },
        packageSummary: {
          packageName: "Standard",
          totalDisplay: "$100.00",
          hasTotal: true,
        },
        heroContent: null,
      },
      pages: [],
      estimate: {
        layout: "selected_primary" as const,
        primaryPackage: null,
        alternateOptions: [],
        optionalUpgrades: [],
        selectedOption: null,
        displayPolicy: publicDto().displayPolicy,
      },
      futureActions: [],
      footer: {
        company: {
          companyName: "Summit Roofing",
          phone: null,
          email: null,
          website: null,
          license: null,
          address: null,
          hasAnyField: true,
        },
        supportMessage: "Contact your contractor with any questions about this proposal.",
      },
    };
  }

  function overlayDeps(
    acceptance: {
      acceptedAt: string;
      signedAt?: string | null;
      signerPrintedName?: string | null;
    } | null
  ) {
    return {
      resolveToken: async () => resolveSuccess(),
      getVersionGraph: async () => versionGraph(),
      buildDto: () => publicDto(),
      buildDocumentViewModel: () => documentVm(),
      recordView: async () => ({
        ok: true as const,
        event_type: "view" as const,
        token_id: TOKEN_ID,
        proposal_id: PROPOSAL_ID,
        proposal_version_id: VERSION_ID,
      }),
      getAcceptanceForToken: async () => acceptance,
    };
  }

  test("accepted unsigned overlay does not leak ids", async () => {
    const result = await loadPublicProposalByToken(
      RAW_TOKEN,
      {},
      overlayDeps({ acceptedAt: "2026-08-16T18:00:00.000Z" })
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.document.packet.acceptance.status, "accepted");
    assert.equal(result.document.packet.acceptance.signedOnLabel ?? null, null);
    assert.doesNotMatch(JSON.stringify(result.document.packet.acceptance), /token_id|acceptance_id|signature_id/);
  });

  test("signed overlay is Proposal signed customer state", async () => {
    const result = await loadPublicProposalByToken(
      RAW_TOKEN,
      {},
      overlayDeps({
        acceptedAt: "2026-08-16T18:00:00.000Z",
        signedAt: "2026-08-16T18:01:00.000Z",
        signerPrintedName: "Jane Homeowner",
      })
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.document.packet.acceptance.status, "signed");
    assert.equal(result.document.packet.acceptance.signerDisplayName, "Jane Homeowner");
    assert.equal(typeof result.document.packet.acceptance.signedOnLabel, "string");
    assert.doesNotMatch(JSON.stringify(result.document), /customer_primary|signer_slot/);
  });
});
