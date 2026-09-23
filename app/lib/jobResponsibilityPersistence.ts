/**
 * Astra G7 — production lead authority on jobs.assigned_to.
 * One field. NULL = Unassigned. Does not mutate stage/proposal/payment/schedule.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { validateLiveCompanyMember } from "@/app/lib/companyMemberValidation";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { isUuidLike } from "@/app/lib/uuid";

export class JobResponsibilityHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message?: string
  ) {
    super(message ?? code);
  }
}

export type ProductionLeadSetResult = {
  jobId: string;
  companyId: string;
  previousAssignedTo: string | null;
  assignedTo: string | null;
  stageUnchanged: string;
  activityEventType:
    | "production_lead_assigned"
    | "production_lead_changed"
    | "production_lead_cleared"
    | null;
};

function activityTypeForChange(
  previous: string | null,
  next: string | null
): ProductionLeadSetResult["activityEventType"] {
  if (previous === next) return null;
  if (!previous && next) return "production_lead_assigned";
  if (previous && !next) return "production_lead_cleared";
  return "production_lead_changed";
}

async function insertProductionLeadActivity(input: {
  companyId: string;
  jobId: string;
  actorUserId: string;
  eventType: NonNullable<ProductionLeadSetResult["activityEventType"]>;
  previousAssignedTo: string | null;
  assignedTo: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.rpc("job_lifecycle_insert_activity", {
      p_company_id: input.companyId,
      p_job_id: input.jobId,
      p_event_type: input.eventType,
      p_actor_user_id: input.actorUserId,
      p_payload: {
        previous_assigned_to: input.previousAssignedTo,
        assigned_to: input.assignedTo,
      },
      p_occurred_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[setJobProductionLead] activity insert failed", err);
  }
}

/**
 * Set or clear jobs.assigned_to after live same-company member validation.
 * Idempotent when the durable value already matches (lost-response safe).
 */
export async function setJobProductionLead(input: {
  supabase: SupabaseClient;
  companyId: string;
  jobId: string;
  actorUserId: string;
  assignedTo: string | null;
}): Promise<ProductionLeadSetResult> {
  if (!isUuidLike(input.jobId) || !isUuidLike(input.companyId)) {
    throw new JobResponsibilityHttpError(400, "invalid_payload");
  }

  const next =
    input.assignedTo == null || String(input.assignedTo).trim() === ""
      ? null
      : String(input.assignedTo).trim();

  if (next != null) {
    if (!isUuidLike(next)) {
      throw new JobResponsibilityHttpError(400, "invalid_assignee");
    }
    const validated = await validateLiveCompanyMember(
      input.supabase,
      input.companyId,
      next
    );
    if (!validated.ok) {
      const status =
        validated.code === "foreign_member" || validated.code === "removed_member"
          ? 403
          : 400;
      throw new JobResponsibilityHttpError(status, validated.code);
    }
  }

  const { data: job, error: jobError } = await input.supabase
    .from("jobs")
    .select("id, company_id, assigned_to, stage")
    .eq("id", input.jobId)
    .eq("company_id", input.companyId)
    .is("deleted_at", null)
    .maybeSingle();

  if (jobError) {
    throw new JobResponsibilityHttpError(500, "internal_error");
  }
  if (!job) {
    throw new JobResponsibilityHttpError(404, "not_found");
  }

  const previous =
    job.assigned_to == null ? null : String(job.assigned_to).trim() || null;
  const stageUnchanged = String(job.stage ?? "");

  if (previous === next) {
    return {
      jobId: String(job.id),
      companyId: String(job.company_id),
      previousAssignedTo: previous,
      assignedTo: next,
      stageUnchanged,
      activityEventType: null,
    };
  }

  const { data: updated, error: updateError } = await input.supabase
    .from("jobs")
    .update({
      assigned_to: next,
      updated_by: input.actorUserId,
    })
    .eq("id", input.jobId)
    .eq("company_id", input.companyId)
    .is("deleted_at", null)
    .select("id, company_id, assigned_to, stage")
    .maybeSingle();

  if (updateError) {
    throw new JobResponsibilityHttpError(500, "internal_error");
  }
  if (!updated) {
    throw new JobResponsibilityHttpError(404, "not_found");
  }

  const assignedTo =
    updated.assigned_to == null
      ? null
      : String(updated.assigned_to).trim() || null;
  const eventType = activityTypeForChange(previous, assignedTo);

  if (eventType) {
    await insertProductionLeadActivity({
      companyId: input.companyId,
      jobId: input.jobId,
      actorUserId: input.actorUserId,
      eventType,
      previousAssignedTo: previous,
      assignedTo,
    });
  }

  return {
    jobId: String(updated.id),
    companyId: String(updated.company_id),
    previousAssignedTo: previous,
    assignedTo,
    stageUnchanged: String(updated.stage ?? stageUnchanged),
    activityEventType: eventType,
  };
}
