/**
 * Phase 13B-C canonical company access registry (version 1).
 *
 * Source of truth for capability names, status, dependencies, built-in role
 * profiles, and special-access packages. The database tables
 * (access_capabilities, access_role_profiles, access_packages, ...) are seeded
 * from this file by migration 20260927190000; registrySql.test.ts fails if the
 * seed and this file diverge. The only evaluator is SQL
 * (private.evaluate_access_v1); TypeScript never computes effective access.
 */

import type { CompanyMembershipRoleValue } from "@/app/lib/companyMembershipRoles";

export const ACCESS_REGISTRY_VERSION = 1;

/** Typed scope kinds. `branch` / `sales_team` are recognised but reserved (always deny). */
export const ACCESS_SCOPE_KINDS = ["company", "granted_jobs", "job", "own_task"] as const;
export type AccessScopeKind = (typeof ACCESS_SCOPE_KINDS)[number];
export const RESERVED_ACCESS_SCOPE_KINDS = ["branch", "sales_team"] as const;

export type AccessStatus = "active" | "reserved";

export type CapabilityDefinition = {
  key: string;
  domain: string;
  status: AccessStatus;
  sensitive: boolean;
  scopeKinds: readonly AccessScopeKind[];
  dependsOn: readonly string[];
};

const C = ["company"] as const;
const JOB_SCOPED = ["company", "granted_jobs", "job"] as const;

