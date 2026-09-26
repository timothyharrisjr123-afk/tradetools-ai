import { notFound } from "next/navigation";

/** Phase 2C review harness — mirrors send-gate partial/success copy only. */
export default async function Phase2CSendRecoveryPage() {
  // Inline NODE_ENV check keeps the harness import out of production bundles (webpack dead-branch elimination).
  if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
    const { default: Phase2CSendRecoveryHarness } = await import(
      "@/app/tools/roofing/jobCard/payment-stage-2c-send-review/Phase2CSendRecoveryHarness"
    );
    return <Phase2CSendRecoveryHarness />;
  }
  notFound();
}
