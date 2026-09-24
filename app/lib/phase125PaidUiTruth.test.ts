import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SCOPE_CHANGE_BASIS_UNAVAILABLE_MESSAGE,
  buildScopeChangeEditorTotals,
  describeScopeChangeProposeOutcome,
  hydrateScopeChangeDraftLines,
  resolveScopeChangeEditorBasis,
  scopeChangeHistoryTotalCopy,
  sumClientLineDeltasCents,
} from "@/app/lib/jobScopeChangeViewModel";
import {
  boardCardScheduleIntegrityLabel,
  boardScheduleLoadBanner,
  boardScheduleLoadTone,
} from "@/app/lib/jobScheduleStageCoherence";
import {
  summarizePricing,
  summarizeTimezone,
} from "@/app/lib/companySettingsSummary";
import {
  FIELD_BRIEF_SCOPE_ON_PROPOSAL_LABEL,
  buildFieldBriefViewModel,
  resolveFieldBriefApprovedScopeLabel,
} from "@/app/lib/fieldBriefModel";
import {
  buildMobileAgendaDays,
  defaultAgendaScheduleDate,
  formatAgendaDayLabel,
} from "@/app/lib/calendarMobileAgenda";
import { formatMoneyRowValue } from "@/app/components/ui/MoneyRow";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

describe("Phase 12.5 G1 — scope-change editor basis", () => {
  test("negative authorized deltas stay signed (no clamp to zero)", () => {
    const basis = resolveScopeChangeEditorBasis({
      loadStatus: "ready",
      contractTotalCents: 1_550_000,
      rows: [{ status: "authorized", priceDeltaCents: -300_000 }],
    });
    assert.equal(basis.status, "ready");
    if (basis.status !== "ready") return;
    assert.equal(basis.previouslyAuthorizedDeltasCents, -300_000);
    assert.equal(basis.originalAgreementCents, 1_850_000);
    const totals = buildScopeChangeEditorTotals({
      originalAgreementCents: basis.originalAgreementCents,
      previouslyAuthorizedDeltasCents: basis.previouslyAuthorizedDeltasCents,
      thisChangeDeltaCents: 10_000,
    });
    assert.equal(totals.currentContractCents, 1_550_000);
    assert.equal(totals.proposedNewTotalCents, 1_560_000);
  });

  test("unknown contract total is unavailable, never $0", () => {
    assert.deepEqual(
      resolveScopeChangeEditorBasis({
        loadStatus: "ready",
        contractTotalCents: null,
        rows: [],
      }),
      { status: "unavailable" }
    );
    assert.deepEqual(
      resolveScopeChangeEditorBasis({
        loadStatus: "error",
        contractTotalCents: 100,
        rows: [],
      }),
      { status: "unavailable" }
    );
    assert.deepEqual(
      resolveScopeChangeEditorBasis({
        loadStatus: "loading",
        contractTotalCents: null,
        rows: [],
      }),
      { status: "loading" }
    );
    assert.match(SCOPE_CHANGE_BASIS_UNAVAILABLE_MESSAGE, /could not be confirmed/);
  });

  test("panel source no longer clamps or zero-fills the basis", () => {
    const panel = read("app/tools/roofing/jobCard/JobCardScopeChangesPanel.tsx");
    assert.doesNotMatch(panel, /Math\.max\(0,\s*previouslyAuthorized\)/);
    assert.doesNotMatch(panel, /originalAgreementCents \?\? 0/);
    assert.match(panel, /resolveScopeChangeEditorBasis/);
    assert.match(panel, /data-scope-change-basis-unavailable/);
    // Propose waits for a confirmed basis.
    assert.match(panel, /disabled=\{busy \|\| proposeBlocked\}/);
  });

  test("editor 'This change' sums camelCase client lines", () => {
    assert.equal(
      sumClientLineDeltasCents([
        { lineDeltaCents: 12_500 },
        { lineDeltaCents: -2_500 },
      ]),
      10_000
    );
    const panel = read("app/tools/roofing/jobCard/JobCardScopeChangesPanel.tsx");
    assert.match(panel, /sumClientLineDeltasCents\(lines\)/);
  });
});