export const ACCESS_CAPABILITIES = [
  { key: "customers.read", domain: "customers", status: "active", sensitive: false, scopeKinds: C, dependsOn: [] },
  { key: "customers.manage", domain: "customers", status: "active", sensitive: false, scopeKinds: C, dependsOn: ["customers.read"] },
  { key: "jobs.read", domain: "jobs", status: "active", sensitive: false, scopeKinds: JOB_SCOPED, dependsOn: [] },
  { key: "jobs.manage", domain: "jobs", status: "active", sensitive: false, scopeKinds: C, dependsOn: ["jobs.read"] },
  { key: "jobs.assign", domain: "jobs", status: "active", sensitive: false, scopeKinds: C, dependsOn: ["jobs.read"] },
  { key: "jobs.approve", domain: "jobs", status: "active", sensitive: false, scopeKinds: C, dependsOn: ["jobs.read"] },
  { key: "jobs.progress", domain: "jobs", status: "active", sensitive: false, scopeKinds: JOB_SCOPED, dependsOn: ["jobs.read"] },
  { key: "jobs.hold", domain: "jobs", status: "active", sensitive: false, scopeKinds: C, dependsOn: ["jobs.read"] },
  { key: "jobs.finalize", domain: "jobs", status: "active", sensitive: false, scopeKinds: C, dependsOn: ["jobs.read"] },
  { key: "measurements.capture", domain: "measurements", status: "active", sensitive: false, scopeKinds: JOB_SCOPED, dependsOn: ["jobs.read"] },
  { key: "measurements.select", domain: "measurements", status: "active", sensitive: false, scopeKinds: C, dependsOn: ["jobs.read"] },
  { key: "photos.contribute", domain: "photos", status: "active", sensitive: false, scopeKinds: JOB_SCOPED, dependsOn: ["jobs.read"] },
  { key: "field_notes.contribute", domain: "field_notes", status: "reserved", sensitive: false, scopeKinds: JOB_SCOPED, dependsOn: ["jobs.read"] },
  { key: "tasks.read", domain: "tasks", status: "active", sensitive: false, scopeKinds: JOB_SCOPED, dependsOn: ["jobs.read"] },
  { key: "tasks.complete", domain: "tasks", status: "active", sensitive: false, scopeKinds: ["company", "granted_jobs", "job", "own_task"], dependsOn: ["tasks.read"] },
  { key: "tasks.manage", domain: "tasks", status: "active", sensitive: false, scopeKinds: JOB_SCOPED, dependsOn: ["tasks.read"] },
  { key: "schedule.read", domain: "schedule", status: "active", sensitive: false, scopeKinds: JOB_SCOPED, dependsOn: ["jobs.read"] },
  { key: "schedule.manage", domain: "schedule", status: "active", sensitive: false, scopeKinds: JOB_SCOPED, dependsOn: ["schedule.read"] },
  { key: "proposals.read", domain: "proposals", status: "active", sensitive: false, scopeKinds: C, dependsOn: ["jobs.read"] },
  { key: "proposals.write", domain: "proposals", status: "active", sensitive: false, scopeKinds: C, dependsOn: ["proposals.read"] },
  { key: "proposals.send", domain: "proposals", status: "active", sensitive: false, scopeKinds: C, dependsOn: ["proposals.read"] },
  { key: "scope_changes.write", domain: "scope_changes", status: "active", sensitive: false, scopeKinds: C, dependsOn: ["proposals.read"] },
  { key: "scope_changes.issue", domain: "scope_changes", status: "active", sensitive: true, scopeKinds: C, dependsOn: ["scope_changes.write"] },
  { key: "pricing.manage", domain: "commercial_config", status: "active", sensitive: true, scopeKinds: C, dependsOn: [] },
  /**
   * Reserved: proposal authoring reads catalog costs and writes internal cost
   * summaries under the author's session, so cost visibility cannot be separated
   * from proposals.write without moving pricing computation behind a projection.
   */
  { key: "pricing.cost.read", domain: "commercial_config", status: "reserved", sensitive: true, scopeKinds: C, dependsOn: [] },
  { key: "templates.manage", domain: "commercial_config", status: "active", sensitive: false, scopeKinds: C, dependsOn: [] },
  { key: "payments.summary.read", domain: "payments", status: "active", sensitive: true, scopeKinds: C, dependsOn: ["jobs.read"] },
  { key: "payments.history.read", domain: "payments", status: "active", sensitive: true, scopeKinds: C, dependsOn: ["payments.summary.read"] },
  { key: "payments.request", domain: "payments", status: "active", sensitive: true, scopeKinds: C, dependsOn: ["payments.summary.read"] },
  /** Reserved: the offline recording route is retired (410). */
  { key: "payments.record", domain: "payments", status: "reserved", sensitive: true, scopeKinds: C, dependsOn: ["payments.summary.read"] },
  { key: "payments.refund", domain: "payments", status: "active", sensitive: true, scopeKinds: C, dependsOn: ["payments.history.read"] },
  { key: "payments.configure", domain: "payments", status: "active", sensitive: true, scopeKinds: C, dependsOn: [] },
  /** Reserved: no aggregate revenue/balance surface exists (board metrics carry no money). */
  { key: "company_financials.read", domain: "company_finance", status: "reserved", sensitive: true, scopeKinds: C, dependsOn: [] },
  { key: "company.manage", domain: "administration", status: "active", sensitive: false, scopeKinds: C, dependsOn: [] },
  { key: "team.manage", domain: "administration", status: "active", sensitive: true, scopeKinds: C, dependsOn: [] },
  { key: "access.delegate_sensitive", domain: "administration", status: "reserved", sensitive: true, scopeKinds: C, dependsOn: [] },
  { key: "billing.manage", domain: "administration", status: "reserved", sensitive: true, scopeKinds: C, dependsOn: [] },
  { key: "data.export", domain: "administration", status: "reserved", sensitive: true, scopeKinds: C, dependsOn: [] },
  { key: "discounts.approve", domain: "proposals", status: "reserved", sensitive: true, scopeKinds: C, dependsOn: ["proposals.read"] },
] as const satisfies readonly CapabilityDefinition[];

export type AccessCapabilityKey = (typeof ACCESS_CAPABILITIES)[number]["key"];

export type ActiveCapabilityKey = Extract<
  (typeof ACCESS_CAPABILITIES)[number],
  { status: "active" }
>["key"];

export const ACTIVE_CAPABILITY_KEYS: readonly ActiveCapabilityKey[] = ACCESS_CAPABILITIES.filter(
  (c) => c.status === "active"
).map((c) => c.key as ActiveCapabilityKey);

