"use client";

import type { JobCardTabId } from "./jobCardTypes";
import type { JobCardDisplayModel } from "../saved/jobsBoardUtils";

type JobCardOverviewSummaryProps = {
  display: JobCardDisplayModel;
  phone: string;
  email: string;
  address: string;
  hasAddress: boolean;
  measurementStatus: string;
  catalogStatus: string;
  catalogReady: boolean;
  onNavigateTab: (tab: JobCardTabId) => void;
};

function SummaryCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200/80 bg-slate-50/40 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="mt-3 space-y-2 text-sm">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="min-w-0 text-right font-medium text-slate-800">{value}</span>
    </div>
  );
}

function EmptyValue() {
  return <span className="font-normal text-slate-400">Not entered</span>;
}

export default function JobCardOverviewSummary({
  display,
  phone,
  email,
  address,
  hasAddress,
  measurementStatus,
  catalogStatus,
  catalogReady,
  onNavigateTab,
}: JobCardOverviewSummaryProps) {
  const quickLinks: { tab: JobCardTabId; label: string }[] = [
    { tab: "measurements", label: "Measurements" },
    { tab: "proposals", label: "Proposals" },
    { tab: "attachments", label: "Attachments" },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SummaryCard title="Job summary">
        <Row label="Customer" value={display.customerName} />
        <Row label="Phone" value={phone.trim() ? phone : <EmptyValue />} />
        <Row label="Email" value={email.trim() ? email : <EmptyValue />} />
        <Row label="Property" value={hasAddress ? address : <EmptyValue />} />
        <Row label="Stage" value={display.stageLabel} />
        <Row label="Value" value={display.valueLabel ?? "—"} />
        <Row label="Job source" value="Manual intake" />
      </SummaryCard>

      <SummaryCard title="Status">
        <Row label="Report" value={display.reportLabel} />
        <Row label="Proposal" value={display.proposalLabel} />
        <Row label="Measurement" value={measurementStatus} />
        <Row
          label="Catalog"
          value={
            catalogReady ? (
              <span className="text-emerald-700">Ready for templates</span>
            ) : (
              <span className="text-slate-600">{catalogStatus}</span>
            )
          }
        />
        {!catalogReady ? (
          <p className="pt-1 text-right">
            <a href="/tools/roofing/catalog" className="text-sm font-semibold text-cyan-700 hover:text-cyan-900">
              Open catalog setup
            </a>
          </p>
        ) : null}
      </SummaryCard>

      <div className="rounded-lg border border-slate-200/80 bg-white p-4 lg:col-span-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quick links</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {quickLinks.map((link) => (
            <button
              key={link.tab}
              type="button"
              onClick={() => onNavigateTab(link.tab)}
              className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              {link.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
