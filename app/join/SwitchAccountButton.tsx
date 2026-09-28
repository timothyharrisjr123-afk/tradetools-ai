"use client";

import { createClient } from "@/app/lib/supabase/client";
import { ENTRY_SECONDARY_ACTION } from "@/app/components/ui/surfaceStyles";

export function SwitchAccountButton({ href }: { href: string }) {
  async function switchAccount() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.assign(href);
  }

  return (
    <button type="button" onClick={switchAccount} className={`mt-6 ${ENTRY_SECONDARY_ACTION}`}>
      Use a different account
    </button>
  );
}
