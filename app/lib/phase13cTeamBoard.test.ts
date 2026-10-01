/**
 * Phase 13C Team Board — people, crews, rosters, and the operational board.
 * Live staging RPC behaviour is proven by tmp/phase13c-team-board/crewMatrix.mjs;
 * these tests lock the model, the migration contract, and the board structure.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  buildTeamBoardModel,
  crewAddCandidates,
  crewLeadCandidates,
  filterTeamBoard,
  parseTeamBoardSnapshot,
  PERSON_NAME_PLACEHOLDER,
  searchTeamEntries,
  workLabel,
  type TeamBoardMemberInput,
  type TeamBoardSnapshot,
} from "./team/teamBoardModel";
import { runTeamBoardAction, TeamBoardHttpError } from "./team/teamBoardPersistence";
import { readTeamWeek, teamWeekRange, weekDayLabel, weekJobsFor } from "./team/teamWeek";
import { getNavSectionItems } from "@/app/tools/roofing/fieldDiveNavConfig";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const migration = read("supabase/migrations/20260929130000_phase13c_team_board_people_crews.sql");
const detailsMigration = read("supabase/migrations/20260929140000_phase13c_team_board_person_details.sql");
const board = read("app/tools/team/TeamBoardClient.tsx");
const modelSource = read("app/lib/team/teamBoardModel.ts");
const page = read("app/tools/team/page.tsx");

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const member = (n: number, role: TeamBoardMemberInput["role"], name: string, extra: Partial<TeamBoardMemberInput> = {}): TeamBoardMemberInput => ({
  userId: U(n), role, displayName: name, email: `${name.split(" ")[0].toLowerCase()}@example.invalid`,
  removedAt: null, openJobLeadCount: 0, openTaskAssigneeCount: 0, packageKeys: [], ...extra,
});

// Tim (Owner access) leads Tim Crew but is not on its roster; Mike (Production
// Coordinator access) leads Mike Crew and is also on its roster; Carlos (Lead access)
// leads Carlos Crew; Gutter Crew has no usual Lead. Lisa (Office Manager access), Fred
// (Field) and Jason (no login) are on no crew; Dana's access was removed but she is
// still on Mike Crew.
const members: TeamBoardMemberInput[] = [
  member(1, "owner", "Tim Harris", { openJobLeadCount: 3 }),
  member(2, "production_lead", "Mike Johnson", { openJobLeadCount: 2, openTaskAssigneeCount: 1 }),
  member(3, "field_user", "Carlos Rivera", { packageKeys: ["lead_assigned_work"] }),
  member(4, "admin", "Lisa Harris"),
  member(5, "field_user", "Fred Kim", { openTaskAssigneeCount: 1 }),
  member(6, "field_user", "Dana Wu", { removedAt: "2026-09-01T00:00:00Z", openTaskAssigneeCount: 4 }),
];
const P = { tim: U(101), mike: U(102), carlos: U(103), dana: U(106), bob: U(110), joe: U(111), jason: U(112), bob2: U(113) };
const C = { tim: U(201), mike: U(202), carlos: U(203), gutter: U(204) };
const snapshot: TeamBoardSnapshot = {
  people: [
    { id: P.tim, displayName: "Tim Harris", phone: null, linkedUserId: U(1), rowVersion: 1 },
    { id: P.mike, displayName: "Mike Johnson", phone: null, linkedUserId: U(2), rowVersion: 1 },
    { id: P.carlos, displayName: "Carlos Rivera", phone: null, linkedUserId: U(3), rowVersion: 1 },
    { id: P.dana, displayName: "Dana Wu", phone: null, linkedUserId: U(6), rowVersion: 1 },
    { id: P.bob, displayName: "Bob Harris", phone: "303-555-0101", linkedUserId: null, rowVersion: 1 },
    { id: P.joe, displayName: "Joe Smith", phone: null, linkedUserId: null, rowVersion: 1 },
    { id: P.jason, displayName: "Jason Miller", phone: null, linkedUserId: null, rowVersion: 1 },
    { id: P.bob2, displayName: "Bob Harris", phone: null, linkedUserId: null, rowVersion: 1 },
  ],
  crews: [
    { id: C.mike, name: "Mike Crew", usualLeadPersonId: P.mike, rowVersion: 1 },
    { id: C.carlos, name: "Carlos Crew", usualLeadPersonId: P.carlos, rowVersion: 1 },
    { id: C.tim, name: "Tim Crew", usualLeadPersonId: P.tim, rowVersion: 1 },
    { id: C.gutter, name: "Gutter Crew", usualLeadPersonId: null, rowVersion: 3 },
  ],
  roster: [
    { crewId: C.mike, personId: P.bob },
    { crewId: C.mike, personId: P.dana },
    { crewId: C.mike, personId: P.mike },
    { crewId: C.carlos, personId: P.joe },
    { crewId: C.carlos, personId: P.bob },
    { crewId: C.tim, personId: P.bob2 },
  ],
};
const model = buildTeamBoardModel({ snapshot, members, accessAdmin: true });
const names = (rows: { name: string }[]) => rows.map((row) => row.name);

const crewOf = (m: typeof model, id: string) => m.groups.flatMap((g) => g.crews).find((c) => c.id === id)!;

describe("Team Board model: your people and crews", () => {
  test("person-led groups by name, then crews without a usual Lead by crew name; never by access", () => {
    assert.deepEqual(model.groups.map((g) => g.lead?.name ?? g.crews[0].name), ["Carlos Rivera", "Mike Johnson", "Tim Harris", "Gutter Crew"]);
    assert.equal(model.groups[1].crews[0].name, "Mike Crew");
    assert.equal(model.crewCount, 4);
    const reversedAccess = buildTeamBoardModel({
      snapshot,
      members: members.map((m) => (m.userId === U(1) ? { ...m, role: "field_user" as const } : m.userId === U(3) ? { ...m, role: "owner" as const } : m)),
      accessAdmin: true,
    });
    assert.deepEqual(reversedAccess.groups.map((g) => g.key), model.groups.map((g) => g.key), "changing access does not reorder the board");
  });

  test("a crew with no usual Lead is a complete crew: its own group, no person, nothing missing", () => {
    const gutter = model.groups[3];
    assert.equal(gutter.lead, null);
    assert.equal(gutter.key, `c:${C.gutter}`);
    assert.deepEqual(gutter.crews.map((c) => c.name), ["Gutter Crew"]);
    assert.equal(gutter.crews[0].memberCount, 0);
    const nameOnly = buildTeamBoardModel({
      snapshot: { people: [], crews: [{ id: C.gutter, name: "ABC Roofing", usualLeadPersonId: null, rowVersion: 1 }], roster: [] },
      members: [],
      accessAdmin: true,
    });
    assert.equal(nameOnly.groups.length, 1);
    assert.equal(nameOnly.groups[0].lead, null);
    assert.equal(nameOnly.entries.length, 0, "no person is invented for a crew without a Lead");
  });

  test("usual Lead and membership are independent: counts are roster truth", () => {
    const tim = crewOf(model, C.tim);
    assert.equal(tim.lead?.name, "Tim Harris");
    assert.equal(tim.leadIsMember, false);
    assert.equal(tim.memberCount, 1, "a Lead who is not on the roster is not counted");
    assert.deepEqual(names(tim.members), ["Bob Harris"]);

    const mike = crewOf(model, C.mike);
    assert.equal(mike.leadIsMember, true);
    assert.equal(mike.memberCount, 3, "a Lead who is on the roster is counted");
    assert.deepEqual(names(mike.members), ["Bob Harris", "Dana Wu"], "the Lead is shown once, above the roster");

    const carlos = crewOf(model, C.carlos);
    assert.equal(carlos.leadIsMember, false);
    assert.equal(carlos.memberCount, 2);
    assert.ok(carlos.members.every((m) => m.leadsCrewIds.length === 0), "members who do not lead are ordinary members");
  });

  test("people not on a crew are one list, whatever their access", () => {
    assert.deepEqual(names(model.notOnCrew), ["Fred Kim", "Jason Miller", "Lisa Harris"]);
    assert.ok(!("office" in model), "no access-derived office grouping");
  });

  test("access removed never removes the person operationally", () => {
    const dana = model.groups[1].crews[0].members.find((m) => m.name === "Dana Wu")!;
    assert.equal(dana.access, "removed");
    assert.equal(dana.work, null, "no open-work claim for a removed login");
    assert.ok(!model.notOnCrew.some((e) => e.name === "Dana Wu"));
  });

  test("a person with no login is valid on a crew and is not labelled as a login state", () => {
    const joe = crewOf(model, C.carlos).members.find((m) => m.name === "Joe Smith")!;
    assert.equal(joe.access, "none");
    assert.equal(joe.roleLabel, null);
    assert.equal(joe.userId, null);
  });

  test("same-name people stay separate; nothing merges by name", () => {
    const bobs = model.entries.filter((e) => e.name === "Bob Harris");
    assert.equal(bobs.length, 2);
    assert.notEqual(bobs[0].key, bobs[1].key);
    assert.equal(searchTeamEntries(model.entries, "bob harris").length, 2);
  });

  test("a person may be on several crews", () => {
    const bob = model.entries.find((e) => e.personId === P.bob)!;
    assert.deepEqual([...bob.crewIds].sort(), [C.mike, C.carlos].sort());
  });

  test("a member with no operational person yet is still shown, and never linked by name", () => {
    const fred = model.notOnCrew.find((e) => e.name === "Fred Kim")!;
    assert.equal(fred.personId, null);
    assert.equal(fred.key, `u:${U(5)}`);
    const mixed = buildTeamBoardModel({
      snapshot: { ...snapshot, people: [...snapshot.people, { id: U(120), displayName: "Fred Kim", phone: null, linkedUserId: null, rowVersion: 1 }] },
      members, accessAdmin: true,
    });
    assert.equal(mixed.entries.filter((e) => e.name === "Fred Kim").length, 2, "a same-name non-login person is not the Fred login");
  });

  test("open work is verified only for access admins; unknown is not zero", () => {
    assert.equal(workLabel(model.groups[1].lead!.work), "Coordinates 2 open jobs · 1 open task");
    assert.equal(workLabel({ jobs: 0, tasks: 0 }), null);
    const directory = buildTeamBoardModel({
      snapshot,
      members: members.filter((m) => !m.removedAt).map((m) => ({ ...m, packageKeys: [], openJobLeadCount: 0, openTaskAssigneeCount: 0 })),
      accessAdmin: false,
    });
    assert.ok(directory.entries.every((e) => e.work === null));
    const carlos = directory.groups.find((g) => g.lead?.personId === P.carlos)!.lead!;
    assert.equal(carlos.roleLabel, null, "without package truth a Field-based member is not guessed as Lead or Field");
    const dana = directory.entries.find((e) => e.personId === P.dana)!;
    assert.equal(dana.access, "unknown", "a linked login missing from the directory is not claimed as no login");
  });

  test("candidates: add excludes the roster only; a Lead not on the roster may be added", () => {
    const add = crewAddCandidates(model, crewOf(model, C.mike)).map((e) => e.key);
    assert.ok(!add.includes(`p:${P.bob}`) && !add.includes(`p:${P.mike}`) && !add.includes(`p:${P.dana}`));
    assert.ok(add.includes(`u:${U(5)}`) && add.includes(`p:${P.jason}`));
    assert.ok(crewAddCandidates(model, crewOf(model, C.tim)).some((e) => e.personId === P.tim), "leading is not membership");
  });

  test("Lead picker: everyone, alphabetical; never Owner-first or access-ranked", () => {
    const leads = crewLeadCandidates(model).map((e) => e.name);
    assert.deepEqual(leads, [...leads].sort((a, b) => a.localeCompare(b)));
    assert.ok(leads.includes("Jason Miller") && leads.includes("Lisa Harris") && leads.includes("Tim Harris"));
    assert.notEqual(leads[0], "Tim Harris");
  });

  test("invitations are an exceptional state, separate from people", () => {
    const withInvite = buildTeamBoardModel({
      snapshot, members, accessAdmin: true,
      invitations: [{ invitationId: U(300), email: "new.lead@example.invalid", role: "field_user", packageKeys: ["lead_assigned_work"], expiresAt: "2026-10-06T00:00:00Z", delivery: "sent" }],
    });
    assert.equal(withInvite.invited[0].roleLabel, "Lead");
    assert.ok(!withInvite.entries.some((e) => e.name.includes("new.lead")));
  });

  test("identity: the person's name, then the login profile name, then email only as a last resort", () => {
    const ownerNoProfile = [member(1, "owner", "", { displayName: null, email: "owner.account@example.invalid" })];
    const withPlaceholder = {
      ...snapshot,
      people: [{ id: P.tim, displayName: PERSON_NAME_PLACEHOLDER, phone: null, linkedUserId: U(1), rowVersion: 1 }],
      roster: [],
      crews: [{ id: C.tim, name: "Harris Crew", usualLeadPersonId: P.tim, rowVersion: 1 }],
    };
    const unnamed = buildTeamBoardModel({ snapshot: withPlaceholder, members: ownerNoProfile, accessAdmin: true }).groups[0].lead!;
    assert.equal(unnamed.name, "owner.account@example.invalid");
    assert.equal(unnamed.nameKnown, false, "an email fallback is flagged so detail can ask for a name");

    const named = buildTeamBoardModel({
      snapshot: { ...withPlaceholder, people: [{ ...withPlaceholder.people[0], displayName: "Tim Harris", rowVersion: 2 }] },
      members: ownerNoProfile,
      accessAdmin: true,
    }).groups[0].lead!;
    assert.equal(named.name, "Tim Harris", "the operational person name wins over the sign-in email");
    assert.equal(named.nameKnown, true);
    assert.equal(named.email, "owner.account@example.invalid", "email stays available as account detail");
    assert.equal(named.roleLabel, "Owner");

    const profileOnly = buildTeamBoardModel({
      snapshot: withPlaceholder,
      members: [member(1, "owner", "Tim Harris")],
      accessAdmin: true,
    }).groups[0].lead!;
    assert.equal(profileOnly.name, "Tim Harris", "the placeholder never outranks a real profile name");
  });

  test("a non-login person exposes no email and no role", () => {
    const joe = model.entries.find((e) => e.personId === P.joe)!;
    assert.equal(joe.email, null);
    assert.equal(joe.roleLabel, null);
    assert.equal(joe.nameKnown, true);
  });

  test("multiple crews under one Lead stay separate crews in one group", () => {
    const withGutter = buildTeamBoardModel({
      snapshot: { ...snapshot, crews: snapshot.crews.map((c) => (c.id === C.gutter ? { ...c, usualLeadPersonId: P.carlos } : c)) },
      members,
      accessAdmin: true,
    });
    const carlos = withGutter.groups.find((g) => g.lead?.personId === P.carlos)!;
    assert.deepEqual(carlos.crews.map((c) => c.name), ["Carlos Crew", "Gutter Crew"]);
    assert.deepEqual(carlos.lead!.leadsCrewIds.length, 2);
    assert.ok(!withGutter.groups.some((g) => g.lead === null));
    assert.notEqual(carlos.crews[0].id, carlos.crews[1].id, "each crew keeps its own identity");
  });

  test("snapshot parsing rejects malformed rows rather than inventing people", () => {
    assert.equal(parseTeamBoardSnapshot({ people: [{ id: "x" }], crews: [], crew_members: [] }), null);
    assert.equal(parseTeamBoardSnapshot({ people: [], crews: [] }), null);
    const ok = parseTeamBoardSnapshot({
      people: [{ id: P.bob, display_name: "Bob", phone: null, linked_user_id: null, row_version: 2 }],
      crews: [{ id: C.mike, name: "Mike Crew", usual_lead_person_id: null, row_version: 1 }],
      crew_members: [{ crew_id: C.mike, person_id: P.bob }],
    });
    assert.deepEqual(ok?.roster, [{ crewId: C.mike, personId: P.bob }]);
    assert.equal(ok?.people[0].rowVersion, 2);
  });
});

describe("migration contract: people, crews, rosters (Parts 7–9, 18)", () => {
  test("three company-scoped tables with composite tenant keys", () => {
    for (const table of ["company_people", "crews", "crew_members"]) {
      assert.match(migration, new RegExp(`create table public\\.${table} \\(`));
    }
    assert.match(migration, /foreign key \(usual_lead_person_id, company_id\)\s+references public\.company_people \(id, company_id\)/);
    assert.match(migration, /foreign key \(crew_id, company_id\) references public\.crews \(id, company_id\)/);
    assert.match(migration, /foreign key \(person_id, company_id\) references public\.company_people \(id, company_id\)/);
  });

  test("person: name required (1–80), phone optional, no email/password/role/pay fields", () => {
    const people = migration.slice(migration.indexOf("create table public.company_people"), migration.indexOf("create unique index company_people_linked_user_uidx"));
    assert.match(people, /display_name text not null/);
    assert.match(people, /phone text,/);
    assert.match(people, /between 1 and 80/);
    assert.doesNotMatch(people, /\b(email|password|role|pay|wage|trade)\b/);
  });

  test("login link is unique per company, same-company only, and never set by name", () => {
    assert.match(migration, /create unique index company_people_linked_user_uidx\s+on public\.company_people \(company_id, linked_user_id\)/);
    assert.match(migration, /linked login is not a member of this company/);
    assert.match(migration, /login link is immutable/);
    assert.doesNotMatch(migration, /display_name\s*=\s*v_name\s+and|lower\(p\.display_name\)/, "no lookup of people by name");
  });

  test("crew names are unique among active crews, case-insensitive", () => {
    assert.match(migration, /create unique index crews_active_name_uidx\s+on public\.crews \(company_id, lower\(name\)\)\s+where archived_at is null/);
  });

  test("one active roster row per crew and person; history is kept and immutable", () => {
    assert.match(migration, /create unique index crew_members_active_uidx\s+on public\.crew_members \(crew_id, person_id\)\s+where removed_at is null/);
    assert.match(migration, /roster history is immutable/);
    assert.doesNotMatch(migration, /delete from public\.crew_members/);
  });

  test("no client privileges; every write is a jobs.assign-gated RPC", () => {
    assert.match(migration, /revoke all on table public\.company_people, public\.crews, public\.crew_members\s+from public, anon, authenticated/);
    assert.match(migration, /private\.member_can_v1\('jobs\.assign'\)/);
    const rpcs = [...migration.matchAll(/create or replace function public\.([a-z_0-9]+)\(/g)].map((m) => m[1]);
    assert.deepEqual(rpcs.sort(), [
      "add_crew_member_v1", "archive_company_person_v1", "archive_crew_v1", "create_company_person_v1",
      "create_crew_v1", "ensure_member_person_v1", "get_team_board_v1", "remove_crew_member_v1", "update_crew_v1",
    ]);
    const bodies = migration.split("create or replace function public.").slice(1);
    for (const body of bodies) assert.match(body, /private\.crew_manager_company_v1\(\)/, body.slice(0, 40));
  });

  test("crew membership never touches access; no deferred assignment tables", () => {
    assert.doesNotMatch(migration, /job_access_grants|company_member_access_rules|company_memberships\s+set|job_crew_assignments|job_access_grant_reasons/);
    assert.doesNotMatch(migration, /insert into public\.(job_|company_member)/);
  });

  test("archiving a person never disables a login; a crew survives its Lead", () => {
    assert.match(migration, /linked_login_active/);
    assert.match(migration, /set usual_lead_person_id = null/);
    assert.doesNotMatch(migration, /update public\.company_memberships/);
  });
});

describe("filters and search", () => {
  const view = (filter: Parameters<typeof filterTeamBoard>[1]["filter"], query = "") =>
    filterTeamBoard(model, { filter, query, canSeeInvites: true });

  test("All crews shows every section", () => {
    const v = view("all");
    assert.equal(v.groups.length, 4);
    assert.deepEqual(v.show, { crews: true, notOnCrew: true, invited: true });
  });

  test("Leads are every crew with a usual Lead, whatever that person's access", () => {
    const leads = view("leads");
    assert.deepEqual(leads.groups.map((g) => g.lead?.name), ["Carlos Rivera", "Mike Johnson", "Tim Harris"]);
    assert.deepEqual(leads.show, { crews: true, notOnCrew: false, invited: false });
    const noLogin = buildTeamBoardModel({
      snapshot: { ...snapshot, crews: snapshot.crews.map((c) => (c.id === C.gutter ? { ...c, usualLeadPersonId: P.jason } : c)) },
      members,
      accessAdmin: true,
    });
    const jason = filterTeamBoard(noLogin, { filter: "leads", query: "", canSeeInvites: true }).groups.find((g) => g.lead?.personId === P.jason);
    assert.ok(jason, "a usual Lead with no login is still a Lead");
  });

  test("Not on a crew and Invited focus a single support list", () => {
    assert.deepEqual(view("not_on_crew").show, { crews: false, notOnCrew: true, invited: false });
    assert.deepEqual(names(view("not_on_crew").notOnCrew), ["Fred Kim", "Jason Miller", "Lisa Harris"]);
    assert.equal(view("invited").show.invited, true);
    assert.equal(filterTeamBoard(model, { filter: "invited", query: "", canSeeInvites: false }).show.invited, false);
  });

  test("search keeps a crew whole when its name or Lead matches, else only matching members", () => {
    const byCrew = view("all", "carlos crew");
    assert.deepEqual(byCrew.groups.map((g) => g.crews.map((c) => c.name)), [["Carlos Crew"]]);
    assert.equal(byCrew.groups[0].crews[0].members.length, 2);
    const byMember = view("all", "dana");
    assert.deepEqual(byMember.groups.map((g) => g.crews[0].members.map((m) => m.name)), [["Dana Wu"]]);
    const byLead = view("all", "mike");
    assert.equal(byLead.groups[0].crews[0].members.length, 2, "a Lead match keeps the crew whole");
    assert.deepEqual(view("all", "jason").notOnCrew.map((e) => e.name), ["Jason Miller"]);
    assert.equal(view("all", "zzz").empty, true);
  });
});

describe("weekly work (Calendar truth, coordinator only)", () => {
  const week = {
    startsOn: "2026-09-28",
    afterEndOn: "2026-10-05",
    jobs: [
      { jobId: U(401), customerName: "Owen Brooks", address: "456 Pine Ave", startsOn: "2026-10-02", endsOn: "2026-10-02", coordinatorUserId: U(1) },
      { jobId: U(402), customerName: "Mia Hartley", address: "123 Oak Ridge Dr", startsOn: "2026-09-30", endsOn: "2026-09-30", coordinatorUserId: U(1) },
      { jobId: U(403), customerName: "Lan Nguyen", address: "19 Aspen Ct", startsOn: "2026-09-30", endsOn: "2026-09-30", coordinatorUserId: U(2) },
      { jobId: U(404), customerName: "Unowned", address: "", startsOn: "2026-10-01", endsOn: "2026-10-01", coordinatorUserId: null },
    ],
  };
  test("Monday-start week, matching the Calendar week", () => {
    assert.deepEqual(teamWeekRange("2026-09-29"), { startsOn: "2026-09-28", afterEndOn: "2026-10-05" });
    assert.deepEqual(teamWeekRange("2026-10-04"), { startsOn: "2026-09-28", afterEndOn: "2026-10-05" });
  });
  test("a person's jobs are the ones they coordinate, soonest first; unknown is null, not zero", () => {
    assert.deepEqual(weekJobsFor(week, U(1))!.map((j) => j.customerName), ["Mia Hartley", "Owen Brooks"]);
    assert.deepEqual(weekJobsFor(week, U(9)), []);
    assert.equal(weekJobsFor(null, U(1)), null, "unreadable week is not 'no jobs'");
    assert.equal(weekJobsFor(week, null), null, "a no-login Lead coordinates nothing knowable");
  });
  test("labels and payload parsing", () => {
    assert.equal(weekDayLabel("2026-09-30"), "Wed, Sep 30");
    assert.equal(weekDayLabel("nope"), "");
    assert.ok(readTeamWeek(week));
    assert.equal(readTeamWeek({ ...week, jobs: [{ jobId: 1 }] }), null);
  });
  test("route reads Calendar schedules and the job coordinator; no crew-to-job relationship", () => {
    const route = read("app/api/team/week/route.ts");
    assert.match(route, /from\("job_schedules"\)/);
    assert.match(route, /\.eq\("status", "scheduled"\)/);
    assert.match(route, /assigned_to/);
    assert.match(route, /calendarCivilRangeUtc/);
    assert.doesNotMatch(route, /from\("(crews|crew_members|company_people)"\)|crew_label|\.insert\(|\.update\(|\.rpc\(/);
    assert.match(route, /company_timezone_required/);
  });
});

describe("migration contract: person details", () => {
  test("one gated, versioned edit of name and phone; never touches the login, profile, or access", () => {
    const rpcs = [...detailsMigration.matchAll(/create or replace function public\.([a-z_0-9]+)\(/g)].map((m) => m[1]);
    assert.deepEqual(rpcs, ["update_company_person_v1"]);
    assert.match(detailsMigration, /private\.crew_manager_company_v1\(\)/);
    assert.match(detailsMigration, /stale_revision/);
    assert.match(detailsMigration, /between 1 and 80/);
    assert.match(detailsMigration, /set display_name = v_name, phone = v_phone/);
    assert.doesNotMatch(detailsMigration, /linked_user_id\s*=|public\.profiles|company_memberships|job_access_grants/);
    assert.match(detailsMigration, /revoke all on function public\.update_company_person_v1\(uuid, bigint, text, text\) from public, anon, authenticated/);
    assert.match(migration, /coalesce\(nullif\(btrim\(pr\.full_name\), ''\), 'Team member'\)/, "placeholder matches the model constant");
    assert.equal(PERSON_NAME_PLACEHOLDER, "Team member");
  });
});

describe("board actions validate shape before the database decides", () => {
  const fake = { rpc: async () => ({ data: { ok: true }, error: null }) } as never;
  const rejects = async (body: Record<string, unknown>) => {
    await assert.rejects(runTeamBoardAction(fake, body), (err) => err instanceof TeamBoardHttpError && err.code === "invalid_payload");
  };
  test("unknown actions, blank names, and bad ids are rejected", async () => {
    await rejects({ action: "grant_access" });
    await rejects({ action: "create_person", name: "  " });
    await rejects({ action: "create_person", name: "x".repeat(81) });
    await rejects({ action: "add_member", crewId: "nope", person: { personId: U(1) } });
    await rejects({ action: "add_member", crewId: U(1), person: { name: "Bob" } });
    await rejects({ action: "archive_crew", crewId: U(1) });
    await rejects({ action: "update_person", personId: U(1), expectedRowVersion: 1, name: " " });
    await rejects({ action: "update_person", personId: U(1), name: "Tim Harris" });
    await rejects({ action: "update_person", personId: U(1), expectedRowVersion: 1, name: "Tim", phone: "x".repeat(41) });
  });
  test("person details map to the versioned RPC", async () => {
    let call: { fn: string; args: Record<string, unknown> } | null = null;
    const spy = { rpc: async (fn: string, args: Record<string, unknown>) => ((call = { fn, args }), { data: { ok: true, row_version: 2 }, error: null }) } as never;
    const result = await runTeamBoardAction(spy, { action: "update_person", personId: U(1), expectedRowVersion: 1, name: " Tim Harris ", phone: "" });
    assert.deepEqual(call, { fn: "update_company_person_v1", args: { p_person_id: U(1), p_expected_row_version: 1, p_display_name: "Tim Harris", p_phone: null } });
    assert.deepEqual(result, { rowVersion: 2 });
  });
  test("database result codes surface as contractor messages", async () => {
    const denied = { rpc: async () => ({ data: { ok: false, code: "capability_denied" }, error: null }) } as never;
    await assert.rejects(runTeamBoardAction(denied, { action: "create_person", name: "Bob" }), (err) =>
      err instanceof TeamBoardHttpError && err.status === 403 && /run production/.test(err.message));
  });
});

describe("Team Board surface", () => {
  test("canonical Operations route renders the board, not the access directory", () => {
    assert.match(page, /<TeamBoardClient companyId=\{companyId\} \/>/);
    assert.doesNotMatch(page, /<CompanyTeamClient/);
    assert.deepEqual(getNavSectionItems("operations").map((i) => i.label), ["Jobs", "New job", "Calendar", "Team"]);
  });

  test("hierarchy is visible without clicking: lead anchor, crew rail, members", () => {
    assert.match(board, /data-team-lead-group/);
    assert.match(board, /border-l-2 border-slate-200/);
    assert.match(board, /data-team-crew-roster/);
    assert.match(board, /title="Not on a crew"/);
    assert.match(board, /On your team, not on a crew\./);
  });

  test("a crew without a usual Lead is a plain crew card: no placeholder person, no deficiency", () => {
    assert.doesNotMatch(board, /Needs a Lead|needs-lead|border-dashed border-slate-300 text-slate-400/);
    assert.match(board, /data-team-lead-group=\{lead \? "lead" : "crew"\}/);
    assert.match(board, /\) : null\}\s*\{group\.crews\.map\(\(crew, i\) => renderCrew\(crew, !lead && i === 0\)\)\}/, "no header at all without a Lead");
    assert.match(board, /full\.lead \? "Change Crew Lead" : "Choose Crew Lead"/, "choosing a Lead stays in the crew menu");
    assert.match(board, /count === 0\) return "No people listed"/);
  });

  test("no access-derived grouping, filter, or ranking on the board", () => {
    assert.doesNotMatch(board, /Office &amp; coordination|data-team-office|"coordinators"|Coordinators|Unassigned/);
    assert.doesNotMatch(modelSource, /OFFICE_ROLES|ROLE_RANK|entryRank|isCoordinatorEntry/);
  });

  test("crew counts are roster truth; a Lead on the roster is named, not duplicated", () => {
    assert.match(board, /const count = full\.memberCount;/);
    assert.match(board, /crew\.leadIsMember && crew\.lead \? `\$\{base\}, including/);
    const sheet = board.slice(board.indexOf("function PersonSheet"));
    assert.match(sheet, /const on = entry\.crewIds;/, "person detail lists every real membership, including crews they lead");
  });

  test("no org-chart boxes, tables, dashboard tiles, or kanban", () => {
    assert.doesNotMatch(board, /<table|kanban|org-chart|grid-cols-4|metric/i);
  });

  test("access is secondary: no per-person FieldDive status, reached from person detail", () => {
    assert.doesNotMatch(board, /FieldDive • Active|Details &amp; access|Details & access/);
    assert.match(board, /Manage FieldDive access/);
    assert.ok(board.indexOf('label="Crew"') < board.indexOf('label="FieldDive access"'), "operational truth precedes access");
    assert.match(board, /entry\.access !== "removed"\) return null/, "only removed and invited access are board states");
    assert.match(board, /data-team-access-state="invited"/);
  });

  test("direct actions live where the user is looking", () => {
    for (const marker of ["data-team-add-to-crew-open", "data-team-add-existing", "data-team-add-new-person", "data-team-remove-from-crew", "data-team-lead-editor", "data-team-archive-confirm", "data-team-create-crew-open", "data-team-add-person-open"]) {
      assert.match(board, new RegExp(marker), marker);
    }
    assert.match(board, /No FieldDive login needed/);
  });

  test("ready for drag and drop without implementing it", () => {
    assert.match(board, /data-team-drop-target="crew"/);
    assert.match(board, /data-team-drop-target="not-on-crew"/);
    assert.match(board, /data-team-movable/);
    assert.doesNotMatch(board, /draggable|onDrag|dnd-kit|react-beautiful-dnd/);
  });

  test("mobile-safe: single column below xl, shallow rail, no fixed widths that overflow 390px", () => {
    assert.match(board, /xl:grid-cols-\[minmax\(0,1fr\)_20\.5rem\]/);
    assert.match(board, /lg:columns-2/);
    assert.match(board, /ml-4 mt-1 divide-y divide-slate-100 border-l-2 border-slate-200 pl-3/);
    assert.match(board, /w-full sm:w-96/, "search is full width on mobile");
    assert.match(board, /flex flex-wrap gap-2" role="group"/, "filter pills wrap rather than scroll");
    assert.doesNotMatch(board, /min-w-\[(?:[4-9]\d{2}|\d{4})px\]|w-\[(?:[4-9]\d{2}|\d{4})px\]/);
  });

  test("board sublines are operational facts only; access labels stay in access contexts", () => {
    const roster = board.slice(board.indexOf("data-team-crew-roster"), board.indexOf("data-team-remove-from-crew"));
    assert.doesNotMatch(roster, /roleLabel|subline/, "no access taxonomy on ordinary crew rows");
    const sub = board.slice(board.indexOf("function subline"), board.indexOf("function crewCountLabel"));
    assert.doesNotMatch(sub, /roleLabel/, "no Owner / Production Coordinator / Lead / Office Manager titles on the board");
    assert.match(sub, /placement === "lead"\) return leads > 1 \? `\$\{leads\} crews` : null/);
    assert.match(sub, /return workLabel\(entry\.work\)/);
    const pickers = board.slice(board.indexOf("function LeadEditor"), board.indexOf("function PersonSheet"));
    assert.doesNotMatch(pickers, /entry\.roleLabel/, "choosing a Lead does not imply a role requirement");
    const outsideAccess = board.replace(/Signs in\{entry\.roleLabel[^\n]*/, "").replace(/\{invite\.roleLabel\}/, "");
    assert.doesNotMatch(outsideAccess, /roleLabel/, "roleLabel appears only in the FieldDive sign-in fact and invitations");
  });

  test("Lead copy: the crew persists; access is a quiet footnote", () => {
    assert.match(board, /The crew stays the same when its Lead changes: same name, same people\./);
    assert.match(board, /text-xs text-slate-400">FieldDive access isn&apos;t affected\./);
  });

  test("person detail: operational facts first, email only inside FieldDive, name editable", () => {
    const sheet = board.slice(board.indexOf("function PersonSheet"));
    const order = ['label="Crew"', 'label="Current work"', 'label="Phone"', 'label="FieldDive access"', "data-team-person-edit", "Archive person"];
    const at = order.map((marker) => sheet.indexOf(marker));
    assert.ok(at.every((i, n) => i > 0 && (n === 0 || i > at[n - 1])), `order: ${at.join(",")}`);
    assert.ok(sheet.indexOf("data-team-person-email") > sheet.indexOf('label="FieldDive access"'));
    assert.match(sheet, /subtitle=\{entry\.nameKnown \? null : "Name not set"\}/);
    assert.match(board, /action: "update_person"/);
  });

  test("header: search, exactly four filter pills, summary, and the two actions", () => {
    assert.match(board, /placeholder="Search people or crews\.\.\."/);
    const labels = [...board.slice(board.indexOf("const FILTERS"), board.indexOf("function requestId")).matchAll(/label: "([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(labels, ["All crews", "Leads", "Not on a crew", "Invited"]);
    assert.match(board, /<p className="mt-1 text-sm text-slate-500">Your people and crews\.<\/p>/);
    assert.doesNotMatch(board, /Who runs the work|under Unassigned/);
    assert.match(board, /`\$\{name\} added to your team\.`/);
    assert.match(board, /data-team-summary/);
    assert.match(board, /key !== "invited" \|\| canAdminMembers/, "Invited is an access-admin filter");
    assert.ok(board.indexOf("data-team-add-person-open") < board.indexOf("data-team-create-crew-open"));
  });

  test("weekly work: inline expansion with job rows and a Calendar link, no drawer", () => {
    const week = board.slice(board.indexOf("function WeekWork"), board.indexOf("export default function TeamBoardClient"));
    assert.match(week, /aria-expanded=\{expanded\}/);
    assert.match(week, /data-team-week-panel/);
    assert.match(week, /buildJobCardHref\(job\.jobId\)/);
    assert.match(week, /href=\{CALENDAR_HREF\}/);
    assert.match(week, /View in calendar/);
    assert.doesNotMatch(week, /TeamSheet|Drawer|Dialog/);
    assert.match(board, /Unreadable work is hidden, never shown as "no jobs"/);
    assert.match(board, /weekJobsFor\(week, lead\.access === "active" \? lead\.userId : null\)/);
  });

  test("no invented availability: no Available / Off / On a job today claims", () => {
    assert.doesNotMatch(board, /Available today|Off today|On a job today/);
  });

  test("unreadable crews are not an empty board", () => {
    assert.ok(board.indexOf("data-team-board-unavailable") < board.indexOf("data-team-crews-empty"));
  });
});
