/**
 * R16C2 — proposalDocumentTokenPicker tests.
 *
 * Run: npx tsx --test app/lib/proposalDocumentTokenPicker.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { renderProposalDocumentPageBody } from "./proposalDocumentBodyRenderer";
import type { ProposalDocumentContext } from "./proposalDocumentTokenTypes";
import {
  PROPOSAL_DOCUMENT_TOKEN_REGISTRY,
  PROPOSAL_DOCUMENT_TOKEN_NAMES,
} from "./proposalDocumentTokenRegistry";
import { normalizeProposalPageBodyMarkdown } from "./proposalPageContentEditing";
import {
  BODY_TEXT_EXCLUDED_TOKENS,
  PROPOSAL_DOCUMENT_TOKEN_PICKER_DOMAIN_ORDER,
  PROPOSAL_DOCUMENT_TOKEN_PICKER_DOMAIN_LABELS,
  PROPOSAL_DOCUMENT_TOKEN_PICKER_PRICING_HINT,
  buildProposalDocumentTokenPickerModel,
  formatProposalDocumentTokenPlaceholder,
  insertTextAtCursor,
  listBodyTextPickerItems,
  resolveTextareaInsertionSelection,
} from "./proposalDocumentTokenPicker";

function fullContext(): ProposalDocumentContext {
  return {
    company: {
      companyName: "Summit Roofing",
      companyLogoUrl: "https://cdn.example/logo.png",
      companyPhone: "918-555-0100",
      companyLicense: "OK-12345",
      companyAddress: "456 HQ Blvd",
      companyWebsite: "https://summitroofing.com",
      brandPrimaryColor: "#112233",
      brandSecondaryColor: "#445566",
      showLicenseOnCover: true,
    },
    customer: {
      customerId: "55555555-5555-4555-8555-555555555555",
      customerName: "Jane Smith",
      customerEmail: "jane@example.com",
      customerPhone: "918-555-0200",
      customerAddress: "99 Mailing Ln",
    },
    jobName: "Jones roof",
    jobAddress: "1 Main St, Tulsa OK",
    measurementSummary: "24 SQ",
    proposalNumber: "P-2026-0042",
    proposalTitle: "Roof replacement proposal",
    templateName: "Standard roof",
    proposalCreatedDateIso: "2026-06-10T12:00:00.000Z",
    selectedPackage: {
      runtimeOptionId: "99999999-9999-4999-8999-999999999999",
      packageName: "Better",
      customerTotalCents: 22450,
    },
  };
}

describe("proposalDocumentTokenPicker model", () => {
  test("every available registry token is included in body picker or explicitly excluded", () => {
    const bodyItems = listBodyTextPickerItems(true);
    const bodyNames = new Set(bodyItems.map((item) => item.name));
    const excludedNames = new Set(Object.keys(BODY_TEXT_EXCLUDED_TOKENS));

    for (const entry of PROPOSAL_DOCUMENT_TOKEN_REGISTRY) {
      if (entry.availability !== "available") continue;

      const included = bodyNames.has(entry.name);
      const excluded = excludedNames.has(entry.name);
      assert.ok(
        included !== excluded,
        `token ${entry.name} must be included or excluded, not both/neither`
      );
    }

    assert.equal(bodyNames.size + excludedNames.size, PROPOSAL_DOCUMENT_TOKEN_NAMES.length);
  });

  test("body surface excludes cover/styling tokens", () => {
    const bodyItems = listBodyTextPickerItems(true);
    const bodyNames = new Set(bodyItems.map((item) => item.name));

    for (const excluded of Object.keys(BODY_TEXT_EXCLUDED_TOKENS)) {
      assert.equal(bodyNames.has(excluded as keyof typeof BODY_TEXT_EXCLUDED_TOKENS), false);
    }
  });

  test("domain group order is stable", () => {
    const groups = buildProposalDocumentTokenPickerModel({
      surface: "body_text",
      pricingComplete: true,
    });

    assert.deepEqual(
      groups.map((group) => group.domain),
      PROPOSAL_DOCUMENT_TOKEN_PICKER_DOMAIN_ORDER.filter((domain) =>
        groups.some((group) => group.domain === domain)
      )
    );

    for (const group of groups) {
      assert.equal(group.label, PROPOSAL_DOCUMENT_TOKEN_PICKER_DOMAIN_LABELS[group.domain]);
    }
  });

  test("pricing tokens include hint when pricing is incomplete", () => {
    const incomplete = listBodyTextPickerItems(false);
    const complete = listBodyTextPickerItems(true);

    for (const name of ["proposal_total", "selected_package_total"] as const) {
      const incompleteItem = incomplete.find((item) => item.name === name);
      const completeItem = complete.find((item) => item.name === name);
      assert.ok(incompleteItem);
      assert.ok(completeItem);
      assert.equal(incompleteItem.pricingHint, PROPOSAL_DOCUMENT_TOKEN_PICKER_PRICING_HINT);
      assert.equal(completeItem.pricingHint, null);
    }
  });

  test("placeholder format is exact canonical snake_case", () => {
    assert.equal(formatProposalDocumentTokenPlaceholder("customer_name"), "{{customer_name}}");
    assert.equal(formatProposalDocumentTokenPlaceholder("proposal_total"), "{{proposal_total}}");

    for (const item of listBodyTextPickerItems(true)) {
      assert.equal(item.placeholder, `{{${item.name}}}`);
    }
  });
});

describe("insertTextAtCursor", () => {
  test("inserts at start, middle, and end", () => {
    const token = "{{customer_name}}";

    assert.deepEqual(
      insertTextAtCursor({
        value: "Hello world",
        selectionStart: 0,
        selectionEnd: 0,
        insertText: token,
      }),
      {
        value: "{{customer_name}}Hello world",
        selectionStart: token.length,
        selectionEnd: token.length,
      }
    );

    assert.deepEqual(
      insertTextAtCursor({
        value: "Hello world",
        selectionStart: 6,
        selectionEnd: 6,
        insertText: token,
      }),
      {
        value: "Hello {{customer_name}}world",
        selectionStart: 6 + token.length,
        selectionEnd: 6 + token.length,
      }
    );

    assert.deepEqual(
      insertTextAtCursor({
        value: "Hello world",
        selectionStart: 11,
        selectionEnd: 11,
        insertText: token,
      }),
      {
        value: "Hello world{{customer_name}}",
        selectionStart: 11 + token.length,
        selectionEnd: 11 + token.length,
      }
    );
  });

  test("replaces selected text with token", () => {
    const result = insertTextAtCursor({
      value: "Hello NAME",
      selectionStart: 6,
      selectionEnd: 10,
      insertText: "{{customer_name}}",
    });
    assert.equal(result.value, "Hello {{customer_name}}");
    assert.equal(result.selectionStart, "{{customer_name}}".length + 6);
  });

  test("inserts into empty document", () => {
    const result = insertTextAtCursor({
      value: "",
      selectionStart: 0,
      selectionEnd: 0,
      insertText: "{{job_address}}",
    });
    assert.equal(result.value, "{{job_address}}");
    assert.equal(result.selectionStart, "{{job_address}}".length);
  });

  test("cursor lands after inserted token", () => {
    const token = "{{customer_name}}";
    const result = insertTextAtCursor({
      value: "Dear ",
      selectionStart: 5,
      selectionEnd: 5,
      insertText: token,
    });
    assert.equal(result.selectionStart, 5 + token.length);
    assert.equal(result.selectionEnd, result.selectionStart);
  });

  test("resolveTextareaInsertionSelection uses end when unfocused", () => {
    assert.deepEqual(
      resolveTextareaInsertionSelection("Hello world", 2, 4, false),
      { selectionStart: 11, selectionEnd: 11 }
    );
  });
});

describe("R14 regression via picker placeholders", () => {
  test("inserted customer_name renders through existing body renderer", () => {
    const placeholder = formatProposalDocumentTokenPlaceholder("customer_name");
    const raw = `Dear ${placeholder},`;
    const result = renderProposalDocumentPageBody(raw, fullContext(), { pricingComplete: true });
    assert.equal(result.displayText, "Dear Jane Smith,");
    assert.deepEqual(result.diagnostics.tokensFound, ["customer_name"]);
  });

  test("pricing token suppressed when pricingComplete is false", () => {
    const placeholder = formatProposalDocumentTokenPlaceholder("proposal_total");
    const raw = `Total: ${placeholder}`;
    const result = renderProposalDocumentPageBody(raw, fullContext(), { pricingComplete: false });
    assert.equal(result.displayText, "Total: ");
    assert.equal(result.diagnostics.moneyTokensSuppressed, 1);
  });
});

describe("persistence guard", () => {
  test("saved body text remains raw token placeholder, not resolved value", () => {
    const raw = "Hello {{customer_name}} at {{job_address}}.";
    assert.equal(normalizeProposalPageBodyMarkdown(raw), raw);
    assert.equal(raw.includes("Jane Smith"), false);
  });
});
