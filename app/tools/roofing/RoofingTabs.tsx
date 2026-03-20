import Link from "next/link";

export type RoofingTabKey = "estimate" | "saved" | "ai" | "settings";

export default function RoofingTabs({ active }: { active: RoofingTabKey }) {
  const base =
    "inline-flex items-center justify-center px-2 py-2 text-[13px] font-semibold tracking-wide transition-all duration-200";
  const on =
    "text-white opacity-100 relative after:absolute after:left-0 after:-bottom-[2px] after:h-[2px] after:w-full after:rounded-full after:bg-cyan-400 after:shadow-[0_0_8px_rgba(34,211,238,0.7)]";
  const off =
    "text-white/60 hover:text-white hover:opacity-100 opacity-80";

  return (
    <div className="w-full">
      <div className="relative flex w-full items-center justify-start gap-6 border-b border-white/10 pb-2">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
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
        <div className="ml-auto flex items-center pl-8 opacity-90">
          <Link
            href="/tools/settings"
            className={`${base} ${active === "settings" ? on : off}`}
          >
            Settings
          </Link>
        </div>
      </div>
    </div>
  );
}
