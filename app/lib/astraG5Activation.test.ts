/**
 * Astra G5 activation + auth return contracts.
 * Run: npx tsx --test app/lib/astraG5Activation.test.ts app/lib/safeInternalRedirect.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  ASTRA_G5_FIRST_JOB_HREF,
  ASTRA_G5_USUAL_ROOF_HREF,
  buildFirstProposalResumeHref,
  formatScopedNextSetupFact,
  resolveSecondProposalSkipsRepeatedSetup,
} from "./astraG5Activation";
import {
  buildAuthCallbackUrl,
  buildLoginHrefWithReturn,
  parseSafeInternalRedirect,
  resolveAuthReturnPath,
} from "./safeInternalRedirect";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

describe("Astra G5 entries", () => {
  test("first job maps to canonical packet only", () => {
    assert.equal(ASTRA_G5_FIRST_JOB_HREF, "/tools/roofing?entry=packet");
    const empty = read("app/tools/roofing/saved/components/JobsBoardEmptyState.tsx");
    assert.match(empty, /ASTRA_G5_FIRST_JOB_HREF|entry=packet/);
    assert.match(empty, /ASTRA_G5_FIRST_JOB_LABEL/);
    assert.doesNotMatch(empty, /createJob\(|onboarding/i);
  });

  test("usual roof is company-level page without fake job", () => {
    assert.equal(ASTRA_G5_USUAL_ROOF_HREF, "/tools/roofing/usual-roof");
    const page = read("app/tools/roofing/usual-roof/page.tsx");
    const client = read("app/tools/roofing/usual-roof/UsualRoofSetupClient.tsx");
    assert.match(page, /UsualRoofSetupClient/);
    assert.match(client, /installDefaultRoofingCatalog/);
    assert.match(client, /installDefaultRoofingProposalTemplates/);
    assert.doesNotMatch(client, /createJob|onboarding_|progressTracker/i);
    assert.match(client, /ASTRA_G5_USUAL_ROOF_HINT|does not invent/);
    // Single invent-prices statement via intro hint — no duplicate standalone line.
    assert.doesNotMatch(client, /ASTRA_G5_NO_INVENTED_PRICES/);
  });

  test("starter catalog defs remain null-priced", () => {
    const defs = read("app/lib/defaultRoofingCatalog.ts");
    assert.match(defs, /unit_price_cents: null/);
  });

  test("resume href derives from job id + prepare flag (no progress model)", () => {
    const href = buildFirstProposalResumeHref("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    assert.match(href, /entry=job-card/);
    assert.match(href, /prepare=1/);
    assert.match(href, /tab=proposals/);
  });

  test("scoped next fact prefers catalog then template then rules then prices", () => {
    assert.equal(
      formatScopedNextSetupFact({
        needsCatalogStructure: true,
        needsTemplateStructure: true,
        needsLinkedPrices: true,
        needsPricingRules: true,
      }),
      "Install starter catalog items for this proposal."
    );
    assert.equal(
      formatScopedNextSetupFact({
        needsCatalogStructure: false,
        needsTemplateStructure: false,
        needsLinkedPrices: true,
        needsPricingRules: false,
      }),
      "Enter selling prices for items on the offered package."
    );
    assert.equal(
      formatScopedNextSetupFact({
        needsCatalogStructure: false,
        needsTemplateStructure: false,
        needsLinkedPrices: false,
        needsPricingRules: false,
      }),
      null
    );
  });

  test("second proposal skips repeated setup when company facts exist", () => {
    assert.equal(
      resolveSecondProposalSkipsRepeatedSetup({
        pricingPolicyConfigured: true,
        linkedLinesNeedPrice: false,
        hasStarterOrPreferredTemplate: true,
      }),
      true
    );
    assert.equal(
      resolveSecondProposalSkipsRepeatedSetup({
        pricingPolicyConfigured: true,
        linkedLinesNeedPrice: true,
        hasStarterOrPreferredTemplate: true,
      }),
      false
    );
  });

  test("create proposal opens Customer Preview (preview-led)", () => {
    const client = read("app/tools/roofing/jobCard/JobCardClient.tsx");
    assert.match(client, /onCreatedProposal/);
    assert.match(client, /buildProposalPreviewHref\(currentJobId, proposalId\)/);
  });

  test("auth callback preserves safe redirectTo", () => {
    const cb = read("app/auth/callback/route.ts");
    assert.match(cb, /resolveAuthReturnPath/);
    assert.match(cb, /redirectTo/);
    assert.doesNotMatch(cb, /NextResponse\.redirect\(new URL\("\/",/);
  });

  test("catalog first-use copy is not a global checklist", () => {
    const checklist = read("app/tools/roofing/catalog/CatalogSetupChecklist.tsx");
    assert.match(checklist, /Next for proposals/);
    assert.doesNotMatch(checklist, /Setup checklist/);
    assert.doesNotMatch(checklist, /<ol/);
  });
});

describe("safeInternalRedirect", () => {
  test("allows internal FieldDive paths", () => {
    assert.equal(
      parseSafeInternalRedirect("/tools/roofing?entry=packet"),
      "/tools/roofing?entry=packet"
    );
    assert.equal(parseSafeInternalRedirect("/tools/roofing/usual-roof"), "/tools/roofing/usual-roof");
    assert.equal(resolveAuthReturnPath(null), "/");
  });

  test("rejects open redirects and foreign origins", () => {
    assert.equal(parseSafeInternalRedirect("https://evil.example/"), null);
    assert.equal(parseSafeInternalRedirect("//evil.example"), null);
    assert.equal(parseSafeInternalRedirect("/\\evil"), null);
    assert.equal(parseSafeInternalRedirect("/tools@evil"), null);
    assert.equal(parseSafeInternalRedirect("javascript:alert(1)"), null);
    assert.equal(parseSafeInternalRedirect("/path:8080"), null);
  });

  test("login and callback URL builders stay internal", () => {
    assert.equal(
      buildLoginHrefWithReturn("/tools/roofing?entry=job-card&job=abc"),
      `/login?redirectTo=${encodeURIComponent("/tools/roofing?entry=job-card&job=abc")}`
    );
    assert.equal(
      buildAuthCallbackUrl("https://app.fielddive.test", "/tools/roofing/usual-roof"),
      `https://app.fielddive.test/auth/callback?redirectTo=${encodeURIComponent("/tools/roofing/usual-roof")}`
    );
    assert.equal(buildAuthCallbackUrl("https://app.fielddive.test", "https://evil"), "https://app.fielddive.test/auth/callback");
  });
});
