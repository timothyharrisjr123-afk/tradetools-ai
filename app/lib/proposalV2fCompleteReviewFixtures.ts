/**
 * V2F review fixtures — one canonical proposal/version graph per sent version.
 * Harnesses derive chrome, document, and Job Card timestamps from these graphs.
 */

import type { JobCardSentVersionFact } from "@/app/lib/proposalJobCardSentHistory";
import type { ProposalDraftGraph, ProposalPageRow } from "@/app/lib/proposalRecordStore";

export const V2F_REVIEW_COMPANY_ID = "11111111-1111-4111-8111-111111111111";
export const V2F_REVIEW_JOB_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
export const V2F_REVIEW_PROPOSAL_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
export const V2F_REVIEW_SENT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const V2F_REVIEW_SENT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const V2F_REVIEW_DRAFT_VERSION_ID = "99999999-9999-4999-8999-999999999999";
export const V2F_REVIEW_OPTION_ID = "77777777-7777-4777-8777-777777777777";
export const V2F_REVIEW_TEMPLATE_OPTION_ID = "66666666-6666-4666-8666-666666666666";
export const V2F_REVIEW_SENT_A_FROZEN_AT = "2026-07-01T17:00:00.000Z";
export const V2F_REVIEW_SENT_B_FROZEN_AT = "2026-07-22T21:31:00.000Z";
export const V2F_REVIEW_DRAFT_UPDATED_AT = "2026-07-23T12:00:00.000Z";

const PAGE_OVERVIEW = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PAGE_ESTIMATE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PAGE_TERMS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LINE = "12121212-1212-4212-8212-121212121212";
const SECTION = "13131313-1313-4313-8313-131313131313";
const ITEM = "ffffffff-ffff-4fff-8fff-ffffffffffff";

