/**
 * Run: npx tsx --test app/lib/productionRouteSafety.test.ts
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const APP = join(ROOT, "app");
const ROUTE_FILE = /^(?:page|layout|route)\.(?:ts|tsx|js|jsx)$/;
const HARNESS_IMPORT = /\bimport\s+[\s\S]*?\bHarness\b[\s\S]*?\bfrom\s*["']/;
const REVIEW_MARKER =
  /\b(?:visual-only|read-only visual fixture|visual component proof|fixture data only|developer review only|historical payment-workspace fixture)\b/i;

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(absolute);
    return ROUTE_FILE.test(entry.name) ? [absolute] : [];
  });
}

const DEV_HARNESS_SEGMENT = "app/dev-harness/";

function devHarnessSegmentIsProductionGuarded(): boolean {
  const layoutPath = join(APP, "dev-harness", "layout.tsx");
  if (!existsSync(layoutPath)) return false;
  const layout = readFileSync(layoutPath, "utf8");
  return (
    /isInternalReviewSurfaceEnabled\(process\.env\.NODE_ENV\)/.test(layout) &&
    /\bnotFound\(\)/.test(layout)
  );
}

test("production route tree contains no review harness entrypoints", () => {
  const violations: string[] = [];
  const devHarnessGuarded = devHarnessSegmentIsProductionGuarded();
  for (const file of routeFiles(APP)) {
    const path = relative(ROOT, file).replaceAll("\\", "/");
    const source = readFileSync(file, "utf8");
    if (path.startsWith(DEV_HARNESS_SEGMENT) && devHarnessGuarded) continue;
    if (path.includes("/dev-harness/")) violations.push(`${path}: dev-harness route`);
    if (HARNESS_IMPORT.test(source)) violations.push(`${path}: harness import`);
    if (REVIEW_MARKER.test(source)) violations.push(`${path}: review fixture marker`);
  }
  assert.deepEqual(violations, []);
});

test("retired public placeholder routes stay outside the production tree", () => {
  assert.equal(existsSync(join(APP, "ai", "page.tsx")), false);
  assert.equal(existsSync(join(APP, "chat", "page.tsx")), false);
});
