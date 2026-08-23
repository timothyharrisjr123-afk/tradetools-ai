"use client";

import { useSearchParams } from "next/navigation";
import type { JobSchedule } from "@/app/lib/jobScheduleTypes";
import JobCardScheduleSection from "./JobCardScheduleSection";
import JobCardActivityPanel from "./JobCardActivityPanel";
import JobsBoardCard from "../saved/components/JobsBoardCard";
import type { JobsBoardCardModel } from "../saved/jobsBoardUtils";

const PLANNED: JobSchedule = {
  id: "22222222-2222-4222-8222-222222222222",
  company_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  job_id: "11111111-1111-4111-8111-111111111111",
  kind: "work",
  status: "scheduled",
  timezone: "America/Chicago",
  all_day: true,
  starts_on: "2026-08-18",
  ends_on: "2026-08-19",
  start_local_time: null,
  end_local_time: null,
  range_start_at: "2026-08-18T05:00:00.000Z",
  range_end_at: "2026-08-20T05:00:00.000Z",
  notes: null,
  created_by_user_id: null,
  updated_by_user_id: null,
  created_at: "2026-08-16T15:00:00.000Z",
  updated_at: "2026-08-16T15:00:00.000Z",
  cancelled_at: null,
  row_version: 1,
};

const BASE_BOARD: JobsBoardCardModel = {
  id: PLANNED.job_id,
  customerName: "Anderson Residence",
  address: "1842 Cedar Ridge Dr, Austin, TX 78746",
  tasksLabel: "0/0",
  reportStatus: { label: "Report Complete", tone: "report_ok" },
  proposalStatus: { label: "Proposal Accepted", tone: "proposal_signed" },
  assigneeLabel: "Sam Rivera",
  lastUpdatedDisplay: "Updated today",
  timeInStage: "• Just entered",
  timeInStageTone: "neutral",
  scheduleLabel: "Aug 18–19 · All day",
};

function Shell({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
          {eyebrow}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950">{title}</h1>
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}

function ScheduledCard({ deposit = false }: { deposit?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="border-b border-slate-100 pb-4">
        <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
          Scheduled
        </span>
        <h2 className="mt-3 text-xl font-semibold text-slate-950">
          Anderson Residence
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          1842 Cedar Ridge Dr, Austin, TX
        </p>
      </div>
      <JobCardScheduleSection
        canSchedule={false}
        stage="scheduled"
        schedule={PLANNED}
        depositNotReceived={deposit}
        onStartWork={() => undefined}
        onSchedule={() => undefined}
        onReschedule={() => undefined}
        onUnschedule={() => undefined}
      />
    </div>
  );
}

function ProductionCard({ aligned = false }: { aligned?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="border-b border-slate-100 pb-4">
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
          Production
        </span>
        <h2 className="mt-3 text-xl font-semibold text-slate-950">
          Anderson Residence
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          1842 Cedar Ridge Dr, Austin, TX
        </p>
      </div>
      <JobCardScheduleSection
        canSchedule={false}
        stage="production"
        schedule={PLANNED}
        productionStartedAt={
          aligned
            ? "2026-08-18T13:12:00.000Z"
            : "2026-08-17T21:12:00.000Z"
        }
        onSchedule={() => undefined}
        onReschedule={() => undefined}
        onUnschedule={() => undefined}
      />
    </div>
  );
}

export default function JobCardR3gProductionReviewHarness() {
  const view = useSearchParams().get("view") ?? "job-scheduled";

  if (view === "job-production") {
    return (
      <Shell eyebrow="Job Card · Overview" title="Production execution truth">
        <ProductionCard aligned />
      </Shell>
    );
  }
  if (view === "job-variance") {
    return (
      <Shell eyebrow="Job Card · Overview" title="Actual start before planned work">
        <ProductionCard />
      </Shell>
    );
  }
  if (view === "board-scheduled") {
    return (
      <Shell eyebrow="Jobs Board · Scheduled" title="Ready to start">
        <div className="w-full max-w-sm">
          <JobsBoardCard
            model={{ ...BASE_BOARD, showStartWorkAction: true }}
            onOpen={() => undefined}
            onStartWork={() => undefined}
          />
        </div>
      </Shell>
    );
  }
  if (view === "board-production") {
    return (
      <Shell eyebrow="Jobs Board · Production" title="Work in progress">
        <div className="w-full max-w-sm">
          <JobsBoardCard
            model={{
              ...BASE_BOARD,
              scheduleLabel: "Planned schedule · Aug 18–19 · All day",
              productionStartedLabel: "Aug 17, 4:12 PM CDT",
            }}
            onOpen={() => undefined}
          />
        </div>
      </Shell>
    );
  }
  if (view === "calendar-production") {
    return (
      <Shell eyebrow="Calendar · Aug 18" title="Planned work remains visible">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Tuesday · Planned schedule
          </p>
          <button
            type="button"
            className="mt-3 flex w-full items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-left"
          >
            <span>
              <span className="block text-sm font-semibold text-slate-900">
                Anderson Residence
              </span>
              <span className="block text-xs text-slate-500">
                Aug 18–19 · All day
              </span>
            </span>
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
              Production
            </span>
          </button>
          <p className="mt-3 text-xs text-slate-500">
            Opens Job Card · planned dates are unchanged
          </p>
        </div>
      </Shell>
    );
  }
  if (view === "activity") {
    return (
      <Shell eyebrow="Job Card · Activity" title="One contractor action, one item">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <JobCardActivityPanel
            items={[
              {
                label: "Work started",
                note: "Aug 17, 4:12 PM CDT",
                when: "Today",
              },
              {
                label: "Job scheduled",
                note: "Aug 18–19 · All day",
                when: "Yesterday",
              },
            ]}
          />
        </div>
      </Shell>
    );
  }
  if (view === "unpaid") {
    return (
      <Shell eyebrow="Job Card · Scheduled" title="Payment is context, not a gate">
        <ScheduledCard deposit />
      </Shell>
    );
  }
  return (
    <Shell eyebrow="Job Card · Scheduled" title="Explicit Start work">
      <ScheduledCard />
    </Shell>
  );
}

