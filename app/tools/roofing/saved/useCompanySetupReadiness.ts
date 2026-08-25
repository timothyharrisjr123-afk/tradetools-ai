"use client";

import { useCallback, useEffect, useState } from "react";
import { deriveCatalogReadiness } from "@/app/lib/catalogReadiness";
import { getActiveCatalogItemsByCompany } from "@/app/lib/catalogStore";
import {
  deriveCompanyBrandingReadiness,
  mergeCompanyBrandingProfile,
} from "@/app/lib/companyBrandingProfile";
import { getCompanyBrandingProfileResult } from "@/app/lib/companyBrandingProfileStore";
import {
  deriveCompanySetupReadiness,
  type CompanySetupReadinessResult,
} from "@/app/lib/companySetupReadiness";
import { getResolvedCompanyPricingPolicy } from "@/app/lib/companyPricingPolicyStore";
import { loadCompanyProfileResultFromSupabase } from "@/app/lib/companyProfile";
import { DEFAULT_ROOFING_CATALOG_DEFINITIONS } from "@/app/lib/defaultRoofingCatalog";
import { deriveProposalTemplateReadiness } from "@/app/lib/proposalTemplateReadiness";
import {
  getProposalTemplateGraph,
  getProposalTemplatesByCompany,
} from "@/app/lib/proposalTemplateStore";
import { findStarterProposalTemplate } from "@/app/tools/roofing/templates/templatesSetupUtils";

const CATALOG_STARTER_DEFINITION_COUNT = DEFAULT_ROOFING_CATALOG_DEFINITIONS.length;

export function useCompanySetupReadiness(
  companyId: string | undefined,
  options?: { enabled?: boolean }
): CompanySetupReadinessResult {
  const enabled = options?.enabled !== false;
  const [input, setInput] = useState({
    loading: true,
    companyProfileComplete: null as boolean | null,
    pricingRulesConfigured: null as boolean | null,
    priceBookReady: null as boolean | null,
    proposalTemplatesReady: null as boolean | null,
  });

  const load = useCallback(async () => {
    if (!enabled) {
      return;
    }
    const cid = (companyId ?? "").trim();
    if (!cid) {
      setInput({
        loading: false,
        companyProfileComplete: null,
        pricingRulesConfigured: null,
        priceBookReady: null,
        proposalTemplatesReady: null,
      });
      return;
    }

    setInput((prev) => ({ ...prev, loading: true }));

    try {
      const [coreResult, brandingResult, pricingResolution, catalogItems, templates] =
        await Promise.all([
          loadCompanyProfileResultFromSupabase(),
          getCompanyBrandingProfileResult(cid),
          getResolvedCompanyPricingPolicy(cid),
          getActiveCatalogItemsByCompany(cid),
          getProposalTemplatesByCompany(cid),
        ]);

      const mergedProfile = mergeCompanyBrandingProfile(
        coreResult.profile ?? {},
        brandingResult.fields ?? {}
      );
      const brandingReadiness = deriveCompanyBrandingReadiness(mergedProfile);
      const companyProfileComplete = brandingReadiness.level !== "incomplete";

      const catalogReadiness = deriveCatalogReadiness(
        catalogItems,
        CATALOG_STARTER_DEFINITION_COUNT
      );
      const priceBookReady = catalogReadiness.state === "ready_for_templates";

      const starterTemplate = findStarterProposalTemplate(templates);
      let starterGraph = null;
      if (starterTemplate) {
        starterGraph = await getProposalTemplateGraph(starterTemplate.id, { companyId: cid });
      }
      const templateReadiness = deriveProposalTemplateReadiness({
        catalogReadiness,
        activeCatalogItems: catalogItems,
        starterGraph,
        templateCount: templates.length,
      });
      const proposalTemplatesReady = templateReadiness.status === "ready_for_builder";

      setInput({
        loading: false,
        companyProfileComplete,
        pricingRulesConfigured: pricingResolution.configured,
        priceBookReady,
        proposalTemplatesReady,
      });
    } catch (err) {
      console.error("[useCompanySetupReadiness] load failed", err);
      setInput({
        loading: false,
        companyProfileComplete: null,
        pricingRulesConfigured: null,
        priceBookReady: null,
        proposalTemplatesReady: null,
      });
    }
  }, [companyId, enabled]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  return deriveCompanySetupReadiness(input);
}
