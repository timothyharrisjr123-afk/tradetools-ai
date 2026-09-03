/**
 * Commercial Wedge Group 1 — FieldDive entry + job-first first-run.
 * Run: npx tsx --test app/lib/commercialWedgeGroup1.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { deriveCompanySetupReadiness } from "./companySetupReadiness";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const LOGIN = read("app/login/page.tsx");
const SIGNUP = read("app/signup/page.tsx");
const EMPTY = read("app/tools/roofing/saved/components/JobsBoardEmptyState.tsx");
const GUIDANCE = read("app/tools/roofing/saved/components/JobsBoardPipelineGuidance.tsx");
const HEADER = read("app/tools/roofing/saved/components/JobsBoardHeader.tsx");
const SAVED = read("app/tools/roofing/saved/SavedClient.tsx");
const NAV = read("app/tools/roofing/fieldDiveNavConfig.ts");

describe("FieldDive auth branding", () => {
  test("login presents FieldDive and not TradeTools AI product identity", () => {
    assert.match(LOGIN, /FieldDive/);
    assert.doesNotMatch(LOGIN, /TradeTools AI/);
    assert.match(LOGIN, /Sign in/);
  });

  test("signup presents FieldDive and not TradeTools AI product identity", () => {
    assert.match(SIGNUP, /FieldDive/);
    assert.doesNotMatch(SIGNUP, /TradeTools AI/);
    assert.match(SIGNUP, /Create account/);
  });

  test("auth pages stay quiet — no wizard, checklist, or AI slogans", () => {
    for (const src of [LOGIN, SIGNUP]) {
      assert.doesNotMatch(src, /Step 1 of|Getting started|Finish setup|confetti|AI-powered|testimonial/i);
    }
  });
});

describe("blank-company Jobs Board is job-first", () => {
  test("empty state primary action is canonical New job", () => {
    assert.match(EMPTY, /data-jobs-board-empty-primary-action/);
    assert.match(EMPTY, /No jobs yet/);
    assert.match(EMPTY, /href="\/tools\/roofing\?entry=packet"/);
    assert.match(EMPTY, /\+ New job/);
    assert.doesNotMatch(EMPTY, /Finish setup first/);
    assert.doesNotMatch(EMPTY, /setupIncomplete|setupPrimaryHref/);
  });

  test("header New job uses the same canonical packet entry", () => {
    assert.match(HEADER, /href="\/tools\/roofing\?entry=packet"/);
    assert.match(HEADER, /\+ New job/);
    assert.doesNotMatch(HEADER, /Quick Job|First Job|Onboarding Job|Demo Job/);
  });

  test("SavedClient does not introduce an alternate job creator", () => {
    assert.doesNotMatch(SAVED, /Quick Job|First Job|Onboarding Job|Demo Job/);
    assert.match(SAVED, /companyNameMissing=\{companySetupReadiness\.showBanner\}/);
  });

  test("setup homework no longer dominates first-run board chrome", () => {
    assert.doesNotMatch(GUIDANCE, /Finish company setup/);
    assert.doesNotMatch(GUIDANCE, /Continue setup/);
    assert.doesNotMatch(GUIDANCE, /data-jobs-board-setup-action-required/);
    assert.match(GUIDANCE, /data-jobs-board-company-identity-ask/);
  });
});

describe("readiness truth preserved without first-run homework", () => {
  test("configured company stays quiet", () => {
    const result = deriveCompanySetupReadiness({
      loading: false,
      companyProfileComplete: true,
      pricingRulesConfigured: true,
      priceBookReady: true,
      proposalTemplatesReady: true,
    });
    assert.equal(result.showBanner, false);
    assert.equal(result.isComplete, true);
  });

  test("partial catalog still reports incomplete system readiness without board banner", () => {
    const result = deriveCompanySetupReadiness({
      loading: false,
      companyProfileComplete: true,
      pricingRulesConfigured: true,
      priceBookReady: false,
      proposalTemplatesReady: false,
    });
    assert.equal(result.showBanner, false);
    assert.equal(result.isComplete, false);
  });

  test("Jobs remains operational home in nav", () => {
    assert.match(NAV, /key:\s*"jobs"/);
    assert.match(NAV, /label:\s*"Jobs"/);
    assert.match(NAV, /href:\s*"\/tools\/roofing\/saved"/);
    assert.doesNotMatch(NAV, /Command Center/);
  });
});
