/**
 * Block 5C elevate — "Roofing Proposal Sales Packet".
 *
 * Run: npx tsx --test app/tools/roofing/proposals/preview/*.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import {
  CUSTOMER_PREVIEW_COMPACT_READINESS_COPY,
  CUSTOMER_PREVIEW_DRAFT_NOTICE,
  CUSTOMER_PREVIEW_PAGE_TITLE,
  CUSTOMER_PREVIEW_RETURN_TO_BUILDER_ACTION,
  CUSTOMER_PREVIEW_SEND_SHARING_LABEL,
} from "@/app/lib/proposalBuilderDocumentIa";

function readPreviewSource(rel: string): string {
  return readFileSync(path.join(process.cwd(), "app/tools/roofing/proposals/preview", rel), "utf8");
}

const PACKET_SOURCE_FILES = [
  "ProposalCustomerPreviewClient.tsx",
  "ProposalCustomerPreviewDocument.tsx",
  "ProposalCustomerPreviewPacket.tsx",
  "ProposalCustomerPreviewPacketCover.tsx",
  "ProposalCustomerPreviewPackageStrip.tsx",
  "ProposalCustomerPreviewTrustBridge.tsx",
  "ProposalCustomerPreviewEstimateTable.tsx",
  "ProposalCustomerPreviewPacketSection.tsx",
  "proposalCustomerPacketStyles.ts",
];

const COCKPIT_STRINGS = [
  /readiness checklist/i,
  /sent snapshot/i,
  /needs sent snapshot/i,
  /email delivery is not configured/i,
  /company logo is missing/i,
  /coming later/i,
  /custom text page/i,
  /should be reviewed/i,
  /pricing readiness/i,
  /scope decisions/i,
  /guardrail/i,
  /workbench/i,
  /pricing policy/i,
];

/** Customer-visible packet UI only (excludes Client data-loading imports). */
const CUSTOMER_PACKET_UI_FILES = [
  "ProposalCustomerPreviewPacket.tsx",
  "ProposalCustomerPreviewPacketCover.tsx",
  "ProposalCustomerPreviewPackageStrip.tsx",
  "ProposalCustomerPreviewTrustBridge.tsx",
  "ProposalCustomerPreviewEstimateTable.tsx",
  "ProposalCustomerPreviewPacketSection.tsx",
  "ProposalCustomerPreviewDocument.tsx",
  "proposalCustomerPacketStyles.ts",
];

const ACTION_STRINGS = [
  /Edit quantity/i,
  /Set quantity/i,
  /Remove from proposal/i,
  /\bRestore\b/,
  /Hide from customer/i,
  /row menu/i,
];

const SELECTOR_STRINGS = [
  /\bCurrent\b/,
  /\bAvailable\b/,
  /Choose starting package/i,
  /Choose package/i,
  /Change package/i,
  /Edit package/i,
];

