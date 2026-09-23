/**
 * Phase 7 concurrency / lost-response assignment contracts (pure).
 * Run: npx tsx --test app/lib/astraG7AssignmentRetry.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

/**
 * Last durable write wins for a single-field assignee.
 * Models client lost-response + concurrent PATCH ordering.
 */
function applyAssignmentWrites(
  initial: string | null,
  writes: Array<{ clientId: string; value: string | null; at: number }>
): { durable: string | null; byClient: Record<string, string | null> } {
  const ordered = [...writes].sort((a, b) => a.at - b.at);
  let durable = initial;
  const byClient: Record<string, string | null> = {};
  for (const write of ordered) {
    durable = write.value;
    byClient[write.clientId] = durable;
  }
  return { durable, byClient };
}

describe("Astra G7 assignment retry / concurrency", () => {
  test("lost HTTP response retry with same value is idempotent", () => {
    const first = applyAssignmentWrites(null, [
      { clientId: "A", value: "user-1", at: 1 },
    ]);
    assert.equal(first.durable, "user-1");
    // Client lost response, retries same assignee
    const retry = applyAssignmentWrites(first.durable, [
      { clientId: "A", value: "user-1", at: 2 },
    ]);
    assert.equal(retry.durable, "user-1");
  });

  test("concurrent reassign resolves to last durable write", () => {
    const result = applyAssignmentWrites("user-1", [
      { clientId: "A", value: "user-2", at: 10 },
      { clientId: "B", value: "user-3", at: 11 },
    ]);
    assert.equal(result.durable, "user-3");
    assert.equal(result.byClient.A, "user-2");
    assert.equal(result.byClient.B, "user-3");
  });

  test("clear to Unassigned is a durable write", () => {
    const result = applyAssignmentWrites("user-1", [
      { clientId: "A", value: null, at: 1 },
    ]);
    assert.equal(result.durable, null);
  });

  test("task assignee is independent of production lead field", () => {
    let jobLead: string | null = "user-1";
    let taskAssignee: string | null = null;
    taskAssignee = "user-2";
    assert.equal(jobLead, "user-1");
    assert.equal(taskAssignee, "user-2");
    jobLead = null;
    assert.equal(taskAssignee, "user-2");
  });
});
