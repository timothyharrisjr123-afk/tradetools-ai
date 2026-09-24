"use client";

import { useEffect, useState } from "react";
import { formatUsdFromCents } from "@/app/lib/jobPaymentMoney";
import { formatScopeChangeDeltaLabel } from "@/app/lib/jobScopeChangeViewModel";
import { JOB_SCOPE_CHANGE_STATUS_LABELS } from "@/app/lib/jobScopeChangeTypes";
import { JOB_CARD_PROPOSALS_PRIMARY_BUTTON_CLASS } from "@/app/tools/roofing/jobCard/jobCardProposalsTabModel";

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
      <main className="mx-auto max-w-lg px-4 py-12">
        <p className="text-sm text-slate-600">Loading scope change…</p>
      </main>
    );
  }

  if (loadStatus === "error" || !payload) {
    return (
      <main className="mx-auto max-w-lg px-4 py-12" data-scope-change-public-error>
        <h1 className="text-xl font-semibold text-slate-950">
          Scope change unavailable
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {error ?? "This link is not available."}
        </p>
      </main>
    );
  }

  if (authorized) {
    return (
      <main
        className="mx-auto max-w-lg px-4 py-12"
        data-scope-change-public-authorized
      >
        <h1 className="text-xl font-semibold text-slate-950">
          Scope change authorized
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Thank you. Your approval is recorded. The updated contract total is{" "}
          <span className="font-semibold text-slate-900">
            {formatUsdFromCents(authorizedTotal ?? payload.proposedNewTotalCents)}
          </span>
          .
        </p>
      </main>
    );
  }

  const statusLabel =
    payload.scopeChange.status in JOB_SCOPE_CHANGE_STATUS_LABELS
      ? JOB_SCOPE_CHANGE_STATUS_LABELS[
          payload.scopeChange.status as keyof typeof JOB_SCOPE_CHANGE_STATUS_LABELS
        ]
      : payload.scopeChange.status;

  return (
    <main
      className="mx-auto max-w-lg space-y-8 px-4 py-10"
      data-scope-change-public-review
    >
      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
          Scope change review
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          Approve a change to your agreement
        </h1>
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
          Original accepted agreement
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
                <span className="font-medium text-slate-500">
                  {line.changeKind === "add" ? "Add" : "Remove"}
                </span>{" "}
                <span className="text-slate-900">{line.description}</span>
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
              className="w-full rounded-md border border-slate-200 px-3 py-2"
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
              className="w-full rounded-md border border-slate-200 px-3 py-2"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {financialReview ? (
            <div
              className="space-y-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-950"
              data-scope-change-financial-review
            >
              <p className="font-semibold">Financial review required</p>
              <p>{financialReview.message}</p>
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
          <button
            type="button"
            className={`${JOB_CARD_PROPOSALS_PRIMARY_BUTTON_CLASS} w-full`}
            disabled={busy || !name.trim() || payload.signatureRequired}
            onClick={() => void onAuthorize()}
            data-scope-change-approve
          >
            Approve scope change
          </button>
        </section>
      ) : (
        <p className="text-sm text-slate-600">
          This scope change is not open for authorization.
        </p>
      )}
    </main>
  );
}
