import { requireActiveCompanyPage } from "@/app/lib/access/requireActiveCompanyPage";
import { createClient } from "@/app/lib/supabase/server";
import FieldDiveAppShell from "@/app/tools/roofing/FieldDiveAppShell";
import { redirect } from "next/navigation";
import TeamBoardClient from "@/app/tools/team/TeamBoardClient";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/tools/team");
  const { companyId } = await requireActiveCompanyPage(supabase, user);

  return (
    <FieldDiveAppShell activeNav="team">
      <TeamBoardClient companyId={companyId} />
    </FieldDiveAppShell>
  );
}
