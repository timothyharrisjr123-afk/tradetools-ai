import { requireActiveCompanyPage } from "@/app/lib/access/requireActiveCompanyPage";
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
  const { companyId } = await requireActiveCompanyPage(supabase, user);
  if (!isUuidLike(customerId)) redirect("/tools/roofing/saved");

  return <CustomerWorkspaceClient customerId={customerId} />;
}
