/**
 * Beta Trust Ops Group A — public app origin fail-closed contract.
 *
 * Run: npx tsx --test app/lib/publicAppOrigin.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  PUBLIC_ORIGIN_MISCONFIGURED_CODE,
  PUBLIC_ORIGIN_MISCONFIGURED_MESSAGE,
  PublicAppOriginError,
  isLoopbackHostname,
  normalizePublicAppOrigin,
  resolvePublicAppOrigin,
} from "./publicAppOrigin";

const ROOT = process.cwd();

describe("isLoopbackHostname", () => {
  test("detects localhost and loopbacks", () => {
    assert.equal(isLoopbackHostname("localhost"), true);
    assert.equal(isLoopbackHostname("127.0.0.1"), true);
    assert.equal(isLoopbackHostname("::1"), true);
    assert.equal(isLoopbackHostname("[::1]"), true);
    assert.equal(isLoopbackHostname("app.fielddive.com"), false);
  });
});

describe("normalizePublicAppOrigin — development", () => {
  test("allows localhost http", () => {
    assert.equal(
      normalizePublicAppOrigin("http://localhost:3000", "development"),
      "http://localhost:3000"
    );
  });

  test("strips trailing slash via URL.origin", () => {
    assert.equal(
      normalizePublicAppOrigin("http://localhost:3000/", "development"),
      "http://localhost:3000"
    );
  });
});

describe("normalizePublicAppOrigin — non-development", () => {
  test("rejects missing / empty via resolve", () => {
    assert.throws(
      () => resolvePublicAppOrigin({ nodeEnv: "production", appUrl: "" }),
      (err: unknown) =>
        err instanceof PublicAppOriginError &&
        err.code === PUBLIC_ORIGIN_MISCONFIGURED_CODE
    );
  });

  test("rejects malformed APP_URL", () => {
    assert.throws(
      () => normalizePublicAppOrigin("not-a-url", "production"),
      PublicAppOriginError
    );
  });

  test("rejects http://example.com", () => {
    assert.throws(
      () => normalizePublicAppOrigin("http://example.com", "production"),
      PublicAppOriginError
    );
  });

  test("rejects http://localhost:3000", () => {
    assert.throws(
      () => normalizePublicAppOrigin("http://localhost:3000", "production"),
      PublicAppOriginError
    );
  });

  test("rejects https://localhost", () => {
    assert.throws(
      () => normalizePublicAppOrigin("https://localhost", "production"),
      PublicAppOriginError
    );
  });

  test("rejects https://127.0.0.1", () => {
    assert.throws(
      () => normalizePublicAppOrigin("https://127.0.0.1", "production"),
      PublicAppOriginError
    );
  });

  test("rejects IPv6 loopback", () => {
    assert.throws(
      () => normalizePublicAppOrigin("https://[::1]", "production"),
      PublicAppOriginError
    );
  });

  test("accepts valid https origin and normalizes trailing slash", () => {
    assert.equal(
      normalizePublicAppOrigin("https://fielddive.example/", "production"),
      "https://fielddive.example"
    );
  });
});

describe("resolvePublicAppOrigin", () => {
  test("development defaults to localhost when APP_URL missing", () => {
    assert.equal(
      resolvePublicAppOrigin({ nodeEnv: "development", appUrl: "" }),
      "http://localhost:3000"
    );
  });

  test("development may use fallback origin when APP_URL missing", () => {
    assert.equal(
      resolvePublicAppOrigin({
        nodeEnv: "development",
        appUrl: "",
        developmentFallbackOrigin: "http://localhost:3000",
      }),
      "http://localhost:3000"
    );
  });

  test("non-development ignores Host-like fallback and rejects missing APP_URL", () => {
    assert.throws(
      () =>
        resolvePublicAppOrigin({
          nodeEnv: "production",
          appUrl: "",
          developmentFallbackOrigin: "https://evil.example",
        }),
      PublicAppOriginError
    );
  });

  test("non-development Host-only cannot authorize (no APP_URL)", () => {
    assert.throws(
      () =>
        resolvePublicAppOrigin({
          nodeEnv: "production",
          appUrl: null,
          developmentFallbackOrigin: "https://spoofed-host.example",
        }),
      PublicAppOriginError
    );
  });

  test("non-development Origin-header-only cannot authorize", () => {
    assert.throws(
      () =>
        resolvePublicAppOrigin({
          nodeEnv: "production",
          appUrl: null,
          developmentFallbackOrigin: "https://client-origin.example",
        }),
      PublicAppOriginError
    );
  });

  test("contractor message has no env leakage", () => {
    assert.doesNotMatch(PUBLIC_ORIGIN_MISCONFIGURED_MESSAGE, /NEXT_PUBLIC|APP_URL|localhost|https?:\/\//i);
  });
});

describe("Group A wiring guardrails", () => {
  test("send route uses shared origin and no Host fallback", () => {
    const source = readFileSync(join(ROOT, "app/api/proposals/send/route.ts"), "utf8");
    assert.match(source, /resolvePublicAppOrigin/);
    assert.doesNotMatch(source, /x-forwarded-host|localhost:3000/);
    assert.match(source, /PUBLIC_ORIGIN_MISCONFIGURED|PublicAppOriginError|isPublicAppOriginError/);
  });

  test("send-prep / public-review-link / payment-link use shared origin", () => {
    for (const rel of [
      "app/api/proposals/send-prep/route.ts",
      "app/api/proposals/public-review-link/route.ts",
      "app/api/jobs/[jobId]/payment-link/route.ts",
    ]) {
      const source = readFileSync(join(ROOT, rel), "utf8");
      assert.match(source, /resolvePublicAppOrigin/, rel);
      assert.doesNotMatch(source, /function resolveRequestOrigin/, rel);
      assert.doesNotMatch(source, /x-forwarded-host/, rel);
    }
  });

  test("Stripe Connect appOriginFromRequest uses shared origin", () => {
    const source = readFileSync(join(ROOT, "app/lib/jobPaymentStripe.server.ts"), "utf8");
    assert.match(source, /resolvePublicAppOrigin/);
    assert.doesNotMatch(source, /return "http:\/\/localhost:3000"/);
  });

  test("Send success copy is Proposal emailed / Submitted to", () => {
    const readiness = readFileSync(
      join(ROOT, "app/lib/proposalSendGateReadiness.ts"),
      "utf8"
    );
    assert.match(
      readiness,
      /SEND_GATE_EMAIL_PROVIDER_ACCEPTED_TITLE = "Proposal emailed"/
    );
    assert.match(
      readiness,
      /SEND_GATE_EMAIL_PROVIDER_ACCEPTED_BODY_PREFIX = "Submitted to"/
    );
    const panel = readFileSync(
      join(ROOT, "app/tools/roofing/proposals/preview/ProposalCustomerPreviewSendGatePanel.tsx"),
      "utf8"
    );
    assert.match(panel, /SEND_GATE_EMAIL_PROVIDER_ACCEPTED_BODY_PREFIX/);
    assert.doesNotMatch(panel, /Sent to \{sendSuccess/);
    assert.doesNotMatch(readiness, /Delivered|Received|Opened/);
  });

  test("sk_live_ refusal remains", () => {
    const source = readFileSync(join(ROOT, "app/lib/jobPaymentStripe.server.ts"), "utf8");
    assert.match(source, /refuses live Stripe keys/);
    assert.match(source, /sk_live_/);
  });

  test("estimate/send uses shared origin before Resend", () => {
    const source = readFileSync(join(ROOT, "app/api/estimate/send/route.ts"), "utf8");
    assert.match(source, /resolvePublicAppOrigin/);
    assert.doesNotMatch(source, /getStableOrigin|x-forwarded-host/);
    const originIdx = source.indexOf("resolvePublicAppOrigin");
    const resendIdx = source.indexOf("new Resend");
    assert.ok(originIdx > 0 && resendIdx > originIdx);
  });
});
