"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import FieldDiveAppShell from "@/app/tools/roofing/FieldDiveAppShell";
import { parseInternalReturnTo } from "@/app/lib/proposalBuilderReadiness";
import CatalogSetupClient from "./CatalogSetupClient";

export default function CatalogAppPage({ companyId }: { companyId: string }) {
  const [backToJobCardHref, setBackToJobCardHref] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setBackToJobCardHref(parseInternalReturnTo(params.get("returnTo")));
  }, []);

  return (
    <FieldDiveAppShell activeNav="catalog">
      <div className="mx-auto w-full max-w-[100rem]">
        {backToJobCardHref ? (
          <div className="mb-4">
            <Link
              href={backToJobCardHref}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-cyan-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to Job Card
            </Link>
          </div>
        ) : null}
        <CatalogSetupClient companyId={companyId} />
      </div>
    </FieldDiveAppShell>
  );
}