export type RoleProfileEntry = { capability: ActiveCapabilityKey; scope: AccessScopeKind };

export type RoleProfileDefinition = {
  role: CompanyMembershipRoleValue;
  version: number;
  entries: readonly RoleProfileEntry[];
};

const company = (...caps: ActiveCapabilityKey[]): RoleProfileEntry[] =>
  caps.map((capability) => ({ capability, scope: "company" }));

/** Owner holds every active capability explicitly; unknown or reserved keys still deny. */
const OWNER_V1: RoleProfileEntry[] = company(...ACTIVE_CAPABILITY_KEYS);

export const ACCESS_ROLE_PROFILES: readonly RoleProfileDefinition[] = [
  { role: "owner", version: 1, entries: OWNER_V1 },
  {
    role: "admin",
    version: 1,
    entries: company(
      "customers.read", "customers.manage",
      "jobs.read", "jobs.manage", "jobs.assign", "jobs.approve", "jobs.progress", "jobs.hold", "jobs.finalize",
      "measurements.capture", "measurements.select", "photos.contribute",
      "tasks.read", "tasks.complete", "tasks.manage",
      "schedule.read", "schedule.manage",
      "proposals.read", "proposals.write", "proposals.send",
      "scope_changes.write",
      "company.manage", "team.manage"
    ),
  },
  {
    role: "office_sales",
    version: 1,
    entries: company(
      "customers.read", "customers.manage",
      "jobs.read", "jobs.manage",
      "measurements.capture", "measurements.select", "photos.contribute",
      "tasks.read", "tasks.complete",
      "schedule.read",
      "proposals.read", "proposals.write", "proposals.send",
      "scope_changes.write"
    ),
  },
  {
    role: "production_lead",
    version: 1,
    entries: company(
      "customers.read",
      "jobs.read", "jobs.assign", "jobs.progress", "jobs.hold",
      "measurements.capture", "photos.contribute",
      "tasks.read", "tasks.complete", "tasks.manage",
      "schedule.read", "schedule.manage"
    ),
  },
  {
    role: "field_user",
    version: 1,
    entries: [
      { capability: "jobs.read", scope: "granted_jobs" },
      { capability: "tasks.read", scope: "granted_jobs" },
      { capability: "tasks.complete", scope: "own_task" },
      { capability: "schedule.read", scope: "granted_jobs" },
      { capability: "measurements.capture", scope: "granted_jobs" },
      { capability: "photos.contribute", scope: "granted_jobs" },
    ],
  },
];

/** Delegation tiers that may assign a package (custody Owner, Admin ceiling, Production Lead ceiling). */
export type DelegationTier = "owner" | "admin" | "production_lead";

export type PackageDefinition = {
  key: string;
  status: AccessStatus;
  sensitive: boolean;
  /** Phase F will require strong authentication for these assignments/uses. */
  strongAuthRequired: boolean;
  scope: "company" | "granted_jobs";
  eligibleRoles: readonly CompanyMembershipRoleValue[];
  assignableBy: readonly DelegationTier[];
  capabilities: readonly AccessCapabilityKey[];
};

