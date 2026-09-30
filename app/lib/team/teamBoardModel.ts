/**
 * Team Board model: who runs the work, and who works with whom.
 *
 * Operational truth (people, crews, rosters) comes from the crew tables; FieldDive
 * access comes from company memberships. The two are joined only through an
 * explicit person-to-login link, never by name. Crew membership never implies
 * access, and access never implies crew membership. Nothing here grants authority.
 */

import { teamAccessLabel, teamRoleLabel } from "@/app/lib/access/teamAccessPresentation";
import {
  resolveCompanyMembershipRole,
  type ResolvedCompanyMembershipRole,
} from "@/app/lib/companyMembershipRoles";

export type TeamBoardPersonRow = {
  id: string;
  displayName: string;
  phone: string | null;
  linkedUserId: string | null;
  rowVersion: number;
};

export type TeamBoardCrewRow = {
  id: string;
  name: string;
  usualLeadPersonId: string | null;
  rowVersion: number;
};

export type TeamBoardRosterRow = { crewId: string; personId: string };

export type TeamBoardSnapshot = {
  people: TeamBoardPersonRow[];
  crews: TeamBoardCrewRow[];
  roster: TeamBoardRosterRow[];
};

export type TeamBoardMemberInput = {
  userId: string;
  role: ResolvedCompanyMembershipRole;
  displayName: string | null;
  email: string | null;
  removedAt: string | null;
  openJobLeadCount: number;
  openTaskAssigneeCount: number;
  packageKeys?: string[];
};

export type TeamBoardInviteInput = {
  invitationId: string;
  email: string;
  role: string;
  packageKeys: string[];
  expiresAt: string;
  delivery: "sent" | "failed" | "unknown";
};

/** FieldDive login state for a person. `unknown` is never shown as "no login". */
export type TeamBoardAccess = "active" | "removed" | "none" | "unknown";

export type TeamBoardEntry = {
  /** Stable key: `p:<personId>` when an operational person exists, else `u:<userId>`. */
  key: string;
  personId: string | null;
  userId: string | null;
  name: string;
  /** False when no real name is known and `name` is a fallback (email or placeholder). */
  nameKnown: boolean;
  phone: string | null;
  /** FieldDive sign-in email; account detail only, never the board identity when a name exists. */
  email: string | null;
  role: ResolvedCompanyMembershipRole | null;
  /** Work label from access (Owner, Production Coordinator, Lead, …); null when unknown or no login. */
  roleLabel: string | null;
  access: TeamBoardAccess;
  /** Verified open work; null when this viewer cannot know it (never shown as zero). */
  work: { jobs: number; tasks: number } | null;
  rowVersion: number | null;
  crewIds: string[];
  leadsCrewIds: string[];
};

export type TeamBoardCrew = {
  id: string;
  name: string;
  rowVersion: number;
  lead: TeamBoardEntry | null;
  members: TeamBoardEntry[];
};

export type TeamBoardGroup = {
  key: string;
  lead: TeamBoardEntry | null;
  crews: TeamBoardCrew[];
};

export type TeamBoardInvite = {
  invitationId: string;
  email: string;
  roleLabel: string;
  expiresAt: string;
  emailFailed: boolean;
};

export type TeamBoardModel = {
  groups: TeamBoardGroup[];
  office: TeamBoardEntry[];
  unassigned: TeamBoardEntry[];
  invited: TeamBoardInvite[];
  entries: TeamBoardEntry[];
  crewCount: number;
};

/** Name `ensure_member_person_v1` stores when a login has no profile name. Not a real name. */
export const PERSON_NAME_PLACEHOLDER = "Team member";

/**
 * Operational identity: the person's own name, then the login's profile name, then
 * the sign-in email as a last resort. Never inferred from another person.
 */
function resolveEntryName(
  personName: string | null,
  member: TeamBoardMemberInput | null
): { name: string; nameKnown: boolean } {
  const own = personName?.trim();
  if (own && own !== PERSON_NAME_PLACEHOLDER) return { name: own, nameKnown: true };
  const profile = member?.displayName?.trim();
  if (profile && profile !== member?.email?.trim()) return { name: profile, nameKnown: true };
  return { name: member?.email?.trim() || own || PERSON_NAME_PLACEHOLDER, nameKnown: false };
}

const OFFICE_ROLES = new Set<ResolvedCompanyMembershipRole>(["owner", "admin", "office_sales", "production_lead"]);

