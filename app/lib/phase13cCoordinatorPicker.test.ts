/**
 * Phase 13C slice 2 — Coordinator picker (shared person choice in the Team sheet) and
 * Coordinator-derived Job access lifecycle (access follows the real responsibility).
 * Run: npx tsx --test app/lib/phase13cCoordinatorPicker.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  PERSON_CHOICE_SEARCH_THRESHOLD,
  filterPersonChoices,
  moveChoice,
  personInitials,
  tabStopKey,
  type PersonChoiceOption,
} from "./personChoice";
import {
  COORDINATOR_FORMER_HINT,
  COORDINATOR_NONE_KEY,
  COORDINATOR_UNASSIGNED,
  coordinatorChoices,
  coordinatorConfirmLabel,
  coordinatorKeyToUserId,
  coordinatorSavedMessage,
} from "./jobCoordinatorView";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8").replace(/\r\n/g, "\n");
const strip = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const sqlStrip = (source: string) => source.replace(/^\s*--.*$/gm, "");

const LIST = strip(read("app/components/ui/PersonChoiceList.tsx"));
const SHEET = strip(read("app/tools/roofing/jobCard/JobCardCoordinatorSheet.tsx"));
const CONTROL = strip(read("app/tools/roofing/jobCard/JobCardProductionLeadControl.tsx"));
const CLIENT = strip(read("app/tools/roofing/jobCard/JobCardClient.tsx"));
const LIFECYCLE = sqlStrip(read("supabase/migrations/20261001150000_phase13c_coordinator_access_lifecycle.sql"));

function fn(name: string): string {
  const start = LIFECYCLE.indexOf(`create or replace function ${name}(`);
  assert.ok(start >= 0, `missing ${name}`);
  const end = LIFECYCLE.indexOf("\n$$;", start);
  return LIFECYCLE.slice(start, end);
}

const DANA = "11111111-1111-4111-8111-111111111111";
const FRED = "22222222-2222-4222-8222-222222222222";
const RHEA = "33333333-3333-4333-8333-333333333333";

describe("person choice rules", () => {
  const rows: PersonChoiceOption[] = [
    { key: "none", label: "Unassigned", none: true },
    { key: "a", label: "Dana Wu" },
    { key: "b", label: "Rhea Removed", disabled: true },
    { key: "c", label: "Fred Field" },
  ];

  test("initials from first and last name", () => {
    assert.equal(personInitials("Dana Wu"), "DW");
    assert.equal(personInitials("  fred  "), "F");
    assert.equal(personInitials("Ana María Ruiz"), "AR");
    assert.equal(personInitials(""), "");
  });

  test("arrow, Home, End move over enabled rows and wrap", () => {
    assert.equal(moveChoice(rows, "a", "ArrowDown"), "c");
    assert.equal(moveChoice(rows, "c", "ArrowDown"), "none");
    assert.equal(moveChoice(rows, "none", "ArrowUp"), "c");
    assert.equal(moveChoice(rows, "a", "ArrowLeft"), "none");
    assert.equal(moveChoice(rows, "a", "End"), "c");
    assert.equal(moveChoice(rows, "c", "Home"), "none");
    assert.equal(moveChoice([{ key: "x", label: "X", disabled: true }], null, "ArrowDown"), null);
  });

  test("one Tab stop: the selection, else the first enabled row", () => {
    assert.equal(tabStopKey(rows, "c"), "c");
    assert.equal(tabStopKey(rows, "b"), "none");
    assert.equal(tabStopKey(rows, null), "none");
  });

  test("search keeps Unassigned and matches any part of a name", () => {
    assert.deepEqual(filterPersonChoices(rows, "wu").map((r) => r.key), ["none", "a"]);
    assert.deepEqual(filterPersonChoices(rows, "  ").map((r) => r.key), ["none", "a", "b", "c"]);
    assert.deepEqual(filterPersonChoices(rows, "zzz").map((r) => r.key), ["none"]);
    assert.equal(PERSON_CHOICE_SEARCH_THRESHOLD, 8);
  });
});

describe("Coordinator choices", () => {
  const candidates = [
    { userId: FRED, label: "Fred Field" },
    { userId: DANA, label: "Dana Wu" },
  ];

  test("Unassigned first, then people by name, current marked", () => {
    const rows = coordinatorChoices({ assignedTo: FRED, currentLabel: "Fred Field", candidates });
    assert.deepEqual(
      rows.map((r) => [r.key, r.label, Boolean(r.current)]),
      [
        [COORDINATOR_NONE_KEY, COORDINATOR_UNASSIGNED, false],
        [DANA, "Dana Wu", false],
        [FRED, "Fred Field", true],
      ]
    );
    assert.equal(rows[0].none, true);
  });

  test("unassigned job marks Unassigned as current", () => {
    const rows = coordinatorChoices({ assignedTo: null, currentLabel: COORDINATOR_UNASSIGNED, candidates });
    assert.equal(rows[0].current, true);
    assert.equal(rows.filter((r) => r.current).length, 1);
  });

  test("a current Coordinator who lost access stays visible, current, and can't be chosen", () => {
    const rows = coordinatorChoices({ assignedTo: RHEA, currentLabel: "Rhea Removed", candidates });
    const former = rows.find((r) => r.key === RHEA);
    assert.deepEqual(former, {
      key: RHEA,
      label: "Rhea Removed",
      current: true,
      disabled: true,
      hint: COORDINATOR_FORMER_HINT,
    });
    assert.equal(tabStopKey(rows, RHEA), COORDINATOR_NONE_KEY);
  });

  test("rows carry names only: no role, access, or email fields", () => {
    const rows = coordinatorChoices({ assignedTo: null, currentLabel: "", candidates });
    for (const row of rows) {
      assert.deepEqual(
        Object.keys(row).filter((k) => !["key", "label", "current", "disabled", "hint", "none"].includes(k)),
        []
      );
    }
  });

  test("confirm names the change and is absent when nothing changes", () => {
    assert.equal(coordinatorConfirmLabel({ assignedTo: FRED, next: FRED, nextLabel: "Fred Field" }), null);
    assert.equal(coordinatorConfirmLabel({ assignedTo: null, next: null, nextLabel: "Unassigned" }), null);
    assert.equal(coordinatorConfirmLabel({ assignedTo: null, next: DANA, nextLabel: "Dana Wu" }), "Assign Dana Wu");
    assert.equal(coordinatorConfirmLabel({ assignedTo: FRED, next: DANA, nextLabel: "Dana Wu" }), "Switch to Dana Wu");
    assert.equal(coordinatorConfirmLabel({ assignedTo: FRED, next: null, nextLabel: "Unassigned" }), "Remove coordinator");
    assert.equal(coordinatorKeyToUserId(COORDINATOR_NONE_KEY), null);
    assert.equal(coordinatorKeyToUserId(DANA), DANA);
  });

  test("confirmation copy after save", () => {
    assert.equal(coordinatorSavedMessage({ assignedTo: DANA, displayName: "Dana Wu" }), "Dana Wu is coordinating this job.");
    assert.equal(coordinatorSavedMessage({ assignedTo: null, displayName: null }), "This job has no coordinator now.");
    assert.equal(coordinatorSavedMessage({ assignedTo: DANA, displayName: null }), "Coordinator updated.");
  });
});

describe("PersonChoiceList primitive", () => {
  test("radio semantics with a single Tab stop and keyboard movement", () => {
    assert.match(LIST, /role="radiogroup"/);
    assert.match(LIST, /role="radio"/);
    assert.match(LIST, /aria-checked=\{selected\}/);
    assert.match(LIST, /tabIndex=\{option\.key === tabStop \? 0 : -1\}/);
    assert.match(LIST, /event\.key === " "/);
    assert.match(LIST, /moveChoice\(visible, key, event\.key as PersonChoiceKey\)/);
  });

  test("never a native select; choosing only reports the choice", () => {
    assert.doesNotMatch(LIST, /<select|<option/);
    assert.doesNotMatch(LIST, /fetch\(/);
  });
});

describe("Coordinator sheet", () => {
  test("hosted in the Team sheet (desktop drawer, mobile full-screen page)", () => {
    assert.match(SHEET, /<TeamSheet/);
    assert.match(SHEET, /view="job-coordinator"/);
    assert.match(SHEET, /backLabel="Job"/);
    assert.doesNotMatch(SHEET, /<select|<option/);
  });

  test("helper copy describes the group", () => {
    assert.match(SHEET, /const helpId = `coordinator-help-\$\{jobId\}`/);
    assert.match(SHEET, /describedBy=\{helpId\}/);
    assert.match(SHEET, /\{COORDINATOR_PICKER_HELP\}/);
  });

  test("explicit confirmation; disabled until the choice differs", () => {
    assert.match(SHEET, /disabled=\{saving \|\| !confirmLabel\}/);
    assert.match(SHEET, /onClick=\{\(\) => onConfirm\(next, nextLabel\)\}/);
    assert.match(SHEET, /onChange=\{setDraft\}/);
  });

  test("loading and failure are their own states, never an empty list", () => {
    assert.match(SHEET, /membersStatus === "loading"/);
    assert.match(SHEET, /membersStatus === "error"/);
    assert.match(SHEET, /People couldn&apos;t be loaded\./);
    assert.match(SHEET, /const confirmLabel = membersStatus === "ready" \?/);
  });
});

describe("Coordinator control", () => {
  test("the trigger opens a dialog; no inline editor or native select", () => {
    assert.match(CONTROL, /aria-haspopup="dialog"/);
    assert.match(CONTROL, /<JobCardCoordinatorSheet/);
    assert.doesNotMatch(CONTROL, /<select|<option|data-jobcard-production-lead-select/);
  });

  test("only a confirmed choice saves; closing changes nothing", () => {
    assert.match(CONTROL, /onConfirm=\{\(next\) => void save\(next\)\}/);
    assert.match(CONTROL, /onClose=\{\(\) => setOpen\(false\)\}/);
    assert.equal((CONTROL.match(/void save\(/g) ?? []).length, 1);
  });

  test("names come from the shared label, never roles or access", () => {
    assert.match(CONTROL, /label: labelForCompanyMember\(member\.userId, members\)/);
    assert.doesNotMatch(CONTROL, /teamRoleLabel|teamAccessLabel|member\.role|packageKeys/);
  });

  test("the directory is re-read on open and the read state is passed through", () => {
    assert.match(CONTROL, /setOpen\(true\);\s*onRefreshMembers\?\.\(\);/);
    assert.match(CLIENT, /companyMembers\.loading \? "loading" : companyMembers\.error \? "error" : "ready"/);
    assert.match(CLIENT, /onRefreshMembers=\{\(\) => void companyMembers\.refresh\(\)\}/);
  });
});

describe("Coordinator-derived access lifecycle", () => {
  const retire = fn("private.retire_coordinator_job_access_v1");
  const coupling = fn("private.job_assignment_access_coupling_trg_v1");
  const manual = fn("private.change_job_access_v1");
  const reason = fn("private.job_access_derived_reason_v1");

  test("derived reason: Coordinator first, then a live task on the Job", () => {
    assert.ok(reason.indexOf("'production_lead_assignment'") < reason.indexOf("'task_assignment'"));
    assert.match(reason, /t\.deleted_at is null/);
  });

  test("retirement only ends Coordinator-sourced grants without another live reason", () => {
    const steps = [
      "for update",
      "if v_grant.source <> 'production_lead_assignment' then\n    return 'kept_independent'",
      "return 'kept_current'",
      "set source = 'task_assignment'",
      "set revoked_at = now(), revoked_by = auth.uid()",
      "'job_access_revoked', 'system'",
    ].map((needle) => {
      const at = retire.indexOf(needle);
      assert.ok(at >= 0, needle);
      return at;
    });
    assert.deepEqual(steps, [...steps].sort((a, b) => a - b));
    assert.doesNotMatch(retire, /delete from/);
  });

  test("runs inside the Coordinator write: former holder retired before the new grant", () => {
    const at = coupling.indexOf(
      "perform private.retire_coordinator_job_access_v1(new.company_id, new.id, old.assigned_to)"
    );
    assert.ok(at >= 0);
    assert.ok(at < coupling.indexOf("insert into public.job_access_grants"));
    assert.match(coupling, /tg_op = 'UPDATE' and new\.assigned_to is not distinct from old\.assigned_to then\s*return null/);
  });

  test("an explicit grant over a derived grant records the explicit reason", () => {
    assert.match(manual, /v_grant_source not in \('task_assignment', 'production_lead_assignment'\)/);
    assert.match(manual, /update public\.job_access_grants set source = 'manual', granted_by = v_uid where id = v_grant_id/);
  });

  test("one reason system: no new table, no new source values", () => {
    assert.doesNotMatch(LIFECYCLE, /create table|alter table public\.job_access_grants/);
  });

  test("one-time reconciliation reuses the same retirement", () => {
    assert.match(LIFECYCLE, /j\.assigned_to is distinct from g\.user_id/);
    assert.match(LIFECYCLE, /perform private\.retire_coordinator_job_access_v1\(r\.company_id, r\.job_id, r\.user_id\)/);
  });

  test("private helpers are not executable by clients", () => {
    assert.match(LIFECYCLE, /revoke all on function private\.retire_coordinator_job_access_v1\(uuid, uuid, uuid\) from public/);
    assert.match(LIFECYCLE, /revoke all on function private\.job_access_derived_reason_v1\(uuid, uuid, uuid\) from public/);
  });
});