export const ACCESS_PACKAGES = [
  { key: "request_payments", status: "active", sensitive: true, strongAuthRequired: false, scope: "company", eligibleRoles: ["admin", "office_sales"], assignableBy: ["owner"], capabilities: ["payments.request", "payments.summary.read"] },
  { key: "view_payment_history", status: "active", sensitive: true, strongAuthRequired: false, scope: "company", eligibleRoles: ["admin", "office_sales"], assignableBy: ["owner"], capabilities: ["payments.history.read", "payments.summary.read"] },
  { key: "view_company_financials", status: "reserved", sensitive: true, strongAuthRequired: false, scope: "company", eligibleRoles: ["admin", "office_sales"], assignableBy: ["owner"], capabilities: ["company_financials.read"] },
  { key: "view_internal_costs", status: "reserved", sensitive: true, strongAuthRequired: false, scope: "company", eligibleRoles: ["admin", "office_sales"], assignableBy: ["owner"], capabilities: ["pricing.cost.read"] },
  { key: "manage_pricing_templates", status: "active", sensitive: true, strongAuthRequired: false, scope: "company", eligibleRoles: ["admin", "office_sales"], assignableBy: ["owner"], capabilities: ["pricing.manage", "templates.manage"] },
  { key: "issue_scope_changes", status: "active", sensitive: true, strongAuthRequired: false, scope: "company", eligibleRoles: ["admin", "office_sales"], assignableBy: ["owner"], capabilities: ["scope_changes.issue", "scope_changes.write"] },
  /** Reserved until Phase F strong authentication is live. */
  { key: "refunds", status: "reserved", sensitive: true, strongAuthRequired: true, scope: "company", eligibleRoles: ["admin"], assignableBy: ["owner"], capabilities: ["payments.refund", "payments.history.read", "payments.summary.read"] },
  { key: "approve_jobs", status: "active", sensitive: false, strongAuthRequired: false, scope: "company", eligibleRoles: ["office_sales", "production_lead"], assignableBy: ["owner", "admin"], capabilities: ["jobs.approve"] },
  { key: "coordinate_production", status: "active", sensitive: false, strongAuthRequired: false, scope: "company", eligibleRoles: ["office_sales"], assignableBy: ["owner", "admin"], capabilities: ["schedule.manage", "schedule.read", "tasks.manage", "tasks.read", "jobs.progress", "jobs.hold", "jobs.assign"] },
  { key: "lead_assigned_work", status: "active", sensitive: false, strongAuthRequired: false, scope: "granted_jobs", eligibleRoles: ["field_user"], assignableBy: ["owner", "admin", "production_lead"], capabilities: ["tasks.manage", "tasks.read", "jobs.progress", "schedule.manage", "schedule.read"] },
  { key: "manage_customers_jobs", status: "active", sensitive: false, strongAuthRequired: false, scope: "company", eligibleRoles: ["production_lead"], assignableBy: ["owner", "admin"], capabilities: ["customers.manage", "customers.read", "jobs.manage", "measurements.select"] },
] as const satisfies readonly PackageDefinition[];

export type AccessPackageKey = (typeof ACCESS_PACKAGES)[number]["key"];

/**
 * Legacy (Phase 7–13B-B) capability vocabulary → canonical capabilities.
 * The legacy names are retired from code and SQL in Phase 13B-C.
 */
export const LEGACY_CAPABILITY_CROSSWALK = {
  customers_jobs: ["customers.read", "jobs.read"],
  proposal_author: ["proposals.write", "proposals.send", "scope_changes.write", "scope_changes.issue"],
  payment_admin: ["payments.configure", "payments.refund"],
  payment_request: ["payments.request", "payments.summary.read"],
  schedule_mutate: ["schedule.manage"],
  job_assign: ["jobs.assign"],
  task_assign: ["tasks.manage"],
  task_complete: ["tasks.complete"],
  lifecycle_start_complete: ["jobs.progress"],
  job_pause_resume: ["jobs.hold"],
  job_disposition_finalize: ["jobs.finalize"],
  member_admin: ["team.manage"],
  company_admin: ["company.manage"],
  photo_mutate: ["photos.contribute"],
  job_approve: ["jobs.approve"],
} as const satisfies Record<string, readonly ActiveCapabilityKey[]>;

const CAPABILITY_BY_KEY = new Map<string, CapabilityDefinition>(
  ACCESS_CAPABILITIES.map((c) => [c.key, c])
);

export function getCapabilityDefinition(key: unknown): CapabilityDefinition | null {
  return typeof key === "string" ? CAPABILITY_BY_KEY.get(key) ?? null : null;
}

export function isActiveCapabilityKey(key: unknown): key is ActiveCapabilityKey {
  return getCapabilityDefinition(key)?.status === "active";
}

