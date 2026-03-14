import { getSupabaseClient } from "@/app/lib/supabaseClient";
import { findOrCreateCustomer } from "@/app/lib/customerStore";

export interface RoofingEstimate {
  id: string;
  createdAt: string;
  lastSavedAt?: string;
  sentAt?: string;
  sentToEmail?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  address: string;
  zip: string;
  jobAddress1?: string;
  jobCity?: string;
  jobState?: string;
  jobZip?: string;
  roofAreaSqFt: number;
  selectedTier: "Core" | "Enhanced" | "Premium";
  suggestedPrice: number;
  area?: string;
  waste?: string;
  bundlesPerSquare?: string;
  bundleCost?: string;
  laborPerSquare?: string;
  margin?: string;
  status?: "estimate" | "sent" | "sent_pending" | "approved" | "deposit_paid" | "scheduled" | "in_progress" | "paid";
  /** Set when customer opens approval page or email (synced from KV). */
  viewedAt?: string | null;
  sentTo?: string;
  approvalToken?: string;
  approvalUrl?: string;
  approvedAt?: string;
  needsScheduling?: boolean;
  scheduledAt?: string;
  scheduledStartDate?: string;
  scheduledArrivalWindow?: string;
  scheduleNotes?: string;
  paidAt?: string;
  paidDate?: string;
  paidAmount?: number;
  paidMethod?: string;
  totalContractPrice?: number;
  amountPaid?: number;
  paymentHistory?: Array<{
    id: string;
    date: string;
    amount: number;
    method?: string;
    type?: "deposit" | "progress" | "final";
    note?: string;
  }>;
  revisionOfId?: string;
  revisionNumber?: number;
  materialsCost?: number;
  laborCost?: number;
  disposalCost?: number;
  adjustedSquares?: number;
  squares?: number;
  lastFollowUpAt?: string;
  followUpCount?: number;
  supabaseBacked?: boolean;
}

/** Supabase estimates row (optional snapshot for full app state). */
type SupabaseEstimateRow = {
  id: string;
  company_id?: string | null;
  customer_id?: string | null;
  job_name?: string | null;
  roof_area_sqft?: number | null;
  roof_pitch?: number | null;
  materials_cost?: number | null;
  labor_cost?: number | null;
  tearoff_cost?: number | null;
  margin_percent?: number | null;
  job_cost?: number | null;
  suggested_price?: number | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  snapshot?: RoofingEstimate | null;
};

function parseMargin(m: string | number | undefined): number {
  if (m == null) return 0;
  if (typeof m === "number" && Number.isFinite(m)) return m;
  const n = parseFloat(String(m).trim());
  return Number.isFinite(n) ? n : 0;
}

function rowToEstimate(row: SupabaseEstimateRow): RoofingEstimate {
  const snap = row.snapshot;
  if (snap && typeof snap === "object" && snap.id && snap.createdAt) {
    return {
      ...snap,
      id: snap.id,
      createdAt: snap.createdAt || (row.created_at ?? new Date().toISOString()),
      supabaseBacked: true,
    } as RoofingEstimate;
  }
  const createdAt = row.created_at ?? new Date().toISOString();
  const updatedAt = row.updated_at ?? createdAt;
  return {
    id: row.id,
    createdAt,
    lastSavedAt: updatedAt,
    customerName: "",
    address: "",
    zip: "",
    roofAreaSqFt: Number(row.roof_area_sqft) || 0,
    selectedTier: "Core",
    suggestedPrice: Number(row.suggested_price) || 0,
    materialsCost: row.materials_cost ?? undefined,
    laborCost: row.labor_cost ?? undefined,
    disposalCost: row.tearoff_cost ?? undefined,
    margin: row.margin_percent != null ? String(row.margin_percent) : undefined,
    status: (row.status as RoofingEstimate["status"]) || "estimate",
    totalContractPrice: row.job_cost ?? undefined,
    supabaseBacked: true,
  };
}

