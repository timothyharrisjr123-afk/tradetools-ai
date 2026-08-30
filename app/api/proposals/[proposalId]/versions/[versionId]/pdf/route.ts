/**
 * GET /api/proposals/[proposalId]/versions/[versionId]/pdf
 * Contractor download of an exact frozen sent-version PDF.
 */

import { NextRequest, NextResponse } from "next/server";

import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import {
  buildDefaultContractorProposalPdfDeps,
  contractorProposalPdfHttpStatus,
  contractorProposalPdfResponseHeaders,
  generateContractorProposalPdf,
  parseContractorProposalPdfArtifactType,
} from "@/app/lib/proposalPdfContractorDownload";
import { createClient } from "@/app/lib/supabase/server";
import { isUuidLike } from "@/app/lib/uuid";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ proposalId: string; versionId: string }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { proposalId, versionId } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, code: "unauthorized" },
        { status: 401 }
      );
    }

    const companyId = await getUserCompanyId(supabase, user.id);
    if (!companyId) {
      return NextResponse.json({ ok: false, code: "forbidden" }, { status: 403 });
    }

    if (!isUuidLike(proposalId) || !isUuidLike(versionId)) {
      return NextResponse.json(
        { ok: false, code: "invalid_payload" },
        { status: 400 }
      );
    }

    const artifactType = parseContractorProposalPdfArtifactType(
      req.nextUrl.searchParams.get("artifact")
    );
    if (!artifactType) {
      return NextResponse.json(
        { ok: false, code: "invalid_payload" },
        { status: 400 }
      );
    }

    const result = await generateContractorProposalPdf({
      companyId,
      proposalId,
      versionId,
      artifactType,
      deps: buildDefaultContractorProposalPdfDeps(supabase),
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, code: result.code },
        { status: contractorProposalPdfHttpStatus(result.code) }
      );
    }

    return new NextResponse(Buffer.from(result.bytes), {
      status: 200,
      headers: contractorProposalPdfResponseHeaders(result.filename),
    });
  } catch {
    return NextResponse.json(
      { ok: false, code: "generation_failed" },
      { status: 500 }
    );
  }
}
