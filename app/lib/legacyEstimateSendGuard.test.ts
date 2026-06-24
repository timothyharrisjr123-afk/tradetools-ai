import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { DB_BOARD_JOB_ID_PREFIX } from "./jobBoardAdapter";
import {
  LEGACY_ESTIMATE_SEND_BLOCKED_FOR_DB_MESSAGE,
  validateLegacyEstimateSendPayload,
} from "./legacyEstimateSendGuard";

const PROPOSAL_ID = "22222222-2222-4222-8222-222222222222";
const JOB_ID = "11111111-1111-4111-8111-111111111111";
const LEGACY_ESTIMATE_ID = "33333333-3333-4333-8333-333333333333";

describe("validateLegacyEstimateSendPayload", () => {
  test("allows legitimate legacy saved estimate id", () => {
    const result = validateLegacyEstimateSendPayload({
      savedEstimateId: LEGACY_ESTIMATE_ID,
    });
    assert.equal(result.ok, true);
    assert.equal(result.error, null);
  });

  test("rejects explicit proposalId", () => {
    const result = validateLegacyEstimateSendPayload({
      proposalId: PROPOSAL_ID,
      savedEstimateId: LEGACY_ESTIMATE_ID,
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, LEGACY_ESTIMATE_SEND_BLOCKED_FOR_DB_MESSAGE);
  });

  test("rejects dbProposalRouteContext flag", () => {
    const result = validateLegacyEstimateSendPayload({
      savedEstimateId: LEGACY_ESTIMATE_ID,
      dbProposalRouteContext: true,
    });
    assert.equal(result.ok, false);
  });

  test("rejects synthetic db board saved id prefix", () => {
    const result = validateLegacyEstimateSendPayload({
      savedEstimateId: `${DB_BOARD_JOB_ID_PREFIX}${JOB_ID}`,
    });
    assert.equal(result.ok, false);
  });
});
