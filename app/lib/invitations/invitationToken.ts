import { createHash, randomBytes } from "node:crypto";

/** 32-byte invitation token. The raw value is only for the email link. */
export function generateInvitationToken(): Buffer {
  return randomBytes(32);
}

/** SHA-256 of the raw token bytes. This is the only form stored or sent to the database. */
export function hashInvitationToken(token: Buffer): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Base64url, no padding. 32 bytes encode to 43 characters. */
export function encodeInvitationToken(token: Buffer): string {
  return token.toString("base64url");
}

export function decodeInvitationToken(encoded: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]{43}$/.test(encoded)) return null;
  const token = Buffer.from(encoded, "base64url");
  if (token.length !== 32) return null;
  return token;
}
