/**
 * Phase 3 — legacy KV approval + prototype surface cutover.
 * Run: npx tsx --test app/lib/phase3LegacyCutover.test.ts
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  LEGACY_KV_APPROVAL_GONE_MESSAGE,
  legacyDeliveryRouteGoneBody,
} from "./legacyDeliveryRouteRetirement";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const KV_APPROVE_TOMBSTONES = [
  "app/api/approve/route.ts",
  "app/api/approve/[token]/route.ts",
  "app/api/approve/check/route.ts",
  "app/api/approve/confirm/route.ts",
  "app/api/approval/confirm/route.ts",
] as const;

describe("Phase 3 — KV approval writers retired", () => {
  test("gone body remains non-success", () => {
    const body = legacyDeliveryRouteGoneBody(LEGACY_KV_APPROVAL_GONE_MESSAGE);
    assert.equal(body.ok, false);
    assert.equal(body.success, false);
    assert.match(body.message, /retired/i);
  });

  test("legacy KV approve mutate routes return 410 and do not call markApproved", () => {
    for (const rel of KV_APPROVE_TOMBSTONES) {
      const src = read(rel);
      assert.match(src, /status:\s*410/, rel);
      assert.match(src, /legacyDeliveryRouteGoneBody/, rel);
      assert.doesNotMatch(src, /markApproved/, rel);
      assert.doesNotMatch(src, /kv\.set/, rel);
    }
  });

  test("track/open no longer writes KV approval viewedAt", () => {
    const src = read("app/api/track/open/route.ts");
    assert.doesNotMatch(src, /kv\.set/);
    assert.doesNotMatch(src, /viewedAt/);
    assert.doesNotMatch(src, /from ["']@vercel\/kv["']/);
  });

  test("legacy /approve page does not read or write KV", () => {
    const page = read("app/approve/[token]/page.tsx");
    assert.match(page, /data-legacy-approve-retired/);
    assert.doesNotMatch(page, /ensureViewedAt/);
    assert.doesNotMatch(page, /getApprovalRecord/);
    assert.doesNotMatch(page, /markApproved/);
  });

  test("canonical public accept path remains active", () => {
    const accept = read("app/api/proposals/accept/route.ts");
    assert.doesNotMatch(accept, /status:\s*410/);
    assert.match(accept, /proposal_acceptances|acceptance/i);
  });
});

describe("Phase 3 — navigation and dead surfaces", () => {
  test("home CTA opens Jobs Board, not Roofing Estimator wording", () => {
    const home = read("app/page.tsx");
    assert.match(home, /Open Jobs Board/);
    assert.match(home, /\/tools\/roofing\/saved/);
    assert.doesNotMatch(home, /Open Roofing Estimator/);
  });

  test("tools hub Start new job uses packet entry", () => {
    const tools = read("app/tools/page.tsx");
    assert.match(tools, /entry=packet/);
  });

  test("roofing-v2 redirects to Jobs Board", () => {
    const v2 = read("app/tools/roofing-v2/page.tsx");
    assert.match(v2, /redirect\(["']\/tools\/roofing\/saved["']\)/);
    assert.doesNotMatch(v2, /RoofingClientV2/);
  });

  test("orphan roofingEstimates store and Board legacy section are gone", () => {
    assert.equal(existsSync(join(ROOT, "app/lib/roofingEstimates.ts")), false);
    assert.equal(
      existsSync(join(ROOT, "app/tools/roofing/saved/components/JobsBoardLegacySection.tsx")),
      false
    );
    const board = read("app/tools/roofing/saved/SavedClient.tsx");
    assert.doesNotMatch(board, /JobsBoardLegacySection/);
  });

  test("supported Board UI does not call retired 410 email endpoints", () => {
    const board = read("app/tools/roofing/saved/SavedClient.tsx");
    assert.doesNotMatch(board, /onSendFollowUp=\{\(est, kind\) => sendFollowUpEmail/);
    assert.match(board, /onSendFollowUp=\{undefined\}/);
    assert.match(board, /Legacy estimate email send is retired/);
    assert.match(
      board,
      /KV approval batch-status must not mutate estimateStore/
    );
  });

  test("RoofingClient auto-send into estimate/send is disabled", () => {
    const roofing = read("app/tools/roofing/RoofingClient.tsx");
    assert.match(roofing, /Board auto-send into retired \/api\/estimate\/send is disabled/);
    assert.doesNotMatch(
      roofing,
      /sessionStorage\.getItem\("ttai_autoSendEstimateId"\)/
    );
  });

  test("admin customer/price-book writers are quarantined from product nav", () => {
    const nav = read("app/tools/roofing/fieldDiveNavConfig.ts");
    assert.doesNotMatch(nav, /href: "\/admin\/customers"/);
    assert.doesNotMatch(nav, /href: "\/admin\/price-book"/);
    const customers = read("app/admin/customers/page.tsx");
    assert.match(customers, /data-admin-customers-retired/);
    assert.doesNotMatch(customers, /CustomersAdminClient/);
    const priceBook = read("app/admin/price-book/page.tsx");
    assert.match(priceBook, /redirect\(["']\/tools\/roofing\/catalog["']\)/);
  });
});
