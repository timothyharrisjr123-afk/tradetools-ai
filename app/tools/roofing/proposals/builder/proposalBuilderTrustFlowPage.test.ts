/**
 * Run: npx tsx --test app/tools/roofing/proposals/builder/proposalBuilderTrustFlowPage.test.ts
 *
 * Source-level assertions for Integrated Flow P1 Builder snapshot / refresh trust.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { PROPOSAL_SNAPSHOT_FROZEN_HELPER_COPY } from "@/app/lib/proposalCatalogEconomicsStaleness";

const ROOT = join(process.cwd(), "app/tools/roofing/proposals/builder");

function read(name: string): string {
  return readFileSync(join(ROOT, name), "utf8");
}

describe("Builder trust flow (Integrated Flow P1)", () => {
  test("loads full catalog and surfaces frozen + refresh trust", () => {
    const client = read("ProposalBuilderClient.tsx");
    assert.ok(client.includes("getCatalogItemsByCompany"));
    assert.ok(client.includes("deriveDraftCatalogEconomicsStale"));
    assert.ok(client.includes("formatDraftCatalogEconomicsStaleBanner"));
    assert.ok(client.includes("PROPOSAL_SNAPSHOT_FROZEN_HELPER_COPY"));
    // Block 4C: frozen helper lives under More → Saved pricing details.
    assert.ok(client.includes("savedPricingDetails="));
    const actions = read("ProposalBuilderDisabledActions.tsx");
    assert.ok(actions.includes("data-builder-snapshot-frozen-helper"));
    assert.ok(actions.includes("Saved pricing details"));
    assert.ok(client.includes("data-builder-refresh-draft-pricing"));
    assert.ok(client.includes("handleRefreshDraftPricing"));
    assert.match(PROPOSAL_SNAPSHOT_FROZEN_HELPER_COPY, /frozen draft snapshot/i);
  });

  test("refresh is explicit click action only", () => {
    const client = read("ProposalBuilderClient.tsx");
    assert.ok(client.includes("onClick={handleRefreshDraftPricing}"));
    assert.ok(client.includes("data-builder-refresh-draft-pricing"));
    // No effect that calls refresh without user action.
    assert.equal(/useEffect\([\s\S]{0,200}handleRefreshDraftPricing/m.test(client), false);
  });
});
