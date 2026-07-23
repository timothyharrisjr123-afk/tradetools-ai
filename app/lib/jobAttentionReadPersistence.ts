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
    .select("id")
    .eq("company_id", input.companyId)
    .eq("id", input.jobId)
    .maybeSingle();
  if (jobError || !job) return { ok: false, error: "not_found" };

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

  const sourceIds = [...new Set(attentionRows.map((row) => row.source_id))];
  const attentionIds = [...new Set(attentionRows.map((row) => row.id))];

  const [
    { data: requestData, error: requestError },
    { data: personalData, error: personalError },
  ] = await Promise.all([
    supabase
      .from("proposal_customer_requests")
      .select(REQUEST_COLUMNS)
      .eq("company_id", input.companyId)
      .in("id", sourceIds),
    supabase
      .from("job_attention_user_state")
      .select(PERSONAL_STATE_COLUMNS)
      .eq("company_id", input.companyId)
      .eq("user_id", input.userId)
      .in("attention_item_id", attentionIds),
  ]);
  queryCount += 2;
  if (requestError || personalError) {
    throw new JobAttentionReadError(
      requestError?.message ??
        personalError?.message ??
        "Unable to load attention context."
    );
  }

  const requests = new Map(
    ((requestData ?? []) as unknown as RequestRow[]).map((row) => [row.id, row])
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
    const request = requests.get(row.source_id);
    const intent = requestIntent(request?.intent);
    const sourceStatus = requestStatus(request?.status);
    const destination = parseJobAttentionDestination(
      row.destination_kind,
      row.destination_json
    );
    if (
      !priority ||
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
      !isUuidLike(row.source_id) ||
      request.id !== row.source_id ||
      request.proposal_id !== row.proposal_id ||
      request.proposal_version_id !== row.proposal_version_id ||
      !destination ||
      destination.requestId !== row.source_id
    ) {
      continue;
    }

    const personal = personalStates.get(row.id);
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
      personalReadAt: personal?.read_at ?? null,
      personalLastViewedAt: personal?.last_viewed_at ?? null,
    });
  }

  return { ok: true, items, queryCount };
}
