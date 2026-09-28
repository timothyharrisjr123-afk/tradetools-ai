/**
 * Strong sign-in (TOTP) through Supabase Auth MFA. The database decides whether
 * a change needs it (JWT aal2, recent iat). This module only obtains that
 * session; it never grants access.
 */

type MfaFactor = { id: string; factor_type?: string; status?: string };

export type StrongSignInClient = {
  auth: {
    mfa: {
      listFactors: () => Promise<{
        data: { totp?: MfaFactor[]; all?: MfaFactor[] } | null;
        error: { message?: string } | null;
      }>;
      enroll: (params: { factorType: "totp"; friendlyName?: string; issuer?: string }) => Promise<{
        data: { id: string; totp: { qr_code: string; secret: string } } | null;
        error: { message?: string } | null;
      }>;
      unenroll: (params: { factorId: string }) => Promise<{ error: { message?: string } | null }>;
      challengeAndVerify: (params: { factorId: string; code: string }) => Promise<{
        error: { message?: string; code?: string } | null;
      }>;
    };
  };
};

export type StrongSignInStart =
  | { kind: "verify"; factorId: string }
  | { kind: "enroll"; factorId: string; qrCode: string; secret: string }
  | { kind: "unavailable" };

export const STRONG_SIGN_IN_CODE_PATTERN = /^\d{6}$/;

/** A verified authenticator is challenged; otherwise stale unverified ones are cleared and one is enrolled. */
export async function startStrongSignIn(client: StrongSignInClient): Promise<StrongSignInStart> {
  const listed = await client.auth.mfa.listFactors();
  if (listed.error || !listed.data) return { kind: "unavailable" };
  const all = listed.data.all ?? listed.data.totp ?? [];
  const totp = all.filter((factor) => (factor.factor_type ?? "totp") === "totp");
  const verified = totp.find((factor) => factor.status === "verified");
  if (verified) return { kind: "verify", factorId: verified.id };
  for (const factor of totp) {
    if (factor.status !== "verified") await client.auth.mfa.unenroll({ factorId: factor.id });
  }
  const enrolled = await client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "FieldDive",
    issuer: "FieldDive",
  });
  if (enrolled.error || !enrolled.data) return { kind: "unavailable" };
  return {
    kind: "enroll",
    factorId: enrolled.data.id,
    qrCode: enrolled.data.totp.qr_code,
    secret: enrolled.data.totp.secret,
  };
}

export async function confirmStrongSignIn(
  client: StrongSignInClient,
  factorId: string,
  code: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const trimmed = code.replace(/\s+/g, "");
  if (!STRONG_SIGN_IN_CODE_PATTERN.test(trimmed)) {
    return { ok: false, message: "Enter the 6-digit code from your authenticator app." };
  }
  const verified = await client.auth.mfa.challengeAndVerify({ factorId, code: trimmed });
  if (verified.error) {
    return { ok: false, message: "That code didn\u2019t work. Check your authenticator app and try again." };
  }
  return { ok: true };
}
