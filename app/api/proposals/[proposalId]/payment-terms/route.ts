import { NextRequest, NextResponse } from "next/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import {
  DEFAULT_PROPOSAL_PAYMENT_TERMS,
  isProposalPaymentDepositMode,
  termsRequireOnlineDeposit,
  type ProposalPaymentTerms,
} from "@/app/lib/proposalPaymentTerms";
import {
  readProposalPaymentTerms,
  upsertDraftProposalPaymentTermsViaRpc,
} from "@/app/lib/proposalPaymentTermsPersistence";
import { isUuidLike } from "@/app/lib/uuid";
import { createClient } from "@/app/lib/supabase/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ proposalId: string }> };

async function loadDraftVersionId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  proposalId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("proposals")
    .select("current_draft_version_id")
    .eq("id", proposalId)
    .eq("company_id", companyId)
    .maybeSingle();
  const id = String((data as { current_draft_version_id?: string } | null)?.current_draft_version_id ?? "");
  return isUuidLike(id) ? id : null;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { proposalId } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
    }
    const companyId = await getUserCompanyId(supabase, user.id);
    if (!companyId) {
      return NextResponse.json({ ok: false, code: "forbidden" }, { status: 403 });
    }
    if (!isUuidLike(proposalId)) {
      return NextResponse.json({ ok: false, code: "invalid_payload" }, { status: 400 });
    }
    const versionId = await loadDraftVersionId(supabase, companyId, proposalId);
    if (!versionId) {
      return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
    }
    const terms =
      (await readProposalPaymentTerms(supabase, {
        companyId,
        proposalVersionId: versionId,
      })) ?? DEFAULT_PROPOSAL_PAYMENT_TERMS;
    return NextResponse.json({
      ok: true,
      terms,
      onlineDepositRequired: termsRequireOnlineDeposit(terms),
    });
  } catch {
    return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const { proposalId } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
    }
    const companyId = await getUserCompanyId(supabase, user.id);
    if (!companyId) {
      return NextResponse.json({ ok: false, code: "forbidden" }, { status: 403 });
    }
    if (!isUuidLike(proposalId)) {
      return NextResponse.json({ ok: false, code: "invalid_payload" }, { status: 400 });
    }
    const body = await req.json().catch(() => ({}));
    if (!isProposalPaymentDepositMode(body?.depositMode)) {
      return NextResponse.json({ ok: false, code: "invalid_payload" }, { status: 400 });
    }
    const terms: ProposalPaymentTerms = {
      ...DEFAULT_PROPOSAL_PAYMENT_TERMS,
      depositMode: body.depositMode,
      depositPercentBps:
        body.depositMode === "percent" && Number.isInteger(body.depositPercentBps)
          ? body.depositPercentBps
          : null,
      depositFixedCents:
        body.depositMode === "fixed" && Number.isInteger(body.depositFixedCents)
          ? body.depositFixedCents
          : null,
    };
    const result = await upsertDraftProposalPaymentTermsViaRpc(supabase, {
      companyId,
      proposalId,
      terms,
    });
    if (!result.ok) {
      return NextResponse.json(result, { status: result.code === "not_found" ? 404 : 400 });
    }
    return NextResponse.json({ ok: true, terms });
  } catch {
    return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
  }
}
