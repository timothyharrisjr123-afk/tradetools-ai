/**
 * Proposal PDF Group 3 — customer / public download orchestration + UI locks.
 *
 * Run:
 * npx tsx --test app/lib/proposalPdfPublicDownload.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import {
  CUSTOMER_PDF_DOWNLOAD_LABEL,
  CUSTOMER_PDF_PREPARING_LABEL,
  CUSTOMER_PDF_UNAVAILABLE_MESSAGE,
  buildPublicProposalPdfHref,
  generatePublicProposalPdf,
  publicProposalPdfHttpStatus,
  publicProposalPdfResponseHeaders,
  selectCustomerProposalPdfArtifactType,
  type PublicProposalPdfDeps,
} from "./proposalPdfPublicDownload";
import {
  PROPOSAL_PDF_ARTIFACT_SENT,
  PROPOSAL_PDF_ARTIFACT_SIGNED_FINAL,
  type ProposalPdfSignatureOverlay,
} from "./proposalPdfTypes";
import type { ProposalVersionGraph } from "./proposalRecordStore";
import type { ProposalPdfRenderResult } from "./proposalPdfTypes";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const PROPOSAL_ID = "33333333-3333-4333-8333-333333333333";
const VERSION_V1 = "55555555-5555-4555-8555-555555555555";
const VERSION_V2 = "66666666-6666-4666-8666-666666666666";
const TOKEN_ID = "77777777-7777-4777-8777-777777777777";
const RAW_TOKEN = "public-raw-token-abc123";

function fakeGraph(overrides: {
  versionId?: string;
  companyId?: string;
  proposalId?: string;
  kind?: string;
} = {}): ProposalVersionGraph {
  const versionId = overrides.versionId ?? VERSION_V1;
  const companyId = overrides.companyId ?? COMPANY_ID;
  const proposalId = overrides.proposalId ?? PROPOSAL_ID;
  return {
    proposal: {
      id: proposalId,
      company_id: companyId,
      job_id: "22222222-2222-4222-8222-222222222222",
      customer_id: null,
      template_id: "66666666-6666-4666-8666-666666666666",
      status: "sent",
      current_draft_version_id: versionId,
      latest_sent_version_id: VERSION_V2,
      signed_version_id: null,
      selected_option_id: null,
      measurement_record_id: null,
      pricing_policy_id: null,
      proposal_number: "P-1",
      title: null,
      created_by: null,
      updated_by: null,
      created_at: "2026-08-14T12:00:00.000Z",
      updated_at: "2026-08-14T12:00:00.000Z",
      draft_content_changed_at: "2026-08-14T12:00:00.000Z",
      archived_at: null,
      deleted_at: null,
    },
    version: {
      id: versionId,
      company_id: companyId,
      proposal_id: proposalId,
      version_number: 1,
      version_kind: overrides.kind ?? "sent",
      parent_version_id: null,
      frozen_at: "2026-08-14T16:30:00.000Z",
      context_echo: { company_name: "Harris Roofing", customer_name: "Babby D" },
      policy_echo: {},
      created_by: null,
      created_at: "2026-08-14T12:00:00.000Z",
    },
    pages: [],
    options: [],
    lineItems: [],
    internalSummaries: [],
  } as ProposalVersionGraph;
}

function okResolve(versionId = VERSION_V1) {
  return {
    ok: true as const,
    token_id: TOKEN_ID,
    company_id: COMPANY_ID,
    proposal_id: PROPOSAL_ID,
    proposal_version_id: versionId,
    purpose: "customer_view",
    status: "active",
    expires_at: "2099-01-01T00:00:00.000Z",
  };
}

function signedOverlay(): ProposalPdfSignatureOverlay {
  return {
    status: "signed",
    signerPrintedName: "Babby D",
    acceptedOnLabel: "Accepted Aug 14, 2026",
    signedOnLabel: "Signed Aug 14, 2026",
  };
}

function okRender(partial: Partial<ProposalPdfRenderResult> = {}): ProposalPdfRenderResult {
  return {
    bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    filename: "Harris-Roofing_Babby-D_Proposal_2026-08-14.pdf",
    artifactType: PROPOSAL_PDF_ARTIFACT_SENT,
    proposalVersionId: VERSION_V1,
    pageCount: 1,
    ...partial,
  };
}

describe("selectCustomerProposalPdfArtifactType", () => {
  test("unsigned → sent; exact-version overlay → signed_final", () => {
    assert.equal(selectCustomerProposalPdfArtifactType(null), PROPOSAL_PDF_ARTIFACT_SENT);
    assert.equal(
      selectCustomerProposalPdfArtifactType(signedOverlay()),
      PROPOSAL_PDF_ARTIFACT_SIGNED_FINAL
    );
  });
});

describe("generatePublicProposalPdf", () => {
  test("valid token → PDF for exact bound version (not latest)", async () => {
    let loadedVersion: string | null = null;
    const deps: PublicProposalPdfDeps = {
      resolveToken: async (raw) => {
        assert.equal(raw, RAW_TOKEN);
        return okResolve(VERSION_V1);
      },
      getVersionGraph: async (_c, _p, versionId, options) => {
        assert.equal(options.requireSentVersion, true);
        loadedVersion = versionId;
        assert.equal(versionId, VERSION_V1);
        assert.notEqual(versionId, VERSION_V2);
        return fakeGraph({ versionId: VERSION_V1 });
      },
      loadSignatureOverlay: async () => null,
      readPaymentTerms: async () => null,
      render: async (input) => {
        assert.equal(input.artifactType, PROPOSAL_PDF_ARTIFACT_SENT);
        assert.equal(input.proposalVersionId, VERSION_V1);
        return okRender();
      },
    };
    const result = await generatePublicProposalPdf({ rawToken: RAW_TOKEN, deps });
    assert.equal(result.ok, true);
    assert.equal(loadedVersion, VERSION_V1);
    if (result.ok) {
      assert.equal(result.artifactType, PROPOSAL_PDF_ARTIFACT_SENT);
      assert.equal(result.proposalVersionId, VERSION_V1);
      assert.match(result.filename, /Harris-Roofing_Babby-D_Proposal/);
      assert.doesNotMatch(result.filename, /55555555|public-raw|token/i);
    }
  });

  test("client cannot force latest version — resolve binding wins", async () => {
    const deps: PublicProposalPdfDeps = {
      resolveToken: async () => okResolve(VERSION_V1),
      getVersionGraph: async (_c, _p, versionId) => fakeGraph({ versionId }),
      loadSignatureOverlay: async () => null,
      readPaymentTerms: async () => null,
      render: async (input) => {
        assert.equal(input.proposalVersionId, VERSION_V1);
        return okRender();
      },
    };
    const result = await generatePublicProposalPdf({ rawToken: RAW_TOKEN, deps });
    assert.equal(result.ok, true);
  });

  test("invalid token → unavailable (opaque)", async () => {
    const deps: PublicProposalPdfDeps = {
      resolveToken: async () => ({ ok: false, code: "not_found" }),
      getVersionGraph: async () => {
        throw new Error("must not load graph");
      },
      loadSignatureOverlay: async () => null,
      readPaymentTerms: async () => null,
      render: async () => okRender(),
    };
    assert.deepEqual(await generatePublicProposalPdf({ rawToken: RAW_TOKEN, deps }), {
      ok: false,
      code: "unavailable",
    });
  });

  test("expired token → unavailable", async () => {
    const deps: PublicProposalPdfDeps = {
      resolveToken: async () => ({ ok: false, code: "expired" }),
      getVersionGraph: async () => fakeGraph(),
      loadSignatureOverlay: async () => null,
      readPaymentTerms: async () => null,
      render: async () => okRender(),
    };
    assert.deepEqual(await generatePublicProposalPdf({ rawToken: RAW_TOKEN, deps }), {
      ok: false,
      code: "unavailable",
    });
  });

  test("superseded token → unavailable (no historical bypass)", async () => {
    const deps: PublicProposalPdfDeps = {
      resolveToken: async () => ({ ok: false, code: "superseded" }),
      getVersionGraph: async () => {
        throw new Error("superseded must not load graph");
      },
      loadSignatureOverlay: async () => null,
      readPaymentTerms: async () => null,
      render: async () => okRender(),
    };
    assert.deepEqual(await generatePublicProposalPdf({ rawToken: RAW_TOKEN, deps }), {
      ok: false,
      code: "unavailable",
    });
  });

  test("wrong category / invalid_version → unavailable", async () => {
    for (const code of ["invalid_version", "invalid_binding", "revoked"] as const) {
      const deps: PublicProposalPdfDeps = {
        resolveToken: async () => ({ ok: false, code }),
        getVersionGraph: async () => fakeGraph(),
        loadSignatureOverlay: async () => null,
        readPaymentTerms: async () => null,
        render: async () => okRender(),
      };
      assert.deepEqual(await generatePublicProposalPdf({ rawToken: RAW_TOKEN, deps }), {
        ok: false,
        code: "unavailable",
      });
    }
  });

  test("blank / whitespace token → unavailable", async () => {
    const deps: PublicProposalPdfDeps = {
      resolveToken: async () => {
        throw new Error("blank must not resolve");
      },
      getVersionGraph: async () => fakeGraph(),
      loadSignatureOverlay: async () => null,
      readPaymentTerms: async () => null,
      render: async () => okRender(),
    };
    assert.deepEqual(await generatePublicProposalPdf({ rawToken: "   ", deps }), {
      ok: false,
      code: "unavailable",
    });
  });

  test("signed exact version → signed_final artifact", async () => {
    const deps: PublicProposalPdfDeps = {
      resolveToken: async () => okResolve(VERSION_V1),
      getVersionGraph: async () => fakeGraph({ versionId: VERSION_V1 }),
      loadSignatureOverlay: async (input) => {
        assert.equal(input.proposalVersionId, VERSION_V1);
        return signedOverlay();
      },
      readPaymentTerms: async () => null,
      render: async (input) => {
        assert.equal(input.artifactType, PROPOSAL_PDF_ARTIFACT_SIGNED_FINAL);
        assert.ok(input.signatureOverlay);
        return okRender({
          artifactType: PROPOSAL_PDF_ARTIFACT_SIGNED_FINAL,
          filename: "Harris-Roofing_Babby-D_Proposal_2026-08-14_Signed.pdf",
        });
      },
    };
    const result = await generatePublicProposalPdf({ rawToken: RAW_TOKEN, deps });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.artifactType, PROPOSAL_PDF_ARTIFACT_SIGNED_FINAL);
      assert.match(result.filename, /_Signed\.pdf$/);
    }
  });

  test("signature on another version does not affect this token's artifact", async () => {
    const deps: PublicProposalPdfDeps = {
      resolveToken: async () => okResolve(VERSION_V1),
      getVersionGraph: async () => fakeGraph({ versionId: VERSION_V1 }),
      loadSignatureOverlay: async (input) => {
        // Only v2 is signed — exact v1 has none.
        assert.equal(input.proposalVersionId, VERSION_V1);
        return null;
      },
      readPaymentTerms: async () => null,
      render: async (input) => {
        assert.equal(input.artifactType, PROPOSAL_PDF_ARTIFACT_SENT);
        assert.equal(input.signatureOverlay, null);
        return okRender();
      },
    };
    const result = await generatePublicProposalPdf({ rawToken: RAW_TOKEN, deps });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.artifactType, PROPOSAL_PDF_ARTIFACT_SENT);
    }
  });

  test("content disposition / headers are attachment PDF", () => {
    const headers = publicProposalPdfResponseHeaders(
      "Harris-Roofing_Babby-D_Proposal_2026-08-14.pdf"
    ) as Record<string, string>;
    assert.equal(headers["Content-Type"], "application/pdf");
    assert.match(headers["Content-Disposition"], /attachment/);
    assert.match(headers["Content-Disposition"], /Harris-Roofing_Babby-D_Proposal_2026-08-14\.pdf/);
    assert.doesNotMatch(headers["Content-Disposition"], /55555555|token/i);
  });

  test("href encodes raw token only — no version/artifact query authority", () => {
    const href = buildPublicProposalPdfHref(RAW_TOKEN);
    assert.equal(href, `/api/proposals/public/${encodeURIComponent(RAW_TOKEN)}/pdf`);
    assert.doesNotMatch(href, /artifact|versionId|proposalId/);
  });

  test("http status mapping stays opaque for access failures", () => {
    assert.equal(publicProposalPdfHttpStatus("unavailable"), 404);
    assert.equal(publicProposalPdfHttpStatus("generation_failed"), 500);
  });

  test("render failure → generation_failed without throwing", async () => {
    const deps: PublicProposalPdfDeps = {
      resolveToken: async () => okResolve(VERSION_V1),
      getVersionGraph: async () => fakeGraph({ versionId: VERSION_V1 }),
      loadSignatureOverlay: async () => null,
      readPaymentTerms: async () => null,
      render: async () => {
        throw new Error("boom");
      },
    };
    assert.deepEqual(await generatePublicProposalPdf({ rawToken: RAW_TOKEN, deps }), {
      ok: false,
      code: "generation_failed",
    });
  });
});

describe("labels + quiet product copy", () => {
  test("customer labels are quiet Download PDF / Preparing / local failure", () => {
    assert.equal(CUSTOMER_PDF_DOWNLOAD_LABEL, "Download PDF");
    assert.equal(CUSTOMER_PDF_PREPARING_LABEL, "Preparing PDF…");
    assert.equal(CUSTOMER_PDF_UNAVAILABLE_MESSAGE, "PDF unavailable. Try again.");
  });
});

describe("public route + UI locks", () => {
  test("public PDF route accepts token param and uses server generate", () => {
    const route = readFileSync(
      "app/api/proposals/public/[token]/pdf/route.ts",
      "utf8"
    );
    assert.match(route, /generatePublicProposalPdfForToken/);
    assert.match(route, /params: Promise<\{ token: string \}>/);
    assert.doesNotMatch(route, /proposal_version_id|artifactType|getUserCompanyId/);
    assert.doesNotMatch(route, /req\.json\(\)/);
    assert.match(route, /\{ ok: false \}/);
  });

  test("Save PDF coming-soon replaced by Download PDF on live TopBar", () => {
    const topBar = readFileSync(
      "app/components/proposal-packet/ProposalPacketTopBar.tsx",
      "utf8"
    );
    assert.match(topBar, /downloadPublicProposalPdf/);
    assert.match(topBar, /PROPOSAL_CUSTOMER_PACKET_HEADER_DOWNLOAD_PDF_LABEL|Download PDF/);
    assert.match(topBar, /CUSTOMER_PDF_PREPARING_LABEL/);
    assert.match(topBar, /CUSTOMER_PDF_UNAVAILABLE_MESSAGE/);
    assert.match(topBar, /min-h-\[44px\]/);
    assert.doesNotMatch(topBar, /Save PDF/);
    assert.doesNotMatch(topBar, /Web Share|navigator\.share/);
  });

  test("Header stub activates Download PDF; Share remains deferred", () => {
    const header = readFileSync(
      "app/components/proposal-packet/ProposalPacketHeader.tsx",
      "utf8"
    );
    assert.match(header, /downloadPublicProposalPdf/);
    assert.match(header, /PROPOSAL_CUSTOMER_PACKET_HEADER_DOWNLOAD_PDF_LABEL/);
    assert.match(header, /PROPOSAL_CUSTOMER_PACKET_HEADER_SHARE_LABEL/);
    assert.match(header, /Coming soon/);
    assert.doesNotMatch(header, /Save PDF/);
    assert.doesNotMatch(header, /navigator\.share/);
  });

  test("public packet passes token only in public mode", () => {
    const packet = readFileSync(
      "app/components/proposal-packet/ProposalPacket.tsx",
      "utf8"
    );
    assert.match(
      packet,
      /publicAccessToken=\{mode === "public" \? publicAccessToken : null\}/
    );
  });

  test("draft Preview still has no Download PDF", () => {
    const actionGroup = readFileSync(
      "app/tools/roofing/proposals/preview/ProposalPreviewActionGroup.tsx",
      "utf8"
    );
    assert.doesNotMatch(actionGroup, /Download PDF|proposalPdf|ProposalPreviewPdfActions/);
    const previewHeader = readFileSync(
      "app/tools/roofing/proposals/preview/ProposalPreviewHeader.tsx",
      "utf8"
    );
    assert.doesNotMatch(previewHeader, /downloadPublicProposalPdf/);
  });

  test("Job Card still does not import pdf-lib", () => {
    const jobCard = readFileSync("app/tools/roofing/jobCard/JobCardClient.tsx", "utf8");
    assert.doesNotMatch(jobCard, /pdf-lib|proposalPdf|Download PDF/);
  });

  test("Group 1 renderer reused — no public-specific writer", () => {
    const publicLib = readFileSync("app/lib/proposalPdfPublicDownload.ts", "utf8");
    assert.match(publicLib, /generateContractorProposalPdf/);
    assert.match(publicLib, /renderProposalPdf/);
    assert.doesNotMatch(publicLib, /PDFDocument\.create|pdf-lib/);
    assert.doesNotMatch(publicLib, /RoofingClient/);
  });

  test("no email attachment / storage / migration in public PDF path", () => {
    const publicLib = readFileSync("app/lib/proposalPdfPublicDownload.ts", "utf8");
    const route = readFileSync(
      "app/api/proposals/public/[token]/pdf/route.ts",
      "utf8"
    );
    for (const src of [publicLib, route]) {
      assert.doesNotMatch(src, /storage\.from|upload\(|checksum|artifact_table/);
      assert.doesNotMatch(src, /resend|sendEmail|attachment/i);
      assert.doesNotMatch(src, /\.sql|migration/i);
    }
  });

  test("label constant no longer says Save PDF", () => {
    const vm = readFileSync("app/lib/proposalCustomerPacketViewModel.ts", "utf8");
    assert.match(vm, /PROPOSAL_CUSTOMER_PACKET_HEADER_DOWNLOAD_PDF_LABEL = "Download PDF"/);
    assert.doesNotMatch(vm, /HEADER_SAVE_PDF_LABEL = "Save PDF"/);
  });
});

describe("semantic parity with contractor path", () => {
  test("customer unsigned uses same generateContractorProposalPdf + Group 1 render", () => {
    const publicLib = readFileSync("app/lib/proposalPdfPublicDownload.ts", "utf8");
    const contractor = readFileSync("app/lib/proposalPdfContractorDownload.ts", "utf8");
    assert.match(publicLib, /generateContractorProposalPdf/);
    assert.match(contractor, /buildProposalPdfRenderInput/);
    assert.match(contractor, /renderProposalPdf/);
  });
});
