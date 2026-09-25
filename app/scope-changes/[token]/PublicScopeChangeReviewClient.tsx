"use client";

import { useEffect, useState } from "react";
import { formatUsdFromCents } from "@/app/lib/jobPaymentMoney";
import { formatScopeChangeDeltaLabel } from "@/app/lib/jobScopeChangeViewModel";
import { JOB_SCOPE_CHANGE_STATUS_LABELS } from "@/app/lib/jobScopeChangeTypes";
import { buttonClass } from "@/app/components/ui/buttonStyles";
import { FORM_INPUT } from "@/app/components/ui/formStyles";
import {
  PROPOSAL_PACKET_FIELD_LABEL,
  PROPOSAL_PACKET_PAGE,
} from "@/app/components/proposal-packet/proposalPacketStyles";

const SCOPE_CHANGE_SHELL =
  "mx-auto w-full max-w-[720px] overflow-hidden rounded-[16px] border border-[#cfd9e6]/95 bg-white shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_20px_50px_rgba(11,31,51,0.10)]";

function ScopeChangeShell({
  contractorName,
  state,
  children,
}: {
  contractorName: string | null;
  state: "loading" | "error" | "authorized" | "review";
  children: React.ReactNode;
}) {
  return (
    <main className={`${PROPOSAL_PACKET_PAGE} min-h-screen`}>
      <article className={SCOPE_CHANGE_SHELL} aria-label="Scope change">
        {contractorName ? (
          <div className="border-b border-[#e6ebf1] px-5 py-4 sm:px-7" data-scope-change-contractor>
            <p className="text-[15px] font-semibold tracking-[-0.01em] text-[#0b1f33]">
              {contractorName}
            </p>
          </div>
        ) : null}
        <div
          className="space-y-8 px-5 py-6 sm:px-7 sm:py-8"
          {...(state === "review" ? { "data-scope-change-public-review": "" } : {})}
          {...(state === "error" ? { "data-scope-change-public-error": "" } : {})}
          {...(state === "authorized" ? { "data-scope-change-public-authorized": "" } : {})}
        >
          {children}
        </div>
      </article>
    </main>
  );
}

const SCOPE_CHANGE_TITLE =
  "text-[1.5rem] font-semibold tracking-[-0.03em] text-[#0b1f33] sm:text-[1.7rem]";

type PublicLine = {
  changeKind: "add" | "remove";
  description: string;
  quantity: number | null;
  unit: string | null;
  lineDeltaCents: number;
};

type PublicReviewPayload = {
  scopeChange: {
    id: string;
    status: string;
    reason: string | null;
    timingNote: string | null;
    priceDeltaCents: number;
    proposedAt: string | null;
  };
  lines: PublicLine[];
  job: {
    name: string | null;
    customerName: string | null;
    addressFormatted: string | null;
  } | null;
  contractor?: {
    name: string | null;
    phone: string | null;
  } | null;
  originalAgreement: {
    acceptedAt: string | null;
    totalCents: number | null;
  } | null;
  currentContractTotalCents: number;
  proposedNewTotalCents: number;
  priceDeltaCents: number;
  signatureRequired: boolean;
  canAuthorize: boolean;
};

