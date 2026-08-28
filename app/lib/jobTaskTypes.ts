/**
 * Job tasks V1 — optional contractor memory / coordination.
 * Not workflow, Calendar, Attention, or assignment.
 */

export const JOB_TASK_STATUSES = ["open", "complete"] as const;
export type JobTaskStatus = (typeof JOB_TASK_STATUSES)[number];

export const JOB_TASK_TITLE_MAX = 120;
export const JOB_TASK_NOTES_MAX = 500;

export const JOB_TASKS_EMPTY = "No tasks yet";
export const JOB_TASKS_ADD_LABEL = "Add task";
export const JOB_TASKS_COMPLETED_LABEL = "Completed";

export type JobTaskRecord = {
  id: string;
  company_id: string;
  job_id: string;
  title: string;
  notes: string | null;
  status: JobTaskStatus;
  due_on: string | null;
  created_by: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type JobTaskListItem = {
  id: string;
  jobId: string;
  title: string;
  notes: string | null;
  status: JobTaskStatus;
  dueOn: string | null;
  createdAt: string;
  createdBy: string | null;
  completedAt: string | null;
  completedBy: string | null;
  updatedAt: string;
};
