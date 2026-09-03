/**
 * Commercial Wedge final visual gate — Send affordance + no-logo + locality bias wiring.
 * Run: npx tsx --test app/lib/commercialWedgeFinalVisualGate.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { buildProposalSendGateReadinessViewModel } from "./proposalSendGateReadiness";
import type { ProposalSendFreezeReadiness } from "./proposalSendFreezeReadiness";
import { buildProposalCoverViewModel } from "./proposalCoverViewModel";
import type { ProposalDocumentContext } from "./proposalDocumentTokenTypes";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

function readySendFreeze(
  overrides: Partial<ProposalSendFreezeReadiness> = {}
): ProposalSendFreezeReadiness {
  return {
    ready: true,
    blockingReasons: [],
    warnings: ["Company logo is missing from context_echo; cover may use fallback branding."],
    summary: {
      scopeSummary: { hiddenLineCount: 0, excludedLineCount: 0, hiddenPageCount: 0 },
      selectedTemplateOptionId: "opt-a",
      pricingComplete: true,
      blockingLineCount: 0,
      estimatePagePresent: true,
      customerVisiblePageCount: 2,
      hasLatestSentVersion: false,
      displaySettingsResolvable: true,
    },
    ...overrides,
  };
}

describe("final Send visual affordance", () => {
  test("enabled Send uses primary blue treatment distinct from disabled slate", () => {
    const panel = read(
      "app/tools/roofing/proposals/preview/ProposalCustomerPreviewSendGatePanel.tsx"
    );
    assert.match(panel, /SEND_PRIMARY_ENABLED/);
    assert.match(panel, /SEND_PRIMARY_DISABLED/);
    assert.match(panel, /bg-blue-600/);
    assert.match(panel, /text-white/);
    assert.match(panel, /border-blue-300/);
    assert.match(panel, /min-h-\[44px\]/);
    assert.match(panel, /hover:bg-blue-700/);
    assert.match(panel, /data-preview-send-visual=\{canSendProposalEmail \? "enabled" : "disabled"\}/);
    assert.match(
      panel,
      /className=\{canSendProposalEmail \? SEND_PRIMARY_ENABLED : SEND_PRIMARY_DISABLED\}/
    );
    assert.match(panel, /SEND_PRIMARY_DISABLED[\s\S]*bg-slate-200[\s\S]*text-slate-500/);
    // Predicate unchanged — visual only.
    assert.match(panel, /disabled=\{!canSendProposalEmail\}/);
    assert.match(panel, /readiness\.canSend && !actionsLocked && !sendSuccess/);
  });

  test("secondary Send-sheet rows stay non-primary", () => {
    const panel = read(
      "app/tools/roofing/proposals/preview/ProposalCustomerPreviewSendGatePanel.tsx"
    );
    assert.match(panel, /data-preview-send-secondary="link"/);
    assert.match(panel, /data-preview-send-secondary="activity"/);
    assert.match(panel, /SEND_SECONDARY_ROW/);
    assert.doesNotMatch(
      panel,
      /data-preview-send-link-optional[\s\S]{0,80}bg-blue-600/
    );
  });
});

describe("true no-logo fallback", () => {
  test("cover view model with null logo yields initials monogram", () => {
    const vm = buildProposalCoverViewModel(
      {
        company: {
          companyName: "Anderson Roofing",
          companyLogoUrl: null,
          companyPhone: null,
          companyEmail: null,
          companyLicense: null,
          companyAddress: null,
          companyWebsite: null,
          brandPrimaryColor: null,
          brandSecondaryColor: null,
          showLicenseOnCover: false,
        },
        customer: {
          customerId: null,
          customerName: "Jordan Ellis",
          customerEmail: null,
          customerPhone: null,
          customerAddress: null,
        },
        jobName: "1842 Oak Ridge Dr",
        jobAddress: "1842 Oak Ridge Dr, Austin, TX 78704",
        measurementSummary: null,
        proposalNumber: "FD-1",
        proposalTitle: "1842 Oak Ridge Dr",
        templateName: "Standard",
        proposalCreatedDateIso: "2026-09-03T12:00:00.000Z",
        selectedPackage: {
          runtimeOptionId: null,
          packageName: "Standard",
          customerTotalCents: null,
        },
      } as ProposalDocumentContext,
      { pricingComplete: false }
    );
    assert.equal(vm.company.logoUrl, null);
    assert.equal(vm.company.logoMonogram, "AR");
  });

  test("Preview cover renders intentional initials fallback without gray logo box", () => {
    const cover = read(
      "app/tools/roofing/proposals/preview/ProposalCustomerPreviewPacketCover.tsx"
    );
    assert.match(cover, /data-preview-brand-fallback="initials"/);
    assert.doesNotMatch(cover, /bg-slate-100|placeholder logo|Logo missing/i);
  });

  test("no-logo visual harness proves logoUrl absent", () => {
    const harness = read(
      "app/tools/roofing/proposals/preview/no-logo-cover-review/ProposalNoLogoCoverReviewHarness.tsx"
    );
    assert.match(harness, /logoUrl:\s*null/);
    assert.match(harness, /logoMonogram:\s*"AR"/);
    assert.match(harness, /data-preview-nologo-proof="component"/);
    assert.match(harness, /Visual component proof/);
  });

  test("missing logo warning remains non-blocking for Send", () => {
    const vm = buildProposalSendGateReadinessViewModel({
      hasSentSnapshot: false,
      sendFreezeReadiness: readySendFreeze(),
      previewReadiness: { blockingLineCount: 0, pricingComplete: true, warnings: [] },
      recipientEmail: "visual@example.com",
      customerFirstName: "Jordan",
      companyName: "Anderson Roofing",
      projectAddress: null,
      emailDeliveryConfigured: true,
    });
    assert.equal(vm.canSend, true);
  });
});

describe("address autocomplete locality wiring", () => {
  test("New Job passes city/state/ZIP into Places assist", () => {
    const roofing = read("app/tools/roofing/RoofingClient.tsx");
    assert.match(
      roofing,
      /usePlacesAddressAssist\(\s*jobAddress1,\s*placesAssistEnabled,\s*\{\s*city:\s*jobCity,\s*state:\s*jobState,\s*zip:\s*jobZip\s*\}\s*\)/
    );
  });

  test("autocomplete API forwards locality params", () => {
    const route = read("app/api/places/autocomplete/route.ts");
    assert.match(route, /searchParams\.get\("city"\)/);
    assert.match(route, /searchParams\.get\("state"\)/);
    assert.match(route, /searchParams\.get\("zip"\)/);
    assert.match(route, /fetchPlacesAutocomplete\(q, sessionToken, locality\)/);
  });
});
