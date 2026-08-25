/**
 * Runtime ownership hardening — compile graph, jobs-first Board, truthful errors.
 *
 * Run: npx tsx --test app/lib/runtimeOwnership.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { shouldApplyAttentionDetailResult } from "./jobCardAttentionDetailGuard";
import {
  applyListedProposalFetchResult,
  listedProposalShowsEmptyState,
  listedProposalShowsUnavailable,
} from "./jobCardListedProposalState";
import {
  jobCardScheduleSectionCopy,
  resolveJobCardScheduleDisplay,
} from "./jobCardScheduleDisplay";
import { applyTemplateSetupFetchResult } from "./jobCardTemplateSetupState";
import { isCleanJobCardRoute } from "./roofingJobCardRoute";
import JobCardScheduleSection from "@/app/tools/roofing/jobCard/JobCardScheduleSection";
import JobCardProposalsTab from "@/app/tools/roofing/jobCard/JobCardProposalsTab";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const JOB_CARD_CLIENT = read("app/tools/roofing/jobCard/JobCardClient.tsx");
const PAGE = read("app/tools/roofing/page.tsx");
const SAVED = read("app/tools/roofing/saved/SavedClient.tsx");
const SETUP = read("app/tools/roofing/saved/useCompanySetupReadiness.ts");
const ATTENTION = read("app/lib/useJobAttention.ts");
const JOB_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const JOB_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2";

describe("clean Job Card route ownership", () => {
  test("page loads JobCardClient for clean job-card and not RoofingClient statically", () => {
    assert.match(PAGE, /isCleanJobCardRoute/);
    assert.match(PAGE, /import\("\.\/jobCard\/JobCardClient"\)/);
    assert.match(PAGE, /import\("\.\/RoofingClient"\)/);
    assert.doesNotMatch(PAGE, /import RoofingClient from "\.\/RoofingClient"/);
    assert.equal(
      isCleanJobCardRoute({
        entry: "job-card",
        job: JOB_A,
        loadSaved: null,
      }),
      true
    );
    assert.equal(
      isCleanJobCardRoute({
        entry: "job-card",
        job: JOB_A,
        loadSaved: "est-1",
      }),
      false
    );
  });

  test("JobCardClient initial graph does not eagerly import heavy estimator domains", () => {
    assert.doesNotMatch(JOB_CARD_CLIENT, /from ["']pdf-lib["']/);
    assert.doesNotMatch(JOB_CARD_CLIENT, /from ["']@\/app\/lib\/catalogStore["']/);
    assert.doesNotMatch(
      JOB_CARD_CLIENT,
      /from ["']@\/app\/lib\/defaultRoofingCatalog["']/
    );
    assert.doesNotMatch(JOB_CARD_CLIENT, /from ["']@\/app\/lib\/estimateStore["']/);
    assert.doesNotMatch(
      JOB_CARD_CLIENT,
      /from ["']@\/app\/lib\/sendEstimateClient["']/
    );
    assert.doesNotMatch(JOB_CARD_CLIENT, /RoofingClientV2/);
    assert.doesNotMatch(
      JOB_CARD_CLIENT,
      /from ["']@\/app\/tools\/roofing\/proposals\/builder\/ProposalBuilderClient["']/
    );
    assert.doesNotMatch(
      JOB_CARD_CLIENT,
      /from ["']@\/app\/tools\/roofing\/catalog\/CatalogSetupClient["']/
    );
    assert.match(JOB_CARD_CLIENT, /next\/dynamic/);
    assert.match(JOB_CARD_CLIENT, /JobCardSecondaryPanels/);
  });
});

describe("Board jobs-first ownership", () => {
  test("setup readiness is gated on core board ready", () => {
    assert.match(SAVED, /coreBoardReady/);
    assert.match(SAVED, /secondarySetupReady/);
    assert.match(SAVED, /useCompanySetupReadiness\(companyId,\s*\{\s*enabled: coreBoardReady/);
    assert.match(SAVED, /data-board-core-ready/);
    assert.match(SETUP, /options\?: \{ enabled\?: boolean \}/);
    assert.match(SETUP, /if \(!enabled\)/);
  });
});

describe("schedule display truth", () => {
  test("error settlement without prior success is unavailable, not Not scheduled", () => {
    const display = resolveJobCardScheduleDisplay({
      jobId: JOB_A,
      rows: [],
      loadedForJobId: null,
      settlement: { status: "error", jobId: JOB_A },
    });
    assert.equal(display.loadStatus, "error");
    assert.equal(display.ready, false);
    const copy = jobCardScheduleSectionCopy(display);
    assert.equal(copy.showUnavailable, true);
    assert.equal(copy.showNotScheduled, false);
  });

  test("successful empty read is Not scheduled", () => {
    const display = resolveJobCardScheduleDisplay({
      jobId: JOB_A,
      rows: [],
      loadedForJobId: JOB_A,
      settlement: { status: "ready", jobId: JOB_A },
    });
    assert.equal(display.loadStatus, "ready_without_schedule");
    assert.equal(jobCardScheduleSectionCopy(display).showNotScheduled, true);
  });

  test("DOM: schedule error does not render Not scheduled", () => {
    const html = renderToStaticMarkup(
      createElement(JobCardScheduleSection, {
        canSchedule: true,
        stage: "approved",
        schedule: null,
        scheduleReady: false,
        scheduleLoadStatus: "error",
        onSchedule: () => undefined,
      })
    );
    assert.match(html, /Schedule unavailable/);
    assert.doesNotMatch(html, /Not scheduled/);
    assert.match(html, /data-jobcard-schedule-error/);
  });
});

describe("proposal list truth", () => {
  test("failure keeps last-known-good and is not empty", () => {
    const applied = applyListedProposalFetchResult({
      previousItems: [{ id: "p1" }],
      previousStatus: "ready_items",
      result: { ok: false, error: "network" },
    });
    assert.equal(applied.status, "error");
    assert.equal(applied.items.length, 1);
    assert.equal(listedProposalShowsEmptyState(applied.status, applied.items.length), false);
    assert.equal(listedProposalShowsUnavailable(applied.status, 0), true);
  });

  test("DOM: proposal error does not render No proposals yet", () => {
    const html = renderToStaticMarkup(
      createElement(JobCardProposalsTab, {
        rows: [],
        listStatus: "error",
        listError: "Proposals could not be loaded.",
        onAddProposal: () => undefined,
        onProposalAction: () => undefined,
      })
    );
    assert.match(html, /Proposals unavailable/);
    assert.doesNotMatch(html, /No proposals yet/);
    assert.match(html, /data-jobcard-proposals-unavailable/);
  });
});

describe("template setup secondary error", () => {
  test("failed template read keeps previous templates", () => {
    const applied = applyTemplateSetupFetchResult({
      previousTemplates: [{ id: "t1" }],
      result: { ok: false, error: "down" },
    });
    assert.equal(applied.status, "error");
    assert.equal(applied.templates.length, 1);
  });
});

describe("Attention A→B stale guard", () => {
  test("Job A result is discarded after navigation to Job B", () => {
    assert.equal(
      shouldApplyAttentionDetailResult({
        requestedJobId: JOB_A,
        currentJobId: JOB_B,
        generation: 1,
        currentGeneration: 2,
      }),
      false
    );
    assert.equal(
      shouldApplyAttentionDetailResult({
        requestedJobId: JOB_B,
        currentJobId: JOB_B,
        generation: 2,
        currentGeneration: 2,
      }),
      true
    );
    assert.match(ATTENTION, /shouldApplyAttentionDetailResult/);
    assert.match(ATTENTION, /fetchGenerationRef/);
  });
});
