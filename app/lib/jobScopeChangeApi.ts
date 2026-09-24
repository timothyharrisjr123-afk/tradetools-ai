/**
 * Shared HTTP mapping for scope-change API routes.
 */

import { NextResponse } from "next/server";
import {
  jobScopeChangeErrorLabel,
  type JobScopeChange,
  type JobScopeChangeLine,
} from "@/app/lib/jobScopeChangeTypes";
import {
  type JobScopeChangeRpcFailure,
  type JobScopeChangeRpcResult,
} from "@/app/lib/jobScopeChangePersistence";
import { scopeChangeFailureMessage } from "@/app/lib/jobScopeChangeContract";

export function scopeChangeHttpStatus(code: string): number {
  if (code === "unauthorized") return 401;
  if (code === "forbidden" || code === "capability_denied") return 403;
  if (code === "not_found") return 404;
  if (
    code === "row_version_conflict" ||
    code === "stale_basis" ||
    code === "proposed_already_exists" ||
    code === "financial_conflict" ||
    code === "illegal_transition" ||
    code === "not_draft"
  ) {
    return 409;
  }
  return 400;
}

export function serializeScopeChange(change: JobScopeChange) {
  return {
    id: change.id,
    companyId: change.company_id,
    jobId: change.job_id,
    baseProposalId: change.base_proposal_id,
    baseProposalVersionId: change.base_proposal_version_id,
    baseAcceptanceId: change.base_acceptance_id,
    status: change.status,
    reason: change.reason,
    timingNote: change.timing_note,
    priceDeltaCents: change.price_delta_cents,
    basisContractTotalCents: change.basis_contract_total_cents,
    proposedAt: change.proposed_at,
    authorizedAt: change.authorized_at,
    declinedAt: change.declined_at,
    voidedAt: change.voided_at,
    rowVersion: change.row_version,
    createdAt: change.created_at,
    updatedAt: change.updated_at,
  };
}

export function serializeScopeChangeLine(line: JobScopeChangeLine) {
  return {
    id: line.id,
    scopeChangeId: line.scope_change_id,
    changeKind: line.change_kind,
    description: line.description,
    quantity: line.quantity,
    unit: line.unit,
    unitPriceCents: line.unit_price_cents,
    lineDeltaCents: line.line_delta_cents,
    sortOrder: line.sort_order,
  };
}

export function scopeChangeRpcFailureResponse(result: JobScopeChangeRpcFailure) {
  const code = String(result.code);
  return NextResponse.json(
    {
      ok: false,
      code,
      message: scopeChangeFailureMessage(code, result),
      label: jobScopeChangeErrorLabel(code),
      rowVersion: result.row_version ?? null,
      basisContractTotalCents: result.basis_contract_total_cents ?? null,
      liveContractTotalCents: result.live_contract_total_cents ?? null,
      reason: result.reason ?? null,
      priceDeltaCents: result.price_delta_cents ?? null,
      proposedNewTotalCents: result.proposed_new_total_cents ?? null,
      grossReceivedCents: result.gross_received_cents ?? null,
      openPaymentRequestCents: result.open_payment_request_cents ?? null,
    },
    { status: scopeChangeHttpStatus(code) }
  );
}

export function scopeChangeRpcSuccessBody(
  result: Extract<JobScopeChangeRpcResult, { ok: true }>,
  extras?: Record<string, unknown>
) {
  return {
    ok: true as const,
    idempotent: result.idempotent === true,
    scopeChange: serializeScopeChange(result.scope_change),
    lines: (result.lines ?? []).map(serializeScopeChangeLine),
    approvalId: result.approval_id ?? null,
    contractTotalCents: result.contract_total_cents ?? null,
    proposedNewTotalCents: result.proposed_new_total_cents ?? null,
    activityId: result.activity_id ?? null,
    ...extras,
  };
}

export function parseScopeChangeLineInputs(raw: unknown) {
  if (!Array.isArray(raw)) return null;
  const lines = [];
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    if (!row || typeof row !== "object") return null;
    const r = row as Record<string, unknown>;
    const changeKind = String(r.changeKind ?? r.change_kind ?? "").trim();
    if (changeKind !== "add" && changeKind !== "remove") return null;
    const description = String(r.description ?? "").trim();
    if (!description) return null;
    const lineDelta = Number(r.lineDeltaCents ?? r.line_delta_cents);
    if (!Number.isFinite(lineDelta) || !Number.isInteger(lineDelta)) return null;
    const quantityRaw = r.quantity;
    const unitPriceRaw = r.unitPriceCents ?? r.unit_price_cents;
    lines.push({
      change_kind: changeKind as "add" | "remove",
      description,
      quantity:
        quantityRaw == null || quantityRaw === ""
          ? null
          : Number(quantityRaw),
      unit:
        r.unit == null || r.unit === ""
          ? null
          : String(r.unit),
      unit_price_cents:
        unitPriceRaw == null || unitPriceRaw === ""
          ? null
          : Number(unitPriceRaw),
      line_delta_cents: lineDelta,
      sort_order:
        r.sortOrder != null || r.sort_order != null
          ? Number(r.sortOrder ?? r.sort_order)
          : i,
    });
  }
  return lines;
}