function estimateToRow(e: RoofingEstimate, nowIso: string, companyId: string, customerId?: string | null): Record<string, unknown> {
  const jobCost = e.totalContractPrice ?? e.suggestedPrice ?? 0;
  return {
    id: e.id,
    company_id: companyId,
    customer_id: customerId ?? null,
    job_name: (e.jobAddress1 || e.address || `${e.selectedTier} estimate`).slice(0, 500) || null,
    roof_area_sqft: e.roofAreaSqFt ?? 0,
    roof_pitch: null,
    materials_cost: e.materialsCost ?? 0,
    labor_cost: e.laborCost ?? 0,
    tearoff_cost: e.disposalCost ?? 0,
    margin_percent: parseMargin(e.margin),
    job_cost: jobCost,
    suggested_price: e.suggestedPrice ?? 0,
    status: e.status ?? "estimate",
    created_at: e.createdAt || nowIso,
    updated_at: e.lastSavedAt || nowIso,
    snapshot: e,
  };
}

let supabaseFetchStarted = false;

async function fetchEstimatesFromSupabase(): Promise<RoofingEstimate[] | null> {
  const companyId = getEstimateStoreCompanyScope();
  if (!companyId) return null;
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("estimates")
      .select("id, company_id, customer_id, job_name, roof_area_sqft, roof_pitch, materials_cost, labor_cost, tearoff_cost, margin_percent, job_cost, suggested_price, status, created_at, updated_at, snapshot")
      .eq("company_id", companyId);
    if (error) {
      if (error.message?.includes("snapshot") || error.code === "42703") {
        console.warn("[estimateStore] Supabase: snapshot column may be missing. Run: alter table estimates add column if not exists snapshot jsonb;");
      } else {
        console.warn("[estimateStore] Supabase fetch failed:", error.message);
      }
      return null;
    }
    const rows = (data ?? []) as SupabaseEstimateRow[];
    return rows.map(rowToEstimate);
  } catch (err) {
    console.warn("[estimateStore] Supabase fetch error:", err);
    return null;
  }
}

