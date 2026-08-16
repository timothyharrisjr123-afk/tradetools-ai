"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { JobAttentionSafeItem } from "@/app/lib/jobAttentionReadModel";
import { buildJobCardSentHistoryView } from "@/app/lib/proposalJobCardSentHistory";
import type { ProposalRecordStatusSummary } from "@/app/lib/proposalRecordTypes";
import {
  V2F_REVIEW_DRAFT_UPDATED_AT,
  V2F_REVIEW_JOB_ID,
  V2F_REVIEW_PROPOSAL_ID,
  V2F_REVIEW_SENT_A,
  V2F_REVIEW_SENT_A_FROZEN_AT,
  V2F_REVIEW_SENT_B,
  V2F_REVIEW_SENT_B_FROZEN_AT,
  v2fReviewJobCardSentVersions,
} from "@/app/lib/proposalV2fCompleteReviewFixtures";
import FieldDiveAppShell from "@/app/tools/roofing/FieldDiveAppShell";
import JobCardActivityPanel, {
  type JobCardActivityItem,
} from "@/app/tools/roofing/jobCard/JobCardActivityPanel";
import JobCardHeader from "@/app/tools/roofing/jobCard/JobCardHeader";
import JobCardMetadataStrip from "@/app/tools/roofing/jobCard/JobCardMetadataStrip";
import JobCardNextActionPanel from "@/app/tools/roofing/jobCard/JobCardNextActionPanel";
import JobCardProposalsTab, {
  JobCardProposalsAddHeaderButton,
} from "@/app/tools/roofing/jobCard/JobCardProposalsTab";
import JobCardSectionPanel from "@/app/tools/roofing/jobCard/JobCardSectionPanel";
import JobCardTabs from "@/app/tools/roofing/jobCard/JobCardTabs";
import {
  JOB_CARD_PROPOSAL_ACTIVITY_CREATED_LABEL,
  JOB_CARD_PROPOSALS_TAB_SUBTITLE,
  buildJobCardProposalRowView,
  formatJobCardContractorProposalStatusLabel,
  formatJobCardProposalCreatedActivityNote,
  type JobCardProposalRowView,
} from "@/app/tools/roofing/jobCard/jobCardProposalsTabModel";
import type { JobCardDisplayModel } from "@/app/tools/roofing/saved/jobsBoardUtils";

const SENT_A = V2F_REVIEW_SENT_A;
const SENT_B = V2F_REVIEW_SENT_B;
const PROPOSAL = V2F_REVIEW_PROPOSAL_ID;
const JOB = V2F_REVIEW_JOB_ID;
const REQUEST = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ATTENTION = "ffffffff-ffff-4fff-8fff-ffffffffffff";

const HARNESS_CASES = [
  "sent",
  "revision",
  "history-collapsed",
  "history-expanded",
  "attention",
  "sent-activity",
  "revision-activity",
  "history-expanded-activity",
  "attention-activity",
  "post-resend",
  "delivery-failed",
  "attention-revision",
] as const;

type HarnessCase = (typeof HARNESS_CASES)[number];

function isHarnessCase(value: string | null): value is HarnessCase {
  return HARNESS_CASES.includes(value as HarnessCase);
}

function summary(
  partial: Partial<ProposalRecordStatusSummary> & { id: string }
): ProposalRecordStatusSummary {
  return {
    id: partial.id,
    job_id: JOB,
    status: partial.status ?? "draft",
    title: partial.title ?? "Roof replacement",
    proposal_number: null,
    template_id: "tmpl-roof",
    selected_option_id: partial.selected_option_id ?? null,
    latest_sent_version_id: partial.latest_sent_version_id ?? null,
    signed_version_id: partial.signed_version_id ?? null,
    created_at: null,
    updated_at: partial.updated_at ?? V2F_REVIEW_SENT_B_FROZEN_AT,
  };
}

const hrefs = {
  builderHref: () => "#builder",
  previewHref: () => "#preview",
  sentRecordHref: (_proposalId: string, versionId: string) =>
    `/dev-harness/v2f2-sent-record?version=${versionId}`,
};

function sentSummary(): ProposalRecordStatusSummary {
  return summary({
    id: PROPOSAL,
    title: "Roof replacement",
    latest_sent_version_id: SENT_B,
    updated_at: V2F_REVIEW_SENT_B_FROZEN_AT,
  });
}

function revisionSummary(): ProposalRecordStatusSummary {
  return summary({
    id: PROPOSAL,
    title: "Roof replacement",
    latest_sent_version_id: SENT_A,
    updated_at: V2F_REVIEW_DRAFT_UPDATED_AT,
  });
}

function multiSentSummary(): ProposalRecordStatusSummary {
  return summary({
    id: PROPOSAL,
    title: "Roof replacement",
    latest_sent_version_id: SENT_B,
    updated_at: V2F_REVIEW_SENT_B_FROZEN_AT,
  });
}

