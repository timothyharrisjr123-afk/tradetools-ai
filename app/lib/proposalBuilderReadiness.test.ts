import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  buildJobCardReturnTo,
  buildSetupRouteHref,
  parseInternalReturnTo,
} from "./proposalBuilderReadiness";

const JOB_ID = "11111111-1111-4111-8111-111111111111";

describe("parseInternalReturnTo", () => {
  test("returns internal /tools/ path unchanged", () => {
    const value = `/tools/roofing?entry=job-card&job=${JOB_ID}&tab=proposals`;
    assert.equal(parseInternalReturnTo(value), value);
  });

  test("decodes percent-encoded internal path", () => {
    const decoded = `/tools/roofing?entry=job-card&job=${JOB_ID}&tab=proposals`;
    const encoded = encodeURIComponent(decoded);
    assert.equal(parseInternalReturnTo(encoded), decoded);
  });

  test("rejects null/empty", () => {
    assert.equal(parseInternalReturnTo(null), null);
    assert.equal(parseInternalReturnTo(undefined), null);
    assert.equal(parseInternalReturnTo(""), null);
    assert.equal(parseInternalReturnTo("   "), null);
  });

  test("rejects external and protocol-relative URLs", () => {
    assert.equal(parseInternalReturnTo("https://evil.example.com"), null);
    assert.equal(parseInternalReturnTo("//evil.example.com"), null);
    assert.equal(parseInternalReturnTo("/admin/secret"), null);
    assert.equal(parseInternalReturnTo("javascript:alert(1)"), null);
  });
});

describe("buildSetupRouteHref", () => {
  test("appends returnTo + job + tab and returnTo decodes to job card proposals", () => {
    const href = buildSetupRouteHref("/tools/roofing/catalog", JOB_ID);
    assert.match(href, /^\/tools\/roofing\/catalog\?/);
    assert.match(href, /returnTo=/);
    assert.match(href, new RegExp(`job=${JOB_ID}`));
    assert.match(href, /tab=proposals/);

    const params = new URLSearchParams(href.slice(href.indexOf("?") + 1));
    const returnTo = parseInternalReturnTo(params.get("returnTo"));
    assert.equal(
      returnTo,
      `/tools/roofing?entry=job-card&job=${JOB_ID}&tab=proposals`
    );
  });

  test("returns base href unchanged for invalid job id", () => {
    assert.equal(
      buildSetupRouteHref("/tools/roofing/catalog", "not-a-uuid"),
      "/tools/roofing/catalog"
    );
  });
});

describe("buildJobCardReturnTo", () => {
  test("builds job= path with tab and no legacy params", () => {
    const href = buildJobCardReturnTo(JOB_ID, "proposals");
    assert.equal(
      href,
      `/tools/roofing?entry=job-card&job=${JOB_ID}&tab=proposals`
    );
    assert.doesNotMatch(href, /loadSaved/);
    assert.doesNotMatch(href, /from=board/);
  });
});
