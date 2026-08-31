import { ensureUserIdentity, getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import { createClient } from "@/app/lib/supabase/server";
import { isUuidLike } from "@/app/lib/uuid";
import { redirect } from "next/navigation";
import PropertyWorkspaceClient from "./PropertyWorkspaceClient";

export const dynamic = "force-dynamic";

export default async function PropertyWorkspacePage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  const redirectTo = `/tools/roofing/properties/${encodeURIComponent(propertyId)}`;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  await ensureUserIdentity(supabase, user);
  const companyId = await getUserCompanyId(supabase, user.id);
  if (!companyId) redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  if (!isUuidLike(propertyId)) redirect("/tools/roofing/saved");

  return <PropertyWorkspaceClient propertyId={propertyId} />;
}
