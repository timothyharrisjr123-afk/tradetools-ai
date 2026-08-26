import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Payments is owned by Company Settings. This route stays for existing links
 * and Stripe return URLs, and opens the focused Payments editor.
 */
export default async function SettingsPaymentsPage() {
  redirect("/tools/settings?edit=payments");
}
