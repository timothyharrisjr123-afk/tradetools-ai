/**
 * Phase 8 — Job Card mobile nav + Overview hierarchy contracts.
 * Run: npx tsx --test app/tools/roofing/jobCard/jobCardPhase8MobileHierarchy.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  JOB_CARD_DESKTOP_NAV_MIN_WIDTH,
  JOB_CARD_DOMAIN_WORKSPACE,
  JOB_CARD_MOBILE_PRIMARY_NAV,
  JOB_CARD_MORE_DESTINATIONS,
  isJobCardMoreActiveDestination,
  jobCardMobileNavCoversAllVisibleDomains,
  resolveJobCardDomainWorkspace,
  resolveJobCardMobileRailSelection,
} from "./jobCardMobileNav";
import {
  coerceJobCardVisibleTab,
  JOB_CARD_VISIBLE_TAB_IDS,
  JOB_CARD_VISIBLE_TABS,
} from "./jobCardTypes";
import {
  resolveJobCardOverviewPrimaryAction,
  resolveJobCardOverviewForwardAction,
} from "@/app/lib/jobCardForwardLifecycleAction";
import type { CanonicalJobActionEligibility } from "@/app/lib/jobLifecycleActionEligibility";
import JobCardForwardLifecycleAction from "./JobCardForwardLifecycleAction";
import JobCardFieldBrief from "./JobCardFieldBrief";
import type {
  FieldBriefTask,
  FieldBriefTasksReadStatus,
  FieldBriefViewModel,
} from "@/app/lib/fieldBriefModel";

function task(id: string, title: string): FieldBriefTask {
  return { id, title, status: "open", dueOn: null, assigneeLabel: "Unassigned", assignedTo: null };
}

function briefModel(tasks: FieldBriefTask[]): FieldBriefViewModel {
  return {
    contact: {
      customerName: "Proof Customer",
      phone: null,
      email: null,
      addressLine: null,
      canCall: false,
      canDirections: false,
      mapsUrl: null,
      telUrl: null,
    },
    schedule: {
      startsOn: null,
      endsOn: null,
      timezone: null,
      windowLabel: null,
      productionLeadLabel: "Unassigned",
      crewLabel: null,
    },
    authorizedWork: {
      status: "ready",
      approvedScopeLabel: "Architectural shingle replacement",
      approvedChangesLabel: null,
      measurementSummary: null,
      accessNotes: null,
      warningProposedVsAuthorized: null,
    },
    tasks,
    photoCount: 0,
  };
}

const ROOT = join(process.cwd());
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const TABS = read("app/tools/roofing/jobCard/JobCardTabs.tsx");
const MORE = read("app/tools/roofing/jobCard/JobCardMoreSheet.tsx");
const CLIENT = read("app/tools/roofing/jobCard/JobCardClient.tsx");
const OVERVIEW = read("app/tools/roofing/jobCard/JobCardOverviewSummary.tsx");
const SCHEDULE = read("app/tools/roofing/jobCard/JobCardScheduleSection.tsx");
const ACTIVITY = read("app/tools/roofing/jobCard/JobCardActivityPanel.tsx");
const DISPOSITION = read(
  "app/tools/roofing/jobCard/JobCardDispositionControl.tsx"
);
const FIELD_BRIEF = read("app/tools/roofing/jobCard/JobCardFieldBrief.tsx");
const SECONDARY = read("app/tools/roofing/jobCard/JobCardSecondaryPanels.tsx");
const TASKS_WS = read("app/tools/roofing/jobCard/JobCardTasksWorkspace.tsx");

function eligibility(
  overrides: Partial<CanonicalJobActionEligibility> = {}
): CanonicalJobActionEligibility {
  return {
    canApproveJob: false,
    canSchedule: false,
    canReschedule: false,
    canUnschedule: false,
    canStartWork: false,
    canCompleteJob: false,
    ...overrides,
  };
}

describe("Phase 8 mobile nav model", () => {
  test("primary rail is Overview | Tasks | Photos", () => {
    assert.deepEqual(
      JOB_CARD_MOBILE_PRIMARY_NAV.map((item) => item.label),
      ["Overview", "Tasks", "Photos"]
    );
    assert.deepEqual(
      JOB_CARD_MOBILE_PRIMARY_NAV.map((item) => item.id),
      ["overview", "tasks", "attachments"]
    );
  });

  test("More destinations cover remaining domains + Activity", () => {
    assert.deepEqual(
      JOB_CARD_MORE_DESTINATIONS.map((item) => item.id),
      ["calendar", "measurements", "proposals", "payments", "activity"]
    );
    assert.equal(jobCardMobileNavCoversAllVisibleDomains(), true);
    for (const id of JOB_CARD_VISIBLE_TAB_IDS) {
      assert.ok(
        JOB_CARD_MOBILE_PRIMARY_NAV.some((item) => item.id === id) ||
          JOB_CARD_MORE_DESTINATIONS.some(
            (item) => item.kind === "tab" && item.id === id
          ),
        `domain ${id} must remain reachable`
      );
    }
  });

  test("rail selection highlights More for deeper destinations", () => {
    assert.equal(resolveJobCardMobileRailSelection("overview", false), "overview");
    assert.equal(resolveJobCardMobileRailSelection("tasks", false), "tasks");
    assert.equal(
      resolveJobCardMobileRailSelection("attachments", false),
      "attachments"
    );
    assert.equal(resolveJobCardMobileRailSelection("calendar", false), "more");
    assert.equal(resolveJobCardMobileRailSelection("payments", false), "more");
    assert.equal(resolveJobCardMobileRailSelection("overview", true), "more");
    assert.equal(isJobCardMoreActiveDestination("calendar", false), true);
    assert.equal(isJobCardMoreActiveDestination("overview", false), false);
    assert.equal(isJobCardMoreActiveDestination("overview", true), true);
  });

  test("desktop retains the full visible tab set", () => {
    assert.equal(JOB_CARD_DESKTOP_NAV_MIN_WIDTH, 1200);
    assert.equal(JOB_CARD_VISIBLE_TABS.length, 7);
    assert.match(TABS, /data-jobcard-tabs-mode="desktop"/);
    assert.match(TABS, /data-jobcard-tabs-mode="mobile"/);
    assert.match(TABS, /min-\[1200px\]:flex/);
    assert.match(TABS, /JOB_CARD_VISIBLE_TABS\.map/);
    assert.match(TABS, /JOB_CARD_MOBILE_PRIMARY_NAV/);
    assert.match(TABS, /JobCardMoreSheet/);
    assert.match(MORE, /data-jobcard-more-sheet/);
    assert.match(MORE, /data-jobcard-more-destination/);
    assert.match(MORE, /Escape/);
    assert.match(MORE, /safe-area-inset-bottom/);
  });

  test("Photos label maps to attachments workspace; Tasks stays Tasks", () => {
    assert.equal(resolveJobCardDomainWorkspace("attachments"), "attachments");
    assert.equal(resolveJobCardDomainWorkspace("photos"), "attachments");
    assert.equal(resolveJobCardDomainWorkspace("tasks"), "tasks");
    assert.equal(coerceJobCardVisibleTab("photos"), "attachments");
    assert.equal(JOB_CARD_DOMAIN_WORKSPACE.attachments, "attachments");
    assert.equal(JOB_CARD_DOMAIN_WORKSPACE.tasks, "tasks");
    assert.match(SECONDARY, /tabId="attachments"/);
    assert.match(SECONDARY, /title="Photos"/);
    assert.match(SECONDARY, /JobCardAttachmentsWorkspace/);
    assert.match(SECONDARY, /JobCardTasksWorkspace/);
    assert.match(TASKS_WS, /tabId="tasks"/);
    assert.doesNotMatch(TASKS_WS, /tabId="attachments"/);
    assert.match(CLIENT, /import JobCardSecondaryPanels from/);
    assert.doesNotMatch(CLIENT, /next\/dynamic/);
    assert.match(TABS, /data-jobcard-mobile-primary=\{tab\.id\}/);
    assert.match(TABS, /JOB_CARD_MOBILE_PRIMARY_NAV/);
    // Mobile Photos primary uses attachments id, not a second photos domain.
    assert.match(
      read("app/tools/roofing/jobCard/jobCardMobileNav.ts"),
      /id: "attachments", label: "Photos"/
    );
    // One Add task control in empty Tasks (header only).
    assert.match(TASKS_WS, /data-jobcard-tasks-add="true"/);
    assert.doesNotMatch(TASKS_WS, /data-jobcard-tasks-add-empty/);
  });
});

describe("Phase 8 primary lifecycle CTA", () => {
  test("reuses canonical eligibility — one primary at a time", () => {
    assert.equal(
      resolveJobCardOverviewPrimaryAction(
        eligibility({ canApproveJob: true, canSchedule: true })
      )?.kind,
      "approve_job"
    );
    assert.equal(
      resolveJobCardOverviewPrimaryAction(eligibility({ canSchedule: true }))
        ?.kind,
      "schedule"
    );
    assert.equal(
      resolveJobCardOverviewPrimaryAction(eligibility({ canStartWork: true }))
        ?.kind,
      "start_work"
    );
    assert.equal(
      resolveJobCardOverviewPrimaryAction(eligibility({ canCompleteJob: true }))
        ?.kind,
      "complete_job"
    );
    assert.equal(
      resolveJobCardOverviewForwardAction(eligibility({ canStartWork: true })),
      null
    );
  });

  test("Overview owns presentation; schedule section does not duplicate", () => {
    assert.match(CLIENT, /resolveJobCardOverviewPrimaryAction/);
    assert.match(CLIENT, /overviewOwnsLifecycleCta/);
    assert.match(SCHEDULE, /overviewOwnsLifecycleCta/);
    assert.match(CLIENT, /placement="sticky"/);
    assert.match(CLIENT, /data-jobcard-sticky-primary|placement="sticky"/);
    const sticky = renderToStaticMarkup(
      createElement(JobCardForwardLifecycleAction, {
        action: {
          kind: "start_work",
          label: "Start work",
          owner: "overview_primary",
        },
        placement: "sticky",
        onStartWork: () => undefined,
      })
    );
    assert.match(sticky, /data-jobcard-sticky-primary="true"/);
    assert.match(sticky, /Start work/);
    assert.equal((sticky.match(/Start work/g) ?? []).length, 1);
  });
});

describe("Phase 8 Overview hierarchy + Activity + roles", () => {
  test("Overview order: state → brief (tasks inside) → financial → activity", () => {
    assert.match(OVERVIEW, /data-jobcard-overview-situation/);
    assert.match(OVERVIEW, /data-jobcard-overview-brief|fieldBrief/);
    assert.match(OVERVIEW, /data-jobcard-overview-financial/);
    assert.match(OVERVIEW, /recentActivitySummary/);
    assert.doesNotMatch(OVERVIEW, /tasksSummary/);
    assert.match(CLIENT, /JobCardFieldBrief/);
    assert.match(CLIENT, /data-jobcard-overview-activity-teaser/);
    assert.match(CLIENT, /tasksReadStatus=\{jobTasks\.readStatus\}/);
    assert.match(FIELD_BRIEF, /data-jobcard-field-brief/);
    assert.match(FIELD_BRIEF, /resolveFieldBriefTaskPreview/);
    assert.doesNotMatch(FIELD_BRIEF, /No tasks yet/);
  });

  test("Activity is an on-demand destination at every width (Phase 12.5: no permanent rail)", () => {
    assert.doesNotMatch(CLIENT, /data-jobcard-activity-rail/);
    assert.match(CLIENT, /mobileActivityFocused/);
    assert.match(CLIENT, /data-jobcard-mobile-activity-destination/);
    assert.match(ACTIVITY, /max-h-\[min\(420px,50vh\)\]/);
    assert.match(
      read("app/tools/roofing/jobCard/JobCardTabs.tsx"),
      /data-jobcard-activity-destination-toggle/
    );
  });

  test("Job actions become quiet More job actions overflow", () => {
    assert.match(DISPOSITION, /More job actions/);
    assert.doesNotMatch(DISPOSITION, />Job actions</);
    assert.match(CLIENT, /suppressCommercial/);
    assert.match(CLIENT, /restrictedFieldRole/);
  });

  test("brief tasks follow actual presence: none → no region, unresolved → truthful state", () => {
    const render = (tasks: FieldBriefTask[], tasksReadStatus: FieldBriefTasksReadStatus) =>
      renderToStaticMarkup(
        createElement(JobCardFieldBrief, {
          model: briefModel(tasks),
          omitIdentityHero: true,
          tasksReadStatus,
          onOpenTasks: () => undefined,
        })
      );

    const none = render([], "ready");
    assert.doesNotMatch(none, /data-field-brief-tasks/);
    assert.doesNotMatch(none, /No tasks|No open tasks/);

    const loading = render([], "loading");
    assert.match(loading, /data-field-brief-tasks-loading/);
    assert.match(loading, /Checking tasks…/);
    assert.doesNotMatch(loading, /data-field-brief-tasks=/);

    const failed = render([], "error");
    assert.match(failed, /data-field-brief-tasks-error/);
    assert.match(failed, /Tasks could not be loaded/);

    const few = render([task("a", "Inspect flashing"), task("b", "Confirm dumpster")], "ready");
    assert.match(few, /Inspect flashing/);
    assert.match(few, /Confirm dumpster/);
    assert.doesNotMatch(few, /View all/);

    const many = render(
      ["a", "b", "c", "d", "e"].map((id) => task(id, `Task ${id}`)),
      "ready"
    );
    assert.match(many, /Task a/);
    assert.match(many, /Task c/);
    assert.doesNotMatch(many, /Task d/);
    assert.match(many, /View all 5 open tasks/);

    const staleAfterError = render([task("a", "Inspect flashing")], "error");
    assert.match(staleAfterError, /Inspect flashing/);
  });

  test("no duplicate schedule authority writers on Overview", () => {
    assert.match(CLIENT, /JobCardScheduleWorkspacePanel/);
    assert.match(CLIENT, /onSubmitSchedule=\{submitJobCardSchedule\}/);
    assert.doesNotMatch(
      OVERVIEW,
      /\/api\/jobs\/schedule|submitJobCardSchedule/
    );
  });
});
