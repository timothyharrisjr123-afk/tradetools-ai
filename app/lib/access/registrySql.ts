/**
 * Deterministic SQL seed for the Phase 13B-C access registry. The migration
 * embeds this output verbatim between the GENERATED REGISTRY SEED markers.
 */

import {
  ACCESS_CAPABILITIES,
  ACCESS_PACKAGES,
  ACCESS_ROLE_PROFILES,
} from "@/app/lib/access/registry";

export const REGISTRY_SEED_BEGIN = "-- BEGIN GENERATED REGISTRY SEED (app/lib/access/registrySql.ts)";
export const REGISTRY_SEED_END = "-- END GENERATED REGISTRY SEED";

const lit = (value: string) => `'${value.replace(/'/g, "''")}'`;
const arr = (values: readonly string[]) =>
  values.length === 0 ? "'{}'::text[]" : `array[${values.map(lit).join(", ")}]::text[]`;

export function buildAccessRegistrySeedSql(): string {
  const lines: string[] = [REGISTRY_SEED_BEGIN];

  lines.push("insert into public.access_capabilities (capability_key, domain, status, sensitive, scope_kinds) values");
  lines.push(
    ACCESS_CAPABILITIES.map(
      (c) => `  (${lit(c.key)}, ${lit(c.domain)}, ${lit(c.status)}, ${c.sensitive}, ${arr(c.scopeKinds)})`
    ).join(",\n") + ";"
  );

  const deps = ACCESS_CAPABILITIES.flatMap((c) => c.dependsOn.map((d) => [c.key, d] as const));
  lines.push("insert into public.access_capability_dependencies (capability_key, requires_capability_key) values");
  lines.push(deps.map(([c, d]) => `  (${lit(c)}, ${lit(d)})`).join(",\n") + ";");

  lines.push("insert into public.access_role_profiles (role_key, version) values");
  lines.push(ACCESS_ROLE_PROFILES.map((p) => `  (${lit(p.role)}, ${p.version})`).join(",\n") + ";");

  lines.push("insert into public.access_role_profile_capabilities (role_key, version, capability_key, scope_kind) values");
  lines.push(
    ACCESS_ROLE_PROFILES.flatMap((p) =>
      p.entries.map((e) => `  (${lit(p.role)}, ${p.version}, ${lit(e.capability)}, ${lit(e.scope)})`)
    ).join(",\n") + ";"
  );

  lines.push(
    "insert into public.access_packages (package_key, status, sensitive, strong_auth_required, scope_kind, eligible_roles, assignable_by) values"
  );
  lines.push(
    ACCESS_PACKAGES.map(
      (p) =>
        `  (${lit(p.key)}, ${lit(p.status)}, ${p.sensitive}, ${p.strongAuthRequired}, ${lit(p.scope)}, ${arr(p.eligibleRoles)}, ${arr(p.assignableBy)})`
    ).join(",\n") + ";"
  );

  lines.push("insert into public.access_package_capabilities (package_key, capability_key) values");
  lines.push(
    ACCESS_PACKAGES.flatMap((p) => p.capabilities.map((c) => `  (${lit(p.key)}, ${lit(c)})`)).join(",\n") + ";"
  );

  lines.push(REGISTRY_SEED_END);
  return lines.join("\n");
}

/** Extracts the embedded seed block from migration text (line endings normalised). */
export function extractRegistrySeed(migrationSql: string): string | null {
  const text = migrationSql.replace(/\r\n/g, "\n");
  const start = text.indexOf(REGISTRY_SEED_BEGIN);
  const end = text.indexOf(REGISTRY_SEED_END);
  if (start < 0 || end < 0 || end < start) return null;
  return text.slice(start, end + REGISTRY_SEED_END.length);
}
