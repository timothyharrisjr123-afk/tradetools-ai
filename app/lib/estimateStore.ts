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
  status?: "estimate" | "sent" | "sent_pending" | "approved" | "scheduled" | "paid";
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
}

const STORAGE_KEY = "roofing_saved_estimates";

export const CANON_SAVED_KEY = "ttai_savedEstimates";

function safeParseList(raw: string | null) {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Reads from multiple historical keys, merges into CANON_SAVED_KEY, returns list. */
export function getSavedEstimatesSafe(): any[] {
  if (typeof window === "undefined") return [];

  const candidateKeys = [
    CANON_SAVED_KEY,
    STORAGE_KEY,
    "savedEstimates",
    "ttai_saved_estimates",
    "ttai_saved_estimate_list",
    "tradetools_savedEstimates",
  ];

  const merged: any[] = [];
  const seen = new Set<string>();

  for (const key of candidateKeys) {
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
    localStorage.setItem(CANON_SAVED_KEY, JSON.stringify(merged));
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

  try {
    localStorage.setItem(CANON_SAVED_KEY, JSON.stringify(updated));
  } catch {}

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
  if (s === "scheduled") return "scheduled";
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
    st === "scheduled" ||
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
    localStorage.setItem(CANON_SAVED_KEY, JSON.stringify(nextWithDrivers));
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
  localStorage.setItem(
    CANON_SAVED_KEY,
    JSON.stringify([snapshotWithDrivers, ...existing])
  );
  return id;
}

export function getEstimates(): RoofingEstimate[] {
  if (typeof window === "undefined") return [];
  const list = getSavedEstimatesSafe();
  const { migrated, changed } = migrateSavedEstimatesIfNeeded(list);
  if (changed) {
    try {
      localStorage.setItem(CANON_SAVED_KEY, JSON.stringify(migrated));
      console.log("[MIGRATE SAVED ESTIMATES] repaired records");
    } catch {}
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
  localStorage.setItem(CANON_SAVED_KEY, JSON.stringify(filtered));
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
  localStorage.setItem(CANON_SAVED_KEY, JSON.stringify(next));
}

export function patchSavedEstimate(id: string, patch: Partial<RoofingEstimate>) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(CANON_SAVED_KEY);
    const arr: RoofingEstimate[] = raw ? JSON.parse(raw) : [];
    const nowIso = new Date().toISOString();
    const next = arr.map((e) => {
      if (e.id !== id) return e;
      return { ...e, ...patch, lastSavedAt: nowIso };
    });
    localStorage.setItem(CANON_SAVED_KEY, JSON.stringify(next));
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
  localStorage.setItem(CANON_SAVED_KEY, JSON.stringify(next));
}

export function setSavedEstimateApprovalToken(id: string, token: string) {
  if (typeof window === "undefined") return;
  const nowIso = new Date().toISOString();
  const list = getSavedEstimates();
  const next = list.map((e: any) =>
    e.id === id ? { ...e, approvalToken: token, lastSavedAt: nowIso } : e
  );
  localStorage.setItem(CANON_SAVED_KEY, JSON.stringify(next));
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
  localStorage.setItem(CANON_SAVED_KEY, JSON.stringify(next));
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
  if (changed) localStorage.setItem(CANON_SAVED_KEY, JSON.stringify(next));
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
  if (changed) localStorage.setItem(CANON_SAVED_KEY, JSON.stringify(next));
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
  localStorage.setItem(CANON_SAVED_KEY, JSON.stringify(next));
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
  localStorage.setItem(CANON_SAVED_KEY, JSON.stringify(next));
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
  localStorage.setItem(CANON_SAVED_KEY, JSON.stringify(next));
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
  localStorage.setItem(CANON_SAVED_KEY, JSON.stringify(next));
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
    return {
      ...e,
      paymentHistory: history,
      amountPaid,
      totalContractPrice: e.totalContractPrice ?? e.suggestedPrice,
      status: isFullyPaid ? ("paid" as const) : (e.status || "scheduled"),
      paidAt: isFullyPaid ? nowIso : e.paidAt,
      paidDate: isFullyPaid ? entry.date : e.paidDate,
      paidAmount: isFullyPaid ? amountPaid : e.paidAmount,
      paidMethod: isFullyPaid ? (entry.method || "") : e.paidMethod,
      lastSavedAt: nowIso,
    };
  });
  localStorage.setItem(CANON_SAVED_KEY, JSON.stringify(next));
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
  localStorage.setItem(CANON_SAVED_KEY, JSON.stringify(next));
  return copy.id;
}
