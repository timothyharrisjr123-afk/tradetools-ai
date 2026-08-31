"use client";

export type PropertySearchCandidate = {
  id: string;
  line1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  formatted: string;
  jobCount?: number;
};

type Props = {
  candidates: PropertySearchCandidate[];
  selectedPropertyId: string | null;
  selectedPropertyLabel?: string | null;
  onSelect: (candidate: PropertySearchCandidate) => void;
  onContinueAsNew: () => void;
  showContinueAsNew: boolean;
};

function secondaryLine(c: PropertySearchCandidate): string {
  const loc = [c.city, c.state, c.zip].filter(Boolean).join(", ");
  const jobs =
    typeof c.jobCount === "number" && c.jobCount > 0
      ? `${c.jobCount} job${c.jobCount === 1 ? "" : "s"}`
      : "";
  return [loc, jobs].filter(Boolean).join(" · ");
}

/**
 * Quiet existing-property assist under intake address fields.
 * Contractor chooses reuse or create. Never auto-merges.
 */
export function JobPacketPropertyCandidates({
  candidates,
  selectedPropertyId,
  selectedPropertyLabel,
  onSelect,
  onContinueAsNew,
  showContinueAsNew,
}: Props) {
  if (selectedPropertyId) {
    return (
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11px] text-slate-600">
        <span className="min-w-0 truncate font-medium text-slate-700">
          Using existing property
          {selectedPropertyLabel ? `: ${selectedPropertyLabel}` : ""}
        </span>
        <button
          type="button"
          onClick={onContinueAsNew}
          className="shrink-0 py-0.5 text-[11px] font-medium text-sky-700 underline-offset-2 hover:underline"
        >
          Create new instead
        </button>
      </div>
    );
  }

  if (candidates.length === 0) return null;

  return (
    <div className="mt-1.5 space-y-1" data-testid="property-candidates">
      <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-slate-500">
        {candidates.length === 1 ? "Possible property" : "Possible properties"}
      </p>
      <ul className="space-y-1">
        {candidates.map((c) => {
          const detail = secondaryLine(c);
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelect(c)}
                className="flex min-h-[40px] w-full items-start gap-2 rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5 text-left transition hover:border-sky-300 hover:bg-sky-50/40"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-medium text-slate-900">
                    {c.line1 || c.formatted}
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
      {showContinueAsNew ? (
        <button
          type="button"
          onClick={onContinueAsNew}
          className="min-h-[32px] px-0.5 text-[11px] font-medium text-slate-600 underline-offset-2 hover:text-slate-800 hover:underline"
        >
          Create new property
        </button>
      ) : null}
    </div>
  );
}
