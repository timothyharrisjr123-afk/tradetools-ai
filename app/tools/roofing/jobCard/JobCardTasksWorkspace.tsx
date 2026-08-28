"use client";

import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import {
  buildJobTaskWorkspaceView,
  formatTaskDueOn,
  isTaskOverdue,
} from "@/app/lib/jobTaskModel";
import type { JobTaskListItem } from "@/app/lib/jobTaskTypes";
import {
  JOB_TASKS_ADD_LABEL,
  JOB_TASKS_COMPLETED_LABEL,
  JOB_TASKS_EMPTY,
} from "@/app/lib/jobTaskTypes";
import JobCardSectionPanel from "@/app/tools/roofing/jobCard/JobCardSectionPanel";
import type { JobCardTabId } from "@/app/tools/roofing/jobCard/jobCardTypes";

type TaskDraft = {
  title: string;
  dueOn: string;
  notes: string;
};

const EMPTY_DRAFT: TaskDraft = { title: "", dueOn: "", notes: "" };

type JobCardTasksWorkspaceProps = {
  activeTab: JobCardTabId;
  tasks: readonly JobTaskListItem[];
  loading?: boolean;
  error?: string | null;
  today?: string;
  onCreate: (input: {
    title: string;
    notes: string | null;
    dueOn: string | null;
  }) => Promise<boolean> | boolean;
  onUpdate: (
    taskId: string,
    input: { title: string; notes: string | null; dueOn: string | null }
  ) => Promise<boolean> | boolean;
  onComplete: (taskId: string) => void;
  onReopen: (taskId: string) => void;
  onRemove: (taskId: string) => Promise<boolean> | boolean;
  initialAdding?: boolean;
  initialCompletedOpen?: boolean;
  initialEditingId?: string | null;
};

function draftFromTask(task: JobTaskListItem): TaskDraft {
  return {
    title: task.title,
    dueOn: task.dueOn ?? "",
    notes: task.notes ?? "",
  };
}

function payloadFromDraft(draft: TaskDraft) {
  return {
    title: draft.title,
    notes: draft.notes.trim() ? draft.notes : null,
    dueOn: draft.dueOn.trim() ? draft.dueOn : null,
  };
}

