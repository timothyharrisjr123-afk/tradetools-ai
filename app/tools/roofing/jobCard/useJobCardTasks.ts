"use client";

import { useCallback, useEffect, useState } from "react";
import type { JobTaskListItem } from "@/app/lib/jobTaskTypes";

type UseJobCardTasksArgs = {
  jobId: string | null;
  enabled: boolean;
};

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

export function useJobCardTasks({ jobId, enabled }: UseJobCardTasksArgs) {
  const [tasks, setTasks] = useState<JobTaskListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!jobId || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/tasks`, {
        cache: "no-store",
      });
      const body = await readJson(res);
      if (!res.ok || body.ok !== true) {
        setError("Tasks could not be loaded.");
        return;
      }
      setTasks((body.tasks as JobTaskListItem[]) ?? []);
    } catch {
      setError("Tasks could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [jobId, enabled]);

  useEffect(() => {
    if (!enabled || !jobId) {
      setTasks([]);
      return;
    }
    void refresh();
  }, [enabled, jobId, refresh]);

  const create = useCallback(
    async (input: { title: string; notes: string | null; dueOn: string | null }) => {
      if (!jobId) return false;
      setError(null);
      try {
        const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const body = await readJson(res);
        if (!res.ok || body.ok !== true || !body.task) {
          setError(
            typeof body.message === "string" ? body.message : "Task could not be added."
          );
          return false;
        }
        setTasks((prev) => [...prev, body.task as JobTaskListItem]);
        return true;
      } catch {
        setError("Task could not be added.");
        return false;
      }
    },
    [jobId]
  );

  const patch = useCallback(
    async (
      taskId: string,
      payload: Record<string, unknown>
    ): Promise<JobTaskListItem | null> => {
      if (!jobId) return null;
      setError(null);
      try {
        const res = await fetch(
          `/api/jobs/${encodeURIComponent(jobId)}/tasks/${encodeURIComponent(taskId)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
        const body = await readJson(res);
        if (!res.ok || body.ok !== true || !body.task) {
          setError(
            typeof body.message === "string" ? body.message : "Task could not be updated."
          );
          return null;
        }
        const task = body.task as JobTaskListItem;
        setTasks((prev) => prev.map((row) => (row.id === task.id ? task : row)));
        return task;
      } catch {
        setError("Task could not be updated.");
        return null;
      }
    },
    [jobId]
  );

  const updateContent = useCallback(
    async (
      taskId: string,
      input: { title: string; notes: string | null; dueOn: string | null }
    ) => {
      const task = await patch(taskId, input);
      return Boolean(task);
    },
    [patch]
  );

  const complete = useCallback(
    async (taskId: string) => {
      await patch(taskId, { status: "complete" });
    },
    [patch]
  );

  const reopen = useCallback(
    async (taskId: string) => {
      await patch(taskId, { status: "open" });
    },
    [patch]
  );

  const remove = useCallback(
    async (taskId: string) => {
      if (!jobId) return false;
      setError(null);
      try {
        const res = await fetch(
          `/api/jobs/${encodeURIComponent(jobId)}/tasks/${encodeURIComponent(taskId)}`,
          { method: "DELETE" }
        );
        const body = await readJson(res);
        if (!res.ok || body.ok !== true) {
          setError("Task could not be removed.");
          return false;
        }
        setTasks((prev) => prev.filter((row) => row.id !== taskId));
        return true;
      } catch {
        setError("Task could not be removed.");
        return false;
      }
    },
    [jobId]
  );

  return {
    tasks,
    loading,
    error,
    create,
    updateContent,
    complete,
    reopen,
    remove,
  };
}
