import "server-only";

import { resolvePublicAppOrigin } from "@/app/lib/publicAppOrigin";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { createClient } from "@/app/lib/supabase/server";
import { postInvitationEmail, type InvitationEmailSendResult } from "@/app/lib/invitations/invitationDelivery";
import {
  buildInvitationEmail,
  INVITATION_NOT_SENT_MESSAGE,
  parseInvitationPreview,
  type InvitationPreview,
} from "@/app/lib/invitations/invitationModel";
import {
  decodeInvitationToken,
  encodeInvitationToken,
  generateInvitationToken,
  hashInvitationToken,
} from "@/app/lib/invitations/invitationToken";

type RpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message?: string } | null }>;
};

export type InvitationCommandResult =
  | {
      ok: true;
      invitationId: string;
      delivery: "sent" | "failed" | "skipped";
      message: string | null;
      generation?: number | null;
      expiresAt?: string | null;
      personId?: string | null;
    }
  | { ok: false; code: string; unavailable: boolean };

export type PendingCompanyInvitation = {
  invitationId: string;
  /** The Person this invitation gives access to; null only for legacy invitations. */
  personId: string | null;
  email: string;
  role: string;
  expiresAt: string;
  generation: number;
  packageKeys: string[];
  assignedJobCount: number;
  delivery: "sent" | "failed" | "unknown";
};

export type InvitationAcceptResult = {
  ok: boolean;
  code: string;
  companyLabel: string | null;
};

const NOT_FOUND_PREVIEW: InvitationPreview = {
  state: "not_found",
  companyLabel: null,
  role: null,
  expiresAt: null,
  inviterDisplayName: null,
  recipientEmail: null,
  hasAdditionalAccess: false,
  packageKeys: [],
  acceptedBySelf: false,
};

const UNAVAILABLE_PREVIEW: InvitationPreview = {
  ...NOT_FOUND_PREVIEW,
  state: "unavailable",
};

async function client(): Promise<RpcClient> {
  return (await createClient()) as unknown as RpcClient;
}

