/**
 * Team Board persistence: people, crews, and crew rosters through the
 * SECURITY DEFINER RPCs (company-scope jobs.assign). The database decides every
 * permission; this module only validates shape and maps result codes.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { parseTeamBoardSnapshot, type TeamBoardSnapshot } from "@/app/lib/team/teamBoardModel";
import { isUuidLike } from "@/app/lib/uuid";

export class TeamBoardHttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string
  ) {
    super(message ?? TEAM_BOARD_MESSAGES[code] ?? "Something went wrong. Try again.");
  }
}

export const TEAM_BOARD_MESSAGES: Record<string, string> = {
  unauthorized: "Sign in to continue.",
  capability_denied: "Crews are managed by the people who run production.",
  invalid_payload: "Check the details and try again.",
  not_found: "That crew or person is no longer available. Refresh and try again.",
  person_not_found: "That person is no longer available. Refresh and try again.",
  lead_ineligible: "That person can't lead this crew.",
  crew_name_taken: "Another crew already has that name.",
  stale_revision: "This changed since you opened it. Refresh and try again.",
  linked_login_active: "This person still has FieldDive access. Remove their access first.",
  person_active_assignment_lead:
    "This person is the Assignment Lead on a current crew assignment. Change or clear the Assignment Lead, or end that assignment, first.",
  crew_actively_assigned: "This crew is currently assigned to a job. Replace or end that assignment first.",
  team_board_unavailable: "Crews are unavailable right now.",
};

const STATUS: Record<string, number> = {
  unauthorized: 401,
  capability_denied: 403,
  invalid_payload: 400,
  not_found: 404,
  person_not_found: 404,
  lead_ineligible: 409,
  crew_name_taken: 409,
  stale_revision: 409,
  linked_login_active: 409,
  person_active_assignment_lead: 409,
  crew_actively_assigned: 409,
};

type RpcResult = { ok?: boolean; code?: string; [key: string]: unknown };

async function callRpc(supabase: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<RpcResult> {
  let data: unknown;
  let error: { code?: string } | null = null;
  try {
    const result = await supabase.rpc(fn, args);
    data = result.data;
    error = result.error as { code?: string } | null;
  } catch {
    throw new TeamBoardHttpError(503, "team_board_unavailable");
  }
  if (error || !data || typeof data !== "object") {
    throw new TeamBoardHttpError(503, "team_board_unavailable");
  }
  const body = data as RpcResult;
  if (body.ok !== true) {
    const code = typeof body.code === "string" ? body.code : "team_board_unavailable";
    throw new TeamBoardHttpError(STATUS[code] ?? 503, code);
  }
  return body;
}

export async function loadTeamBoard(supabase: SupabaseClient): Promise<TeamBoardSnapshot> {
  const body = await callRpc(supabase, "get_team_board_v1", {});
  const snapshot = parseTeamBoardSnapshot(body);
  if (!snapshot) throw new TeamBoardHttpError(503, "team_board_unavailable");
  return snapshot;
}

const text = (value: unknown, max: number): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= max ? trimmed : null;
};
const optionalText = (value: unknown, max: number): string | null | undefined => {
  if (value == null || (typeof value === "string" && !value.trim())) return null;
  return text(value, max) ?? undefined;
};
const uuid = (value: unknown): string | null => (typeof value === "string" && isUuidLike(value) ? value : null);
const version = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) && value >= 1 ? value : null;
const invalid = () => new TeamBoardHttpError(400, "invalid_payload");

/**
 * A person reference from the client: an operational person id, or a company login
 * whose operational person is created on first use. Never a name match.
 */
async function resolvePersonRef(supabase: SupabaseClient, ref: unknown): Promise<string> {
  const raw = (ref ?? {}) as Record<string, unknown>;
  const personId = uuid(raw.personId);
  if (personId) return personId;
  const userId = uuid(raw.userId);
  if (!userId) throw invalid();
  const body = await callRpc(supabase, "ensure_member_person_v1", { p_user_id: userId });
  const id = uuid(body.person_id);
  if (!id) throw new TeamBoardHttpError(503, "team_board_unavailable");
  return id;
}

