/**
 * Phase 6 Group 2 — workspace search fidelity + destinations + fail≠empty.
 * Run: npx tsx --test app/lib/workspaceSearch.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { buildDbJobCardHref } from "./jobBoardAdapter";
import {
  buildCustomerWorkspaceHref,
  buildPropertyWorkspaceHref,
} from "./propertyAddressNormalize";
import {
  groupWorkspaceSearchResults,
  mapWorkspaceSearchRowToResult,
  parseWorkspaceSearchApiPayload,
  workspaceSearchEmptyCopy,
} from "./workspaceSearch";

const JOB_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CUST_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROP_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

describe("workspaceSearch helpers", () => {
  test("rejects unknown entity types", () => {
    assert.equal(
      mapWorkspaceSearchRowToResult({
        entity_type: "lead",
        id: JOB_ID,
        primary_label: "Nope",
      }),
      null
    );
  });

  test("maps canonical destinations for job/customer/property", () => {
    const job = mapWorkspaceSearchRowToResult({
      entity_type: "job",
      id: JOB_ID,
      primary_label: "Smith",
      secondary_label: "123 Main",
      job_stage: "intake",
    });
    assert.equal(job?.href, buildDbJobCardHref(JOB_ID));
    assert.equal(job?.type, "job");

    const customer = mapWorkspaceSearchRowToResult({
      entity_type: "customer",
      id: CUST_ID,
      primary_label: "Jane",
      secondary_label: "jane@example.com",
    });
    assert.equal(customer?.href, buildCustomerWorkspaceHref(CUST_ID));

    const property = mapWorkspaceSearchRowToResult({
      entity_type: "property",
      id: PROP_ID,
      primary_label: "123 Main St",
      secondary_label: "Springfield, IL 62701",
    });
    assert.equal(property?.href, buildPropertyWorkspaceHref(PROP_ID));
  });

  test("old/null labels degrade without inventing associations", () => {
    const job = mapWorkspaceSearchRowToResult({
      entity_type: "job",
      id: JOB_ID,
      primary_label: null,
      secondary_label: null,
      job_stage: null,
    });
    assert.equal(job?.primary, "Job");
    assert.equal(job?.secondary, null);
    assert.equal(job?.href, buildDbJobCardHref(JOB_ID));
  });

  test("same-name duplicates keep distinguishing secondary context", () => {
    const a = mapWorkspaceSearchRowToResult({
      entity_type: "customer",
      id: CUST_ID,
      primary_label: "Smith",
      secondary_label: "a@example.com · 555-0100",
    });
    const b = mapWorkspaceSearchRowToResult({
      entity_type: "customer",
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      primary_label: "Smith",
      secondary_label: "b@example.com · 555-0199",
    });
    assert.equal(a?.primary, b?.primary);
    assert.notEqual(a?.secondary, b?.secondary);
    assert.notEqual(a?.id, b?.id);
  });

  test("parses mixed typed API payload and drops unsupported types", () => {
    const results = parseWorkspaceSearchApiPayload({
      ok: true,
      results: [
        {
          type: "job",
          id: JOB_ID,
          primary: "Smith",
          secondary: "123 Main",
          href: buildDbJobCardHref(JOB_ID),
          stage: "intake",
          stageLabel: "Intake",
        },
        {
          type: "customer",
          id: CUST_ID,
          primary: "Jane",
          secondary: "jane@example.com",
          href: buildCustomerWorkspaceHref(CUST_ID),
        },
        {
          type: "property",
          id: PROP_ID,
          primary: "456 Oak",
          secondary: "Town, ST 00000",
          href: buildPropertyWorkspaceHref(PROP_ID),
        },
        { type: "lead", id: "x", primary: "bad", href: "/nope" },
      ],
    });
    assert.equal(results.length, 3);
    const grouped = groupWorkspaceSearchResults(results);
    assert.equal(grouped.jobs.length, 1);
    assert.equal(grouped.customers.length, 1);
    assert.equal(grouped.properties.length, 1);
  });

  test("empty copy stays quiet and distinct from failure copy", () => {
    assert.match(workspaceSearchEmptyCopy("Main"), /No jobs, customers, or properties/);
    const ui = read(
      "app/tools/roofing/saved/components/JobsBoardSearchResults.tsx"
    );
    assert.match(ui, /data-jobs-board-search-loading/);
    assert.match(ui, /data-jobs-board-search-failed/);
    assert.match(ui, /data-jobs-board-search-empty/);
    assert.match(ui, /Could not search right now/);
    assert.equal(ui.includes('status === "ready" && results.length === 0'), true);
    assert.equal(ui.includes('status === "ready" && results.length > 0'), true);
    assert.equal(ui.includes('status === "error"'), true);
  });

  test("no production magic search-failure probe ships", () => {
    const roots = [
      "app/api/search/route.ts",
      "app/lib/workspaceSearch.ts",
      "app/tools/roofing/saved/useWorkspaceSearch.ts",
      "app/tools/roofing/saved/components/JobsBoardSearchResults.tsx",
      "app/tools/roofing/saved/SavedClient.tsx",
    ];
    for (const rel of roots) {
      const src = read(rel);
      assert.doesNotMatch(src, /failprobe/i);
      assert.doesNotMatch(src, /forced.?search.?fail/i);
    }
  });

  test("error status never collapses into empty ready copy", () => {
    const ui = read(
      "app/tools/roofing/saved/components/JobsBoardSearchResults.tsx"
    );
    const failedSlice = ui.slice(
      ui.indexOf("data-jobs-board-search-failed"),
      ui.indexOf("data-jobs-board-search-failed") + 280
    );
    assert.match(failedSlice, /Could not search right now/);
    assert.doesNotMatch(failedSlice, /No jobs, customers|No matches|No results/);
  });

  test("search API stays company-scoped via authenticated RPC", () => {
    const route = read("app/api/search/route.ts");
    assert.match(route, /getUserCompanyId/);
    assert.match(route, /search_company_workspace_v1/);
    assert.match(route, /unauthorized/);
    assert.match(route, /forbidden/);
  });

  test("Board uses workspace search as authoritative typed-find", () => {
    const saved = read("app/tools/roofing/saved/SavedClient.tsx");
    assert.match(saved, /useWorkspaceSearch/);
    assert.match(saved, /companyJobSearch\.active/);
    assert.match(saved, /JobsBoardSearchResults/);
    assert.match(saved, /stashBoardReturnContext/);
    // DB board entries are not typed-filtered when search overlay is active
    assert.match(saved, /const dbBoardSearchFiltered = dbBoardEntries/);
  });

  test("Board card hierarchy is identity → address → action → date/owner", () => {
    const card = read(
      "app/tools/roofing/saved/components/JobsBoardCard.tsx"
    );
    const nameIdx = card.indexOf("{model.customerName}");
    const mapIdx = card.indexOf("<MapPin");
    const attIdx = card.indexOf("model.attention");
    const ownerIdx = card.indexOf("data-board-card-owner");
    assert.ok(nameIdx > 0 && mapIdx > nameIdx && attIdx > mapIdx);
    assert.ok(ownerIdx > attIdx);
  });

  test("List hierarchy prefers action/date/owner over metadata columns", () => {
    const list = read(
      "app/tools/roofing/saved/components/JobsBoardListView.tsx"
    );
    assert.match(list, /data-board-list-owner/);
    const actionTh = list.indexOf(">Action<");
    const updatedTh = list.indexOf(">Updated<");
    const ownerTh = list.indexOf(">Owner<");
    const stageTh = list.indexOf(">Stage<");
    assert.ok(actionTh > 0 && actionTh < updatedTh && updatedTh < ownerTh && ownerTh < stageTh);
    assert.doesNotMatch(list, />Value</);
    assert.doesNotMatch(list, />Status</);
  });
});