const ROLE_RANK: Record<string, number> = {
  owner: 0,
  production_lead: 1,
  admin: 2,
  office_sales: 3,
  field_user: 4,
};

function entryRank(entry: TeamBoardEntry | null): number {
  if (!entry) return 9;
  if (entry.role && entry.access === "active") {
    const base = ROLE_RANK[entry.role] ?? 6;
    return entry.roleLabel === "Lead" ? 3.5 : base;
  }
  return 5;
}

const byName = (a: TeamBoardEntry, b: TeamBoardEntry) => a.name.localeCompare(b.name);

function memberRoleLabel(member: TeamBoardMemberInput, packagesKnown: boolean): string | null {
  if (member.role === "invalid_role") return null;
  if (packagesKnown) return teamAccessLabel(member.role, member.packageKeys ?? []);
  // Without package truth a Field-based member could be a Lead; say nothing rather than guess.
  if (member.role === "field_user") return null;
  return teamRoleLabel(member.role);
}

export function buildTeamBoardModel(input: {
  snapshot: TeamBoardSnapshot;
  members: readonly TeamBoardMemberInput[];
  invitations?: readonly TeamBoardInviteInput[];
  /** True when members come from the access-admin projection (packages, removed members, open work). */
  accessAdmin: boolean;
}): TeamBoardModel {
  const { snapshot, members, accessAdmin } = input;
  const memberByUser = new Map(members.map((m) => [m.userId, m]));
  const linkedUsers = new Set<string>();
  const entries: TeamBoardEntry[] = [];
  const byPerson = new Map<string, TeamBoardEntry>();

  const crewIds = new Set(snapshot.crews.map((c) => c.id));
  const rosterByPerson = new Map<string, string[]>();
  for (const row of snapshot.roster) {
    if (!crewIds.has(row.crewId)) continue;
    rosterByPerson.set(row.personId, [...(rosterByPerson.get(row.personId) ?? []), row.crewId]);
  }
  const leadsByPerson = new Map<string, string[]>();
  for (const crew of snapshot.crews) {
    if (!crew.usualLeadPersonId) continue;
    leadsByPerson.set(crew.usualLeadPersonId, [...(leadsByPerson.get(crew.usualLeadPersonId) ?? []), crew.id]);
  }

  const memberFields = (member: TeamBoardMemberInput) => ({
    email: member.email?.trim() || null,
    role: member.role,
    roleLabel: memberRoleLabel(member, accessAdmin),
    access: (member.removedAt ? "removed" : "active") as TeamBoardAccess,
    work:
      accessAdmin && !member.removedAt
        ? { jobs: member.openJobLeadCount, tasks: member.openTaskAssigneeCount }
        : null,
  });

  for (const person of snapshot.people) {
    const member = person.linkedUserId ? memberByUser.get(person.linkedUserId) ?? null : null;
    if (person.linkedUserId) linkedUsers.add(person.linkedUserId);
    const entry: TeamBoardEntry = {
      key: `p:${person.id}`,
      personId: person.id,
      userId: person.linkedUserId,
      ...resolveEntryName(person.displayName, member),
      phone: person.phone,
      email: null,
      role: null,
      roleLabel: null,
      // A linked login missing from a directory-only read may have been removed; do not claim.
      access: person.linkedUserId ? (accessAdmin ? "none" : "unknown") : "none",
      work: null,
      rowVersion: person.rowVersion,
      crewIds: rosterByPerson.get(person.id) ?? [],
      leadsCrewIds: leadsByPerson.get(person.id) ?? [],
      ...(member ? memberFields(member) : {}),
    };
    entries.push(entry);
    byPerson.set(person.id, entry);
  }

  for (const member of members) {
    if (linkedUsers.has(member.userId) || member.removedAt) continue;
    entries.push({
      key: `u:${member.userId}`,
      personId: null,
      userId: member.userId,
      ...resolveEntryName(null, member),
      phone: null,
      rowVersion: null,
      crewIds: [],
      leadsCrewIds: [],
      ...memberFields(member),
    });
  }

  const crews: TeamBoardCrew[] = snapshot.crews.map((crew) => {
    const lead = crew.usualLeadPersonId ? byPerson.get(crew.usualLeadPersonId) ?? null : null;
    const memberEntries = snapshot.roster
      .filter((row) => row.crewId === crew.id && row.personId !== crew.usualLeadPersonId)
      .map((row) => byPerson.get(row.personId))
      .filter((entry): entry is TeamBoardEntry => Boolean(entry))
      .sort(byName);
    return { id: crew.id, name: crew.name, rowVersion: crew.rowVersion, lead, members: memberEntries };
  });

  const groupsByLead = new Map<string, TeamBoardGroup>();
  const leaderless: TeamBoardGroup[] = [];
  for (const crew of crews) {
    if (!crew.lead) {
      leaderless.push({ key: `c:${crew.id}`, lead: null, crews: [crew] });
      continue;
    }
    const group = groupsByLead.get(crew.lead.key) ?? { key: crew.lead.key, lead: crew.lead, crews: [] };
    group.crews.push(crew);
    groupsByLead.set(crew.lead.key, group);
  }
  const groups = [...groupsByLead.values()]
    .sort((a, b) => entryRank(a.lead) - entryRank(b.lead) || byName(a.lead!, b.lead!))
    .concat(leaderless.sort((a, b) => a.crews[0].name.localeCompare(b.crews[0].name)));
  for (const group of groups) group.crews.sort((a, b) => a.name.localeCompare(b.name));

  const placed = (entry: TeamBoardEntry) => entry.crewIds.length > 0 || entry.leadsCrewIds.length > 0;
  const office = entries
    .filter((entry) => !placed(entry) && entry.access === "active" && entry.role && OFFICE_ROLES.has(entry.role))
    .sort((a, b) => entryRank(a) - entryRank(b) || byName(a, b));
  const officeKeys = new Set(office.map((entry) => entry.key));
  const unassigned = entries.filter((entry) => !placed(entry) && !officeKeys.has(entry.key)).sort(byName);

  const invited = (input.invitations ?? []).map((invite) => {
    const role = resolveCompanyMembershipRole(invite.role);
    return {
      invitationId: invite.invitationId,
      email: invite.email,
      roleLabel: role === "invalid_role" ? "Invited" : teamAccessLabel(role, invite.packageKeys),
      expiresAt: invite.expiresAt,
      emailFailed: invite.delivery === "failed",
    };
  });

  return { groups, office, unassigned, invited, entries, crewCount: crews.length };
}

