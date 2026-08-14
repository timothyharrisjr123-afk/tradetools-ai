import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  PROPOSAL_PACKET_CTA_CONTINUATION,
  PROPOSAL_PACKET_CTA_FOCUS,
  PROPOSAL_PACKET_CTA_PRIMARY,
  PROPOSAL_PACKET_CTA_QUIET,
  PROPOSAL_PACKET_CTA_SECONDARY,
} from "./proposalPacketStyles";

describe("proposal packet V2D1 customer CTA targets", () => {
  test("primary, secondary, continuation, and quiet CTAs enforce 44px min height", () => {
    for (const cls of [
      PROPOSAL_PACKET_CTA_PRIMARY,
      PROPOSAL_PACKET_CTA_SECONDARY,
      PROPOSAL_PACKET_CTA_CONTINUATION,
      PROPOSAL_PACKET_CTA_QUIET,
    ]) {
      assert.match(cls, /min-h-\[44px\]/);
      assert.match(cls, /focus-visible:ring-2/);
    }
    assert.match(PROPOSAL_PACKET_CTA_FOCUS, /focus-visible:ring-2/);
  });

  test("hero owns primary request; closeout uses continuation prominence", () => {
    const hero = readFileSync(
      join(process.cwd(), "app/components/proposal-packet/ProposalPacketHero.tsx"),
      "utf8"
    );
    const closeout = readFileSync(
      join(process.cwd(), "app/components/proposal-packet/ProposalPacketContact.tsx"),
      "utf8"
    );
    const interest = readFileSync(
      join(process.cwd(), "app/components/proposal-packet/ProposalPacketPackageInterestActions.tsx"),
      "utf8"
    );

    assert.match(hero, /requestProminence="primary"/);
    assert.match(closeout, /requestProminence="continuation"/);
    assert.match(interest, /PROPOSAL_PACKET_CTA_CONTINUATION/);
    assert.match(interest, /data-proposal-cta-prominence=\{requestProminence\}/);
  });

  test("compare ask-about uses quiet CTA with full-width 44px target", () => {
    const comparison = readFileSync(
      join(process.cwd(), "app/components/proposal-packet/ProposalPacketComparison.tsx"),
      "utf8"
    );
    assert.match(comparison, /PROPOSAL_PACKET_CTA_QUIET/);
    assert.match(comparison, /data-proposal-cta="ask-about-package"/);
    assert.match(comparison, /min-h-\[44px\]/);
    assert.match(PROPOSAL_PACKET_CTA_QUIET, /\bw-full\b/);
  });
});
