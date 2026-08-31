/**
 * Wave A — Jobs Board command-surface honesty.
 * Run: npx tsx --test app/lib/jobsBoardCommandSurface.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { buildJobsBoardCardModel } from "@/app/tools/roofing/saved/jobsBoardUtils";
import type { RoofingEstimate } from "./estimateStore";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const TOOLS = read("app/tools/page.tsx");
const TABS = read("app/tools/roofing/RoofingTabs.tsx");
const ROOFING = read("app/tools/roofing/RoofingClient.tsx");
const SHELL = read("app/tools/roofing/FieldDiveAppShell.tsx");
const CARD = read("app/tools/roofing/saved/components/JobsBoardCard.tsx");
const SAVED = read("app/tools/roofing/saved/SavedClient.tsx");
const HEADER = read("app/tools/roofing/saved/components/JobsBoardHeader.tsx");
const GUIDANCE = read("app/tools/roofing/saved/components/JobsBoardPipelineGuidance.tsx");

describe("command / home language", () => {
  test("product-facing daily home is Jobs Board, not Command Center", () => {
    assert.match(TOOLS, /Open Jobs Board/);
    assert.doesNotMatch(TOOLS, /Command Center/);
    assert.match(TABS, />\s*Jobs\s*</);
    assert.doesNotMatch(TABS, /Command Center/);
    assert.match(ROOFING, /Loaded from Jobs Board/);
    assert.doesNotMatch(ROOFING, /Loaded from Command Center/);
    assert.doesNotMatch(HEADER, /Command Center|Dashboard/);
  });
});

describe("false KPI / notification chrome", () => {
  test("canonical Board does not render RevenueSummary or Business Snapshot", () => {
    assert.doesNotMatch(SAVED, /function RevenueSummary/);
    assert.doesNotMatch(SAVED, /<RevenueSummary/);
    assert.doesNotMatch(SAVED, /Business Snapshot/);
    assert.doesNotMatch(SAVED, /Recommended next action/);
    assert.doesNotMatch(SAVED, /Financial pulse/);
  });

  test("shell Bell and hardcoded user identity are gone", () => {
    assert.doesNotMatch(SHELL, /\bBell\b/);
    assert.doesNotMatch(SHELL, /Notifications/);
    assert.doesNotMatch(SHELL, /Mike Anderson/);
    assert.doesNotMatch(SHELL, />MA</);
    assert.doesNotMatch(SHELL, /Anderson Roofing/);
    assert.match(SHELL, /SignOutButton/);
  });
});

describe("quiet healthy board chrome", () => {
  test("healthy setup state does not render Company setup complete", () => {
    assert.doesNotMatch(GUIDANCE, /Company setup complete/);
    assert.doesNotMatch(GUIDANCE, /CheckCircle2/);
    assert.doesNotMatch(GUIDANCE, /Checking company setup/);
    assert.match(GUIDANCE, /if \(readiness\.loading\) return null/);
    assert.match(GUIDANCE, /if \(!readiness\.showBanner\) return null/);
  });

  test("action-required setup still surfaces a Board intervention", () => {
    assert.match(GUIDANCE, /data-jobs-board-setup-action-required/);
    assert.match(GUIDANCE, /Finish company setup to send proposals/);
    assert.match(GUIDANCE, /Continue setup/);
    assert.doesNotMatch(GUIDANCE, /of \$\{readiness\.totalCount\} complete/);
    assert.doesNotMatch(GUIDANCE, /completeCount/);
  });
});

describe("shell Sign out — one per active context", () => {
  test("desktop sidebar keeps Sign out; header Sign out is mobile-only", () => {
    assert.match(SHELL, /aside[\s\S]*sticky top-0[\s\S]*h-screen[\s\S]*lg:flex[\s\S]*SignOutButton/);
    assert.match(SHELL, /lg:hidden[\s\S]*SignOutButton/);
    // Mobile sheet no longer duplicates Sign out in the drawer footer.
    assert.doesNotMatch(SHELL, /data-fielddive-mobile-nav[\s\S]*mt-auto[\s\S]*SignOutButton/);
    const signOutCount = (SHELL.match(/<SignOutButton/g) || []).length;
    assert.equal(signOutCount, 2);
  });
});

describe("board card truth", () => {
  test("does not invent Unassigned when no assignment exists", () => {
    assert.doesNotMatch(CARD, /return "Unassigned"/);
    const model = buildJobsBoardCardModel(
      { id: "j1", status: "estimate", roofAreaSqFt: 0 } as unknown as RoofingEstimate,
      undefined,
      { columnKey: "estimate" }
    );
    assert.equal(model.assigneeLabel, null);
    assert.equal(model.tasksLabel, "");
  });

  test("shows assignment and task ratio only when real", () => {
    const model = buildJobsBoardCardModel(
      {
        id: "j2",
        status: "estimate",
        assigned_to: "user-1",
        linked_counts: { tasks: 2, completed_tasks: 1 },
      } as unknown as RoofingEstimate,
      undefined,
      { columnKey: "estimate" }
    );
    assert.equal(model.assigneeLabel, "Assigned");
    assert.equal(model.tasksLabel, "1/3");
  });
});

describe("search and lifecycle remain untouched by closeout", () => {
  test("Stage-1 company search wiring stays on the Board", () => {
    assert.match(SAVED, /useWorkspaceSearch/);
    assert.match(SAVED, /JobsBoardSearchResults/);
    assert.match(HEADER, /Search jobs, customers, addresses/);
  });
});
