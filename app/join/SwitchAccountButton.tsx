"use client";

import { createClient } from "@/app/lib/supabase/client";

export function SwitchAccountButton({ href }: { href: string }) {
  async function switchAccount() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.assign(href);
  }

  return (
    <button
      type="button"
      onClick={switchAccount}
      className="mt-6 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/10"
    >
      Use a different account
    </button>
  );
}
