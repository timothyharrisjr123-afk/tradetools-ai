"use client";

import { useSearchParams } from "next/navigation";
import { composeJobActivityItems } from "@/app/lib/jobActivityComposer";
import type { JobActivityEvent } from "@/app/lib/jobLifecycleTypes";
import JobCardActivityPanel from "@/app/tools/roofing/jobCard/JobCardActivityPanel";

const COMPANY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const JOB_ID = "11111111-1111-4111-8111-111111111111";
const TZ = "America/Chicago";
const SCHEDULE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccc01";

function evt(
  id: string,
  event_type: JobActivityEvent["event_type"],
  occurred_at: string,
  payload_json: Record<string, unknown> = {}
): JobActivityEvent {
  return {
    id,
    company_id: COMPANY_ID,
    job_id: JOB_ID,
    event_type,
    occurred_at,
    actor_user_id: null,
    payload_json,
  };
}

const WINDOW_AUG31 = {
  all_day: true,
  starts_on: "2026-08-31",
  ends_on: "2026-09-01",
  timezone: TZ,
};

const WINDOW_SEP3 = {
  all_day: true,
  starts_on: "2026-09-03",
  ends_on: "2026-09-04",
  timezone: TZ,
};

type SceneId = "typical" | "scheduled" | "production" | "noisy" | "empty";

