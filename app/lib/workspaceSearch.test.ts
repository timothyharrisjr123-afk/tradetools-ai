import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildDbJobCardHref } from "./jobBoardAdapter";
import {
  mapWorkspaceSearchRowToResult,
  parseWorkspaceSearchApiPayload,
  workspaceSearchEmptyCopy,
} from "./workspaceSearch";

const JOB_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

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

  test("parses mixed typed API payload", () => {
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
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          primary: "Jane",
          secondary: "jane@example.com",
          href: "/tools/roofing/customers/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        },
        { type: "lead", id: "x", primary: "bad", href: "/nope" },
      ],
    });
    assert.equal(results.length, 2);
    assert.equal(results[0]?.type, "job");
    assert.equal(results[1]?.type, "customer");
  });

  test("empty copy stays quiet", () => {
    assert.match(workspaceSearchEmptyCopy("Main"), /No jobs, customers, or properties/);
  });
});
