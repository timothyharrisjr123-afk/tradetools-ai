/**
 * Proposal PDF Group 2 — contractor download orchestration + UI locks.
 *
 * Run:
 * npx tsx --test app/lib/proposalPdfContractorDownload.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import {
  CONTRACTOR_PDF_DOWNLOAD_LABEL,
  CONTRACTOR_PDF_DOWNLOAD_SIGNED_LABEL,
  buildContractorProposalPdfHref,
  contractorProposalPdfHttpStatus,
  contractorProposalPdfResponseHeaders,
  generateContractorProposalPdf,
  parseContractorProposalPdfArtifactType,
  type ContractorProposalPdfDeps,
} from "./proposalPdfContractorDownload";
import {
  PROPOSAL_PDF_ARTIFACT_SENT,
  PROPOSAL_PDF_ARTIFACT_SIGNED_FINAL,
} from "./proposalPdfTypes";
import type { ProposalVersionGraph } from "./proposalRecordStore";
import type { ProposalPdfRenderResult } from "./proposalPdfTypes";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY = "22222222-2222-4222-8222-222222222222";
const PROPOSAL_ID = "33333333-3333-4333-8333-333333333333";
const VERSION_V1 = "55555555-5555-4555-8555-555555555555";
const VERSION_V2 = "66666666-6666-4666-8666-666666666666";

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
      latest_sent_version_id: versionId,
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

describe("parseContractorProposalPdfArtifactType", () => {
  test("defaults to sent and validates artifact types", () => {
    assert.equal(parseContractorProposalPdfArtifactType(null), PROPOSAL_PDF_ARTIFACT_SENT);
    assert.equal(
      parseContractorProposalPdfArtifactType("signed_final_pdf"),
      PROPOSAL_PDF_ARTIFACT_SIGNED_FINAL
    );
    assert.equal(parseContractorProposalPdfArtifactType("draft"), null);
    assert.equal(parseContractorProposalPdfArtifactType("latest"), null);
  });
});

describe("generateContractorProposalPdf", () => {
  test("authenticated member success uses exact version and sent artifact", async () => {
    let loadedVersion: string | null = null;
    const deps: ContractorProposalPdfDeps = {
      getVersionGraph: async (_c, _p, versionId) => {
        loadedVersion = versionId;
        return fakeGraph({ versionId });
      },
      readPaymentTerms: async () => null,
      loadSignatureOverlay: async () => null,
      render: async (input) => {
        assert.equal(input.artifactType, PROPOSAL_PDF_ARTIFACT_SENT);
        assert.equal(input.proposalVersionId, VERSION_V1);
        assert.equal(input.signatureOverlay, null);
        return okRender();
      },
    };
    const result = await generateContractorProposalPdf({
      companyId: COMPANY_ID,
      proposalId: PROPOSAL_ID,
      versionId: VERSION_V1,
      artifactType: PROPOSAL_PDF_ARTIFACT_SENT,
      deps,
    });
    assert.equal(result.ok, true);
    assert.equal(loadedVersion, VERSION_V1);
    if (result.ok) {
      assert.equal(result.filename, "Harris-Roofing_Babby-D_Proposal_2026-08-14.pdf");
      assert.equal(result.artifactType, PROPOSAL_PDF_ARTIFACT_SENT);
    }
  });

  test("historical v1 remains selectable when v2 exists — no latest fallback", async () => {
    const deps: ContractorProposalPdfDeps = {
      getVersionGraph: async (_c, _p, versionId) => {
        assert.equal(versionId, VERSION_V1);
        return fakeGraph({ versionId: VERSION_V1 });
      },
      readPaymentTerms: async () => null,
      loadSignatureOverlay: async () => null,
      render: async (input) => {
        assert.equal(input.proposalVersionId, VERSION_V1);
        return okRender();
      },
    };
    const result = await generateContractorProposalPdf({
      companyId: COMPANY_ID,
      proposalId: PROPOSAL_ID,
      versionId: VERSION_V1,
      artifactType: PROPOSAL_PDF_ARTIFACT_SENT,
      deps,
    });
    assert.equal(result.ok, true);
  });

  test("wrong company / mismatched version returns not_found", async () => {
    const wrongCompany = await generateContractorProposalPdf({
      companyId: OTHER_COMPANY,
      proposalId: PROPOSAL_ID,
      versionId: VERSION_V1,
      artifactType: PROPOSAL_PDF_ARTIFACT_SENT,
      deps: {
        getVersionGraph: async () => fakeGraph({ companyId: COMPANY_ID }),
        readPaymentTerms: async () => null,
        loadSignatureOverlay: async () => null,
        render: async () => okRender(),
      },
    });
    assert.deepEqual(wrongCompany, { ok: false, code: "not_found" });

    const mismatch = await generateContractorProposalPdf({
      companyId: COMPANY_ID,
      proposalId: PROPOSAL_ID,
      versionId: VERSION_V2,
      artifactType: PROPOSAL_PDF_ARTIFACT_SENT,
      deps: {
        getVersionGraph: async () => fakeGraph({ versionId: VERSION_V1 }),
        readPaymentTerms: async () => null,
        loadSignatureOverlay: async () => null,
        render: async () => okRender(),
      },
    });
    assert.deepEqual(mismatch, { ok: false, code: "not_found" });
  });

  test("missing graph (draft/unavailable) returns not_found", async () => {
    const result = await generateContractorProposalPdf({
      companyId: COMPANY_ID,
      proposalId: PROPOSAL_ID,
      versionId: VERSION_V1,
      artifactType: PROPOSAL_PDF_ARTIFACT_SENT,
      deps: {
        getVersionGraph: async () => null,
        readPaymentTerms: async () => null,
        loadSignatureOverlay: async () => null,
        render: async () => okRender(),
      },
    });
    assert.deepEqual(result, { ok: false, code: "not_found" });
  });

  test("signed_final requires exact-version overlay; wrong-version signature fails", async () => {
    const unavailable = await generateContractorProposalPdf({
      companyId: COMPANY_ID,
      proposalId: PROPOSAL_ID,
      versionId: VERSION_V1,
      artifactType: PROPOSAL_PDF_ARTIFACT_SIGNED_FINAL,
      deps: {
        getVersionGraph: async () => fakeGraph(),
        readPaymentTerms: async () => null,
        loadSignatureOverlay: async () => null,
        render: async () => okRender(),
      },
    });
    assert.deepEqual(unavailable, { ok: false, code: "signed_unavailable" });
    assert.equal(contractorProposalPdfHttpStatus("signed_unavailable"), 404);

    const signed = await generateContractorProposalPdf({
      companyId: COMPANY_ID,
      proposalId: PROPOSAL_ID,
      versionId: VERSION_V1,
      artifactType: PROPOSAL_PDF_ARTIFACT_SIGNED_FINAL,
      deps: {
        getVersionGraph: async () => fakeGraph(),
        readPaymentTerms: async () => null,
        loadSignatureOverlay: async () => ({
          status: "signed",
          signerPrintedName: "Babby D",
          acceptedOnLabel: "August 15, 2026",
          signedOnLabel: "August 15, 2026",
          drawnMark: null,
        }),
        render: async (input) => {
          assert.equal(input.artifactType, PROPOSAL_PDF_ARTIFACT_SIGNED_FINAL);
          assert.equal(input.signatureOverlay?.signerPrintedName, "Babby D");
          return okRender({
            artifactType: PROPOSAL_PDF_ARTIFACT_SIGNED_FINAL,
            filename: "Harris-Roofing_Babby-D_Proposal_2026-08-14_Signed.pdf",
          });
        },
      },
    });
    assert.equal(signed.ok, true);
  });

  test("sent artifact never loads signature overlay", async () => {
    let overlayCalled = false;
    const result = await generateContractorProposalPdf({
      companyId: COMPANY_ID,
      proposalId: PROPOSAL_ID,
      versionId: VERSION_V1,
      artifactType: PROPOSAL_PDF_ARTIFACT_SENT,
      deps: {
        getVersionGraph: async () => fakeGraph(),
        readPaymentTerms: async () => null,
        loadSignatureOverlay: async () => {
          overlayCalled = true;
          return {
            status: "signed",
            signerPrintedName: "Babby D",
            acceptedOnLabel: "August 15, 2026",
            signedOnLabel: "August 15, 2026",
          };
        },
        render: async (input) => {
          assert.equal(input.signatureOverlay, null);
          return okRender();
        },
      },
    });
    assert.equal(result.ok, true);
    assert.equal(overlayCalled, false);
  });

  test("invalid ids return invalid_payload without rendering", async () => {
    let rendered = false;
    const result = await generateContractorProposalPdf({
      companyId: "not-a-uuid",
      proposalId: PROPOSAL_ID,
      versionId: VERSION_V1,
      artifactType: PROPOSAL_PDF_ARTIFACT_SENT,
      deps: {
        getVersionGraph: async () => fakeGraph(),
        readPaymentTerms: async () => null,
        loadSignatureOverlay: async () => null,
        render: async () => {
          rendered = true;
          return okRender();
        },
      },
    });
    assert.deepEqual(result, { ok: false, code: "invalid_payload" });
    assert.equal(rendered, false);
  });

  test("generation failure maps to generation_failed without raw leak shape", async () => {
    const result = await generateContractorProposalPdf({
      companyId: COMPANY_ID,
      proposalId: PROPOSAL_ID,
      versionId: VERSION_V1,
      artifactType: PROPOSAL_PDF_ARTIFACT_SENT,
      deps: {
        getVersionGraph: async () => fakeGraph(),
        readPaymentTerms: async () => null,
        loadSignatureOverlay: async () => null,
        render: async () => {
          throw new Error("secret provider stack");
        },
      },
    });
    assert.deepEqual(result, { ok: false, code: "generation_failed" });
  });
});

describe("contractor PDF response helpers", () => {
  test("href binds proposal + version and optional artifact", () => {
    assert.equal(
      buildContractorProposalPdfHref({
        proposalId: PROPOSAL_ID,
        versionId: VERSION_V1,
      }),
      `/api/proposals/${PROPOSAL_ID}/versions/${VERSION_V1}/pdf`
    );
    assert.match(
      buildContractorProposalPdfHref({
        proposalId: PROPOSAL_ID,
        versionId: VERSION_V1,
        artifactType: PROPOSAL_PDF_ARTIFACT_SIGNED_FINAL,
      }),
      /artifact=signed_final_pdf/
    );
  });

  test("headers are application/pdf attachment with sanitized filename", () => {
    const headers = contractorProposalPdfResponseHeaders(
      "Harris-Roofing_Babby-D_Proposal_2026-08-14.pdf"
    ) as Record<string, string>;
    assert.equal(headers["Content-Type"], "application/pdf");
    assert.match(headers["Content-Disposition"], /attachment/);
    assert.match(headers["Content-Disposition"], /Harris-Roofing_Babby-D_Proposal_2026-08-14\.pdf/);
    assert.equal(headers["Cache-Control"], "no-store");
  });
});

describe("contractor PDF UI locks", () => {
  test("labels are quiet and professional", () => {
    assert.equal(CONTRACTOR_PDF_DOWNLOAD_LABEL, "Download PDF");
    assert.equal(CONTRACTOR_PDF_DOWNLOAD_SIGNED_LABEL, "Download signed PDF");
  });

  test("draft Preview action group still has no Download PDF", () => {
    const actions = readFileSync(
      "app/tools/roofing/proposals/preview/ProposalPreviewActionGroup.tsx",
      "utf8"
    );
    assert.doesNotMatch(actions, /Download PDF/);
    assert.doesNotMatch(actions, /ProposalPreviewPdfActions/);
  });

  test("sent-record Preview header mounts PDF actions for exact version", () => {
    const header = readFileSync(
      "app/tools/roofing/proposals/preview/ProposalPreviewHeader.tsx",
      "utf8"
    );
    const client = readFileSync(
      "app/tools/roofing/proposals/preview/ProposalCustomerPreviewClient.tsx",
      "utf8"
    );
    const pdfActions = readFileSync(
      "app/tools/roofing/proposals/preview/ProposalPreviewPdfActions.tsx",
      "utf8"
    );
    assert.match(header, /ProposalPreviewPdfActions/);
    assert.match(header, /showPdfActions/);
    assert.match(client, /pdfDownload=/);
    assert.match(client, /sentRequest\.versionId/);
    assert.match(client, /isSentRecord && sentRequest\.mode === "sent_record"/);
    assert.match(pdfActions, /data-preview-download-pdf/);
    assert.match(pdfActions, /data-preview-download-signed-pdf/);
    assert.match(pdfActions, /PROPOSAL_PDF_ARTIFACT_SENT/);
    assert.match(pdfActions, /PROPOSAL_PDF_ARTIFACT_SIGNED_FINAL/);
    assert.match(pdfActions, /hasContractorProposalPdfSignedFinal/);
  });

  test("Job Card proposals tab does not add a separate PDF control", () => {
    const model = readFileSync(
      "app/tools/roofing/jobCard/jobCardProposalsTabModel.ts",
      "utf8"
    );
    assert.doesNotMatch(model, /Download PDF/);
    assert.doesNotMatch(model, /proposalPdf/);
  });

  test("route reuses Group 1 generate path and does not invent packet body", () => {
    const route = readFileSync(
      "app/api/proposals/[proposalId]/versions/[versionId]/pdf/route.ts",
      "utf8"
    );
    assert.match(route, /generateContractorProposalPdf/);
    assert.match(route, /getUserCompanyId/);
    assert.match(route, /parseContractorProposalPdfArtifactType/);
    assert.doesNotMatch(route, /req\.json\(\)/);
    assert.doesNotMatch(route, /packet/);
    assert.doesNotMatch(route, /RoofingClient/);
  });

  test("no public Save PDF activation in Group 2", () => {
    const packetHeader = readFileSync(
      "app/components/proposal-packet/ProposalPacketHeader.tsx",
      "utf8"
    );
    assert.match(packetHeader, /Coming soon/);
    assert.match(packetHeader, /PROPOSAL_CUSTOMER_PACKET_HEADER_SAVE_PDF_LABEL/);
    assert.doesNotMatch(packetHeader, /downloadContractorProposalPdf/);
  });
});