export function getRoleProfile(
  role: CompanyMembershipRoleValue,
  version = ACCESS_REGISTRY_VERSION
): RoleProfileDefinition | null {
  return ACCESS_ROLE_PROFILES.find((p) => p.role === role && p.version === version) ?? null;
}

/**
 * Registry invariants (mirrored by private.assert_access_registry_valid_v1):
 * acyclic dependencies on known keys, active never depends on reserved, profile
 * and package scopes are allowed by each capability, Owner holds every active
 * capability at company scope, active packages contain only active capabilities
 * and are dependency-complete for every eligible role.
 */
export function validateAccessRegistry(): string[] {
  const errors: string[] = [];
  for (const cap of ACCESS_CAPABILITIES) {
    for (const dep of cap.dependsOn) {
      const target = CAPABILITY_BY_KEY.get(dep);
      if (!target) errors.push(`${cap.key}: unknown dependency ${dep}`);
      else if (cap.status === "active" && target.status !== "active") {
        errors.push(`${cap.key}: active capability depends on reserved ${dep}`);
      }
    }
  }
  const visiting = new Set<string>();
  const done = new Set<string>();
  const visit = (key: string, path: string[]): void => {
    if (done.has(key)) return;
    if (visiting.has(key)) {
      errors.push(`dependency cycle: ${[...path, key].join(" -> ")}`);
      return;
    }
    visiting.add(key);
    for (const dep of CAPABILITY_BY_KEY.get(key)?.dependsOn ?? []) visit(dep, [...path, key]);
    visiting.delete(key);
    done.add(key);
  };
  for (const cap of ACCESS_CAPABILITIES) visit(cap.key, []);

  for (const profile of ACCESS_ROLE_PROFILES) {
    const seen = new Set<string>();
    for (const entry of profile.entries) {
      const cap = CAPABILITY_BY_KEY.get(entry.capability);
      if (!cap || cap.status !== "active") errors.push(`${profile.role}: inactive ${entry.capability}`);
      else if (!(cap.scopeKinds as readonly string[]).includes(entry.scope)) {
        errors.push(`${profile.role}: ${entry.capability} not allowed at ${entry.scope}`);
      }
      if (seen.has(entry.capability)) errors.push(`${profile.role}: duplicate ${entry.capability}`);
      seen.add(entry.capability);
    }
  }
  const owner = getRoleProfile("owner");
  const ownerCompany = new Set(
    (owner?.entries ?? []).filter((e) => e.scope === "company").map((e) => e.capability)
  );
  for (const key of ACTIVE_CAPABILITY_KEYS) {
    if (!ownerCompany.has(key)) errors.push(`owner: missing ${key}`);
  }

  for (const pkg of ACCESS_PACKAGES) {
    for (const key of pkg.capabilities) {
      const cap = CAPABILITY_BY_KEY.get(key);
      if (!cap) errors.push(`${pkg.key}: unknown ${key}`);
      else {
        if (pkg.status === "active" && cap.status !== "active") errors.push(`${pkg.key}: active package holds reserved ${key}`);
        if (!(cap.scopeKinds as readonly string[]).includes(pkg.scope)) errors.push(`${pkg.key}: ${key} not allowed at ${pkg.scope}`);
      }
    }
    if ((pkg.eligibleRoles as readonly string[]).includes("owner")) errors.push(`${pkg.key}: owner is not an eligible target`);
    if (pkg.status !== "active") continue;
    for (const role of pkg.eligibleRoles) {
      const available = new Set<string>([
        ...pkg.capabilities,
        ...(getRoleProfile(role)?.entries ?? [])
          .filter((e) => e.scope === "company" || e.scope === pkg.scope)
          .map((e) => e.capability),
      ]);
      for (const key of pkg.capabilities) {
        for (const dep of CAPABILITY_BY_KEY.get(key)?.dependsOn ?? []) {
          if (!available.has(dep)) errors.push(`${pkg.key}: ${role} lacks prerequisite ${dep} for ${key}`);
        }
      }
    }
  }
  return errors;
}
