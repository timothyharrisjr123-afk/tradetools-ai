/**
 * Attachment route auth: typed active membership for reads, photo_mutate for writes.
 * Storage is reached only through these routes (service-role signed URLs), so a
 * disabled member can neither read nor mint new URLs.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveLiveMembership } from "@/app/lib/companyMembershipSession";
import { JobAttachmentHttpError } from "@/app/lib/jobAttachmentPersistence";
import {
  mapActiveMembershipGate,
  mapCapabilityGate,
} from "@/app/lib/requireCapabilitySession";

export async function requireJobAttachmentSession(
  supabase: SupabaseClient,
  access: "read" | "mutate"
): Promise<{ userId: string; companyId: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new JobAttachmentHttpError(401, "unauthorized");
  }
  const resolution = await resolveLiveMembership(supabase, user.id);
  const gate =
    access === "mutate"
      ? mapCapabilityGate(resolution, "photo_mutate")
      : mapActiveMembershipGate(resolution);
  if (!gate.ok) {
    throw new JobAttachmentHttpError(gate.denial.status, gate.denial.code);
  }
  return { userId: user.id, companyId: gate.session.companyId };
}
