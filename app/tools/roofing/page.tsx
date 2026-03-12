import { createClient } from "@/app/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import RoofingClient from "./RoofingClient";

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <Suspense fallback={<div className="p-6 text-white/70">Loading…</div>}>
      <RoofingClient />
    </Suspense>
  );
}
