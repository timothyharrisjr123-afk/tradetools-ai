import type { SupabaseClient } from "@supabase/supabase-js";

/** Database resolver. Identity is auth.uid(); there are no arguments. */
export const RESOLVE_CURRENT_USER_ACCESS_RPC_V1 = "resolve_current_user_access_v1";

/** Explicit create-business authority. Not called from page loads. */
export const BOOTSTRAP_COMPANY_RPC_V2 = "bootstrap_current_user_company_v2";

export const ACCESS_STATES = [
  "active",
  "disabled",
  "invalid_role",
  "pending_invitation",
  "creator_eligible",
  "no_access",
  "authorization_unavailable",
] as const;

export type AccessState = (typeof ACCESS_STATES)[number];

export type PendingInvitationSummary = {
  id: string;
  companyLabel: string;
  role: string;
  expiresAt: string;
};

export type ResolvedAccess = {
  state: AccessState;
  companyId: string | null;
  companyLabel: string | null;
  role: string | null;
  invitations: PendingInvitationSummary[];
  /** True only on pending_invitation, when a live creator admission also exists. */
  creatorEligible: boolean;
};

const UNAVAILABLE: ResolvedAccess = {
  state: "authorization_unavailable",
  companyId: null,
  companyLabel: null,
  role: null,
  invitations: [],
  creatorEligible: false,
};

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function parseInvitations(value: unknown): PendingInvitationSummary[] | null {
  if (!Array.isArray(value)) return null;
  const invitations: PendingInvitationSummary[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    const id = textOrNull(row.id);
    const role = textOrNull(row.role);
    const expiresAt = textOrNull(row.expires_at);
    if (!id || !role || !expiresAt) return null;
    invitations.push({
      id,
      companyLabel: textOrNull(row.company_label) ?? "Company",
      role,
      expiresAt,
    });
  }
  return invitations;
}

/**
 * Maps the resolver payload. A missing payload, an unknown state, or ok:false
 * is authorization_unavailable — never no_access, creator_eligible, or empty.
 */
export function parseAccessResolution(data: unknown): ResolvedAccess {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return UNAVAILABLE;
  const record = row as Record<string, unknown>;
  if (record.ok !== true) return UNAVAILABLE;
  const state = record.state;
  if (typeof state !== "string" || !(ACCESS_STATES as readonly string[]).includes(state)) {
    return UNAVAILABLE;
  }
  if (state === "authorization_unavailable") return UNAVAILABLE;

  const companyId = textOrNull(record.company_id);
  const companyLabel = textOrNull(record.company_label);
  const role = textOrNull(record.role);

  if (state === "active") {
    if (!companyId || !role) return UNAVAILABLE;
    return {
      state,
      companyId,
      companyLabel,
      role,
      invitations: [],
      creatorEligible: false,
    };
  }

  if (state === "pending_invitation") {
    const invitations = parseInvitations(record.invitations);
    if (!invitations || invitations.length === 0) return UNAVAILABLE;
    return {
      state,
      companyId: null,
      companyLabel: null,
      role: null,
      invitations,
      creatorEligible: record.creator_eligible === true,
    };
  }

  return {
    state: state as AccessState,
    companyId: null,
    companyLabel,
    role: null,
    invitations: [],
    creatorEligible: false,
  };
}

export async function resolveCurrentUserAccess(
  supabase: SupabaseClient
): Promise<ResolvedAccess> {
  const { data, error } = await supabase.rpc(RESOLVE_CURRENT_USER_ACCESS_RPC_V1);
  if (error) return UNAVAILABLE;
  return parseAccessResolution(data);
}

export type CreateBusinessResult =
  | { ok: true; status: "created" | "existing"; companyId: string }
  | {
      ok: false;
      status:
        | "removed"
        | "invalid_role"
        | "pending_invitation"
        | "admission_required"
        | "invalid_intent"
        | "invalid_payload"
        | "invalid_response";
    };

const DENIALS = [
  "removed",
  "invalid_role",
  "pending_invitation",
  "admission_required",
  "invalid_intent",
  "invalid_payload",
] as const;

/** Fail closed. created/existing require a company id; every other known status is a denial. */
export function parseCreateBusinessResult(data: unknown): CreateBusinessResult {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return { ok: false, status: "invalid_response" };
  const status = (row as { status?: unknown }).status;
  const companyId = (row as { company_id?: unknown }).company_id;
  if ((status === "created" || status === "existing") && typeof companyId === "string" && companyId) {
    return { ok: true, status, companyId };
  }
  if (typeof status === "string" && (DENIALS as readonly string[]).includes(status)) {
    return { ok: false, status: status as (typeof DENIALS)[number] };
  }
  return { ok: false, status: "invalid_response" };
}

export async function createBusiness(
  supabase: SupabaseClient,
  input: { companyName?: string | null; acknowledgePendingInvitations?: boolean }
): Promise<{ result: CreateBusinessResult; unavailable: boolean }> {
  const { data, error } = await supabase.rpc(BOOTSTRAP_COMPANY_RPC_V2, {
    p_intent: "create_business",
    p_company_name: input.companyName ?? null,
    p_acknowledge_pending_invitations: input.acknowledgePendingInvitations === true,
  });
  if (error) return { result: { ok: false, status: "invalid_response" }, unavailable: true };
  return { result: parseCreateBusinessResult(data), unavailable: false };
}
