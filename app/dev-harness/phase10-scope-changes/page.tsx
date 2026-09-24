"use client";

import JobCardFieldBrief from "@/app/tools/roofing/jobCard/JobCardFieldBrief";
import JobCardScopeChangesPanel from "@/app/tools/roofing/jobCard/JobCardScopeChangesPanel";
import { buildFieldBriefViewModel } from "@/app/lib/fieldBriefModel";
import { formatScopeChangeDeltaLabel } from "@/app/lib/jobScopeChangeViewModel";
import { formatUsdFromCents } from "@/app/lib/jobPaymentMoney";
import { JOB_CARD_PROPOSALS_PRIMARY_BUTTON_CLASS } from "@/app/tools/roofing/jobCard/jobCardProposalsTabModel";
import type {
  JobScopeChangeClientRow,
  JobScopeChangesState,
} from "@/app/lib/useJobScopeChanges";

/**
 * Dev-only Phase 10 / Astra G9 visual fixtures.
 * Safe static props — no Auth, no DB writes, no production users.
 */

const ORIGINAL_CENTS = 1_850_000;
const AUTHORIZED_DELTA = 125_000;
const PROPOSED_DELTA = 45_000;

const authorizedRow: JobScopeChangeClientRow = {
  id: "sc-auth-1",
  status: "authorized",
  reason: "Additional decking discovered during tear-off",
  timingNote: null,
  priceDeltaCents: AUTHORIZED_DELTA,
  basisContractTotalCents: ORIGINAL_CENTS,
  rowVersion: 3,
  proposedAt: "2026-09-20T15:00:00.000Z",
  authorizedAt: "2026-09-20T18:00:00.000Z",
  declinedAt: null,
  voidedAt: null,
  createdAt: "2026-09-20T14:00:00.000Z",
  updatedAt: "2026-09-20T18:00:00.000Z",
  lines: [
    {
      changeKind: "add",
      description: "Additional decking",
      quantity: 12,
      unit: "sheets",
      unitPriceCents: 10417,
      lineDeltaCents: AUTHORIZED_DELTA,
      sortOrder: 0,
    },
  ],
};

const proposedRow: JobScopeChangeClientRow = {
  id: "sc-prop-1",
  status: "proposed",
  reason: "Customer requested ridge vent upgrade",
  timingNote: "Install with remaining ridge work",
  priceDeltaCents: PROPOSED_DELTA,
  basisContractTotalCents: ORIGINAL_CENTS + AUTHORIZED_DELTA,
  rowVersion: 2,
  proposedAt: "2026-09-23T16:00:00.000Z",
  authorizedAt: null,
  declinedAt: null,
  voidedAt: null,
  createdAt: "2026-09-23T15:00:00.000Z",
  updatedAt: "2026-09-23T16:00:00.000Z",
  lines: [
    {
      changeKind: "add",
      description: "Ridge vent upgrade",
      quantity: 40,
      unit: "lf",
      unitPriceCents: 1125,
      lineDeltaCents: PROPOSED_DELTA,
      sortOrder: 0,
    },
  ],
};

const draftRow: JobScopeChangeClientRow = {
  id: "sc-draft-1",
  status: "draft",
  reason: "Replace damaged rake edge",
  timingNote: null,
  priceDeltaCents: 22_500,
  basisContractTotalCents: ORIGINAL_CENTS + AUTHORIZED_DELTA,
  rowVersion: 1,
  proposedAt: null,
  authorizedAt: null,
  declinedAt: null,
  voidedAt: null,
  createdAt: "2026-09-23T17:00:00.000Z",
  updatedAt: "2026-09-23T17:00:00.000Z",
  lines: [
    {
      changeKind: "add",
      description: "Rake edge replacement",
      quantity: 1,
      unit: "ls",
      unitPriceCents: 22500,
      lineDeltaCents: 22_500,
      sortOrder: 0,
    },
  ],
};

const NEGATIVE_AUTHORIZED_DELTA = -300_000;

const negativeAuthorizedRow: JobScopeChangeClientRow = {
  ...authorizedRow,
  id: "sc-auth-neg",
  reason: "Customer kept existing gutters",
  priceDeltaCents: NEGATIVE_AUTHORIZED_DELTA,
  lines: [
    {
      changeKind: "remove",
      description: "Gutter replacement",
      quantity: 180,
      unit: "lf",
      unitPriceCents: null,
      lineDeltaCents: NEGATIVE_AUTHORIZED_DELTA,
      sortOrder: 0,
    },
  ],
};

