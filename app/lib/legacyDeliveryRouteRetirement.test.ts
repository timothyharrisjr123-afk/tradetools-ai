/**
 * D2 — Legacy send path closure.
 * Run: npx tsx --test app/lib/legacyDeliveryRouteRetirement.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  LEGACY_DELIVERY_ROUTE_GONE_CODE,
  legacyDeliveryRouteGoneBody,
} from "./legacyDeliveryRouteRetirement";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const TOMBSTONED = [
  "app/api/estimate/send/route.ts",
  "app/api/email/send/route.ts",
  "app/api/email/followup/route.ts",
  "app/api/approve/confirm/route.ts",
] as const;

describe("D2 legacy delivery route retirement", () => {
  test("gone body is explicit and not success", () => {
    const body = legacyDeliveryRouteGoneBody();
    assert.equal(body.ok, false);
    assert.equal(body.success, false);
    assert.equal(body.code, LEGACY_DELIVERY_ROUTE_GONE_CODE);
  });

  test("tombstoned routes return 410 and never import Resend", () => {
    for (const rel of TOMBSTONED) {
      const src = read(rel);
      assert.match(src, /status:\s*410/);
      assert.match(src, /legacyDeliveryRouteGoneBody/);
      assert.doesNotMatch(src, /from ["']resend["']/);
      assert.doesNotMatch(src, /new Resend/);
      assert.doesNotMatch(src, /resend\.emails\.send/);
      assert.doesNotMatch(src, /proposal_delivery_attempts/);
    }
  });

  test("canonical proposal send remains the only audited Resend proposal path", () => {
    const canonical = read("app/api/proposals/send/route.ts");
    assert.match(canonical, /proposal|send/i);
    assert.doesNotMatch(canonical, /status:\s*410/);

    const emailDelivery = read("app/lib/proposalEmailDelivery.ts");
    assert.match(emailDelivery, /resend|Resend|provider/i);
  });

  test("preview send gate still calls canonical /api/proposals/send", () => {
    const panel = read(
      "app/tools/roofing/proposals/preview/ProposalCustomerPreviewSendGatePanel.tsx"
    );
    assert.match(panel, /\/api\/proposals\/send/);
    assert.doesNotMatch(panel, /\/api\/estimate\/send/);
    assert.doesNotMatch(panel, /\/api\/email\/send/);
    assert.doesNotMatch(panel, /\/api\/email\/followup/);
  });
});
