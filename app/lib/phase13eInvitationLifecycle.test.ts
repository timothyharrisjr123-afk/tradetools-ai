import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import { postInvitationEmail } from "./invitations/invitationDelivery";
import {
  buildInvitationEmail,
  buildInvitationJoinView,
  parseInvitationPreview,
  plainAccessSummary,
  type InvitationPreview,
} from "./invitations/invitationModel";
import {
  decodeInvitationToken,
  encodeInvitationToken,
  generateInvitationToken,
  hashInvitationToken,
} from "./invitations/invitationToken";

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const SQL = read("supabase/migrations/20260927210000_phase13b_e_invitation_lifecycle.sql");

function sliceBetween(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, start);
  return source.slice(from, to);
}

const pendingPreview = (overrides: Partial<InvitationPreview> = {}): InvitationPreview => ({
  state: "pending",
  companyLabel: "North Roofing",
  role: "office_sales",
  expiresAt: "2026-10-04T12:00:00.000Z",
  inviterDisplayName: "Alex",
  recipientEmail: "person@example.invalid",
  hasAdditionalAccess: true,
  packageKeys: ["request_payments"],
  acceptedBySelf: false,
  ...overrides,
});

describe("Phase 13B-E invitation token", () => {
  test("the token is 32 bytes, the stored value is its sha256, and the link encoding round-trips", () => {
    const token = generateInvitationToken();
    assert.equal(token.length, 32);
    const hash = hashInvitationToken(token);
    assert.equal(hash, createHash("sha256").update(token).digest("hex"));
    assert.equal(hash.length, 64);
    assert.notEqual(hash, createHash("sha256").update(Buffer.from(encodeInvitationToken(token))).digest("hex"));
    const encoded = encodeInvitationToken(token);
    assert.equal(encoded.length, 43);
    assert.equal(decodeInvitationToken(encoded)?.equals(token), true);
    assert.equal(decodeInvitationToken("short"), null);
    assert.equal(decodeInvitationToken(`${encoded}==`), null);
  });
});

