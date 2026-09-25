/**
 * Astra G7 — derived field brief (read-only projection of owned facts).
 * Not a second document store. Not mutable field scope.
 * Astra G9: authorized scope-change summaries + pending proposed warnings.
 */

export type FieldBriefContact = {
  customerName: string | null;
  phone: string | null;
  email: string | null;
  addressLine: string | null;
  canCall: boolean;
  canDirections: boolean;
  mapsUrl: string | null;
  telUrl: string | null;
};

export type FieldBriefSchedule = {
  startsOn: string | null;
  endsOn: string | null;
  timezone: string | null;
  windowLabel: string | null;
  productionLeadLabel: string;
  crewLabel: string | null;
};

export type FieldBriefAuthorizedWork = {
  /** Loading or a failed read must never render as "no authorized scope". */
  status: "loading" | "ready" | "error";
  approvedScopeLabel: string | null;
  approvedChangesLabel: string | null;
  measurementSummary: string | null;
  accessNotes: string | null;
  warningProposedVsAuthorized: string | null;
};

export type FieldBriefTask = {
  id: string;
  title: string;
  status: "open" | "complete";
  dueOn: string | null;
  assigneeLabel: string;
  assignedTo: string | null;
};

export type FieldBriefViewModel = {
  contact: FieldBriefContact;
  schedule: FieldBriefSchedule;
  authorizedWork: FieldBriefAuthorizedWork;
  tasks: FieldBriefTask[];
  photoCount: number;
};

export type FieldBriefTasksReadStatus = "loading" | "ready" | "error";

export const FIELD_BRIEF_TASK_PREVIEW_LIMIT = 3;

export type FieldBriefTaskPreview =
  | { kind: "loading" }
  | { kind: "error" }
  /** Confirmed read with no open tasks: Overview shows no task region. */
  | { kind: "none" }
  | { kind: "preview"; visible: FieldBriefTask[]; openCount: number; hiddenCount: number };

/**
 * Overview task prominence follows actual presence. Last-known open tasks stay
 * visible through a later failed refresh; an unresolved read is never "none".
 */
export function resolveFieldBriefTaskPreview(input: {
  tasks: readonly FieldBriefTask[];
  status: FieldBriefTasksReadStatus;
  limit?: number;
}): FieldBriefTaskPreview {
  const open = input.tasks.filter((task) => task.status === "open");
  if (open.length > 0) {
    const limit = Math.max(1, input.limit ?? FIELD_BRIEF_TASK_PREVIEW_LIMIT);
    const visible = open.slice(0, limit);
    return { kind: "preview", visible, openCount: open.length, hiddenCount: open.length - visible.length };
  }
  if (input.status === "loading") return { kind: "loading" };
  if (input.status === "error") return { kind: "error" };
  return { kind: "none" };
}

function trimOrNull(value: string | null | undefined): string | null {
  const t = String(value ?? "").trim();
  return t ? t : null;
}