export type TeamBoardFilter = "all" | "leads" | "coordinators" | "unassigned" | "invited";

/** Office / coordination work (Owner, Office Manager, Production Coordinator, Sales). */
export function isCoordinatorEntry(entry: TeamBoardEntry | null): boolean {
  return Boolean(entry && entry.access === "active" && entry.role && OFFICE_ROLES.has(entry.role));
}

export type TeamBoardView = {
  groups: TeamBoardGroup[];
  office: TeamBoardEntry[];
  unassigned: TeamBoardEntry[];
  invited: TeamBoardInvite[];
  show: { crews: boolean; office: boolean; unassigned: boolean; invited: boolean };
  empty: boolean;
};

/**
 * What the board shows for a filter pill and a search. Leads are crew anchors whose
 * work is in the field; Coordinators are office/coordination anchors plus Office &
 * coordination. Search matches people, crews, and invitation emails; a crew matched
 * by name or by its Lead stays whole, otherwise only matching members remain.
 */
export function filterTeamBoard(
  model: TeamBoardModel,
  options: { filter: TeamBoardFilter; query: string; canSeeInvites: boolean }
): TeamBoardView {
  const q = options.query.trim().toLowerCase();
  const hit = (text: string | null | undefined) => !q || (text ?? "").toLowerCase().includes(q);
  const show = {
    crews: options.filter === "all" || options.filter === "leads" || options.filter === "coordinators",
    office: options.filter === "all" || options.filter === "coordinators",
    unassigned: options.filter === "all" || options.filter === "unassigned",
    invited: options.canSeeInvites && (options.filter === "all" || options.filter === "invited"),
  };

  const groups = !show.crews
    ? []
    : model.groups
        .filter((group) => {
          if (options.filter === "leads") return group.lead !== null && !isCoordinatorEntry(group.lead);
          if (options.filter === "coordinators") return isCoordinatorEntry(group.lead);
          return true;
        })
        .map((group) => {
          const leadHit = Boolean(q) && hit(group.lead?.name);
          const crews = group.crews
            .map((crew) => (leadHit || hit(crew.name) ? crew : { ...crew, members: crew.members.filter((m) => hit(m.name)) }))
            .filter((crew) => leadHit || hit(crew.name) || crew.members.length > 0);
          return { ...group, crews };
        })
        .filter((group) => group.crews.length > 0);
  const office = show.office ? model.office.filter((entry) => hit(entry.name)) : [];
  const unassigned = show.unassigned ? model.unassigned.filter((entry) => hit(entry.name)) : [];
  const invited = show.invited ? model.invited.filter((invite) => hit(invite.email)) : [];
  const empty = groups.length === 0 && office.length === 0 && unassigned.length === 0 && invited.length === 0;
  return { groups, office, unassigned, invited, show, empty };
}

