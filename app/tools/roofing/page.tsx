import { Suspense } from "react";
import RoofingClient from "./RoofingClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-white/70">Loading…</div>}>
      <RoofingClient />
    </Suspense>
  );
}
