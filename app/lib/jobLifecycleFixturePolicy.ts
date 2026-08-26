/**
 * Lifecycle fixture classification for tests and QA policy.
 *
 * This module does NOT drive product UI. Fixture names must never gate
 * stage behavior, CTAs, disposition, Board, Calendar, or payments.
 */

export type LifecycleFixtureClass =
  | "canonical"
  | "negative"
  | "historical"
  | "synthetic_partial"
  | "display_disposition";

export type LifecycleFixtureRecord = {
  id: string;
  name: string;
  class: LifecycleFixtureClass;
  notes: string;
};

/**
 * Known controlled fixtures used across 038–047 / R3G / R3H / R3I proofs.
 * Classification is documentation for QA — not product branching.
 */
export const KNOWN_LIFECYCLE_FIXTURES: readonly LifecycleFixtureRecord[] = [
  {
    id: "af6a9dc2-01a5-4e8c-8a8e-c10584713d27",
    name: "[R3G-046-VISUAL] Clean Scheduled",
    class: "canonical",
    notes:
      "Full proposal RPC path then schedule. Prefer for normal Scheduled screenshots.",
  },
  {
    id: "2b5319f1-54b0-4d23-a85c-096940c78378",
    name: "[R3G-046-VISUAL] Clean Production",
    class: "canonical",
    notes:
      "Full proposal path + start work. May be Complete after R3H visual proof.",
  },
  {
    id: "3338cd5c-6427-4546-9014-9ada70f595a1",
    name: "[R3G-046] Mobile Scheduled",
    class: "synthetic_partial",
    notes:
      "Approved shortcut + schedule RPC; no full proposal chain. OK for 390/R3I disposition; not for proposal-truth visuals.",
  },
  {
    id: "366afed3-2eee-4558-8630-63e4f0dda99e",
    name: "[R3G-046] Missing Schedule",
    class: "negative",
    notes:
      "Scheduled stage without job_schedules row. Never use for normal Scheduled screenshots.",
  },
  {
    id: "82bf8782-54f1-4fda-b23c-982f450e4d4b",
    name: "[R3G-046] Blocked Hold",
    class: "display_disposition",
    notes: "Hybrid seed + schedule + on_hold. Display/disposition only; do not remutate casually.",
  },
  {
    id: "18beb966-4ae5-4217-910a-4e0d76dbf354",
    name: "[R3G-046] Blocked Lost",
    class: "display_disposition",
    notes: "Hybrid seed + schedule + lost. Display only.",
  },
  {
    id: "b23b655e-1134-442e-a70d-4331dd3b99e0",
    name: "[R3G-046] Blocked Closed",
    class: "display_disposition",
    notes: "Hybrid seed + schedule + closed. Display only.",
  },
  {
    id: "a29d99f4-89ae-4d2c-97d1-6d2cb3db1cf1",
    name: "[R3G-046] Security",
    class: "historical",
    notes:
      "Hybrid Approved seed + schedule + start; later Completes during R3H. Prefer for historical Complete Job Card, not live Production visuals.",
  },
  {
    id: "ea03234d-2dde-4fa4-aa15-ca1aa1a344e5",
    name: "[R3G-046] Payment Not Requested Unsigned",
    class: "historical",
    notes: "Payment/signature independence fixture; later Completes during R3H.",
  },
  {
    id: "cc2c7730-ac34-4535-b469-b17a581385c1",
    name: "[R3G-046] Production Hold",
    class: "display_disposition",
    notes: "Production + on_hold display fixture. Prefer for live Production stage display when Clean Production has Completed.",
  },
] as const;

export function classifyKnownLifecycleFixture(input: {
  id?: string | null;
  name?: string | null;
}): LifecycleFixtureClass | null {
  const id = String(input.id ?? "").trim().toLowerCase();
  const name = String(input.name ?? "").trim().toLowerCase();
  for (const fixture of KNOWN_LIFECYCLE_FIXTURES) {
    if (id && fixture.id.toLowerCase() === id) return fixture.class;
    if (name && fixture.name.toLowerCase() === name) return fixture.class;
  }
  if (name.includes("missing schedule")) return "negative";
  if (name.includes("-visual]")) return "canonical";
  if (name.includes("blocked hold") || name.includes("blocked lost") || name.includes("blocked closed")) {
    return "display_disposition";
  }
  return null;
}

export function isNegativeLifecycleFixture(input: {
  id?: string | null;
  name?: string | null;
}): boolean {
  return classifyKnownLifecycleFixture(input) === "negative";
}

export function isPreferredCanonicalVisualFixture(input: {
  id?: string | null;
  name?: string | null;
}): boolean {
  return classifyKnownLifecycleFixture(input) === "canonical";
}

