/**
 * Phase 6 — packet identity carry-forward + durable create idempotency (Astra G6).
 *
 * Customer / property workspace "New job" / "New job here" open the existing
 * packet birth path with selected identities in the query string.
 * Does not clone prior job commercial/ops truth.
 *
 * Create durability: client generates a UUID operation key *before* the request.
 * Server/createJob stores it on jobs.source_metadata.create_idempotency_key and
 * returns the same job on retry (lost HTTP response / double-submit).
 */

import { isUuidLike } from "@/app/lib/uuid";

export type PacketIdentityEntryParams = {
  customerId?: string | null;
  propertyId?: string | null;
  /** When true, keep customer and force a fresh property entry (Astra "Another property"). */
  anotherProperty?: boolean;
};

export type ParsedPacketIdentityEntry = {
  customerId: string | null;
  propertyId: string | null;
  anotherProperty: boolean;
};

/** Fields that must never be carried from a prior job into packet → createJob. */
export const PACKET_JOB_NON_COPY_FIELDS = [
  "selected_measurement_id",
  "active_proposal_id",
  "latest_estimate_id",
  "latest_proposal_id",
  "production_started_at",
  "completed_at",
  "stage_entered_at",
] as const;

export const PACKET_FIRST_JOB_TITLE = "Start my first job" as const;
export const PACKET_REPEAT_JOB_TITLE = "New job" as const;

/** Session storage for pending/completed packet create operations (UX only; server owns truth). */
export const PACKET_CREATE_OP_STORAGE_KEY = "fielddive.packetCreateOp" as const;

/** source_metadata key written on jobs for durable create idempotency. */
export const JOB_CREATE_IDEMPOTENCY_METADATA_KEY = "create_idempotency_key" as const;

export type PacketCreateOpState = {
  fingerprint: string;
  operationKey: string;
  jobId: string | null;
  at: number;
};

/**
 * The intake page is always "New job". "Start my first job" stays a first-use
 * entry CTA label (Astra G5), never a page title that depends on company history.
 */
export function resolvePacketIntakeTitle(_opts: {
  hasSelectedCustomer?: boolean;
  hasSelectedProperty?: boolean;
  anotherProperty?: boolean;
  fromIdentityParams?: boolean;
}): string {
  return PACKET_REPEAT_JOB_TITLE;
}

export function buildPacketEntryHref(opts: PacketIdentityEntryParams): string {
  const params = new URLSearchParams();
  params.set("entry", "packet");
  const customerId = normalizeUuid(opts.customerId);
  const propertyId = normalizeUuid(opts.propertyId);
  if (customerId) params.set("customer", customerId);
  if (propertyId && !opts.anotherProperty) params.set("property", propertyId);
  if (opts.anotherProperty) params.set("anotherProperty", "1");
  return `/tools/roofing?${params.toString()}`;
}

export function parsePacketIdentitySearchParams(
  searchParams: URLSearchParams | { get(name: string): string | null }
): ParsedPacketIdentityEntry {
  const customerId = normalizeUuid(searchParams.get("customer"));
  const propertyId = normalizeUuid(searchParams.get("property"));
  const anotherProperty = searchParams.get("anotherProperty") === "1";
  return {
    customerId,
    propertyId: anotherProperty ? null : propertyId,
    anotherProperty,
  };
}

function normalizeUuid(value: string | null | undefined): string | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed || !isUuidLike(trimmed)) return null;
  return trimmed;
}

/**
 * Pure guard: packet job draft must only carry identity pointers + contact/address
 * snapshots — never prior commercial/ops FKs or lifecycle timestamps.
 */
export function assertPacketJobDraftIdentityOnly(draft: Record<string, unknown>): {
  ok: boolean;
  leaked: string[];
} {
  const leaked: string[] = [];
  for (const key of PACKET_JOB_NON_COPY_FIELDS) {
    const value = draft[key];
    if (value != null && value !== "") leaked.push(key);
  }
  return { ok: leaked.length === 0, leaked };
}

export function buildPacketCreateFingerprint(parts: {
  companyId: string;
  customerId?: string | null;
  propertyId?: string | null;
  addressLine?: string | null;
}): string {
  return [
    String(parts.companyId || "").trim(),
    normalizeUuid(parts.customerId) ?? "",
    normalizeUuid(parts.propertyId) ?? "",
    String(parts.addressLine || "").trim(),
  ].join("|");
}

