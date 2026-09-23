/**
 * Astra G7 — derived field brief (read-only projection of owned facts).
 * Not a second document store. Not mutable field scope.
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
  measurementSummary?: string | null;
  accessNotes?: string | null;
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
      approvedScopeLabel: trimOrNull(input.approvedScopeLabel),
      approvedChangesLabel: trimOrNull(input.approvedChangesLabel),
      measurementSummary: trimOrNull(input.measurementSummary),
      accessNotes: trimOrNull(input.accessNotes),
      warningProposedVsAuthorized: input.proposedDiffersFromAuthorized
        ? "Proposed work differs from currently authorized work."
        : null,
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