async function upsertEstimateToSupabase(e: RoofingEstimate): Promise<boolean> {
  const companyId = getEstimateStoreCompanyScope();
  if (!companyId) return false;
  const supabase = getSupabaseClient();
  if (!supabase) return false;
  const customerId = await findOrCreateCustomer({
    supabase,
    companyId,
    name: e.customerName ?? "",
    email: e.customerEmail ?? "",
    phone: e.customerPhone,
    address: e.address,
  });
  const nowIso = new Date().toISOString();
  const row = estimateToRow(e, nowIso, companyId, customerId);
  try {
    const { error } = await supabase.from("estimates").upsert(row, { onConflict: "id" });
    if (error) {
      if (error.message?.includes("snapshot") || error.code === "42703") {
        console.warn("[estimateStore] Supabase: snapshot column may be missing. Run: alter table estimates add column if not exists snapshot jsonb;");
      } else {
        console.warn("[estimateStore] Supabase upsert failed:", error.message);
      }
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[estimateStore] Supabase upsert error:", err);
    return false;
  }
}

async function deleteEstimateFromSupabase(id: string): Promise<boolean> {
  const companyId = getEstimateStoreCompanyScope();
  if (!companyId) return false;
  const supabase = getSupabaseClient();
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("estimates").delete().eq("id", id).eq("company_id", companyId);
    if (error) {
      console.warn("[estimateStore] Supabase delete failed:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[estimateStore] Supabase delete error:", err);
    return false;
  }
}

function mergeSupabaseIntoLocalStorage(supabaseList: RoofingEstimate[]) {
  if (typeof window === "undefined") return;
  try {
    const key = getScopedSavedKey();
    const local = safeParseList(localStorage.getItem(key));
    const byId = new Map<string, any>();
    for (const item of local) {
      const id = item?.id ? String(item.id) : "";
      if (id) byId.set(id, item);
    }
    for (const e of supabaseList) {
      if (e?.id) byId.set(e.id, e);
    }
    const merged = Array.from(byId.values());
    localStorage.setItem(key, JSON.stringify(merged));
  } catch {}
}

function persistThenSupabase(id: string | null, list: RoofingEstimate[]) {
  try {
    localStorage.setItem(getScopedSavedKey(), JSON.stringify(list));
  } catch {}
  if (id) {
    const e = list.find((x) => x.id === id);
    if (e) upsertEstimateToSupabase(e).catch(() => {});
  }
}

function persistAllThenSupabase(list: RoofingEstimate[]) {
  try {
    localStorage.setItem(getScopedSavedKey(), JSON.stringify(list));
  } catch {}
  Promise.all(list.map((e) => upsertEstimateToSupabase(e))).catch(() => {});
}

function persistListThenSupabaseDelete(id: string, list: RoofingEstimate[]) {
  try {
    localStorage.setItem(getScopedSavedKey(), JSON.stringify(list));
  } catch {}
  deleteEstimateFromSupabase(id).catch(() => {});
}

const STORAGE_KEY = "roofing_saved_estimates";

export const CANON_SAVED_KEY = "ttai_savedEstimates";

let currentEstimateStoreCompanyId: string | null = null;

export function setEstimateStoreCompanyScope(companyId: string | null) {
  currentEstimateStoreCompanyId = companyId ? String(companyId) : null;
}

function getEstimateStoreCompanyScope(): string | null {
  return currentEstimateStoreCompanyId;
}

function getScopedSavedKey(): string {
  const companyId = getEstimateStoreCompanyScope();
  return companyId ? `${CANON_SAVED_KEY}:${companyId}` : CANON_SAVED_KEY;
}

function getLegacyMigrationKey(): string {
  const companyId = getEstimateStoreCompanyScope();
  return companyId ? `${CANON_SAVED_KEY}:legacy-migrated:${companyId}` : `${CANON_SAVED_KEY}:legacy-migrated`;
}

function safeParseList(raw: string | null) {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Reads from scoped key; one-time migrates from legacy keys into scoped key, then returns scoped list only. */
export function getSavedEstimatesSafe(): any[] {
  if (typeof window === "undefined") return [];

  const scopedKey = getScopedSavedKey();
  const scopedRaw = localStorage.getItem(scopedKey);
  const scopedList = safeParseList(scopedRaw);

  if (scopedList.length > 0) {
    return scopedList;
  }

  const migrationKey = getLegacyMigrationKey();
  if (localStorage.getItem(migrationKey) != null) {
    return [];
  }

  const legacyKeys = [
    STORAGE_KEY,
    "savedEstimates",
    "ttai_saved_estimates",
    "ttai_saved_estimate_list",
    "tradetools_savedEstimates",
    CANON_SAVED_KEY,
  ];
  const merged: any[] = [];
  const seen = new Set<string>();

  for (const key of legacyKeys) {
    const list = safeParseList(localStorage.getItem(key));
    for (const item of list) {
      const id = item?.id ? String(item.id) : "";
      if (!id) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      merged.push(item);
    }
  }

  try {
    localStorage.setItem(scopedKey, JSON.stringify(merged));
    localStorage.setItem(migrationKey, "1");
  } catch {}

  return merged;
}

export function patchSavedEstimateByToken(token: string, patch: any) {
  if (typeof window === "undefined") return false;

  const list = getSavedEstimatesSafe();
  const idx = list.findIndex((e: any) => String(e?.approvalToken || "") === String(token || ""));
  if (idx < 0) return false;

  const updated = [...list];
  updated[idx] = { ...updated[idx], ...patch };

  const id = updated[idx]?.id;
  if (id) persistThenSupabase(id, updated);
  else try { localStorage.setItem(getScopedSavedKey(), JSON.stringify(updated)); } catch {}

  return true;
}

function safeUUID() {
  try {
    // @ts-ignore
    return crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function normalizeStatusValue(input: any) {
  const s = String(input || "").toLowerCase().trim();
  if (s === "pending_approval" || s === "pending approval") return "pending";
  if (s === "sent") return "sent";
  if (s === "estimate") return "estimate";
  if (s === "pending") return "pending";
  if (s === "approved") return "approved";
  if (s === "deposit_paid") return "deposit_paid";
  if (s === "scheduled") return "scheduled";
  if (s === "in_progress") return "in_progress";
  if (s === "paid") return "paid";
  return "estimate";
}

function looksSentish(e: any) {
  const st = normalizeStatusValue(e?.status);
  return (
    !!e?.sentAt ||
    !!e?.sentToEmail ||
    st === "sent" ||
    st === "pending" ||
    st === "approved" ||
    st === "deposit_paid" ||
    st === "scheduled" ||
    st === "in_progress" ||
    st === "paid"
  );
}

function migrateSavedEstimatesIfNeeded(list: any[]) {
  let changed = false;
  const migrated = (list || []).map((e) => {
    if (!e || typeof e !== "object") return e;
    const next = { ...e };

    next.viewedAt = next.viewedAt ?? null;

    const norm = normalizeStatusValue(next.status);
    if (next.status !== norm) {
      next.status = norm;
      changed = true;
    }

    // If it was sent (has sentAt/email) but status stayed estimate, bump it.
    if (next.status === "estimate" && (next.sentAt || next.sentToEmail)) {
      next.status = "sent";
      changed = true;
    }

    // If it looks sent-ish but has no token, generate one.
    if (looksSentish(next) && !next.approvalToken) {
      next.approvalToken = safeUUID();
      changed = true;
    }

    return next;
  });

  return { migrated, changed };
}

export type SaveEstimateOpts = { overwriteId?: string };

export function saveEstimate(
  data: RoofingEstimate,
  opts?: SaveEstimateOpts
): string {
  if (typeof window === "undefined") return data.id || "";
  const needsContractTotal = (data.totalContractPrice == null || data.totalContractPrice === 0) && (data.suggestedPrice ?? 0) > 0;
  if (needsContractTotal) {
    data = { ...data, totalContractPrice: data.suggestedPrice };
  }
  const nowIso = new Date().toISOString();
  const overwriteId = opts?.overwriteId;
  const existing = getEstimates();

  if (overwriteId) {
    const next = existing.map((e) =>
      e.id === overwriteId
        ? {
            ...e,
            ...data,
            id: overwriteId,
            lastSavedAt: nowIso,
          }
        : e
    );
    const snapshot = next.find((e: RoofingEstimate) => e.id === overwriteId) ?? data;
    const snapshotWithDrivers = {
      ...snapshot,
      laborMode:
        (snapshot as any).laborMode ??
        ((snapshot as any).laborPerSquare != null ? "perSquare" : undefined),
      manualLaborCost:
        (snapshot as any).manualLaborCost ??
        ((snapshot as any).manualLabor != null ? (snapshot as any).manualLabor : undefined) ??
        ((snapshot as any).laborCost != null ? (snapshot as any).laborCost : undefined),
      dumpFeePerTon:
        (snapshot as any).dumpFeePerTon ??
        ((snapshot as any).dumpFee != null ? (snapshot as any).dumpFee : undefined),
      tearOffEnabled:
        (snapshot as any).tearOffEnabled ??
        ((snapshot as any).tearOff != null ? (snapshot as any).tearOff : undefined) ??
        ((snapshot as any).includeDebrisRemoval != null ? (snapshot as any).includeDebrisRemoval : undefined),
      removalType:
        (snapshot as any).removalType ??
        ((snapshot as any).removal != null ? (snapshot as any).removal : undefined),
    };
    const nextWithDrivers = next.map((e) => (e.id === overwriteId ? snapshotWithDrivers : e));
    persistThenSupabase(overwriteId, nextWithDrivers);
    return overwriteId;
  }

  const id = data.id || crypto.randomUUID();
  const withTimestamps: RoofingEstimate = {
    ...data,
    id,
    createdAt: data.createdAt || nowIso,
    lastSavedAt: nowIso,
    viewedAt: (data as any).viewedAt ?? null,
  };
  const snapshotWithDrivers = {
    ...withTimestamps,
    laborMode:
      (withTimestamps as any).laborMode ??
      ((withTimestamps as any).laborPerSquare != null ? "perSquare" : undefined),
    manualLaborCost:
      (withTimestamps as any).manualLaborCost ??
      ((withTimestamps as any).manualLabor != null ? (withTimestamps as any).manualLabor : undefined) ??
      ((withTimestamps as any).laborCost != null ? (withTimestamps as any).laborCost : undefined),
    dumpFeePerTon:
      (withTimestamps as any).dumpFeePerTon ??
      ((withTimestamps as any).dumpFee != null ? (withTimestamps as any).dumpFee : undefined),
    tearOffEnabled:
      (withTimestamps as any).tearOffEnabled ??
      ((withTimestamps as any).tearOff != null ? (withTimestamps as any).tearOff : undefined) ??
      ((withTimestamps as any).includeDebrisRemoval != null ? (withTimestamps as any).includeDebrisRemoval : undefined),
    removalType:
      (withTimestamps as any).removalType ??
      ((withTimestamps as any).removal != null ? (withTimestamps as any).removal : undefined),
  };
  const nextList = [snapshotWithDrivers, ...existing];
  persistThenSupabase(id, nextList);
  return id;
}

export function getEstimates(): RoofingEstimate[] {
  if (typeof window === "undefined") return [];
  const list = getSavedEstimatesSafe();
  const { migrated, changed } = migrateSavedEstimatesIfNeeded(list);
  if (changed) {
    try {
      localStorage.setItem(getScopedSavedKey(), JSON.stringify(migrated));
      console.log("[MIGRATE SAVED ESTIMATES] repaired records");
    } catch {}
  }
  if (!supabaseFetchStarted && getSupabaseClient()) {
    supabaseFetchStarted = true;
    fetchEstimatesFromSupabase().then((fromDb) => {
      if (fromDb && fromDb.length >= 0) {
        mergeSupabaseIntoLocalStorage(fromDb);
      }
    });
  }
  return migrated;
}

export function getContractTotal(e: RoofingEstimate): number {
  return e.totalContractPrice ?? e.suggestedPrice ?? 0;
}

export function canRecordPayment(e: RoofingEstimate): boolean {
  return getContractTotal(e) > 0;
}

export function getSavedEstimateById(id: string): RoofingEstimate | null {
  const list = getEstimates();
  return list.find((e) => e.id === id) ?? null;
}

export function deleteEstimate(id: string) {
  if (typeof window === "undefined") return;
  const filtered = getEstimates().filter((e) => e.id !== id);
  persistListThenSupabaseDelete(id, filtered);
}

/** @deprecated Use getEstimates */
export const getSavedEstimates = getEstimates;

/** @deprecated Use deleteEstimate */
export const deleteSavedEstimate = deleteEstimate;

const ACTIVE_ESTIMATE_KEY = "roofing_active_saved_estimate_id";
const CURRENT_LOADED_SAVED_ID_KEY = "roofing_current_loaded_saved_id";

export function getCurrentLoadedSavedId(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(CURRENT_LOADED_SAVED_ID_KEY);
}

export function setCurrentLoadedSavedId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id == null) sessionStorage.removeItem(CURRENT_LOADED_SAVED_ID_KEY);
  else sessionStorage.setItem(CURRENT_LOADED_SAVED_ID_KEY, id);
}

export function setActiveSavedEstimateId(id: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(ACTIVE_ESTIMATE_KEY, id);
}

export function getActiveSavedEstimateId(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(ACTIVE_ESTIMATE_KEY);
}

export function clearActiveSavedEstimateId() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(ACTIVE_ESTIMATE_KEY);
}

export function updateSavedEstimate(id: string, patch: Partial<any>) {
  if (typeof window === "undefined") return;
  const nowIso = new Date().toISOString();
  const list = getSavedEstimates();
  const next = list.map((e: any) => {
    if (e.id !== id) return e;
    const merged = { ...e, ...patch, lastSavedAt: nowIso };
    if (patch.status === "scheduled") merged.needsScheduling = false;
    return merged;
  });
  persistThenSupabase(id, next);
}

export function patchSavedEstimate(id: string, patch: Partial<RoofingEstimate>) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(getScopedSavedKey());
    const arr: RoofingEstimate[] = raw ? JSON.parse(raw) : [];
    const nowIso = new Date().toISOString();
    const next = arr.map((e) => {
      if (e.id !== id) return e;
      return { ...e, ...patch, lastSavedAt: nowIso };
    });
    persistThenSupabase(id, next);
  } catch (err) {
    console.error("[patchSavedEstimate] failed", err);
  }
}