export function readCreateIdempotencyKeyFromMetadata(
  meta: Record<string, unknown> | null | undefined
): string | null {
  if (!meta || typeof meta !== "object") return null;
  const raw = meta[JOB_CREATE_IDEMPOTENCY_METADATA_KEY];
  return normalizeUuid(typeof raw === "string" ? raw : null);
}

export function withJobCreateIdempotencyMetadata(
  meta: Record<string, unknown> | null | undefined,
  operationKey: string
): Record<string, unknown> {
  const key = normalizeUuid(operationKey);
  const base = meta && typeof meta === "object" ? { ...meta } : {};
  if (!key) return base;
  return { ...base, [JOB_CREATE_IDEMPOTENCY_METADATA_KEY]: key };
}

/**
 * Ensure a durable create operation key exists *before* the network request.
 * Reuses the same UUID across lost-response retries for the same fingerprint.
 * If a prior attempt already recorded jobId, returns that completion.
 */
export function ensurePacketCreateOperation(
  fingerprint: string,
  storage: Pick<Storage, "getItem" | "setItem"> | null | undefined,
  nowMs: number = Date.now(),
  newKey: () => string = () => crypto.randomUUID()
): { operationKey: string; existingJobId: string | null } {
  const fp = String(fingerprint || "").trim();
  if (!fp) {
    const operationKey = newKey();
    return { operationKey, existingJobId: null };
  }

  let prior: PacketCreateOpState | null = null;
  try {
    const raw = storage?.getItem(PACKET_CREATE_OP_STORAGE_KEY) ?? null;
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PacketCreateOpState>;
      if (
        parsed.fingerprint === fp &&
        typeof parsed.operationKey === "string" &&
        isUuidLike(parsed.operationKey)
      ) {
        prior = {
          fingerprint: fp,
          operationKey: parsed.operationKey,
          jobId:
            typeof parsed.jobId === "string" && isUuidLike(parsed.jobId)
              ? parsed.jobId
              : null,
          at: typeof parsed.at === "number" ? parsed.at : nowMs,
        };
      }
    }
  } catch {
    prior = null;
  }

  if (prior?.jobId) {
    return { operationKey: prior.operationKey, existingJobId: prior.jobId };
  }

  const operationKey =
    prior?.operationKey && isUuidLike(prior.operationKey)
      ? prior.operationKey
      : newKey();

  const next: PacketCreateOpState = {
    fingerprint: fp,
    operationKey,
    jobId: null,
    at: nowMs,
  };
  try {
    storage?.setItem(PACKET_CREATE_OP_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return { operationKey, existingJobId: null };
}

export function markPacketCreateOperationComplete(
  fingerprint: string,
  operationKey: string,
  jobId: string,
  storage: Pick<Storage, "getItem" | "setItem"> | null | undefined,
  nowMs: number = Date.now()
): void {
  const fp = String(fingerprint || "").trim();
  const key = normalizeUuid(operationKey);
  const id = normalizeUuid(jobId);
  if (!fp || !key || !id) return;
  try {
    storage?.setItem(
      PACKET_CREATE_OP_STORAGE_KEY,
      JSON.stringify({
        fingerprint: fp,
        operationKey: key,
        jobId: id,
        at: nowMs,
      } satisfies PacketCreateOpState)
    );
  } catch {
    /* ignore */
  }
}

/**
 * Pure create orchestration used by createJob and lost-response tests.
 * Server truth: find-by-key → insert → on unique conflict find-by-key again.
 */
export async function createJobWithIdempotency<TRecord extends { id: string }>(args: {
  companyId: string;
  createIdempotencyKey: string | null;
  findExisting: (companyId: string, key: string) => Promise<TRecord | null>;
  insert: () => Promise<
    | { ok: true; record: TRecord }
    | { ok: false; uniqueViolation: boolean }
  >;
}): Promise<TRecord | null> {
  const companyId = String(args.companyId || "").trim();
  const key = normalizeUuid(args.createIdempotencyKey);
  if (!companyId) return null;

  if (key) {
    const existing = await args.findExisting(companyId, key);
    if (existing?.id) return existing;
  }

  const inserted = await args.insert();
  if (inserted.ok) return inserted.record;

  if (inserted.uniqueViolation && key) {
    return args.findExisting(companyId, key);
  }
  return null;
}
