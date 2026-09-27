import { requireActiveCompanyPage } from "@/app/lib/access/requireActiveCompanyPage";
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
  const { companyId } = await requireActiveCompanyPage(supabase, user);
  if (!isUuidLike(propertyId)) redirect("/tools/roofing/saved");

  return <PropertyWorkspaceClient propertyId={propertyId} />;
}