export function markSavedEstimateSent(
  id: string,
  meta?: { sentAt?: string; sentToEmail?: string }
) {
  if (typeof window === "undefined") return;
  const nowIso = new Date().toISOString();
  const list = getSavedEstimates();
  const next = list.map((e: any) => {
    if (e.id !== id) return e;
    const updated: any = { ...e, status: "sent" as const, lastSavedAt: nowIso, needsScheduling: false, viewedAt: null };
    updated.sentAt = meta?.sentAt ?? nowIso;
    if (meta?.sentToEmail != null) updated.sentToEmail = meta.sentToEmail;
    return updated;
  });
  persistThenSupabase(id, next);
}

export function setSavedEstimateApprovalToken(id: string, token: string) {
  if (typeof window === "undefined") return;
  const nowIso = new Date().toISOString();
  const list = getSavedEstimates();
  const next = list.map((e: any) =>
    e.id === id ? { ...e, approvalToken: token, lastSavedAt: nowIso } : e
  );
  persistThenSupabase(id, next);
}

/** After send: attach approval token and set status to sent_pending (Pending Approval). */
export function attachApprovalTokenAndMarkPending(id: string, token: string) {
  if (typeof window === "undefined") return [];
  const list = getSavedEstimates();
  const nowIso = new Date().toISOString();
  const next = list.map((e: any) =>
    e.id === id
      ? {
          ...e,
          approvalToken: token,
          status: "sent_pending" as const,
          sentAt: e.sentAt ?? nowIso,
          needsScheduling: false,
          lastSavedAt: nowIso,
          viewedAt: null,
        }
      : e
  );
  persistThenSupabase(id, next);
  return next;
}

