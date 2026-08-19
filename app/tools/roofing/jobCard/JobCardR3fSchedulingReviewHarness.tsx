"use client";

import JobCardScheduleSection from "./JobCardScheduleSection";
import JobCardScheduleTimeline from "./JobCardScheduleTimeline";
import ScheduleJobModal from "./ScheduleJobModal";
import type { JobSchedule } from "@/app/lib/jobScheduleTypes";

const SAMPLE: JobSchedule = {
  id: "11111111-1111-4111-8111-111111111111",
  company_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  job_id: "11111111-1111-4111-8111-111111111111",
  kind: "work",
  status: "scheduled",
  timezone: "America/Chicago",
  all_day: true,
  starts_on: "2026-08-25",
  ends_on: "2026-08-26",
  start_local_time: null,
  end_local_time: null,
  range_start_at: "2026-08-25T05:00:00.000Z",
  range_end_at: "2026-08-27T05:00:00.000Z",
  notes: "Start after dumpster arrives",
  created_by_user_id: null,
  updated_by_user_id: null,
  created_at: "2026-08-17T00:00:00.000Z",
  updated_at: "2026-08-17T00:00:00.000Z",
  cancelled_at: null,
  row_version: 1,
};

export default function JobCardR3fSchedulingReviewHarness() {
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-xl space-y-6 rounded-xl bg-white p-6 shadow">
        <h1 className="text-lg font-semibold">R3F schedule review</h1>
        <div data-review="unscheduled">
          <JobCardScheduleSection
            canSchedule
            stage="approved"
            schedule={null}
            onSchedule={() => undefined}
            onReschedule={() => undefined}
            onUnschedule={() => undefined}
          />
        </div>
        <div data-review="scheduled">
          <JobCardScheduleSection
            canSchedule
            stage="scheduled"
            schedule={SAMPLE}
            onSchedule={() => undefined}
            onReschedule={() => undefined}
            onUnschedule={() => undefined}
          />
        </div>
        <JobCardScheduleTimeline rows={[SAMPLE]} />
        <ScheduleJobModal
          open
          mode="schedule"
          timezone="America/Chicago"
          onClose={() => undefined}
          onSubmitSchedule={() => undefined}
          onConfirmUnschedule={() => undefined}
        />
      </div>
    </div>
  );
}
