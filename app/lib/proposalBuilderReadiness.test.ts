import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  buildJobCardHref,
  buildJobCardReturnTo,
  buildSetupRouteHref,
  deriveProposalBuilderReadiness,
  parseInternalReturnTo,
} from "./proposalBuilderReadiness";
import type { CatalogReadinessSummary } from "./catalogReadiness";
import type { ProposalTemplateReadiness } from "./proposalTemplateTypes";
import type { MeasurementProposalHandoff } from "./measurementProposalHandoff";
import type { JobRecord } from "./jobTypes";

const JOB_ID = "11111111-1111-4111-8111-111111111111";

function catalogReady(): CatalogReadinessSummary {
  return {
    state: "ready_for_templates",
    activeItemCount: 20,
    measurementMappedItemCount: 20,
    pricedItemCount: 20,
    starterDefinitionCount: 16,
  };
}

function templateNotReady(): ProposalTemplateReadiness {
  return {
    status: "needs_items",
    template_count: 1,
    active_template_count: 1,
    option_count: 1,
    section_count: 1,
    item_count: 2,
    linked_catalog_item_count: 2,
    missing_catalog_item_count: 0,
    priced_catalog_item_count: 2,
    missing_required_fields: ["options (need 3)", "linked line items (need 13)"],
  };
}

function measurementReady(): MeasurementProposalHandoff {
  return {
    proposalReady: true,
    blockers: [],
    selectedLabel: "Saved manual",
  } as MeasurementProposalHandoff;
}

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

  test("strips legacy loadSaved and from=board params from returnTo", () => {
    const dirty = `/tools/roofing?entry=job-card&job=${JOB_ID}&loadSaved=abc&from=board&tab=proposals`;
    assert.equal(
      parseInternalReturnTo(dirty),
      `/tools/roofing?entry=job-card&job=${JOB_ID}&tab=proposals`
    );
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

  test("appends returnLabel when provided", () => {
    const href = buildSetupRouteHref("/tools/roofing/templates", JOB_ID, {
      returnLabel: "Babby D",
    });
    assert.match(href, /returnLabel=Babby%20D/);
  });
});

describe("buildJobCardHref", () => {
  test("optional tab=proposals for Builder return", () => {
    assert.equal(
      buildJobCardHref(JOB_ID, { tab: "proposals" }),
      `/tools/roofing?entry=job-card&job=${JOB_ID}&tab=proposals`
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

describe("deriveProposalBuilderReadiness draft handoff", () => {
  test("valid persisted draft does not false-block on company template readiness", () => {
    const result = deriveProposalBuilderReadiness({
      jobIdParam: JOB_ID,
      job: { id: JOB_ID, company_id: "c" } as JobRecord,
      jobLoadComplete: true,
      measurementHandoff: measurementReady(),
      measurementLoadComplete: true,
      catalogReadiness: catalogReady(),
      catalogLoadComplete: true,
      templateReadiness: templateNotReady(),
      templateLoadComplete: true,
      hasValidPersistedDraft: true,
    });

    assert.equal(result.ready, true);
    assert.equal(result.blockedGates.includes("template_not_ready"), false);
    assert.equal(result.primaryGate, null);
  });

  test("setup preview without draft still blocks on template_not_ready", () => {
    const result = deriveProposalBuilderReadiness({
      jobIdParam: JOB_ID,
      job: { id: JOB_ID, company_id: "c" } as JobRecord,
      jobLoadComplete: true,
      measurementHandoff: measurementReady(),
      measurementLoadComplete: true,
      catalogReadiness: catalogReady(),
      catalogLoadComplete: true,
      templateReadiness: templateNotReady(),
      templateLoadComplete: true,
      hasValidPersistedDraft: false,
    });

    assert.equal(result.ready, false);
    assert.equal(result.primaryGate, "template_not_ready");
  });
});
