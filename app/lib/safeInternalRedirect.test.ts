/**
 * Safe same-origin internal redirect helpers — unit contracts.
 * Run: npx tsx --test app/lib/safeInternalRedirect.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  buildAuthCallbackUrl,
  buildLoginHrefWithReturn,
  buildSignupHrefWithReturn,
  parseSafeInternalRedirect,
  resolveAuthReturnPath,
} from "./safeInternalRedirect";

describe("parseSafeInternalRedirect", () => {
  test("allows app paths with query", () => {
    assert.equal(
      parseSafeInternalRedirect("/tools/roofing?entry=packet"),
      "/tools/roofing?entry=packet"
    );
  });

  test("rejects open redirect patterns", () => {
    assert.equal(parseSafeInternalRedirect("//evil.com"), null);
    assert.equal(parseSafeInternalRedirect("https://evil.com"), null);
    assert.equal(parseSafeInternalRedirect("/foo:bar"), null);
    assert.equal(parseSafeInternalRedirect(""), null);
    assert.equal(parseSafeInternalRedirect(null), null);
  });

  test("resolveAuthReturnPath falls back to home", () => {
    assert.equal(resolveAuthReturnPath("//x"), "/");
    assert.equal(resolveAuthReturnPath("/tools/roofing/usual-roof"), "/tools/roofing/usual-roof");
  });

  test("builders encode safe destinations only", () => {
    assert.equal(buildLoginHrefWithReturn("/"), "/login");
    assert.equal(buildSignupHrefWithReturn("https://evil"), "/signup");
    assert.match(
      buildAuthCallbackUrl("https://app.test", "/tools/roofing"),
      /\/auth\/callback\?redirectTo=/
    );
  });
});
