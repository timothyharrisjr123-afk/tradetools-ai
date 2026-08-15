/**
 * Run: npx tsx --test app/lib/proposalPackagePresentation.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { resolvePackageMeta } from "./proposalPackagePresentation";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("resolvePackageMeta", () => {
  test("Standard gets no runtime hardcoded story", () => {
    const meta = resolvePackageMeta("Standard");
    assert.equal(meta.description, null);
    assert.deepEqual(meta.bullets, []);
    assert.equal(meta.accent, "standard");
  });

  test("Enhanced gets no runtime hardcoded story", () => {
    const meta = resolvePackageMeta("Enhanced");
    assert.equal(meta.description, null);
    assert.deepEqual(meta.bullets, []);
  });

  test("Premium gets no runtime hardcoded story", () => {
    const meta = resolvePackageMeta("Premium");
    assert.equal(meta.description, null);
    assert.deepEqual(meta.bullets, []);
  });

  test("arbitrary package names are first-class", () => {
    const meta = resolvePackageMeta("Good / Better Custom");
    assert.equal(meta.description, null);
    assert.deepEqual(meta.bullets, []);
    assert.equal(meta.accent, "default");
  });

  test("authored description is the narrative source", () => {
    const meta = resolvePackageMeta("Standard", "  Contractor-authored Standard copy.  ");
    assert.equal(meta.description, "Contractor-authored Standard copy.");
    assert.deepEqual(meta.bullets, []);
  });

  test("blank description does not invent marketing copy", () => {
    const meta = resolvePackageMeta("Premium", "   ");
    assert.equal(meta.description, null);
    assert.doesNotMatch(JSON.stringify(meta), /Highest-protection|premium shingles|quality materials/i);
  });

  test("fact lines pass through without name-keyed bullets", () => {
    const meta = resolvePackageMeta("Enhanced", "Stronger weather protection.", [
      "Added Ice & water protection at eaves",
      "Optional: Additional roof ventilation",
    ]);
    assert.equal(meta.description, "Stronger weather protection.");
    assert.deepEqual(meta.bullets, [
      "Added Ice & water protection at eaves",
      "Optional: Additional roof ventilation",
    ]);
  });
});

describe("V2E3 presenter wording", () => {
  test("Preview/packet presenters use selected/current language, not Recommended", () => {
    const root = process.cwd();
    const previewStrip = readFileSync(
      join(root, "app/tools/roofing/proposals/preview/ProposalCustomerPreviewPackageStrip.tsx"),
      "utf8"
    );
    const previewDoc = readFileSync(
      join(root, "app/tools/roofing/proposals/preview/ProposalCustomerPreviewDocument.tsx"),
      "utf8"
    );
    const packetVm = readFileSync(
      join(root, "app/lib/proposalCustomerPacketViewModel.ts"),
      "utf8"
    );
    assert.match(previewStrip, /Selected package/);
    assert.doesNotMatch(previewStrip, />Recommended</);
    assert.doesNotMatch(previewStrip, /Recommended roofing package/);
    assert.doesNotMatch(previewDoc, /Recommended/);
    assert.match(packetVm, /Selected package/);
    assert.doesNotMatch(packetVm, /PROPOSAL_CUSTOMER_PACKET_CURRENT_BADGE = "Recommended"/);
  });
});
