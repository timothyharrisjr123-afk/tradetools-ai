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
import {
  formatJobCardOverviewSituationLabel,
  resolveJobCardOverviewSituation,
  type JobCardOverviewSituationInput,
} from "@/app/lib/jobCardOverviewSituation";
import { shouldStickyActionYield } from "@/app/lib/stickyActionYield";
import {
  JOB_CARD_CLOSEOUT_COPIED,
  buildJobCardCloseoutViewModel,
  describeCloseoutLinkCopied,
} from "@/app/lib/jobCardCloseoutViewModel";
import {
  PACKET_REPEAT_JOB_TITLE,
  resolvePacketIntakeTitle,
} from "@/app/lib/packetIdentityEntry";
import { JOB_ATTACHMENTS_ADD_LABEL } from "@/app/lib/jobAttachmentTypes";
import {
  resolveInitialBoardViewMode,
  timeInStageToneClass,
} from "@/app/tools/roofing/saved/jobsBoardUtils";

import { catalogUnitQuantityMismatchNote } from "@/app/lib/catalogCoverageCompatibility";
import { CATALOG_TABLE_HEADERS } from "@/app/lib/catalogContractorLabels";
import { formatWorkbenchUnitMathLabel } from "@/app/lib/proposalBuilderWorkbenchEstimatePresenter";
import { formatBuilderVersionStatusLabelForProposal } from "@/app/lib/proposalContractorLifecycle";
import {
  CONTRACTOR_PDF_DOWNLOAD_ORIGINAL_AGREEMENT_LABEL,
  CONTRACTOR_PDF_DOWNLOAD_SIGNED_AGREEMENT_LABEL,
} from "@/app/lib/proposalPdfContractorDownload";
import { TEMPLATES_FUTURE_ONLY_COPY } from "@/app/tools/roofing/templates/templatesWorkspaceFlow";
import { getVisibleNavSections } from "@/app/tools/roofing/fieldDiveNavConfig";

import { formatPurchasePayLabel } from "@/app/components/proposal-packet/useProposalPurchaseAction";
import { PROPOSAL_CUSTOMER_PACKET_ACCEPTED_CONTACT_HEADING } from "@/app/lib/proposalCustomerPacketViewModel";
import { PUBLIC_PROJECT_RECORD_DOWNLOAD_UNSIGNED } from "@/app/lib/publicProjectRecordViewModel";
import { jobPaymentWorkspaceSummaryRows } from "@/app/lib/jobPaymentWorkspace";

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

const baseSituation: JobCardOverviewSituationInput = {
  stage: "intake",
  disposition: null,
  hasDraftProposal: false,
  hasSentProposal: false,
  acceptedAwaitingApproval: false,
  signed: false,
  hasActiveSchedule: false,
  productionStartedAt: null,
  pendingScopeChange: false,
  proposalFactsReady: true,
  remainingCents: null,
  suppressCommercial: false,
};

