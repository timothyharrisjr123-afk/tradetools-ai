/**
 * Run: npx tsx --test app/lib/proposalBuilderQuantityStatusCopy.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import {
  BUILDER_QUANTITY_SOURCES_RAIL_LABEL,
  BUILDER_QUANTITY_STATUS_HELPER,
  BUILDER_QUANTITY_STATUS_LABEL,
  presentBuilderQuantityStatus,
} from "./proposalBuilderQuantityStatusCopy";
import type { QuantityPreflightTrustSignal } from "./proposalBuilderTrustSignals";

function trust(
  partial: Partial<QuantityPreflightTrustSignal> &
    Pick<QuantityPreflightTrustSignal, "status" | "severity">
): QuantityPreflightTrustSignal {
  return {
    reasonCodes: [],
    shouldBlock: false,
    shouldAutoRefresh: false,
    customerVisible: false,
    ...partial,
  };
}

describe("presentBuilderQuantityStatus", () => {
  test("1. current renders as non-blocking ok copy", () => {
    const view = presentBuilderQuantityStatus(
      trust({ status: "current", severity: "ok" })
    );
    assert.equal(view.label, BUILDER_QUANTITY_SOURCES_RAIL_LABEL);
    assert.equal(view.statusLabel, BUILDER_QUANTITY_STATUS_LABEL.current);
    assert.equal(view.helperText, BUILDER_QUANTITY_STATUS_HELPER.current);
    assert.equal(view.shouldBlock, false);
    assert.equal(view.shouldAutoRefresh, false);
    assert.equal(view.customerVisible, false);
  });

  test("2. unknown renders as non-blocking review copy", () => {
    const view = presentBuilderQuantityStatus(
      trust({ status: "unknown", severity: "neutral" })
    );
    assert.equal(view.statusLabel, BUILDER_QUANTITY_STATUS_LABEL.unknown);
    assert.equal(view.shouldBlock, false);
    assert.equal(view.shouldAutoRefresh, false);
  });

  test("3. stale/needs_review renders as non-blocking changed copy", () => {
    const view = presentBuilderQuantityStatus(
      trust({ status: "stale", severity: "needs_review" })
    );
    assert.equal(view.statusLabel, BUILDER_QUANTITY_STATUS_LABEL.stale);
    assert.equal(view.severity, "needs_review");
    assert.equal(view.shouldBlock, false);
    assert.equal(view.shouldAutoRefresh, false);
  });

  test("4. missing trust falls back to unknown without inventing current", () => {
    const view = presentBuilderQuantityStatus(null);
    assert.equal(view.status, "unknown");
    assert.equal(view.statusLabel, BUILDER_QUANTITY_STATUS_LABEL.unknown);
    assert.equal(view.shouldBlock, false);
  });

  test("5. copy never mentions refresh CTA or send block", () => {
    for (const status of ["current", "unknown", "stale"] as const) {
      const view = presentBuilderQuantityStatus(
        trust({
          status,
          severity:
            status === "current" ? "ok" : status === "stale" ? "needs_review" : "neutral",
        })
      );
      assert.equal(/refresh/i.test(view.statusLabel), false);
      assert.equal(/refresh/i.test(view.helperText), false);
      assert.equal(/block/i.test(view.statusLabel), false);
      assert.equal(/block/i.test(view.helperText), false);
      assert.equal(/send/i.test(view.statusLabel), false);
      assert.equal(/send/i.test(view.helperText), false);
    }
  });
});

describe("Phase 6 Builder quantity status UI wiring", () => {
  test("6. Summary rail renders read-only quantity status from presenter", () => {
    const rail = readFileSync(
      path.join(
        process.cwd(),
        "app/tools/roofing/proposals/builder/ProposalBuilderSummaryRail.tsx"
      ),
      "utf8"
    );
    assert.match(rail, /presentBuilderQuantityStatus/);
    assert.match(rail, /quantityStatus\.label|quantityStatus\.statusLabel/);
    assert.match(rail, /data-builder-quantity-status/);
    assert.match(rail, /quantityPreflightTrust/);
    assert.equal(rail.includes("shouldAutoRefresh &&"), false);
    assert.equal(/onClick=\{[^}]*[Rr]efresh/.test(rail), false);
    assert.equal(rail.includes("quantity_resolution_echo"), false);
  });

  test("7. Client passes trust into Summary rail only", () => {
    const client = readFileSync(
      path.join(
        process.cwd(),
        "app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx"
      ),
      "utf8"
    );
    assert.match(client, /quantityPreflightTrust=\{quantityPreflightTrust\}/);
    assert.equal(client.includes("quantity_resolution_echo"), false);
  });

  test("8. customer preview / public surfaces omit quantity status modules", () => {
    const roots = [
      "app/lib/proposalCustomerPreviewViewModel.ts",
      "app/lib/proposalPublicGraphDto.ts",
      "app/tools/roofing/proposals/builder/ProposalBuilderCustomerPage.tsx",
      "app/tools/roofing/proposals/builder/ProposalBuilderLinePreviewTable.tsx",
      "app/tools/roofing/proposals/builder/ProposalBuilderSectionPreview.tsx",
    ];
    for (const rel of roots) {
      const src = readFileSync(path.join(process.cwd(), rel), "utf8");
      assert.equal(src.includes("proposalBuilderQuantityStatusCopy"), false, rel);
      assert.equal(src.includes("presentBuilderQuantityStatus"), false, rel);
      assert.equal(src.includes("Quantity sources current"), false, rel);
      assert.equal(src.includes("Quantity sources changed"), false, rel);
      assert.equal(src.includes("quantityPreflightTrust"), false, rel);
    }
  });

  test("9. Settings pricing form stays locked; no raw_plus_waste switch", () => {
    const formUtils = readFileSync(
      path.join(process.cwd(), "app/tools/settings/pricing/pricingPolicyFormUtils.ts"),
      "utf8"
    );
    assert.match(formUtils, /LOCKED_WASTE_MODEL/);
    assert.match(formUtils, /adjusted_measurement/);
    const settingsClient = readFileSync(
      path.join(
        process.cwd(),
        "app/tools/settings/pricing/CompanyPricingPolicySettingsClient.tsx"
      ),
      "utf8"
    );
    assert.equal(settingsClient.includes("raw_plus_waste"), false);
    assert.match(settingsClient, /LOCKED_WASTE_MODEL/);
    assert.match(settingsClient, /Waste model/);
  });
});