/** People who can be added to a crew: everyone operational not already on it. */
export function crewAddCandidates(model: TeamBoardModel, crew: TeamBoardCrew): TeamBoardEntry[] {
  const onCrew = new Set(crew.members.map((m) => m.key));
  if (crew.lead) onCrew.add(crew.lead.key);
  return model.entries.filter((entry) => !onCrew.has(entry.key)).sort(byName);
}

/** People who can be a usual Crew Lead. Any active operational person is eligible. */
export function crewLeadCandidates(model: TeamBoardModel): TeamBoardEntry[] {
  return [...model.entries].sort((a, b) => entryRank(a) - entryRank(b) || byName(a, b));
}

/** Case-insensitive name search; exact matches first. Never merges or hides duplicates. */
export function searchTeamEntries(entries: readonly TeamBoardEntry[], query: string): TeamBoardEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...entries];
  return entries
    .filter((entry) => entry.name.toLowerCase().includes(q))
    .sort((a, b) => {
      const ax = a.name.toLowerCase() === q ? 0 : a.name.toLowerCase().startsWith(q) ? 1 : 2;
      const bx = b.name.toLowerCase() === q ? 0 : b.name.toLowerCase().startsWith(q) ? 1 : 2;
      return ax - bx || byName(a, b);
    });
}

export function workLabel(work: TeamBoardEntry["work"]): string | null {
  if (!work) return null;
  const parts: string[] = [];
  if (work.jobs > 0) parts.push(work.jobs === 1 ? "Coordinates 1 open job" : `Coordinates ${work.jobs} open jobs`);
  if (work.tasks > 0) parts.push(work.tasks === 1 ? "1 open task" : `${work.tasks} open tasks`);
  return parts.length ? parts.join(" · ") : null;
}

/** The board API's snapshot (already parsed server-side); rejects anything malformed. */
export function readTeamBoardSnapshot(value: unknown): TeamBoardSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<TeamBoardSnapshot>;
  if (!Array.isArray(raw.people) || !Array.isArray(raw.crews) || !Array.isArray(raw.roster)) return null;
  const okPeople = raw.people.every((p) => typeof p?.id === "string" && typeof p?.displayName === "string" && typeof p?.rowVersion === "number");
  const okCrews = raw.crews.every((c) => typeof c?.id === "string" && typeof c?.name === "string" && typeof c?.rowVersion === "number");
  const okRoster = raw.roster.every((r) => typeof r?.crewId === "string" && typeof r?.personId === "string");
  return okPeople && okCrews && okRoster ? (raw as TeamBoardSnapshot) : null;
}

export function parseTeamBoardSnapshot(value: unknown): TeamBoardSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.people) || !Array.isArray(raw.crews) || !Array.isArray(raw.crew_members)) return null;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v));
  const people: TeamBoardPersonRow[] = [];
  for (const row of raw.people as Record<string, unknown>[]) {
    const id = str(row?.id);
    const name = str(row?.display_name);
    if (!id || !name) return null;
    people.push({ id, displayName: name, phone: str(row.phone), linkedUserId: str(row.linked_user_id), rowVersion: num(row.row_version) });
  }
  const crews: TeamBoardCrewRow[] = [];
  for (const row of raw.crews as Record<string, unknown>[]) {
    const id = str(row?.id);
    const name = str(row?.name);
    if (!id || !name) return null;
    crews.push({ id, name, usualLeadPersonId: str(row.usual_lead_person_id), rowVersion: num(row.row_version) });
  }
  const roster: TeamBoardRosterRow[] = [];
  for (const row of raw.crew_members as Record<string, unknown>[]) {
    const crewId = str(row?.crew_id);
    const personId = str(row?.person_id);
    if (!crewId || !personId) return null;
    roster.push({ crewId, personId });
  }
  return { people, crews, roster };
}