/** Mark a saved estimate as viewed (by approval token). Set viewedAt only if currently null. */
export function markEstimateViewedByToken(
  token: string,
  viewedAtISO?: string | null
): boolean {
  if (typeof window === "undefined") return false;
  const list = getSavedEstimates();
  let changed = false;
  const value = viewedAtISO ?? new Date().toISOString();
  const next = list.map((e: any) => {
    if (String(e?.approvalToken || "") !== String(token || "")) return e;
    const current = e.viewedAt ?? null;
    if (current != null) return e;
    changed = true;
    return { ...e, viewedAt: value, lastSavedAt: new Date().toISOString() };
  });
  if (changed) {
    const updated = next.find((e: any) => String(e?.approvalToken || "") === String(token || ""));
    if (updated?.id) persistThenSupabase(updated.id, next);
    else try { localStorage.setItem(getScopedSavedKey(), JSON.stringify(next)); } catch {}
  }
  return changed;
}

/** When customer approves via /approve/[token]: find by token and mark approved locally. */
export function markSavedEstimateApprovedByToken(
  token: string,
  approvedAtISO?: string
): { next: RoofingEstimate[]; changed: boolean } {
  if (typeof window === "undefined") return { next: [], changed: false };
  const list = getSavedEstimates();
  let changed = false;
  const nowIso = approvedAtISO || new Date().toISOString();
  const next = list.map((e: any) => {
    if (
      e.approvalToken &&
      e.approvalToken === token &&
      (e.status === "sent_pending" || e.status === "sent")
    ) {
      changed = true;
      return {
        ...e,
        status: "approved" as const,
        approvedAt: nowIso,
        needsScheduling: true,
        lastSavedAt: new Date().toISOString(),
      };
    }
    return e;
  });
  if (changed) {
    const updated = next.find((e: any) => e.approvalToken === token);
    if (updated?.id) persistThenSupabase(updated.id, next);
    else try { localStorage.setItem(getScopedSavedKey(), JSON.stringify(next)); } catch {}
  }
  return { next, changed };
}

