import { ensureUserIdentity, getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import { createClient } from "@/app/lib/supabase/server";
import FieldDiveAppShell from "@/app/tools/roofing/FieldDiveAppShell";
import { redirect } from "next/navigation";
import SettingsCompanyBrandingClient from "./SettingsCompanyBrandingClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?redirectTo=/tools/settings");
  }
  await ensureUserIdentity(supabase, user);
  const companyId = await getUserCompanyId(supabase, user.id);
  if (!companyId) {
    redirect("/login?redirectTo=/tools/settings");
  }

  return (
    <FieldDiveAppShell>
      <SettingsCompanyBrandingClient />
    </FieldDiveAppShell>
  );
}
