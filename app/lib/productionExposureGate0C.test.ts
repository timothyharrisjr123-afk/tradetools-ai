/**
 * Run: npx tsx --test app/lib/productionExposureGate0C.test.ts
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, test } from "node:test";
import { isInternalReviewSurfaceEnabled } from "./internalSurfaceGuard";

const ROOT = process.cwd();
const APP = join(ROOT, "app");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const ROUTE_FILE = /^(?:page|layout|route)\.(?:ts|tsx|js|jsx)$/;
const SOURCE_FILE = /\.(?:ts|tsx)$/;

function walk(dir: string, match: RegExp): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) return walk(absolute, match);
    return match.test(entry.name) ? [absolute] : [];
  });
}

const rel = (absolute: string) => relative(ROOT, absolute).replaceAll("\\", "/");

describe("internal review surface guard", () => {
  test("enabled for local development and test runs", () => {
    assert.equal(isInternalReviewSurfaceEnabled("development"), true);
    assert.equal(isInternalReviewSurfaceEnabled("test"), true);
  });

  test("disabled for production and unknown environments", () => {
    assert.equal(isInternalReviewSurfaceEnabled("production"), false);
    assert.equal(isInternalReviewSurfaceEnabled(undefined), false);
    assert.equal(isInternalReviewSurfaceEnabled(""), false);
    assert.equal(isInternalReviewSurfaceEnabled("staging"), false);
  });
});

describe("dev-harness segment is production not-found", () => {
  const layout = read("app/dev-harness/layout.tsx");

  test("segment layout is a server component that calls notFound outside dev/test", () => {
    assert.doesNotMatch(layout, /["']use client["']/);
    assert.match(layout, /import \{ notFound \} from "next\/navigation"/);
    assert.match(
      layout,
      /if \(!isInternalReviewSurfaceEnabled\(process\.env\.NODE_ENV\)\) \{\s*notFound\(\);\s*\}/
    );
    assert.doesNotMatch(layout, /redirect\(|useRouter|window\./);
  });

  test("every dev-harness route entrypoint lives under the guarded segment", () => {
    const outside = walk(APP, ROUTE_FILE)
      .map(rel)
      .filter((path) => path.includes("dev-harness") && !path.startsWith("app/dev-harness/"));
    assert.deepEqual(outside, []);

  });

  test("harness pages load fixtures only inside an inline dev/test branch", () => {
    const pages = walk(join(APP, "dev-harness"), /^page\.tsx$/).map(rel);
    assert.equal(pages.length, 6);
    for (const page of pages) {
      const source = read(page);
      assert.doesNotMatch(source, /["']use client["']/, page);
      const staticImports = [...source.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]);
      assert.deepEqual(
        staticImports.filter((specifier) => specifier !== "react" && specifier !== "next/navigation"),
        [],
        `${page} statically imports harness code`
      );
      assert.match(
        source,
        /if \(process\.env\.NODE_ENV === "development" \|\| process\.env\.NODE_ENV === "test"\) \{\s*const \{ default: \w+ \} = await import\(/,
        page
      );
      assert.match(source, /\}\s*notFound\(\);\s*\}\s*$/, page);
    }
  });
});

describe("/tools/roofing/ai prototype removed", () => {
  test("route entrypoint is absent", () => {
    assert.equal(existsSync(join(APP, "tools", "roofing", "ai", "page.tsx")), false);
  });

  test("no product source links to the removed route", () => {
    const linking = walk(APP, SOURCE_FILE)
      .map(rel)
      .filter((path) => !path.endsWith(".test.ts"))
      .filter((path) => read(path).includes("/tools/roofing/ai"));
    assert.deepEqual(linking, []);
  });

  test("roofing tabs no longer expose the AI Library entry", () => {
    const tabs = read("app/tools/roofing/RoofingTabs.tsx");
    assert.doesNotMatch(tabs, /AI Library/);
    assert.doesNotMatch(tabs, /"ai"/);
  });
});

describe("/tools/roofing-v2 retained as compatibility redirect", () => {
  test("still redirects to Jobs Board and renders no prototype", () => {
    const page = read("app/tools/roofing-v2/page.tsx");
    assert.match(page, /redirect\("\/tools\/roofing\/saved"\)/);
    assert.doesNotMatch(page, /RoofingClientV2/);
  });
});

describe("/api/proposal/generate OpenAI client is request-scoped", () => {
  const route = read("app/api/proposal/generate/route.ts");

  test("no OpenAI client is constructed at module scope", () => {
    const beforeHandler = route.slice(0, route.indexOf("export async function POST"));
    assert.doesNotMatch(beforeHandler, /new OpenAI\(/);
  });

  test("client is constructed after auth and the missing-key 503 guard", () => {
    const handler = route.slice(route.indexOf("export async function POST"));
    const auth = handler.indexOf("resolveContractorCompanySession(");
    const keyGuard = handler.indexOf("OpenAI API key not configured.");
    const construct = handler.indexOf("new OpenAI({ apiKey })");
    const call = handler.indexOf("openai.chat.completions.create(");
    assert.ok(auth > -1 && keyGuard > -1 && construct > -1 && call > -1);
    assert.ok(auth < keyGuard, "auth before key guard");
    assert.ok(keyGuard < construct, "key guard before construction");
    assert.ok(construct < call, "construction before model call");
  });

  test("model, temperature and token budget are unchanged", () => {
    assert.match(route, /model: "gpt-4o-mini"/);
    assert.match(route, /temperature: 0\.8/);
    assert.match(route, /max_tokens: 400/);
  });
});
