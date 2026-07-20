/**
 * Block 5C — "Premium Roofing Proposal Packet" from-scratch redesign.
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
  /message preview/i,
  /coming later/i,
  /custom text page/i,
  /should be reviewed/i,
  /pricing readiness/i,
  /scope decisions/i,
  /guardrail/i,
  /workbench/i,
];

const ACTION_STRINGS = [
  /Edit quantity/i,
  /Set quantity/i,
  /Remove from proposal/i,
  /\bRestore\b/,
  /Hide from customer/i,
  /row menu/i,
  /\bEdit\b/,
  /\bSet\b/,
  /\bRemove\b/,
];

const SELECTOR_STRINGS = [/\bCurrent\b/, /\bAvailable\b/, /Choose starting package/i, /Choose package/i];

describe("Block 5C — premium proposal packet from-scratch redesign", () => {
  test("page title and quiet draft status", () => {
    assert.equal(CUSTOMER_PREVIEW_PAGE_TITLE, "Customer proposal preview");
    assert.equal(CUSTOMER_PREVIEW_DRAFT_NOTICE, "Draft preview · Not sent");
    assert.equal(CUSTOMER_PREVIEW_SEND_SHARING_LABEL, "Send / sharing");
  });

  test("1. packet uses one continuous paper surface with a single outer elevation", () => {
    const packet = readPreviewSource("ProposalCustomerPreviewPacket.tsx");
    const styles = readPreviewSource("proposalCustomerPacketStyles.ts");
    assert.match(packet, /data-preview-customer-document/);
    assert.match(packet, /PACKET_PAPER/);
    assert.match(styles, /shadow-\[/);
    // Only one shadow declaration in the whole styles module — one elevation, not many.
    const shadowMatches = styles.match(/shadow-\[/g) ?? [];
    assert.equal(shadowMatches.length, 1);

    const document = readPreviewSource("ProposalCustomerPreviewDocument.tsx");
    assert.doesNotMatch(document, /rounded-\w+ border/);
    assert.doesNotMatch(document, /shadow-/);
  });

  test("2. Preview-facing source does not use Builder/workbench visual chrome", () => {
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

  test("3. company identity and large proposal hero render", () => {
    const cover = readPreviewSource("ProposalCustomerPreviewPacketCover.tsx");
    assert.match(cover, /companyName/);
    assert.match(cover, /logoMonogram|logoUrl/);
    assert.match(cover, /PACKET_HERO_TITLE/);
    assert.match(cover, /headline/);
  });

  test("4. prepared-for / project two-column row renders", () => {
    const cover = readPreviewSource("ProposalCustomerPreviewPacketCover.tsx");
    assert.match(cover, /Prepared for/);
    assert.match(cover, />Project</);
    assert.match(cover, /customer\.customerName/);
    assert.match(cover, /project\.jobAddress/);
  });

  test("5. package strip renders package name, description, and highlights", () => {
    const strip = readPreviewSource("ProposalCustomerPreviewPackageStrip.tsx");
    assert.match(strip, /Proposed package/);
    assert.match(strip, /packageHero\.label/);
    assert.match(strip, /packageHero\.description/);
    assert.match(strip, /packageHero\.bullets/);
    assert.match(strip, /data-preview-package-strip/);
  });

  test("6. package strip has no selector/edit affordance or mega-card chrome", () => {
    const strip = readPreviewSource("ProposalCustomerPreviewPackageStrip.tsx");
    for (const pattern of SELECTOR_STRINGS) {
      assert.doesNotMatch(strip, pattern);
    }
    assert.doesNotMatch(strip, /<Check/);
    assert.doesNotMatch(strip, /ring-4 ring-blue/);
    assert.doesNotMatch(strip, /from-blue-50/);
    for (const pattern of ACTION_STRINGS) {
      assert.doesNotMatch(strip, pattern);
    }
  });

  test("7. estimate table renders Item / Qty / Price columns", () => {
    const table = readPreviewSource("ProposalCustomerPreviewEstimateTable.tsx");
    assert.match(table, />Item</);
    assert.match(table, />Qty</);
    assert.match(table, />Price</);
    assert.match(table, /data-preview-estimate-table/);
    assert.match(table, /data-preview-estimate-line/);
  });

  test("8. estimate table has no action column, row menu, or edit controls", () => {
    const table = readPreviewSource("ProposalCustomerPreviewEstimateTable.tsx");
    for (const pattern of ACTION_STRINGS) {
      assert.doesNotMatch(table, pattern);
    }
    assert.doesNotMatch(table, /Restore/);
    assert.doesNotMatch(table, /Hide from customer/);
  });

  test("9. no manual quantity / needs quantity labels in the customer document", () => {
    for (const file of PACKET_SOURCE_FILES) {
      const source = readPreviewSource(file);
      assert.doesNotMatch(source, /\bmanual quantity\b/i, `${file} must not surface manual quantity`);
      assert.doesNotMatch(source, /needs quantity/i, `${file} must not surface needs quantity`);
    }
  });

  test("10. totals are omitted from the estimate table when pricing is incomplete", () => {
    const table = readPreviewSource("ProposalCustomerPreviewEstimateTable.tsx");
    assert.match(table, /totals\.show \?/);
  });

  test("11. 'Pricing incomplete' is absent from the customer packet", () => {
    for (const file of PACKET_SOURCE_FILES) {
      const source = readPreviewSource(file);
      assert.doesNotMatch(source, /Pricing incomplete/i, `${file} must not say "Pricing incomplete"`);
    }
  });

  test("12. placeholder/stub content is hidden from the packet composer", () => {
    const document = readPreviewSource("ProposalCustomerPreviewDocument.tsx");
    assert.match(document, /!page\.isEmpty/);
    for (const file of PACKET_SOURCE_FILES) {
      const source = readPreviewSource(file);
      for (const pattern of COCKPIT_STRINGS) {
        assert.doesNotMatch(source, pattern, `${file} must not surface cockpit/placeholder copy`);
      }
    }
  });

  test("13. Send / sharing is closed by default and opens a drawer, not a page below the document", () => {
    const client = readPreviewSource("ProposalCustomerPreviewClient.tsx");
    assert.match(client, /setSendSharingOpen\] = useState\(false\)/);
    assert.match(client, /ProposalCustomerPreviewSendSharingDrawer/);
    assert.doesNotMatch(client, /CONTRACTOR_TOOLS_HEADING/);
    assert.doesNotMatch(client, /border-t border-slate-200\/80 pt-8[\s\S]*ProposalCustomerPreviewPublicAccessPanel/);

    const drawer = readPreviewSource("ProposalCustomerPreviewSendSharingDrawer.tsx");
    assert.match(drawer, /data-preview-send-sharing-drawer/);
    assert.match(drawer, /fixed inset-0/);
    assert.match(drawer, /role="dialog"/);
    assert.match(drawer, /hideDeferredActions/);
    assert.match(drawer, /ProposalCustomerPreviewPublicAccessPanel/);
    assert.match(drawer, /ProposalCustomerPreviewSendGatePanel/);
  });

  test("14. coming-later Signature/PDF/Payment affordances are hidden from the packet", () => {
    for (const file of PACKET_SOURCE_FILES) {
      const source = readPreviewSource(file);
      assert.doesNotMatch(source, /Signature/i, `${file} must not reference Signature`);
      assert.doesNotMatch(source, /Payment schedule/i, `${file} must not reference Payment schedule`);
      assert.doesNotMatch(source, /PDF attachment/i, `${file} must not reference PDF attachment`);
    }
  });

  test("readiness strip is compact, contractor-safe, and outside the customer document", () => {
    assert.match(CUSTOMER_PREVIEW_COMPACT_READINESS_COPY, /quantities before totals are final/i);
    assert.equal(CUSTOMER_PREVIEW_RETURN_TO_BUILDER_ACTION, "Return to Builder");
    const client = readPreviewSource("ProposalCustomerPreviewClient.tsx");
    assert.match(client, /data-preview-compact-readiness/);
    assert.match(client, /CUSTOMER_PREVIEW_COMPACT_READINESS_COPY/);
    assert.match(client, /CUSTOMER_PREVIEW_RETURN_TO_BUILDER_ACTION/);
    assert.doesNotMatch(client, /pricing readiness|guardrail|money token|sent snapshot/i);
    assert.doesNotMatch(client, /data-preview-customer-document/);
  });

  test("packet order: identity → hero → prepared-for/project → package → estimate → content", () => {
    const document = readPreviewSource("ProposalCustomerPreviewDocument.tsx");
    const coverIdx = document.indexOf("ProposalCustomerPreviewPacketCover");
    const packageIdx = document.indexOf("ProposalCustomerPreviewPackageStrip");
    const estimateIdx = document.indexOf("ProposalCustomerPreviewEstimateTable");
    const sectionIdx = document.indexOf("ProposalCustomerPreviewPacketSection");
    assert.ok(coverIdx >= 0 && packageIdx > coverIdx);
    assert.ok(estimateIdx > packageIdx);
    assert.ok(sectionIdx > estimateIdx);
  });

  test("Send / sharing panels hide Coming later when used from Preview drawer", () => {
    const publicPanel = readPreviewSource("ProposalCustomerPreviewPublicAccessPanel.tsx");
    const sendGate = readPreviewSource("ProposalCustomerPreviewSendGatePanel.tsx");
    assert.match(publicPanel, /hideDeferredActions/);
    assert.match(sendGate, /hideDeferredActions/);
    assert.match(publicPanel, /!hideDeferredActions \?/);
    assert.match(sendGate, /!hideDeferredActions \?/);
  });
});
