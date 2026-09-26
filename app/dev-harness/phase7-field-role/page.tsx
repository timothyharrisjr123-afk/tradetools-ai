import { notFound } from "next/navigation";

/** Dev-only preview of restricted Field-user Overview (Astra G7 field brief reference). */
export default async function Phase7FieldRoleHarnessPage() {
  // Inline NODE_ENV check keeps the harness import out of production bundles (webpack dead-branch elimination).
  if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
    const { default: Phase7FieldRoleHarness } = await import("./Phase7FieldRoleHarness");
    return <Phase7FieldRoleHarness />;
  }
  notFound();
}
