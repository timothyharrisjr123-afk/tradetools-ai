/**
 * V2F — previous sent version resolution.
 * Run: npx tsx --test app/lib/proposalSentVersionLineage.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  resolvePreviousSentVersionId,
  sortSentProposalVersionLineageNewestFirst,
} from "./proposalSentVersionLineage";

const V1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const V2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const V3 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

describe("resolvePreviousSentVersionId", () => {
  test("uses version_number before frozen_at", () => {
    const previous = resolvePreviousSentVersionId({
      currentSentVersionId: V3,
      sentVersions: [
        {
          id: V1,
          versionNumber: 1,
          frozenAt: "2026-07-22T00:00:00.000Z",
          createdAt: "2026-07-22T00:00:00.000Z",
        },
        {
          id: V3,
          versionNumber: 3,
          frozenAt: "2026-07-01T00:00:00.000Z",
          createdAt: "2026-07-01T00:00:00.000Z",
        },
        {
          id: V2,
          versionNumber: 2,
          frozenAt: "2026-07-10T00:00:00.000Z",
          createdAt: "2026-07-10T00:00:00.000Z",
        },
      ],
    });
    assert.equal(previous, V2);
  });

  test("first sent version has no previous", () => {
    assert.equal(
      resolvePreviousSentVersionId({
        currentSentVersionId: V1,
        sentVersions: [{ id: V1, versionNumber: 1, frozenAt: "2026-07-01T00:00:00.000Z" }],
      }),
      null
    );
  });

  test("unknown current id does not invent a previous", () => {
    assert.equal(
      resolvePreviousSentVersionId({
        currentSentVersionId: V3,
        sentVersions: [{ id: V1, versionNumber: 1, frozenAt: "2026-07-01T00:00:00.000Z" }],
      }),
      null
    );
  });

  test("newest-first sort is stable for the current pointer", () => {
    const sorted = sortSentProposalVersionLineageNewestFirst([
      { id: V1, versionNumber: 1, frozenAt: "2026-07-01T00:00:00.000Z" },
      { id: V2, versionNumber: 2, frozenAt: "2026-07-10T00:00:00.000Z" },
    ]);
    assert.deepEqual(
      sorted.map((row) => row.id),
      [V2, V1]
    );
  });
});
