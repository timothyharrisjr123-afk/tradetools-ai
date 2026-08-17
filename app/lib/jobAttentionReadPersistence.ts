import { isUuidLike } from "@/app/lib/jobStore";
import {
  JOB_ATTENTION_SEVERITIES,
  JOB_ATTENTION_STATUSES,
  JOB_ATTENTION_TYPES,
  type JobAttentionSeverity,
  type JobAttentionStatus,
  type JobAttentionType,
} from "@/app/lib/jobAttentionPersistence";
import {
  normalizeAttentionMessage,
  normalizeAttentionMessagePreview,
  parseJobAttentionDestination,
  type JobAttentionPriorityItem,
  type JobAttentionSafeItem,
} from "@/app/lib/jobAttentionReadModel";
import {
  formatProposalAcceptanceAttentionDetail,
  resolveProposalAcceptanceAttentionAction,
} from "@/app/lib/proposalAcceptanceTypes";
import { resolveCanonicalJobStage } from "@/app/lib/jobLifecycleMapper";
import type { SupabaseClient } from "@supabase/supabase-js";

export const JOB_ATTENTION_SUMMARY_PAGE_SIZE = 500;
export const JOB_ATTENTION_SUMMARY_MAX_ROWS = 5000;
export const JOB_ATTENTION_DETAIL_MAX_ROWS = 100;

const SUMMARY_COLUMNS =
  "id,job_id,attention_type,status,base_severity,opened_at";
const DETAIL_COLUMNS =
  "id,job_id,proposal_id,proposal_version_id,attention_type,source_type,source_id,status,base_severity,opened_at,acknowledged_at,destination_kind,destination_json";
const REQUEST_COLUMNS =
  "id,intent,status,requested_option_label,message,customer_name,customer_email,customer_phone,proposal_id,proposal_version_id";
const ACCEPTANCE_COLUMNS =
  "id,proposal_id,proposal_version_id,accepted_option_label,accepted_total_cents,ambiguity_reason,accepted_at,accepted_by_name,accepted_by_email";
const PERSONAL_STATE_COLUMNS =
  "attention_item_id,read_at,last_viewed_at";

type SummaryRow = {
  id: string;
  job_id: string;
  attention_type: string;
  status: string;
  base_severity: string;
  opened_at: string;
};

type DetailRow = SummaryRow & {
  proposal_id: string | null;
  proposal_version_id: string | null;
  source_type: string;
  source_id: string;
  acknowledged_at: string | null;
  destination_kind: string;
  destination_json: unknown;
};

type RequestRow = {
  id: string;
  intent: string;
  status: string;
  requested_option_label: string | null;
  message: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  proposal_id: string;
  proposal_version_id: string;
};

type AcceptanceRow = {
  id: string;
  proposal_id: string;
  proposal_version_id: string;
  accepted_option_label: string | null;
  accepted_total_cents: number | null;
  ambiguity_reason: string | null;
  accepted_at: string | null;
  accepted_by_name: string | null;
  accepted_by_email: string | null;
};

type PersonalStateRow = {
  attention_item_id: string;
  read_at: string | null;
  last_viewed_at: string | null;
};

export class JobAttentionReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JobAttentionReadError";
  }
}

function isAttentionType(value: unknown): value is JobAttentionType {
  return (
    typeof value === "string" &&
    (JOB_ATTENTION_TYPES as readonly string[]).includes(value)
  );
}

function isAttentionStatus(value: unknown): value is JobAttentionStatus {
  return (
    typeof value === "string" &&
    (JOB_ATTENTION_STATUSES as readonly string[]).includes(value)
  );
}

function isSeverity(value: unknown): value is JobAttentionSeverity {
  return (
    typeof value === "string" &&
    (JOB_ATTENTION_SEVERITIES as readonly string[]).includes(value)
  );
}