function TaskForm({
  draft,
  onChange,
  onCancel,
  onSubmit,
  submitLabel,
  onRemove,
}: {
  draft: TaskDraft;
  onChange: (next: TaskDraft) => void;
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel: string;
  onRemove?: () => void;
}) {
  return (
    <form
      className="space-y-3"
      data-jobcard-task-form="true"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label className="block">
        <span className="text-xs font-medium text-slate-500">Task</span>
        <input
          type="text"
          value={draft.title}
          maxLength={120}
          autoFocus
          required
          placeholder="Pick up ridge vent"
          className="mt-1 min-h-[44px] w-full rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-slate-400"
          data-jobcard-task-title-input="true"
          onChange={(event) => onChange({ ...draft, title: event.target.value })}
        />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-slate-500">Due date</span>
        <input
          type="date"
          value={draft.dueOn}
          className="mt-1 min-h-[44px] w-full rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-slate-400"
          data-jobcard-task-due-input="true"
          onChange={(event) => onChange({ ...draft, dueOn: event.target.value })}
        />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-slate-500">Notes</span>
        <textarea
          value={draft.notes}
          maxLength={500}
          rows={2}
          className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
          data-jobcard-task-notes-input="true"
          onChange={(event) => onChange({ ...draft, notes: event.target.value })}
        />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {onRemove ? (
          <button
            type="button"
            className="min-h-[44px] px-1 text-sm text-slate-500 hover:text-rose-700"
            data-jobcard-task-remove="true"
            onClick={() => void onRemove()}
          >
            Remove
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="min-h-[44px] px-3 text-sm text-slate-600 hover:text-slate-900"
            data-jobcard-task-cancel="true"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex min-h-[44px] items-center rounded-md bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800"
            data-jobcard-task-submit="true"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}

export default function JobCardTasksWorkspace({
  activeTab,
  tasks,
  loading = false,
  error = null,
  today,
  onCreate,
  onUpdate,
  onComplete,
  onReopen,
  onRemove,
  initialAdding = false,
  initialCompletedOpen = false,
  initialEditingId = null,
}: JobCardTasksWorkspaceProps) {
  const view = buildJobTaskWorkspaceView({ tasks, today });
  const [adding, setAdding] = useState(initialAdding);
  const [addDraft, setAddDraft] = useState<TaskDraft>(EMPTY_DRAFT);
  const [completedOpen, setCompletedOpen] = useState(initialCompletedOpen);
  const [editingId, setEditingId] = useState<string | null>(initialEditingId);
  const [editDraft, setEditDraft] = useState<TaskDraft>(EMPTY_DRAFT);

  const startAdd = () => {
    setEditingId(null);
    setAddDraft(EMPTY_DRAFT);
    setAdding(true);
  };

  const startEdit = (task: JobTaskListItem) => {
    setAdding(false);
    setEditingId(task.id);
    setEditDraft(draftFromTask(task));
  };

  const headerAction =
    adding ? null : (
      <button
        type="button"
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800"
        data-jobcard-tasks-add="true"
        onClick={startAdd}
      >
        <Plus className="h-4 w-4" />
        {JOB_TASKS_ADD_LABEL}
      </button>
    );

  return (
    <JobCardSectionPanel
      tabId="tasks"
      activeTab={activeTab}
      title="Tasks"
      headerAction={headerAction}
    >
      <div data-jobcard-tasks-workspace="true">
        {error ? (
          <p className="mb-3 text-sm text-rose-700" data-jobcard-tasks-error="true">
            {error}
          </p>
        ) : null}

        {adding ? (
          <div className="mb-4" data-jobcard-task-add-form="true">
            <TaskForm
              draft={addDraft}
              onChange={setAddDraft}
              onCancel={() => {
                setAdding(false);
                setAddDraft(EMPTY_DRAFT);
              }}
              submitLabel={JOB_TASKS_ADD_LABEL}
              onSubmit={() => {
                void Promise.resolve(onCreate(payloadFromDraft(addDraft))).then(
                  (ok) => {
                    if (ok) {
                      setAdding(false);
                      setAddDraft(EMPTY_DRAFT);
                    }
                  }
                );
              }}
            />
          </div>
        ) : null}

        {loading && view.isEmpty && !adding ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : null}

        {view.isEmpty && !adding && !loading ? (
          <p className="text-sm text-slate-500" data-jobcard-quiet-empty="tasks">
            {JOB_TASKS_EMPTY}
          </p>
        ) : null}

        {view.openTasks.length > 0 ? (
          <ul className="divide-y divide-slate-100" data-jobcard-tasks-open="true">
            {view.openTasks.map((task) => {
              const overdue = isTaskOverdue(task.dueOn, today);
              const editing = editingId === task.id;
              return (
                <li
                  key={task.id}
                  className="py-1.5"
                  data-jobcard-task-row="open"
                  data-jobcard-task-overdue={overdue ? "true" : undefined}
                >
                  {editing ? (
                    <TaskForm
                      draft={editDraft}
                      onChange={setEditDraft}
                      onCancel={() => setEditingId(null)}
                      submitLabel="Save"
                      onRemove={() =>
                        void Promise.resolve(onRemove(task.id)).then((ok) => {
                          if (ok) setEditingId(null);
                        })
                      }
                      onSubmit={() => {
                        void Promise.resolve(
                          onUpdate(task.id, payloadFromDraft(editDraft))
                        ).then((ok) => {
                          if (ok) setEditingId(null);
                        });
                      }}
                    />
                  ) : (
                    <div className="flex items-start gap-1">
                      <button
                        type="button"
                        className="flex h-11 w-11 shrink-0 items-center justify-center text-slate-400 hover:text-slate-700"
                        aria-label={`Mark ${task.title} complete`}
                        data-jobcard-task-complete="true"
                        onClick={() => onComplete(task.id)}
                      >
                        <span className="h-[18px] w-[18px] rounded-full border-2 border-current" />
                      </button>
                      <div className="min-w-0 flex-1 py-2">
                        <p className="text-sm font-medium leading-5 text-slate-900">
                          {task.title}
                        </p>
                        {task.dueOn ? (
                          <p
                            className={
                              overdue
                                ? "mt-0.5 text-xs text-rose-700/80"
                                : "mt-0.5 text-xs text-slate-500"
                            }
                            data-jobcard-task-due="true"
                          >
                            Due {formatTaskDueOn(task.dueOn)}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="min-h-[44px] shrink-0 px-2 text-sm text-slate-500 hover:text-slate-800"
                        data-jobcard-task-edit="true"
                        onClick={() => startEdit(task)}
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}

        {view.completedCount > 0 ? (
          <div className="mt-3" data-jobcard-tasks-completed="true">
            <button
              type="button"
              className="flex min-h-[44px] w-full items-center gap-1 text-left text-sm text-slate-500 hover:text-slate-700"
              data-jobcard-tasks-completed-toggle="true"
              aria-expanded={completedOpen}
              onClick={() => setCompletedOpen((open) => !open)}
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${completedOpen ? "" : "rotate-[-90deg]"}`}
              />
              {JOB_TASKS_COMPLETED_LABEL} ({view.completedCount})
            </button>
            {completedOpen ? (
              <ul
                className="divide-y divide-slate-100"
                data-jobcard-tasks-completed-list="true"
              >
                {view.completedTasks.map((task) => {
                  const editing = editingId === task.id;
                  return (
                    <li
                      key={task.id}
                      className="py-1.5"
                      data-jobcard-task-row="complete"
                    >
                      {editing ? (
                        <TaskForm
                          draft={editDraft}
                          onChange={setEditDraft}
                          onCancel={() => setEditingId(null)}
                          submitLabel="Save"
                          onRemove={() =>
                            void Promise.resolve(onRemove(task.id)).then((ok) => {
                              if (ok) setEditingId(null);
                            })
                          }
                          onSubmit={() => {
                            void Promise.resolve(
                              onUpdate(task.id, payloadFromDraft(editDraft))
                            ).then((ok) => {
                              if (ok) setEditingId(null);
                            });
                          }}
                        />
                      ) : (
                        <div className="flex items-start gap-1">
                          <span
                            className="flex h-11 w-11 shrink-0 items-center justify-center text-slate-300"
                            aria-hidden
                          >
                            <span className="h-[18px] w-[18px] rounded-full border-2 border-current bg-slate-200" />
                          </span>
                          <div className="min-w-0 flex-1 py-2">
                            <p className="text-sm leading-5 text-slate-500 line-through">
                              {task.title}
                            </p>
                            {task.dueOn ? (
                              <p className="mt-0.5 text-xs text-slate-400">
                                Due {formatTaskDueOn(task.dueOn)}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 items-center">
                            <button
                              type="button"
                              className="min-h-[44px] px-2 text-sm text-slate-500 hover:text-slate-800"
                              data-jobcard-task-reopen="true"
                              onClick={() => onReopen(task.id)}
                            >
                              Reopen
                            </button>
                            <button
                              type="button"
                              className="min-h-[44px] px-2 text-sm text-slate-500 hover:text-slate-800"
                              data-jobcard-task-edit="true"
                              onClick={() => startEdit(task)}
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </JobCardSectionPanel>
  );
}
