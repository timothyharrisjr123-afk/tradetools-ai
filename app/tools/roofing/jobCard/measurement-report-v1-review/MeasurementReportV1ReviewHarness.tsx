"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { MeasurementProposalBinding } from "@/app/lib/jobCardMeasurementReportModel";
import type { MeasurementRecord } from "@/app/lib/measurementTypes";
import JobCardMeasurementsWorkspace from "@/app/tools/roofing/jobCard/JobCardMeasurementsWorkspace";
import JobCardSectionPanel from "@/app/tools/roofing/jobCard/JobCardSectionPanel";
import JobCardTabs from "@/app/tools/roofing/jobCard/JobCardTabs";
import type { JobCardTabId } from "@/app/tools/roofing/jobCard/jobCardTypes";

const CURRENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const PRIOR_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2";

function record(overrides: Partial<MeasurementRecord> = {}): MeasurementRecord {
  return {
    id: CURRENT_ID,
    company_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    created_at: "2026-08-28T14:00:00.000Z",
    updated_at: "2026-08-28T14:00:00.000Z",
    status: "measured",
    is_selected: true,
    source_type: "manual",
    is_verified: false,
    roof_area_sqft: 2400,
    roof_squares: 24,
    waste_percent: 10,
    pitch_label: "6/12",
    stories: "1",
    report_attached: false,
    diagram_available: false,
    estimate_ready: true,
    production_ready: false,
    ...overrides,
  } as MeasurementRecord;
}

const MANUAL = record();
const RICH = record({
  roof_facets_count: 12,
  roof_type: "hip",
  roof_complexity: "moderate",
  eaves_lf: 148,
  rakes_lf: 36,
  ridges_lf: 42,
  hips_lf: 88,
  valleys_lf: 24,
  drip_edge_lf: 184,
  starter_lf: 148,
  ridge_cap_lf: 130,
  pipe_boots_count: 4,
  vents_count: 2,
  existing_layers_count: 1,
  tear_off_required: true,
});
const PRIOR = record({
  id: PRIOR_ID,
  is_selected: false,
  created_at: "2026-07-12T14:00:00.000Z",
  updated_at: "2026-07-12T14:00:00.000Z",
  roof_area_sqft: 1800,
  roof_squares: 18,
  waste_percent: 10,
  pitch_label: "5/12",
});

const DRAFT_EARLIER: MeasurementProposalBinding = {
  kind: "draft_earlier",
  message: "Proposal draft uses an earlier measurement",
  reviewHref: "/tools/roofing?entry=job-card&job=visual-only&tab=proposal",
  proposalId: "visual-draft",
};

const SENT_EARLIER: MeasurementProposalBinding = {
  kind: "sent_earlier",
  message: "Sent proposal is based on an earlier measurement",
  reviewHref: null,
  proposalId: "visual-sent",
};

const DRAFT_ON_CURRENT = {
  proposalId: "visual-draft",
  measurementRecordId: CURRENT_ID,
  updatedAt: "2026-08-20T12:00:00.000Z",
};

type SceneId =
  | "empty"
  | "current"
  | "details-collapsed"
  | "details"
  | "history"
  | "viewing-earlier"
  | "stale-draft"
  | "frozen"
  | "add"
  | "edit"
  | "make-current-confirm";

const SCENES: Record<
  SceneId,
  {
    records: MeasurementRecord[];
    selectedId: string | null;
    capturing?: boolean;
    binding?: MeasurementProposalBinding | null;
    initialDetailsOpen?: boolean;
    initialViewingId?: string | null;
    initialPendingCurrentId?: string | null;
    captureTitle?: string;
  }
> = {
  empty: { records: [], selectedId: null },
  current: { records: [MANUAL], selectedId: CURRENT_ID },
  "details-collapsed": {
    records: [RICH],
    selectedId: CURRENT_ID,
    initialDetailsOpen: false,
  },
  details: {
    records: [RICH],
    selectedId: CURRENT_ID,
    initialDetailsOpen: true,
  },
  history: {
    records: [MANUAL, PRIOR],
    selectedId: CURRENT_ID,
  },
  "viewing-earlier": {
    records: [MANUAL, PRIOR],
    selectedId: CURRENT_ID,
    initialViewingId: PRIOR_ID,
  },
  "stale-draft": {
    records: [MANUAL, PRIOR],
    selectedId: CURRENT_ID,
    binding: DRAFT_EARLIER,
  },
  frozen: {
    records: [MANUAL, PRIOR],
    selectedId: CURRENT_ID,
    binding: SENT_EARLIER,
  },
  add: {
    records: [],
    selectedId: null,
    capturing: true,
    captureTitle: "Add measurement",
  },
  edit: {
    records: [MANUAL],
    selectedId: CURRENT_ID,
    capturing: true,
    captureTitle: "Edit measurement",
  },
  "make-current-confirm": {
    records: [MANUAL, PRIOR],
    selectedId: CURRENT_ID,
    initialViewingId: PRIOR_ID,
    initialPendingCurrentId: PRIOR_ID,
  },
};

export default function MeasurementReportV1ReviewHarness() {
  const search = useSearchParams();
  const show = (search.get("show") ?? "current") as SceneId;
  const scene = SCENES[show] ?? SCENES.current;
  const [tab] = useState<JobCardTabId>("measurements");

  return (
    <div className="bg-white" data-measurement-report-v1-review={show}>
      <JobCardTabs activeTab={tab} onTabChange={() => undefined} />
      <div className="p-5 sm:p-6">
        <JobCardSectionPanel
          tabId="measurements"
          activeTab={tab}
          title="Measurements"
        >
          <JobCardMeasurementsWorkspace
            records={scene.records}
            selectedId={scene.selectedId}
            capturing={scene.capturing}
            captureInitial={
              show === "edit"
                ? {
                    roof_area_sqft: 2400,
                    waste_percent: 10,
                    pitch_label: "6/12",
                    stories: "1",
                  }
                : null
            }
            captureTitle={scene.captureTitle}
            binding={scene.binding ?? null}
            draftProposal={show === "make-current-confirm" ? DRAFT_ON_CURRENT : null}
            initialDetailsOpen={scene.initialDetailsOpen}
            initialViewingId={scene.initialViewingId}
            initialPendingCurrentId={scene.initialPendingCurrentId}
            onAddMeasurement={() => undefined}
            onEditMeasurement={() => undefined}
            onCancelCapture={() => undefined}
            onSaveMeasurement={() => undefined}
            onMakeCurrent={() => undefined}
            onReviewProposal={() => undefined}
          />
        </JobCardSectionPanel>
      </div>
    </div>
  );
}