describe("Block 5C elevate — roofing proposal sales packet", () => {
  test("page title and quiet draft status", () => {
    assert.equal(CUSTOMER_PREVIEW_PAGE_TITLE, "Customer proposal preview");
    assert.equal(CUSTOMER_PREVIEW_DRAFT_NOTICE, "Draft preview · Not sent");
    assert.equal(CUSTOMER_PREVIEW_SEND_SHARING_LABEL, "Send / sharing");
  });

  test("premium proposal sales packet root exists", () => {
    const packet = readPreviewSource("ProposalCustomerPreviewPacket.tsx");
    assert.match(packet, /data-preview-customer-document/);
    assert.match(packet, /data-preview-sales-packet/);
    assert.match(packet, /PACKET_PAPER/);
  });

  test("Preview-facing source does not use Builder/workbench visual chrome", () => {
    for (const file of PACKET_SOURCE_FILES) {
      const source = readPreviewSource(file);
      assert.doesNotMatch(source, /WORKBENCH_/, `${file} must not reference WORKBENCH_*`);
      assert.doesNotMatch(source, /BUILDER_CANVAS/, `${file} must not reference BUILDER_CANVAS*`);
      assert.doesNotMatch(source, /BUILDER_STAGE/, `${file} must not reference BUILDER_STAGE`);
      assert.doesNotMatch(
        source,
        /from ["']\.\.\/builder\/proposalBuilderConstants["']/,
        `${file} must not import Builder visual constants`
      );
    }
  });

  test("strong proposal hero and brand band render", () => {
    const cover = readPreviewSource("ProposalCustomerPreviewPacketCover.tsx");
    assert.match(cover, /data-preview-proposal-hero/);
    assert.match(cover, /data-preview-brand-band/);
    assert.match(cover, /PACKET_BRAND_BAND/);
    assert.match(cover, /PACKET_HERO_TITLE/);
    assert.match(cover, /resolveProposalHeroTitle|proposal/);
    assert.match(cover, /Prepared by/);
  });

  test("company identity renders in brand band", () => {
    const cover = readPreviewSource("ProposalCustomerPreviewPacketCover.tsx");
    assert.match(cover, /companyName/);
    assert.match(cover, /logoMonogram|logoUrl/);
    assert.match(cover, /company\.phone/);
  });

  test("prepared-for / project info tiles render", () => {
    const cover = readPreviewSource("ProposalCustomerPreviewPacketCover.tsx");
    assert.match(cover, /Prepared for/);
    assert.match(cover, />Project</);
    assert.match(cover, /data-preview-prepared-for/);
    assert.match(cover, /data-preview-project-info/);
    assert.match(cover, /PACKET_INFO_TILE/);
  });

  test("selected package recommendation renders with includes highlights", () => {
    const strip = readPreviewSource("ProposalCustomerPreviewPackageStrip.tsx");
    assert.match(strip, /Selected for your home/);
    assert.match(strip, /data-preview-package-recommendation/);
    assert.match(strip, /packageHero\.label/);
    assert.match(strip, /packageHero\.description/);
    assert.match(strip, /Includes/);
    assert.match(strip, /packageHero\.bullets/);
    assert.match(strip, /PACKET_PACKAGE_CHECK/);
  });

  test("package section has no selector / edit chrome", () => {
    const strip = readPreviewSource("ProposalCustomerPreviewPackageStrip.tsx");
    for (const pattern of SELECTOR_STRINGS) {
      assert.doesNotMatch(strip, pattern);
    }
    assert.doesNotMatch(strip, /ring-4 ring-blue/);
    assert.doesNotMatch(strip, /from-blue-50\/90/);
  });

  test("trust bridge explains the offer without backend language", () => {
    const bridge = readPreviewSource("ProposalCustomerPreviewTrustBridge.tsx");
    assert.match(bridge, /data-preview-trust-bridge/);
    assert.match(bridge, /measurement report/);
    assert.match(bridge, /itemized estimate/);
    // Assert against rendered copy string, not source comments.
    const copyMatch = bridge.match(/const copy = `([^`]+)`/);
    assert.ok(copyMatch?.[1]);
    for (const pattern of [/snapshot/i, /catalog/i, /pricing policy/i, /scope decision/i]) {
      assert.doesNotMatch(copyMatch![1], pattern);
    }
  });

  test("estimate table renders Item / Qty / Price with sales header treatment", () => {
    const table = readPreviewSource("ProposalCustomerPreviewEstimateTable.tsx");
    assert.match(table, />Item</);
    assert.match(table, />Qty</);
    assert.match(table, />Price</);
    assert.match(table, /data-preview-estimate-table/);
    assert.match(table, /PACKET_ESTIMATE_HEADER_ROW/);
    assert.match(table, /PACKET_ESTIMATE_TABLE_SHELL/);
  });

  test("estimate table has no customer-document actions", () => {
    const table = readPreviewSource("ProposalCustomerPreviewEstimateTable.tsx");
    for (const pattern of ACTION_STRINGS) {
      assert.doesNotMatch(table, pattern);
    }
  });

  test("no backend / manual / needs-quantity labels in customer document", () => {
    for (const file of PACKET_SOURCE_FILES) {
      const source = readPreviewSource(file);
      assert.doesNotMatch(source, /\bmanual quantity\b/i, `${file}`);
      assert.doesNotMatch(source, /needs quantity/i, `${file}`);
      assert.doesNotMatch(source, /Pricing incomplete/i, `${file}`);
    }
  });

  test("totals only when complete", () => {
    const table = readPreviewSource("ProposalCustomerPreviewEstimateTable.tsx");
    assert.match(table, /totals\.show \?/);
    const strip = readPreviewSource("ProposalCustomerPreviewPackageStrip.tsx");
    assert.match(strip, /showTotal/);
  });

  test("placeholder / cockpit copy absent from customer packet UI", () => {
    for (const file of CUSTOMER_PACKET_UI_FILES) {
      const source = readPreviewSource(file);
      for (const pattern of COCKPIT_STRINGS) {
        assert.doesNotMatch(source, pattern, `${file} must not surface ${pattern}`);
      }
    }
  });

  test("Send / sharing closed by default; drawer not under document", () => {
    const client = readPreviewSource("ProposalCustomerPreviewClient.tsx");
    assert.match(client, /setSendSharingOpen\] = useState\(false\)/);
    assert.match(client, /ProposalCustomerPreviewSendSharingDrawer/);
    const drawer = readPreviewSource("ProposalCustomerPreviewSendSharingDrawer.tsx");
    assert.match(drawer, /data-preview-send-sharing-drawer/);
    assert.match(drawer, /hideDeferredActions/);
  });

  test("coming-later Signature/PDF/Payment affordances hidden from packet", () => {
    for (const file of PACKET_SOURCE_FILES) {
      const source = readPreviewSource(file);
      assert.doesNotMatch(source, /Signature/i, `${file}`);
      assert.doesNotMatch(source, /Payment schedule/i, `${file}`);
      assert.doesNotMatch(source, /PDF attachment/i, `${file}`);
    }
  });

  test("readiness strip stays outside customer document", () => {
    assert.match(CUSTOMER_PREVIEW_COMPACT_READINESS_COPY, /quantities before totals are final/i);
    assert.equal(CUSTOMER_PREVIEW_RETURN_TO_BUILDER_ACTION, "Return to Builder");
    const client = readPreviewSource("ProposalCustomerPreviewClient.tsx");
    assert.match(client, /data-preview-compact-readiness/);
    assert.doesNotMatch(client, /data-preview-customer-document/);
  });

  test("packet order: brand hero → package → trust → estimate → content", () => {
    const document = readPreviewSource("ProposalCustomerPreviewDocument.tsx");
    const coverIdx = document.indexOf("ProposalCustomerPreviewPacketCover");
    const packageIdx = document.indexOf("ProposalCustomerPreviewPackageStrip");
    const trustIdx = document.indexOf("ProposalCustomerPreviewTrustBridge");
    const estimateIdx = document.indexOf("ProposalCustomerPreviewEstimateTable");
    const sectionIdx = document.indexOf("ProposalCustomerPreviewPacketSection");
    assert.ok(coverIdx >= 0 && packageIdx > coverIdx);
    assert.ok(trustIdx > packageIdx);
    assert.ok(estimateIdx > trustIdx);
    assert.ok(sectionIdx > estimateIdx);
  });
});