export function markSavedEstimateApproved(
  id: string,
  approvedAtIso?: string
) {
  if (typeof window === "undefined") return;
  const nowIso = approvedAtIso || new Date().toISOString();
  const list = getSavedEstimates();
  const next = list.map((e: any) =>
    e.id === id
      ? {
          ...e,
          status: "approved" as const,
          approvedAt: nowIso,
          needsScheduling: true,
          lastSavedAt: new Date().toISOString(),
        }
      : e
  );
  persistThenSupabase(id, next);
}

export function markSavedEstimateScheduled(
  id: string,
  startDate: string,
  notes?: string,
  arrivalWindow?: string
) {
  if (typeof window === "undefined") return;
  const nowIso = new Date().toISOString();
  const list = getSavedEstimates();
  const next = list.map((e: any) =>
    e.id === id
      ? {
          ...e,
          status: "scheduled" as const,
          scheduledAt: nowIso,
          scheduledStartDate: startDate,
          scheduledArrivalWindow: arrivalWindow ?? "",
          scheduleNotes: notes ?? "",
          needsScheduling: false,
          lastSavedAt: nowIso,
        }
      : e
  );
  persistThenSupabase(id, next);
}

export function markSavedEstimateStatus(
  id: string,
  status: NonNullable<RoofingEstimate["status"]>,
  meta?: {
    sentAt?: string;
    sentToEmail?: string;
    scheduledAt?: string;
    paidAt?: string;
  }
) {
  if (typeof window === "undefined") return;
  const nowIso = new Date().toISOString();
  const list = getSavedEstimates();
  const next = list.map((e: any) => {
    if (e.id !== id) return e;
    const updated: any = { ...e, status, lastSavedAt: nowIso };
    if (meta?.sentAt != null) updated.sentAt = meta.sentAt;
    if (meta?.sentToEmail != null) updated.sentToEmail = meta.sentToEmail;
    if (meta?.scheduledAt != null) updated.scheduledAt = meta.scheduledAt;
    if (meta?.paidAt != null) updated.paidAt = meta.paidAt;
    return updated;
  });
  persistThenSupabase(id, next);
}