function buildMapsUrl(addressLine: string | null): string | null {
  if (!addressLine) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLine)}`;
}

function buildTelUrl(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, "");
  if (!digits) return null;
  return `tel:${digits}`;
}

function formatAddress(parts: {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  formatted?: string | null;
}): string | null {
  const formatted = trimOrNull(parts.formatted);
  if (formatted) return formatted;
  const line1 = trimOrNull(parts.line1);
  const line2 = trimOrNull(parts.line2);
  const city = trimOrNull(parts.city);
  const state = trimOrNull(parts.state);
  const zip = trimOrNull(parts.zip);
  const cityLine = [city, state].filter(Boolean).join(", ");
  const withZip = [cityLine, zip].filter(Boolean).join(" ");
  const joined = [line1, line2, withZip].filter(Boolean).join(", ");
  return joined || null;
}

function cleanSummaries(values: readonly string[] | null | undefined): string[] {
  if (!values?.length) return [];
  return values
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);
}

/**
 * Pending proposed warning: prefer specific line wording
 * ("Additional decking — Pending approval") when a description is available.
 */
export function buildPendingProposedWarning(
  pendingProposedSummaries: readonly string[] | null | undefined
): string | null {
  const pending = cleanSummaries(pendingProposedSummaries);
  if (pending.length === 0) return null;
  if (pending.length === 1) {
    const one = pending[0];
    if (/pending approval/i.test(one)) return one;
    return `${one} — Pending approval`;
  }
  return `${pending.length} pending scope changes — Pending approval`;
}

export function buildApprovedChangesLabel(
  authorizedChangeSummaries: readonly string[] | null | undefined,
  explicitLabel?: string | null
): string | null {
  const explicit = trimOrNull(explicitLabel);
  if (explicit) return explicit;
  const authorized = cleanSummaries(authorizedChangeSummaries);
  if (authorized.length === 0) return null;
  return authorized.join("; ");
}

export const FIELD_BRIEF_SCOPE_ON_PROPOSAL_LABEL =
  "Accepted agreement — see the accepted proposal for scope details" as const;

const STATUS_ONLY_SCOPE_LABELS = new Set([
  "accepted",
  "signed",
  "accepted agreement",
  "sent",
  "draft",
]);

/**
 * Authorized base scope for the field brief: the accepted proposal's selected
 * package, never a lifecycle status word such as "Accepted" or "Signed".
 */
export function resolveFieldBriefApprovedScopeLabel(input: {
  acceptedProposalIds: Readonly<Record<string, boolean>>;
  packageLabelsByProposalId: Readonly<Record<string, string | null>>;
  activeProposalId?: string | null;
  hasAuthorizedChanges?: boolean;
}): string | null {
  const accepted = Object.entries(input.acceptedProposalIds)
    .filter(([, value]) => value === true)
    .map(([id]) => id);
  const active = trimOrNull(input.activeProposalId);
  const acceptedId =
    (active && accepted.includes(active) ? active : null) ?? accepted[0] ?? null;
  if (acceptedId) {
    const label = trimOrNull(input.packageLabelsByProposalId[acceptedId]);
    if (label && !STATUS_ONLY_SCOPE_LABELS.has(label.toLowerCase())) return label;
    return FIELD_BRIEF_SCOPE_ON_PROPOSAL_LABEL;
  }
  if (input.hasAuthorizedChanges) return FIELD_BRIEF_SCOPE_ON_PROPOSAL_LABEL;
  return null;
}

export function buildFieldBriefViewModel(input: {
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressZip?: string | null;
  addressFormatted?: string | null;
  scheduleStartsOn?: string | null;
  scheduleEndsOn?: string | null;
  scheduleTimezone?: string | null;
  scheduleWindowLabel?: string | null;
  productionLeadLabel?: string | null;
  crewLabel?: string | null;
  approvedScopeLabel?: string | null;
  approvedChangesLabel?: string | null;
  /** Astra G9 — authorized scope-change line/header summaries for field work. */
  authorizedChangeSummaries?: readonly string[] | null;
  /** Astra G9 — proposed (not authorized) summaries; never treated as authorized work. */
  pendingProposedSummaries?: readonly string[] | null;
  measurementSummary?: string | null;
  accessNotes?: string | null;
  /** Defaults to ready for callers that already resolved their facts. */
  authorizedWorkStatus?: "loading" | "ready" | "error";
  proposedDiffersFromAuthorized?: boolean;
  tasks?: readonly {
    id: string;
    title: string;
    status: "open" | "complete";
    dueOn: string | null;
    assignedTo?: string | null;
    assigneeLabel?: string | null;
  }[];
  photoCount?: number;
}): FieldBriefViewModel {
  const addressLine = formatAddress({
    line1: input.addressLine1,
    line2: input.addressLine2,
    city: input.addressCity,
    state: input.addressState,
    zip: input.addressZip,
    formatted: input.addressFormatted,
  });
  const phone = trimOrNull(input.customerPhone);
  const telUrl = buildTelUrl(phone);
  const mapsUrl = buildMapsUrl(addressLine);

  const approvedChangesLabel = buildApprovedChangesLabel(
    input.authorizedChangeSummaries,
    input.approvedChangesLabel
  );

  const pendingWarning = buildPendingProposedWarning(
    input.pendingProposedSummaries
  );
  const warningProposedVsAuthorized =
    pendingWarning ??
    (input.proposedDiffersFromAuthorized
      ? "Proposed work differs from currently authorized work."
      : null);

  return {
    contact: {
      customerName: trimOrNull(input.customerName),
      phone,
      email: trimOrNull(input.customerEmail),
      addressLine,
      canCall: Boolean(telUrl),
      canDirections: Boolean(mapsUrl),
      mapsUrl,
      telUrl,
    },
    schedule: {
      startsOn: trimOrNull(input.scheduleStartsOn),
      endsOn: trimOrNull(input.scheduleEndsOn),
      timezone: trimOrNull(input.scheduleTimezone),
      windowLabel: trimOrNull(input.scheduleWindowLabel),
      productionLeadLabel: trimOrNull(input.productionLeadLabel) || "Unassigned",
      crewLabel: trimOrNull(input.crewLabel),
    },
    authorizedWork: {
      status: input.authorizedWorkStatus ?? "ready",
      approvedScopeLabel: trimOrNull(input.approvedScopeLabel),
      approvedChangesLabel,
      measurementSummary: trimOrNull(input.measurementSummary),
      accessNotes: trimOrNull(input.accessNotes),
      warningProposedVsAuthorized,
    },
    tasks: (input.tasks ?? []).map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      dueOn: task.dueOn,
      assignedTo: task.assignedTo ?? null,
      assigneeLabel: trimOrNull(task.assigneeLabel) || "Unassigned",
    })),
    photoCount: Math.max(0, Number(input.photoCount ?? 0) || 0),
  };
}
