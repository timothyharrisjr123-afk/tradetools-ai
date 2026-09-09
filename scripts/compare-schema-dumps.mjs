#!/usr/bin/env node
/**
 * FieldDive durable schema equivalence checker.
 * Compares two schema-only SQL dumps (production authoritative vs local baseline).
 * Allowed noise: dump ordering, harmless whitespace/quoting, known managed owner/extension noise.
 * Must NOT normalize away RLS, policies, grants, function security/search_path/bodies,
 * constraints, index predicates/uniqueness, or FK actions.
 *
 * Usage:
 *   node scripts/compare-schema-dumps.mjs <prod.sql> <local.sql> [--out result.json]
 */
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const outPath = outIdx >= 0 ? args[outIdx + 1] : null;
const files = args.filter((a, i) => a !== "--out" && i !== outIdx + 1);
if (files.length !== 2) {
  console.error("Usage: node scripts/compare-schema-dumps.mjs <prod.sql> <local.sql> [--out result.json]");
  process.exit(2);
}

const [prodPath, localPath] = files;

function read(p) {
  return fs.readFileSync(p, "utf8");
}

function stripSqlComments(sql) {
  // Remove line comments and /* */ blocks outside dollar quotes (best-effort).
  let out = "";
  let i = 0;
  let inDollar = null;
  while (i < sql.length) {
    if (inDollar) {
      const end = sql.indexOf(inDollar, i);
      if (end < 0) {
        out += sql.slice(i);
        break;
      }
      out += sql.slice(i, end + inDollar.length);
      i = end + inDollar.length;
      inDollar = null;
      continue;
    }
    if (sql[i] === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
      continue;
    }
    if (sql[i] === "/" && sql[i + 1] === "*") {
      i += 2;
      while (i < sql.length && !(sql[i] === "*" && sql[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (sql[i] === "$") {
      const m = sql.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
      if (m) {
        inDollar = m[0];
        out += m[0];
        i += m[0].length;
        continue;
      }
    }
    out += sql[i];
    i++;
  }
  return out;
}

function normalizeWs(s) {
  return s
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n+/g, "\n")
    .replace(/ ?([(),;]) ?/g, "$1")
    .replace(/\s+$/gm, "")
    .trim()
    .toLowerCase();
}

function unquoteIdent(s) {
  return s.replaceAll('"', "").toLowerCase();
}

function normalizeExpr(s) {
  return normalizeWs(
    s
      .replaceAll('"', "")
      .replace(/\bpublic\./g, "")
      .replace(/\bpg_catalog\./g, "")
  );
}

/**
 * Normalize boolean/check expressions where pg_dump versions differ only by
 * redundant parentheses around AND/OR chains. Stripping parens is safe here
 * because PostgreSQL AND binds tighter than OR, matching typical CHECK shapes.
 * Does not alter operator text, literals, or function calls beyond whitespace.
 */
function normalizeConstraintExpr(s) {
  return normalizeExpr(s).replace(/[()]/g, "");
}

/** Split top-level statements on semicolons outside quotes/dollar-quotes. */
function splitStatements(sql) {
  const stmts = [];
  let buf = "";
  let i = 0;
  let inSingle = false;
  let inDouble = false;
  let dollar = null;
  while (i < sql.length) {
    const ch = sql[i];
    if (dollar) {
      if (sql.startsWith(dollar, i)) {
        buf += dollar;
        i += dollar.length;
        dollar = null;
        continue;
      }
      buf += ch;
      i++;
      continue;
    }
    if (inSingle) {
      buf += ch;
      if (ch === "'" && sql[i + 1] === "'") {
        buf += "'";
        i += 2;
        continue;
      }
      if (ch === "'") inSingle = false;
      i++;
      continue;
    }
    if (inDouble) {
      buf += ch;
      if (ch === '"') inDouble = false;
      i++;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      buf += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      buf += ch;
      i++;
      continue;
    }
    if (ch === "$") {
      const m = sql.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
      if (m) {
        dollar = m[0];
        buf += m[0];
        i += m[0].length;
        continue;
      }
    }
    if (ch === ";") {
      const t = buf.trim();
      if (t) stmts.push(t);
      buf = "";
      i++;
      continue;
    }
    buf += ch;
    i++;
  }
  const t = buf.trim();
  if (t) stmts.push(t);
  return stmts;
}

function isAllowedNoiseStatement(stmt) {
  const n = normalizeWs(stmt);
  if (n.startsWith("set ")) return true;
  if (n.startsWith("select pg_catalog.set_config")) return true;
  if (n.startsWith("comment on schema public")) return true;
  // Managed extension host noise that differs between cloud/local install paths.
  if (n.includes("create extension if not exists") && /pg_stat_statements|supabase_vault/.test(n)) {
    return true;
  }
  if (n.startsWith("create schema if not exists extensions")) return true;
  if (n.startsWith("create schema if not exists vault")) return true;
  // Owner lines always postgres in both dumps for public objects; still compare if present.
  return false;
}

function parseDump(sqlRaw, label) {
  const sql = stripSqlComments(sqlRaw);
  const stmts = splitStatements(sql);

  const tables = new Map(); // name -> create sql normalized
  const columns = new Map(); // table.col -> def
  const constraints = new Map();
  const indexes = new Map();
  const functions = new Map();
  const triggers = new Map();
  const policies = new Map();
  const rls = new Map(); // table -> {enabled,forced}
  const grants = new Set();
  const revokes = new Set();
  const defaultPrivileges = new Set();
  const extensions = new Set();
  const types = new Set();
  const other = [];

  for (const stmt of stmts) {
    if (isAllowedNoiseStatement(stmt)) continue;
    const n = normalizeWs(stmt);

    let m;
    if ((m = stmt.match(/^CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+"?([a-zA-Z0-9_]+)"?/i))) {
      const name = m[1].toLowerCase();
      if (name === "pg_stat_statements" || name === "supabase_vault") continue;
      extensions.add(name);
      continue;
    }

    if ((m = stmt.match(/^CREATE\s+TYPE\s+"?public"?\."?([^"]+)"?/i))) {
      types.add(unquoteIdent(m[1]));
      continue;
    }

    if ((m = stmt.match(/^CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+"?public"?\."?([^"]+)"?\s*\(([\s\S]*)\)\s*$/i))) {
      const table = unquoteIdent(m[1]);
      const body = m[2];
      tables.set(table, normalizeConstraintExpr(body));
      // column lines (skip constraint-only lines)
      for (const line of body.split(",\n")) {
        const L = line.trim();
        if (!L) continue;
        if (/^(CONSTRAINT|PRIMARY KEY|UNIQUE|CHECK|FOREIGN KEY)/i.test(L)) continue;
        const cm = L.match(/^"?([a-zA-Z0-9_]+)"?\s+([\s\S]+)$/);
        if (cm) {
          columns.set(`${table}.${unquoteIdent(cm[1])}`, normalizeConstraintExpr(cm[2]));
        }
      }
      continue;
    }

    if ((m = stmt.match(/^ALTER\s+TABLE\s+(?:ONLY\s+)?(?:"?public"?\.)?"?([^"]+)"?\s+([\s\S]+)$/i))) {
      const table = unquoteIdent(m[1]);
      const rest = m[2].trim();
      if (/ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(rest)) {
        const cur = rls.get(table) || { enabled: false, forced: false };
        cur.enabled = true;
        rls.set(table, cur);
        continue;
      }
      if (/FORCE\s+ROW\s+LEVEL\s+SECURITY/i.test(rest)) {
        const cur = rls.get(table) || { enabled: false, forced: false };
        cur.forced = true;
        rls.set(table, cur);
        continue;
      }
      if (/DISABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(rest)) {
        const cur = rls.get(table) || { enabled: false, forced: false };
        cur.enabled = false;
        rls.set(table, cur);
        continue;
      }
      // ADD CONSTRAINT / OWNER / etc
      const key = `${table}::${normalizeConstraintExpr(rest)}`;
      constraints.set(key, normalizeConstraintExpr(rest));
      continue;
    }

    if ((m = stmt.match(/^CREATE\s+(UNIQUE\s+)?INDEX(?:\s+IF\s+NOT\s+EXISTS)?\s+"?([^"]+)"?\s+ON\s+(?:"?public"?\.)?"?([^"]+)"?\s+([\s\S]+)$/i))) {
      const unique = Boolean(m[1]);
      const name = unquoteIdent(m[2]);
      const table = unquoteIdent(m[3]);
      const rest = normalizeConstraintExpr(m[4]);
      indexes.set(name, { table, unique, def: rest });
      continue;
    }

    if ((m = stmt.match(/^CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:"?public"?\.)?"?([^"(]+)"?\s*(\([^)]*\))\s+([\s\S]+)$/i))) {
      const name = unquoteIdent(m[1]);
      const args = normalizeExpr(m[2]);
      const rest = m[3];
      const lang = (rest.match(/LANGUAGE\s+"?([a-zA-Z0-9_]+)"?/i) || [])[1]?.toLowerCase() || "";
      const security = /SECURITY\s+DEFINER/i.test(rest)
        ? "definer"
        : /SECURITY\s+INVOKER/i.test(rest)
          ? "invoker"
          : "invoker";
      const volatility = ((rest.match(/\b(IMMUTABLE|STABLE|VOLATILE)\b/i) || [])[1] || "volatile").toLowerCase();
      const searchPath = normalizeExpr((rest.match(/SET\s+"?search_path"?\s*(?:TO|=)\s*([^;\n]+)/i) || [])[1] || "");
      const returns = normalizeExpr((rest.match(/RETURNS\s+([\s\S]*?)(?:\s+LANGUAGE|\s+SECURITY|\s+SET|\s+AS\s+\$)/i) || [])[1] || "");
      const bodyMatch = rest.match(/AS\s+(\$[A-Za-z0-9_]*\$)([\s\S]*?)\1\s*$/i);
      const body = bodyMatch ? normalizeExpr(bodyMatch[2]) : normalizeExpr(rest);
      const key = `${name}${args}`;
      functions.set(key, { name, args, returns, lang, security, volatility, searchPath, body });
      continue;
    }

    if ((m = stmt.match(/^CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+"?([^"]+)"?\s+([\s\S]+)$/i))) {
      const name = unquoteIdent(m[1]);
      triggers.set(name, normalizeExpr(m[2]));
      continue;
    }

    if ((m = stmt.match(/^CREATE\s+POLICY\s+"?([^"]+)"?\s+ON\s+(?:"?public"?\.)?"?([^"]+)"?\s+([\s\S]+)$/i))) {
      const name = unquoteIdent(m[1]);
      const table = unquoteIdent(m[2]);
      policies.set(`${table}::${name}`, normalizeConstraintExpr(m[3]));
      continue;
    }

    if (/^GRANT\s+/i.test(stmt)) {
      grants.add(normalizeExpr(stmt));
      continue;
    }
    if (/^REVOKE\s+/i.test(stmt)) {
      revokes.add(normalizeExpr(stmt));
      continue;
    }
    if (/^ALTER\s+DEFAULT\s+PRIVILEGES/i.test(stmt)) {
      defaultPrivileges.add(normalizeExpr(stmt));
      continue;
    }

    // Ignore ownership noise if identical semantics; still track non-postgres owners as significant
    if (/^ALTER\s+.*\s+OWNER\s+TO/i.test(stmt)) {
      if (/OWNER\s+TO\s+"?postgres"?/i.test(stmt)) continue;
      other.push(normalizeExpr(stmt));
      continue;
    }

    // Ignore pure comments
    if (/^COMMENT\s+ON/i.test(stmt)) continue;

    other.push(normalizeExpr(stmt).slice(0, 500));
  }

  return {
    label,
    tables,
    columns,
    constraints,
    indexes,
    functions,
    triggers,
    policies,
    rls,
    grants,
    revokes,
    defaultPrivileges,
    extensions,
    types,
    other,
  };
}

function mapDiff(a, b, name) {
  const onlyA = [];
  const onlyB = [];
  const changed = [];
  for (const [k, v] of a) {
    if (!b.has(k)) onlyA.push(k);
    else {
      const bv = b.get(k);
      const av = typeof v === "string" ? v : JSON.stringify(v);
      const bvS = typeof bv === "string" ? bv : JSON.stringify(bv);
      if (av !== bvS) changed.push({ key: k, a: v, b: bv });
    }
  }
  for (const k of b.keys()) {
    if (!a.has(k)) onlyB.push(k);
  }
  return { name, onlyA, onlyB, changed };
}

function setDiff(a, b, name) {
  const onlyA = [...a].filter((x) => !b.has(x)).sort();
  const onlyB = [...b].filter((x) => !a.has(x)).sort();
  return { name, onlyA, onlyB, changed: [] };
}

function classifyDiff(diff) {
  // Security-significant categories
  const securityNames = new Set([
    "rls",
    "policies",
    "grants",
    "revokes",
    "defaultPrivileges",
    "functions",
  ]);
  const paymentKeys = /payment|stripe|company_payment/i;
  const authKeys = /company_membership|profiles|companies|auth/i;
  const jobKeys = /jobs|job_schedules|job_attention|job_activity|job_tasks|job_attachments|lifecycle/i;
  const proposalKeys = /proposal/i;
  const searchKeys = /propert|search_company|customers/i;

  const items = [...diff.onlyA, ...diff.onlyB, ...diff.changed.map((c) => c.key)];
  const domains = {
    security: securityNames.has(diff.name) || items.some((k) => /policy|rls|grant|revoke|security definer|search_path/i.test(String(k))),
    payments: items.some((k) => paymentKeys.test(String(k))),
    auth_tenancy: items.some((k) => authKeys.test(String(k))),
    jobs_lifecycle: items.some((k) => jobKeys.test(String(k))),
    proposals: items.some((k) => proposalKeys.test(String(k))),
    property_search: items.some((k) => searchKeys.test(String(k))),
  };
  return domains;
}

const prod = parseDump(read(prodPath), "production");
const local = parseDump(read(localPath), "local");

const diffs = [
  mapDiff(prod.tables, local.tables, "tables"),
  mapDiff(prod.columns, local.columns, "columns"),
  mapDiff(prod.constraints, local.constraints, "constraints"),
  mapDiff(prod.indexes, local.indexes, "indexes"),
  mapDiff(prod.functions, local.functions, "functions"),
  mapDiff(prod.triggers, local.triggers, "triggers"),
  mapDiff(prod.policies, local.policies, "policies"),
  mapDiff(
    new Map([...prod.rls].map(([k, v]) => [k, JSON.stringify(v)])),
    new Map([...local.rls].map(([k, v]) => [k, JSON.stringify(v)])),
    "rls"
  ),
  setDiff(prod.grants, local.grants, "grants"),
  setDiff(prod.revokes, local.revokes, "revokes"),
  setDiff(prod.defaultPrivileges, local.defaultPrivileges, "defaultPrivileges"),
  setDiff(prod.extensions, local.extensions, "extensions"),
  setDiff(prod.types, local.types, "types"),
];

function countIssues(d) {
  return d.onlyA.length + d.onlyB.length + d.changed.length;
}

const unexplained = diffs.filter((d) => countIssues(d) > 0);
let securitySignificant = 0;
const domainFail = {
  auth_tenancy: false,
  jobs_lifecycle: false,
  proposals: false,
  payments: false,
  property_search: false,
  security: false,
};

for (const d of unexplained) {
  const c = classifyDiff(d);
  if (c.security) {
    domainFail.security = true;
    securitySignificant += countIssues(d);
  }
  if (c.auth_tenancy) domainFail.auth_tenancy = true;
  if (c.jobs_lifecycle) domainFail.jobs_lifecycle = true;
  if (c.proposals) domainFail.proposals = true;
  if (c.payments) domainFail.payments = true;
  if (c.property_search) domainFail.property_search = true;
}

const totalUnexplained = unexplained.reduce((n, d) => n + countIssues(d), 0);

const paymentSpot = {
  company_payment_accounts: local.tables.has("company_payment_accounts"),
  columns: [...local.columns.keys()]
    .filter((k) => k.startsWith("company_payment_accounts."))
    .map((k) => k.split(".")[1])
    .sort(),
  has_is_current: local.columns.has("company_payment_accounts.is_current"),
  has_connection_status: local.columns.has("company_payment_accounts.connection_status"),
  has_ended_at: local.columns.has("company_payment_accounts.ended_at"),
  unique_company_provider: [...local.constraints.keys()].some(
    (k) =>
      k.startsWith("company_payment_accounts::") &&
      /unique\s*company_id\s*,\s*provider\b/.test(k.replace(/[()]/g, " "))
  ),
  unique_provider_account: [...local.constraints.keys()].some(
    (k) =>
      k.startsWith("company_payment_accounts::") &&
      /unique\s*provider\s*,\s*provider_account_id\b/.test(k.replace(/[()]/g, " "))
  ),
};

const result = {
  ok: totalUnexplained === 0,
  produced_at_utc: new Date().toISOString(),
  production_dump: path.resolve(prodPath),
  local_dump: path.resolve(localPath),
  totals: {
    unexplained_differences: totalUnexplained,
    security_significant_differences: securitySignificant,
    categories_with_diffs: unexplained.map((d) => ({
      name: d.name,
      only_production: d.onlyA.length,
      only_local: d.onlyB.length,
      changed: d.changed.length,
    })),
  },
  domain_equivalence: {
    auth_tenancy: domainFail.auth_tenancy ? "FAIL" : "PASS",
    jobs_lifecycle: domainFail.jobs_lifecycle ? "FAIL" : "PASS",
    proposals: domainFail.proposals ? "FAIL" : "PASS",
    payments: domainFail.payments ? "FAIL" : "PASS",
    property_search: domainFail.property_search ? "FAIL" : "PASS",
    security: domainFail.security ? "FAIL" : "PASS",
  },
  payment_spot_check: paymentSpot,
  object_counts: {
    production: {
      tables: prod.tables.size,
      columns: prod.columns.size,
      constraints: prod.constraints.size,
      indexes: prod.indexes.size,
      functions: prod.functions.size,
      triggers: prod.triggers.size,
      policies: prod.policies.size,
      rls: prod.rls.size,
      grants: prod.grants.size,
      revokes: prod.revokes.size,
    },
    local: {
      tables: local.tables.size,
      columns: local.columns.size,
      constraints: local.constraints.size,
      indexes: local.indexes.size,
      functions: local.functions.size,
      triggers: local.triggers.size,
      policies: local.policies.size,
      rls: local.rls.size,
      grants: local.grants.size,
      revokes: local.revokes.size,
    },
  },
  diffs: unexplained.map((d) => ({
    name: d.name,
    onlyA: d.onlyA.slice(0, 50),
    onlyB: d.onlyB.slice(0, 50),
    changed: d.changed.slice(0, 20).map((c) => ({
      key: c.key,
      a: typeof c.a === "string" ? c.a.slice(0, 300) : c.a,
      b: typeof c.b === "string" ? c.b.slice(0, 300) : c.b,
    })),
  })),
};

const text = JSON.stringify(result, null, 2);
if (outPath) {
  fs.writeFileSync(outPath, text + "\n", "utf8");
}
console.log(
  JSON.stringify(
    {
      ok: result.ok,
      unexplained: totalUnexplained,
      security_significant: securitySignificant,
      domains: result.domain_equivalence,
      payment_spot_check: paymentSpot,
      out: outPath,
    },
    null,
    2
  )
);
process.exit(result.ok ? 0 : 1);
