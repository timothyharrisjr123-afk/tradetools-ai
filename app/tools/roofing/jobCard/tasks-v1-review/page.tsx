import { Suspense } from "react";
import FieldDiveAppShell from "@/app/tools/roofing/FieldDiveAppShell";
import TasksV1ReviewHarness from "./TasksV1ReviewHarness";

/**
 * Visual-only Tasks V1 fixture route.
 * Not the live Job Card. Developer review only.
 */
export default function TasksV1ReviewPage() {
  return (
    <FieldDiveAppShell activeNav="jobs">
      <Suspense fallback={<div className="p-6 text-slate-500">Loading tasks review…</div>}>
        <TasksV1ReviewHarness />
      </Suspense>
    </FieldDiveAppShell>
  );
}
