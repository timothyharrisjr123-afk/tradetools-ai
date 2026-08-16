/**
 * R18D3B — proposalEmailDelivery.server tests.
 *
 * Run: npx tsx --test app/lib/proposalEmailDelivery.server.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import {
  isProposalEmailDeliveryConfiguredFromEnv,
  mapResendErrorToSafeMessage,
} from "./proposalEmailDelivery";

describe("resolveProposalEmailDeliveryConfig", () => {
  test("isProposalEmailDeliveryConfiguredFromEnv checks RESEND env", () => {
    assert.equal(
      isProposalEmailDeliveryConfiguredFromEnv({
        RESEND_API_KEY: "re_test",
        RESEND_FROM: "noreply@example.com",
      }),
      true
    );
    assert.equal(
      isProposalEmailDeliveryConfiguredFromEnv({
        RESEND_API_KEY: "",
        RESEND_FROM: "noreply@example.com",
      }),
      false
    );
  });
});

describe("R18D3B server wiring guardrails", () => {
  test("server module is server-only and wires delivery + resend fetch", () => {
    const source = readFileSync(
      new URL("./proposalEmailDelivery.server.ts", import.meta.url),
      "utf8"
    );

    assert.match(source, /import "server-only"/);
    assert.match(source, /sendProposalEmailForContractor/);
    assert.match(source, /findProposalDeliveryAttemptByIdempotencyKey/);
    assert.match(source, /Idempotency-Key/);
    assert.match(source, /api\.resend\.com\/emails/);
    assert.match(source, /mintAndSupersedeProposalPublicAccessToken/);
    assert.doesNotMatch(source, /mintProposalPublicAccessToken\(/);
    assert.match(source, /EMAIL_SEND_MINT_METADATA|proposalEmailDelivery/);
    assert.match(source, /process\.env\.RESEND_API_KEY/);
    assert.doesNotMatch(source, /\/api\/estimate\/send|sendEstimateClient|\/approve\//);
    assert.doesNotMatch(source, /UPDATE public\.proposals|INSERT INTO public\.proposal_events|jobs\.stage/);
  });

  test("api route wires contractor send orchestrator only", () => {
    const source = readFileSync(
      new URL("../api/proposals/send/route.ts", import.meta.url),
      "utf8"
    );

    assert.match(source, /sendProposalEmailForContractor/);
    assert.match(source, /send_in_progress/);
    assert.match(source, /NextResponse\.json\(result/);
    assert.doesNotMatch(source, /token_hash|raw_token|rawToken|publicUrl/);
    assert.doesNotMatch(source, /\/api\/estimate\/send|sendEstimateClient/);
    assert.doesNotMatch(source, /proposal_events|jobs\.stage/);
  });

  test("mapResendErrorToSafeMessage stays contractor-safe", () => {
    const mapped = mapResendErrorToSafeMessage({
      statusCode: 422,
      message: "Validation failed for recipient",
    });
    assert.match(mapped.message, /email provider|try again/i);
    assert.doesNotMatch(mapped.message, /re_[a-z0-9_]+/i);
  });

  test("resolveProposalEmailDeliveryConfig returns null without env", () => {
    const source = readFileSync(
      new URL("./proposalEmailDelivery.server.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /resolveProposalEmailDeliveryConfig/);
    assert.match(source, /if \(!resendApiKey \|\| !resendFrom/);
  });
});