export async function runTeamBoardAction(supabase: SupabaseClient, body: Record<string, unknown>) {
  const action = body.action;
  const requestId = optionalText(body.requestId, 120);
  if (requestId === undefined) throw invalid();

  if (action === "create_person") {
    const name = text(body.name, 80);
    const phone = optionalText(body.phone, 40);
    if (!name || phone === undefined) throw invalid();
    const result = await callRpc(supabase, "create_company_person_v1", {
      p_display_name: name,
      p_phone: phone,
      p_request_id: requestId,
    });
    return { personId: result.person_id };
  }

  if (action === "update_person") {
    const personId = uuid(body.personId);
    const expected = version(body.expectedRowVersion);
    const name = text(body.name, 80);
    const phone = optionalText(body.phone, 40);
    if (!personId || !expected || !name || phone === undefined) throw invalid();
    const result = await callRpc(supabase, "update_company_person_v1", {
      p_person_id: personId,
      p_expected_row_version: expected,
      p_display_name: name,
      p_phone: phone,
    });
    return { rowVersion: result.row_version };
  }

  if (action === "archive_person") {
    const personId = uuid(body.personId);
    const expected = version(body.expectedRowVersion);
    if (!personId || !expected) throw invalid();
    await callRpc(supabase, "archive_company_person_v1", { p_person_id: personId, p_expected_row_version: expected });
    return {};
  }

  if (action === "create_crew") {
    const name = text(body.name, 80);
    if (!name) throw invalid();
    const leadId = body.lead ? await resolvePersonRef(supabase, body.lead) : null;
    const result = await callRpc(supabase, "create_crew_v1", {
      p_name: name,
      p_usual_lead_person_id: leadId,
      p_request_id: requestId,
    });
    return { crewId: result.crew_id };
  }

  if (action === "update_crew") {
    const crewId = uuid(body.crewId);
    const expected = version(body.expectedRowVersion);
    const name = body.name === undefined ? null : text(body.name, 80);
    if (!crewId || !expected || (body.name !== undefined && !name)) throw invalid();
    const setLead = Object.prototype.hasOwnProperty.call(body, "lead");
    const leadId = setLead && body.lead ? await resolvePersonRef(supabase, body.lead) : null;
    const result = await callRpc(supabase, "update_crew_v1", {
      p_crew_id: crewId,
      p_expected_row_version: expected,
      p_name: name,
      p_set_lead: setLead,
      p_usual_lead_person_id: leadId,
    });
    return { rowVersion: result.row_version };
  }

  if (action === "archive_crew") {
    const crewId = uuid(body.crewId);
    const expected = version(body.expectedRowVersion);
    if (!crewId || !expected) throw invalid();
    await callRpc(supabase, "archive_crew_v1", { p_crew_id: crewId, p_expected_row_version: expected });
    return {};
  }

  if (action === "add_member") {
    const crewId = uuid(body.crewId);
    if (!crewId) throw invalid();
    let personId: string;
    const newName = body.newPerson ? text((body.newPerson as Record<string, unknown>).name, 80) : null;
    if (body.newPerson) {
      if (!newName) throw invalid();
      const created = await callRpc(supabase, "create_company_person_v1", {
        p_display_name: newName,
        p_phone: null,
        p_request_id: requestId,
      });
      personId = String(created.person_id);
    } else {
      personId = await resolvePersonRef(supabase, body.person);
    }
    const result = await callRpc(supabase, "add_crew_member_v1", { p_crew_id: crewId, p_person_id: personId });
    return { personId, changed: result.changed === true };
  }

  if (action === "remove_member") {
    const crewId = uuid(body.crewId);
    const personId = uuid(body.personId);
    if (!crewId || !personId) throw invalid();
    await callRpc(supabase, "remove_crew_member_v1", { p_crew_id: crewId, p_person_id: personId });
    return {};
  }

  throw invalid();
}
