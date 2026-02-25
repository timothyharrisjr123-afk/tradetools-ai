import { Suspense } from "react";
import SavedClient from "./SavedClient";

export const dynamic = "force-dynamic";

export default function SavedPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-white/70">
          Loading saved estimates…
        </div>
      }
    >
      <SavedClient />
    </Suspense>
  );
}
