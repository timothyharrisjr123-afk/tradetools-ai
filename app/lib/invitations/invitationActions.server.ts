import "server-only";

import { resolvePublicAppOrigin } from "@/app/lib/publicAppOrigin";
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
    }
  | { ok: false; code: string; unavailable: boolean };

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
    };
  }
  return { ok: true, invitationId: input.invitationId, delivery: "sent", message: null };
}

export async function issueCompanyInvitation(input: {
  email: string;
  role: string;
  packages: string[];
  jobIds: string[];
  idempotencyKey: string;
}): Promise<InvitationCommandResult> {
  const token = generateInvitationToken();
  const supabase = await client();
  const { data, error } = await supabase.rpc("issue_company_invitation_v1", {
    p_email: input.email,
    p_role: input.role,
    p_packages: input.packages,
    p_job_ids: input.jobIds,
    p_token_hash: hashInvitationToken(token),
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
  const invitationId = typeof result.invitation_id === "string" ? result.invitation_id : "";
  if (!invitationId) return { ok: false, code: "authorization_unavailable", unavailable: true };
  if (result.send !== true) {
    return { ok: true, invitationId, delivery: "skipped", message: null };
  }
  return deliverInvitation({
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
    return { ok: true, invitationId, delivery: "skipped", message: null };
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
