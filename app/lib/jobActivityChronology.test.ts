/**
 * Contractor Activity chronology — visibility, coalescing, wording, order.
 *
 * Run:
 * npx tsx --test app/lib/jobActivityChronology.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  classifyJobActivityEvent,
  composeJobActivityChronology,
  composeJobActivityItems,
  groupJobActivityChronology,
  JOB_ACTIVITY_VISIBILITY,
  resolveActivityActorDisplay,
} from "./jobActivityChronology";
import type { JobActivityEvent } from "./jobLifecycleTypes";

const ROOT = process.cwd();
const COMPANY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const JOB_ID = "11111111-1111-4111-8111-111111111111";
const TZ = "America/Chicago";

function event(
  overrides: Partial<JobActivityEvent> &
    Pick<JobActivityEvent, "id" | "event_type" | "occurred_at">
): JobActivityEvent {
  return {
    company_id: COMPANY_ID,
    job_id: JOB_ID,
    actor_user_id: null,
    payload_json: {},
    ...overrides,
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

const SCHEDULE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccc01";

describe("visibility classification", () => {
  test("meaningful lifecycle events are contractor-visible", () => {
    assert.equal(
      classifyJobActivityEvent(
        event({
          id: "a",
          event_type: "job_work_started",
          occurred_at: "2026-08-28T13:00:00.000Z",
        })
      ),
      JOB_ACTIVITY_VISIBILITY.CONTRACTOR_VISIBLE
    );
    assert.equal(
      classifyJobActivityEvent(
        event({
          id: "b",
          event_type: "job_work_completed",
          occurred_at: "2026-08-28T18:00:00.000Z",
        })
      ),
      JOB_ACTIVITY_VISIBILITY.CONTRACTOR_VISIBLE
    );
  });

  test("companion stage changes are system-internal", () => {
    for (const reason of [
      "work_started",
      "work_completed",
      "scheduled_job",
      "unscheduled_job",
      "first_proposal_created",
    ] as const) {
      assert.equal(
        classifyJobActivityEvent(
          event({
            id: reason,
            event_type: "stage_changed",
            occurred_at: "2026-08-28T13:00:00.000Z",
            payload_json: { reason },
          })
        ),
        JOB_ACTIVITY_VISIBILITY.SYSTEM_INTERNAL
      );
    }
  });

  test("contractor approval is visible; generic stage noise is not", () => {
    assert.equal(
      classifyJobActivityEvent(
        event({
          id: "ok",
          event_type: "stage_changed",
          occurred_at: "2026-08-24T14:00:00.000Z",
          payload_json: {
            from_stage: "proposal",
            to_stage: "approved",
            reason: "contractor_approved",
          },
        })
      ),
      JOB_ACTIVITY_VISIBILITY.CONTRACTOR_VISIBLE
    );
    assert.equal(
      classifyJobActivityEvent(
        event({
          id: "noise",
          event_type: "stage_changed",
          occurred_at: "2026-08-24T14:00:00.000Z",
          payload_json: {
            from_stage: "intake",
            to_stage: "proposal",
            reason: "board_move",
          },
        })
      ),
      JOB_ACTIVITY_VISIBILITY.SYSTEM_INTERNAL
    );
  });
});

describe("filtering", () => {
  test("hides payments even when payment items are supplied", () => {
    const items = composeJobActivityItems({
      jobCreatedAt: "2026-08-20T12:00:00.000Z",
      paymentItems: [
        {
          label: "Payment requested",
          note: "Deposit · $5,000.00",
          identity: "payment_request:x",
          occurredAt: "2026-08-24T12:00:00.000Z",
        },
        {
          label: "Payment received",
          note: "$5,000.00",
          identity: "payment_transaction:y",
          occurredAt: "2026-08-24T13:00:00.000Z",
        },
      ],
    });
    assert.equal(items.some((row) => /payment|deposit|refund|\$/i.test(row.label)), false);
    assert.equal(items.some((row) => /payment|deposit|refund|\$/i.test(row.note)), false);
    assert.deepEqual(
      items.map((row) => row.label),
      ["Job created"]
    );
  });

  test("hides tasks, attachments, and measurement-edit churn when injected", () => {
    const items = composeJobActivityItems({
      customerRequestItems: [
        { label: "Task created", note: "Pull permit" },
        { label: "Task completed", note: "Pull permit" },
        { label: "Photo uploaded", note: "Before.jpg" },
        { label: "File uploaded", note: "spec.pdf" },
        { label: "Measurement edited", note: "Waste 12%" },
        { label: "Measurement selected", note: "Made current" },
      ],
    });
    assert.equal(items.length, 0);
  });
});

describe("coalescing", () => {
  test("work-start + stage-change presents one Work started row", () => {
    const items = composeJobActivityItems({
      jobActivityEvents: [
        event({
          id: "55555555-5555-4555-8555-555555555555",
          event_type: "job_work_started",
          occurred_at: "2026-08-28T13:03:00.000Z",
          payload_json: {
            production_started_at: "2026-08-28T13:03:00.000Z",
            planned_window: WINDOW_AUG31,
          },
        }),
        event({
          id: "66666666-6666-4666-8666-666666666666",
          event_type: "stage_changed",
          occurred_at: "2026-08-28T13:03:00.000Z",
          payload_json: {
            from_stage: "scheduled",
            to_stage: "production",
            reason: "work_started",
          },
        }),
      ],
    });
    assert.deepEqual(
      items.map((row) => row.label),
      ["Work started"]
    );
    assert.equal(items.some((row) => /Moved to|Production|stage/i.test(row.label)), false);
  });

  test("work-complete + stage-change presents one Work completed row", () => {
    const items = composeJobActivityItems({
      jobActivityEvents: [
        event({
          id: "77777777-7777-4777-8777-777777777777",
          event_type: "job_work_completed",
          occurred_at: "2026-08-28T15:42:00.000Z",
          payload_json: { completed_at: "2026-08-28T15:42:00.000Z" },
        }),
        event({
          id: "88888888-8888-4888-8888-888888888888",
          event_type: "stage_changed",
          occurred_at: "2026-08-28T15:42:00.000Z",
          payload_json: {
            from_stage: "production",
            to_stage: "complete",
            reason: "work_completed",
          },
        }),
      ],
    });
    assert.deepEqual(
      items.map((row) => row.label),
      ["Work completed"]
    );
  });

  test("schedule + companion stage presents one Work scheduled row", () => {
    const items = composeJobActivityItems({
      jobActivityEvents: [
        event({
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
          event_type: "job_scheduled",
          occurred_at: "2026-08-24T12:00:00.000Z",
          payload_json: { window: WINDOW_AUG31 },
        }),
        event({
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
          event_type: "stage_changed",
          occurred_at: "2026-08-24T12:00:00.000Z",
          payload_json: {
            from_stage: "approved",
            to_stage: "scheduled",
            reason: "scheduled_job",
          },
        }),
      ],
    });
    assert.deepEqual(
      items.map((row) => row.label),
      ["Work scheduled"]
    );
    assert.match(items[0]?.note ?? "", /Aug 31/);
  });

  test("unrelated nearby events do not collapse", () => {
    const items = composeJobActivityItems({
      jobActivityEvents: [
        event({
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
          event_type: "job_work_started",
          occurred_at: "2026-08-28T13:03:00.000Z",
        }),
        event({
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4",
          event_type: "disposition_changed",
          occurred_at: "2026-08-28T13:03:00.000Z",
          payload_json: {
            to_status: "on_hold",
            reason: "Waiting on insurance",
          },
        }),
      ],
    });
    assert.deepEqual(
      items.map((row) => row.label).sort(),
      ["Job put on hold", "Work started"]
    );
  });
});

describe("schedule wording", () => {
  test("first schedule, reschedule, and unschedule use contractor language", () => {
    const items = composeJobActivityItems({
      jobActivityEvents: [
        event({
          id: "s1",
          event_type: "job_scheduled",
          occurred_at: "2026-08-20T12:00:00.000Z",
          payload_json: { window: WINDOW_AUG31 },
        }),
        event({
          id: "s2",
          event_type: "job_rescheduled",
          occurred_at: "2026-08-22T12:00:00.000Z",
          payload_json: {
            previous_window: WINDOW_AUG31,
            window: WINDOW_SEP3,
          },
        }),
        event({
          id: "s3",
          event_type: "job_unscheduled",
          occurred_at: "2026-08-23T12:00:00.000Z",
          payload_json: { previous_window: WINDOW_SEP3 },
        }),
      ],
    });
    assert.deepEqual(
      items.map((row) => row.label),
      ["Work schedule removed", "Work rescheduled", "Work scheduled"]
    );
    assert.match(items[1]?.note ?? "", /Sep 3/);
    assert.doesNotMatch(items[1]?.note ?? "", /→/);
    assert.equal(items[0]?.note, "");
  });

  test("repeated internal schedule writes collapse to final effective reschedule", () => {
    const items = composeJobActivityItems({
      jobActivityEvents: [
        event({
          id: "r1",
          event_type: "job_rescheduled",
          occurred_at: "2026-08-22T12:00:00.000Z",
          payload_json: {
            schedule_id: SCHEDULE_ID,
            previous_window: WINDOW_AUG31,
            window: WINDOW_SEP3,
          },
        }),
        event({
          id: "r1-stage",
          event_type: "stage_changed",
          occurred_at: "2026-08-22T12:00:00.000Z",
          payload_json: { reason: "scheduled_job", to_stage: "scheduled" },
        }),
        event({
          id: "r2",
          event_type: "job_rescheduled",
          occurred_at: "2026-08-22T12:05:00.000Z",
          payload_json: {
            schedule_id: SCHEDULE_ID,
            previous_window: WINDOW_SEP3,
            window: WINDOW_AUG31,
          },
        }),
        event({
          id: "r2-stage",
          event_type: "stage_changed",
          occurred_at: "2026-08-22T12:05:00.000Z",
          payload_json: { reason: "scheduled_job", to_stage: "scheduled" },
        }),
      ],
    });
    assert.deepEqual(items.map((row) => row.label), ["Work rescheduled"]);
    assert.match(items[0]?.note ?? "", /Aug 31/);
  });

  test("ping-pong schedule chain collapses to one visible reschedule", () => {
    const items = composeJobActivityItems({
      jobCreatedAt: "2026-08-16T14:25:14.000Z",
      jobActivityEvents: [
        event({
          id: "sched",
          event_type: "job_scheduled",
          occurred_at: "2026-08-20T16:00:00.000Z",
          payload_json: {
            schedule_id: SCHEDULE_ID,
            window: WINDOW_AUG31,
          },
        }),
        event({
          id: "r1",
          event_type: "job_rescheduled",
          occurred_at: "2026-08-21T12:00:00.000Z",
          payload_json: {
            schedule_id: SCHEDULE_ID,
            previous_window: WINDOW_AUG31,
            window: WINDOW_SEP3,
          },
        }),
        event({
          id: "r2",
          event_type: "job_rescheduled",
          occurred_at: "2026-08-21T12:02:00.000Z",
          payload_json: {
            schedule_id: SCHEDULE_ID,
            previous_window: WINDOW_SEP3,
            window: WINDOW_AUG31,
          },
        }),
        event({
          id: "r3",
          event_type: "job_rescheduled",
          occurred_at: "2026-08-21T12:04:00.000Z",
          payload_json: {
            schedule_id: SCHEDULE_ID,
            previous_window: WINDOW_AUG31,
            window: WINDOW_SEP3,
          },
        }),
      ],
    });
    assert.deepEqual(
      items.map((row) => row.label),
      ["Work rescheduled", "Work scheduled", "Job created"]
    );
    assert.match(items[0]?.note ?? "", /Sep 3/);
    assert.match(items[1]?.note ?? "", /Aug 31/);
    assert.equal(
      items.filter((row) => row.label === "Work rescheduled").length,
      1
    );
  });

  test("two genuinely separate reschedules remain visible", () => {
    const items = composeJobActivityItems({
      jobActivityEvents: [
        event({
          id: "sched",
          event_type: "job_scheduled",
          occurred_at: "2026-08-20T16:00:00.000Z",
          payload_json: {
            schedule_id: SCHEDULE_ID,
            window: WINDOW_AUG31,
          },
        }),
        event({
          id: "mon",
          event_type: "job_rescheduled",
          occurred_at: "2026-08-21T12:00:00.000Z",
          payload_json: {
            schedule_id: SCHEDULE_ID,
            previous_window: WINDOW_AUG31,
            window: WINDOW_SEP3,
          },
        }),
        event({
          id: "thu",
          event_type: "job_rescheduled",
          occurred_at: "2026-08-25T12:00:00.000Z",
          payload_json: {
            schedule_id: SCHEDULE_ID,
            previous_window: WINDOW_SEP3,
            window: WINDOW_AUG31,
          },
        }),
      ],
    });
    assert.deepEqual(
      items.map((row) => row.label),
      ["Work rescheduled", "Work rescheduled", "Work scheduled"]
    );
    assert.match(items[0]?.note ?? "", /Aug 31/);
    assert.match(items[1]?.note ?? "", /Sep 3/);
  });

  test("non-undo reschedule chain is not collapsed by timestamps alone", () => {
    const items = composeJobActivityItems({
      jobActivityEvents: [
        event({
          id: "sched",
          event_type: "job_scheduled",
          occurred_at: "2026-08-20T16:00:00.000Z",
          payload_json: {
            schedule_id: SCHEDULE_ID,
            window: WINDOW_AUG31,
          },
        }),
        event({
          id: "first",
          event_type: "job_rescheduled",
          occurred_at: "2026-08-21T12:00:00.000Z",
          payload_json: {
            schedule_id: SCHEDULE_ID,
            previous_window: WINDOW_AUG31,
            window: WINDOW_SEP3,
          },
        }),
        event({
          id: "second",
          event_type: "job_rescheduled",
          occurred_at: "2026-08-21T12:01:00.000Z",
          payload_json: {
            schedule_id: SCHEDULE_ID,
            previous_window: WINDOW_SEP3,
            window: {
              all_day: true,
              starts_on: "2026-09-10",
              ends_on: "2026-09-11",
              timezone: TZ,
            },
          },
        }),
      ],
    });
    assert.deepEqual(
      items.map((row) => row.label),
      ["Work rescheduled", "Work rescheduled", "Work scheduled"]
    );
  });
});

describe("wording, actors, dates, order", () => {
  test("no raw enum, UUID, or technical reason codes", () => {
    const items = composeJobActivityItems({
      jobCreatedAt: "2026-08-16T14:25:14.000Z",
      jobActivityEvents: [
        event({
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5",
          event_type: "stage_changed",
          occurred_at: "2026-08-16T14:32:46.000Z",
          actor_user_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          payload_json: {
            from_stage: "proposal",
            to_stage: "approved",
            reason: "contractor_approved",
          },
        }),
      ],
    });
    const blob = items.map((row) => `${row.label} ${row.note} ${row.when}`).join("\n");
    assert.equal(items.some((row) => row.label === "Work approved"), true);
    assert.doesNotMatch(blob, /contractor_approved|stage_changed|from_stage/);
    assert.doesNotMatch(blob, /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}/i);
    assert.doesNotMatch(blob, /T\d{2}:\d{2}:\d{2}/);
    assert.doesNotMatch(blob, /Unknown user/i);
  });

  test("newest first with deterministic equal-time ordering", () => {
    const items = composeJobActivityItems({
      jobActivityEvents: [
        event({
          id: "id-a",
          event_type: "job_work_started",
          occurred_at: "2026-08-28T13:00:00.000Z",
        }),
        event({
          id: "id-b",
          event_type: "job_work_completed",
          occurred_at: "2026-08-28T13:00:00.000Z",
        }),
        event({
          id: "id-c",
          event_type: "job_scheduled",
          occurred_at: "2026-08-27T13:00:00.000Z",
          payload_json: { window: WINDOW_AUG31 },
        }),
      ],
    });
    assert.deepEqual(
      items.map((row) => row.label),
      ["Work completed", "Work started", "Work scheduled"]
    );
  });

  test("trustworthy actor displayed; UUID and unknown omitted", () => {
    assert.equal(
      resolveActivityActorDisplay(
        { actor_name: "Mike Anderson" },
        "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
      ),
      "Mike Anderson"
    );
    assert.equal(
      resolveActivityActorDisplay(
        {},
        "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
      ),
      null
    );
    assert.equal(
      resolveActivityActorDisplay({ actor_name: "Unknown user" }, null),
      null
    );
    const items = composeJobActivityItems({
      jobActivityEvents: [
        event({
          id: "act",
          event_type: "job_work_started",
          occurred_at: "2026-08-28T13:03:00.000Z",
          actor_user_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          payload_json: { actor_name: "Mike Anderson" },
        }),
      ],
    });
    assert.equal(items[0]?.actor, "Mike Anderson");
  });

  test("human date and time labels, grouped newest-first", () => {
    const rows = composeJobActivityChronology({
      jobActivityEvents: [
        event({
          id: "c1",
          event_type: "job_work_completed",
          occurred_at: "2026-08-28T15:42:00.000Z",
          payload_json: {
            completed_at: "2026-08-28T15:42:00.000Z",
            planned_window: { timezone: TZ },
          },
        }),
        event({
          id: "s1",
          event_type: "job_work_started",
          occurred_at: "2026-08-28T13:03:00.000Z",
          payload_json: {
            production_started_at: "2026-08-28T13:03:00.000Z",
            planned_window: { timezone: TZ },
          },
        }),
      ],
    });
    assert.match(rows[0]?.dayLabel ?? "", /Aug 28/);
    assert.match(rows[0]?.timeLabel ?? "", /\d{1,2}:\d{2} [AP]M/);
    assert.doesNotMatch(rows[0]?.timeLabel ?? "", /CDT|CST|GMT|UTC/);
    const groups = groupJobActivityChronology(rows);
    assert.equal(groups.length, 1);
    assert.equal(groups[0]?.rows[0]?.title, "Work completed");
  });

  test("derived Job created is labeled derived and not a fake UUID event", () => {
    const rows = composeJobActivityChronology({
      jobCreatedAt: "2026-08-16T14:25:14.000Z",
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.title, "Job created");
    assert.equal(rows[0]?.source, "derived");
    assert.equal(rows[0]?.id, "derived:job_created");
  });

  test("proposal sent and accepted stay; draft create does not", () => {
    const items = composeJobActivityItems({
      jobCreatedAt: "2026-08-16T14:25:14.000Z",
      proposals: [
        {
          id: JOB_ID,
          job_id: JOB_ID,
          status: "sent",
          title: "Roof",
          proposal_number: null,
          template_id: JOB_ID,
          selected_option_id: null,
          latest_sent_version_id: JOB_ID,
          signed_version_id: null,
          created_at: "2026-08-16T14:26:00.000Z",
          updated_at: "2026-08-16T14:30:00.000Z",
          draft_content_changed_at: "2026-08-16T14:30:00.000Z",
        },
      ],
      sentFactsByProposalId: {
        [JOB_ID]: {
          latestSentFrozenAt: "2026-08-16T14:30:00.000Z",
          history: [
            {
              versionId: JOB_ID,
              sentAtLabel: "Aug 16",
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
          acceptedAt: "2026-08-16T14:31:20.000Z",
        },
      ],
    });
    assert.deepEqual(
      items.map((row) => row.label),
      ["Proposal accepted", "Proposal sent", "Job created"]
    );
    assert.equal(items[0]?.note, "Premium package");
    assert.equal(items[1]?.note, "Premium");
  });
});

describe("authority", () => {
  test("Activity chronology and panel perform no writes", () => {
    const files = [
      "app/lib/jobActivityChronology.ts",
      "app/lib/jobActivityComposer.ts",
      "app/tools/roofing/jobCard/JobCardActivityPanel.tsx",
      "app/tools/roofing/jobCard/JobCardActivityPanelWithCustomerRequests.tsx",
    ].map((rel) => readFileSync(join(ROOT, rel), "utf8"));
    for (const source of files) {
      assert.doesNotMatch(source, /record_job_activity_v1/);
      assert.doesNotMatch(source, /start_job_work_v1|complete_job_work_v1/);
      assert.doesNotMatch(source, /change_job_disposition_v1/);
      assert.doesNotMatch(source, /method:\s*"POST"/);
      assert.doesNotMatch(source, /Start work|Complete job|Collect payment/);
    }
    const panel = files[2] ?? "";
    assert.match(panel, /No activity yet/);
    assert.doesNotMatch(panel, /View audit log|Fix|Take action/);
  });
});
