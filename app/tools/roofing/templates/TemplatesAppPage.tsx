"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import FieldDiveAppShell from "@/app/tools/roofing/FieldDiveAppShell";
import { parseInternalReturnTo } from "@/app/lib/proposalBuilderReadiness";
import {
  formatReturnToJobProposalsLabel,
  sanitizeSetupReturnLabel,
} from "@/app/tools/roofing/jobCard/jobCardProposalSetup";
import TemplatesSetupClient from "./TemplatesSetupClient";

export default function TemplatesAppPage({ companyId }: { companyId: string }) {
  const [backToJobCardHref, setBackToJobCardHref] = useState<string | null>(null);
  const [backLabel, setBackLabel] = useState("Back to Job Card");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setBackToJobCardHref(parseInternalReturnTo(params.get("returnTo")));
    const label = sanitizeSetupReturnLabel(params.get("returnLabel"));
    setBackLabel(label ? formatReturnToJobProposalsLabel(label) : "Back to Job Card");
  }, []);

  return (
    <FieldDiveAppShell activeNav="templates">
      {backToJobCardHref ? (
        <div className="mb-4">
          <Link
            href={backToJobCardHref}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-cyan-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {backLabel}
          </Link>
        </div>
      ) : null}
      <TemplatesSetupClient companyId={companyId} />
    </FieldDiveAppShell>
  );
}
