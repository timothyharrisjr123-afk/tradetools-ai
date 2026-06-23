/**
 * R17D Phase 2 — proposalScopeDecisionActions tests.
 *
 * Run: npx tsx --test app/lib/proposalScopeDecisionActions.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { ProposalQuantityPreviewContext } from "./proposalBuilderPreview";
import {
  applyManualQuantityScopeDecision,
  clearManualQuantityScopeDecision,
  ProposalScopeDecisionActionError,
  validateManualQuantityInput,
} from "./proposalScopeDecisionActions";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const PROPOSAL_ID = "22222222-2222-4222-8222-222222222222";
const OPTION_ID = "33333333-3333-4333-8333-333333333333";
const TEMPLATE_ITEM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const REFRESH_CONTEXT: { quantity_context: ProposalQuantityPreviewContext | null } = {
  quantity_context: null,
};

describe("validateManualQuantityInput", () => {
  test("accepts positive integers and decimals", () => {
    assert.deepEqual(validateManualQuantityInput(18), { ok: true, quantity: 18 });
    assert.deepEqual(validateManualQuantityInput("22.5"), { ok: true, quantity: 22.5 });
  });

  test("rejects invalid and negative quantities", () => {
    assert.equal(validateManualQuantityInput("").ok, false);
    assert.equal(validateManualQuantityInput("abc").ok, false);
    assert.equal(validateManualQuantityInput(-1).ok, false);
  });
});

describe("applyManualQuantityScopeDecision", () => {
  test("rejects invalid quantity without throwing from store", async () => {
    await assert.rejects(
      () =>
        applyManualQuantityScopeDecision({
          companyId: COMPANY_ID,
          proposalId: PROPOSAL_ID,
          runtimeProposalOptionId: OPTION_ID,
          sourceTemplateItemId: TEMPLATE_ITEM_ID,
          quantity: -3,
          refreshContext: REFRESH_CONTEXT,
        }),
      (err: unknown) => err instanceof ProposalScopeDecisionActionError
    );
  });

  test("rejects empty quantity", async () => {
    await assert.rejects(
      () =>
        applyManualQuantityScopeDecision({
          companyId: COMPANY_ID,
          proposalId: PROPOSAL_ID,
          runtimeProposalOptionId: OPTION_ID,
          sourceTemplateItemId: TEMPLATE_ITEM_ID,
          quantity: "",
          refreshContext: REFRESH_CONTEXT,
        }),
      (err: unknown) => err instanceof ProposalScopeDecisionActionError
    );
  });
});

describe("clearManualQuantityScopeDecision", () => {
  test("rejects missing ids", async () => {
    await assert.rejects(
      () =>
        clearManualQuantityScopeDecision({
          companyId: "",
          proposalId: PROPOSAL_ID,
          runtimeProposalOptionId: OPTION_ID,
          sourceTemplateItemId: TEMPLATE_ITEM_ID,
          refreshContext: REFRESH_CONTEXT,
        }),
      (err: unknown) => err instanceof ProposalScopeDecisionActionError
    );
  });

  test("rejects missing sourceTemplateItemId", async () => {
    await assert.rejects(
      () =>
        clearManualQuantityScopeDecision({
          companyId: COMPANY_ID,
          proposalId: PROPOSAL_ID,
          runtimeProposalOptionId: OPTION_ID,
          sourceTemplateItemId: "",
          refreshContext: REFRESH_CONTEXT,
        }),
      (err: unknown) => err instanceof ProposalScopeDecisionActionError
    );
  });
});
