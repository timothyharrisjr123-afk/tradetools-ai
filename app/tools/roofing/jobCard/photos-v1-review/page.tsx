import { Suspense } from "react";
import FieldDiveAppShell from "@/app/tools/roofing/FieldDiveAppShell";
import PhotosV1ReviewHarness from "./PhotosV1ReviewHarness";

/**
 * Visual-only Photos / Attachments V1 fixture route.
 * Not the live Job Card. Developer review only.
 */
export default function PhotosV1ReviewPage() {
  return (
    <FieldDiveAppShell activeNav="jobs">
      <Suspense fallback={<div className="p-6 text-slate-500">Loading photos review…</div>}>
        <PhotosV1ReviewHarness />
      </Suspense>
    </FieldDiveAppShell>
  );
}