function row(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null;
  return data as Record<string, unknown>;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

async function deliverInvitation(input: {
  supabase: RpcClient;
  invitationId: string;
  generation: number;
  kind: "issue" | "resend";
  idempotencyKey: string;
  to: string;
  companyLabel: string;
  role: string | null;
  packageKeys: string[];
  expiresAt: string | null;
  encodedToken: string;
}): Promise<InvitationCommandResult> {
  let sendResult: InvitationEmailSendResult = { ok: false, errorClass: "not_configured" };
  try {
    const origin = resolvePublicAppOrigin();
    const email = buildInvitationEmail({
      companyLabel: input.companyLabel,
      role: input.role,
      packageKeys: input.packageKeys,
      expiresAt: input.expiresAt,
      joinUrl: `${origin}/join/${input.encodedToken}`,
    });
    sendResult = await postInvitationEmail({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.RESEND_FROM,
      to: input.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
      idempotencyKey: input.idempotencyKey,
    });
  } catch {
    sendResult = { ok: false, errorClass: "not_configured" };
  }

  await input.supabase.rpc("record_company_invitation_delivery_v1", {
    p_invitation_id: input.invitationId,
    p_generation: input.generation,
    p_kind: input.kind,
    p_idempotency_key: input.idempotencyKey,
    p_status: sendResult.ok ? "sent" : "failed",
    p_error_class: sendResult.ok ? null : sendResult.errorClass,
    p_provider_message_id: sendResult.ok ? sendResult.messageId : null,
  });

  if (!sendResult.ok) {
    return {
      ok: true,
      invitationId: input.invitationId,
      delivery: "failed",
      message: INVITATION_NOT_SENT_MESSAGE,
      generation: input.generation,
      expiresAt: input.expiresAt,
    };
  }
  return {
    ok: true,
    invitationId: input.invitationId,
    delivery: "sent",
    message: null,
    generation: input.generation,
    expiresAt: input.expiresAt,
  };
}

/**
 * Every new invitation names its Person: an existing one (personId) or a new one
 * created with the invitation (personName). Exactly one is required.
 */
export async function issueCompanyInvitation(input: {
  email: string;
  role: string;
  packages: string[];
  jobIds: string[];
  idempotencyKey: string;
  person: { personId: string } | { personName: string };
}): Promise<InvitationCommandResult> {
  const token = generateInvitationToken();
  const supabase = await client();
  const { data, error } = await supabase.rpc("issue_company_invitation_v2", {
    p_email: input.email,
    p_role: input.role,
    p_packages: input.packages,
    p_job_ids: input.jobIds,
    p_token_hash: hashInvitationToken(token),
    p_idempotency_key: input.idempotencyKey,
    p_person_id: "personId" in input.person ? input.person.personId : null,
    p_person_name: "personName" in input.person ? input.person.personName : null,
  });
  if (error) return { ok: false, code: "authorization_unavailable", unavailable: true };
  const result = row(data);
  if (!result) return { ok: false, code: "authorization_unavailable", unavailable: true };
  if (result.ok !== true) {
    return {
      ok: false,
      code: typeof result.code === "string" ? result.code : "authorization_unavailable",
      unavailable: false,
    };
  }
  const invitationId = typeof result.invitation_id === "string" ? result.invitation_id : "";
  const personId = typeof result.person_id === "string" ? result.person_id : null;
  if (!invitationId || !personId) return { ok: false, code: "authorization_unavailable", unavailable: true };
  if (result.send !== true) {
    return {
      ok: true,
      invitationId,
      delivery: "skipped",
      message: null,
      generation: typeof result.generation === "number" ? result.generation : null,
      expiresAt: typeof result.expires_at === "string" ? result.expires_at : null,
      personId,
    };
  }
  const delivered = await deliverInvitation({
    supabase,
    invitationId,
    generation: typeof result.generation === "number" ? result.generation : 1,
    kind: "issue",
    idempotencyKey: input.idempotencyKey,
    to: typeof result.email_canonical === "string" ? result.email_canonical : "",
    companyLabel: typeof result.company_label === "string" ? result.company_label : "",
    role: typeof result.role === "string" ? result.role : null,
    packageKeys: stringArray(result.packages),
    expiresAt: typeof result.expires_at === "string" ? result.expires_at : null,
    encodedToken: encodeInvitationToken(token),
  });
  return delivered.ok ? { ...delivered, personId } : delivered;
}

export async function resendCompanyInvitation(input: {
  invitationId: string;
  expectedGeneration: number;
  idempotencyKey: string;
}): Promise<InvitationCommandResult> {
  const token = generateInvitationToken();
  const supabase = await client();
  const { data, error } = await supabase.rpc("resend_company_invitation_v1", {
    p_invitation_id: input.invitationId,
    p_token_hash: hashInvitationToken(token),
    p_expected_generation: input.expectedGeneration,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) return { ok: false, code: "authorization_unavailable", unavailable: true };
  const result = row(data);
  if (!result) return { ok: false, code: "authorization_unavailable", unavailable: true };
  if (result.ok !== true) {
    return {
      ok: false,
      code: typeof result.code === "string" ? result.code : "authorization_unavailable",
      unavailable: false,
    };
  }
  const invitationId = typeof result.invitation_id === "string" ? result.invitation_id : input.invitationId;
  if (result.send !== true) {
    return {
      ok: true,
      invitationId,
      delivery: "skipped",
      message: null,
      generation: typeof result.generation === "number" ? result.generation : null,
      expiresAt: typeof result.expires_at === "string" ? result.expires_at : null,
    };
  }
  return deliverInvitation({
    supabase,
    invitationId,
    generation: typeof result.generation === "number" ? result.generation : input.expectedGeneration + 1,
    kind: "resend",
    idempotencyKey: input.idempotencyKey,
    to: typeof result.email_canonical === "string" ? result.email_canonical : "",
    companyLabel: typeof result.company_label === "string" ? result.company_label : "",
    role: typeof result.role === "string" ? result.role : null,
    packageKeys: stringArray(result.packages),
    expiresAt: typeof result.expires_at === "string" ? result.expires_at : null,
    encodedToken: encodeInvitationToken(token),
  });
}

export async function revokeCompanyInvitation(invitationId: string): Promise<InvitationCommandResult> {
  const supabase = await client();
  const { data, error } = await supabase.rpc("revoke_company_invitation_v1", {
    p_invitation_id: invitationId,
  });
  if (error) return { ok: false, code: "authorization_unavailable", unavailable: true };
  const result = row(data);
  if (!result) return { ok: false, code: "authorization_unavailable", unavailable: true };
  if (result.ok !== true) {
    return {
      ok: false,
      code: typeof result.code === "string" ? result.code : "authorization_unavailable",
      unavailable: false,
    };
  }
  return {
    ok: true,
    invitationId,
    delivery: "skipped",
    message: null,
  };
}

async function acceptWith(
  fn: "accept_company_invitation_v1" | "accept_my_company_invitation_v1",
  args: Record<string, unknown>
): Promise<InvitationAcceptResult> {
  const supabase = await client();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, code: "authorization_unavailable", companyLabel: null };
  const result = row(data);
  if (!result) return { ok: false, code: "authorization_unavailable", companyLabel: null };
  const companyLabel = typeof result.company_label === "string" ? result.company_label : null;
  if (result.ok === true && typeof result.outcome === "string") {
    return { ok: true, code: result.outcome, companyLabel };
  }
  return {
    ok: false,
    code: typeof result.code === "string" ? result.code : "authorization_unavailable",
    companyLabel: null,
  };
}

export async function acceptInvitationToken(
  token: string,
  requestId: string | null
): Promise<InvitationAcceptResult> {
  const raw = decodeInvitationToken(token);
  if (!raw) return { ok: false, code: "not_found", companyLabel: null };
  return acceptWith("accept_company_invitation_v1", {
    p_token_hash: hashInvitationToken(raw),
    p_request_id: requestId,
  });
}

export async function acceptMyInvitation(
  invitationId: string,
  requestId: string | null
): Promise<InvitationAcceptResult> {
  return acceptWith("accept_my_company_invitation_v1", {
    p_invitation_id: invitationId,
    p_request_id: requestId,
  });
}

export async function previewInvitationToken(token: string): Promise<InvitationPreview> {
  const raw = decodeInvitationToken(token);
  if (!raw) return NOT_FOUND_PREVIEW;
  const supabase = await client();
  const { data, error } = await supabase.rpc("preview_company_invitation_v1", {
    p_token_hash: hashInvitationToken(raw),
  });
  if (error) return UNAVAILABLE_PREVIEW;
  return parseInvitationPreview(data);
}

export async function previewMyInvitation(invitationId: string): Promise<InvitationPreview> {
  const supabase = await client();
  const { data, error } = await supabase.rpc("preview_my_company_invitation_v1", {
    p_invitation_id: invitationId,
  });
  if (error) return UNAVAILABLE_PREVIEW;
  return parseInvitationPreview(data);
}

/**
 * Pending invitations for the session company. There is no client grant and no
 * list RPC. The caller must already have proven team.manage and must pass the
 * company id from the live membership, never from the request. The read uses
 * the service role only after that check, and it never returns token hashes,
 * delivery error classes, or provider ids.
 */
export async function listPendingCompanyInvitations(
  companyId: string
): Promise<{ ok: true; invitations: PendingCompanyInvitation[] } | { ok: false; unavailable: true }> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(companyId)) {
    return { ok: false, unavailable: true };
  }
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, unavailable: true };
  }
  const listed = await admin
    .from("company_invitations")
    .select("id, person_id, email_canonical, role, expires_at, generation, packages, job_ids")
    .eq("company_id", companyId)
    .eq("status", "pending");
  if (listed.error || !Array.isArray(listed.data)) return { ok: false, unavailable: true };

  const ids = listed.data
    .map((row) => (row && typeof row.id === "string" ? row.id : ""))
    .filter((id) => id.length > 0);
  const latestDelivery = new Map<string, "sent" | "failed">();
  if (ids.length > 0) {
    const attempts = await admin
      .from("company_invitation_delivery_attempts")
      .select("invitation_id, status, recorded_at")
      .eq("company_id", companyId)
      .in("invitation_id", ids);
    if (attempts.error || !Array.isArray(attempts.data)) return { ok: false, unavailable: true };
    const ordered = [...attempts.data].sort((a, b) => {
      const left = typeof a.recorded_at === "string" ? a.recorded_at : "";
      const right = typeof b.recorded_at === "string" ? b.recorded_at : "";
      return right.localeCompare(left);
    });
    for (const attempt of ordered) {
      const invitationId = typeof attempt.invitation_id === "string" ? attempt.invitation_id : "";
      if (!invitationId || latestDelivery.has(invitationId)) continue;
      if (attempt.status === "sent" || attempt.status === "failed") {
        latestDelivery.set(invitationId, attempt.status);
      }
    }
  }

  const invitations: PendingCompanyInvitation[] = [];
  for (const raw of listed.data) {
    const row = raw as Record<string, unknown>;
    const invitationId = typeof row.id === "string" ? row.id : "";
    const email = typeof row.email_canonical === "string" ? row.email_canonical : "";
    const role = typeof row.role === "string" ? row.role : "";
    const expiresAt = typeof row.expires_at === "string" ? row.expires_at : "";
    const generation = typeof row.generation === "number" ? row.generation : NaN;
    if (!invitationId || !email || !role || !expiresAt || !Number.isInteger(generation) || generation < 1) {
      return { ok: false, unavailable: true };
    }
    if (!Array.isArray(row.packages) || row.packages.some((item) => typeof item !== "string")) {
      return { ok: false, unavailable: true };
    }
    const jobIds = Array.isArray(row.job_ids) ? row.job_ids : null;
    if (!jobIds || jobIds.some((item) => typeof item !== "string")) {
      return { ok: false, unavailable: true };
    }
    if (row.person_id !== null && typeof row.person_id !== "string") {
      return { ok: false, unavailable: true };
    }
    invitations.push({
      invitationId,
      personId: row.person_id,
      email,
      role,
      expiresAt,
      generation,
      packageKeys: row.packages.filter((item): item is string => typeof item === "string"),
      assignedJobCount: jobIds.length,
      delivery: latestDelivery.get(invitationId) ?? "unknown",
    });
  }
  return { ok: true, invitations };
}
