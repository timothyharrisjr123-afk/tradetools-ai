/**
 * Measurement report experience V1.
 * Run: npx tsx --test app/lib/jobCardMeasurementReportModel.test.ts app/tools/roofing/jobCard/jobCardMeasurementReportV1.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  buildMeasurementDetailGroups,
  buildMeasurementHistoryRows,
  buildMeasurementReportSummary,
  canMakeMeasurementCurrent,
  pickMeasurementProposalRefs,
  resolveManualMeasurementEditMode,
  resolveManualMeasurementSaveMode,
  resolveMeasurementProposalBinding,
  visibleReportCopyHasNoInternalLeakage,
  wouldMakeDraftProposalStale,
  JOB_CARD_DRAFT_USES_EARLIER,
  JOB_CARD_SENT_USES_EARLIER,
} from "@/app/lib/jobCardMeasurementReportModel";
import { resolveCanonicalJobMeasurement } from "@/app/lib/jobCardMeasurementPresentation";
import { deriveProposalPricingStale } from "@/app/lib/proposalStaleness";
import type { MeasurementRecord } from "@/app/lib/measurementTypes";

const CURRENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const PRIOR_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2";
const REJECTED_ID = "cccccccc-cccc-4ccc-8ccc-ccccccccccc3";
const STALE_ID = "dddddddd-dddd-4ddd-8ddd-ddddddddddd4";
const PROPOSAL_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5";

function measurement(
  overrides: Partial<MeasurementRecord> = {}
): MeasurementRecord {
  return {
    id: CURRENT_ID,
    company_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    created_at: "2026-08-01T12:00:00.000Z",
    updated_at: "2026-08-01T12:00:00.000Z",
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

describe("current measurement summary", () => {
  test("canonical current is is_selected then jobs.selected_measurement_id, never first row", () => {
    const first = measurement({
      id: PRIOR_ID,
      is_selected: false,
      created_at: "2026-08-02T12:00:00.000Z",
    });
    const selected = measurement({ id: CURRENT_ID, is_selected: true });
    assert.equal(
      resolveCanonicalJobMeasurement({ records: [first, selected] })?.id,
      CURRENT_ID
    );
    assert.equal(
      resolveCanonicalJobMeasurement({
        records: [
          measurement({ id: PRIOR_ID, is_selected: false }),
          measurement({ id: CURRENT_ID, is_selected: false }),
        ],
        selectedMeasurementId: CURRENT_ID,
      })?.id,
      CURRENT_ID
    );
    assert.equal(
      resolveCanonicalJobMeasurement({
        records: [first],
        selectedMeasurementId: null,
      }),
      null
    );
  });

  test("summary shows primary metrics and hides null pitch", () => {
    const ready = buildMeasurementReportSummary(measurement());
    assert.equal(ready.name, "Manual measurement");
    assert.equal(ready.statusLabel, "Ready");
    assert.equal(ready.areaLabel, "2,400 sq ft");
    assert.equal(ready.squaresLabel, "24.0 SQ");
    assert.equal(ready.wasteLabel, "10% waste");
    assert.equal(ready.pitchLabel, "6/12");
    assert.equal(ready.storiesLabel, "1 story");
    assert.equal(ready.sourceLabel, "Manual");
    assert.equal(ready.canEdit, true);

    const noPitch = buildMeasurementReportSummary(
      measurement({ pitch_label: null, predominant_pitch: null })
    );
    assert.equal(noPitch.pitchLabel, null);
  });

  test("visible copy has no UUIDs or internal labels", () => {
    const summary = buildMeasurementReportSummary(measurement());
    assert.equal(
      visibleReportCopyHasNoInternalLeakage([
        summary.name,
        summary.statusLabel,
        summary.areaLabel ?? "",
        summary.sourceLabel,
      ]),
      true
    );
  });
});

describe("details groups", () => {
  test("groups appear only with real values; zeros and nulls omitted", () => {
    assert.equal(buildMeasurementDetailGroups(measurement()).length, 0);
    const rich = buildMeasurementDetailGroups(
      measurement({
        roof_facets_count: 8,
        eaves_lf: 120,
        ridges_lf: 40,
        valleys_lf: 0,
        hips_lf: null,
        vents_count: 3,
        tear_off_required: true,
      })
    );
    const ids = rich.map((group) => group.id);
    assert.deepEqual(ids, ["geometry", "lengths", "penetrations", "tearoff"]);
    const lengthLabels = rich
      .find((group) => group.id === "lengths")
      ?.items.map((item) => item.label);
    assert.deepEqual(lengthLabels, ["Eaves", "Ridges"]);
    assert.equal(
      rich.some((group) => group.items.some((item) => item.label === "Valleys")),
      false
    );
  });
});

describe("history and make current", () => {
  test("earlier measurements exclude current; newest-first among historical", () => {
    const older = measurement({
      id: PRIOR_ID,
      is_selected: false,
      created_at: "2026-07-01T12:00:00.000Z",
    });
    const newer = measurement({
      id: CURRENT_ID,
      is_selected: true,
      created_at: "2026-08-20T12:00:00.000Z",
    });
    const third = measurement({
      id: REJECTED_ID,
      is_selected: false,
      created_at: "2026-06-01T12:00:00.000Z",
      status: "rejected",
    });
    const rows = buildMeasurementHistoryRows({
      records: [older, newer, third],
      currentId: CURRENT_ID,
    });
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.id, PRIOR_ID);
    assert.equal(rows[1]?.id, REJECTED_ID);
    assert.equal(
      rows.every((row) => row.id !== CURRENT_ID),
      true
    );
    assert.equal(rows[0]?.canMakeCurrent, true);
    assert.equal(rows[1]?.canMakeCurrent, false);
  });

  test("rejected and stale cannot become current; current cannot", () => {
    const current = measurement();
    const rejected = measurement({
      id: REJECTED_ID,
      is_selected: false,
      status: "rejected",
    });
    const stale = measurement({
      id: STALE_ID,
      is_selected: false,
      status: "stale",
    });
    assert.equal(canMakeMeasurementCurrent(current, CURRENT_ID), false);
    assert.equal(canMakeMeasurementCurrent(rejected, CURRENT_ID), false);
    assert.equal(canMakeMeasurementCurrent(stale, CURRENT_ID), false);
    assert.equal(
      canMakeMeasurementCurrent(
        measurement({ id: PRIOR_ID, is_selected: false, status: "measured" }),
        CURRENT_ID
      ),
      true
    );
  });
});

describe("date formatting", () => {
  test("measurement dates use contractor-readable Month D, YYYY", () => {
    const summary = buildMeasurementReportSummary(
      measurement({ created_at: "2026-08-28T14:00:00.000Z" })
    );
    assert.match(summary.dateLabel ?? "", /Aug 28, 2026/);
    assert.doesNotMatch(summary.dateLabel ?? "", /^\d{1,2}\/\d{1,2}\/\d{4}$/);
  });
});

describe("manual edit modes", () => {
  test("incomplete current manual updates the same row", () => {
    const incomplete = measurement({
      waste_percent: null,
      pitch_label: null,
      stories: null,
      status: "incomplete",
      estimate_ready: false,
    });
    assert.equal(resolveManualMeasurementEditMode(incomplete), "inplace");
    assert.equal(
      resolveManualMeasurementSaveMode({
        editingMeasurementId: CURRENT_ID,
        current: incomplete,
      }),
      "update-incomplete"
    );
  });

  test("Ready manual edit creates a new row", () => {
    const ready = measurement();
    assert.equal(resolveManualMeasurementEditMode(ready), "append");
    assert.equal(
      resolveManualMeasurementSaveMode({
        editingMeasurementId: null,
        current: ready,
      }),
      "create"
    );
    assert.equal(resolveManualMeasurementEditMode(measurement({ source_type: "provider_report" })), "none");
  });
});

describe("proposal binding and draft stale confirm", () => {
  test("normal current draft is quiet", () => {
    const binding = resolveMeasurementProposalBinding({
      currentMeasurementId: CURRENT_ID,
      currentMeasurementUpdatedAt: "2026-08-01T12:00:00.000Z",
      draft: {
        proposalId: PROPOSAL_ID,
        measurementRecordId: CURRENT_ID,
        updatedAt: "2026-08-02T12:00:00.000Z",
      },
      sent: null,
      reviewHref: "/tools/roofing/proposals/builder?job=j&proposal=p",
    });
    assert.equal(binding.kind, "none");
    assert.equal(binding.message, null);
    assert.equal(binding.reviewHref, null);
  });

  test("stale draft shows quiet Review; frozen mismatch is informational only", () => {
    const draftEarlier = resolveMeasurementProposalBinding({
      currentMeasurementId: CURRENT_ID,
      draft: {
        proposalId: PROPOSAL_ID,
        measurementRecordId: PRIOR_ID,
        updatedAt: "2026-08-01T12:00:00.000Z",
      },
      sent: null,
      reviewHref: "/tools/roofing/proposals/builder?job=j&proposal=p",
    });
    assert.equal(draftEarlier.kind, "draft_earlier");
    assert.equal(draftEarlier.message, JOB_CARD_DRAFT_USES_EARLIER);
    assert.ok(draftEarlier.reviewHref);

    const frozen = resolveMeasurementProposalBinding({
      currentMeasurementId: CURRENT_ID,
      draft: null,
      sent: {
        proposalId: PROPOSAL_ID,
        measurementRecordId: PRIOR_ID,
      },
      reviewHref: "/should-not-use",
    });
    assert.equal(frozen.kind, "sent_earlier");
    assert.equal(frozen.message, JOB_CARD_SENT_USES_EARLIER);
    assert.equal(frozen.reviewHref, null);
  });

  test("make-current confirm appears only when the draft would become stale", () => {
    const candidate = measurement({ id: PRIOR_ID, is_selected: false });
    assert.equal(
      wouldMakeDraftProposalStale({
        draft: {
          proposalId: PROPOSAL_ID,
          measurementRecordId: CURRENT_ID,
          updatedAt: "2026-08-02T12:00:00.000Z",
        },
        candidate,
      }),
      true
    );
    assert.equal(
      wouldMakeDraftProposalStale({
        draft: {
          proposalId: PROPOSAL_ID,
          measurementRecordId: PRIOR_ID,
          updatedAt: "2026-08-02T12:00:00.000Z",
        },
        candidate,
      }),
      false
    );
    assert.equal(
      wouldMakeDraftProposalStale({ draft: null, candidate }),
      false
    );
    const afterSelect = deriveProposalPricingStale({
      snapshotMeasurementId: CURRENT_ID,
      currentMeasurementId: PRIOR_ID,
    });
    assert.equal(afterSelect.stale, true);
    assert.equal(afterSelect.reason, "measurement_changed");
  });

  test("pick refs prefers listed draft and any sent pointer", () => {
    const refs = pickMeasurementProposalRefs({
      draftProposalId: PROPOSAL_ID,
      summaries: [
        {
          id: PROPOSAL_ID,
          measurement_record_id: PRIOR_ID,
          latest_sent_version_id: null,
          updated_at: "2026-08-01T00:00:00.000Z",
          status: "draft",
        },
        {
          id: "99999999-9999-4999-8999-999999999999",
          measurement_record_id: CURRENT_ID,
          latest_sent_version_id: "88888888-8888-4888-8888-888888888888",
          status: "sent",
        },
      ],
    });
    assert.equal(refs.draft?.measurementRecordId, PRIOR_ID);
    assert.equal(refs.sent?.measurementRecordId, CURRENT_ID);
  });
});