const SCENES: Record<SceneId, ReturnType<typeof composeJobActivityItems>> = {
  typical: composeJobActivityItems({
    jobCreatedAt: "2026-08-16T14:25:14.000Z",
    jobActivityEvents: [
      evt("st-prop", "stage_changed", "2026-08-16T14:26:00.000Z", {
        from_stage: "intake",
        to_stage: "proposal",
        reason: "first_proposal_created",
      }),
      evt("st-ok", "stage_changed", "2026-08-18T15:10:00.000Z", {
        from_stage: "proposal",
        to_stage: "approved",
        reason: "contractor_approved",
      }),
      evt("sched", "job_scheduled", "2026-08-20T16:00:00.000Z", {
        window: WINDOW_AUG31,
      }),
      evt("st-sched", "stage_changed", "2026-08-20T16:00:00.000Z", {
        from_stage: "approved",
        to_stage: "scheduled",
        reason: "scheduled_job",
      }),
      evt("resched", "job_rescheduled", "2026-08-22T17:00:00.000Z", {
        previous_window: WINDOW_AUG31,
        window: WINDOW_SEP3,
      }),
      evt("start", "job_work_started", "2026-08-28T13:03:00.000Z", {
        production_started_at: "2026-08-28T13:03:00.000Z",
        planned_window: WINDOW_SEP3,
      }),
      evt("st-start", "stage_changed", "2026-08-28T13:03:00.000Z", {
        from_stage: "scheduled",
        to_stage: "production",
        reason: "work_started",
      }),
      evt("done", "job_work_completed", "2026-08-28T15:42:00.000Z", {
        completed_at: "2026-08-28T15:42:00.000Z",
        planned_window: { timezone: TZ },
      }),
      evt("st-done", "stage_changed", "2026-08-28T15:42:00.000Z", {
        from_stage: "production",
        to_stage: "complete",
        reason: "work_completed",
      }),
    ],
    proposals: [
      {
        id: JOB_ID,
        job_id: JOB_ID,
        status: "sent",
        title: "Anderson roof",
        proposal_number: null,
        template_id: JOB_ID,
        selected_option_id: null,
        latest_sent_version_id: JOB_ID,
        signed_version_id: null,
        created_at: "2026-08-16T14:26:00.000Z",
        updated_at: "2026-08-18T14:00:00.000Z",
        draft_content_changed_at: "2026-08-18T14:00:00.000Z",
      },
    ],
    sentFactsByProposalId: {
      [JOB_ID]: {
        latestSentFrozenAt: "2026-08-18T14:00:00.000Z",
        history: [
          {
            versionId: JOB_ID,
            sentAtLabel: "Aug 18",
            packageLabel: "Premium",
            deliveryStatusLabel: null,
            isCurrent: true,
          },
        ],
      },
    },
    acceptanceItems: [
      {
        label: "Proposal accepted",
        note: "Premium package",
        acceptanceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01",
        acceptedAt: "2026-08-18T14:45:00.000Z",
      },
    ],
  }),
  scheduled: composeJobActivityItems({
    jobCreatedAt: "2026-08-16T14:25:14.000Z",
    jobActivityEvents: [
      evt("sched", "job_scheduled", "2026-08-20T16:00:00.000Z", {
        window: WINDOW_AUG31,
      }),
      evt("st-sched", "stage_changed", "2026-08-20T16:00:00.000Z", {
        reason: "scheduled_job",
        to_stage: "scheduled",
      }),
      evt("resched", "job_rescheduled", "2026-08-22T17:00:00.000Z", {
        previous_window: WINDOW_AUG31,
        window: WINDOW_SEP3,
      }),
      evt("st-resched", "stage_changed", "2026-08-22T17:00:00.000Z", {
        reason: "scheduled_job",
        to_stage: "scheduled",
      }),
    ],
  }),
  production: composeJobActivityItems({
    jobCreatedAt: "2026-08-16T14:25:14.000Z",
    jobActivityEvents: [
      evt("start", "job_work_started", "2026-08-28T13:03:00.000Z", {
        production_started_at: "2026-08-28T13:03:00.000Z",
        planned_window: WINDOW_SEP3,
      }),
      evt("st-start", "stage_changed", "2026-08-28T13:03:00.000Z", {
        reason: "work_started",
        to_stage: "production",
      }),
      evt("done", "job_work_completed", "2026-08-28T15:42:00.000Z", {
        completed_at: "2026-08-28T15:42:00.000Z",
        planned_window: { timezone: TZ },
      }),
      evt("st-done", "stage_changed", "2026-08-28T15:42:00.000Z", {
        reason: "work_completed",
        to_stage: "complete",
      }),
    ],
  }),
  noisy: composeJobActivityItems({
    jobCreatedAt: "2026-08-16T14:25:14.000Z",
    jobActivityEvents: [
      evt("sched", "job_scheduled", "2026-08-20T16:00:00.000Z", {
        schedule_id: SCHEDULE_ID,
        window: WINDOW_AUG31,
      }),
      evt("st1", "stage_changed", "2026-08-20T16:00:00.000Z", {
        reason: "scheduled_job",
        to_stage: "scheduled",
      }),
      evt("r1", "job_rescheduled", "2026-08-21T12:00:00.000Z", {
        schedule_id: SCHEDULE_ID,
        previous_window: WINDOW_AUG31,
        window: WINDOW_SEP3,
      }),
      evt("st2", "stage_changed", "2026-08-21T12:00:00.000Z", {
        reason: "scheduled_job",
      }),
      evt("r2", "job_rescheduled", "2026-08-21T12:02:00.000Z", {
        schedule_id: SCHEDULE_ID,
        previous_window: WINDOW_SEP3,
        window: WINDOW_AUG31,
      }),
      evt("st3", "stage_changed", "2026-08-21T12:02:00.000Z", {
        reason: "scheduled_job",
      }),
      evt("r3", "job_rescheduled", "2026-08-21T12:04:00.000Z", {
        schedule_id: SCHEDULE_ID,
        previous_window: WINDOW_AUG31,
        window: WINDOW_SEP3,
      }),
      evt("st4", "stage_changed", "2026-08-21T12:04:00.000Z", {
        reason: "scheduled_job",
      }),
      evt("start", "job_work_started", "2026-08-28T13:03:00.000Z", {
        production_started_at: "2026-08-28T13:03:00.000Z",
      }),
      evt("st5", "stage_changed", "2026-08-28T13:03:00.000Z", {
        reason: "work_started",
        to_stage: "production",
      }),
    ],
    paymentItems: [
      {
        label: "Payment requested",
        note: "Deposit · $5,000.00",
        identity: "pay1",
        occurredAt: "2026-08-21T18:00:00.000Z",
      },
    ],
    customerRequestItems: [
      { label: "Task created", note: "Pull permit" },
      { label: "Photo uploaded", note: "Before.jpg" },
      { label: "Measurement edited", note: "Waste 12%" },
    ],
  }),
  empty: [],
};

export default function ActivityChronologyReviewHarness() {
  const search = useSearchParams();
  const show = (search.get("show") ?? "typical") as SceneId;
  const items = SCENES[show] ?? SCENES.typical;

  return (
    <div className="bg-slate-50" data-activity-chronology-review={show}>
      <div className="grid min-h-[min(640px,calc(100vh-8rem))] grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="hidden border-slate-200/80 p-6 xl:block">
          <p className="text-sm text-slate-400">Job Card · review fixture</p>
        </div>
        <div className="min-h-[420px] bg-white xl:min-h-0">
          <JobCardActivityPanel items={items} />
        </div>
      </div>
    </div>
  );
}
