/**
 * Phase 7 / Astra G7 — responsibility + field handoff hard gate.
 * Run: npx tsx --test app/lib/astraG7Responsibility.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  capabilitiesForRole,
  hasCompanyCapability,
  isRestrictedFieldRole,
  resolveCompanyMembershipRole,
} from "./companyMembershipRoles";
import { buildFieldBriefViewModel } from "./fieldBriefModel";
import { resolveMemberDisplayLabel } from "./companyMemberValidation";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

describe("Astra G7 role presets", () => {
  test("resolves the five stable role keys; anything else fails closed", () => {
    assert.equal(resolveCompanyMembershipRole("owner"), "owner");
    assert.equal(resolveCompanyMembershipRole("admin"), "admin");
    assert.equal(resolveCompanyMembershipRole("office_sales"), "office_sales");
    assert.equal(resolveCompanyMembershipRole("production_lead"), "production_lead");
    assert.equal(resolveCompanyMembershipRole("field_user"), "field_user");
    assert.equal(resolveCompanyMembershipRole("Office / Sales"), "invalid_role");
    assert.equal(resolveCompanyMembershipRole("owner_admin"), "invalid_role");
  });

  test("field user cannot commercial-author or payment-admin", () => {
    assert.equal(hasCompanyCapability("field_user", "proposal_author"), false);
    assert.equal(hasCompanyCapability("field_user", "payment_admin"), false);
    assert.equal(hasCompanyCapability("field_user", "member_admin"), false);
    assert.equal(hasCompanyCapability("field_user", "job_pause_resume"), false);
    assert.equal(
      hasCompanyCapability("field_user", "job_disposition_finalize"),
      false
    );
    assert.equal(isRestrictedFieldRole("field_user"), true);
  });

  test("production lead never holds commercial or payment authority", () => {
    const caps = capabilitiesForRole("production_lead");
    assert.equal(caps.has("proposal_author"), false);
    assert.equal(caps.has("payment_admin"), false);
    assert.equal(caps.has("job_disposition_finalize"), false);
  });
});

describe("Astra G7 display + field brief", () => {
  test("null assignee resolves to Unassigned", () => {
    assert.equal(resolveMemberDisplayLabel({ userId: null }), "Unassigned");
    assert.equal(resolveMemberDisplayLabel({ userId: "" }), "Unassigned");
  });

  test("field brief derives Call/Directions only from real contact truth", () => {
    const empty = buildFieldBriefViewModel({
      customerName: "Pat",
      customerPhone: null,
      addressLine1: null,
    });
    assert.equal(empty.contact.canCall, false);
    assert.equal(empty.contact.canDirections, false);
    assert.equal(empty.contact.telUrl, null);
    assert.equal(empty.contact.mapsUrl, null);

    const full = buildFieldBriefViewModel({
      customerName: "Pat",
      customerPhone: "(512) 555-0100",
      addressLine1: "123 Main St",
      addressCity: "Austin",
      addressState: "TX",
      addressZip: "78701",
      productionLeadLabel: null,
      tasks: [
        {
          id: "t1",
          title: "Tear-off",
          status: "open",
          dueOn: null,
          assignedTo: null,
        },
      ],
      proposedDiffersFromAuthorized: true,
    });
    assert.equal(full.contact.canCall, true);
    assert.equal(full.contact.canDirections, true);
    assert.equal(full.schedule.productionLeadLabel, "Unassigned");
    assert.equal(full.tasks[0].assigneeLabel, "Unassigned");
    assert.match(
      String(full.authorizedWork.warningProposedVsAuthorized),
      /Proposed work differs/
    );
  });
});

describe("Astra G7 repo authority contracts", () => {
  test("migration is additive for task assignee + membership remove + activity types", () => {
    const sql = read(
      "supabase/migrations/20260923200000_phase7_responsibility_handoff.sql"
    );
    assert.match(sql, /job_tasks[\s\S]*assigned_to uuid null/);
    assert.match(sql, /company_memberships[\s\S]*removed_at timestamptz null/);
    assert.match(sql, /production_lead_assigned/);
    assert.match(sql, /jobs\.assigned_to/);
    assert.doesNotMatch(sql, /create table.*assignment_matrix/i);
  });

  test("production lead API validates and does not touch stage", () => {
    const persist = read("app/lib/jobResponsibilityPersistence.ts");
    assert.match(persist, /validateLiveCompanyMember/);
    assert.match(persist, /assigned_to/);
    assert.match(persist, /stageUnchanged/);
    assert.doesNotMatch(persist, /transition_job_stage/i);
    const route = read("app/api/jobs/[jobId]/production-lead/route.ts");
    assert.match(route, /job_assign/);
  });

  test("task assignee writer validates company membership", () => {
    const persist = read("app/lib/jobTaskPersistence.ts");
    assert.match(persist, /setJobTaskAssignee/);
    assert.match(persist, /validateLiveCompanyMember/);
    assert.match(persist, /foreign_member|removed_member/);
  });

  test("sensitive routes enforce capabilities for field restrictions", () => {
    const send = read("app/api/proposals/send/route.ts");
    assert.match(send, /proposal_author/);
    const refunds = read(
      "app/api/jobs/[jobId]/payments/[paymentId]/refunds/route.ts"
    );
    assert.match(refunds, /payment_admin/);
    const members = read("app/api/company/members/route.ts");
    assert.match(members, /member_admin/);
    const start = read("app/api/jobs/start-work/route.ts");
    assert.match(start, /lifecycle_start_complete/);
    const disposition = read("app/api/jobs/change-disposition/route.ts");
    assert.match(disposition, /requireCapabilitySession/);
  });

  test("removed members lose getUserCompanyId access", () => {
    const id = read("app/lib/ensureUserIdentity.ts");
    assert.match(id, /removed_at/);
  });

  test("no enterprise RBAC builder / second field app shell", () => {
    const roles = read("app/lib/companyMembershipRoles.ts");
    assert.doesNotMatch(roles, /permission.?builder|custom.?acl/i);
    assert.doesNotMatch(roles, /owner_admin/);
    assert.match(roles, /field_user/);
  });
});
