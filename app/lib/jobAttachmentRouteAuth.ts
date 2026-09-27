/**
 * Attachment route auth: jobs.read for reads, photos.contribute for writes, both
 * evaluated at the route's job (Field members only reach granted jobs). Storage is
 * reached only through these routes (service-role signed URLs), so a disabled or
 * ungranted member can neither read nor mint new URLs.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { checkAccess } from "@/app/lib/access/requireAccess";
import { JobAttachmentHttpError } from "@/app/lib/jobAttachmentPersistence";

export async function requireJobAttachmentSession(
  supabase: SupabaseClient,
  access: "read" | "mutate",
  jobId: string
): Promise<{ userId: string; companyId: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new JobAttachmentHttpError(401, "unauthorized");
  }
  const gate = await checkAccess(
    supabase,
    user.id,
    access === "mutate" ? "photos.contribute" : "jobs.read",
    { jobId }
  );
  if (!gate.ok) {
    throw new JobAttachmentHttpError(gate.denial.status, gate.denial.code);
  }
  return { userId: user.id, companyId: gate.session.companyId };
}