export function markSavedEstimatePaid(
  id: string,
  paidDate: string,
  amount?: number,
  method?: string
) {
  if (typeof window === "undefined") return;
  const nowIso = new Date().toISOString();
  const list = getSavedEstimates();
  const next = list.map((e: any) => {
    if (e.id !== id) return e;
    const contractTotal = e.totalContractPrice ?? e.suggestedPrice ?? 0;
    const shouldMarkPaid = contractTotal > 0;
    return {
      ...e,
      status: shouldMarkPaid ? ("paid" as const) : e.status,
      paidAt: shouldMarkPaid ? nowIso : e.paidAt,
      paidDate: shouldMarkPaid ? paidDate : e.paidDate,
      paidAmount: amount ?? e.paidAmount,
      paidMethod: method ?? "",
      totalContractPrice: e.totalContractPrice ?? e.suggestedPrice,
      lastSavedAt: nowIso,
    };
  });
  persistThenSupabase(id, next);
}

export type PaymentEntry = {
  id: string;
  date: string;
  amount: number;
  method?: string;
  type?: "deposit" | "progress" | "final";
  note?: string;
};

export function addPaymentToEstimate(
  id: string,
  entry: { type: "deposit" | "progress" | "final"; amount: number; date: string; method?: string; note?: string }
): boolean {
  if (typeof window === "undefined") return false;
  const nowIso = new Date().toISOString();
  const list = getSavedEstimates();
  const est = list.find((e: any) => e.id === id);
  if (!est) return false;
  const contractTotal = est.totalContractPrice ?? est.suggestedPrice ?? 0;
  if (contractTotal <= 0) return false;

  const next = list.map((e: any) => {
    if (e.id !== id) return e;
    const history = Array.isArray(e.paymentHistory) ? [...e.paymentHistory] : [];
    const newEntry: PaymentEntry = {
      id: crypto.randomUUID(),
      date: entry.date,
      amount: entry.amount,
      method: entry.method || undefined,
      type: entry.type,
      note: entry.note || undefined,
    };
    history.push(newEntry);
    const amountPaid = history.reduce((sum: number, p: PaymentEntry) => sum + (p.amount || 0), 0);
    const totalContract = e.totalContractPrice ?? e.suggestedPrice ?? 0;
    const isFullyPaid = totalContract > 0 && amountPaid >= totalContract;
    const isDepositOrPartial = entry.type === "deposit" || (amountPaid > 0 && !isFullyPaid);
    const nextStatus = isFullyPaid
      ? ("paid" as const)
      : isDepositOrPartial
        ? ("deposit_paid" as const)
        : e.status;
    return {
      ...e,
      paymentHistory: history,
      amountPaid,
      totalContractPrice: e.totalContractPrice ?? e.suggestedPrice,
      status: nextStatus,
      paidAt: isFullyPaid ? nowIso : e.paidAt,
      paidDate: isFullyPaid ? entry.date : e.paidDate,
      paidAmount: isFullyPaid ? amountPaid : e.paidAmount,
      paidMethod: isFullyPaid ? (entry.method || "") : e.paidMethod,
      lastSavedAt: nowIso,
    };
  });
  persistThenSupabase(id, next);
  return true;
}

