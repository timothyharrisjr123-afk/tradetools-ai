/**
 * Run: npx tsx --test app/lib/proposalCustomerPacketIncludedScope.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  filterMainIncludedScopeSummaries,
  isMainIncludedScopeCardTitle,
  PROPOSAL_CUSTOMER_PACKET_PERMITS_FEES_SCOPE_TITLE,
  sortMainIncludedScopeSummaries,
} from "./proposalCustomerPacketIncludedScope";
import {
  PROPOSAL_CUSTOMER_PACKET_ASK_QUESTION_CTA,
  PROPOSAL_CUSTOMER_PACKET_REQUEST_PACKAGE_CTA,
  proposalCustomerPacketAskAboutPackageCta,
  proposalCustomerPacketReadyWithPackageHeading,
} from "./proposalCustomerPacketViewModel";

describe("proposalCustomerPacketIncludedScope", () => {
  test("Permits & fees is not a main included scope card", () => {
    assert.equal(isMainIncludedScopeCardTitle(PROPOSAL_CUSTOMER_PACKET_PERMITS_FEES_SCOPE_TITLE), false);
    assert.equal(isMainIncludedScopeCardTitle("Roofing materials"), true);
    assert.equal(isMainIncludedScopeCardTitle("Cleanup & disposal"), true);
  });

  test("filterMainIncludedScopeSummaries drops Permits & fees only", () => {
    const filtered = filterMainIncludedScopeSummaries([
      { title: "Permits & fees", itemCount: 1 },
      { title: "Roofing materials", itemCount: 3 },
      { title: "Installation & labor", itemCount: 2 },
      { title: "Ventilation & flashing", itemCount: 1 },
      { title: "Cleanup & disposal", itemCount: 1 },
    ]);
    assert.deepEqual(
      filtered.map((g) => g.title),
      ["Roofing materials", "Installation & labor", "Ventilation & flashing", "Cleanup & disposal"]
    );
  });

  test("sortMainIncludedScopeSummaries uses customer-value order", () => {
    const sorted = sortMainIncludedScopeSummaries([
      { title: "Cleanup & disposal" },
      { title: "Roofing materials" },
      { title: "Installation & labor" },
      { title: "Ventilation & flashing" },
    ]);
    assert.deepEqual(
      sorted.map((g) => g.title),
      [
        "Roofing materials",
        "Ventilation & flashing",
        "Installation & labor",
        "Cleanup & disposal",
      ]
    );
  });
});

describe("customer package interest copy", () => {
  test("CTA copy is soft interest language without acceptance verbs", () => {
    const copy = [
      PROPOSAL_CUSTOMER_PACKET_REQUEST_PACKAGE_CTA,
      PROPOSAL_CUSTOMER_PACKET_ASK_QUESTION_CTA,
      proposalCustomerPacketAskAboutPackageCta("Standard"),
      proposalCustomerPacketReadyWithPackageHeading("Enhanced"),
    ].join(" ");

    assert.match(copy, /Request this package/);
    assert.match(copy, /Ready to move forward with Enhanced/);
    assert.match(copy, /Ask about Standard/);
    assert.doesNotMatch(copy, /\bAccept\b|\bApprove\b|\bSign\b|\bPay\b|\bSubmit\b|\bLifecycle\b/i);
  });
});