describe("Phase 12.5 G2 — state-dependent Overview", () => {
  test("each stage has its own headline; loading never guesses", () => {
    const at = (patch: Partial<JobCardOverviewSituationInput>) =>
      resolveJobCardOverviewSituation({ ...baseSituation, ...patch });
    assert.equal(at({ stage: null }).headline, null);
    assert.equal(at({ proposalFactsReady: false }).kind, "loading");
    assert.equal(at({}).kind, "intake");
    assert.equal(at({ stage: "proposal", hasDraftProposal: true }).kind, "proposal_draft");
    assert.equal(at({ stage: "proposal", hasSentProposal: true }).kind, "proposal_sent");
    assert.equal(
      at({ stage: "proposal", acceptedAwaitingApproval: true }).kind,
      "accepted_awaiting_approval"
    );
    assert.equal(at({ stage: "approved" }).headline, "Approved — ready to schedule");
    assert.equal(at({ stage: "scheduled", hasActiveSchedule: true }).headline, "Scheduled");
    assert.equal(at({ stage: "production" }).headline, "Work in progress");
  });

  test("complete leads with closeout; balance vs settled vs unknown stay distinct", () => {
    const at = (remainingCents: number | null) =>
      resolveJobCardOverviewSituation({ ...baseSituation, stage: "complete", remainingCents });
    assert.equal(at(45000).kind, "complete_balance");
    assert.equal(at(45000).closeoutLeads, true);
    assert.equal(at(0).kind, "complete_settled");
    assert.equal(at(null).kind, "complete_money_unknown");
    assert.notEqual(at(null).kind, "complete_settled");
  });

  test("disposition preserves stage wording; field roles see no commercial detail", () => {
    const hold = resolveJobCardOverviewSituation({
      ...baseSituation,
      stage: "scheduled",
      disposition: "on_hold",
    });
    assert.equal(hold.kind, "on_hold");
    const field = resolveJobCardOverviewSituation({
      ...baseSituation,
      stage: "production",
      pendingScopeChange: true,
      suppressCommercial: true,
    });
    assert.deepEqual(field.details, []);
    const office = resolveJobCardOverviewSituation({
      ...baseSituation,
      stage: "production",
      pendingScopeChange: true,
    });
    assert.match(formatJobCardOverviewSituationLabel(office) ?? "", /review in Proposals/);
  });

  test("Job Card wires closeout as leading section and drops the permanent Activity rail", () => {
    const client = read("app/tools/roofing/jobCard/JobCardClient.tsx");
    assert.match(client, /leadingSection=\{/);
    assert.match(client, /overviewSituation\.closeoutLeads/);
    assert.doesNotMatch(client, /data-jobcard-activity-rail/);
    assert.match(client, /overviewShowsMoneySummary = showOverviewPaymentSignal/);
    assert.doesNotMatch(client, /data-jobcard-overview-money="remaining"/);
    assert.match(client, /Open Payments/);
  });
});

describe("Phase 12.5 G2 — closeout sharing honesty", () => {
  test("copied is not sent; expiry comes from the server link", () => {
    assert.match(JOB_CARD_CLOSEOUT_COPIED, /not sent/);
    const copy = describeCloseoutLinkCopied("2026-10-24T12:00:00.000Z");
    assert.match(copy, /works until Oct 24, 2026/);
    assert.doesNotMatch(describeCloseoutLinkCopied(null), /until|30 days/);
    const loading = buildJobCardCloseoutViewModel({
      stage: "complete",
      completedAt: null,
      timeZone: "America/Chicago",
      accepted: true,
      signed: false,
      workspace: null,
      scopeChanges: [],
      paymentsLoading: true,
    })!;
    assert.equal(loading.balanceLabel, "Checking payments…");
    const src = read("app/tools/roofing/jobCard/JobCardCloseoutSummary.tsx");
    assert.doesNotMatch(src, /emerald/);
    assert.match(src, /data-jobcard-closeout-open-payments/);
  });
});

describe("Phase 12.5 G2 — Jobs board priority and phone default", () => {
  test("phone defaults to List unless the user chose a view", () => {
    assert.equal(resolveInitialBoardViewMode({ explicit: null, isPhone: true }), "list");
    assert.equal(resolveInitialBoardViewMode({ explicit: "board", isPhone: true }), "board");
    assert.equal(resolveInitialBoardViewMode({ explicit: null, isPhone: false }), "board");
  });

  test("age is neutral and card uses Production lead", () => {
    for (const tone of ["neutral", "warning", "danger"] as const) {
      assert.equal(timeInStageToneClass(tone as never), "text-slate-400");
    }
    const card = read("app/tools/roofing/saved/components/JobsBoardCard.tsx");
    assert.match(card, /Production lead/);
    const header = read("app/tools/roofing/saved/components/JobsBoardHeader.tsx");
    assert.match(header, />\s*Jobs\s*</);
  });
});

describe("Phase 12.5 G2 — mobile overlay ownership", () => {
  const base = {
    activeTagName: "BUTTON",
    activeInputType: null,
    activeIsContentEditable: false,
    openOverlayCount: 0,
  };
  test("sticky CTA yields to menus, dialogs, and text entry", () => {
    assert.equal(shouldStickyActionYield(base), false);
    assert.equal(shouldStickyActionYield({ ...base, openOverlayCount: 1 }), true);
    assert.equal(shouldStickyActionYield({ ...base, activeTagName: "TEXTAREA" }), true);
    assert.equal(
      shouldStickyActionYield({ ...base, activeTagName: "INPUT", activeInputType: "text" }),
      true
    );
    assert.equal(
      shouldStickyActionYield({ ...base, activeTagName: "INPUT", activeInputType: "checkbox" }),
      false
    );
  });
});

describe("Phase 12.5 G2 — New job and Photos wording", () => {
  test("intake page is always New job with visible field labels", () => {
    assert.equal(resolvePacketIntakeTitle({}), PACKET_REPEAT_JOB_TITLE);
    const roofing = read("app/tools/roofing/RoofingClient.tsx");
    assert.match(roofing, /Find or add customer/);
    assert.match(roofing, /htmlFor="customer-name"/);
    assert.doesNotMatch(roofing, /<h1>Start my first job<\/h1>/);
  });

  test("Photos add action is explicit and empty copy is not duplicated", () => {
    assert.equal(JOB_ATTACHMENTS_ADD_LABEL, "Add photos or files");
    const src = read("app/tools/roofing/jobCard/JobCardAttachmentsWorkspace.tsx");
    assert.doesNotMatch(src, /No photos yet/);
  });
});

describe("Phase 12.5 G3 - settings and pricing", () => {
  test("read-only panels have one Close action and payment setup naming", () => {
    const editor = read("app/components/ui/FocusedEditor.tsx");
    assert.equal((editor.match(/data-focused-editor-close-action/g) ?? []).length, 1);
    const payments = read("app/tools/settings/CompanySettingsPaymentsEditor.tsx");
    assert.match(payments, /"Payment setup"/);
  });

  test("advanced shelf is hidden from navigation", () => {
    const labels = getVisibleNavSections().map((section) => section.label);
    assert.ok(!labels.includes("Advanced"));
  });

  test("pricing copy explains cost-based pricing, unknown cost, and no accuracy promise", () => {
    const src = read("app/tools/settings/pricing/CompanyPricingPolicySettingsClient.tsx");
    assert.match(src, /data-pricing-unknown-cost-note/);
    assert.match(src, /Items with a set selling price keep that price/);
    assert.match(src, /never changes prices/);
    assert.match(src, /doesn&apos;t check how accurate a measurement is/);
  });
});

describe("Phase 12.5 G3 - catalog", () => {
  test("table leads with selling terms; cost is subordinate", () => {
    assert.deepEqual(CATALOG_TABLE_HEADERS.slice(0, 5), [
      "Item",
      "Selling price",
      "Unit",
      "Quantity basis",
      "Status",
    ]);
  });

  test("unit mismatch is flagged, never rewritten", () => {
    assert.match(
      catalogUnitQuantityMismatchNote({
        quantity_source: "debris_tons",
        unit: "each",
        unitLabel: "Each",
      }) ?? "",
      /Check the unit before quoting/
    );
    assert.equal(
      catalogUnitQuantityMismatchNote({
        quantity_source: "debris_tons",
        unit: "ton" as never,
        unitLabel: "Ton",
      }) === null,
      false
    );
  });

  test("no permanent ready banner; phones get rows", () => {
    const ws = read("app/tools/roofing/catalog/CatalogItemsWorkspace.tsx");
    assert.doesNotMatch(ws, /Catalog ready for templates/);
    const table = read("app/admin/catalog/components/CatalogItemTable.tsx");
    assert.match(table, /data-catalog-mobile-list/);
  });
});

describe("Phase 12.5 G3 - templates", () => {
  test("reusable changes are future-only and edits lead", () => {
    assert.match(TEMPLATES_FUTURE_ONLY_COPY, /Sent proposals never change/);
    const review = read("app/tools/roofing/templates/TemplatesQuoteSetupReview.tsx");
    assert.match(review, /data-templates-primary-actions/);
    assert.match(review, /data-templates-usage-status/);
  });
});

describe("Phase 12.5 G3 - builder and preview", () => {
  test("version status uses canonical labels", () => {
    assert.equal(
      formatBuilderVersionStatusLabelForProposal(
        { latest_sent_version_id: null, signed_version_id: null },
        null
      ),
      "Draft"
    );
    assert.equal(
      formatBuilderVersionStatusLabelForProposal(
        { latest_sent_version_id: "11111111-1111-4111-8111-111111111111", signed_version_id: "11111111-1111-4111-8111-111111111111" },
        null
      ),
      "Accepted"
    );
  });

  test("qty x unit price shows only when it agrees with the amount", () => {
    const base = {
      statusKind: "priced" as const,
      qtyLabel: "3 sq",
      qtyUnresolved: false,
      unitPriceCents: 15000,
    };
    assert.equal(
      formatWorkbenchUnitMathLabel({
        ...base,
        snapshotLineTotalCents: 45000,
        displayedLineCents: 45000,
      }),
      "3 sq \u00d7 $150.00"
    );
    assert.equal(
      formatWorkbenchUnitMathLabel({
        ...base,
        snapshotLineTotalCents: 45000,
        displayedLineCents: 46000,
      }),
      null
    );
  });

  test("accepted preview offers the agreement and return to job, not Send", () => {
    assert.equal(CONTRACTOR_PDF_DOWNLOAD_ORIGINAL_AGREEMENT_LABEL, "Download original agreement");
    assert.equal(CONTRACTOR_PDF_DOWNLOAD_SIGNED_AGREEMENT_LABEL, "Download signed agreement");
    const client = read("app/tools/roofing/proposals/preview/ProposalCustomerPreviewClient.tsx");
    assert.match(client, /suppressOrdinarySend !== true/);
    assert.match(client, /agreementHref=/);
    assert.match(client, /data-preview-historical-incomplete/);
  });
});

describe("Phase 12.5 G4 - customer page after acceptance", () => {
  test("project record leads and package choice is no longer offered", () => {
    const packet = read("app/components/proposal-packet/ProposalPacket.tsx");
    assert.match(packet, /const recordLeads = accepted && packet\.projectRecord != null/);
    assert.match(packet, /\{recordLeads \? projectRecordSection : null\}/);
    assert.match(packet, /\{showChoice && !accepted \? \(/);
  });

  test("accepted package is labeled as the original agreement", () => {
    const purchase = read("app/components/proposal-packet/ProposalPacketPurchase.tsx");
    assert.match(purchase, /accepted \? PUBLIC_PAYMENT_ORIGINAL_AGREEMENT_LABEL/);
    assert.equal(PUBLIC_PROJECT_RECORD_DOWNLOAD_UNSIGNED, "Download original agreement");
  });

  test("pay action names the request amount, not the balance", () => {
    assert.equal(
      formatPurchasePayLabel({ state: "progress_due", kind: "progress", amountLabel: "$450" }),
      "Pay $450"
    );
    assert.equal(
      formatPurchasePayLabel({ state: "deposit_due", kind: "deposit", amountLabel: "$450" }),
      null
    );
    assert.equal(
      formatPurchasePayLabel({ state: "processing", kind: "progress", amountLabel: "$450" }),
      null
    );
    const purchase = read("app/components/proposal-packet/ProposalPacketPurchase.tsx");
    assert.match(purchase, /data-proposal-payment-project-balance/);
  });

  test("post-acceptance help is contact, not a sales prompt", () => {
    assert.equal(PROPOSAL_CUSTOMER_PACKET_ACCEPTED_CONTACT_HEADING, "Contact your contractor");
    const contact = read("app/components/proposal-packet/ProposalPacketContact.tsx");
    assert.match(contact, /askHref && !accepted/);
  });
});

describe("Phase 12.5 G4 - scope-change public identity", () => {
  test("public review carries contractor identity from a tenancy-scoped read", () => {
    const route = read("app/api/scope-changes/public/[token]/route.ts");
    assert.match(route, /from\("companies"\)\s*\.select\("name, phone"\)\s*\.eq\("id", resolved\.company_id\)/);
    const client = read("app/scope-changes/[token]/PublicScopeChangeReviewClient.tsx");
    assert.match(client, /PROPOSAL_PACKET_PAGE/);
    assert.match(client, /data-scope-change-contractor/);
    assert.match(client, /data-scope-change-public-review/);
  });
});

describe("Phase 12.5 G4 - payments workspace", () => {
  test("refund tile appears only when refunds exist", () => {
    const base = { contractTotalCents: 100000, receivedGrossCents: 45000, collectibleRemainingCents: 55000 };
    assert.ok(
      !jobPaymentWorkspaceSummaryRows({ ...base, refundedCents: 0 }).some((row) => row.label === "Refunded")
    );
    assert.ok(
      jobPaymentWorkspaceSummaryRows({ ...base, refundedCents: 5000 }).some((row) => row.label === "Refunded")
    );
  });

  test("email note opens on request; history and earlier attempts collapse", () => {
    const src = read("app/tools/roofing/jobCard/JobCardPaymentsWorkspace.tsx");
    assert.match(src, /\{emailNoteOpen \? \(/);
    assert.match(src, /data-jobcard-payments-email-add-note/);
    assert.match(src, /data-jobcard-payments-history-disclosure/);
    assert.match(src, /data-jobcard-payments-delivery-earlier/);
  });
});

describe("Phase 12.5 G4 - login and shell", () => {
  test("bare login lands on Jobs", () => {
    const login = read("app/login/page.tsx");
    assert.match(login, /LOGIN_DEFAULT_DESTINATION = "\/tools\/roofing\/saved"/);
  });

  test("one main landmark; no empty desktop header; mobile sign-out in the sheet", () => {
    const shell = read("app/tools/roofing/FieldDiveAppShell.tsx");
    assert.equal((shell.match(/<main\b/g) ?? []).length, 1);
    assert.match(shell, /sm:px-6 lg:hidden"/);
    assert.match(shell, /data-fielddive-mobile-nav-signout/);
    const roofing = read("app/tools/roofing/RoofingClient.tsx");
    assert.equal((roofing.match(/<main\b/g) ?? []).length, 0);
  });
});
