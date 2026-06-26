/**
 * R18D3B — proposalEmailTemplate tests.
 *
 * Run: npx tsx --test app/lib/proposalEmailTemplate.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildDefaultProposalEmailBody } from "./proposalSendGateReadiness";
import {
  buildProposalEmailPreheader,
  buildProposalEmailTemplate,
  escapeHtml,
  formatProposalEmailInvestment,
  isLocalhostPublicOrigin,
  PROPOSAL_EMAIL_CTA_BACKGROUND,
  PROPOSAL_EMAIL_CTA_LABEL,
  PROPOSAL_EMAIL_HEADLINE,
  sanitizeProposalEmailBody,
} from "./proposalEmailTemplate";

const RAW_TOKEN = "fd_test_token_abc123";
const ORIGIN = "https://app.example.com";

const DEFAULT_BODY = buildDefaultProposalEmailBody({
  customerFirstName: "Jane",
  companyName: "Summit Roofing",
  projectAddress: "456 Oak Ave, Austin, TX",
});

describe("buildProposalEmailTemplate", () => {
  test("includes professional headline, address preheader, branded CTA, and proposal URL", () => {
    const template = buildProposalEmailTemplate({
      origin: ORIGIN,
      rawToken: RAW_TOKEN,
      subject: "Your proposal from Summit Roofing",
      body: DEFAULT_BODY,
      companyName: "Summit Roofing",
      customerFirstName: "Jane",
      projectAddress: "456 Oak Ave, Austin, TX",
    });

    assert.equal(template.subject, "Your proposal from Summit Roofing");
    assert.equal(PROPOSAL_EMAIL_CTA_LABEL, "Review proposal");
    assert.equal(template.preheader, "Review your roofing proposal for 456 Oak Ave.");
    assert.equal(template.publicPath, `/p/${encodeURIComponent(RAW_TOKEN)}`);
    assert.match(template.html, new RegExp(escapeHtml(PROPOSAL_EMAIL_HEADLINE)));
    assert.match(template.html, /Review your roofing proposal for 456 Oak Ave/);
    assert.match(template.html, /Review proposal/);
    assert.match(template.html, new RegExp(escapeHtml(PROPOSAL_EMAIL_CTA_BACKGROUND)));
    assert.doesNotMatch(template.html, /background:#1f2937/i);
    assert.match(
      template.html,
      new RegExp(escapeHtml(`${ORIGIN}/p/${encodeURIComponent(RAW_TOKEN)}`))
    );
    assert.match(template.text, new RegExp(`${ORIGIN}/p/`));
    assert.match(template.text, /Review proposal/);
    assert.doesNotMatch(template.html, /&lt;script/i);
  });

  test("includes project row only in summary card when address is provided", () => {
    const template = buildProposalEmailTemplate({
      origin: ORIGIN,
      rawToken: RAW_TOKEN,
      subject: "Your proposal from Summit Roofing",
      body: DEFAULT_BODY,
      companyName: "Summit Roofing",
      projectAddress: "456 Oak Ave, Austin, TX",
    });

    assert.match(template.html, />Project</);
    assert.match(template.html, /456 Oak Ave, Austin, TX/);
    assert.match(template.text, /Project/);
    assert.match(template.text, /456 Oak Ave, Austin, TX/);
  });

  test("does not show investment amount in HTML or text fallback by default", () => {
    const template = buildProposalEmailTemplate({
      origin: ORIGIN,
      rawToken: RAW_TOKEN,
      subject: "Your proposal from Summit Roofing",
      body: DEFAULT_BODY,
      companyName: "Summit Roofing",
      projectAddress: "456 Oak Ave, Austin, TX",
    });

    assert.doesNotMatch(template.html, />Investment</);
    assert.doesNotMatch(template.html, /\$27,028\.60/);
    assert.doesNotMatch(template.text, /Investment/);
    assert.doesNotMatch(template.text, /\$27,028\.60/);
  });

  test("does not show package labels in HTML or text fallback by default", () => {
    const template = buildProposalEmailTemplate({
      origin: ORIGIN,
      rawToken: RAW_TOKEN,
      subject: "Your proposal from Summit Roofing",
      body: DEFAULT_BODY,
      companyName: "Summit Roofing",
      projectAddress: "456 Oak Ave, Austin, TX",
    });

    for (const label of ["Standard", "Enhanced", "Premium"]) {
      assert.doesNotMatch(template.html, new RegExp(`>Package<|${label}`));
      assert.doesNotMatch(template.text, new RegExp(`Package\\s*\\n${label}|${label}`));
    }
    assert.doesNotMatch(template.html, />Package</);
    assert.doesNotMatch(template.text, /^Package$/m);
  });

  test("omits summary card when project address is missing", () => {
    const body = buildDefaultProposalEmailBody({
      customerFirstName: "Jane",
      companyName: "Summit Roofing",
      projectAddress: null,
    });
    const template = buildProposalEmailTemplate({
      origin: ORIGIN,
      rawToken: RAW_TOKEN,
      subject: "Your proposal from Summit Roofing",
      body,
      companyName: "Summit Roofing",
      projectAddress: null,
    });

    assert.doesNotMatch(template.html, />Project</);
    assert.doesNotMatch(template.html, />Package</);
    assert.doesNotMatch(template.html, />Investment</);
    assert.doesNotMatch(template.text, /^Project$/m);
    assert.equal(template.preheader, "Review your roofing proposal online.");
  });

  test("excludes forbidden lifecycle, sign, payment, and pdf language", () => {
    const template = buildProposalEmailTemplate({
      origin: ORIGIN,
      rawToken: RAW_TOKEN,
      subject: "Proposal ready",
      body: DEFAULT_BODY,
      companyName: "Summit Roofing",
      projectAddress: "456 Oak Ave, Austin, TX",
    });

    const serialized = `${template.html}\n${template.text}`;
    assert.doesNotMatch(
      serialized,
      /\bpdf\b|\bdownload\b|\bsign\b|\bpayment\b|\bdeposit\b|\bapprove\b|\baccept\b|customer viewed|status changed|\bviewed\b|job moved/i
    );
    assert.doesNotMatch(template.html, /text-transform:uppercase[^>]*>Proposal</i);
    assert.doesNotMatch(template.html, /Available after send/i);
    assert.doesNotMatch(template.html, /Additional options or upgrades/i);
  });

  test("escapes dangerous characters in body, company name, and address", () => {
    const template = buildProposalEmailTemplate({
      origin: ORIGIN,
      rawToken: RAW_TOKEN,
      subject: "Proposal",
      body: '<script>alert("x")</script>',
      companyName: 'Roof & "Co"',
      projectAddress: '123 Main & "St"',
    });

    assert.match(template.html, /&lt;script&gt;/);
    assert.match(template.html, /Roof &amp; &quot;Co&quot;/);
    assert.match(template.html, /123 Main &amp; &quot;St&quot;/);
    assert.doesNotMatch(template.html, /<script>/);
  });

  test("text fallback stays concise without duplicate link placeholder lines", () => {
    const template = buildProposalEmailTemplate({
      origin: ORIGIN,
      rawToken: RAW_TOKEN,
      subject: "Your proposal from Summit Roofing",
      body: `Hi Jane,

Summit Roofing has prepared your roofing proposal for your project.

Review your proposal here:
Available after send`,
      companyName: "Summit Roofing",
    });

    assert.doesNotMatch(template.text, /Available after send/i);
    assert.doesNotMatch(template.text, /Review your proposal here/i);
    assert.doesNotMatch(template.html, /Available after send/i);
  });

  test("omits visible localhost fallback URL and dev note for local development origins", () => {
    const template = buildProposalEmailTemplate({
      origin: "http://localhost:3000",
      rawToken: RAW_TOKEN,
      subject: "Your proposal from Summit Roofing",
      body: DEFAULT_BODY,
      companyName: "Summit Roofing",
      projectAddress: "456 Oak Ave, Austin, TX",
    });

    assert.equal(template.usesLocalhostOrigin, true);
    assert.match(template.html, /Review proposal/);
    assert.match(template.html, /http:\/\/localhost:3000\/p\//);
    assert.doesNotMatch(template.html, /copy and paste this link/i);
    assert.doesNotMatch(template.html, /For local review/i);
    assert.doesNotMatch(template.html, /deliverability/i);
    assert.doesNotMatch(template.text, /http:\/\/localhost:3000/);
    assert.doesNotMatch(template.text, /local development/i);
  });

  test("includes production fallback link for non-localhost origins", () => {
    const template = buildProposalEmailTemplate({
      origin: ORIGIN,
      rawToken: RAW_TOKEN,
      subject: "Your proposal from Summit Roofing",
      body: DEFAULT_BODY,
      companyName: "Summit Roofing",
      projectAddress: "456 Oak Ave, Austin, TX",
    });

    assert.match(template.html, /copy and paste this link/i);
    assert.match(template.html, new RegExp(escapeHtml(`${ORIGIN}/p/${encodeURIComponent(RAW_TOKEN)}`)));
    assert.match(template.text, new RegExp(`${ORIGIN}/p/`));
  });
});

describe("buildProposalEmailPreheader", () => {
  test("uses short project address when available", () => {
    assert.equal(
      buildProposalEmailPreheader("999 Smoke Test Lane, Austin, TX, 78701"),
      "Review your roofing proposal for 999 Smoke Test Lane."
    );
  });
});

describe("isLocalhostPublicOrigin", () => {
  test("detects localhost origins", () => {
    assert.equal(isLocalhostPublicOrigin("http://localhost:3000"), true);
    assert.equal(isLocalhostPublicOrigin("https://app.example.com"), false);
  });
});

describe("formatProposalEmailInvestment", () => {
  test("formats cents as USD", () => {
    assert.equal(formatProposalEmailInvestment(2702860), "$27,028.60");
    assert.equal(formatProposalEmailInvestment(null), null);
  });
});

describe("sanitizeProposalEmailBody", () => {
  test("removes placeholder link lines and standalone duplicate address lines", () => {
    const sanitized = sanitizeProposalEmailBody(
      `Hi Jane,

Summit Roofing has prepared your roofing proposal for your project.

Review your proposal here:
Available after send

456 Oak Ave`,
      "456 Oak Ave"
    );

    assert.doesNotMatch(sanitized, /Available after send/i);
    assert.doesNotMatch(sanitized, /Review your proposal here/i);
    assert.match(sanitized, /prepared your roofing proposal for your project/);
    assert.doesNotMatch(sanitized, /^456 Oak Ave$/m);
  });
});

describe("buildDefaultProposalEmailBody", () => {
  test("default body is short and excludes link placeholder text", () => {
    const body = buildDefaultProposalEmailBody({
      customerFirstName: "Jane",
      companyName: "Anderson Roofing",
      projectAddress: "456 Oak Ave",
    });

    assert.match(body, /Hi Jane,/);
    assert.match(body, /Anderson Roofing has prepared your roofing proposal for your project/);
    assert.match(body, /Review the proposal details using the secure link below/);
    assert.doesNotMatch(body, /456 Oak Ave/);
    assert.doesNotMatch(body, /Questions\? Reply to this email/);
    assert.doesNotMatch(body, /Available after send/i);
    assert.doesNotMatch(body, /Review your proposal here/i);
    assert.doesNotMatch(body, /Review proposal/i);
    assert.doesNotMatch(body, /https?:\/\//);
    assert.doesNotMatch(body, /Additional options or upgrades/i);
  });
});