describe("Phase 13B-E invitation copy", () => {
  test("the email uses plain language and does not carry provider or permission terms", () => {
    const email = buildInvitationEmail({
      companyLabel: "North Roofing",
      role: "office_sales",
      packageKeys: ["request_payments", "view_company_financials", "not_a_package"],
      expiresAt: "2026-10-04T12:00:00.000Z",
      joinUrl: "https://fielddive.test/join/example-token",
    });
    assert.match(email.subject, /North Roofing/);
    assert.match(email.text, /Sales/);
    assert.match(email.text, /Request payments/);
    assert.match(email.text, /Expires 2026-10-04/);
    assert.match(email.text, /https:\/\/fielddive\.test\/join\/example-token/);
    assert.doesNotMatch(`${email.subject}\n${email.text}\n${email.html}`, /request_payments|view_company_financials|team\.manage|resend|webhook/i);
    assert.equal(plainAccessSummary(["not_a_package"], true), "Includes additional approved access.");
  });

  test("join states stay distinct and a page view does not accept", () => {
    const signedOut = buildInvitationJoinView({
      preview: pendingPreview(),
      viewer: { signedIn: false, email: null, emailVerified: false },
      outcome: null,
      token: "tok",
      invitationId: null,
      returnPath: "/join/tok",
    });
    assert.equal(signedOut.showAccept, false);
    assert.match(signedOut.signInHref ?? "", /redirectTo=/);
    assert.match(signedOut.signUpHref ?? "", /redirectTo=/);
    assert.equal(signedOut.companyLabel, "North Roofing");
    assert.equal(signedOut.roleLabel, "Sales");
    assert.equal(signedOut.accessSummary, "Includes additional approved access.");

    const ready = buildInvitationJoinView({
      preview: pendingPreview(),
      viewer: { signedIn: true, email: "person@example.invalid", emailVerified: true },
      outcome: null,
      token: "tok",
      invitationId: null,
      returnPath: "/join/tok",
    });
    assert.equal(ready.showAccept, true);
    assert.equal(ready.acceptToken, "tok");
    assert.equal(ready.accessSummary, "Request payments");

    const wrong = buildInvitationJoinView({
      preview: pendingPreview(),
      viewer: { signedIn: true, email: "other@example.invalid", emailVerified: true },
      outcome: null,
      token: "tok",
      invitationId: null,
      returnPath: "/join/tok",
    });
    assert.equal(wrong.showAccept, false);
    assert.match(wrong.switchAccountHref ?? "", /redirectTo=/);
    assert.match(wrong.body, /person@example.invalid/);
    assert.doesNotMatch(wrong.accessSummary ?? "", /request_payments|Request payments/);

    const unverified = buildInvitationJoinView({
      preview: pendingPreview(),
      viewer: { signedIn: true, email: "person@example.invalid", emailVerified: false },
      outcome: null,
      token: "tok",
      invitationId: null,
      returnPath: "/join/tok",
    });
    assert.equal(unverified.showAccept, false);
    assert.match(unverified.heading, /Confirm your email/);

    for (const [state, heading] of [
      ["expired", "expired"],
      ["revoked", "revoked"],
    ] as const) {
      const view = buildInvitationJoinView({
        preview: pendingPreview({ state }),
        viewer: { signedIn: true, email: "person@example.invalid", emailVerified: true },
        outcome: null,
        token: "tok",
        invitationId: null,
        returnPath: "/join/tok",
      });
      assert.equal(view.showAccept, false);
      assert.match(view.heading.toLowerCase(), new RegExp(heading));
    }

    const conflict = buildInvitationJoinView({
      preview: pendingPreview(),
      viewer: { signedIn: true, email: "person@example.invalid", emailVerified: true },
      outcome: "membership_conflict",
      token: "tok",
      invitationId: null,
      returnPath: "/join/tok",
    });
    assert.equal(conflict.showAccept, false);
    assert.match(conflict.body, /one company/);
    assert.equal(conflict.continueHref, null);

    const disabled = buildInvitationJoinView({
      preview: pendingPreview({ state: "accepted", acceptedBySelf: true, recipientEmail: null, packageKeys: [] }),
      viewer: { signedIn: true, email: "person@example.invalid", emailVerified: true },
      outcome: "accepted_disabled",
      token: "tok",
      invitationId: null,
      returnPath: "/join/tok",
    });
    assert.match(disabled.body, /will not restore/);
    assert.equal(disabled.continueHref, null);

    const unavailable = buildInvitationJoinView({
      preview: parseInvitationPreview(null),
      viewer: { signedIn: true, email: "person@example.invalid", emailVerified: true },
      outcome: null,
      token: "tok",
      invitationId: null,
      returnPath: "/join/tok",
    });
    assert.equal(unavailable.companyLabel, null);
    assert.match(unavailable.heading, /couldn't verify/);

    const missing = buildInvitationJoinView({
      preview: pendingPreview({ state: "not_found", companyLabel: "Hidden", role: "owner", packageKeys: ["request_payments"] }),
      viewer: { signedIn: false, email: null, emailVerified: false },
      outcome: null,
      token: null,
      invitationId: null,
      returnPath: "/join/tok",
    });
    assert.equal(missing.companyLabel, null);
    assert.equal(missing.roleLabel, null);
    assert.equal(missing.showAccept, false);

    const joined = buildInvitationJoinView({
      preview: pendingPreview({ state: "accepted", acceptedBySelf: true, packageKeys: [], hasAdditionalAccess: false }),
      viewer: { signedIn: true, email: "person@example.invalid", emailVerified: true },
      outcome: "already_accepted",
      token: "tok",
      invitationId: null,
      returnPath: "/join/tok",
    });
    assert.equal(joined.showAccept, false);
    assert.equal(joined.continueHref, "/tools/roofing/saved");

    const stale = buildInvitationJoinView({
      preview: pendingPreview(),
      viewer: { signedIn: true, email: "person@example.invalid", emailVerified: true },
      outcome: "reauthorization_required",
      token: "tok",
      invitationId: null,
      returnPath: "/join/tok",
    });
    assert.equal(stale.showAccept, false);
    assert.match(stale.body, /send it again/);
  });
});

describe("Phase 13B-E delivery separation", () => {
  test("a missing sender does not call the provider", async () => {
    let called = false;
    const result = await postInvitationEmail({
      apiKey: "",
      from: "",
      to: "person@example.invalid",
      subject: "s",
      html: "<p>s</p>",
      text: "s",
      idempotencyKey: "idem-12345678",
      fetchImpl: async () => {
        called = true;
        return new Response("no");
      },
    });
    assert.equal(called, false);
    assert.deepEqual(result, { ok: false, errorClass: "not_configured" });
  });

  test("a provider failure stays a class, and the request body has no token field", async () => {
    const ok = await postInvitationEmail({
      apiKey: "re_test",
      from: "FieldDive <invite@fielddive.test>",
      to: "person@example.invalid",
      subject: "s",
      html: "<p>s</p>",
      text: "s",
      idempotencyKey: "idem-12345678",
      fetchImpl: async (_url, init) => {
        const headers = new Headers(init?.headers);
        assert.equal(headers.get("Idempotency-Key"), "idem-12345678");
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        assert.equal("token" in body, false);
        assert.deepEqual(body.to, ["person@example.invalid"]);
        return new Response(JSON.stringify({ id: "msg_1" }), { status: 200 });
      },
    });
    assert.deepEqual(ok, { ok: true, messageId: "msg_1" });

    const failed = await postInvitationEmail({
      apiKey: "re_test",
      from: "FieldDive <invite@fielddive.test>",
      to: "person@example.invalid",
      subject: "s",
      html: "<p>s</p>",
      text: "s",
      idempotencyKey: "idem-12345678",
      fetchImpl: async () => new Response(JSON.stringify({ message: "domain secret" }), { status: 403 }),
    });
    assert.deepEqual(failed, { ok: false, errorClass: "provider_rejected" });
  });

  test("the invitation transaction returns before email is sent, and delivery is recorded after", () => {
    const actions = read("app/lib/invitations/invitationActions.server.ts");
    const issue = sliceBetween(actions, "export async function issueCompanyInvitation", "export async function resendCompanyInvitation");
    assert.ok(issue.indexOf("issue_company_invitation_v1") < issue.indexOf("deliverInvitation"));
    assert.doesNotMatch(issue, /postInvitationEmail|api\.resend\.com/);
    const deliver = sliceBetween(actions, "async function deliverInvitation", "export async function issueCompanyInvitation");
    assert.ok(deliver.indexOf("postInvitationEmail") < deliver.indexOf("record_company_invitation_delivery_v1"));
    const issueSql = sliceBetween(SQL, "function public.issue_company_invitation_v1", "function public.resend_company_invitation_v1");
    assert.doesNotMatch(issueSql, /company_invitation_delivery_attempts|api\.resend\.com/);
    const acceptSql = sliceBetween(SQL, "function private.accept_company_invitation_core_v1", "function public.accept_company_invitation_v1");
    assert.doesNotMatch(acceptSql, /company_invitation_delivery_attempts|api\.resend\.com/);
  });
});

describe("Phase 13B-E database authority", () => {
  test("accept takes the shared lock before it writes a membership and re-checks the token", () => {
    const acceptSql = sliceBetween(SQL, "function private.accept_company_invitation_core_v1", "function public.accept_company_invitation_v1");
    const lockAt = acceptSql.indexOf("perform private.lock_user_membership(v_uid)");
    const readAt = acceptSql.indexOf("for update");
    const insertAt = acceptSql.indexOf("insert into public.company_memberships");
    assert.ok(lockAt > 0 && lockAt < readAt && readAt < insertAt);
    assert.match(acceptSql, /token_hash is distinct from p_token_hash/);
    assert.match(acceptSql, /email_confirmed_at/);
    assert.doesNotMatch(acceptSql, /raw_user_meta_data|profiles\.email/);
    assert.match(acceptSql, /reauthorization_required/);
    assert.match(acceptSql, /membership_conflict/);
    assert.match(acceptSql, /already_accepted/);
    assert.match(acceptSql, /accepted_disabled/);
    assert.match(SQL, /interval '7 days'/);
    assert.match(SQL, /other pending invitations are left unchanged/i);
  });

  test("issue, resend, and revoke are company-scoped, idempotent, and do not record a raw token", () => {
    const issueSql = sliceBetween(SQL, "function public.issue_company_invitation_v1", "function public.resend_company_invitation_v1");
    assert.match(issueSql, /current_active_company_id\(\)/);
    assert.doesNotMatch(issueSql, /p_company_id/);
    assert.match(issueSql, /self_invite/);
    assert.match(issueSql, /recipient_membership_exists/);
    assert.match(issueSql, /idempotency_conflict/);
    assert.match(issueSql, /invitation_pending/);
    assert.match(issueSql, /invitation_issued/);
    assert.match(SQL, /role_not_assignable/);
    assert.match(SQL, /owner_required/);
    assert.doesNotMatch(issueSql, /'token'|raw_token|p_token_hash'/);
    const resendSql = sliceBetween(SQL, "function public.resend_company_invitation_v1", "function public.revoke_company_invitation_v1");
    assert.match(resendSql, /resend_idempotency_key is not distinct from p_idempotency_key/);
    assert.match(resendSql, /stale_generation/);
    assert.match(resendSql, /invitation_resent/);
    assert.match(resendSql, /role_profile_version = v_version/);
    const revokeSql = sliceBetween(SQL, "function public.revoke_company_invitation_v1", "function private.accept_company_invitation_core_v1");
    assert.match(revokeSql, /already_revoked/);
    assert.match(revokeSql, /invitation_revoked/);
    assert.doesNotMatch(revokeSql, /delete from public\.company_memberships/);
    assert.match(SQL, /invitation_accepted/);
    assert.match(SQL, /grant execute on function public\.preview_company_invitation_v1\(text\) to anon, authenticated, service_role/);
    const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const name of [
      "issue_company_invitation_v1(text, text, text[], uuid[], text, text)",
      "accept_company_invitation_v1(text, text)",
      "resend_company_invitation_v1(uuid, text, integer, text)",
      "revoke_company_invitation_v1(uuid)",
    ]) {
      const grant = SQL.match(new RegExp(`grant execute on function public\\.${escapeRegExp(name)} to [^;]+;`));
      assert.ok(grant, name);
      assert.doesNotMatch(grant[0], /\banon\b/);
    }
  });

  test("preview does not write, and delivery is not an access event", () => {
    const previewSql = sliceBetween(SQL, "function private.invitation_preview_v1", "function public.preview_company_invitation_v1");
    assert.doesNotMatch(previewSql, /\binsert\b|\bupdate\b|\bdelete\b/i);
    const recordSql = sliceBetween(SQL, "function public.record_company_invitation_delivery_v1", "revoke all on function private.invitation_token_hash_v1");
    assert.doesNotMatch(recordSql, /record_access_event_v1|update public\.company_invitations/);
    assert.match(SQL, /company_invitation_delivery_attempts/);
    assert.doesNotMatch(SQL, /alter table public\.proposals|alter table public\.job_payments|stripe/i);
  });
});

describe("Phase 13B-E callers", () => {
  test("the join page previews and posts; it does not accept while rendering", () => {
    const page = read("app/join/[token]/page.tsx");
    assert.match(page, /previewInvitationToken/);
    assert.doesNotMatch(page, /acceptInvitationToken|accept_company_invitation/);
    const screen = read("app/join/InvitationJoinScreen.tsx");
    assert.match(screen, /method="post"/);
    assert.match(screen, /action="\/api\/invitations\/accept"/);
    assert.doesNotMatch(screen, /companyId|company_id/);
    const accept = read("app/api/invitations/accept/route.ts");
    assert.match(accept, /export async function POST/);
    assert.doesNotMatch(accept, /export async function GET/);
    const start = read("app/start/page.tsx");
    assert.match(start, /\/join\/open\//);
    assert.match(start, /Review invitation/);
    assert.doesNotMatch(start, /accept_company_invitation|acceptInvitationToken/);
    assert.match(start, /acknowledgePendingInvitations/);
    const pub = read("app/p/[token]/page.tsx");
    assert.doesNotMatch(pub, /invitation|resolveCurrentUserAccess|bootstrap_current_user_company/);
    assert.match(read("middleware.ts"), /Referrer-Policy", "no-referrer"/);
    assert.match(read("app/join/layout.tsx"), /no-referrer/);
  });

  test("invitation modules do not log, and the issue route does not take a company id", () => {
    const dir = join(ROOT, "app", "lib", "invitations");
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".ts")) continue;
      assert.doesNotMatch(readFileSync(join(dir, name), "utf8"), /console\.(log|info|debug|error|warn)/, name);
    }
    const route = read("app/api/company/invitations/route.ts");
    assert.doesNotMatch(route, /companyId|p_company/);
    assert.match(route, /issueCompanyInvitation/);
    assert.match(route, /INVITATION_NOT_SENT_MESSAGE|message: result\.message/);
  });
});
