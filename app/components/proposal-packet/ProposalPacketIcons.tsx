type IconProps = { className?: string };

export function IconUser({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.866 3.134-7 7-7s7 3.134 7 7" />
    </svg>
  );
}

export function IconHome({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z" />
    </svg>
  );
}

export function IconCheck({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M5 12.5 9.5 17 19 7" />
    </svg>
  );
}

export function IconStar({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 3.5 14.2 9h5.8l-4.7 3.5 1.8 5.5L12 15.8 6.7 18l1.8-5.5L3.8 9h5.8L12 3.5z" />
    </svg>
  );
}

export function IconPlus({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

export function IconPhone({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M6.5 4h3l1.5 4.5-2 1.5a11 11 0 0 0 5 5l1.5-2L21 14v3a1.5 1.5 0 0 1-1.5 1.5C10.5 18.5 5.5 13.5 5.5 6A1.5 1.5 0 0 1 6.5 4z" />
    </svg>
  );
}

export function IconMail({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="3" y="6" width="18" height="12" rx="1.5" />
      <path d="m3 7.5 9 6 9-6" />
    </svg>
  );
}

export function IconGlobe({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.8 4 6.2 4 9s-1.5 6.2-4 9M12 3c-2.5 2.8-4 6.2-4 9s1.5 6.2 4 9" />
    </svg>
  );
}

export function IconShield({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 3 19 6v6c0 4.5-3.2 7.8-7 9-3.8-1.2-7-4.5-7-9V6l7-3z" />
    </svg>
  );
}

export function IconTool({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-2.5 2.5-2.5z" />
    </svg>
  );
}

/** Roofing materials — layered protection. */
export function IconLayers({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 3 3 8l9 5 9-5-9-5z" />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 16 9 5 9-5" />
    </svg>
  );
}

/** Ventilation & flashing. */
export function IconVent({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M4 12h4M16 12h4" />
      <path d="M8 8c2 0 3 1.5 4 4s2 4 4 4" />
      <path d="M8 16c2 0 3-1.5 4-4s2-4 4-4" />
    </svg>
  );
}

/** Cleanup & disposal. */
export function IconCleanup({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M9 5h6" />
      <path d="M10 5V4h4v1" />
      <path d="M6 7h12" />
      <path d="M8 7v11a1.5 1.5 0 0 0 1.5 1.5h5A1.5 1.5 0 0 0 16 18V7" />
      <path d="M10.5 11v4.5M13.5 11v4.5" />
    </svg>
  );
}

export function IconChat({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 4V7a2 2 0 0 1 2-2z" />
    </svg>
  );
}

export function IconDownload({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 4v10m0 0 4-4m-4 4-4-4M5 20h14" />
    </svg>
  );
}

export function IconShare({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="M8.2 10.8 15.8 6.7M8.2 13.2l7.6 4.1" />
    </svg>
  );
}

/** Project notes — brief clarifying text. */
export function IconNotes({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="5" y="3.5" width="14" height="17" rx="1.5" />
      <path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4.5" />
    </svg>
  );
}

export function IconInfo({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6M12 7.5v.01" />
    </svg>
  );
}

export function packageAccentIconClass(accent: string): string {
  switch (accent) {
    case "premium":
      return "bg-[#071f3a]/10 text-[#071f3a]";
    case "enhanced":
      return "bg-[#2563eb]/10 text-[#2563eb]";
    case "standard":
      return "bg-slate-100 text-[#475569]";
    default:
      return "bg-slate-100 text-[#475569]";
  }
}

export function scopeGroupIcon(title: string) {
  if (/material/i.test(title)) return IconLayers;
  if (/ventilation|flashing/i.test(title)) return IconVent;
  if (/labor|install/i.test(title)) return IconTool;
  if (/cleanup|disposal/i.test(title)) return IconCleanup;
  return IconShield;
}
