import { requireActiveCompanyPage } from "@/app/lib/access/requireActiveCompanyPage";
import { createClient } from "@/app/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import SavedClient from "./SavedClient";

export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/tools/roofing/saved");
  const { companyId } = await requireActiveCompanyPage(supabase, user);

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-white/60 text-sm" style={{ backgroundColor: "#0b1120" }}>
          Loading Jobs Board…
        </div>
      }
    >
      <SavedClient companyId={companyId} />
    </Suspense>
  );
}