function fixtureState(
  rows: JobScopeChangeClientRow[],
  contractTotalCents: number | null,
  options: {
    loadStatus?: JobScopeChangesState["loadStatus"];
    replayUrl?: string | null;
  } = {}
): JobScopeChangesState {
  return {
    rows,
    loadStatus: options.loadStatus ?? "ready",
    error: null,
    contractTotalCents,
    refresh: async () => {},
    createDraft: async () => ({
      ok: false,
      message: "Harness is read-only.",
    }),
    saveDraft: async () => ({
      ok: false,
      message: "Harness is read-only.",
    }),
    runAction: async () =>
      options.replayUrl !== undefined
        ? { ok: true, publicReviewUrl: options.replayUrl }
        : {
            ok: false,
            message: "Harness is read-only.",
          },
  };
}

function Section({
  title,
  testId,
  children,
}: {
  title: string;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-xl border border-slate-200/80 bg-white px-5 py-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:px-6 sm:py-6"
      data-phase10-section={testId}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
        {title}
      </p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function PublicReviewFixture({
  status,
  authorized,
}: {
  status: "proposed" | "authorized";
  authorized?: boolean;
}) {
  const current = ORIGINAL_CENTS + AUTHORIZED_DELTA;
  const proposedNew = current + PROPOSED_DELTA;
  return (
    <main
      className="mx-auto max-w-lg space-y-5"
      data-scope-change-public-review={authorized ? undefined : true}
      data-scope-change-public-authorized={authorized ? true : undefined}
    >
      <header className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
          Scope change · Customer review
        </p>
        <h1 className="text-xl font-semibold text-slate-900">
          {authorized ? "Scope change authorized" : "Review scope change"}
        </h1>
        <p className="text-sm text-slate-600">
          {authorized
            ? "Original accepted agreement remains unchanged. This authorized change is additive to the contract total."
            : "Original accepted agreement remains unchanged. This request adds work and updates the contract total only after you approve."}
        </p>
      </header>

      <dl className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Original agreement</dt>
          <dd className="font-semibold text-slate-900">
            {formatUsdFromCents(ORIGINAL_CENTS)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Current contract total</dt>
          <dd className="font-semibold text-slate-900">
            {formatUsdFromCents(current)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">This change</dt>
          <dd className="font-semibold text-slate-900">
            {formatScopeChangeDeltaLabel(PROPOSED_DELTA)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Proposed new total</dt>
          <dd className="font-semibold text-slate-900">
            {formatUsdFromCents(proposedNew)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Status</dt>
          <dd className="font-semibold text-slate-900">
            {status === "authorized" ? "Authorized" : "Pending approval"}
          </dd>
        </div>
      </dl>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-900">What is changing</h2>
        <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
          <li className="flex items-start justify-between gap-3 px-3 py-3 text-sm">
            <div>
              <p className="font-semibold text-slate-900">Add · Ridge vent upgrade</p>
              <p className="text-slate-500">40 lf</p>
            </div>
            <p className="font-semibold text-slate-900">
              {formatScopeChangeDeltaLabel(PROPOSED_DELTA)}
            </p>
          </li>
        </ul>
        <p className="text-sm text-slate-600">
          Reason: Customer requested ridge vent upgrade
        </p>
      </div>

      {!authorized ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Signature is not required.</p>
          <button type="button" className={JOB_CARD_PROPOSALS_PRIMARY_BUTTON_CLASS}>
            Approve scope change
          </button>
        </div>
      ) : (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
          Authorized. New contract total {formatUsdFromCents(proposedNew)}.
        </p>
      )}
    </main>
  );
}

function FinancialReviewFixture() {
  return (
    <div
      className="space-y-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-4"
      data-scope-change-financial-review
    >
      <h2 className="text-sm font-semibold text-amber-950">
        Financial review required
      </h2>
      <p className="text-sm text-amber-900">
        This reduction cannot be authorized because it would put the contract
        total below money already collected or open payment requests. Open
        requests and capture history are unchanged.
      </p>
      <dl className="grid gap-2 text-sm text-amber-950">
        <div className="flex justify-between gap-3">
          <dt>Current contract total</dt>
          <dd className="font-semibold">{formatUsdFromCents(1_975_000)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Proposed reduction</dt>
          <dd className="font-semibold">
            {formatScopeChangeDeltaLabel(-400_000)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Proposed new total</dt>
          <dd className="font-semibold">{formatUsdFromCents(1_575_000)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Already collected</dt>
          <dd className="font-semibold">{formatUsdFromCents(1_600_000)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Open payment requests</dt>
          <dd className="font-semibold">{formatUsdFromCents(250_000)}</dd>
        </div>
      </dl>
    </div>
  );
}

export default function Phase10ScopeChangesHarnessPage() {
  const acceptedBrief = buildFieldBriefViewModel({
    customerName: "Jamie Field",
    customerPhone: "(512) 555-0199",
    addressLine1: "88 Oak Lane",
    addressCity: "Austin",
    addressState: "TX",
    addressZip: "78704",
    scheduleStartsOn: "2026-09-30",
    scheduleTimezone: "America/Chicago",
    scheduleWindowLabel: "Tue Sep 30 · All day",
    productionLeadLabel: "Alex Rivera",
    approvedScopeLabel: "Full tear-off · Architectural shingles",
    measurementSummary: "24.0 SQ",
    accessNotes: "Gate code 4411",
    authorizedChangeSummaries: ["Additional decking"],
    pendingProposedSummaries: [],
    tasks: [],
    photoCount: 1,
  });

  const pendingBrief = buildFieldBriefViewModel({
    customerName: "Jamie Field",
    customerPhone: "(512) 555-0199",
    addressLine1: "88 Oak Lane",
    addressCity: "Austin",
    addressState: "TX",
    addressZip: "78704",
    scheduleStartsOn: "2026-09-30",
    scheduleTimezone: "America/Chicago",
    scheduleWindowLabel: "Tue Sep 30 · All day",
    productionLeadLabel: "Alex Rivera",
    approvedScopeLabel: "Full tear-off · Architectural shingles",
    measurementSummary: "24.0 SQ",
    accessNotes: "Gate code 4411",
    authorizedChangeSummaries: ["Additional decking"],
    pendingProposedSummaries: ["Ridge vent upgrade"],
    tasks: [],
    photoCount: 1,
  });

  const acceptedPanel = fixtureState(
    [authorizedRow],
    ORIGINAL_CENTS + AUTHORIZED_DELTA
  );
  const proposedPanel = fixtureState(
    [authorizedRow, proposedRow],
    ORIGINAL_CENTS + AUTHORIZED_DELTA
  );
  const draftPanel = fixtureState(
    [authorizedRow, draftRow],
    ORIGINAL_CENTS + AUTHORIZED_DELTA
  );

  return (
    <main
      className="mx-auto min-h-screen max-w-3xl space-y-8 bg-slate-50/60 px-4 py-8 sm:px-6"
      data-testid="phase10-scope-changes-harness"
    >
      <header className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
          Phase 10 · Astra G9
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">
          Approved scope changes — visual fixtures
        </h1>
        <p className="text-sm text-slate-600">
          Static harness for desktop and 390 proof. No Auth. No DB writes.
        </p>
      </header>

      <Section title="1 · Accepted proposal · Propose scope change" testId="propose-cta">
        <JobCardScopeChangesPanel
          canAuthor
          canProposeNew
          scopeChanges={acceptedPanel}
        />
      </Section>

      <Section title="2 · Draft scope change — resume persisted lines" testId="draft-history">
        <JobCardScopeChangesPanel
          canAuthor
          canProposeNew
          scopeChanges={draftPanel}
        />
      </Section>

      <Section title="3 · Proposed change status / history" testId="proposed-history">
        <JobCardScopeChangesPanel
          canAuthor
          canProposeNew={false}
          scopeChanges={proposedPanel}
        />
      </Section>

      <Section title="3a · Negative authorized basis (signed)" testId="negative-basis">
        <JobCardScopeChangesPanel
          canAuthor
          canProposeNew
          scopeChanges={fixtureState(
            [negativeAuthorizedRow],
            ORIGINAL_CENTS + NEGATIVE_AUTHORIZED_DELTA
          )}
        />
      </Section>

      <Section title="3b · Contract total unavailable" testId="unavailable-basis">
        <JobCardScopeChangesPanel
          canAuthor
          canProposeNew
          scopeChanges={fixtureState([authorizedRow], null, { loadStatus: "error" })}
        />
      </Section>

      <Section title="3c · Review link recovery (success)" testId="link-recovery">
        <JobCardScopeChangesPanel
          canAuthor
          canProposeNew={false}
          scopeChanges={fixtureState(
            [authorizedRow, proposedRow],
            ORIGINAL_CENTS + AUTHORIZED_DELTA,
            { replayUrl: "http://localhost:3000/scope-changes/harness-token" }
          )}
        />
      </Section>

      <Section title="3d · Proposed but link not minted (partial)" testId="link-missing">
        <JobCardScopeChangesPanel
          canAuthor
          canProposeNew={false}
          scopeChanges={fixtureState(
            [authorizedRow, proposedRow],
            ORIGINAL_CENTS + AUTHORIZED_DELTA,
            { replayUrl: null }
          )}
        />
      </Section>

      <Section title="4 · Customer review" testId="customer-review">
        <PublicReviewFixture status="proposed" />
      </Section>

      <Section title="5 · Authorized change (customer)" testId="customer-authorized">
        <PublicReviewFixture status="authorized" authorized />
      </Section>

      <Section title="6 · Field brief · authorized change" testId="field-authorized">
        <JobCardFieldBrief model={acceptedBrief} quietPhotoHint />
      </Section>

      <Section title="7 · Field brief · pending warning" testId="field-pending">
        <JobCardFieldBrief model={pendingBrief} quietPhotoHint />
      </Section>

      <Section title="8 · Reduction financial review" testId="financial-review">
        <FinancialReviewFixture />
      </Section>
    </main>
  );
}
