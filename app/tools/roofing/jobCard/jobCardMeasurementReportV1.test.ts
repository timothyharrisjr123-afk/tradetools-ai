/**
 * Measurement report experience V1 — workspace wiring.
 * Run: npx tsx --test app/tools/roofing/jobCard/jobCardMeasurementReportV1.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { MeasurementRecord } from "@/app/lib/measurementTypes";
import JobCardMeasurementsWorkspace from "@/app/tools/roofing/jobCard/JobCardMeasurementsWorkspace";
import JobCardOverviewSummary from "@/app/tools/roofing/jobCard/JobCardOverviewSummary";
import {
  JOB_CARD_REVIEW_PROPOSAL_LABEL,
  formatMakeCurrentConfirmIdentity,
} from "@/app/lib/jobCardMeasurementReportModel";
import { formatMeasurementCapturedOn } from "@/app/lib/jobCardMeasurementPresentation";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const WORKSPACE = read("app/tools/roofing/jobCard/JobCardMeasurementsWorkspace.tsx");
const CAPTURE = read("app/tools/roofing/jobCard/JobCardMeasurementCapture.tsx");
const HOOK = read("app/tools/roofing/jobCard/useJobCardPrepareProposal.ts");
const JOB_CARD = read("app/tools/roofing/jobCard/JobCardClient.tsx");
const BOARD_UTILS = read("app/tools/roofing/saved/jobsBoardUtils.ts");

const CURRENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const PRIOR_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2";

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

describe("workspace presentation", () => {
  test("current report shows metrics; empty is calm; no fake report/PDF", () => {
    const html = renderToStaticMarkup(
      createElement(JobCardMeasurementsWorkspace, {
        records: [measurement()],
        selectedId: CURRENT_ID,
        onAddMeasurement: () => undefined,
        onSaveMeasurement: () => undefined,
        onMakeCurrent: () => undefined,
      })
    );
    assert.match(html, /data-jobcard-measurement-current/);
    assert.match(html, /2,400 sq ft/);
    assert.match(html, /24\.0 SQ/);
    assert.match(html, /10% waste/);
    assert.match(html, /6\/12/);
    assert.match(html, /Manual measurement/);
    assert.match(html, /Ready/);
    assert.doesNotMatch(html, /View report|Open PDF|Diagram|Coming Soon/i);
    assert.doesNotMatch(html, new RegExp(CURRENT_ID));

    const empty = renderToStaticMarkup(
      createElement(JobCardMeasurementsWorkspace, {
        records: [],
        selectedId: null,
        onAddMeasurement: () => undefined,
        onSaveMeasurement: () => undefined,
        onMakeCurrent: () => undefined,
      })
    );
    assert.match(empty, /No measurement yet/);
    assert.match(empty, /Add measurement/);
    assert.doesNotMatch(empty, /measurement report helps/);
  });

  test("Details omitted without extras; collapsed by default; expands intentionally", () => {
    const without = renderToStaticMarkup(
      createElement(JobCardMeasurementsWorkspace, {
        records: [measurement()],
        selectedId: CURRENT_ID,
        onAddMeasurement: () => undefined,
        onSaveMeasurement: () => undefined,
        onMakeCurrent: () => undefined,
      })
    );
    assert.doesNotMatch(without, /data-jobcard-measurement-details-toggle/);

    const collapsed = renderToStaticMarkup(
      createElement(JobCardMeasurementsWorkspace, {
        records: [measurement({ eaves_lf: 140, ridges_lf: 32 })],
        selectedId: CURRENT_ID,
        onAddMeasurement: () => undefined,
        onSaveMeasurement: () => undefined,
        onMakeCurrent: () => undefined,
      })
    );
    assert.match(collapsed, /data-jobcard-measurement-details-toggle="closed"/);
    assert.doesNotMatch(collapsed, /data-jobcard-measurement-details="true"/);
    assert.match(collapsed, /aria-expanded="false"/);

    const expanded = renderToStaticMarkup(
      createElement(JobCardMeasurementsWorkspace, {
        records: [measurement({ eaves_lf: 140, ridges_lf: 32 })],
        selectedId: CURRENT_ID,
        initialDetailsOpen: true,
        onAddMeasurement: () => undefined,
        onSaveMeasurement: () => undefined,
        onMakeCurrent: () => undefined,
      })
    );
    assert.match(expanded, /data-jobcard-measurement-details-toggle="open"/);
    assert.match(expanded, /data-jobcard-measurement-details="true"/);
    assert.match(expanded, /Eaves/);
  });

  test("earlier measurements exclude current; historical view does not duplicate summary", () => {
    const html = renderToStaticMarkup(
      createElement(JobCardMeasurementsWorkspace, {
        records: [
          measurement(),
          measurement({
            id: PRIOR_ID,
            is_selected: false,
            created_at: "2026-07-01T12:00:00.000Z",
            roof_area_sqft: 1800,
          }),
        ],
        selectedId: CURRENT_ID,
        onAddMeasurement: () => undefined,
        onSaveMeasurement: () => undefined,
        onMakeCurrent: () => undefined,
      })
    );
    assert.match(html, /data-jobcard-measurement-history/);
    assert.match(html, /Earlier measurements/);
    assert.doesNotMatch(html, /data-jobcard-measurement-option="current"/);
    assert.doesNotMatch(html, />Current</);
    assert.doesNotMatch(html, /Make current/);

    const viewing = renderToStaticMarkup(
      createElement(JobCardMeasurementsWorkspace, {
        records: [
          measurement(),
          measurement({
            id: PRIOR_ID,
            is_selected: false,
            created_at: "2026-07-01T12:00:00.000Z",
            roof_area_sqft: 1800,
          }),
        ],
        selectedId: CURRENT_ID,
        initialViewingId: PRIOR_ID,
        onAddMeasurement: () => undefined,
        onSaveMeasurement: () => undefined,
        onMakeCurrent: () => undefined,
      })
    );
    assert.match(viewing, new RegExp(`data-jobcard-measurement-history-view="${PRIOR_ID}"`));
    assert.match(viewing, /Make current/);
    // Expanded area must not restate the same quantity summary when no extra details.
    const viewChunk = viewing.split(`data-jobcard-measurement-history-view="${PRIOR_ID}"`)[1] ?? "";
    assert.doesNotMatch(viewChunk, /1,800 sq ft · 10% waste/);
    assert.match(WORKSPACE, /setViewingId/);
    assert.match(WORKSPACE, /requestMakeCurrent/);
    assert.doesNotMatch(WORKSPACE, /onClick=\{\(\) => onMakeCurrent/);
  });

  test("make-current confirm is target-scoped and identifies the measurement", () => {
    const html = renderToStaticMarkup(
      createElement(JobCardMeasurementsWorkspace, {
        records: [
          measurement(),
          measurement({
            id: PRIOR_ID,
            is_selected: false,
            created_at: "2026-07-12T14:00:00.000Z",
            roof_area_sqft: 1800,
            waste_percent: 10,
          }),
        ],
        selectedId: CURRENT_ID,
        initialViewingId: PRIOR_ID,
        initialPendingCurrentId: PRIOR_ID,
        draftProposal: {
          proposalId: "p",
          measurementRecordId: CURRENT_ID,
          updatedAt: "2026-08-20T12:00:00.000Z",
        },
        onAddMeasurement: () => undefined,
        onSaveMeasurement: () => undefined,
        onMakeCurrent: () => undefined,
      })
    );
    assert.match(html, /data-jobcard-make-current-confirm="true"/);
    assert.match(html, new RegExp(`data-jobcard-make-current-confirm-for="${PRIOR_ID}"`));
    assert.match(html, /data-jobcard-make-current-confirm-identity/);
    assert.match(html, /Set as current measurement\?/);
    assert.match(html, /1,800 sq ft · 10% waste/);
    assert.match(html, /Jul 12, 2026/);
    // Confirm lives inside the expanded history view, not floating above Earlier.
    const historyIdx = html.indexOf('data-jobcard-measurement-history="true"');
    const confirmIdx = html.indexOf("data-jobcard-make-current-confirm");
    assert.ok(historyIdx >= 0 && confirmIdx > historyIdx);
    assert.equal(
      formatMakeCurrentConfirmIdentity({
        quantityLine: "1,800 sq ft · 10% waste",
        dateLabel: "Jul 12, 2026",
      }),
      "1,800 sq ft · 10% waste · Jul 12, 2026"
    );
  });

  test("stale draft binding shows Review; frozen has no refresh CTA", () => {
    const draft = renderToStaticMarkup(
      createElement(JobCardMeasurementsWorkspace, {
        records: [measurement()],
        selectedId: CURRENT_ID,
        binding: {
          kind: "draft_earlier",
          message: "Proposal draft uses an earlier measurement",
          reviewHref: "/tools/roofing/proposals/builder?job=j&proposal=p",
          proposalId: "p",
        },
        onAddMeasurement: () => undefined,
        onSaveMeasurement: () => undefined,
        onMakeCurrent: () => undefined,
        onReviewProposal: () => undefined,
      })
    );
    assert.match(draft, /data-jobcard-measurement-binding="draft_earlier"/);
    assert.match(draft, new RegExp(JOB_CARD_REVIEW_PROPOSAL_LABEL));

    const frozen = renderToStaticMarkup(
      createElement(JobCardMeasurementsWorkspace, {
        records: [measurement()],
        selectedId: CURRENT_ID,
        binding: {
          kind: "sent_earlier",
          message: "Sent proposal is based on an earlier measurement",
          reviewHref: null,
          proposalId: "p",
        },
        onAddMeasurement: () => undefined,
        onSaveMeasurement: () => undefined,
        onMakeCurrent: () => undefined,
      })
    );
    assert.match(frozen, /data-jobcard-measurement-binding="sent_earlier"/);
    assert.doesNotMatch(frozen, /Refresh draft pricing/);
    assert.doesNotMatch(frozen, /data-jobcard-measurement-review-proposal/);
  });

  test("human date formatting and compact capture panel", () => {
    assert.match(formatMeasurementCapturedOn("2026-08-28T14:00:00.000Z") ?? "", /Aug 28, 2026/);
    const html = renderToStaticMarkup(
      createElement(JobCardMeasurementsWorkspace, {
        records: [measurement({ created_at: "2026-08-28T14:00:00.000Z" })],
        selectedId: CURRENT_ID,
        onAddMeasurement: () => undefined,
        onSaveMeasurement: () => undefined,
        onMakeCurrent: () => undefined,
      })
    );
    assert.match(html, /Aug 28, 2026/);
    assert.doesNotMatch(html, /8\/28\/2026/);
    assert.match(CAPTURE, /sm:grid-cols-2/);
    assert.match(WORKSPACE, /data-jobcard-measurement-capture-panel/);
    assert.doesNotMatch(WORKSPACE, /capture-sheet/);
  });
});

describe("append-only and selection wiring", () => {
  test("Ready manual edit appends a new row; incomplete may update", () => {
    assert.match(HOOK, /resolveManualMeasurementEditMode/);
    assert.match(HOOK, /resolveManualMeasurementSaveMode/);
    assert.match(HOOK, /saveMode === "update-incomplete"/);
    assert.match(HOOK, /createMeasurementRecord\(draft\)/);
    assert.match(HOOK, /captureKind === "edit"/);
    assert.match(HOOK, /canMakeMeasurementCurrent/);
  });

  test("Overview and Board remain coarse", () => {
    const overview = renderToStaticMarkup(
      createElement(JobCardOverviewSummary, {
        proposalLabel: "Draft",
        measurementLabel: "2,400 sq ft · 10% waste",
      })
    );
    assert.match(overview, /2,400 sq ft · 10% waste/);
    assert.doesNotMatch(overview, /Earlier measurements|Make current|24\.0 SQ/);
    assert.match(JOB_CARD, /formatMeasurementQuantityLine\(prepare\.selected\)/);
    assert.match(BOARD_UTILS, /label: "Measured"/);
    assert.doesNotMatch(BOARD_UTILS, /% waste/);
  });

  test("no coaching, provider, or PDF chrome", () => {
    assert.doesNotMatch(WORKSPACE, /NEXT STEP|Readiness|Order a report|View report|PDF/);
    assert.doesNotMatch(HOOK, /setJobCardTab\("measurements"\)/);
    assert.match(JOB_CARD, /onMakeCurrent=\{prepare\.selectMeasurement\}/);
  });

});