function sentFactsFromVersions(input: {
  latestSentVersionId: string;
  versions: ReturnType<typeof v2fReviewJobCardSentVersions>;
}) {
  const history = buildJobCardSentHistoryView({
    latestSentVersionId: input.latestSentVersionId,
    versions: input.versions,
  });
  return {
    latestSentFrozenAt: history.latestSentFrozenAt,
    history: history.rows,
  };
}

const SENT_FACTS = sentFactsFromVersions({
  latestSentVersionId: SENT_B,
  versions: [
    {
      versionId: SENT_B,
      frozenAt: V2F_REVIEW_SENT_B_FROZEN_AT,
      packageLabel: "Enhanced",
      deliveryStatus: "provider_accepted",
    },
  ],
});

const REVISION_SENT_FACTS = sentFactsFromVersions({
  latestSentVersionId: SENT_A,
  versions: [
    {
      versionId: SENT_A,
      frozenAt: V2F_REVIEW_SENT_A_FROZEN_AT,
      packageLabel: "Standard",
      deliveryStatus: "delivered",
    },
  ],
});

const MULTI_SENT_FACTS = sentFactsFromVersions({
  latestSentVersionId: SENT_B,
  versions: v2fReviewJobCardSentVersions(),
});

const FAILED_SENT_FACTS = sentFactsFromVersions({
  latestSentVersionId: SENT_B,
  versions: v2fReviewJobCardSentVersions({ currentDeliveryStatus: "failed" }),
});

function sentRow(): JobCardProposalRowView {
  return buildJobCardProposalRowView({
    summary: sentSummary(),
    packageLabel: "Enhanced",
    sentFacts: SENT_FACTS,
    hrefs,
  });
}

function revisionRow(): JobCardProposalRowView {
  return buildJobCardProposalRowView({
    summary: revisionSummary(),
    packageLabel: "Enhanced",
    sentFacts: REVISION_SENT_FACTS,
    hrefs,
  });
}

function multiSentRow(): JobCardProposalRowView {
  return buildJobCardProposalRowView({
    summary: multiSentSummary(),
    packageLabel: "Enhanced",
    sentFacts: MULTI_SENT_FACTS,
    hrefs,
  });
}

const BASE_ACTIVITY: JobCardActivityItem[] = [
  {
    when: "Jul 22",
    label: "Job card opened",
    note: "New job / intake path",
  },
  {
    when: "Jul 22",
    label: "Measurement complete",
    note: "Roof report ready",
  },
  {
    when: "Jul 22",
    label: JOB_CARD_PROPOSAL_ACTIVITY_CREATED_LABEL,
    note: formatJobCardProposalCreatedActivityNote("Enhanced"),
  },
];

const ATTENTION_ACTIVITY: JobCardActivityItem = {
  when: "Jul 22",
  label: "Customer requested Enhanced",
  note: "New request · Can we go with the Enhanced package?",
};

const ATTENTION_ITEM: JobAttentionSafeItem = {
  id: ATTENTION,
  jobId: JOB,
  proposalId: PROPOSAL,
  proposalVersionId: SENT_A,
  attentionType: "customer_package_request",
  sourceType: "proposal_customer_requests",
  sourceId: REQUEST,
  status: "open",
  severity: "normal",
  openedAt: "2026-07-22T17:10:00.000Z",
  acknowledgedAt: null,
  destination: {
    kind: "job_card_proposals",
    proposalId: PROPOSAL,
    proposalVersionId: SENT_A,
    requestId: REQUEST,
    tab: "proposals",
    anchor: "customer_request",
  },
  request: {
    requestId: REQUEST,
    intent: "request_package",
    requestStatus: "new",
    packageLabel: "Enhanced",
    message: "Can we go with the Enhanced package?",
    messagePreview: "Can we go with the Enhanced package?",
    customerName: "Jordan Hale",
    customerEmail: "jordan@example.com",
    customerPhone: "918-555-0140",
  },
  personalReadAt: null,
  personalLastViewedAt: null,
};

function resolveCase(raw: string | null): HarnessCase {
  return isHarnessCase(raw) ? raw : "sent";
}

