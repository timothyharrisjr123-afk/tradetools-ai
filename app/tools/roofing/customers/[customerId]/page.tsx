import { ensureUserIdentity, getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import { createClient } from "@/app/lib/supabase/server";
import { isUuidLike } from "@/app/lib/uuid";
import { redirect } from "next/navigation";
import CustomerWorkspaceClient from "./CustomerWorkspaceClient";

export const dynamic = "force-dynamic";

export default async function CustomerWorkspacePage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const redirectTo = `/tools/roofing/customers/${encodeURIComponent(customerId)}`;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  await ensureUserIdentity(supabase, user);
  const companyId = await getUserCompanyId(supabase, user.id);
  if (!companyId) redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  if (!isUuidLike(customerId)) redirect("/tools/roofing/saved");

  return <CustomerWorkspaceClient customerId={customerId} />;
}
