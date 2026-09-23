import { ensureUserIdentity, getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import { buildLoginHrefWithReturn } from "@/app/lib/safeInternalRedirect";
import { createClient } from "@/app/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import UsualRoofSetupClient from "./UsualRoofSetupClient";

/**
 * Astra G5 — “Set up my usual roof”
 * Company-level starter catalog + template install. No fake job. No onboarding model.
 */
export default async function UsualRoofPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(buildLoginHrefWithReturn("/tools/roofing/usual-roof"));
  }
  await ensureUserIdentity(supabase, user);
  const companyId = await getUserCompanyId(supabase, user.id);
  if (!companyId) {
    redirect(buildLoginHrefWithReturn("/tools/roofing/usual-roof"));
  }

  return (
    <Suspense fallback={<div className="p-6 text-slate-600">Loading…</div>}>
      <UsualRoofSetupClient companyId={companyId} />
    </Suspense>
  );
}
