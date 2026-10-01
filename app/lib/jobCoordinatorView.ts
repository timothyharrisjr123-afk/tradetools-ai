/**
 * Coordinator presentation for the Job Card. The name comes from the database read
 * (get_job_coordinator_v1 -> private.member_display_name_v1): linked Person name, then
 * profile name, then an authorized email, then a neutral label. Loading and failure are
 * their own states; neither reads as Unassigned.
 */
import { MEMBER_NAME_NOT_SET } from "@/app/lib/memberDisplayName";
import type { PersonChoiceOption } from "@/app/lib/personChoice";

export const COORDINATOR_UNASSIGNED = "Unassigned";
export const COORDINATOR_LOADING = "Loading…";
export const COORDINATOR_UNAVAILABLE = "Couldn't load coordinator";
export const COORDINATOR_PICKER_HELP = "Only people with FieldDive access can coordinate a job.";

export type JobCoordinatorSnapshot = {
  assignedTo: string | null;
  displayName: string | null;
  email: string | null;
};

export type JobCoordinatorReadState =
  | { status: "loading" }
  | { status: "error" }
  | ({ status: "ready" } & JobCoordinatorSnapshot);

export type CoordinatorDisplay = {
  state: "assigned" | "unassigned" | "loading" | "error";
  label: string;
  assignedTo: string | null;
};

/**
 * Who the picker offers: active software members with a valid role, mirroring
 * private.coordinator_eligible_v1. Never filtered by role or capability beyond that.
 */
export function coordinatorCandidates<T extends { removedAt: string | null; role: string }>(
  members: readonly T[]
): T[] {
  return members.filter((member) => !member.removedAt && member.role !== "invalid_role");
}

/** Picker key for the deliberate Unassigned option. */
export const COORDINATOR_NONE_KEY = "none";
export const COORDINATOR_FORMER_HINT = "No FieldDive access";

/**
 * Picker rows: Unassigned first, then eligible people by name. A current Coordinator
 * who is no longer eligible stays visible as the current row but can't be chosen.
 */
export function coordinatorChoices(input: {
  assignedTo: string | null;
  currentLabel: string;
  candidates: readonly { userId: string; label: string }[];
}): PersonChoiceOption[] {
  const people = [...input.candidates].sort((a, b) => a.label.localeCompare(b.label));
  const rows: PersonChoiceOption[] = [
    { key: COORDINATOR_NONE_KEY, label: COORDINATOR_UNASSIGNED, none: true, current: !input.assignedTo },
  ];
  if (input.assignedTo && !people.some((person) => person.userId === input.assignedTo)) {
    rows.push({
      key: input.assignedTo,
      label: input.currentLabel,
      current: true,
      disabled: true,
      hint: COORDINATOR_FORMER_HINT,
    });
  }
  for (const person of people) {
    rows.push({ key: person.userId, label: person.label, current: person.userId === input.assignedTo });
  }
  return rows;
}

export function coordinatorKeyToUserId(key: string): string | null {
  return key === COORDINATOR_NONE_KEY ? null : key;
}

/** The confirm button names the change; null when nothing would change. */
export function coordinatorConfirmLabel(input: {
  assignedTo: string | null;
  next: string | null;
  nextLabel: string;
}): string | null {
  if ((input.next ?? null) === (input.assignedTo ?? null)) return null;
  if (!input.next) return "Remove coordinator";
  return input.assignedTo ? `Switch to ${input.nextLabel}` : `Assign ${input.nextLabel}`;
}

export function coordinatorSavedMessage(next: { assignedTo: string | null; displayName: string | null }): string {
  if (!next.assignedTo) return "This job has no coordinator now.";
  const name = next.displayName?.trim();
  return name ? `${name} is coordinating this job.` : "Coordinator updated.";
}

export function coordinatorDisplay(read: JobCoordinatorReadState): CoordinatorDisplay {
  if (read.status === "loading") return { state: "loading", label: COORDINATOR_LOADING, assignedTo: null };
  if (read.status === "error") return { state: "error", label: COORDINATOR_UNAVAILABLE, assignedTo: null };
  if (!read.assignedTo) return { state: "unassigned", label: COORDINATOR_UNASSIGNED, assignedTo: null };
  return {
    state: "assigned",
    label: read.displayName?.trim() || read.email?.trim() || MEMBER_NAME_NOT_SET,
    assignedTo: read.assignedTo,
  };
}
