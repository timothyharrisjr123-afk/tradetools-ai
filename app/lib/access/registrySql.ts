/**
 * Deterministic SQL for the access registry.
 *
 * - buildAccessRegistrySeedSql(): the original Phase 13B-C seed embedded in
 *   migration 20260927190000 between the GENERATED REGISTRY SEED markers.
 * - buildAccessRegistrySyncSql(): the idempotent re-sync embedded by every later
 *   registry-changing migration between the GENERATED REGISTRY SYNC markers. It
 *   makes the registry tables exactly equal to registry.ts and fails if the
 *   database holds a capability, profile, or package that registry.ts does not.
 */

import {
  ACCESS_CAPABILITIES,
  ACCESS_PACKAGES,
  ACCESS_ROLE_PROFILES,
} from "@/app/lib/access/registry";

export const REGISTRY_SEED_BEGIN = "-- BEGIN GENERATED REGISTRY SEED (app/lib/access/registrySql.ts)";
export const REGISTRY_SEED_END = "-- END GENERATED REGISTRY SEED";
export const REGISTRY_SYNC_BEGIN = "-- BEGIN GENERATED REGISTRY SYNC (app/lib/access/registrySql.ts)";
export const REGISTRY_SYNC_END = "-- END GENERATED REGISTRY SYNC";

const lit = (value: string) => `'${value.replace(/'/g, "''")}'`;
const arr = (values: readonly string[]) =>
  values.length === 0 ? "'{}'::text[]" : `array[${values.map(lit).join(", ")}]::text[]`;

const capabilityRows = () =>
  ACCESS_CAPABILITIES.map(
    (c) => `  (${lit(c.key)}, ${lit(c.domain)}, ${lit(c.status)}, ${c.sensitive}, ${arr(c.scopeKinds)})`
  ).join(",\n");

const dependencyRows = () =>
  ACCESS_CAPABILITIES.flatMap((c) => c.dependsOn.map((d) => `  (${lit(c.key)}, ${lit(d)})`)).join(",\n");

const profileRows = () => ACCESS_ROLE_PROFILES.map((p) => `  (${lit(p.role)}, ${p.version})`).join(",\n");

const profileCapabilityRows = () =>
  ACCESS_ROLE_PROFILES.flatMap((p) =>
    p.entries.map((e) => `  (${lit(p.role)}, ${p.version}, ${lit(e.capability)}, ${lit(e.scope)})`)
  ).join(",\n");

const packageRows = () =>
  ACCESS_PACKAGES.map(
    (p) =>
      `  (${lit(p.key)}, ${lit(p.status)}, ${p.sensitive}, ${p.strongAuthRequired}, ${lit(p.scope)}, ${arr(p.eligibleRoles)}, ${arr(p.assignableBy)})`
  ).join(",\n");

const packageCapabilityRows = () =>
  ACCESS_PACKAGES.flatMap((p) => p.capabilities.map((c) => `  (${lit(p.key)}, ${lit(c)})`)).join(",\n");

export function buildAccessRegistrySeedSql(): string {
  return [
    REGISTRY_SEED_BEGIN,
    "insert into public.access_capabilities (capability_key, domain, status, sensitive, scope_kinds) values",
    capabilityRows() + ";",
    "insert into public.access_capability_dependencies (capability_key, requires_capability_key) values",
    dependencyRows() + ";",
    "insert into public.access_role_profiles (role_key, version) values",
    profileRows() + ";",
    "insert into public.access_role_profile_capabilities (role_key, version, capability_key, scope_kind) values",
    profileCapabilityRows() + ";",
    "insert into public.access_packages (package_key, status, sensitive, strong_auth_required, scope_kind, eligible_roles, assignable_by) values",
    packageRows() + ";",
    "insert into public.access_package_capabilities (package_key, capability_key) values",
    packageCapabilityRows() + ";",
    REGISTRY_SEED_END,
  ].join("\n");
}

export function buildAccessRegistrySyncSql(): string {
  const capabilityKeys = arr(ACCESS_CAPABILITIES.map((c) => c.key));
  const packageKeys = arr(ACCESS_PACKAGES.map((p) => p.key));
  const profileKeys = arr(ACCESS_ROLE_PROFILES.map((p) => `${p.role}:${p.version}`));
  return [
    REGISTRY_SYNC_BEGIN,
    "do $registry_sync$",
    "begin",
    "  if exists (select 1 from public.access_capabilities where not (capability_key = any (" + capabilityKeys + "))) then",
    "    raise exception 'access registry sync: database holds a capability outside registry.ts';",
    "  end if;",
    "  if exists (select 1 from public.access_packages where not (package_key = any (" + packageKeys + "))) then",
    "    raise exception 'access registry sync: database holds a package outside registry.ts';",
    "  end if;",
    "  if exists (select 1 from public.access_role_profiles where not ((role_key || ':' || version) = any (" + profileKeys + "))) then",
    "    raise exception 'access registry sync: database holds a role profile outside registry.ts';",
    "  end if;",
    "end;",
    "$registry_sync$;",
    "insert into public.access_capabilities (capability_key, domain, status, sensitive, scope_kinds) values",
    capabilityRows(),
    "on conflict (capability_key) do update set",
    "  domain = excluded.domain, status = excluded.status,",
    "  sensitive = excluded.sensitive, scope_kinds = excluded.scope_kinds;",
    "delete from public.access_capability_dependencies;",
    "insert into public.access_capability_dependencies (capability_key, requires_capability_key) values",
    dependencyRows() + ";",
    "insert into public.access_role_profiles (role_key, version) values",
    profileRows(),
    "on conflict (role_key, version) do nothing;",
    "delete from public.access_role_profile_capabilities;",
    "insert into public.access_role_profile_capabilities (role_key, version, capability_key, scope_kind) values",
    profileCapabilityRows() + ";",
    "insert into public.access_packages (package_key, status, sensitive, strong_auth_required, scope_kind, eligible_roles, assignable_by) values",
    packageRows(),
    "on conflict (package_key) do update set",
    "  status = excluded.status, sensitive = excluded.sensitive,",
    "  strong_auth_required = excluded.strong_auth_required, scope_kind = excluded.scope_kind,",
    "  eligible_roles = excluded.eligible_roles, assignable_by = excluded.assignable_by;",
    "delete from public.access_package_capabilities;",
    "insert into public.access_package_capabilities (package_key, capability_key) values",
    packageCapabilityRows() + ";",
    "do $registry_sync_check$",
    "declare",
    "  v_violations text[] := private.access_registry_violations_v1();",
    "begin",
    "  if cardinality(v_violations) > 0 then",
    "    raise exception 'access registry invalid: %', array_to_string(v_violations, '; ');",
    "  end if;",
    "end;",
    "$registry_sync_check$;",
    REGISTRY_SYNC_END,
  ].join("\n");
}

function extractBlock(migrationSql: string, begin: string, end: string): string | null {
  const text = migrationSql.replace(/\r\n/g, "\n");
  const start = text.indexOf(begin);
  const stop = text.indexOf(end);
  if (start < 0 || stop < 0 || stop < start) return null;
  return text.slice(start, stop + end.length);
}

/** Extracts the embedded seed block from migration text (line endings normalised). */
export function extractRegistrySeed(migrationSql: string): string | null {
  return extractBlock(migrationSql, REGISTRY_SEED_BEGIN, REGISTRY_SEED_END);
}

/** Extracts the embedded sync block from migration text (line endings normalised). */
export function extractRegistrySync(migrationSql: string): string | null {
  return extractBlock(migrationSql, REGISTRY_SYNC_BEGIN, REGISTRY_SYNC_END);
}
