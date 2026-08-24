"use client";

import { useEffect, useMemo, useState } from "react";
import { composeJobActivityItems } from "@/app/lib/jobActivityComposer";
import { listJobActivityEventsForJob } from "@/app/lib/jobActivityReadPersistence";
import type { JobActivityEvent } from "@/app/lib/jobLifecycleTypes";
import type { JobCardProposalSentFactsById } from "@/app/lib/proposalJobCardLifecycleRead";
import type { ProposalRecordStatusSummary } from "@/app/lib/proposalRecordTypes";
import { formatCustomerRequestActivityNote } from "@/app/lib/proposalCustomerRequestReviewViewModel";
import {
  composeProposalAcceptanceActivityItems,
  listJobProposalAcceptances,
  type ProposalAcceptanceActivityItem,
} from "@/app/lib/proposalAcceptanceActivity";
import {
  composeProposalSignatureActivityItems,
  listJobProposalSignatures,
  type ProposalSignatureActivityItem,
} from "@/app/lib/proposalSignatureActivity";
import {
  composeJobPaymentActivityItems,
  type JobPaymentActivityItem,
} from "@/app/lib/jobPaymentReadModel";
import {
  listJobPaymentRequests,
  listJobPaymentTransactionsForRequests,
} from "@/app/lib/jobPaymentClientRead";
import { applyPaymentEnrichmentFailure } from "@/app/lib/surfaceReadFailureSemantics";
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
  /** When false, defer secondary activity/acceptance/signature/payment reads. */
  secondaryEffectsEnabled?: boolean;
};

export default function JobCardActivityPanelWithCustomerRequests({
  jobId,
  proposalIds,
  baseItems = [],
  jobCreatedAt = null,
  proposals = [],
  sentFactsByProposalId = {},
  secondaryEffectsEnabled = true,
}: JobCardActivityPanelWithCustomerRequestsProps) {
  const { requests } = useJobProposalCustomerRequests({
    proposalIds,
    jobId,
    enabled: secondaryEffectsEnabled && proposalIds.length > 0,
  });
  const [jobEvents, setJobEvents] = useState<JobActivityEvent[]>([]);
  const [acceptanceItems, setAcceptanceItems] = useState<
    ProposalAcceptanceActivityItem[]
  >([]);
  const [signatureItems, setSignatureItems] = useState<
    ProposalSignatureActivityItem[]
  >([]);
  const [paymentItems, setPaymentItems] = useState<JobPaymentActivityItem[]>(
    []
  );
  const [paymentEnrichmentError, setPaymentEnrichmentError] = useState<
    string | null
  >(null);

  useEffect(() => {
    const id = (jobId ?? "").trim();
    let cancelled = false;
    if (!id || !secondaryEffectsEnabled) {
      setJobEvents([]);
      return;
    }
    void listJobActivityEventsForJob(id).then((events) => {
      if (!cancelled) setJobEvents(events);
    });
    return () => {
      cancelled = true;
    };
  }, [jobId, secondaryEffectsEnabled]);

  useEffect(() => {
    const id = (jobId ?? "").trim();
    let cancelled = false;
    if (!id || !secondaryEffectsEnabled) {
      setAcceptanceItems([]);
      return;
    }
    void listJobProposalAcceptances(id).then((acceptances) => {
      if (!cancelled) {
        setAcceptanceItems(composeProposalAcceptanceActivityItems(acceptances));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [jobId, secondaryEffectsEnabled]);

  useEffect(() => {
    const id = (jobId ?? "").trim();
    let cancelled = false;
    if (!id || !secondaryEffectsEnabled) {
      setSignatureItems([]);
      return;
    }
    void listJobProposalSignatures(id).then((signatures) => {
      if (!cancelled) {
        setSignatureItems(composeProposalSignatureActivityItems(signatures));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [jobId, secondaryEffectsEnabled]);

  useEffect(() => {
    const id = (jobId ?? "").trim();
    let cancelled = false;
    if (!id || !secondaryEffectsEnabled) {
      setPaymentItems([]);
      setPaymentEnrichmentError(null);
      return;
    }
    void listJobPaymentRequests(id)
      .then(async (paymentRequests) => {
        const transactions = await listJobPaymentTransactionsForRequests(
          paymentRequests.map((row) => row.id)
        );
        if (cancelled) return;
        setPaymentItems(
          composeJobPaymentActivityItems({
            requests: paymentRequests,
            transactions,
          })
        );
        setPaymentEnrichmentError(null);
      })
      .catch(() => {
        if (!cancelled) {
          setPaymentItems((previous) => {
            const applied = applyPaymentEnrichmentFailure({
              previousItems: previous,
            });
            return applied.items;
          });
          setPaymentEnrichmentError("Payment history unavailable.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [jobId, secondaryEffectsEnabled]);

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
      acceptanceItems,
      signatureItems,
      paymentItems,
    });
  }, [
    acceptanceItems,
    signatureItems,
    paymentItems,
    baseItems,
    jobCreatedAt,
    jobEvents,
    proposals,
    requests,
    sentFactsByProposalId,
  ]);

  return (
    <div
      data-jobcard-activity-with-customer-requests
      data-jobcard-secondary-ready={secondaryEffectsEnabled ? "true" : "false"}
    >
      {paymentEnrichmentError ? (
        <p
          className="px-4 pt-2 text-[11px] text-slate-500"
          data-activity-payment-enrichment-error
        >
          {paymentEnrichmentError}
        </p>
      ) : null}
      <JobCardActivityPanel items={items} />
    </div>
  );
}
