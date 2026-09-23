"use client";

type Props = {
  kind: "customer" | "property";
  title: string;
  detail?: string | null;
  onChange: () => void;
  secondaryAction?: { label: string; onClick: () => void } | null;
  testId?: string;
};

export function JobPacketSelectedIdentitySummary({
  kind,
  title,
  detail,
  onChange,
  secondaryAction,
  testId,
}: Props) {
  const label = kind === "customer" ? "Customer" : "Property";
  return (
    <div
      className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5"
      data-testid={testId ?? `packet-${kind}-summary`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            {label}
          </p>
          <p className="mt-0.5 truncate text-[13px] font-medium text-slate-900">{title}</p>
          {detail ? (
            <p className="mt-0.5 truncate text-[11.5px] text-slate-600">{detail}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onChange}
          className="shrink-0 pt-0.5 text-[12px] font-medium text-sky-700 underline-offset-2 hover:underline"
          data-testid={`packet-${kind}-change`}
        >
          Change
        </button>
      </div>
      {secondaryAction ? (
        <button
          type="button"
          onClick={secondaryAction.onClick}
          className="mt-2 min-h-[32px] text-[12px] font-medium text-slate-700 underline-offset-2 hover:underline"
          data-testid="packet-another-property"
        >
          {secondaryAction.label}
        </button>
      ) : null}
    </div>
  );
}
