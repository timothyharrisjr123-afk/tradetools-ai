/**
 * Phase 13B-H — launch completeness: strong sign-in and role-aware empty work.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import {
  confirmStrongSignIn,
  startStrongSignIn,
  type StrongSignInClient,
} from "@/app/lib/auth/strongSignIn";
import { TEAM_STRONG_AUTH } from "@/app/lib/access/teamAccessPresentation";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

type Factor = { id: string; factor_type?: string; status?: string };

function fakeClient(factors: Factor[], verifyOk = true) {
  const calls: string[] = [];
  const client: StrongSignInClient = {
    auth: {
      mfa: {
        listFactors: async () => {
          calls.push("list");
          return { data: { all: factors }, error: null };
        },
        enroll: async () => {
          calls.push("enroll");
          return {
            data: { id: "new-factor", totp: { qr_code: "data:image/svg+xml;x", secret: "ABC" } },
            error: null,
          };
        },
        unenroll: async ({ factorId }) => {
          calls.push(`unenroll:${factorId}`);
          return { error: null };
        },
        challengeAndVerify: async ({ code }) => {
          calls.push(`verify:${code}`);
          return { error: verifyOk ? null : { message: "invalid" } };
        },
      },
    },
  };
  return { client, calls };
}

test("a verified authenticator is challenged, not re-enrolled", async () => {
  const { client, calls } = fakeClient([{ id: "f1", factor_type: "totp", status: "verified" }]);
  assert.deepEqual(await startStrongSignIn(client), { kind: "verify", factorId: "f1" });
  assert.deepEqual(calls, ["list"]);
});

test("stale unverified authenticators are cleared before a new enrollment", async () => {
  const { client, calls } = fakeClient([{ id: "old", factor_type: "totp", status: "unverified" }]);
  const started = await startStrongSignIn(client);
  assert.equal(started.kind, "enroll");
  assert.deepEqual(calls, ["list", "unenroll:old", "enroll"]);
});

test("codes are validated before the network and failures stay plain", async () => {
  const { client, calls } = fakeClient([], false);
  const bad = await confirmStrongSignIn(client, "f1", "12a");
  assert.equal(bad.ok, false);
  assert.equal(calls.length, 0);
  const wrong = await confirmStrongSignIn(client, "f1", "123 456");
  assert.deepEqual(calls, ["verify:123456"]);
  assert.equal(wrong.ok, false);
  if (!wrong.ok) assert.doesNotMatch(wrong.message, /aal|mfa|factor|invalid/i);
});

test("strong sign-in copy no longer claims the step is missing", () => {
  assert.doesNotMatch(TEAM_STRONG_AUTH, /isn.t available/);
  const step = read("app/tools/settings/StrongSignInStep.tsx");
  assert.match(step, /Confirm and continue/);
  assert.match(step, /Not now/);
  assert.doesNotMatch(step, /aal2|factorId\}/);
  const editor = read("app/tools/settings/CompanySettingsTeamEditor.tsx");
  for (const retry of ["saveRole(member)", "reactivate(member)", "sendInvitation", "transferOwnership"]) {
    assert.ok(editor.includes(`needsStrongSignIn(err, ${retry.includes("(") ? `() => ${retry}` : retry})`), retry);
  }
});

test("strong sign-in never becomes a use-time gate for ordinary work", () => {
  const f = read("supabase/migrations/20260927220000_phase13b_f_custody_recovery.sql");
  const evaluator = f.indexOf("function private.evaluate_access_v1(");
  assert.equal(evaluator, -1);
  assert.doesNotMatch(read("app/tools/roofing/saved/SavedClient.tsx"), /StrongSignIn|mfa\./);
});

test("an empty board only offers job creation to people who can send proposals", () => {
  const empty = read("app/tools/roofing/saved/components/JobsBoardEmptyState.tsx");
  assert.match(empty, /No work assigned yet/);
  assert.match(empty, /No jobs to coordinate yet/);
  assert.match(empty, /audience !== "author"/);
  const saved = read("app/tools/roofing/saved/SavedClient.tsx");
  assert.match(saved, /companyMembers\.canSendProposals\s*\?\s*"author"/);
  assert.match(saved, /companyMembers\.restrictedFieldRole\s*\?\s*"field"/);
});
