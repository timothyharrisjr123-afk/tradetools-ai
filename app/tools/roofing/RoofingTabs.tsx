import Link from "next/link";

export type RoofingTabKey = "estimate" | "saved" | "ai" | "settings";

export default function RoofingTabs({ active }: { active: RoofingTabKey }) {
  const base =
    "rounded-full px-3 py-1.5 text-[11px] font-semibold border transition-colors";
  const on =
    "bg-white/[0.08] border-white/15 text-white/90 hover:bg-white/[0.10]";
  const off =
    "bg-white/[0.03] border-white/10 text-white/60 hover:text-white/80 hover:bg-white/[0.06]";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 rounded-3xl border border-white/10 bg-white/[0.04] p-2 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <a
          href="/tools/roofing"
          className={`${base} ${active === "estimate" ? on : off}`}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
            e.preventDefault();
            window.location.assign("/tools/roofing");
          }}
        >
          Estimate
        </a>

        <Link
          href="/tools/roofing/saved"
          className={`${base} ${active === "saved" ? on : off}`}
        >
          Saved
        </Link>

        <Link
          href="/tools/roofing/ai"
          className={`${base} ${active === "ai" ? on : off}`}
        >
          AI Library
        </Link>

        <div className="flex-1" />

        <Link
          href="/tools/settings"
          className={`${base} ${active === "settings" ? on : off}`}
        >
          Settings
        </Link>
      </div>
    </div>
  );
}
