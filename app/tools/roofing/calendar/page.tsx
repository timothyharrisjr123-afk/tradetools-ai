import { ensureUserIdentity, getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import { createClient } from "@/app/lib/supabase/server";
import { redirect } from "next/navigation";
import FieldDiveCalendarClient from "./FieldDiveCalendarClient";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/tools/roofing/calendar");
  await ensureUserIdentity(supabase, user);
  const companyId = await getUserCompanyId(supabase, user.id);
  if (!companyId) redirect("/login?redirectTo=/tools/roofing/calendar");
  const { data: company } = await supabase
    .from("companies")
    .select("timezone")
    .eq("id", companyId)
    .maybeSingle();
  const timezone =
    typeof company?.timezone === "string" ? company.timezone : null;

  return (
    <FieldDiveCalendarClient
      companyId={companyId}
      initialTimezone={timezone}
    />
  );
}
