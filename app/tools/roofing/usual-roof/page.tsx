import { requireActiveCompanyPage } from "@/app/lib/access/requireActiveCompanyPage";
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
  const { companyId } = await requireActiveCompanyPage(supabase, user);

  return (
    <Suspense fallback={<div className="p-6 text-slate-600">Loading…</div>}>
      <UsualRoofSetupClient companyId={companyId} />
    </Suspense>
  );
}
