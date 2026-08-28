"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { JobTaskListItem } from "@/app/lib/jobTaskTypes";
import JobCardTasksWorkspace from "@/app/tools/roofing/jobCard/JobCardTasksWorkspace";
import JobCardTabs from "@/app/tools/roofing/jobCard/JobCardTabs";
import type { JobCardTabId } from "@/app/tools/roofing/jobCard/jobCardTypes";

const TODAY = "2026-08-28";
const JOB_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function task(overrides: Partial<JobTaskListItem> = {}): JobTaskListItem {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    jobId: JOB_ID,
    title: "Pull permit",
    notes: null,
    status: "open",
    dueOn: "2026-08-31",
    createdAt: "2026-08-20T12:00:00.000Z",
    createdBy: "user-1",
    completedAt: null,
    completedBy: null,
    updatedAt: "2026-08-20T12:00:00.000Z",
    ...overrides,
  };
}

const OPEN: JobTaskListItem[] = [
  task({
    id: "t-overdue",
    title: "Pull permit",
    dueOn: "2026-08-27",
    createdAt: "2026-08-18T12:00:00.000Z",
  }),
  task({
    id: "t-ridge",
    title: "Pick up ridge vent",
    dueOn: null,
    createdAt: "2026-08-20T12:00:00.000Z",
  }),
  task({
    id: "t-call",
    title: "Call homeowner",
    dueOn: "2026-09-02",
    createdAt: "2026-08-21T12:00:00.000Z",
  }),
];

const COMPLETED: JobTaskListItem[] = [
  task({
    id: "t-warranty",
    title: "Send warranty",
    status: "complete",
    dueOn: null,
    completedAt: "2026-08-22T15:00:00.000Z",
    completedBy: "user-1",
  }),
  task({
    id: "t-sweep",
    title: "Magnet sweep",
    status: "complete",
    dueOn: "2026-08-20",
    completedAt: "2026-08-21T15:00:00.000Z",
    completedBy: "user-1",
  }),
];

type SceneId =
  | "empty"
  | "add"
  | "open"
  | "overdue"
  | "completed-collapsed"
  | "completed-expanded"
  | "edit"
  | "reopen";

const SCENES: Record<
  SceneId,
  {
    tasks: JobTaskListItem[];
    initialAdding?: boolean;
    initialCompletedOpen?: boolean;
    initialEditingId?: string | null;
  }
> = {
  empty: { tasks: [] },
  add: { tasks: [], initialAdding: true },
  open: { tasks: OPEN },
  overdue: { tasks: OPEN },
  "completed-collapsed": { tasks: [...OPEN, ...COMPLETED] },
  "completed-expanded": {
    tasks: [...OPEN, ...COMPLETED],
    initialCompletedOpen: true,
  },
  edit: {
    tasks: OPEN,
    initialEditingId: "t-ridge",
  },
  reopen: {
    tasks: [...OPEN, ...COMPLETED],
    initialCompletedOpen: true,
  },
};

export default function TasksV1ReviewHarness() {
  const search = useSearchParams();
  const show = (search.get("show") ?? "open") as SceneId;
  const scene = SCENES[show] ?? SCENES.open;
  const [tab] = useState<JobCardTabId>("tasks");

  return (
    <div className="bg-white" data-tasks-v1-review={show}>
      <JobCardTabs activeTab={tab} onTabChange={() => undefined} />
      <div className="p-5 sm:p-6">
        <JobCardTasksWorkspace
          activeTab={tab}
          tasks={scene.tasks}
          today={TODAY}
          initialAdding={scene.initialAdding}
          initialCompletedOpen={scene.initialCompletedOpen}
          initialEditingId={scene.initialEditingId}
          onCreate={() => true}
          onUpdate={() => true}
          onComplete={() => undefined}
          onReopen={() => undefined}
          onRemove={() => true}
        />
      </div>
    </div>
  );
}