function parseSummaryRow(row: SummaryRow): JobAttentionPriorityItem | null {
  if (
    !isUuidLike(row.id) ||
    !isUuidLike(row.job_id) ||
    !isAttentionType(row.attention_type) ||
    !isAttentionStatus(row.status) ||
    row.status === "resolved" ||
    !isSeverity(row.base_severity) ||
    !Number.isFinite(Date.parse(row.opened_at))
  ) {
    return null;
  }
  return {
    id: row.id,
    jobId: row.job_id,
    attentionType: row.attention_type,
    status: row.status,
    severity: row.base_severity,
    openedAt: row.opened_at,
  };
}

function requestIntent(
  value: unknown
): "request_package" | "ask_question" | "ask_about_package" | null {
  return value === "request_package" ||
    value === "ask_question" ||
    value === "ask_about_package"
    ? value
    : null;
}

function requestStatus(
  value: unknown
): "new" | "seen" | "dismissed" | null {
  return value === "new" || value === "seen" || value === "dismissed"
    ? value
    : null;
}

export async function listActiveAttentionSummaryRowsWithClient(
  supabase: SupabaseClient,
  companyId: string
): Promise<{
  items: JobAttentionPriorityItem[];
  queryCount: number;
  truncated: boolean;
}> {
  if (!isUuidLike(companyId)) {
    throw new JobAttentionReadError("companyId must be a UUID.");
  }

  const collected: JobAttentionPriorityItem[] = [];
  let queryCount = 0;
  let offset = 0;
  let truncated = false;

  while (offset < JOB_ATTENTION_SUMMARY_MAX_ROWS) {
    const end = Math.min(
      offset + JOB_ATTENTION_SUMMARY_PAGE_SIZE,
      JOB_ATTENTION_SUMMARY_MAX_ROWS
    ) - 1;
    const { data, error } = await supabase
      .from("job_attention_items")
      .select(SUMMARY_COLUMNS)
      .eq("company_id", companyId)
      .in("status", ["open", "acknowledged"])
      .order("opened_at", { ascending: true })
      .range(offset, end);
    queryCount += 1;
    if (error) {
      throw new JobAttentionReadError(
        error.message ?? "Unable to load job attention summaries."
      );
    }
    const page = (data ?? []) as unknown as SummaryRow[];
    for (const row of page) {
      const parsed = parseSummaryRow(row);
      if (parsed) collected.push(parsed);
    }
    if (page.length < JOB_ATTENTION_SUMMARY_PAGE_SIZE) break;
    offset += JOB_ATTENTION_SUMMARY_PAGE_SIZE;
    if (offset >= JOB_ATTENTION_SUMMARY_MAX_ROWS) truncated = true;
  }

  return { items: collected, queryCount, truncated };
}

export type ActiveJobAttentionDetailResult =
  | { ok: true; items: JobAttentionSafeItem[]; queryCount: number }
  | { ok: false; error: "not_found" };

