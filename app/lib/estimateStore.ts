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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextWithDrivers));
    return overwriteId;
  }

  const id = data.id || crypto.randomUUID();
  const withTimestamps: RoofingEstimate = {
    ...data,
    id,
    createdAt: data.createdAt || nowIso,
    lastSavedAt: nowIso,
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
    STORAGE_KEY,
    JSON.stringify([snapshotWithDrivers, ...existing])
  );
  return id;
}

export function getEstimates(): RoofingEstimate[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
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
    const updated: any = { ...e, status: "sent" as const, lastSavedAt: nowIso, needsScheduling: false };
    updated.sentAt = meta?.sentAt ?? nowIso;
    if (meta?.sentToEmail != null) updated.sentToEmail = meta.sentToEmail;
    return updated;
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function setSavedEstimateApprovalToken(id: string, token: string) {
  if (typeof window === "undefined") return;
  const nowIso = new Date().toISOString();
  const list = getSavedEstimates();
  const next = list.map((e: any) =>
    e.id === id ? { ...e, approvalToken: token, lastSavedAt: nowIso } : e
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
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
        }
      : e
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
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
  if (changed) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return copy.id;
}
