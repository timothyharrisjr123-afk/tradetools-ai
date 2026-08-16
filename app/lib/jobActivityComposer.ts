/**
 * Composed Job Activity read model.
 *
 * Sources:
 *   1. job_activity_events (job-native)
 *   2. allowlisted proposal facts already loaded on the Job Card
 *   3. proposal_customer_requests (composed by the panel)
 *
 * Never surfaces Job Card opened, autosave, previewed, or snapshot_frozen.
 */

import type { JobCardActivityItem } from "@/app/tools/roofing/jobCard/JobCardActivityPanel";
import type { JobActivityEvent } from "@/app/lib/jobLifecycleTypes";
import {
  canonicalJobStageLabel,
  isCanonicalJobStage,
} from "@/app/lib/jobLifecycleMapper";
import type { CanonicalJobStage } from "@/app/lib/jobLifecycleTypes";
import type { ProposalRecordStatusSummary } from "@/app/lib/proposalRecordTypes";
import type { JobCardProposalSentFactsById } from "@/app/lib/proposalJobCardLifecycleRead";
import { deriveContractorProposalLifecycle } from "@/app/lib/proposalContractorLifecycle";

const FORBIDDEN_ACTIVITY_LABEL =
  /\b(Job card opened|Estimate loaded|autosave|previewed|snapshot_frozen|Builder opened|Preview opened)\b/i;

export type ComposedProposalActivityFact = {
  proposal_id: string;
  created_at: string | null;
  latest_sent_frozen_at: string | null;
  revision_sent: boolean;
};

export type ComposeJobActivityInput = {
  jobCreatedAt?: string | null;
  jobActivityEvents?: readonly JobActivityEvent[];
  proposals?: readonly ProposalRecordStatusSummary[];
  sentFactsByProposalId?: JobCardProposalSentFactsById;
  customerRequestItems?: readonly JobCardActivityItem[];
};

function parseTs(iso: string | null | undefined): number {
  const ts = Date.parse(String(iso ?? ""));
  return Number.isFinite(ts) ? ts : 0;
}

function formatWhen(iso: string | null | undefined): string | undefined {
  const ts = parseTs(iso);
  if (!ts) return undefined;
  return new Date(ts).toLocaleString();
}

function payloadString(
  payload: Record<string, unknown> | null | undefined,
  key: string
): string | null {
  const value = payload?.[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function stageLabelFromPayload(
  payload: Record<string, unknown> | null | undefined,
  key: string
): string | null {
  const raw = payloadString(payload, key);
  if (raw && isCanonicalJobStage(raw)) {
    return canonicalJobStageLabel(raw as CanonicalJobStage);
  }
  return raw;
}

export function composeJobActivityItems(
  input: ComposeJobActivityInput
): JobCardActivityItem[] {
  const items: Array<JobCardActivityItem & { sortTs: number }> = [];
  const seen = new Set<string>();

  const push = (item: JobCardActivityItem, iso: string | null | undefined) => {
    if (FORBIDDEN_ACTIVITY_LABEL.test(item.label) || FORBIDDEN_ACTIVITY_LABEL.test(item.note)) {
      return;
    }
    const key = `${item.label}|${iso ?? ""}|${item.note}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({
      ...item,
      when: item.when ?? formatWhen(iso),
      sortTs: parseTs(iso),
    });
  };

  const createdAt = input.jobCreatedAt ?? null;
  const createdFromEvents = (input.jobActivityEvents ?? []).some(
    (event) => event.event_type === "job_created"
  );
  if (createdAt && !createdFromEvents) {
    push(
      {
        label: "Job created",
        note: "Job entered Intake",
      },
      createdAt
    );
  }

  for (const event of input.jobActivityEvents ?? []) {
    const payload = event.payload_json ?? {};
    if (event.event_type === "job_created") {
      push(
        {
          label: "Job created",
          note: "Job entered Intake",
        },
        event.occurred_at
      );
      continue;
    }
    if (event.event_type === "stage_changed") {
      const fromLabel = stageLabelFromPayload(payload, "from_stage") ?? "prior stage";
      const toLabel = stageLabelFromPayload(payload, "to_stage") ?? "next stage";
      const reason = payloadString(payload, "reason");
      push(
        {
          label: `Moved to ${toLabel}`,
          note:
            reason === "first_proposal_created"
              ? "First proposal created"
              : `From ${fromLabel}`,
        },
        event.occurred_at
      );
      continue;
    }
    if (event.event_type === "disposition_changed") {
      const toStatus = payloadString(payload, "to_status");
      const reopened = payload.reopened === true;
      if (reopened || toStatus === "active") {
        push(
          { label: "Reopened", note: "Disposition returned to Active" },
          event.occurred_at
        );
        continue;
      }
      if (toStatus === "on_hold") {
        push({ label: "On hold", note: "Job placed on hold" }, event.occurred_at);
        continue;
      }
      if (toStatus === "lost") {
        push({ label: "Lost", note: "Job marked lost" }, event.occurred_at);
        continue;
      }
      if (toStatus === "closed") {
        push({ label: "Closed", note: "Job closed" }, event.occurred_at);
      }
    }
  }

  for (const proposal of input.proposals ?? []) {
    if (proposal.created_at) {
      push(
        {
          label: "Proposal created",
          note: proposal.title?.trim() || "Draft proposal created",
        },
        proposal.created_at
      );
    }

    const facts = input.sentFactsByProposalId?.[proposal.id];
    const lifecycle = deriveContractorProposalLifecycle({
      latestSentVersionId: proposal.latest_sent_version_id,
      signedVersionId: proposal.signed_version_id,
      draftUpdatedAt: proposal.updated_at,
      latestSentFrozenAt: facts?.latestSentFrozenAt ?? null,
      headerStatus: proposal.status,
    });

    if (facts?.latestSentFrozenAt) {
      const sentCount = facts.history?.length ?? 1;
      push(
        {
          label: sentCount > 1 ? "Revision sent" : "Proposal sent",
          note:
            lifecycle.kind === "revision_in_progress"
              ? "Latest sent version; a newer draft exists"
              : facts.history?.[sentCount - 1]?.packageLabel?.trim() ||
                "Latest sent version",
        },
        facts.latestSentFrozenAt
      );
    }
  }

  for (const request of input.customerRequestItems ?? []) {
    push(request, null);
  }

  return items
    .sort((a, b) => b.sortTs - a.sortTs)
    .map((item) => ({
      label: item.label,
      note: item.note,
      when: item.when,
    }));
}

export const JOB_ACTIVITY_FORBIDDEN_EVENT_TYPES = [
  "draft_saved",
  "previewed",
  "snapshot_frozen",
] as const;
