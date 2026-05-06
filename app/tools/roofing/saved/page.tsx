import { ensureUserIdentity, getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import { createClient } from "@/app/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import SavedClient from "./SavedClient";

export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/tools/roofing/saved");
  await ensureUserIdentity(supabase, user);
  const companyId = await getUserCompanyId(supabase, user.id);
  if (!companyId) redirect("/login?redirectTo=/tools/roofing/saved");

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-white/60 text-sm" style={{ backgroundColor: "#0b1120" }}>
          Loading Command Center…
        </div>
      }
    >
      <SavedClient companyId={companyId} />
    </Suspense>
  );
}