describe("Phase 12.5 G1 — scope-change draft resume", () => {
  test("persisted lines hydrate in sort order", () => {
    const lines = hydrateScopeChangeDraftLines([
      {
        id: "b",
        changeKind: "remove",
        description: "Old gutters",
        quantity: 10,
        unit: "lf",
        unitPriceCents: null,
        lineDeltaCents: -5_000,
        sortOrder: 1,
      },
      {
        id: "a",
        changeKind: "add",
        description: "Rake edge",
        quantity: 1,
        unit: "ls",
        unitPriceCents: 22_500,
        lineDeltaCents: 22_500,
        sortOrder: 0,
      },
    ]);
    assert.equal(lines.length, 2);
    assert.equal(lines[0].description, "Rake edge");
    assert.equal(lines[1].lineDeltaCents, -5_000);
    assert.equal(lines[1].sortOrder, 1);
  });

  test("no persisted lines → one empty add line", () => {
    const lines = hydrateScopeChangeDraftLines(undefined);
    assert.equal(lines.length, 1);
    assert.equal(lines[0].changeKind, "add");
    assert.equal(lines[0].lineDeltaCents, 0);
  });

  test("panel resumes with persisted lines, not a blank line", () => {
    const panel = read("app/tools/roofing/jobCard/JobCardScopeChangesPanel.tsx");
    assert.match(panel, /hydrateScopeChangeDraftLines\(draftRow\.lines\)/);
    assert.doesNotMatch(panel, /lines: \[emptyLine\("add"\)\],/);
  });
});

describe("Phase 12.5 G1 — propose wording and link recovery", () => {
  test("no 'Send' claim when no email is sent", () => {
    const panel = read("app/tools/roofing/jobCard/JobCardScopeChangesPanel.tsx");
    assert.doesNotMatch(panel, /Propose \/ Send/);
    assert.match(panel, /SCOPE_CHANGE_PROPOSE_ACTION_LABEL/);
    assert.match(panel, /no email is sent/);
  });

  test("propose outcome distinguishes link ready from link missing", () => {
    const ready = describeScopeChangeProposeOutcome("https://x.test/scope-changes/t");
    assert.equal(ready.kind, "link_ready");
    assert.match(ready.message, /did not email/);
    const missing = describeScopeChangeProposeOutcome(null);
    assert.equal(missing.kind, "link_missing");
    assert.match(missing.message, /could not be created/);
  });

  test("proposed rows can recover a review link via the idempotent propose replay", () => {
    const panel = read("app/tools/roofing/jobCard/JobCardScopeChangesPanel.tsx");
    assert.match(panel, /data-scope-change-get-review-link/);
    assert.match(panel, /action: "propose",\s*expectedRowVersion: row\.rowVersion/);
    const route = read("app/api/jobs/[jobId]/scope-changes/[scopeChangeId]/route.ts");
    assert.match(route, /result\.scope_change\.status === "proposed"/);
  });

  test("history labels unapplied totals honestly", () => {
    assert.equal(
      scopeChangeHistoryTotalCopy("voided", "$1,050.00"),
      "Proposed total $1,050.00 — not applied"
    );
    assert.equal(
      scopeChangeHistoryTotalCopy("proposed", "$20,200.00"),
      "Proposed total $20,200.00 — not applied"
    );
    assert.equal(
      scopeChangeHistoryTotalCopy("authorized", "$19,750.00"),
      "Total after this change $19,750.00"
    );
  });
});

describe("Phase 12.5 G1 — customer conflict action", () => {
  test("recheck control is labeled as the authorization it performs", () => {
    const client = read("app/scope-changes/[token]/PublicScopeChangeReviewClient.tsx");
    assert.match(client, /Try approving again/);
    assert.doesNotMatch(client, /"Check again"/);
    assert.doesNotMatch(client, /server decides/);
    assert.doesNotMatch(client, /opacity-60/);
  });
});

describe("Phase 12.5 G1 — async honesty", () => {
  test("board schedule loading is neutral; failure is error", () => {
    assert.equal(boardScheduleLoadBanner("loading"), "Checking schedules…");
    assert.equal(boardScheduleLoadTone("loading"), "neutral");
    assert.equal(boardScheduleLoadTone("error"), "error");
    assert.equal(boardScheduleLoadTone("ready"), null);
  });

  test("cards do not repeat unavailable copy while schedules load or fail", () => {
    assert.equal(boardCardScheduleIntegrityLabel("unknown", "loading"), null);
    assert.equal(boardCardScheduleIntegrityLabel("unknown", "error"), null);
    assert.match(
      boardCardScheduleIntegrityLabel("missing_planned_schedule", "ready") ?? "",
      /missing/
    );
  });

  test("board no longer renders the amber loading banner", () => {
    const saved = read("app/tools/roofing/saved/SavedClient.tsx");
    assert.doesNotMatch(
      saved,
      /border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"\s*data-board-schedule-load-banner/
    );
    assert.match(saved, /boardCardScheduleIntegrityLabel\(coherence, r3fSchedulesLoadStatus\)/);
    const errorState = read("app/tools/roofing/saved/components/JobsBoardErrorState.tsx");
    assert.match(errorState, /bg-red-50/);
  });

  test("settings never claim resolved-empty while loading", () => {
    assert.equal(summarizeTimezone(null, "loading"), "Checking…");
    assert.equal(summarizeTimezone(null, "ready"), "No timezone set");
    assert.equal(summarizePricing(null, "loading"), "Checking…");
    assert.equal(summarizePricing(null, "ready"), "Not set up");
  });

  test("money row shows unknown explicitly and performs no arithmetic", () => {
    assert.equal(formatMoneyRowValue(null), "Unavailable");
    assert.equal(formatMoneyRowValue(undefined, "delta", "Checking…"), "Checking…");
    assert.equal(formatMoneyRowValue(-300_000, "delta"), "−$3,000.00");
    assert.equal(formatMoneyRowValue(0, "delta"), "$0.00");
  });
});

