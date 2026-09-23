"use client";

import { useEffect, useState } from "react";
import JobCardSectionPanel from "@/app/tools/roofing/jobCard/JobCardSectionPanel";
import JobCardQuietEmptyState from "@/app/tools/roofing/jobCard/JobCardQuietEmptyState";
import JobCardAttachmentsWorkspace from "@/app/tools/roofing/jobCard/JobCardAttachmentsWorkspace";
import JobCardTasksWorkspace from "@/app/tools/roofing/jobCard/JobCardTasksWorkspace";
import { useJobCardAttachments } from "@/app/tools/roofing/jobCard/useJobCardAttachments";
import type { useJobCardTasks } from "@/app/tools/roofing/jobCard/useJobCardTasks";
import type { JobCardTabId } from "@/app/tools/roofing/jobCard/jobCardTypes";
import { applyTemplateSetupFetchResult } from "@/app/lib/jobCardTemplateSetupState";
import type { TemplateSetupReadStatus } from "@/app/lib/jobCardTemplateSetupState";
import { isUuidLike } from "@/app/lib/uuid";
import type { CompanyMemberClientItem } from "@/app/tools/roofing/jobCard/useCompanyMembers";

type TasksApi = ReturnType<typeof useJobCardTasks>;

type JobCardSecondaryPanelsProps = {
  activeTab: JobCardTabId;
  jobId: string | null;
  companyId?: string;
  listedDraftProposalId: string | null;
  tasks: TasksApi;
  canAssignTasks?: boolean;
  members?: readonly CompanyMemberClientItem[];
};

/**
 * Reserved Job Card domains that are not yet operational, plus Tasks and Attachments.
 * Measurements are owned by JobCardMeasurementsWorkspace, not this file.
 * Tasks is owned by JobCardTasksWorkspace in this file.
 * Attachments is owned by JobCardAttachmentsWorkspace in this file.
 */
export default function JobCardSecondaryPanels({
  activeTab,
  jobId,
  companyId,
  listedDraftProposalId,
  tasks,
  canAssignTasks = false,
  members = [],
}: JobCardSecondaryPanelsProps) {
  void listedDraftProposalId;
  const attachmentsEnabled = activeTab === "attachments";
  const attachments = useJobCardAttachments({
    jobId,
    enabled: attachmentsEnabled && Boolean(jobId),
  });
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

  const quiet = (tabId: JobCardTabId, title: string, message: string, testId: string) => (
    <JobCardSectionPanel tabId={tabId} activeTab={activeTab} title={title}>
      <JobCardQuietEmptyState message={message} testId={testId} />
    </JobCardSectionPanel>
  );

  return (
    <>
      {templateStatus === "error" ? (
        <p
          className="mt-2 text-xs text-amber-700"
          data-jobcard-template-setup-error
        >
          {templateError ?? "Templates could not be loaded."} This is not “no
          templates configured.”
        </p>
      ) : null}
      <JobCardTasksWorkspace
        activeTab={activeTab}
        tasks={tasks.tasks}
        loading={tasks.loading}
        error={tasks.error}
        canAssignTasks={canAssignTasks}
        members={members}
        onCreate={tasks.create}
        onUpdate={tasks.updateContent}
        onComplete={tasks.complete}
        onReopen={tasks.reopen}
        onRemove={tasks.remove}
        onAssign={tasks.assign}
      />
      {quiet("material_orders", "Material Orders", "No material orders yet.", "material_orders")}
      {quiet("work_orders", "Work Orders", "No work orders yet.", "work_orders")}
      {quiet("invoices", "Invoices", "No invoices yet.", "invoices")}
      {quiet("job_costing", "Job Costing", "No job costing yet.", "job_costing")}
      <JobCardSectionPanel
        tabId="attachments"
        activeTab={activeTab}
        title="Attachments"
      >
        <JobCardAttachmentsWorkspace
          attachments={attachments.attachments}
          pending={attachments.pending}
          loading={attachments.loading}
          error={attachments.error}
          onAddFiles={attachments.uploadFiles}
          onRetry={attachments.retry}
          onCancelPending={attachments.cancel}
          onCaption={attachments.patchCaption}
          onRemove={attachments.remove}
        />
      </JobCardSectionPanel>
      {quiet("instant_estimate", "Instant Estimate", "No instant estimate yet.", "instant_estimate")}
    </>
  );
}
