/**
 * Photos / Attachments V1 — schema, security, authority, UI.
 * Run: npx tsx --test app/lib/jobAttachmentSql057.test.ts
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { AFTER_048_MIGRATIONS } from "./jobPaymentBalance054.test";

const ROOT = process.cwd();
const MIGRATIONS = join(ROOT, "supabase/migrations");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sha = (path: string) =>
  createHash("sha256").update(readFileSync(path)).digest("hex").toUpperCase();

const SQL_056 = join(MIGRATIONS, "20260827_056_flexible_collect_payment.sql");
const SQL_057 = join(MIGRATIONS, "20260828_057_job_attachments.sql");
const SHA_056 = "9A60B1AA495EEB88206580A9BB8C0F54BAD65399CCA4F86B9D77FEF78C2E3351";

describe("057 — historical payments stay locked", () => {
  test("056 unchanged; 057 is job attachments not payment", () => {
    assert.equal(existsSync(SQL_057), true);
    assert.equal(sha(SQL_056), SHA_056);
    assert.ok(!readdirSync(MIGRATIONS).some((name) => name.includes("_039_")));
    const sql = readFileSync(SQL_057, "utf8");
    assert.equal(sha(SQL_057), "EE5520AB0BC05E96C9A72EA30D26F142D75C80D77A1083BAD5A2CD4A7E774C46");
    assert.match(sql, /039 remains reserved/);
    assert.doesNotMatch(sql, /job_payment_requests/);
    assert.doesNotMatch(sql, /create or replace function public\.collect_job_payment_v1/);
  });

  test("AFTER_048 list includes 057 attachments file", () => {
    const names = readdirSync(MIGRATIONS).filter(
      (n) => n.endsWith(".sql") && /_0(49|5\d)_/.test(n)
    );
    assert.deepEqual(names.sort(), [...AFTER_048_MIGRATIONS].sort());
  });
});

describe("057 — schema and storage", () => {
  const sql = readFileSync(SQL_057, "utf8");

  test("private bucket and signed-access-only objects", () => {
    assert.match(sql, /insert into storage\.buckets/);
    assert.match(sql, /'job-attachments'/);
    assert.match(sql, /public = false/);
    assert.match(sql, /No anon\/authenticated object policies/);
    assert.doesNotMatch(sql, /to public/);
  });

  test("gallery flag, internal visibility, soft delete, no AI fields", () => {
    assert.match(sql, /listed_in_job_gallery boolean not null default true/);
    assert.match(sql, /visibility = 'internal'/);
    assert.match(sql, /deleted_at timestamptz null/);
    assert.doesNotMatch(
      sql,
      /confidence_score|roof_geometry|measurement_candidate|processing_status|\bgps\b|\blatitude\b|\blongitude\b/i
    );
  });

  test("company/job match and path prefix trigger", () => {
    assert.match(sql, /company_id must match jobs\.company_id/);
    assert.match(sql, /storage_path must be company\/job\/id prefixed/);
    assert.match(sql, /identity fields are immutable/);
  });

  test("RLS company membership; no DELETE policy", () => {
    assert.match(sql, /enable row level security/);
    assert.match(sql, /job_attachments_select_company_scope/);
    assert.match(sql, /company_memberships/);
    assert.match(sql, /No DELETE policy/);
    assert.match(sql, /grant select, insert, update on table public\.job_attachments to authenticated/);
    assert.match(sql, /revoke all on table public\.job_attachments from anon/);
  });
});

describe("057 — authority isolation", () => {
  const sql = readFileSync(SQL_057, "utf8");
  const persist = read("app/lib/jobAttachmentPersistence.ts");
  const routes = [
    read("app/api/jobs/[jobId]/attachments/route.ts"),
    read("app/api/jobs/[jobId]/attachments/[attachmentId]/route.ts"),
    read("app/api/jobs/[jobId]/attachments/[attachmentId]/finalize/route.ts"),
  ].join("\n");
  const ui = [
    read("app/tools/roofing/jobCard/JobCardAttachmentsWorkspace.tsx"),
    read("app/tools/roofing/jobCard/useJobCardAttachments.ts"),
    read("app/tools/roofing/jobCard/JobCardSecondaryPanels.tsx"),
  ].join("\n");

  test("no measurement writes", () => {
    assert.doesNotMatch(sql, /measurement_records/);
    assert.doesNotMatch(persist, /selected_measurement_id|source_file_id|report_file_id/);
    assert.doesNotMatch(routes, /measurement_records/);
  });

  test("no proposal writes", () => {
    assert.doesNotMatch(sql, /proposal_records|media_refs|pdf_attachment_key/);
    assert.doesNotMatch(persist, /proposal_records/);
    assert.doesNotMatch(routes, /proposal_records/);
  });

  test("no lifecycle writes", () => {
    assert.match(sql, /NEVER writes jobs\.stage/);
    assert.doesNotMatch(persist, /\.update\(\s*\{[^}]*stage/);
    assert.doesNotMatch(persist, /start_job_work|complete_job_work|change_job_disposition/);
  });

  test("no payment writes", () => {
    assert.doesNotMatch(sql, /job_payments|job_payment_requests|stripe/i);
    assert.doesNotMatch(persist, /job_payment/);
  });

  test("no activity events", () => {
    assert.doesNotMatch(sql, /record_job_activity_v1/);
    assert.doesNotMatch(persist, /record_job_activity/);
    assert.doesNotMatch(ui, /Photo uploaded|record_job_activity/);
  });

  test("no overview or board photo chrome", () => {
    const overview = read("app/tools/roofing/jobCard/JobCardOverviewSummary.tsx");
    const board = read("app/tools/roofing/saved/jobsBoardUtils.ts");
    assert.doesNotMatch(overview, /photo count|attachments uploaded/i);
    assert.doesNotMatch(board, /job_attachments|photo count/i);
  });
});