describe("Phase 12.5 G2 — field brief authorized work", () => {
  test("scope is the accepted package, never a status word", () => {
    assert.equal(
      resolveFieldBriefApprovedScopeLabel({
        acceptedProposalIds: { p1: true },
        packageLabelsByProposalId: { p1: "Architectural shingles · Full tear-off" },
      }),
      "Architectural shingles · Full tear-off"
    );
    assert.equal(
      resolveFieldBriefApprovedScopeLabel({
        acceptedProposalIds: { p1: true },
        packageLabelsByProposalId: { p1: "Signed" },
      }),
      FIELD_BRIEF_SCOPE_ON_PROPOSAL_LABEL
    );
    assert.equal(
      resolveFieldBriefApprovedScopeLabel({
        acceptedProposalIds: {},
        packageLabelsByProposalId: {},
      }),
      null
    );
  });

  test("active accepted proposal wins over older accepted proposals", () => {
    assert.equal(
      resolveFieldBriefApprovedScopeLabel({
        acceptedProposalIds: { old: true, cur: true },
        packageLabelsByProposalId: { old: "Old package", cur: "Current package" },
        activeProposalId: "cur",
      }),
      "Current package"
    );
  });

  test("brief loading does not claim no authorized scope", () => {
    const model = buildFieldBriefViewModel({
      approvedScopeLabel: null,
      authorizedWorkStatus: "loading",
      accessNotes: "Gate code 4411",
    });
    assert.equal(model.authorizedWork.status, "loading");
    assert.equal(model.authorizedWork.accessNotes, "Gate code 4411");
    const brief = read("app/tools/roofing/jobCard/JobCardFieldBrief.tsx");
    assert.match(brief, /Checking authorized work…/);
    const client = read("app/tools/roofing/jobCard/JobCardClient.tsx");
    assert.doesNotMatch(client, /approvedScopeLabel: jobHasCanonicalAcceptedAgreement/);
    assert.match(client, /accessNotes: jobCardSchedule\.active\?\.notes/);
  });

  test("field brief shows no money (role-safe)", () => {
    const brief = read("app/tools/roofing/jobCard/JobCardFieldBrief.tsx");
    assert.doesNotMatch(brief, /formatUsd|Cents/);
  });
});

describe("Phase 12.5 G2 — company calendar mobile agenda", () => {
  test("friendly dates with today and tomorrow", () => {
    assert.equal(formatAgendaDayLabel("2026-09-24", "2026-09-24"), "Today · Thu, Sep 24");
    assert.equal(formatAgendaDayLabel("2026-09-25", "2026-09-24"), "Tomorrow · Fri, Sep 25");
    assert.equal(formatAgendaDayLabel("2026-09-28", "2026-09-24"), "Mon, Sep 28");
  });

  test("agenda keeps today plus days with work only", () => {
    const days = ["2026-09-01", "2026-09-02", "2026-09-24", "2026-09-30"];
    assert.deepEqual(
      buildMobileAgendaDays({
        days,
        todayIso: "2026-09-24",
        hasWork: (iso) => iso === "2026-09-30",
      }),
      ["2026-09-24", "2026-09-30"]
    );
    assert.equal(defaultAgendaScheduleDate(days, "2026-09-24"), "2026-09-24");
    assert.equal(defaultAgendaScheduleDate(days, "2026-10-05"), "2026-09-01");
  });

  test("calendar has one region loader and no per-day loading copy", () => {
    const cal = read("app/tools/roofing/calendar/FieldDiveCalendarClient.tsx");
    assert.doesNotMatch(cal, /: "Loading schedules…"\}/);
    assert.match(cal, /data-calendar-mobile-schedule/);
    assert.doesNotMatch(cal, /data-calendar-schedule-error>\s*<p className="text-xs text-amber-800"/);
  });
});
