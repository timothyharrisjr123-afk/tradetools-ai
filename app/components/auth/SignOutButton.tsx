"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabase/client";
import { LAST_DB_JOB_ID_STORAGE_KEY } from "@/app/lib/jobBoardAdapter";

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    try {
      window.localStorage.removeItem(LAST_DB_JOB_ID_STORAGE_KEY);
    } catch {
      // storage unavailable
    }
    router.refresh();
    router.push("/login");
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className={className ?? "rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/10"}
    >
      Sign out
    </button>
  );
}