function pageRow(
  versionId: string,
  overrides: Partial<ProposalPageRow>
): ProposalPageRow {
  return {
    id: PAGE_TERMS,
    company_id: V2F_REVIEW_COMPANY_ID,
    proposal_version_id: versionId,
    page_type: "terms",
    sort_order: 20,
    title: "Terms",
    customer_title: "Terms & Conditions",
    visible_to_customer: true,
    source_template_section_id: null,
    content_json: {},
    settings_json: {},
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

export function sentRecordGraph(input: {
  versionId: string;
  frozenAt: string;
  packageLabel: string;
}): ProposalDraftGraph {
  const { versionId, frozenAt, packageLabel } = input;
  return {
    proposal: {
      id: V2F_REVIEW_PROPOSAL_ID,
      company_id: V2F_REVIEW_COMPANY_ID,
      job_id: V2F_REVIEW_JOB_ID,
      customer_id: null,
      template_id: V2F_REVIEW_TEMPLATE_OPTION_ID,
      status: "draft",
      current_draft_version_id: V2F_REVIEW_DRAFT_VERSION_ID,
      latest_sent_version_id: V2F_REVIEW_SENT_B,
      signed_version_id: null,
      selected_option_id: V2F_REVIEW_OPTION_ID,
      measurement_record_id: null,
      pricing_policy_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      proposal_number: "P-1842",
      title: "Roof replacement",
      created_by: null,
      updated_by: null,
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: V2F_REVIEW_DRAFT_UPDATED_AT,
      draft_content_changed_at: V2F_REVIEW_DRAFT_UPDATED_AT,
      archived_at: null,
      deleted_at: null,
    },
    version: {
      id: versionId,
      company_id: V2F_REVIEW_COMPANY_ID,
      proposal_id: V2F_REVIEW_PROPOSAL_ID,
      version_number: versionId === V2F_REVIEW_SENT_A ? 1 : 2,
      version_kind: "sent",
      parent_version_id: versionId === V2F_REVIEW_SENT_A ? null : V2F_REVIEW_SENT_A,
      frozen_at: frozenAt,
      context_echo: {
        customer_name: "Jordan Hale",
        customer_email: "jordan@example.com",
        customer_phone: "918-555-0140",
        customer_address: "1842 E 31st St, Tulsa, OK",
        address_formatted: "1842 E 31st St, Tulsa, OK",
        company_name: "Summit Roofing",
        company_phone: "918-555-0100",
        company_email: "hello@summitroofing.example",
        company_address: "Tulsa, OK",
        brand_primary_color: "#1e3a5f",
        template_name: packageLabel,
        job_name: "Roof replacement",
      },
      policy_echo: {},
      created_by: null,
      created_at: frozenAt,
    },
    pages: [
      pageRow(versionId, {
        id: PAGE_OVERVIEW,
        page_type: "project_overview",
        sort_order: 10,
        title: "Project Overview",
        customer_title: "Project Overview",
        content_json: {
          body_markdown:
            "This proposal covers a complete roof replacement for {{customer_name}} at {{job_address}}.",
        },
      }),
      pageRow(versionId, {
        id: PAGE_ESTIMATE,
        page_type: "estimate",
        sort_order: 15,
        title: "Estimate",
        customer_title: "Your Estimate",
      }),
      pageRow(versionId, {
        id: PAGE_TERMS,
        page_type: "terms",
        sort_order: 20,
        title: "Terms",
        customer_title: "Terms & Conditions",
        content_json: {
          body_markdown:
            "Work includes tear-off, underlayment, and installation of the selected shingle system. Pricing is valid for 30 days from the sent date.",
        },
      }),
    ],
    options: [
      {
        id: V2F_REVIEW_OPTION_ID,
        company_id: V2F_REVIEW_COMPANY_ID,
        proposal_version_id: versionId,
        source_template_option_id: V2F_REVIEW_TEMPLATE_OPTION_ID,
        name: packageLabel,
        customer_label: packageLabel,
        description: `${packageLabel} architectural shingle system`,
        sort_order: 0,
        is_default: true,
        visible_to_customer: true,
        customer_subtotal_cents: versionId === V2F_REVIEW_SENT_A ? 1700000 : 1842000,
        discount_cents: 0,
        sales_tax_cents: versionId === V2F_REVIEW_SENT_A ? 145000 : 153500,
        customer_total_cents: versionId === V2F_REVIEW_SENT_A ? 1845000 : 2017500,
        pricing_complete: true,
        blocking_line_count: 0,
        guardrail_outcome: "pass",
        selected_at: frozenAt,
        created_at: frozenAt,
        updated_at: frozenAt,
      },
    ],
    lineItems: [
      {
        id: LINE,
        company_id: V2F_REVIEW_COMPANY_ID,
        proposal_option_id: V2F_REVIEW_OPTION_ID,
        source_template_item_id: ITEM,
        catalog_item_id:
          versionId === V2F_REVIEW_SENT_A
            ? "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
            : "12121212-1212-4212-8212-121212121212",
        catalog_seed_key: "scope.shingles",
        composition_slot_key: "scope.shingles",
        section_id: SECTION,
        page_id: PAGE_ESTIMATE,
        sort_order: 0,
        customer_name:
          versionId === V2F_REVIEW_SENT_A ? "Architectural shingles" : "Designer shingles",
        description: null,
        role: null,
        quantity: 28,
        quantity_display_label: "28 SQ",
        quantity_source_label: "Measurement",
        unit: "SQ",
        customer_unit_price_cents: 65000,
        customer_line_total_cents: 1820000,
        pricing_status: "priced",
        visible_to_customer: true,
        measurement_quantity_key: null,
        created_at: frozenAt,
        updated_at: frozenAt,
      },
    ],
    internalSummaries: [],
    scopeDecisions: [],
    upgradeChoices: [],
  };
}

export function v2fReviewSentVersionGraph(
  versionId: typeof V2F_REVIEW_SENT_A | typeof V2F_REVIEW_SENT_B
): ProposalDraftGraph {
  if (versionId === V2F_REVIEW_SENT_A) {
    return sentRecordGraph({
      versionId: V2F_REVIEW_SENT_A,
      frozenAt: V2F_REVIEW_SENT_A_FROZEN_AT,
      packageLabel: "Standard",
    });
  }
  return sentRecordGraph({
    versionId: V2F_REVIEW_SENT_B,
    frozenAt: V2F_REVIEW_SENT_B_FROZEN_AT,
    packageLabel: "Enhanced",
  });
}

export function asRevisionPreviewDraftGraph(
  current: ProposalDraftGraph,
  input: {
    latestSentVersionId: string;
    draftContentChangedAt: string;
  }
): ProposalDraftGraph {
  return {
    ...current,
    proposal: {
      ...current.proposal,
      updated_at: input.draftContentChangedAt,
      draft_content_changed_at: input.draftContentChangedAt,
      latest_sent_version_id: input.latestSentVersionId,
      current_draft_version_id: current.version.id,
    },
    version: {
      ...current.version,
      version_kind: "draft",
      frozen_at: null,
    },
  };
}

export function v2fReviewJobCardSentVersions(input?: {
  currentDeliveryStatus?: string;
}): JobCardSentVersionFact[] {
  return [
    {
      versionId: V2F_REVIEW_SENT_B,
      frozenAt: V2F_REVIEW_SENT_B_FROZEN_AT,
      packageLabel: "Enhanced",
      deliveryStatus: input?.currentDeliveryStatus ?? "provider_accepted",
    },
    {
      versionId: V2F_REVIEW_SENT_A,
      frozenAt: V2F_REVIEW_SENT_A_FROZEN_AT,
      packageLabel: "Standard",
      deliveryStatus: "delivered",
    },
  ];
}
