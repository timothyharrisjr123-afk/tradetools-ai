/**
 * V2D5 — count-aware Public package comparison grid.
 * Run: npx tsx --test app/components/proposal-packet/proposalPacketCompareGrid.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  PROPOSAL_PACKET_COMPARE_ROW_THREE,
  PROPOSAL_PACKET_COMPARE_ROW_TWO,
  resolveProposalPacketCompareRowClass,
} from "./proposalPacketStyles";

describe("V2D5 proposal packet compare grid", () => {
  test("1 option is omitted by comparison component (count < 2)", () => {
    const source = readFileSync(
      join(process.cwd(), "app/components/proposal-packet/ProposalPacketComparison.tsx"),
      "utf8"
    );
    assert.match(source, /comparison\.options\.length < 2/);
    assert.match(source, /resolveProposalPacketCompareRowClass\(comparison\.options\.length\)/);
  });

  test("2 options and 4 options use intentional two-column contract", () => {
    assert.equal(resolveProposalPacketCompareRowClass(2), PROPOSAL_PACKET_COMPARE_ROW_TWO);
    assert.equal(resolveProposalPacketCompareRowClass(4), PROPOSAL_PACKET_COMPARE_ROW_TWO);
    assert.match(PROPOSAL_PACKET_COMPARE_ROW_TWO, /\bsm:grid-cols-2\b/);
    assert.doesNotMatch(PROPOSAL_PACKET_COMPARE_ROW_TWO, /lg:grid-cols-3/);
  });

  test("3 options use three-column desktop contract", () => {
    assert.equal(resolveProposalPacketCompareRowClass(3), PROPOSAL_PACKET_COMPARE_ROW_THREE);
    assert.match(PROPOSAL_PACKET_COMPARE_ROW_THREE, /\bsm:grid-cols-2\b/);
    assert.match(PROPOSAL_PACKET_COMPARE_ROW_THREE, /\blg:grid-cols-3\b/);
  });

  test("5+ options use durable three-column wrapping contract", () => {
    assert.equal(resolveProposalPacketCompareRowClass(5), PROPOSAL_PACKET_COMPARE_ROW_THREE);
    assert.equal(resolveProposalPacketCompareRowClass(7), PROPOSAL_PACKET_COMPARE_ROW_THREE);
  });

  test("mobile remains one column via shared base (no forced multi-col below sm)", () => {
    for (const cls of [PROPOSAL_PACKET_COMPARE_ROW_TWO, PROPOSAL_PACKET_COMPARE_ROW_THREE]) {
      assert.match(cls, /^grid /);
      assert.doesNotMatch(cls, /(?:^|\s)grid-cols-[2-9]\b/);
      assert.match(cls, /\bsm:grid-cols-2\b/);
    }
  });

  test("packet still gates comparison behind more than one option", () => {
    const packet = readFileSync(
      join(process.cwd(), "app/components/proposal-packet/ProposalPacket.tsx"),
      "utf8"
    );
    assert.match(
      packet,
      /showComparison = packet\.comparison != null && packet\.comparison\.options\.length > 1/
    );
  });
});