export async function listActiveJobAttentionDetailWithClient(
  supabase: SupabaseClient,
  input: {
    companyId: string;
    userId: string;
    jobId: string;
  }
): Promise<ActiveJobAttentionDetailResult> {
  if (
    !isUuidLike(input.companyId) ||
    !isUuidLike(input.userId) ||
    !isUuidLike(input.jobId)
  ) {
    return { ok: false, error: "not_found" };
  }

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id,stage,status,archived,active_proposal_id,latest_proposal_id")
    .eq("company_id", input.companyId)
    .eq("id", input.jobId)
    .maybeSingle();
  if (jobError || !job) return { ok: false, error: "not_found" };

  const jobRow = job as {
    id: string;
    stage: string | null;
    status: string | null;
    archived: boolean | null;
    active_proposal_id: string | null;
    latest_proposal_id: string | null;
  };
  const canonicalJobStage = resolveCanonicalJobStage(jobRow);
  const acceptanceAction = resolveProposalAcceptanceAttentionAction({
    canonicalJobStage,
    jobDisposition: jobRow.status,
  });

  let queryCount = 1;
  const { data: attentionData, error: attentionError } = await supabase
    .from("job_attention_items")
    .select(DETAIL_COLUMNS)
    .eq("company_id", input.companyId)
    .eq("job_id", input.jobId)
    .in("status", ["open", "acknowledged"])
    .order("opened_at", { ascending: true })
    .limit(JOB_ATTENTION_DETAIL_MAX_ROWS);
  queryCount += 1;
  if (attentionError) {
    throw new JobAttentionReadError(
      attentionError.message ?? "Unable to load job attention."
    );
  }

  const attentionRows = (attentionData ?? []) as unknown as DetailRow[];
  if (attentionRows.length === 0) {
    return { ok: true, items: [], queryCount };
  }

  const requestIds = [
    ...new Set(
      attentionRows
        .filter((row) => row.source_type === "proposal_customer_requests")
        .map((row) => row.source_id)
    ),
  ];
  const acceptanceIds = [
    ...new Set(
      attentionRows
        .filter((row) => row.source_type === "proposal_acceptances")
        .map((row) => row.source_id)
    ),
  ];
  const attentionIds = [...new Set(attentionRows.map((row) => row.id))];

  const [
    { data: requestData, error: requestError },
    { data: acceptanceData, error: acceptanceError },
    { data: personalData, error: personalError },
  ] = await Promise.all([
    requestIds.length > 0
      ? supabase
          .from("proposal_customer_requests")
          .select(REQUEST_COLUMNS)
          .eq("company_id", input.companyId)
          .in("id", requestIds)
      : Promise.resolve({ data: [], error: null }),
    acceptanceIds.length > 0
      ? supabase
          .from("proposal_acceptances")
          .select(ACCEPTANCE_COLUMNS)
          .eq("company_id", input.companyId)
          .in("id", acceptanceIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("job_attention_user_state")
      .select(PERSONAL_STATE_COLUMNS)
      .eq("company_id", input.companyId)
      .eq("user_id", input.userId)
      .in("attention_item_id", attentionIds),
  ]);
  queryCount += 2 + (requestIds.length > 0 ? 1 : 0) + (acceptanceIds.length > 0 ? 1 : 0) - 1;
  if (requestError || acceptanceError || personalError) {
    throw new JobAttentionReadError(
      requestError?.message ??
        acceptanceError?.message ??
        personalError?.message ??
        "Unable to load attention context."
    );
  }

  const requests = new Map(
    ((requestData ?? []) as unknown as RequestRow[]).map((row) => [row.id, row])
  );
  const acceptances = new Map(
    ((acceptanceData ?? []) as unknown as AcceptanceRow[]).map((row) => [
      row.id,
      row,
    ])
  );
  const personalStates = new Map(
    ((personalData ?? []) as unknown as PersonalStateRow[]).map((row) => [
      row.attention_item_id,
      row,
    ])
  );

  const items: JobAttentionSafeItem[] = [];
  for (const row of attentionRows) {
    const priority = parseSummaryRow(row);
    const destination = parseJobAttentionDestination(
      row.destination_kind,
      row.destination_json
    );
    if (!priority || !destination || !isUuidLike(row.source_id)) continue;

    const personal = personalStates.get(row.id);

    if (row.source_type === "proposal_acceptances") {
      const acceptance = acceptances.get(row.source_id);
      if (
        !acceptance ||
        priority.attentionType !== "acceptance_confirmation_required" ||
        acceptance.proposal_id !== row.proposal_id ||
        acceptance.proposal_version_id !== row.proposal_version_id ||
        destination.acceptanceId !== row.source_id
      ) {
        continue;
      }
      const contractorReason = formatProposalAcceptanceAttentionDetail({
        ambiguityReason: acceptance.ambiguity_reason,
        packageLabel: acceptance.accepted_option_label,
        acceptedTotalCents: acceptance.accepted_total_cents,
        acceptedAt: acceptance.accepted_at,
        attentionAction: acceptanceAction,
      });
      items.push({
        ...priority,
        proposalId: row.proposal_id,
        proposalVersionId: row.proposal_version_id,
        sourceType: "proposal_acceptances",
        sourceId: row.source_id,
        acknowledgedAt: row.acknowledged_at,
        destination,
        request: null,
        acceptance: {
          acceptanceId: acceptance.id,
          packageLabel: normalizeAttentionMessage(acceptance.accepted_option_label),
          acceptedTotalCents: Number.isInteger(acceptance.accepted_total_cents)
            ? acceptance.accepted_total_cents
            : null,
          ambiguityReason: normalizeAttentionMessage(acceptance.ambiguity_reason),
          contractorReason,
          reviewRequired: Boolean(
            normalizeAttentionMessage(acceptance.ambiguity_reason)
          ),
          attentionAction: acceptanceAction,
          acceptedAt: acceptance.accepted_at,
          acceptedByName: normalizeAttentionMessage(acceptance.accepted_by_name),
          acceptedByEmail: normalizeAttentionMessage(acceptance.accepted_by_email),
        },
        personalReadAt: personal?.read_at ?? null,
        personalLastViewedAt: personal?.last_viewed_at ?? null,
      });
      continue;
    }

    if (row.source_type === "jobs") {
      if (priority.attentionType !== "payments_not_connected") continue;
      items.push({
        ...priority,
        proposalId: row.proposal_id,
        proposalVersionId: row.proposal_version_id,
        sourceType: "jobs",
        sourceId: row.source_id,
        acknowledgedAt: row.acknowledged_at,
        destination,
        request: null,
        acceptance: null,
        personalReadAt: personal?.read_at ?? null,
        personalLastViewedAt: personal?.last_viewed_at ?? null,
      });
      continue;
    }

    if (row.source_type === "job_payment_requests") {
      if (priority.attentionType !== "payment_failed") continue;
      items.push({
        ...priority,
        proposalId: row.proposal_id,
        proposalVersionId: row.proposal_version_id,
        sourceType: "job_payment_requests",
        sourceId: row.source_id,
        acknowledgedAt: row.acknowledged_at,
        destination,
        request: null,
        acceptance: null,
        personalReadAt: personal?.read_at ?? null,
        personalLastViewedAt: personal?.last_viewed_at ?? null,
      });
      continue;
    }

    const request = requests.get(row.source_id);
    const intent = requestIntent(request?.intent);
    const sourceStatus = requestStatus(request?.status);
    if (
      !request ||
      !intent ||
      !sourceStatus ||
      sourceStatus === "dismissed" ||
      (sourceStatus === "new" && priority.status !== "open") ||
      (sourceStatus === "seen" && priority.status !== "acknowledged") ||
      (intent === "request_package" &&
        priority.attentionType !== "customer_package_request") ||
      (intent !== "request_package" &&
        priority.attentionType !== "customer_question") ||
      row.source_type !== "proposal_customer_requests" ||
      request.id !== row.source_id ||
      request.proposal_id !== row.proposal_id ||
      request.proposal_version_id !== row.proposal_version_id ||
      destination.requestId !== row.source_id
    ) {
      continue;
    }

    items.push({
      ...priority,
      proposalId: row.proposal_id,
      proposalVersionId: row.proposal_version_id,
      sourceType: "proposal_customer_requests",
      sourceId: row.source_id,
      acknowledgedAt: row.acknowledged_at,
      destination,
      request: {
        requestId: request.id,
        intent,
        requestStatus: sourceStatus,
        packageLabel: normalizeAttentionMessage(request.requested_option_label),
        message: normalizeAttentionMessage(request.message),
        messagePreview: normalizeAttentionMessagePreview(request.message),
        customerName: normalizeAttentionMessage(request.customer_name),
        customerEmail: normalizeAttentionMessage(request.customer_email),
        customerPhone: normalizeAttentionMessage(request.customer_phone),
      },
      acceptance: null,
      personalReadAt: personal?.read_at ?? null,
      personalLastViewedAt: personal?.last_viewed_at ?? null,
    });
  }

  return { ok: true, items, queryCount };
}
