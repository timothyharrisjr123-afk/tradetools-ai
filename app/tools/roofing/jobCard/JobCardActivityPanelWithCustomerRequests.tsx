"use client";

import { useMemo } from "react";
import { formatCustomerRequestActivityNote } from "@/app/lib/proposalCustomerRequestReviewViewModel";
import { useJobProposalCustomerRequests } from "@/app/lib/useProposalCustomerRequests";
import JobCardActivityPanel, {
  type JobCardActivityItem,
} from "./JobCardActivityPanel";

type JobCardActivityPanelWithCustomerRequestsProps = {
  jobId: string | null | undefined;
  proposalIds: readonly string[];
  baseItems: readonly JobCardActivityItem[];
};

export default function JobCardActivityPanelWithCustomerRequests({
  jobId,
  proposalIds,
  baseItems,
}: JobCardActivityPanelWithCustomerRequestsProps) {
  const { requests } = useJobProposalCustomerRequests({
    proposalIds,
    jobId,
    enabled: proposalIds.length > 0,
  });

  const items = useMemo(() => {
    const requestItems: JobCardActivityItem[] = requests
      .map((request) => ({
        when: request.createdAtLabel ?? undefined,
        label: request.headline,
        note: formatCustomerRequestActivityNote({
          message: request.messagePreview,
          status: request.status,
          requested_option_label: request.packageLabel,
        }),
      }));

    return [...requestItems, ...baseItems];
  }, [baseItems, requests]);

  return (
    <div data-jobcard-activity-with-customer-requests>
      <JobCardActivityPanel items={items} />
    </div>
  );
}
