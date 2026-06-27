/**
 * R18D3C3 — proposalDeliveryHistoryClient tests.
 *
 * Run: npx tsx --test app/lib/proposalDeliveryHistoryClient.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import type { ProposalDeliveryHistoryViewModel } from "@/app/lib/proposalDeliveryAttemptViewModel";
import {
  PROPOSAL_DELIVERY_ATTEMPT_SHORT_EXPLANATIONS,
  PROPOSAL_DELIVERY_HISTORY_EMPTY_EXPLANATION,
  PROPOSAL_DELIVERY_HISTORY_EMPTY_TITLE,
} from "@/app/lib/proposalDeliveryAttemptViewModel";
import {
  buildProposalDeliveryHistoryRequestUrl,
  fetchProposalDeliveryHistory,
  formatProposalDeliveryHistoryTimestamp,
  getProposalDeliveryHistoryEarlierAttempts,
  parseProposalDeliveryHistoryResponse,
  proposalDeliveryHistoryContainsForbiddenSerializedFields,
  SEND_GATE_DELIVERY_HISTORY_SECTION_TITLE,
} from "@/app/lib/proposalDeliveryHistoryClient";

const PROPOSAL_ID = "33333333-3333-4333-8333-333333333333";
const JOB_ID = "66666666-6666-4666-8666-666666666666";

function emptyHistoryVm(): ProposalDeliveryHistoryViewModel {
  return {
    isEmpty: true,
    latest: null,
    history: [],
    totalCount: 0,
    emptyStateTitle: PROPOSAL_DELIVERY_HISTORY_EMPTY_TITLE,
    emptyStateExplanation: PROPOSAL_DELIVERY_HISTORY_EMPTY_EXPLANATION,
  };
}

function acceptedHistoryVm(): ProposalDeliveryHistoryViewModel {
  const latest = {
    statusLabel: "Accepted by email provider",
    statusTone: "success" as const,
    resultCategory: "accepted" as const,
    shortExplanation: PROPOSAL_DELIVERY_ATTEMPT_SHORT_EXPLANATIONS.provider_accepted,
    recipientDisplay: "j***@example.com",
    subject: "Your roofing proposal",
    createdAt: "2026-06-26T12:00:00.000Z",
    displayTimestamp: "2026-06-26T12:05:00.000Z",
    bodyPreview: "Please review your proposal.",
    channelLabel: "Email" as const,
    providerLabel: "Resend" as const,
    supportLinkPrefix: "fd_pabc1",
    attemptedAt: "2026-06-26T12:00:00.000Z",
    providerAcceptedAt: "2026-06-26T12:05:00.000Z",
    failedAt: null,
    safeError: null,
  };

  return {
    isEmpty: false,
    latest,
    history: [latest],
    totalCount: 1,
    emptyStateTitle: PROPOSAL_DELIVERY_HISTORY_EMPTY_TITLE,
    emptyStateExplanation: PROPOSAL_DELIVERY_HISTORY_EMPTY_EXPLANATION,
  };
}

function multiHistoryVm(): ProposalDeliveryHistoryViewModel {
  const newer = {
    ...acceptedHistoryVm().latest!,
    subject: "Newer send",
    displayTimestamp: "2026-06-26T14:05:00.000Z",
  };
  const older = {
    ...acceptedHistoryVm().latest!,
    subject: "Older send",
    displayTimestamp: "2026-06-26T10:05:00.000Z",
  };

  return {
    isEmpty: false,
    latest: newer,
    history: [newer, older],
    totalCount: 2,
    emptyStateTitle: PROPOSAL_DELIVERY_HISTORY_EMPTY_TITLE,
    emptyStateExplanation: PROPOSAL_DELIVERY_HISTORY_EMPTY_EXPLANATION,
  };
}

describe("proposalDeliveryHistoryClient helpers", () => {
  test("buildProposalDeliveryHistoryRequestUrl includes proposal and job ids", () => {
    const url = buildProposalDeliveryHistoryRequestUrl(PROPOSAL_ID, JOB_ID);
    assert.match(url, /\/api\/proposals\/delivery-attempts\?/);
    assert.match(url, new RegExp(`proposalId=${PROPOSAL_ID}`));
    assert.match(url, new RegExp(`jobId=${JOB_ID}`));
  });

  test("parse empty history response", () => {
    const parsed = parseProposalDeliveryHistoryResponse({
      ok: true,
      history: emptyHistoryVm(),
    });

    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.history.isEmpty, true);
    assert.equal(parsed.history.emptyStateTitle, PROPOSAL_DELIVERY_HISTORY_EMPTY_TITLE);
  });

  test("parse accepted provider history without customer received claims", () => {
    const parsed = parseProposalDeliveryHistoryResponse({
      ok: true,
      history: acceptedHistoryVm(),
    });

    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;

    assert.equal(parsed.history.latest?.statusLabel, "Accepted by email provider");
    assert.match(
      parsed.history.latest?.shortExplanation ?? "",
      /does not confirm the customer received or opened/i
    );
    assert.doesNotMatch(parsed.history.latest?.shortExplanation ?? "", /Sent to customer/i);
    assert.doesNotMatch(parsed.history.latest?.shortExplanation ?? "", /Customer opened/i);
  });

  test("parse failed history exposes safe error only", () => {
    const parsed = parseProposalDeliveryHistoryResponse({
      ok: true,
      history: {
        ...acceptedHistoryVm(),
        latest: {
          ...acceptedHistoryVm().latest!,
          statusLabel: "Failed",
          statusTone: "error",
          resultCategory: "failed",
          shortExplanation: "Email provider rejected the request.",
          safeError: "Email provider rejected the request.",
        },
        history: [
          {
            ...acceptedHistoryVm().latest!,
            statusLabel: "Failed",
            statusTone: "error",
            resultCategory: "failed",
            shortExplanation: "Email provider rejected the request.",
            safeError: "Email provider rejected the request.",
          },
        ],
      },
    });

    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.history.latest?.shortExplanation, "Email provider rejected the request.");
    assert.equal(parsed.history.latest?.safeError, "Email provider rejected the request.");
  });

  test("getProposalDeliveryHistoryEarlierAttempts keeps newest first and skips latest duplicate", () => {
    const history = multiHistoryVm();
    const earlier = getProposalDeliveryHistoryEarlierAttempts(history);

    assert.equal(history.latest?.subject, "Newer send");
    assert.equal(earlier.length, 1);
    assert.equal(earlier[0]?.subject, "Older send");
  });

  test("parse guarded API error", () => {
    const parsed = parseProposalDeliveryHistoryResponse({ ok: false, error: "invalid_proposal" });
    assert.deepEqual(parsed, { ok: false, error: "invalid_proposal" });
  });

  test("fetchProposalDeliveryHistory returns guarded error on failed response", async () => {
    const result = await fetchProposalDeliveryHistory(
      { proposalId: PROPOSAL_ID, jobId: JOB_ID },
      {
        fetch: async () =>
          ({
            ok: false,
            json: async () => ({ ok: false, error: "invalid_proposal" }),
          }) as Response,
      }
    );

    assert.deepEqual(result, { ok: false, error: "invalid_proposal" });
  });

  test("fetchProposalDeliveryHistory returns history on success", async () => {
    const history = acceptedHistoryVm();
    const result = await fetchProposalDeliveryHistory(
      { proposalId: PROPOSAL_ID, jobId: JOB_ID },
      {
        fetch: async () =>
          ({
            ok: true,
            json: async () => ({ ok: true, history }),
          }) as Response,
      }
    );

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.history.latest?.statusLabel, "Accepted by email provider");
  });

  test("mocked safe history response does not contain forbidden serialized fields", () => {
    assert.equal(proposalDeliveryHistoryContainsForbiddenSerializedFields(acceptedHistoryVm()), false);
    assert.equal(
      proposalDeliveryHistoryContainsForbiddenSerializedFields({
        ok: true,
        history: {
          ...acceptedHistoryVm(),
          id: "55555555-5555-4555-8555-555555555555",
        },
      }),
      true
    );
  });

  test("formatProposalDeliveryHistoryTimestamp returns readable value", () => {
    const formatted = formatProposalDeliveryHistoryTimestamp("2026-06-26T12:05:00.000Z");
    assert.ok(formatted);
    assert.match(formatted ?? "", /2026/);
  });
});

describe("R18D3C3 Preview delivery history UI guardrails", () => {
  test("send gate panel wires delivery history section and refetch after send success", () => {
    const panel = readFileSync(
      new URL(
        "../tools/roofing/proposals/preview/ProposalCustomerPreviewSendGatePanel.tsx",
        import.meta.url
      ),
      "utf8"
    );

    assert.match(panel, /ProposalCustomerPreviewDeliveryHistorySection/);
    assert.match(panel, /deliveryHistoryRefreshKey/);
    assert.match(panel, /setDeliveryHistoryRefreshKey\(\(key\) => key \+ 1\)/);
    assert.doesNotMatch(panel, /Sent to customer|Customer received|Customer opened|Delivered to inbox/i);
  });

  test("delivery history section uses read API and VM copy only", () => {
    const section = readFileSync(
      new URL(
        "../tools/roofing/proposals/preview/ProposalCustomerPreviewDeliveryHistorySection.tsx",
        import.meta.url
      ),
      "utf8"
    );

    assert.match(section, /fetchProposalDeliveryHistory/);
    assert.match(section, /SEND_GATE_DELIVERY_HISTORY_SECTION_TITLE/);
    assert.match(section, /SEND_GATE_DELIVERY_HISTORY_ERROR_MESSAGE/);
    assert.match(section, /SEND_GATE_DELIVERY_HISTORY_LOADING_MESSAGE/);
    assert.match(section, /history\.emptyStateTitle/);
    assert.match(section, /item\.shortExplanation/);
    assert.match(section, /item\.recipientDisplay/);
    assert.doesNotMatch(section, /deliveryAttemptId|provider_message_id|recipient_email_hash/);
    assert.doesNotMatch(section, /Sent to customer|Customer received|Customer opened|Delivered to inbox/i);
  });

  test("client helper stays free of send orchestration imports", () => {
    const source = readFileSync(
      new URL("./proposalDeliveryHistoryClient.ts", import.meta.url),
      "utf8"
    );

    assert.match(source, /PROPOSAL_DELIVERY_HISTORY_API_PATH/);
    assert.doesNotMatch(source, /\/api\/proposals\/send["']/);
    assert.doesNotMatch(source, /sendProposalEmail|mintProposalPublicAccessToken/);
  });
});
