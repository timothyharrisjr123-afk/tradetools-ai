import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SETTINGS_LINK_CARD } from "@/app/tools/settings/settingsConstants";

export default function SettingsPaymentsLinkCard() {
  return (
    <section aria-labelledby="settings-payments-link-heading">
      <Link href="/tools/settings/payments" className={SETTINGS_LINK_CARD}>
        <span className="min-w-0">
          <span
            id="settings-payments-link-heading"
            className="block text-sm font-semibold text-slate-900"
          >
            Payments
          </span>
          <span className="mt-0.5 block text-xs text-slate-500">
            Stripe connection and deposit prefill — separate from pricing math.
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      </Link>
    </section>
  );
}