/**
 * Duplicate a saved estimate for revision. Resets workflow fields, sets revision lineage, returns the new id.
 */
export function duplicateSavedEstimate(id: string): string {
  if (typeof window === "undefined") return "";
  const list = getEstimates();
  const existing = list.find((e) => e.id === id);
  if (!existing) return "";
  const nowIso = new Date().toISOString();
  const copy = JSON.parse(JSON.stringify(existing)) as RoofingEstimate;
  copy.id = crypto.randomUUID();
  copy.status = "estimate";
  copy.sentAt = undefined;
  copy.approvedAt = undefined;
  copy.approvalToken = undefined;
  copy.scheduledAt = undefined;
  copy.scheduledStartDate = undefined;
  copy.scheduledArrivalWindow = undefined;
  copy.scheduleNotes = undefined;
  copy.paidAt = undefined;
  copy.paidDate = undefined;
  copy.paidAmount = undefined;
  copy.paidMethod = undefined;
  copy.totalContractPrice = undefined;
  copy.amountPaid = undefined;
  copy.paymentHistory = undefined;
  copy.lastSavedAt = nowIso;
  copy.createdAt = nowIso;
  const originalId = existing.revisionOfId ?? existing.id;
  copy.revisionOfId = originalId;
  const sameLineage = list.filter((e) => e.revisionOfId === originalId);
  const maxRev = sameLineage.reduce((m, e) => Math.max(m, e.revisionNumber ?? 0), 0);
  copy.revisionNumber = maxRev + 1;
  const next = [copy, ...list];
  persistThenSupabase(copy.id, next);
  return copy.id;
}
