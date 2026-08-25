"use client";

import { useEffect, useState } from "react";
import JobCardSectionPanel from "@/app/tools/roofing/jobCard/JobCardSectionPanel";
import type { JobCardTabId } from "@/app/tools/roofing/jobCard/jobCardTypes";
import { applyTemplateSetupFetchResult } from "@/app/lib/jobCardTemplateSetupState";
import type { TemplateSetupReadStatus } from "@/app/lib/jobCardTemplateSetupState";
import { isUuidLike } from "@/app/lib/uuid";

type JobCardSecondaryPanelsProps = {
  activeTab: JobCardTabId;
  jobId: string | null;
  companyId?: string;
  listedDraftProposalId: string | null;
};

/**
 * Secondary Job Card domains (measurements / catalog / templates).
 * Loaded only after PERF-1 schedule settlement via next/dynamic.
 */
export default function JobCardSecondaryPanels({
  activeTab,
  jobId,
  companyId,
  listedDraftProposalId,
}: JobCardSecondaryPanelsProps) {
  const [templateStatus, setTemplateStatus] =
    useState<TemplateSetupReadStatus>("idle");
  const [templateError, setTemplateError] = useState<string | null>(null);

  useEffect(() => {
    const cid = (companyId ?? "").trim();
    if (!cid || !isUuidLike(cid)) {
      setTemplateStatus("ready");
      return;
    }
    let cancelled = false;
    setTemplateStatus("loading");
    void import("@/app/lib/proposalTemplateStore")
      .then(({ getProposalTemplatesByCompany }) =>
        getProposalTemplatesByCompany(cid)
      )
      .then((templates) => {
        if (cancelled) return;
        const applied = applyTemplateSetupFetchResult({
          previousTemplates: [],
          result: { ok: true, templates },
        });
        setTemplateStatus(applied.status);
        setTemplateError(null);
      })
      .catch(() => {
        if (cancelled) return;
        const applied = applyTemplateSetupFetchResult({
          previousTemplates: [],
          result: { ok: false, error: "Templates could not be loaded." },
        });
        setTemplateStatus(applied.status);
        setTemplateError(applied.error);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const placeholder = (tabId: JobCardTabId, title: string, body: string) => (
    <JobCardSectionPanel tabId={tabId} activeTab={activeTab} title={title}>
      <p className="text-sm text-slate-600">{body}</p>
    </JobCardSectionPanel>
  );

  return (
    <>
      <JobCardSectionPanel
        tabId="measurements"
        activeTab={activeTab}
        title="Measurements"
        subtitle="Roof size and measurement record"
      >
        <p className="text-sm text-slate-600">
          Measurement editing stays on this Job. Catalog and template setup are
          secondary and do not block Job identity or schedule.
        </p>
        {jobId ? (
          <p className="mt-2 text-xs text-slate-500">Job {jobId}</p>
        ) : null}
        {listedDraftProposalId ? (
          <p className="mt-1 text-xs text-slate-500">
            Current draft {listedDraftProposalId}
          </p>
        ) : null}
      </JobCardSectionPanel>
      {templateStatus === "error" ? (
        <p
          className="mt-2 text-xs text-amber-700"
          data-jobcard-template-setup-error
        >
          {templateError ?? "Templates could not be loaded."} This is not “no
          templates configured.”
        </p>
      ) : null}
      {placeholder("tasks", "Tasks", "Task workflow is a future surface.")}
      {placeholder(
        "material_orders",
        "Material Orders",
        "Material orders are not created yet."
      )}
      {placeholder(
        "work_orders",
        "Work Orders",
        "Work orders are not created yet. See Job schedule for planned work."
      )}
      {placeholder("invoices", "Invoices", "Invoices are a future surface.")}
      {placeholder("job_costing", "Job Costing", "Job costing is a future surface.")}
      {placeholder(
        "attachments",
        "Attachments",
        "Attachments are not uploaded yet."
      )}
      {placeholder(
        "instant_estimate",
        "Instant Estimate",
        "Instant Estimate is a future surface."
      )}
    </>
  );
}
