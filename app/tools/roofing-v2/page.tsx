import { ensureUserIdentity, getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import { createClient } from "@/app/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import RoofingClientV2 from "./RoofingClientV2";

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    if (process.env.NODE_ENV === "development") {
      return (
        <Suspense fallback={<div className="p-6 text-white/70">Loading…</div>}>
          <RoofingClientV2 companyId="dev-bypass" />
        </Suspense>
      );
    }
    redirect("/login?redirectTo=/tools/roofing-v2");
  }
  await ensureUserIdentity(supabase, user);
  const companyId = await getUserCompanyId(supabase, user.id);
  if (!companyId) redirect("/login?redirectTo=/tools/roofing-v2");

  return (
    <Suspense fallback={<div className="p-6 text-white/70">Loading…</div>}>
      <RoofingClientV2 companyId={companyId} />
    </Suspense>
  );
}