export default function PublicScopeChangeReviewClient({
  token,
}: {
  token: string;
}) {
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<PublicReviewPayload | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [authorizedTotal, setAuthorizedTotal] = useState<number | null>(null);
  const [financialReview, setFinancialReview] = useState<{
    message: string;
    liveContractTotalCents: number | null;
    priceDeltaCents: number | null;
    proposedNewTotalCents: number | null;
    grossReceivedCents: number | null;
    openPaymentRequestCents: number | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadStatus("loading");
      try {
        const res = await fetch(
          `/api/scope-changes/public/${encodeURIComponent(token)}`,
          { cache: "no-store" }
        );
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          message?: string;
        } & Partial<PublicReviewPayload>;
        if (cancelled) return;
        if (!res.ok || body.ok !== true) {
          setError(
            body.message ??
              "This scope-change link is unavailable or no longer open for review."
          );
          setLoadStatus("error");
          return;
        }
        setPayload(body as PublicReviewPayload);
        setLoadStatus("ready");
      } catch {
        if (!cancelled) {
          setError("This scope-change link could not be loaded.");
          setLoadStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onAuthorize() {
    if (!payload?.canAuthorize) return;
    setBusy(true);
    setError(null);
    setFinancialReview(null);
    try {
      const res = await fetch(
        `/api/scope-changes/public/${encodeURIComponent(token)}/authorize`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            approvedByName: name,
            approvedByEmail: email || null,
          }),
        }
      );
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        code?: string;
        message?: string;
        contractTotalCents?: number | null;
        liveContractTotalCents?: number | null;
        priceDeltaCents?: number | null;
        proposedNewTotalCents?: number | null;
        grossReceivedCents?: number | null;
        openPaymentRequestCents?: number | null;
      };
      if (!res.ok || body.ok !== true) {
        if (body.code === "financial_conflict") {
          setFinancialReview({
            message:
              body.message ??
              "Financial review required before this reduction can apply.",
            liveContractTotalCents: body.liveContractTotalCents ?? null,
            priceDeltaCents: body.priceDeltaCents ?? null,
            proposedNewTotalCents: body.proposedNewTotalCents ?? null,
            grossReceivedCents: body.grossReceivedCents ?? null,
            openPaymentRequestCents: body.openPaymentRequestCents ?? null,
          });
        }
        setError(body.message ?? "Authorization failed.");
        return;
      }
      setAuthorized(true);
      setAuthorizedTotal(
        typeof body.contractTotalCents === "number"
          ? body.contractTotalCents
          : payload.proposedNewTotalCents
      );
    } finally {
      setBusy(false);
    }
  }

  if (loadStatus === "loading") {
    return (
      <ScopeChangeShell contractorName={null} state="loading">
        <p className="text-sm text-slate-600" role="status">
          Loading scope change…
        </p>
      </ScopeChangeShell>
    );
  }

  if (loadStatus === "error" || !payload) {
    return (
      <ScopeChangeShell contractorName={null} state="error">
        <div>
          <h1 className={SCOPE_CHANGE_TITLE}>Scope change unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">
            {error ?? "This link is not available."}
          </p>
        </div>
      </ScopeChangeShell>
    );
  }

  const contractorName = payload.contractor?.name?.trim() || null;
  const contractorPhone = payload.contractor?.phone?.trim() || null;

  if (authorized) {
    return (
      <ScopeChangeShell contractorName={contractorName} state="authorized">
        <div>
          <h1 className={SCOPE_CHANGE_TITLE}>Scope change authorized</h1>
          <p className="mt-2 text-sm text-slate-600">
            Thank you. Your approval is recorded. The updated contract total is{" "}
            <span className="font-semibold text-slate-900">
              {formatUsdFromCents(authorizedTotal ?? payload.proposedNewTotalCents)}
            </span>
            .
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Your original agreement stays on file; this change is recorded alongside it.
          </p>
        </div>
      </ScopeChangeShell>
    );
  }

  const statusLabel =
    payload.scopeChange.status in JOB_SCOPE_CHANGE_STATUS_LABELS
      ? JOB_SCOPE_CHANGE_STATUS_LABELS[
          payload.scopeChange.status as keyof typeof JOB_SCOPE_CHANGE_STATUS_LABELS
        ]
      : payload.scopeChange.status;

  return (
    <ScopeChangeShell contractorName={contractorName} state="review">
      <header className="space-y-2">
        <p className={PROPOSAL_PACKET_FIELD_LABEL}>Change to your agreement</p>
        <h1 className={SCOPE_CHANGE_TITLE}>Approve a change to your agreement</h1>
        {payload.job?.customerName || payload.job?.addressFormatted ? (
          <p className="text-sm text-slate-600">
            {[payload.job.customerName, payload.job.addressFormatted]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
      </header>

      <section className="space-y-3 border-t border-slate-100 pt-6">
        <h2 className="text-sm font-semibold text-slate-900">
          Original agreement
        </h2>
        <p className="text-sm text-slate-700">
          {payload.originalAgreement?.totalCents != null
            ? formatUsdFromCents(payload.originalAgreement.totalCents)
            : "Accepted agreement on file"}
          {payload.originalAgreement?.acceptedAt
            ? ` · accepted ${new Date(
                payload.originalAgreement.acceptedAt
              ).toLocaleDateString()}`
            : null}
        </p>
      </section>

      <section className="space-y-3 border-t border-slate-100 pt-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">
            What is changing
          </h2>
          <span className="text-xs font-medium text-slate-500">{statusLabel}</span>
        </div>
        {payload.scopeChange.reason ? (
          <p className="text-sm text-slate-700">{payload.scopeChange.reason}</p>
        ) : null}
        {payload.scopeChange.timingNote ? (
          <p className="text-sm text-slate-500">{payload.scopeChange.timingNote}</p>
        ) : null}
        <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
          {payload.lines.map((line, index) => (
            <li
              key={`${line.description}-${index}`}
              className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm"
            >
              <div>
                <p className="text-slate-900">
                  <span className="font-medium text-slate-500">
                    {line.changeKind === "add" ? "Add" : "Remove"}
                  </span>{" "}
                  {line.description}
                </p>
                {line.quantity != null || line.unit ? (
                  <p className="text-slate-500">
                    {[
                      line.quantity != null ? String(line.quantity) : null,
                      line.unit,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  </p>
                ) : null}
              </div>
              <span className="shrink-0 font-semibold text-slate-900">
                {formatScopeChangeDeltaLabel(line.lineDeltaCents)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-slate-500">Current contract total</span>
          <span className="font-semibold text-slate-900">
            {formatUsdFromCents(payload.currentContractTotalCents)}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-slate-500">This change</span>
          <span className="font-semibold text-slate-900">
            {formatScopeChangeDeltaLabel(payload.priceDeltaCents)}
          </span>
        </div>
        <div className="flex justify-between gap-3 border-t border-slate-200 pt-2">
          <span className="text-slate-700">Proposed new total</span>
          <span className="font-semibold text-slate-950">
            {formatUsdFromCents(payload.proposedNewTotalCents)}
          </span>
        </div>
      </section>

      {payload.canAuthorize ? (
        <section className="space-y-3 border-t border-slate-100 pt-6">
          <h2 className="text-sm font-semibold text-slate-900">
            Approve this scope change
          </h2>
          {!payload.signatureRequired ? (
            <p className="text-sm text-slate-600">
              Signature is not required for this approval.
            </p>
          ) : (
            <p className="text-sm text-slate-600">
              A signature is required before you can approve.
            </p>
          )}
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700">Your name</span>
            <input
              className={FORM_INPUT}
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-scope-change-approver-name
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700">
              Email <span className="font-normal text-slate-400">(optional)</span>
            </span>
            <input
              className={FORM_INPUT}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {financialReview ? (
            <div
              className="space-y-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-950"
              data-scope-change-financial-review
            >
              <p className="font-semibold">Payment review needed</p>
              <p>
                This change would lower your total below what has already been
                paid or requested.
              </p>
              <dl className="grid gap-1">
                {financialReview.liveContractTotalCents != null ? (
                  <div className="flex justify-between gap-3">
                    <dt>Current contract total</dt>
                    <dd className="font-semibold">
                      {formatUsdFromCents(financialReview.liveContractTotalCents)}
                    </dd>
                  </div>
                ) : null}
                {financialReview.priceDeltaCents != null ? (
                  <div className="flex justify-between gap-3">
                    <dt>This change</dt>
                    <dd className="font-semibold">
                      {formatScopeChangeDeltaLabel(financialReview.priceDeltaCents)}
                    </dd>
                  </div>
                ) : null}
                {financialReview.proposedNewTotalCents != null ? (
                  <div className="flex justify-between gap-3">
                    <dt>Proposed new total</dt>
                    <dd className="font-semibold">
                      {formatUsdFromCents(financialReview.proposedNewTotalCents)}
                    </dd>
                  </div>
                ) : null}
                {financialReview.grossReceivedCents != null ? (
                  <div className="flex justify-between gap-3">
                    <dt>Already collected</dt>
                    <dd className="font-semibold">
                      {formatUsdFromCents(financialReview.grossReceivedCents)}
                    </dd>
                  </div>
                ) : null}
                {financialReview.openPaymentRequestCents != null ? (
                  <div className="flex justify-between gap-3">
                    <dt>Open payment requests</dt>
                    <dd className="font-semibold">
                      {formatUsdFromCents(
                        financialReview.openPaymentRequestCents
                      )}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>
          ) : null}
          {error && !financialReview ? (
            <p className="text-sm text-red-700" data-scope-change-authorize-error>
              {error}
            </p>
          ) : null}
          {financialReview ? (
            <div className="space-y-2" data-scope-change-authorization-blocked>
              <p
                className="text-sm font-semibold text-slate-900"
                data-scope-change-approve-blocked
              >
                This change can’t be approved online yet
              </p>
              <p className="text-sm text-slate-600">
                Contact your contractor to review the payments on this job.
                Once they’ve sorted it out, you can try approving again.
              </p>
              <button
                type="button"
                className={buttonClass("secondary", { fullWidth: true })}
                disabled={busy || !name.trim() || payload.signatureRequired}
                onClick={() => void onAuthorize()}
                data-scope-change-approve-recheck
              >
                {busy ? "Submitting approval…" : "Try approving again"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={buttonClass("commit", { fullWidth: true })}
              disabled={busy || !name.trim() || payload.signatureRequired}
              onClick={() => void onAuthorize()}
              data-scope-change-approve
            >
              {busy ? "Submitting approval…" : "Approve scope change"}
            </button>
          )}
        </section>
      ) : (
        <p className="text-sm text-slate-600">
          This scope change is not open for authorization.
        </p>
      )}

      {contractorName || contractorPhone ? (
        <p className="border-t border-slate-100 pt-6 text-sm text-slate-600" data-scope-change-contact>
          Questions about this change? Contact {contractorName ?? "your contractor"}
          {contractorPhone ? (
            <>
              {" "}at{" "}
              <a
                href={`tel:${contractorPhone}`}
                className="font-medium text-blue-700 underline-offset-2 hover:underline"
              >
                {contractorPhone}
              </a>
            </>
          ) : null}
          .
        </p>
      ) : null}
    </ScopeChangeShell>
  );
}
