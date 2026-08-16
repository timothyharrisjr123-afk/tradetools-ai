"use client";

import { useEffect, useMemo, useState } from "react";
import { composeJobActivityItems } from "@/app/lib/jobActivityComposer";
import { listJobActivityEventsForJob } from "@/app/lib/jobActivityReadPersistence";
import type { JobActivityEvent } from "@/app/lib/jobLifecycleTypes";
import type { JobCardProposalSentFactsById } from "@/app/lib/proposalJobCardLifecycleRead";
import type { ProposalRecordStatusSummary } from "@/app/lib/proposalRecordTypes";
import { formatCustomerRequestActivityNote } from "@/app/lib/proposalCustomerRequestReviewViewModel";
import { useJobProposalCustomerRequests } from "@/app/lib/useProposalCustomerRequests";
import JobCardActivityPanel, {
  type JobCardActivityItem,
} from "./JobCardActivityPanel";

type JobCardActivityPanelWithCustomerRequestsProps = {
  jobId: string | null | undefined;
  proposalIds: readonly string[];
  baseItems?: readonly JobCardActivityItem[];
  jobCreatedAt?: string | null;
  proposals?: readonly ProposalRecordStatusSummary[];
  sentFactsByProposalId?: JobCardProposalSentFactsById;
};

export default function JobCardActivityPanelWithCustomerRequests({
  jobId,
  proposalIds,
  baseItems = [],
  jobCreatedAt = null,
  proposals = [],
  sentFactsByProposalId = {},
}: JobCardActivityPanelWithCustomerRequestsProps) {
  const { requests } = useJobProposalCustomerRequests({
    proposalIds,
    jobId,
    enabled: proposalIds.length > 0,
  });
  const [jobEvents, setJobEvents] = useState<JobActivityEvent[]>([]);

  useEffect(() => {
    const id = (jobId ?? "").trim();
    let cancelled = false;
    if (!id) return;
    void listJobActivityEventsForJob(id).then((events) => {
      if (!cancelled) setJobEvents(events);
    });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const items = useMemo(() => {
    const requestItems: JobCardActivityItem[] = requests.map((request) => ({
      when: request.createdAtLabel ?? undefined,
      label: request.headline,
      note: formatCustomerRequestActivityNote({
        message: request.messagePreview,
        status: request.status,
        requested_option_label: request.packageLabel,
      }),
    }));

    return composeJobActivityItems({
      jobCreatedAt,
      jobActivityEvents: jobEvents,
      proposals,
      sentFactsByProposalId,
      customerRequestItems: [...requestItems, ...baseItems],
    });
  }, [
    baseItems,
    jobCreatedAt,
    jobEvents,
    proposals,
    requests,
    sentFactsByProposalId,
  ]);

  return (
    <div data-jobcard-activity-with-customer-requests>
      <JobCardActivityPanel items={items} />
    </div>
  );
}
