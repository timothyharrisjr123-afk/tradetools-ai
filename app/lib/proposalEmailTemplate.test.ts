/**
 * R18D3B — proposalEmailTemplate tests.
 *
 * Run: npx tsx --test app/lib/proposalEmailTemplate.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  buildProposalEmailTemplate,
  escapeHtml,
  PROPOSAL_EMAIL_CTA_LABEL,
} from "./proposalEmailTemplate";

const RAW_TOKEN = "fd_test_token_abc123";
const ORIGIN = "https://app.example.com";

describe("buildProposalEmailTemplate", () => {
  test("includes /p/<token> CTA and escapes HTML", () => {
    const template = buildProposalEmailTemplate({
      origin: ORIGIN,
      rawToken: RAW_TOKEN,
      subject: "Your proposal from Summit Roofing",
      body: "Hi Jane,\n\nPlease review your proposal.",
      companyName: "Summit Roofing",
    });

    assert.equal(template.subject, "Your proposal from Summit Roofing");
    assert.match(template.html, /View your proposal/);
    assert.equal(template.publicPath, `/p/${encodeURIComponent(RAW_TOKEN)}`);
    assert.match(template.html, new RegExp(escapeHtml(`${ORIGIN}/p/${encodeURIComponent(RAW_TOKEN)}`)));
    assert.match(template.text, new RegExp(`${ORIGIN}/p/`));
    assert.equal(PROPOSAL_EMAIL_CTA_LABEL, "View your proposal");
    assert.doesNotMatch(template.html, /&lt;script/i);
  });

  test("excludes PDF, sign, payment, approve, and lifecycle language", () => {
    const template = buildProposalEmailTemplate({
      origin: ORIGIN,
      rawToken: RAW_TOKEN,
      subject: "Proposal ready",
      body: "Your proposal is ready.",
      companyName: "Summit Roofing",
    });

    const serialized = JSON.stringify(template);
    assert.doesNotMatch(serialized, /pdf|sign|payment|deposit|approve|customer viewed|job moved|status changed/i);
  });

  test("escapes dangerous characters in body and company name", () => {
    const template = buildProposalEmailTemplate({
      origin: ORIGIN,
      rawToken: RAW_TOKEN,
      subject: "Proposal",
      body: '<script>alert("x")</script>',
      companyName: 'Roof & "Co"',
    });

    assert.match(template.html, /&lt;script&gt;/);
    assert.match(template.html, /Roof &amp; &quot;Co&quot;/);
    assert.doesNotMatch(template.html, /<script>/);
  });
});
