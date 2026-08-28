"use client";

import { useEffect, useMemo, useState } from "react";
import { composeJobActivityItems } from "@/app/lib/jobActivityComposer";
import { listJobActivityEventsForJob } from "@/app/lib/jobActivityReadPersistence";
import type { JobActivityEvent } from "@/app/lib/jobLifecycleTypes";
import type { JobCardProposalSentFactsById } from "@/app/lib/proposalJobCardLifecycleRead";
import type { ProposalRecordStatusSummary } from "@/app/lib/proposalRecordTypes";
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
  ownedAcceptanceItems?: readonly ProposalAcceptanceActivityItem[] | null;
  ownedSignatureItems?: readonly ProposalSignatureActivityItem[] | null;
  /** When true, Job Card payment strip API is the payment owner — do not re-read. */
  skipPaymentEnrichment?: boolean;
};

export default function JobCardActivityPanelWithCustomerRequests({
  jobId,
  proposalIds,
  baseItems = [],
  jobCreatedAt = null,
  proposals = [],
  sentFactsByProposalId = {},
  secondaryEffectsEnabled = true,
  ownedAcceptanceItems = null,
  ownedSignatureItems = null,
  skipPaymentEnrichment = false,
}: JobCardActivityPanelWithCustomerRequestsProps) {
  void proposalIds;
  void baseItems;
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

  useEffect(() => {
    const id = (jobId ?? "").trim();
    let cancelled = false;
    if (!id || !secondaryEffectsEnabled) {
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
    if (ownedAcceptanceItems) return;
    const id = (jobId ?? "").trim();
    let cancelled = false;
    if (!id || !secondaryEffectsEnabled) {
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
  }, [jobId, secondaryEffectsEnabled, ownedAcceptanceItems]);

  useEffect(() => {
    if (ownedSignatureItems) return;
    const id = (jobId ?? "").trim();
    let cancelled = false;
    if (!id || !secondaryEffectsEnabled) {
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
  }, [jobId, secondaryEffectsEnabled, ownedSignatureItems]);

  useEffect(() => {
    const id = (jobId ?? "").trim();
    let cancelled = false;
    if (!id || !secondaryEffectsEnabled || skipPaymentEnrichment) {
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
      })
      .catch(() => {
        if (!cancelled) {
          setPaymentItems((previous) => {
            const applied = applyPaymentEnrichmentFailure({
              previousItems: previous,
            });
            return applied.items;
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [jobId, secondaryEffectsEnabled, skipPaymentEnrichment]);

  const items = useMemo(() => {
    return composeJobActivityItems({
      jobCreatedAt,
      jobActivityEvents: jobEvents,
      proposals,
      sentFactsByProposalId,
      acceptanceItems: ownedAcceptanceItems
        ? [...ownedAcceptanceItems]
        : acceptanceItems,
      signatureItems: ownedSignatureItems
        ? [...ownedSignatureItems]
        : signatureItems,
      paymentItems: skipPaymentEnrichment ? [] : paymentItems,
    });
  }, [
    acceptanceItems,
    ownedAcceptanceItems,
    signatureItems,
    ownedSignatureItems,
    paymentItems,
    skipPaymentEnrichment,
    jobCreatedAt,
    jobEvents,
    proposals,
    sentFactsByProposalId,
  ]);

  return (
    <div
      data-jobcard-activity-with-customer-requests
      data-jobcard-secondary-ready={secondaryEffectsEnabled ? "true" : "false"}
    >
      <JobCardActivityPanel items={items} />
    </div>
  );
}
