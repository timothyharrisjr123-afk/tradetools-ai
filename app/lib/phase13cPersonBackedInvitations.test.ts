/**
 * Phase 13C identity coherence, slice 1: every new FieldDive invitation names its
 * Person, and acceptance links that exact Person or grants nothing. Live staging
 * behaviour is proven by tmp/phase13c-identity/matrix.mts; these tests lock the
 * migration contract, the app callers, and the one-row Team model.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  buildTeamBoardModel,
  filterTeamBoard,
  PERSON_NAME_NOT_SET,
  PERSON_NAME_PLACEHOLDER,
  type TeamBoardInviteInput,
  type TeamBoardMemberInput,
  type TeamBoardSnapshot,
} from "./team/teamBoardModel";
import { contractorFacingMessage } from "./access/teamAccessPresentation";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const SQL = read("supabase/migrations/20261001120000_phase13c_person_backed_invitations.sql");
const actions = read("app/lib/invitations/invitationActions.server.ts");
const route = read("app/api/company/invitations/route.ts");
const teamClient = read("app/tools/settings/team/CompanyTeamClient.tsx");
const board = read("app/tools/team/TeamBoardClient.tsx");

function sliceBetween(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  assert.ok(from >= 0, `missing ${start}`);
  const to = source.indexOf(end, from + start.length);
  assert.ok(to > from, `missing ${end}`);
  return source.slice(from, to);
}

const issueSql = sliceBetween(SQL, "function public.issue_company_invitation_v2", "function private.accept_company_invitation_core_v1");
const acceptSql = sliceBetween(SQL, "function private.accept_company_invitation_core_v1", "function public.archive_company_person_v1");
const archiveSql = sliceBetween(SQL, "function public.archive_company_person_v1", "function public.ensure_member_person_v1");
const ensureSql = sliceBetween(SQL, "function public.ensure_member_person_v1", "-- Privileges.");
const triggerSql = sliceBetween(SQL, "function private.company_people_tenant_trg_v1", "-- Issue v2.");

describe("Person-backed invitation schema", () => {
  test("person_id is a tenant-safe FK, nullable only for legacy rows, one pending invitation per Person", () => {
    assert.match(SQL, /add column person_id uuid;/);
    assert.doesNotMatch(SQL, /person_id uuid not null/);
    assert.match(SQL, /foreign key \(person_id, company_id\) references public\.company_people \(id, company_id\)/);
    assert.match(SQL, /company_invitations_one_pending_person_uidx[\s\S]*?where status = 'pending' and person_id is not null/);
  });
});

describe("issue_company_invitation_v2", () => {
  test("requires exactly one of an existing Person or a new Person name; never stores a placeholder", () => {
    assert.match(issueSql, /if \(p_person_id is null\) = \(v_name is null\) then[\s\S]*?'person_required'/);
    assert.match(issueSql, /lower\(v_name\) = 'team member'[\s\S]*?'invalid_person_name'/);
    assert.match(issueSql, /char_length\(v_name\) > 80/);
  });

  test("an existing Person must be in the actor's company, active, unlinked, and without a pending invitation", () => {
    assert.match(issueSql, /where p\.id = p_person_id\s+and p\.company_id = v_company\s+for update/);
    assert.match(issueSql, /'person_not_found'/);
    assert.match(issueSql, /archived_at is not null then[\s\S]*?'person_unavailable'/);
    assert.match(issueSql, /linked_user_id is not null then[\s\S]*?'person_already_linked'/);
    assert.match(issueSql, /i\.person_id = v_person\.id\s+and i\.status = 'pending'[\s\S]*?'invitation_pending'/);
  });

  test("a new Person and its invitation are created in the same transaction, after every check", () => {
    const create = issueSql.indexOf("insert into public.company_people");
    assert.ok(create > issueSql.indexOf("invitation_validate_proposal_v1"));
    assert.ok(create > issueSql.indexOf("assurance_satisfied_v1"));
    assert.ok(create < issueSql.indexOf("insert into public.company_invitations"));
    assert.match(issueSql, /idempotency_key, role_profile_version, proposal_fingerprint, person_id/);
  });

  test("the Person is part of the idempotency fingerprint and the response", () => {
    assert.match(issueSql, /'\|person:' \|\| p_person_id::text else '\|new_person:' \|\| v_name/);
    assert.match(issueSql, /'person_id', v_person_id/);
    assert.match(issueSql, /'person_created', v_person_created/);
  });

  test("uses the existing invitation delegation boundary; no jobs.assign gate", () => {
    assert.match(issueSql, /private\.invitation_delegate_tier_v1\(v_company, v_uid\)/);
    assert.match(issueSql, /private\.current_active_company_id\(\)/);
    assert.doesNotMatch(issueSql, /jobs\.assign|crew_manager_company_v1|p_company_id/);
  });

  test("v1 is no longer callable by app users; v2 is", () => {
    assert.match(SQL, /revoke all on function public\.issue_company_invitation_v1\(text, text, text\[\], uuid\[\], text, text\) from public, anon, authenticated;/);
    assert.match(SQL, /grant execute on function public\.issue_company_invitation_v1\(text, text, text\[\], uuid\[\], text, text\) to service_role;/);
    const v2Grant = SQL.match(/grant execute on function public\.issue_company_invitation_v2\([^)]*\) to [^;]+;/);
    assert.ok(v2Grant);
    assert.match(v2Grant[0], /authenticated, service_role/);
    assert.doesNotMatch(v2Grant[0], /\banon\b/);
  });
});

describe("acceptance: same Person or nothing", () => {
  test("Person checks run before the first write", () => {
    const firstWrite = acceptSql.indexOf("insert into public.company_memberships");
    for (const code of ["'person_unavailable'", "'person_already_linked'", "'person_conflict'"]) {
      const at = acceptSql.lastIndexOf(code, firstWrite);
      assert.ok(at > 0 && at < firstWrite, `${code} before membership insert`);
    }
  });

  test("links exactly the invited Person after marking the invitation accepted, or raises and rolls back", () => {
    const accepted = acceptSql.indexOf("set status = 'accepted'");
    const link = acceptSql.indexOf("set linked_user_id = v_uid");
    assert.ok(accepted > 0 && link > accepted);
    assert.match(acceptSql, /where id = v_person\.id\s+and company_id = v_inv\.company_id\s+and linked_user_id is null/);
    assert.match(acceptSql, /raise exception 'invitation_accept_person_link_lost' using errcode = '40001'/);
  });

  test("replay is a no-op only while the Person is still linked to this user", () => {
    const replay = sliceBetween(acceptSql, "if v_inv.status = 'accepted' and v_inv.accepted_by_user_id = v_uid then", "if v_confirmed is null then");
    assert.match(replay, /'person_conflict'/);
    assert.match(replay, /'already_accepted'/);
    assert.doesNotMatch(replay, /\binsert\b|\bupdate\b/i);
  });

  test("never links by name, phone, or email ownership", () => {
    assert.doesNotMatch(acceptSql, /display_name|phone|full_name/);
    assert.match(acceptSql, /p\.id = v_inv\.person_id/);
  });

  test("legacy invitations (no Person) keep their previous behaviour", () => {
    assert.match(acceptSql, /if v_inv\.person_id is not null then/);
    assert.match(acceptSql, /if v_inv\.person_id is not null and v_person\.linked_user_id is null then/);
  });
});

describe("login link mutability", () => {
  test("a link may only be set from null, on an active Person, with an accepted invitation as proof", () => {
    assert.match(triggerSql, /login link is immutable/);
    assert.match(triggerSql, /an archived person cannot be linked/);
    assert.match(triggerSql, /i\.person_id = new\.id[\s\S]*?i\.status = 'accepted'[\s\S]*?i\.accepted_by_user_id = new\.linked_user_id/);
  });

  test("a linked login must be an active member of the company", () => {
    assert.match(triggerSql, /m\.removed_at is null/);
    assert.match(triggerSql, /linked login is not an active member of this company/);
  });
});

describe("archive and legacy Person creation", () => {
  test("a pending invitation blocks archive; nothing auto-revokes", () => {
    assert.match(archiveSql, /i\.person_id = p_person_id and i\.status = 'pending'[\s\S]*?'invitation_pending'/);
    assert.doesNotMatch(archiveSql, /status = 'revoked'/);
  });

  test("ensure_member_person_v1 never stores a placeholder name", () => {
    assert.doesNotMatch(ensureSql, /coalesce\([^)]*'Team member'/);
    assert.match(ensureSql, /lower\(v_name\) = 'team member'[\s\S]*?'person_name_required'/);
  });
});

describe("app callers", () => {
  test("the server action calls v2 with exactly one Person reference", () => {
    assert.match(actions, /rpc\("issue_company_invitation_v2"/);
    assert.doesNotMatch(actions, /issue_company_invitation_v1/);
    assert.match(actions, /p_person_id: "personId" in input\.person/);
    assert.match(actions, /p_person_name: "personName" in input\.person/);
    assert.match(actions, /select\("id, person_id, email_canonical/);
  });

  test("the issue route requires exactly one of personId or name", () => {
    assert.match(route, /\(personId === null\) === \(personName === ""\)/);
    assert.match(route, /code: "person_required"/);
    assert.match(route, /UUID\.test\(personId\)/);
    assert.doesNotMatch(route, /companyId|p_company/);
  });

  test("the generic invite asks for a Name; the Person-tied invite does not", () => {
    assert.match(teamClient, /data-team-invite-name/);
    assert.match(teamClient, /\{invitePerson \? null : \(/);
    assert.match(teamClient, /invitePerson \? \{ personId: invitePerson\.personId \} : \{ name: inviteName\.trim\(\) \}/);
    assert.match(teamClient, /"Give FieldDive access"/);
  });

  test("the Team Person sheet shows truthful access and the right action for each state", () => {
    assert.match(board, /label="FieldDive access"/);
    assert.match(board, /data-team-person-access="none">No access</);
    assert.match(board, /data-team-give-access/);
    assert.match(board, /data-team-person-invitation/);
    assert.match(board, /"Restore access"/);
    assert.match(board, /type: "invite", person: \{ personId: entry\.personId/);
  });

  test("new error codes have plain messages", () => {
    for (const code of ["person_required", "invalid_person_name", "person_already_linked", "person_not_found", "person_unavailable"]) {
      const text = contractorFacingMessage(code, code, "FALLBACK");
      assert.notEqual(text, "FALLBACK", code);
      assert.doesNotMatch(text, /_/);
    }
  });
});

describe("Team model: a pending invitation is an access state, not a second row", () => {
  const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const members: TeamBoardMemberInput[] = [
    { userId: U(1), role: "owner", displayName: "Tim Harris", email: "tim@example.invalid", removedAt: null, openJobLeadCount: 0, openTaskAssigneeCount: 0, packageKeys: [] },
  ];
  const snapshot: TeamBoardSnapshot = {
    people: [
      { id: U(101), displayName: "Tim Harris", phone: null, linkedUserId: U(1), rowVersion: 1 },
      { id: U(102), displayName: "Bob Harris", phone: null, linkedUserId: null, rowVersion: 1 },
      { id: U(103), displayName: "Joe Smith", phone: null, linkedUserId: null, rowVersion: 1 },
    ],
    crews: [{ id: U(201), name: "Alpha", usualLeadPersonId: U(101), rowVersion: 1 }],
    roster: [{ crewId: U(201), personId: U(102) }],
  };
  const invite = (n: number, personId: string | null, email: string): TeamBoardInviteInput => ({
    invitationId: U(n), personId, email, role: "field_user", packageKeys: [], expiresAt: "2026-10-08T00:00:00Z", delivery: "sent",
  });
  const model = buildTeamBoardModel({
    snapshot,
    members,
    accessAdmin: true,
    invitations: [invite(301, U(102), "bob@example.invalid"), invite(302, null, "legacy@example.invalid")],
  });

  test("the invited Person keeps one row and carries the invitation", () => {
    const bob = model.entries.filter((e) => e.personId === U(102));
    assert.equal(bob.length, 1);
    assert.equal(bob[0].access, "invited");
    assert.equal(bob[0].invitation?.email, "bob@example.invalid");
    assert.equal(bob[0].name, "Bob Harris");
    assert.equal(model.entries.length, 3);
  });

  test("only legacy invitations stand alone in the Invited panel", () => {
    assert.deepEqual(model.invited.map((i) => i.email), ["legacy@example.invalid"]);
  });

  test("the Invited filter lists invited People once; All never repeats them", () => {
    const invited = filterTeamBoard(model, { filter: "invited", query: "", canSeeInvites: true });
    assert.deepEqual(invited.invitedPeople.map((e) => e.name), ["Bob Harris"]);
    assert.equal(invited.invited.length, 1);
    const all = filterTeamBoard(model, { filter: "all", query: "", canSeeInvites: true });
    assert.equal(all.invitedPeople.length, 0);
    const bobRows = all.groups.flatMap((g) => g.crews).flatMap((c) => c.members).filter((m) => m.personId === U(102));
    assert.equal(bobRows.length, 1);
  });

  test("after acceptance the same Person is the active row; no u: row appears", () => {
    const accepted = buildTeamBoardModel({
      snapshot: { ...snapshot, people: snapshot.people.map((p) => (p.id === U(102) ? { ...p, linkedUserId: U(2) } : p)) },
      members: [...members, { userId: U(2), role: "field_user", displayName: "Bob H", email: "bob@example.invalid", removedAt: null, openJobLeadCount: 0, openTaskAssigneeCount: 0, packageKeys: [] }],
      accessAdmin: true,
      invitations: [],
    });
    assert.equal(accepted.entries.length, 3);
    assert.ok(!accepted.entries.some((e) => e.key.startsWith("u:")));
    const bob = accepted.entries.find((e) => e.personId === U(102))!;
    assert.equal(bob.access, "active");
    assert.equal(bob.name, "Bob Harris", "the Person's name wins over the profile name");
  });

  test("an unnamed login reads as a non-durable label, never the stored placeholder", () => {
    const unnamed = buildTeamBoardModel({
      snapshot: { people: [{ id: U(109), displayName: PERSON_NAME_PLACEHOLDER, phone: null, linkedUserId: U(9), rowVersion: 1 }], crews: [], roster: [] },
      members: [{ userId: U(9), role: "field_user", displayName: null, email: null, removedAt: null, openJobLeadCount: 0, openTaskAssigneeCount: 0, packageKeys: [] }],
      accessAdmin: true,
    }).entries[0];
    assert.equal(unnamed.name, PERSON_NAME_NOT_SET);
    assert.equal(unnamed.nameKnown, false);
  });
});

describe("Dana Wu: the Person name leads; loading is never No access", () => {
  const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const DANA = U(501);
  const DANA_LOGIN = U(51);
  const owner: TeamBoardMemberInput = {
    userId: U(1), role: "owner", displayName: "Tim Harris", email: "tim@example.invalid", removedAt: null, openJobLeadCount: 0, openTaskAssigneeCount: 0, packageKeys: [],
  };
  const danaMember = (removedAt: string | null): TeamBoardMemberInput => ({
    userId: DANA_LOGIN, role: "field_user", displayName: "Dana W Login", email: "dana@example.test", removedAt, openJobLeadCount: 0, openTaskAssigneeCount: 0, packageKeys: [],
  });
  const snapshot = (linkedUserId: string | null): TeamBoardSnapshot => ({
    people: [
      { id: U(500), displayName: "Tim Harris", phone: null, linkedUserId: U(1), rowVersion: 1 },
      { id: DANA, displayName: "Dana Wu", phone: null, linkedUserId, rowVersion: 1 },
    ],
    crews: [],
    roster: [],
  });
  const danaInvite: TeamBoardInviteInput = {
    invitationId: U(601), personId: DANA, email: "dana@example.test", role: "field_user", packageKeys: [], expiresAt: "2026-10-08T00:00:00Z", delivery: "sent",
  };
  const dana = (input: Partial<Parameters<typeof buildTeamBoardModel>[0]>) =>
    buildTeamBoardModel({ snapshot: snapshot(null), members: [owner], accessAdmin: true, ...input }).entries.find((e) => e.personId === DANA)!;

  test("while invitations load, an unlinked Person is checking, never none or invited", () => {
    const loading = dana({ invitations: [danaInvite], invitationsRead: "loading" });
    assert.equal(loading.access, "checking");
    assert.equal(loading.invitation, undefined);
    assert.equal(dana({ invitations: [], invitationsRead: "loading" }).access, "checking");
  });

  test("a failed invitation read stays unverified, never none", () => {
    const failed = dana({ invitations: [], invitationsRead: "failed" });
    assert.equal(failed.access, "unverified");
    assert.equal(failed.invitation, undefined);
  });

  test("a viewer who cannot see invitations gets unknown, not none", () => {
    assert.equal(dana({ accessAdmin: false, invitations: [], invitationsRead: "hidden" }).access, "unknown");
  });

  test("resolved: a pending invite is invited (email secondary); no invite is No access", () => {
    const invited = dana({ invitations: [danaInvite], invitationsRead: "ready" });
    assert.equal(invited.access, "invited");
    assert.equal(invited.name, "Dana Wu");
    assert.equal(invited.invitation?.email, "dana@example.test");
    const none = dana({ invitations: [], invitationsRead: "ready" });
    assert.equal(none.access, "none");
    assert.equal(none.name, "Dana Wu");
  });

  test("Dana Wu is the row name when active and when removed, never the profile name", () => {
    const active = dana({ snapshot: snapshot(DANA_LOGIN), members: [owner, danaMember(null)], invitationsRead: "loading" });
    assert.equal(active.access, "active", "a linked login does not wait on invitations");
    assert.equal(active.name, "Dana Wu");
    assert.equal(active.email, "dana@example.test");
    const removed = dana({ snapshot: snapshot(DANA_LOGIN), members: [owner, danaMember("2026-09-30T00:00:00Z")] });
    assert.equal(removed.access, "removed");
    assert.equal(removed.name, "Dana Wu");
  });

  test("the board feeds the real invitation read state, without a timeout", () => {
    const load = sliceBetween(board, "const loadInvitations = useCallback", "const loadWeek");
    assert.match(load, /setInvitationsRead\("ready"\)/);
    assert.equal(load.match(/setInvitationsRead\("failed"\)/g)?.length, 2, "non-ok and thrown reads are both failures");
    assert.match(board, /useState<"loading" \| "ready" \| "failed">\("loading"\)/);
    assert.match(board, /invitationsRead: canAdminMembers \? invitationsRead : "hidden"/);
    assert.doesNotMatch(load, /setTimeout/);
  });

  test("checking and unverified render no access action and no archive", () => {
    const fact = sliceBetween(board, '<PersonFact label="FieldDive access"', "</PersonFact>");
    assert.match(fact, /data-team-person-access="checking"[\s\S]*?Checking access…/);
    assert.match(fact, /data-team-person-access="unverified"/);
    assert.match(fact, /entry\.access === "none" && canGiveAccess \?/, "Give access only for resolved No access");
    assert.match(fact, /entry\.access === "invited" && entry\.invitation && canAdminAccess \?/);
    assert.match(board, /entry\.access !== "checking" &&\s+entry\.access !== "unverified" &&/);
    assert.match(board, /canManageAccess=\{canAdminMembers && entry\.userId != null/, "Manage access needs a linked login");
  });

  test("the Team board hands the Person name to every hosted access sheet", () => {
    assert.match(board, /type: "person", userId: entry\.userId, personName: entry\.nameKnown \? entry\.name : undefined/);
    assert.match(board, /type: "invitation",[\s\S]{0,80}personName: entry\.nameKnown \? entry\.name : undefined/);
    assert.match(board, /type: "invite", person: \{ personId: entry\.personId, name: entry\.nameKnown \? entry\.name : /);
  });

  test("access sheets lead with the Person name and keep email secondary, without writing names", () => {
    assert.match(teamClient, /personIdentity\.userId === member\.userId\s+\? personIdentity\.name\s+: personName\(member, members\)/);
    assert.match(teamClient, /title=\{inviteeName \?\? invite\.email\}/);
    assert.match(teamClient, /subtitle=\{inviteeName \? `\$\{invite\.email\} · \$\{invitedLabel\}` : invitedLabel\}/);
    assert.match(teamClient, /Invitation sent again to \$\{inviteNameFor\(invite\) \?\? invite\.email\}/);
    assert.match(teamClient, /Invitation to \$\{inviteNameFor\(invite\) \?\? invite\.email\} revoked/);
    assert.ok((teamClient.match(/const name = nameFor\(member\);/g)?.length ?? 0) >= 5, "member, remove, handoff, reactivate sheets");
    assert.doesNotMatch(teamClient, /const name = personName\(member, people\);/);
    assert.doesNotMatch(teamClient, /full_name|display_name|update_company_person/);
  });
});
