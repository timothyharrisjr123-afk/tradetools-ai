import { notFound } from "next/navigation";

/** Dev-only Phase 10 / Astra G9 scope-change visual fixtures. */
export default async function Phase10ScopeChangesHarnessPage() {
  // Inline NODE_ENV check keeps the harness import out of production bundles (webpack dead-branch elimination).
  if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
    const { default: Phase10ScopeChangesHarness } = await import("./Phase10ScopeChangesHarness");
    return <Phase10ScopeChangesHarness />;
  }
  notFound();
}