function caseConfig(caseId: HarnessCase): {
  row: JobCardProposalRowView;
  summary: ProposalRecordStatusSummary;
  sentFacts:
    | typeof SENT_FACTS
    | typeof REVISION_SENT_FACTS
    | typeof MULTI_SENT_FACTS
    | typeof FAILED_SENT_FACTS;
  showAttention: boolean;
  forceOpenHistory: boolean;
} {
  switch (caseId) {
    case "revision":
    case "revision-activity":
      return {
        row: revisionRow(),
        summary: revisionSummary(),
        sentFacts: REVISION_SENT_FACTS,
        showAttention: false,
        forceOpenHistory: false,
      };
    case "history-collapsed":
      return {
        row: multiSentRow(),
        summary: multiSentSummary(),
        sentFacts: MULTI_SENT_FACTS,
        showAttention: false,
        forceOpenHistory: false,
      };
    case "history-expanded":
    case "history-expanded-activity":
      return {
        row: multiSentRow(),
        summary: multiSentSummary(),
        sentFacts: MULTI_SENT_FACTS,
        showAttention: false,
        forceOpenHistory: true,
      };
    case "attention":
    case "attention-activity":
      return {
        row: sentRow(),
        summary: sentSummary(),
        sentFacts: SENT_FACTS,
        showAttention: true,
        forceOpenHistory: false,
      };
    case "attention-revision":
      return {
        row: revisionRow(),
        summary: revisionSummary(),
        sentFacts: REVISION_SENT_FACTS,
        showAttention: true,
        forceOpenHistory: false,
      };
    case "post-resend":
      return {
        row: multiSentRow(),
        summary: multiSentSummary(),
        sentFacts: MULTI_SENT_FACTS,
        showAttention: false,
        forceOpenHistory: false,
      };
    case "delivery-failed":
      return {
        row: buildJobCardProposalRowView({
          summary: multiSentSummary(),
          packageLabel: "Enhanced",
          sentFacts: FAILED_SENT_FACTS,
          hrefs,
        }),
        summary: multiSentSummary(),
        sentFacts: FAILED_SENT_FACTS,
        showAttention: false,
        forceOpenHistory: true,
      };
    default:
      return {
        row: sentRow(),
        summary: sentSummary(),
        sentFacts: SENT_FACTS,
        showAttention: false,
        forceOpenHistory: false,
      };
  }
}

function buildDisplay(proposalLabel: string): JobCardDisplayModel {
  return {
    customerName: "Jordan Hale",
    address: "1842 E 31st St, Tulsa, OK",
    stageLabel: "Proposal",
    valueLabel: null,
    lastUpdatedDisplay: "Updated Jul 22",
    timeInStage: "3d in stage",
    timeInStageTone: "normal",
    reportLabel: "Report Complete",
    proposalLabel,
    tasksLabel: "No tasks",
  };
}

export default function JobCardV2f1ReviewHarness() {
  const searchParams = useSearchParams();
  const caseId = resolveCase(searchParams.get("case"));
  const config = caseConfig(caseId);
  const proposalLabel = formatJobCardContractorProposalStatusLabel({
    visibleSummaries: [config.summary],
    packageLabelsByProposalId: { [PROPOSAL]: "Enhanced" },
    sentFactsByProposalId: { [PROPOSAL]: config.sentFacts },
  });
  const display = buildDisplay(proposalLabel);
  const activityItems = config.showAttention
    ? [ATTENTION_ACTIVITY, ...BASE_ACTIVITY]
    : BASE_ACTIVITY;
  const attentionItems = config.showAttention ? [ATTENTION_ITEM] : [];

  useEffect(() => {
    if (!config.forceOpenHistory) return;
    const open = () => {
      document
        .querySelectorAll(
          "[data-v2f1-full-job-card] details[data-jobcard-sent-history]"
        )
        .forEach((details) => {
          details.setAttribute("open", "");
        });
    };
    open();
    const frame = window.requestAnimationFrame(open);
    return () => window.cancelAnimationFrame(frame);
  }, [caseId, config.forceOpenHistory]);

  return (
    <FieldDiveAppShell activeNav="jobs" activeSubId="job-card">
      <div
        className="min-h-0 w-full pb-8 pt-1 pl-3 pr-4 sm:pl-4 sm:pr-5 lg:pl-5 lg:pr-6"
        data-v2f1-job-card-harness
        data-v2f1-case={caseId}
      >
        <div className="w-full max-w-[100rem]">
          <div
            className="overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
            data-v2f1-full-job-card
            data-v2f1-force-open-history={
              config.forceOpenHistory ? "true" : undefined
            }
          >
            <JobCardHeader
              display={display}
              isBoardOrigin
              phone="918-555-0140"
              email="jordan@example.com"
            />
            <JobCardMetadataStrip display={display} />
            <JobCardNextActionPanel
              items={attentionItems}
              selectedItem={attentionItems[0] ?? null}
              focusRequested={false}
              fallbackPhone="918-555-0140"
              fallbackEmail="jordan@example.com"
              onSelect={() => undefined}
              onMarkRead={async () => false}
              onMarkSeen={async () => undefined}
              onDismiss={async () => undefined}
              onReviewProposal={() => undefined}
            />
            <JobCardTabs activeTab="proposals" onTabChange={() => undefined} />
            <div className="grid min-h-[min(520px,calc(100vh-14rem))] grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px]">
              <main className="min-h-0 overflow-y-auto p-5 sm:p-6 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200/60">
                <JobCardSectionPanel
                  tabId="proposals"
                  activeTab="proposals"
                  title="Proposals"
                  subtitle={JOB_CARD_PROPOSALS_TAB_SUBTITLE}
                  headerAction={
                    <JobCardProposalsAddHeaderButton
                      onClick={() => undefined}
                    />
                  }
                >
                  <JobCardProposalsTab
                    rows={[config.row]}
                    onAddProposal={() => undefined}
                    onProposalAction={() => undefined}
                    sentHistoryDefaultOpen={config.forceOpenHistory}
                  />
                </JobCardSectionPanel>
              </main>
              <div data-v2f1-activity-rail>
                <JobCardActivityPanel items={activityItems} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </FieldDiveAppShell>
  );
}
