import { ensureUserIdentity, getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import { createClient } from "@/app/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import RoofingClient from "./RoofingClient";

function hasRoofingWorkspaceDeepLink(
  params: Record<string, string | string[] | undefined>
): boolean {
  const keys = ["entry", "job", "loadSaved", "legacy", "tab", "from", "autoSend"] as const;
  return keys.some((key) => params[key] != null && params[key] !== "");
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  if (!hasRoofingWorkspaceDeepLink(params)) {
    redirect("/tools/roofing/saved");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?redirectTo=/tools/roofing");
  }
  await ensureUserIdentity(supabase, user);
  const companyId = await getUserCompanyId(supabase, user.id);
  if (!companyId) redirect("/login?redirectTo=/tools/roofing");

  return (
    <Suspense fallback={<div className="p-6 text-white/70">Loading…</div>}>
      <RoofingClient companyId={companyId} />
    </Suspense>
  );
}
