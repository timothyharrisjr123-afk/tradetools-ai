"use client";

import type { CustomerSearchCandidate } from "@/app/lib/customerMatch";

type Props = {
  candidates: CustomerSearchCandidate[];
  selectedCustomerId: string | null;
  selectedCustomerLabel?: string | null;
  onSelect: (candidate: CustomerSearchCandidate) => void;
  onContinueAsNew: () => void;
  showContinueAsNew: boolean;
};

function secondaryLine(c: CustomerSearchCandidate): string {
  return [c.email, c.phone].filter(Boolean).join(" · ");
}

/**
 * Quiet existing-customer assist under intake fields. Not a warning banner.
 */
export function JobPacketCustomerCandidates({
  candidates,
  selectedCustomerId,
  selectedCustomerLabel,
  onSelect,
  onContinueAsNew,
  showContinueAsNew,
}: Props) {
  if (selectedCustomerId) {
    return (
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-600">
        <span className="font-medium text-slate-700">
          Using existing customer
          {selectedCustomerLabel ? `: ${selectedCustomerLabel}` : ""}
        </span>
        <button
          type="button"
          onClick={onContinueAsNew}
          className="min-h-[28px] rounded-md px-1.5 py-0.5 text-[11px] font-medium text-sky-700 underline-offset-2 hover:underline"
        >
          Continue as new instead
        </button>
      </div>
    );
  }

  if (candidates.length === 0 && !showContinueAsNew) return null;

  return (
    <div className="mt-1.5 space-y-1" data-testid="customer-candidates">
      {candidates.length > 0 ? (
        <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-slate-500">
          Possible match
        </p>
      ) : null}
      <ul className="space-y-1">
        {candidates.map((c) => {
          const detail = secondaryLine(c);
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelect(c)}
                className="flex min-h-[40px] w-full items-start gap-2 rounded-lg border border-slate-200/80 bg-white px-2.5 py-2 text-left transition hover:border-sky-300 hover:bg-sky-50/40"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-medium text-slate-900">
                    {c.name}
                  </span>
                  {detail ? (
                    <span className="mt-0.5 block truncate text-[11px] text-slate-500">{detail}</span>
                  ) : null}
                </span>
                <span className="shrink-0 pt-0.5 text-[11px] font-medium text-sky-700">Use</span>
              </button>
            </li>
          );
        })}
      </ul>
      {showContinueAsNew && candidates.length > 0 ? (
        <button
          type="button"
          onClick={onContinueAsNew}
          className="min-h-[32px] px-0.5 text-[11px] font-medium text-slate-600 underline-offset-2 hover:text-slate-800 hover:underline"
        >
          Continue as new customer
        </button>
      ) : null}
    </div>
  );
}
