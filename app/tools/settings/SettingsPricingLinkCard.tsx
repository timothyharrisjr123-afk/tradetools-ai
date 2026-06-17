import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SETTINGS_LINK_CARD } from "@/app/tools/settings/settingsConstants";

export default function SettingsPricingLinkCard() {
  return (
    <section aria-labelledby="settings-pricing-link-heading">
      <Link href="/tools/settings/pricing" className={SETTINGS_LINK_CARD}>
        <span className="min-w-0">
          <span
            id="settings-pricing-link-heading"
            className="block text-sm font-semibold text-slate-900"
          >
            Company pricing policy
          </span>
          <span className="mt-0.5 block text-xs text-slate-500">
            Default profitability and tax used to price proposals — separate from branding.
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      </Link>
    </section>
  );
}
