"use client";

import Link from "next/link";
import { Mail, MapPin, Phone, UserCircle } from "lucide-react";
import type { JobCardDisplayModel } from "./jobCardDisplayTypes";

type JobCardHeaderProps = {
  display: JobCardDisplayModel;
  isBoardOrigin: boolean;
  phone?: string;
  email?: string;
};

function ContactValue({ value }: { value: string }) {
  const trimmed = value.trim();
  if (!trimmed) {
    return <span className="text-slate-400">Not entered</span>;
  }
  return <span className="text-slate-700">{trimmed}</span>;
}

export default function JobCardHeader({ display, isBoardOrigin, phone = "", email = "" }: JobCardHeaderProps) {
  const backHref = isBoardOrigin ? "/tools/roofing/saved" : "/tools/roofing?entry=packet";
  const backLabel = isBoardOrigin ? "Back to Job Board" : "Back to Job Packet";

  return (
    <header className="border-b border-slate-200/80 bg-white px-5 pb-4 pt-3 sm:px-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-slate-800"
      >
        ← {backLabel}
      </Link>

      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.65rem]">
            {display.customerName}
          </h1>
          <div className="mt-1.5 flex min-w-0 items-start gap-1.5 text-sm text-slate-600">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" strokeWidth={1.75} aria-hidden />
            <span className="truncate">{display.address}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} aria-hidden />
              <ContactValue value={phone} />
            </span>
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={1.75} aria-hidden />
              <span className="truncate">
                <ContactValue value={email} />
              </span>
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <span
              className="inline-flex items-center rounded-md bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800"
              data-jobcard-stage={display.stageLabel}
            >
              {display.stageLabel}
            </span>
            {display.dispositionLabel ? (
              <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
                {display.dispositionLabel}
              </span>
            ) : null}
            {display.valueLabel ? (
              <span className="text-base font-semibold tabular-nums text-slate-900">{display.valueLabel}</span>
            ) : null}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <UserCircle className="h-5 w-5 text-slate-400/90" strokeWidth={1.75} aria-hidden />
            <span>Unassigned</span>
          </div>
        </div>
      </div>
    </header>
  );
}
