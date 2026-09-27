export type InvitationEmailSendResult =
  | { ok: true; messageId: string }
  | { ok: false; errorClass: "not_configured" | "provider_rejected" | "network" };

/**
 * Sends one invitation email. The caller must already have committed the invitation.
 * Provider bodies are not returned. The raw token is never an argument.
 */
export async function postInvitationEmail(input: {
  apiKey: string | null | undefined;
  from: string | null | undefined;
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
  fetchImpl?: typeof fetch;
}): Promise<InvitationEmailSendResult> {
  const apiKey = input.apiKey?.trim() ?? "";
  const from = input.from?.trim() ?? "";
  if (!apiKey || !from || !input.to.trim()) {
    return { ok: false, errorClass: "not_configured" };
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });
  } catch {
    return { ok: false, errorClass: "network" };
  }

  const payload = (await response.json().catch(() => null)) as { id?: unknown } | null;
  if (response.ok && typeof payload?.id === "string" && payload.id.length > 0) {
    return { ok: true, messageId: payload.id };
  }
  return { ok: false, errorClass: "provider_rejected" };
}
