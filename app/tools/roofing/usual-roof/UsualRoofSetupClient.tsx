"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ASTRA_G5_FIRST_JOB_HINT,
  ASTRA_G5_FIRST_JOB_HREF,
  ASTRA_G5_FIRST_JOB_LABEL,
  ASTRA_G5_USUAL_ROOF_HINT,
  ASTRA_G5_USUAL_ROOF_LABEL,
} from "@/app/lib/astraG5Activation";
import type { AstraG5StarterCompanyBrandingInput } from "@/app/lib/astraG5StarterPacketPreview";
import { getActiveCatalogItemsByCompany } from "@/app/lib/catalogStore";
import { mergeCompanyBrandingProfile } from "@/app/lib/companyBrandingProfile";
import { getCompanyBrandingProfile } from "@/app/lib/companyBrandingProfileStore";
import { loadCompanyProfileResultFromSupabase } from "@/app/lib/companyProfile";
import { installDefaultRoofingCatalog } from "@/app/lib/defaultRoofingCatalogInstall";
import { installDefaultRoofingProposalTemplates } from "@/app/lib/defaultRoofingProposalTemplateInstall";
import { getActiveProposalTemplatesByCompany } from "@/app/lib/proposalTemplateStore";
import { findStarterProposalTemplate } from "@/app/tools/roofing/templates/templatesSetupUtils";
import AstraG5StarterPacketPreview from "@/app/tools/roofing/proposals/preview/AstraG5StarterPacketPreview";

type UsualRoofSetupClientProps = {
  companyId: string;
};

type Phase = "loading" | "ready" | "installing" | "done" | "error";

/**
 * Thin Astra G5 entry: reuse existing company-only installers.
 * Preview-led via canonical Customer Preview packet leafs (starter defs + branding).
 */
export default function UsualRoofSetupClient({ companyId }: UsualRoofSetupClientProps) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [catalogInstalled, setCatalogInstalled] = useState(false);
  const [templateInstalled, setTemplateInstalled] = useState(false);
  const [branding, setBranding] = useState<AstraG5StarterCompanyBrandingInput | null>(
    null
  );

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [items, templates, coreResult, extended] = await Promise.all([
        getActiveCatalogItemsByCompany(companyId),
        getActiveProposalTemplatesByCompany(companyId),
        loadCompanyProfileResultFromSupabase({ dbTruthOnly: true }),
        getCompanyBrandingProfile(companyId),
      ]);
      const hasCatalog = items.length > 0;
      const starter = findStarterProposalTemplate(templates);
      setCatalogInstalled(hasCatalog);
      setTemplateInstalled(starter != null);
      setPhase(hasCatalog && starter != null ? "done" : "ready");
      const core = coreResult.profile;
      if (core || extended) {
        const merged = mergeCompanyBrandingProfile(core ?? {}, extended ?? {});
        setBranding({
          companyName: merged.companyName,
          logoDataUrl: merged.logoDataUrl,
          phone: merged.phone,
          email: merged.email,
          license: merged.license,
          address: merged.address,
          website: merged.website,
          brandPrimaryColor: merged.brandPrimaryColor,
          brandSecondaryColor: merged.brandSecondaryColor,
          showLicenseOnCover: merged.showLicenseOnCover,
        });
      } else {
        setBranding(null);
      }
    } catch {
      setError("Could not load company setup. Try again.");
      setPhase("error");
    }
  }, [companyId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const install = useCallback(async () => {
    if (phase === "installing") return;
    setPhase("installing");
    setError(null);
    try {
      const catalogResult = await installDefaultRoofingCatalog(companyId);
      if (!catalogResult) {
        setError("Could not install starter catalog.");
        setPhase("error");
        return;
      }
      if (catalogResult.failedCount > 0 && catalogResult.createdCount === 0 && catalogResult.skippedCount === 0) {
        setError(
          catalogResult.errors?.length
            ? catalogResult.errors.join(" ")
            : "Could not install starter catalog."
        );
        setPhase("error");
        return;
      }

      const templateResult = await installDefaultRoofingProposalTemplates(companyId);
      if (!templateResult) {
        setError("Could not install starter proposal setup.");
        setPhase("error");
        return;
      }
      if (
        templateResult.failedCount > 0 &&
        templateResult.createdTemplateCount === 0 &&
        templateResult.skippedTemplateCount === 0
      ) {
        setError(
          templateResult.errors?.length
            ? templateResult.errors.join(" ")
            : "Could not install starter proposal setup."
        );
        setPhase("error");
        return;
      }

      await refresh();
    } catch {
      setError("Install failed. Try again.");
      setPhase("error");
    }
  }, [companyId, phase, refresh]);

  const primaryBusy = phase === "loading" || phase === "installing";

  return (
    <main
      className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900"
      data-astra-g5-usual-roof
    >
      <div className="mx-auto w-full max-w-2xl">
        <p className="text-sm font-semibold tracking-tight text-slate-900">FieldDive</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
          {ASTRA_G5_USUAL_ROOF_LABEL}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{ASTRA_G5_USUAL_ROOF_HINT}</p>

        <div
          className="mt-6 border-t border-slate-200/80 bg-white px-3 py-4 sm:px-5 sm:py-5"
          data-astra-g5-template-preview
        >
          <AstraG5StarterPacketPreview branding={branding} density="document" />
        </div>

        <div className="mt-4 space-y-1 text-sm text-slate-600">
          <p data-usual-roof-catalog-state={catalogInstalled ? "ready" : "needed"}>
            Catalog: {catalogInstalled ? "Starter items ready" : "Starter items needed"}
          </p>
          <p data-usual-roof-template-state={templateInstalled ? "ready" : "needed"}>
            Proposal setup:{" "}
            {templateInstalled ? "Starter template ready" : "Starter template needed"}
          </p>
        </div>

        {error ? (
          <p className="mt-4 text-sm text-rose-600" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-3">
          {phase !== "done" ? (
            <button
              type="button"
              onClick={() => void install()}
              disabled={primaryBusy}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              data-usual-roof-install
            >
              {phase === "installing"
                ? "Installing…"
                : catalogInstalled || templateInstalled
                  ? "Finish usual roof setup"
                  : "Install my usual roof setup"}
            </button>
          ) : (
            <p className="text-sm text-slate-600" data-usual-roof-complete="true">
              Usual roof setup is ready. Start a job when you have a customer.
            </p>
          )}

          <Link
            href={ASTRA_G5_FIRST_JOB_HREF}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
            data-usual-roof-first-job
          >
            {ASTRA_G5_FIRST_JOB_LABEL}
          </Link>
          <p className="text-xs leading-relaxed text-slate-500">{ASTRA_G5_FIRST_JOB_HINT}</p>

          <Link
            href="/tools/roofing/saved"
            className="text-center text-sm font-medium text-slate-600 underline-offset-2 hover:underline"
          >
            Back to jobs
          </Link>
        </div>
      </div>
    </main>
  );
}
