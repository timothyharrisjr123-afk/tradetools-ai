/**
 * Job task validation.
 * Run: npx tsx --test app/lib/jobTaskValidation.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  JOB_TASK_NOTES_MAX,
  JOB_TASK_TITLE_MAX,
} from "@/app/lib/jobTaskTypes";
import {
  parseJobTaskDueOn,
  parseJobTaskStatus,
  validateJobTaskContent,
} from "@/app/lib/jobTaskValidation";

describe("title", () => {
  test("required after trim; blank rejected", () => {
    assert.equal(validateJobTaskContent({ title: "  " }).ok, false);
    assert.equal(validateJobTaskContent({ title: "" }).ok, false);
    const ok = validateJobTaskContent({ title: "  Pull permit  " });
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.title, "Pull permit");
  });

  test("caps length", () => {
    const tooLong = "x".repeat(JOB_TASK_TITLE_MAX + 1);
    const result = validateJobTaskContent({ title: tooLong });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "invalid_title");
    const capped = validateJobTaskContent({
      title: "x".repeat(JOB_TASK_TITLE_MAX),
    });
    assert.equal(capped.ok, true);
  });
});

describe("notes", () => {
  test("optional; empty becomes null; cap 500", () => {
    const empty = validateJobTaskContent({ title: "A", notes: "  " });
    assert.equal(empty.ok, true);
    if (empty.ok) assert.equal(empty.notes, null);
    const tooLong = validateJobTaskContent({
      title: "A",
      notes: "n".repeat(JOB_TASK_NOTES_MAX + 1),
    });
    assert.equal(tooLong.ok, false);
  });
});

describe("due_on", () => {
  test("null and blank are valid; invalid calendar rejected", () => {
    assert.deepEqual(parseJobTaskDueOn(null), { ok: true, dueOn: null });
    assert.deepEqual(parseJobTaskDueOn(""), { ok: true, dueOn: null });
    assert.deepEqual(parseJobTaskDueOn("2026-08-31"), {
      ok: true,
      dueOn: "2026-08-31",
    });
    assert.equal(parseJobTaskDueOn("2026-02-31").ok, false);
    assert.equal(parseJobTaskDueOn("08/31/2026").ok, false);
  });
});

describe("status", () => {
  test("only open and complete", () => {
    assert.deepEqual(parseJobTaskStatus("open"), { ok: true, status: "open" });
    assert.deepEqual(parseJobTaskStatus("complete"), {
      ok: true,
      status: "complete",
    });
    assert.equal(parseJobTaskStatus("blocked").ok, false);
    assert.equal(parseJobTaskStatus("done").ok, false);
  });
});
