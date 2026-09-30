import { redirect } from "next/navigation";

/** Old bookmarks resolve to the single operational workspace. */
export default function LegacyTeamPage() {
  redirect("/tools/team");
}
