/**
 * R13 — proposalDocumentTokenRegistry tests.
 *
 * Run: npx tsx --test app/lib/proposalDocumentTokenRegistry.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import {
  PROPOSAL_DOCUMENT_TOKEN_REGISTRY,
  PROPOSAL_DOCUMENT_TOKEN_NAMES,
  getProposalDocumentTokenRegistryEntry,
  isAvailableProposalDocumentToken,
} from "./proposalDocumentTokenRegistry";

const R11C_COMPANY_TOKENS = [
  "company_name",
  "company_logo_url",
  "company_phone",
  "company_license",
  "company_address",
  "company_website",
  "brand_primary_color",
  "brand_secondary_color",
  "show_license_on_cover",
] as const;

const R12_CUSTOMER_TOKENS = [
  "customer_name",
  "customer_email",
  "customer_phone",
  "customer_address",
] as const;

const FORBIDDEN_LATER_TOKEN_NAMES = [
  "proposal_expires_date",
  "sales_rep_name",
  "customer_signature_date",
  "payment_due_date",
] as const;

describe("proposalDocumentTokenRegistry", () => {
  test("all R11c company echo fields have available tokens", () => {
    for (const name of R11C_COMPANY_TOKENS) {
      const entry = getProposalDocumentTokenRegistryEntry(name);
      assert.ok(entry, `missing registry entry for ${name}`);
      assert.equal(entry.domain, "company");
      assert.equal(entry.availability, "available");
    }
  });

  test("all R12 customer echo fields have available tokens", () => {
    for (const name of R12_CUSTOMER_TOKENS) {
      const entry = getProposalDocumentTokenRegistryEntry(name);
      assert.ok(entry, `missing registry entry for ${name}`);
      assert.equal(entry.domain, "customer");
      assert.equal(entry.availability, "available");
    }
  });

  test("job_address maps to context_echo.address_formatted", () => {
    const entry = getProposalDocumentTokenRegistryEntry("job_address");
    assert.ok(entry);
    assert.equal(entry.sourcePath, "context_echo.address_formatted");
  });

  test("forbidden/later lifecycle tokens are absent from registry", () => {
    for (const name of FORBIDDEN_LATER_TOKEN_NAMES) {
      assert.equal(getProposalDocumentTokenRegistryEntry(name), null);
      assert.equal(isAvailableProposalDocumentToken(name), false);
    }
  });

  test("all registry entries are available in R13", () => {
    for (const entry of PROPOSAL_DOCUMENT_TOKEN_REGISTRY) {
      assert.equal(entry.availability, "available");
    }
  });

  test("registry names are unique and match PROPOSAL_DOCUMENT_TOKEN_NAMES", () => {
    const names = PROPOSAL_DOCUMENT_TOKEN_REGISTRY.map((e) => e.name);
    assert.equal(new Set(names).size, names.length);
    assert.deepEqual([...PROPOSAL_DOCUMENT_TOKEN_NAMES], names);
  });

  test("registry module has no forbidden imports", () => {
    const source = readFileSync(
      new URL("./proposalDocumentTokenRegistry.ts", import.meta.url),
      "utf8"
    );
    assertForbiddenTokenModuleImports(source);
  });
});

function assertForbiddenTokenModuleImports(source: string): void {
  assert.equal(/from\s+["']@\/app\/lib\/proposalPricingEngine/.test(source), false);
  assert.equal(/from\s+["']@\/app\/lib\/supabaseClient/.test(source), false);
  assert.equal(/from\s+["']@\/app\/lib\/estimateStore/.test(source), false);
  assert.equal(/from\s+["']@\/app\/tools\/roofing\/RoofingClient/.test(source), false);
  assert.equal(/localStorage\./.test(source), false);
}
