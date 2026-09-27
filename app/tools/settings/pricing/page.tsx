import { requireActiveCompanyPage } from "@/app/lib/access/requireActiveCompanyPage";
import { createClient } from "@/app/lib/supabase/server";
import FieldDiveAppShell from "@/app/tools/roofing/FieldDiveAppShell";
import { redirect } from "next/navigation";
import CompanyPricingPolicySettingsClient from "./CompanyPricingPolicySettingsClient";

export const dynamic = "force-dynamic";

export default async function CompanyPricingPolicySettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?redirectTo=/tools/settings/pricing");
  }
  const { companyId } = await requireActiveCompanyPage(supabase, user);

  return (
    <FieldDiveAppShell activeNav="pricing">
      <CompanyPricingPolicySettingsClient companyId={companyId} />
    </FieldDiveAppShell>
  );
}
