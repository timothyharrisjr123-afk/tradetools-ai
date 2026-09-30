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
  startStrongSignInOnce,
  type StrongSignInClient,
} from "@/app/lib/auth/strongSignIn";
import { TEAM_STRONG_AUTH, teamPresetChoices } from "@/app/lib/access/teamAccessPresentation";
import { readTeamSurfaceSource } from "@/app/lib/teamSurfaceSource.testSupport";
import { NO_VIEWER_ACCESS } from "@/app/lib/access/viewerAccess";
import { navItemAllowed } from "@/app/tools/roofing/useViewerNavAccess";

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
  const editor = readTeamSurfaceSource();
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

test("a Production Lead is a coordinator before any field fallback", () => {
  const saved = read("app/tools/roofing/saved/SavedClient.tsx");
  const coordinator = saved.search(/companyMembers\.canAssignJobs\s*\?\s*"coordinator"/);
  const field = saved.search(/companyMembers\.restrictedFieldRole\s*\?\s*"field"/);
  assert.ok(coordinator >= 0);
  assert.ok(coordinator < field);
});

test("navigation offers creation and commercial setup only to members who hold it", () => {
  const none = { ...NO_VIEWER_ACCESS };
  assert.equal(navItemAllowed("newJob", null), false);
  assert.equal(navItemAllowed("pricing", null), false);
  assert.equal(navItemAllowed("jobs", null), true);
  assert.equal(navItemAllowed("newJob", none), false);
  assert.equal(navItemAllowed("newJob", { ...none, canCreateJobs: true }), true);
  for (const key of ["pricing", "catalog", "templates"] as const) {
    assert.equal(navItemAllowed(key, none), false, key);
    assert.equal(navItemAllowed(key, { ...none, canReadCommercial: true }), true, key);
  }
  assert.match(read("app/tools/roofing/saved/components/JobsBoardHeader.tsx"), /canCreateJobs \?/);
});

test("concurrent strong sign-in starts share one enrollment", async () => {
  const { client, calls } = fakeClient([]);
  const [a, b] = await Promise.all([startStrongSignInOnce(client), startStrongSignInOnce(client)]);
  assert.equal(a, b);
  assert.deepEqual(calls, ["list", "enroll"]);
  await startStrongSignInOnce(client);
  assert.deepEqual(calls, ["list", "enroll", "list", "enroll"]);
  const step = read("app/tools/settings/StrongSignInStep.tsx");
  assert.match(step, /startStrongSignInOnce/);
  assert.match(step, /Try again/);
});

test("Team hides Owner-only choices from Admins and confirms each action", () => {
  const editor = readTeamSurfaceSource();
  assert.match(editor, /teamPresetChoices\(delegator\)/);
  assert.equal(teamPresetChoices("admin").some((preset) => preset.role === "admin"), false);
  assert.equal(teamPresetChoices("owner").some((preset) => preset.role === "admin"), true);
  assert.match(editor, /viewerIsOwner \|\| member\.role !== "admin"/);
  assert.match(editor, /Invitation sent again to/);
  assert.match(editor, /revoked\. The link no longer works\./);
  assert.match(editor, /is now the Owner\. You're now/);
});

test("Field Job Cards drop the commercial tabs instead of showing empty money", () => {
  const card = read("app/tools/roofing/jobCard/JobCardClient.tsx");
  assert.match(card, /COMMERCIAL_JOB_CARD_TABS: readonly JobCardTabId\[\] = \["proposals", "payments"\]/);
  assert.match(card, /hiddenTabIds=\{suppressCommercial \? COMMERCIAL_JOB_CARD_TABS/);
  assert.match(read("app/tools/roofing/jobCard/JobCardMoreSheet.tsx"), /hiddenDestinations/);
});

test("the join and start screens use the light entry card with 44px actions", () => {
  const styles = read("app/components/ui/surfaceStyles.ts");
  assert.match(styles, /ENTRY_PRIMARY_ACTION =\s*"[^"]*min-h-\[44px\]/);
  assert.match(styles, /ENTRY_SECONDARY_ACTION =\s*"[^"]*min-h-\[44px\]/);
  for (const path of ["app/join/InvitationJoinScreen.tsx", "app/start/page.tsx"]) {
    const screen = read(path);
    assert.match(screen, /ENTRY_CARD/, path);
    assert.match(screen, /ENTRY_PRIMARY_ACTION/, path);
    assert.doesNotMatch(screen, /bg-slate-950|bg-zinc-950|h-9\b/, path);
  }
  assert.match(read("app/components/auth/SignOutButton.tsx"), /LAST_DB_JOB_ID_STORAGE_KEY/);
});
