/**
 * Phase 13B-G — Team UI contract over the A–F authority.
 * Presentation and source only. The database still decides access.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import {
  TEAM_ACCESS_UNVERIFIED,
  TEAM_INVITATIONS_UNAVAILABLE,
  TEAM_MEMBERS_UNAVAILABLE,
  TEAM_STALE_MEMBER,
  TEAM_STRONG_AUTH,
  contractorFacingMessage,
  packageKeysForSave,
  teamFieldAccessLine,
  teamListState,
  teamMemberStatus,
  teamPackageChoices,
  teamSpecialAccessSummary,
} from "@/app/lib/access/teamAccessPresentation";
import { readTeamSurfaceSource } from "@/app/lib/teamSurfaceSource.testSupport";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const editor = readTeamSurfaceSource(root);
const pending = read("app/api/company/invitations/pending/route.ts");
const list = read("app/lib/invitations/invitationActions.server.ts");
const membersRoute = read("app/api/company/members/route.ts");

test("a failed team read is not an empty list", () => {
  assert.equal(teamListState({ loading: true, failed: false, count: 0 }), "loading");
  assert.equal(teamListState({ loading: false, failed: true, count: 0 }), "unavailable");
  assert.equal(teamListState({ loading: false, failed: true, count: 2 }), "ready");
  assert.equal(teamListState({ loading: false, failed: false, count: 0 }), "ready");
  assert.match(editor, /\{TEAM_MEMBERS_UNAVAILABLE\}/);
  assert.equal(TEAM_MEMBERS_UNAVAILABLE, "Team members are unavailable right now.");
  assert.match(editor, /data-company-settings-team-unavailable/);
  assert.doesNotMatch(editor, /0 members/);
});

test("statuses stay in contractor language", () => {
  assert.deepEqual(teamMemberStatus({ removedAt: null, openWork: 0 }), {
    label: "Active",
    attention: null,
  });
  assert.equal(teamMemberStatus({ removedAt: "2026-09-28", openWork: 0 }).label, "Access removed");
  assert.equal(
    teamMemberStatus({ removedAt: "2026-09-28", openWork: 2 }).attention,
    "Work reassignment still needs attention."
  );
  assert.match(editor, /Invited/);
  assert.match(editor, /Access removed\. \$\{handoffError\}/);
  assert.match(editor, /action: "handoff"/);
  assert.match(editor, /Earlier special access is not restored/);
});

test("special access is package language, eligible for the role and delegator", () => {
  const ownerSales = teamPackageChoices("office_sales", "owner").map((choice) => choice.label);
  assert.ok(ownerSales.includes("Request payments"));
  assert.ok(ownerSales.includes("Coordinate production"));
  assert.equal(ownerSales.includes("Lead assigned work"), false);

  const adminSales = teamPackageChoices("office_sales", "admin").map((choice) => choice.label);
  assert.equal(adminSales.includes("Request payments"), false);
  assert.equal(adminSales.includes("View payment history"), false);
  assert.ok(adminSales.includes("Approve jobs"));

  const lead = teamPackageChoices("production_lead", "admin").map((choice) => choice.label);
  assert.deepEqual(lead.sort(), ["Approve jobs", "Manage customers and jobs"]);

  // Phase 13C Slice 1: the Lead package is the Lead access preset, not special access.
  const field = teamPackageChoices("field_user", "owner").map((choice) => choice.label);
  assert.deepEqual(field, []);

  for (const choice of [
    ...teamPackageChoices("admin", "owner"),
    ...teamPackageChoices("office_sales", "owner"),
    ...teamPackageChoices("production_lead", "owner"),
    ...teamPackageChoices("field_user", "admin"),
  ]) {
    assert.equal(/financials|internal costs|refund/i.test(choice.label), false);
    assert.equal(choice.key.includes(" "), false);
  }
  assert.equal(teamSpecialAccessSummary(["request_payments", "view_company_financials"]), "Request payments");
  assert.equal(teamSpecialAccessSummary(["refunds", "view_internal_costs"]), null);
});

test("a role save keeps packages the delegator cannot edit", () => {
  const saved = packageKeysForSave({
    role: "office_sales",
    existing: ["request_payments", "approve_jobs"],
    selected: ["coordinate_production"],
    choices: teamPackageChoices("office_sales", "admin"),
  });
  assert.deepEqual(saved, ["coordinate_production", "request_payments"]);
});

test("field access is job language", () => {
  assert.equal(teamFieldAccessLine("field_user", 3), "Assigned jobs (3)");
  assert.equal(teamFieldAccessLine("field_user", 0), "No jobs assigned yet");
  assert.equal(teamFieldAccessLine("production_lead", 4), null);
  assert.match(editor, /teamJobReach\(reach\)/);
  assert.match(editor, /teamAssignedJobCount\(member\.grantedJobCount/);
  assert.match(editor, /Earlier job access is not restored/);
  assert.doesNotMatch(editor, /granted_jobs|scope =/);
});

test("owner is not a role-dropdown choice and transfer is a separate action", () => {
  assert.match(editor, /member\.role !== "owner"/);
  assert.match(editor, /ASSIGNABLE_COMPANY_MEMBERSHIP_ROLES\.map/);
  assert.match(editor, /Transfer ownership/);
  assert.match(editor, /I understand I will no longer be the Owner/);
  assert.match(editor, /StrongSignInStep/);
  assert.match(editor, /code !== "assurance_required"/);
  assert.doesNotMatch(editor, /<option[^>]*value="owner"/);
  assert.match(editor, /expectedRevision: member\.accessRevision/);
  assert.doesNotMatch(editor, /onChange=\{[^}]*saveRole/);
});

test("contractor errors do not leak internal codes", () => {
  assert.equal(contractorFacingMessage("stale_revision", "stale_revision", "fallback"), TEAM_STALE_MEMBER);
  assert.equal(
    contractorFacingMessage("authorization_unavailable", "authorization_unavailable", "fallback"),
    TEAM_ACCESS_UNVERIFIED
  );
  assert.equal(contractorFacingMessage("assurance_required", "assurance_required", "fallback"), TEAM_STRONG_AUTH);
  assert.equal(contractorFacingMessage("team_unavailable", null, "fallback"), TEAM_MEMBERS_UNAVAILABLE);
  assert.equal(
    contractorFacingMessage("invitations_unavailable", null, "fallback"),
    TEAM_INVITATIONS_UNAVAILABLE
  );
  assert.equal(contractorFacingMessage("package_not_delegable", "package_not_delegable", "Try again."), "Try again.");
  assert.match(editor, /INVITATION_NOT_SENT_MESSAGE/);
  assert.match(read("app/lib/invitations/invitationModel.ts"), /Invitation wasn't sent/);
  assert.doesNotMatch(editor, /request_payments|access_revision|error_class|provider_message/);
});

test("directory viewers do not get access-admin fields in the editor", () => {
  assert.match(editor, /const activeAccess = canAdminMembers && !member\.removedAt/);
  assert.match(editor, /activeAccess \? teamSpecialAccessSummary/);
  assert.match(editor, /showEmail = canAdminMembers/);
  assert.match(editor, /An Owner or Office Manager changes access/);
});

test("pending invitations are session-scoped and do not return secrets", () => {
  assert.match(pending, /requireAccess\(supabase, user\.id, "team\.manage"\)/);
  assert.match(pending, /gate\.session\.companyId/);
  assert.doesNotMatch(pending, /searchParams|req\.json|body\.company/);
  const listFn = list.slice(list.indexOf("export async function listPendingCompanyInvitations"));
  assert.match(listFn, /status", "pending"/);
  assert.doesNotMatch(listFn, /token_hash|error_class|provider_message_id/);
  assert.match(membersRoute, /packages: Array\.isArray\(body\?\.packages\)/);
  assert.match(membersRoute, /expectedRevision: body\?\.expectedRevision/);
});

test("reactivation and removal stay explicit", () => {
  assert.match(editor, /action: "reactivate"/);
  assert.match(editor, /action: "remove"/);
  assert.match(editor, /They lose company access immediately/);
  assert.match(editor, /past work stays/);
  assert.match(editor, /Send invitation/);
  assert.match(editor, /Revoke invitation/);
  assert.match(editor, /Resend/);
});
