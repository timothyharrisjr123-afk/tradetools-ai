import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  PROPOSAL_CUSTOMER_PACKET_REQUEST_API_SUCCESS_MESSAGE,
  PROPOSAL_CUSTOMER_PACKET_REQUEST_MODAL_INTRO,
  PROPOSAL_CUSTOMER_PACKET_REQUEST_MODAL_TITLE,
  PROPOSAL_CUSTOMER_PACKET_REQUEST_SUCCESS_NEXT,
  PROPOSAL_CUSTOMER_PACKET_REQUEST_SUCCESS_TITLE,
  proposalCustomerPacketRequestSuccessBody,
} from "@/app/lib/proposalCustomerPacketViewModel";

describe("V2D3 public request confirmation copy", () => {
  test("success confirmation is professional and package-specific", () => {
    assert.equal(PROPOSAL_CUSTOMER_PACKET_REQUEST_SUCCESS_TITLE, "Request sent");
    assert.equal(
      proposalCustomerPacketRequestSuccessBody("Anderson Roofing", "Enhanced"),
      "Anderson Roofing received your interest in the Enhanced package."
    );
    assert.equal(
      PROPOSAL_CUSTOMER_PACKET_REQUEST_SUCCESS_NEXT,
      "They'll follow up to confirm details."
    );
    assert.doesNotMatch(PROPOSAL_CUSTOMER_PACKET_REQUEST_API_SUCCESS_MESSAGE, /non-binding/i);
  });

  test("open modal copy stays short and does not lead with legal caveats", () => {
    assert.equal(PROPOSAL_CUSTOMER_PACKET_REQUEST_MODAL_TITLE, "Request this package");
    assert.match(PROPOSAL_CUSTOMER_PACKET_REQUEST_MODAL_INTRO, /interested/i);
    assert.doesNotMatch(PROPOSAL_CUSTOMER_PACKET_REQUEST_MODAL_INTRO, /non-binding/i);
    assert.doesNotMatch(PROPOSAL_CUSTOMER_PACKET_REQUEST_MODAL_INTRO, /review only/i);
  });

  test("modal source removes redundant review-only footer and wires company success body", () => {
    const modal = readFileSync(
      join(process.cwd(), "app/components/proposal-packet/ProposalPacketRequestModal.tsx"),
      "utf8"
    );
    const interest = readFileSync(
      join(process.cwd(), "app/components/proposal-packet/ProposalPacketPackageInterestActions.tsx"),
      "utf8"
    );
    assert.match(modal, /companyName/);
    assert.match(modal, /proposalCustomerPacketRequestSuccessBody/);
    assert.doesNotMatch(modal, /request for review only/i);
    assert.doesNotMatch(modal, /non-binding/i);
    assert.doesNotMatch(interest, /CONFIRM_DETAILS_NOTE/);
    assert.match(interest, /companyName=\{contact\?\.companyName/);
  });
});
