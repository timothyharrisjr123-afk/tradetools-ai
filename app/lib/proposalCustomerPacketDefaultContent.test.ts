/**
 * R3A0 — default customer-facing packet content.
 * Run: npx tsx --test app/lib/proposalCustomerPacketDefaultContent.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  DEFAULT_PACKET_OVERVIEW_BODY,
  DEFAULT_PACKET_SCOPE_NOTES_BODY,
  DEFAULT_PACKET_TERMS_BODY,
  DEFAULT_PACKET_WARRANTY_BODY,
  LEGACY_PACKET_OVERVIEW_BODY,
  LEGACY_PACKET_SCOPE_NOTES_BODY,
  LEGACY_PACKET_TERMS_BODY,
  LEGACY_PACKET_WARRANTY_BODY,
  PRE_COHESION_C_PACKET_TERMS_BODY,
  PRE_V2E5_PACKET_OVERVIEW_BODY,
  resolveCustomerFacingPacketBodyMarkdown,
} from "./proposalCustomerPacketDefaultContent";
import { DEFAULT_ROOFING_PROPOSAL_TEMPLATE_DEFINITIONS } from "./defaultRoofingProposalTemplates";
import {
  PROPOSAL_CUSTOMER_PACKET_COVER_CONFIDENCE,
  PROPOSAL_CUSTOMER_PACKET_CURRENT_BADGE,
  PROPOSAL_CUSTOMER_PACKET_CURRENT_PACKAGE_LABEL,
  PROPOSAL_CUSTOMER_PACKET_UPGRADES_INTRO_LINE2,
} from "./proposalCustomerPacketViewModel";
import { resolvePackageMeta } from "./proposalPackagePresentation";

describe("R3A0 default customer-facing packet content", () => {
  test("default seed bodies use homeowner language and tokens, not legacy boilerplate", () => {
    assert.match(DEFAULT_PACKET_OVERVIEW_BODY, /prepared this roofing proposal for your home/i);
    assert.match(DEFAULT_PACKET_OVERVIEW_BODY, /\{\{company_name\}\}/);
    assert.match(DEFAULT_PACKET_OVERVIEW_BODY, /\{\{selected_package_name\}\}/);
    assert.doesNotMatch(DEFAULT_PACKET_OVERVIEW_BODY, /recommended path/i);
    assert.doesNotMatch(DEFAULT_PACKET_OVERVIEW_BODY, /this proposal outlines/i);
    assert.doesNotMatch(DEFAULT_PACKET_OVERVIEW_BODY, /supporting pages/i);
    assert.doesNotMatch(DEFAULT_PACKET_OVERVIEW_BODY, /current job information/i);

    assert.match(DEFAULT_PACKET_SCOPE_NOTES_BODY, /Project notes/);
    assert.doesNotMatch(DEFAULT_PACKET_SCOPE_NOTES_BODY, /contractor review/i);
    assert.doesNotMatch(DEFAULT_PACKET_OVERVIEW_BODY, /\*\*|##/);

    assert.match(DEFAULT_PACKET_WARRANTY_BODY, /Manufacturer coverage/);
    assert.match(DEFAULT_PACKET_WARRANTY_BODY, /Workmanship coverage/);
    assert.doesNotMatch(DEFAULT_PACKET_WARRANTY_BODY, /final proposal documents/i);

    assert.match(DEFAULT_PACKET_TERMS_BODY, /What happens next/);
    assert.match(DEFAULT_PACKET_TERMS_BODY, /contact you about next steps/i);
    assert.match(DEFAULT_PACKET_TERMS_BODY, /does not change this proposal/i);
    assert.match(DEFAULT_PACKET_TERMS_BODY, /Confirm the package and details/i);
    assert.doesNotMatch(DEFAULT_PACKET_TERMS_BODY, /Request a package/i);
    assert.doesNotMatch(DEFAULT_PACKET_TERMS_BODY, /package request/i);
    assert.doesNotMatch(DEFAULT_PACKET_TERMS_BODY, /Terms and conditions outline/i);
    assert.doesNotMatch(DEFAULT_PACKET_TERMS_BODY, /\*\*|##/);

    const publicDefaults = [
      DEFAULT_PACKET_OVERVIEW_BODY,
      DEFAULT_PACKET_SCOPE_NOTES_BODY,
      DEFAULT_PACKET_WARRANTY_BODY,
      DEFAULT_PACKET_TERMS_BODY,
    ].join("\n");
    assert.doesNotMatch(
      publicDefaults,
      /\bapprove(?:d|s|al)?\b|\baccept(?:ed|ance)?\b|\bsign(?:ed|ature)?\b|\bpay(?:ment|ments|ing|s|ed)?\b|\bschedul(?:e|ed|ing)\b/i
    );
  });

  test("default roofing template definitions use the new packet bodies", () => {
    const option = DEFAULT_ROOFING_PROPOSAL_TEMPLATE_DEFINITIONS[0]?.options?.[0];
    assert.ok(option);
    const overview = option.sections?.find((row) => row.seed_key?.endsWith(".overview"));
    const notes = option.sections?.find((row) => row.seed_key?.endsWith(".scope_notes"));
    const warranty = option.sections?.find((row) => row.seed_key?.endsWith(".warranty"));
    const terms = option.sections?.find((row) => row.seed_key?.endsWith(".terms"));
    assert.equal(overview?.content?.body_markdown, DEFAULT_PACKET_OVERVIEW_BODY);
    assert.equal(notes?.content?.body_markdown, DEFAULT_PACKET_SCOPE_NOTES_BODY);
    assert.equal(warranty?.content?.body_markdown, DEFAULT_PACKET_WARRANTY_BODY);
    assert.equal(terms?.content?.body_markdown, DEFAULT_PACKET_TERMS_BODY);
    assert.equal(overview?.customer_title, "Overview");
    assert.equal(notes?.customer_title, "Project notes");
  });

  test("legacy weak starter bodies resolve to new defaults before display merge", () => {
    assert.equal(
      resolveCustomerFacingPacketBodyMarkdown("project_overview", LEGACY_PACKET_OVERVIEW_BODY),
      DEFAULT_PACKET_OVERVIEW_BODY
    );
    assert.equal(
      resolveCustomerFacingPacketBodyMarkdown("custom_text", LEGACY_PACKET_SCOPE_NOTES_BODY),
      DEFAULT_PACKET_SCOPE_NOTES_BODY
    );
    assert.equal(
      resolveCustomerFacingPacketBodyMarkdown("warranty", LEGACY_PACKET_WARRANTY_BODY),
      DEFAULT_PACKET_WARRANTY_BODY
    );
    assert.equal(
      resolveCustomerFacingPacketBodyMarkdown("terms", LEGACY_PACKET_TERMS_BODY),
      DEFAULT_PACKET_TERMS_BODY
    );
  });

  test("authored/custom body is not replaced", () => {
    const custom = "Custom warranty language for Anderson Roofing.";
    assert.equal(resolveCustomerFacingPacketBodyMarkdown("warranty", custom), custom);
    const customTerms = "Please request a package in writing if you want to change scope.";
    assert.equal(resolveCustomerFacingPacketBodyMarkdown("terms", customTerms), customTerms);
  });

  test("pre-Cohesion C request-a-package terms resolve to current default", () => {
    assert.equal(
      resolveCustomerFacingPacketBodyMarkdown("terms", PRE_COHESION_C_PACKET_TERMS_BODY),
      DEFAULT_PACKET_TERMS_BODY
    );
  });

  test("pre-V2E5 recommended-path overview resolves to current default", () => {
    assert.equal(
      resolveCustomerFacingPacketBodyMarkdown("project_overview", PRE_V2E5_PACKET_OVERVIEW_BODY),
      DEFAULT_PACKET_OVERVIEW_BODY
    );
  });

  test("R3A smoke-test project notes resolve to production starter notes", () => {
    assert.equal(
      resolveCustomerFacingPacketBodyMarkdown(
        "custom_text",
        "R3A SMOKE TEST - Project notes: debris removal is scheduled within 48 hours of completion."
      ),
      DEFAULT_PACKET_SCOPE_NOTES_BODY
    );
  });

  test("packet chrome uses selected-package language without schema terms", () => {
    assert.equal(PROPOSAL_CUSTOMER_PACKET_CURRENT_PACKAGE_LABEL, "Selected package");
    assert.equal(PROPOSAL_CUSTOMER_PACKET_CURRENT_BADGE, "Selected");
    assert.match(PROPOSAL_CUSTOMER_PACKET_COVER_CONFIDENCE, /Prepared for your home/i);
    assert.match(PROPOSAL_CUSTOMER_PACKET_UPGRADES_INTRO_LINE2, /optional/i);
    assert.doesNotMatch(PROPOSAL_CUSTOMER_PACKET_COVER_CONFIDENCE, /page_type|content_json|template section/i);
  });

  test("package meta does not invent Standard marketing copy", () => {
    const standard = resolvePackageMeta("Standard");
    assert.equal(standard.description, null);
    assert.deepEqual(standard.bullets, []);
    const authored = resolvePackageMeta("Standard", "Contractor-authored Standard story.");
    assert.equal(authored.description, "Contractor-authored Standard story.");
  });

  test("no internal/admin schema terms in default packet bodies", () => {
    const bodies = [
      DEFAULT_PACKET_OVERVIEW_BODY,
      DEFAULT_PACKET_SCOPE_NOTES_BODY,
      DEFAULT_PACKET_WARRANTY_BODY,
      DEFAULT_PACKET_TERMS_BODY,
    ].join("\n");
    assert.doesNotMatch(bodies, /page_type|content_json|template section|selected option|is_default/i);
  });
});
