"use client";

import { useSearchParams } from "next/navigation";
import { buildProposalCustomerPreviewDocument } from "@/app/lib/proposalCustomerPreviewViewModel";
import { buildProposalPreviewSentFrozenChrome } from "@/app/lib/proposalPreviewSentFrozenChrome";
import { buildProposalPreviewSentRecordChrome } from "@/app/lib/proposalPreviewSentRecord";
import type { ProposalDraftGraph, ProposalPageRow } from "@/app/lib/proposalRecordStore";
import FieldDiveAppShell from "@/app/tools/roofing/FieldDiveAppShell";
import ProposalCustomerPreviewDocumentView from "./ProposalCustomerPreviewDocument";
import ProposalPreviewHeader from "./ProposalPreviewHeader";
import ProposalPreviewReviewSurface from "./ProposalPreviewReviewSurface";
import {
  PREVIEW_COMMAND_SURFACE,
  PREVIEW_WORKSPACE_BG,
  PREVIEW_WORKSPACE_STAGE,
} from "./proposalPreviewWorkspaceStyles";

const COMPANY = "11111111-1111-4111-8111-111111111111";
const JOB = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const PROPOSAL = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const SENT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SENT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const DRAFT = "99999999-9999-4999-8999-999999999999";
const OPT = "77777777-7777-4777-8777-777777777777";
const TEMPLATE_OPT = "66666666-6666-4666-8666-666666666666";
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
    company_id: COMPANY,
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

function sentRecordGraph(input: {
  versionId: string;
  frozenAt: string;
  packageLabel: string;
}): ProposalDraftGraph {
  const { versionId, frozenAt, packageLabel } = input;
  return {
    proposal: {
      id: PROPOSAL,
      company_id: COMPANY,
      job_id: JOB,
      customer_id: null,
      template_id: TEMPLATE_OPT,
      status: "draft",
      current_draft_version_id: DRAFT,
      latest_sent_version_id: SENT_B,
      signed_version_id: null,
      selected_option_id: OPT,
      measurement_record_id: null,
      pricing_policy_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      proposal_number: "P-1842",
      title: "Roof replacement",
      created_by: null,
      updated_by: null,
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-23T12:00:00.000Z",
      archived_at: null,
      deleted_at: null,
    },
    version: {
      id: versionId,
      company_id: COMPANY,
      proposal_id: PROPOSAL,
      version_number: versionId === SENT_A ? 1 : 2,
      version_kind: "sent",
      parent_version_id: versionId === SENT_A ? null : SENT_A,
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
        id: OPT,
        company_id: COMPANY,
        proposal_version_id: versionId,
        source_template_option_id: TEMPLATE_OPT,
        name: packageLabel,
        customer_label: packageLabel,
        description: `${packageLabel} architectural shingle system`,
        sort_order: 0,
        is_default: true,
        visible_to_customer: true,
        customer_subtotal_cents: 1842000,
        discount_cents: 0,
        sales_tax_cents: 153500,
        customer_total_cents: 1995500,
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
        company_id: COMPANY,
        proposal_option_id: OPT,
        source_template_item_id: ITEM,
        catalog_item_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        catalog_seed_key: null,
        section_id: SECTION,
        page_id: PAGE_ESTIMATE,
        sort_order: 0,
        customer_name: "Architectural shingles",
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

function resolveRecord(versionParam: string | null): {
  versionId: string;
  frozenAt: string;
  packageLabel: string;
  deliveryLabel: string;
} {
  if (versionParam === SENT_A) {
    return {
      versionId: SENT_A,
      frozenAt: "2026-07-01T17:00:00.000Z",
      packageLabel: "Standard",
      deliveryLabel: "Delivered",
    };
  }
  return {
    versionId: SENT_B,
    frozenAt: "2026-07-22T21:31:00.000Z",
    packageLabel: "Enhanced",
    deliveryLabel: "Emailed",
  };
}

export default function ProposalSentRecordReviewHarness() {
  const searchParams = useSearchParams();
  const record = resolveRecord(searchParams.get("version"));
  const graph = sentRecordGraph(record);
  const document = buildProposalCustomerPreviewDocument(graph, {
    pricingStale: { stale: false, reason: null },
  });
  const sentRecordChrome = buildProposalPreviewSentRecordChrome({
    frozenAt: record.frozenAt,
    deliveryLabel: record.deliveryLabel,
  });
  const sentFrozenChrome = buildProposalPreviewSentFrozenChrome({
    latestSentVersionId: SENT_B,
    lastSentFrozenAt: record.frozenAt,
  });

  return (
    <FieldDiveAppShell activeNav="jobs">
      <div
        className={PREVIEW_WORKSPACE_BG}
        data-preview-contractor-workspace
        data-v2f2-sent-record-harness
        data-preview-sent-record="true"
        data-sent-record-version={record.versionId}
      >
        <div
          className={`${PREVIEW_WORKSPACE_STAGE} space-y-3 pt-3 sm:pt-4`}
          data-preview-workspace-layout
        >
          <div className={PREVIEW_COMMAND_SURFACE} data-preview-command-surface>
            <ProposalPreviewHeader
              builderHref="#job-card"
              backHref="/dev-harness/v2f1-job-card?case=sent"
              customerName="Jordan Hale"
              projectAddress="1842 E 31st St, Tulsa, OK"
              selectedPackageLabel={record.packageLabel}
              totalLabel="$19,955.00"
              sentFrozenChrome={sentFrozenChrome}
              sentRecordChrome={sentRecordChrome}
              onSendSharing={() => undefined}
              showSendSharing={false}
            />
          </div>
          <ProposalPreviewReviewSurface>
            <ProposalCustomerPreviewDocumentView
              document={document}
              draftGraph={graph}
              catalogItems={[]}
            />
          </ProposalPreviewReviewSurface>
        </div>
      </div>
    </FieldDiveAppShell>
  );
}
