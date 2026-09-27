import { requireActiveCompanyPage } from "@/app/lib/access/requireActiveCompanyPage";
import { parseTimezoneReturnPath } from "@/app/lib/jobScheduleMapper";
import { createClient } from "@/app/lib/supabase/server";
import FieldDiveAppShell from "@/app/tools/roofing/FieldDiveAppShell";
import { redirect } from "next/navigation";
import CompanySettingsClient, {
  type CompanySettingsEditorId,
} from "./CompanySettingsClient";

export const dynamic = "force-dynamic";

const DEEP_LINK_EDITORS = new Set(["business", "branding", "payments", "preferences"]);

function resolveInitialEditor(raw: string | undefined): CompanySettingsEditorId {
  return raw && DEEP_LINK_EDITORS.has(raw) ? (raw as CompanySettingsEditorId) : null;
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; timezoneReturnTo?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?redirectTo=/tools/settings");
  }
  const { companyId } = await requireActiveCompanyPage(supabase, user);

  const { edit, timezoneReturnTo: rawReturnTo } = await searchParams;

  // Schedule flows deep-link here to set a timezone, then resume where they left off.
  const timezoneReturnTo = rawReturnTo
    ? parseTimezoneReturnPath(`?timezoneReturnTo=${encodeURIComponent(rawReturnTo)}`)
    : null;

  return (
    <FieldDiveAppShell activeNav="company">
      <CompanySettingsClient
        companyId={companyId}
        initialEditor={timezoneReturnTo ? "preferences" : resolveInitialEditor(edit)}
        timezoneReturnTo={timezoneReturnTo}
      />
    </FieldDiveAppShell>
  );
}
