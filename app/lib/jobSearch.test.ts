/**
 * Wave A — Stage-1 company job findability.
 * Run: npx tsx --test app/lib/jobSearch.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  JOB_SEARCH_RESULT_LIMIT,
  jobSearchQueryIsActive,
  mapJobSearchRowToResult,
  normalizePhoneDigits,
  parseJobSearchApiPayload,
  prepareJobSearchQuery,
  tokenizeJobSearchQuery,
} from "./jobSearch";
import { buildDbJobCardHref } from "./jobBoardAdapter";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const ROUTE = read("app/api/jobs/search/route.ts");
const SAVED = read("app/tools/roofing/saved/SavedClient.tsx");
const RESULTS = read("app/tools/roofing/saved/components/JobsBoardSearchResults.tsx");
const SQL = read("supabase/migrations/20260830_061_search_company_jobs.sql");

const JOB_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("search matching helpers", () => {
  test("name and email queries stay case-insensitive text", () => {
    assert.equal(prepareJobSearchQuery("  Bob Smith ").text, "bob smith");
    assert.equal(prepareJobSearchQuery("Ava@Roof.COM").text, "ava@roof.com");
    assert.equal(jobSearchQueryIsActive("B"), false);
    assert.equal(jobSearchQueryIsActive("Bo"), true);
  });

  test("phone digits normalize across common formats", () => {
    assert.equal(normalizePhoneDigits("9185551212"), "9185551212");
    assert.equal(normalizePhoneDigits("918-555-1212"), "9185551212");
    assert.equal(normalizePhoneDigits("(918) 555-1212"), "9185551212");
    assert.equal(prepareJobSearchQuery("(918) 555-1212").digits, "9185551212");
  });

  test("address and job identifier queries are preserved", () => {
    assert.equal(prepareJobSearchQuery("123 Main").text, "123 main");
    assert.deepEqual(tokenizeJobSearchQuery("123 Main"), ["123", "main"]);
    assert.deepEqual(tokenizeJobSearchQuery("  Bob   Smith "), ["bob", "smith"]);
    assert.equal(prepareJobSearchQuery(JOB_ID).looksLikeJobId, true);
    assert.equal(prepareJobSearchQuery("123 Main").looksLikeJobId, false);
  });
});

describe("search result model", () => {
  test("maps a job row to recognition fields and Job Card href", () => {
    const result = mapJobSearchRowToResult({
      id: JOB_ID,
      customer_name: "Bob Smith",
      address_formatted: "123 Main St, Tulsa, OK",
      stage: "scheduled",
    });
    assert.ok(result);
    assert.equal(result.customerName, "Bob Smith");
    assert.equal(result.address, "123 Main St, Tulsa, OK");
    assert.equal(result.stageLabel, "Scheduled");
    assert.equal(result.href, buildDbJobCardHref(JOB_ID));
    assert.doesNotMatch(result.href, /loadSaved/);
  });

  test("does not invent payment or future customer truth", () => {
    const result = mapJobSearchRowToResult({
      id: JOB_ID,
      customer_name: "Ava",
      stage: "intake",
    });
    assert.ok(result);
    assert.equal("amount" in result, false);
    assert.equal("proposalStatus" in result, false);
    assert.equal("customerWorkspace" in result, false);
  });

  test("API payload parser enforces the result limit", () => {
    const jobs = Array.from({ length: 40 }, (_, i) => ({
      id: `id-${i}`,
      customerName: "N",
      address: "",
      stage: "intake",
      stageLabel: "Intake",
      href: `/j/${i}`,
    }));
    assert.equal(parseJobSearchApiPayload({ jobs }).length, JOB_SEARCH_RESULT_LIMIT);
  });
});

describe("search authorization and filter independence", () => {
  test("API is authenticated and membership-scoped", () => {
    assert.match(ROUTE, /getUserCompanyId/);
    assert.match(ROUTE, /unauthorized/);
    assert.match(ROUTE, /forbidden/);
    assert.match(ROUTE, /search_company_jobs_v1/);
    assert.doesNotMatch(ROUTE, /p_company_id/);
  });

  test("SQL search ignores Board stage and disposition filters", () => {
    assert.match(SQL, /from public\.jobs j/);
    assert.doesNotMatch(SQL, /j\.stage\s*=/);
    assert.doesNotMatch(SQL, /disposition/);
    assert.match(SAVED, /companyJobSearch\.active/);
    assert.match(SAVED, /JobsBoardSearchResults/);
    assert.match(RESULTS, /Company jobs matching/);
    assert.match(RESULTS, /data-jobs-board-search-open/);
  });

  test("opening a result uses the existing Job Card href", () => {
    assert.match(SAVED, /router\.push\(href\)/);
    assert.match(SAVED, /setCurrentLoadedSavedId\(null\)/);
    assert.doesNotMatch(RESULTS, /loadSaved=/);
  });
});
