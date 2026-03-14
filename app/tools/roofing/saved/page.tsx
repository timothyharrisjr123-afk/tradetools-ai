import { SignOutButton } from "@/app/components/auth/SignOutButton";
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
    <>
      <div className="flex justify-end p-4">
        <SignOutButton />
      </div>
      <Suspense
        fallback={
          <div className="p-6 text-white/70">
            Loading saved estimates…
          </div>
        }
      >
        <SavedClient companyId={companyId} />
      </Suspense>
    </>
  );
}
