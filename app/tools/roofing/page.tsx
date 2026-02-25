"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation"
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { motion, useSpring, useMotionValueEvent } from "framer-motion";
import { getAIReview } from "./aiReview";
import {
  ArrowLeft,
  Ruler,
  Percent,
  Package,
  DollarSign,
  HardHat,
  TrendingUp,
  Sparkles,
  History,
  Info,
  MapPin,
  ChevronDown,
} from "lucide-react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { loadCompanyProfile, type CompanyProfile } from "@/app/lib/companyProfile";
import {
  saveEstimate as saveToEstimateStore,
  getSavedEstimates,
  getSavedEstimateById,
  getCurrentLoadedSavedId,
  setCurrentLoadedSavedId,
  updateSavedEstimate,
  markSavedEstimateSent,
  markSavedEstimateApproved,
  setSavedEstimateApprovalToken,
  attachApprovalTokenAndMarkPending,
  duplicateSavedEstimate,
  type RoofingEstimate as SavedEstimateSnapshot,
} from "@/app/lib/estimateStore";
import { sendEstimateEmailWithPdf } from "@/app/lib/sendEstimateClient";
import { getFavorite, setFavorite, setLocked, appendFeedback, getTierFeedbackBias, type TierLabel } from "@/app/lib/aiWordingPrefs";
import RoofingTabs from "@/app/tools/roofing/RoofingTabs";
import { loadCompanyVoiceProfile, saveCompanyVoiceProfile, type VoiceTone } from "@/app/lib/companyVoiceProfile";

const STORAGE_KEY_ESTIMATES = "roofing_estimates";
const STORAGE_KEY_LAST_LOADED = "roofing_last_loaded";
const STORAGE_KEY_DEBRIS = "roofing_debris_settings";
const STORAGE_KEY_HELP_DEBRIS = "roofing_help_seen_debris";
const STORAGE_KEY_LAST_ZIP = "roofing_last_zip";
const STORAGE_KEY_ZIP_PRESETS = "roofing_zip_presets";
const STORAGE_KEY_LABOR_METHOD = "roofing_labor_method";
const STORAGE_KEY_PACKAGE_DESC = "ttai_packageDescription";
const STORAGE_KEY_SCHEDULE_CTA = "ttai_scheduleCta";
const STORAGE_KEY_LABOR_ADJ = "ttai_laborAdjPct";
const LABOR_MODE_KEY = "ttai_laborModePref";
const GUIDED_LABOR_DEFAULTS_KEY = "ttai_guidedLaborDefaults_v1";

const DEFAULT_GUIDED_BASE_PER_SQ = 65;
const DEFAULT_TWO_STORY_PCT = 12;
const DEFAULT_THREE_PLUS_PCT = 22;
const DEFAULT_STEEP_PCT = 18;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function clampInt(n: number, min: number, max: number): number {
  return clamp(Math.round(n), min, max);
}

const BASE_PER_SQ_MIN = 0;
const BASE_PER_SQ_MAX = 500;
const ADJ_PCT_MIN = 0;
const ADJ_PCT_MAX = 80;

type DebrisRemovalType = "standard" | "architectural";

type RoofingTier = "standard" | "enhanced" | "premium";

function tierLabelFromRoofingTier(tier: RoofingTier): TierLabel {
  return tier === "standard" ? "Core" : tier === "enhanced" ? "Enhanced" : "Premium";
}

const tierConfig: Record<
  RoofingTier,
  { label: string; includes: string[] }
> = {
  standard: {
    label: "Core Roofing System",
    includes: [
      "architectural shingles",
      "standard felt underlayment",
      "standard ridge ventilation",
    ],
  },
  enhanced: {
    label: "Enhanced Roofing System",
    includes: [
      "architectural shingles",
      "synthetic underlayment",
      "enhanced ridge ventilation",
    ],
  },
  premium: {
    label: "Premium Roofing System",
    includes: [
      "impact-rated shingles",
      "synthetic underlayment",
      "upgraded ridge ventilation",
    ],
  },
};

type InsightLevel = "good" | "heads_up" | "fyi";

type PricingInsight = {
  level: InsightLevel;
  text: string;
};

function getPricingInsights(input: {
  adjustedSquares?: number;
  laborCost?: number;
  materialsCost?: number;
  tearOffEnabled?: boolean;
  tearOffAndDisposalCost?: number;
  suggestedPrice?: number;
  marginPct?: number;
}): PricingInsight[] {
  const insights: PricingInsight[] = [];

  const sq = Number.isFinite(input.adjustedSquares) ? (input.adjustedSquares as number) : 0;
  const labor = Number.isFinite(input.laborCost) ? (input.laborCost as number) : 0;
  const mats = Number.isFinite(input.materialsCost) ? (input.materialsCost as number) : 0;
  const disposal = Number.isFinite(input.tearOffAndDisposalCost) ? (input.tearOffAndDisposalCost as number) : 0;
  const price = Number.isFinite(input.suggestedPrice) ? (input.suggestedPrice as number) : 0;
  const margin = Number.isFinite(input.marginPct) ? (input.marginPct as number) : NaN;

  if (input.tearOffEnabled && disposal <= 0) {
    insights.push({ level: "heads_up", text: "Heads-up: Tear-off is on but disposal is $0." });
  }

  if (sq > 0 && labor > 0) {
    const laborPerSq = labor / sq;
    if (laborPerSq < 40) {
      insights.push({ level: "heads_up", text: `Heads-up: Labor looks low for ${Math.round(sq)} squares.` });
    }
  }

  if (Number.isFinite(margin) && price > 0) {
    if (margin < 12) {
      insights.push({ level: "fyi", text: `FYI: Pricing is aggressive (${Math.round(margin)}% margin).` });
    } else if (margin < 18) {
      insights.push({ level: "fyi", text: `FYI: Margin is on the lower side (${Math.round(margin)}%).` });
    }
  }

  if (price <= 0) insights.push({ level: "heads_up", text: "Heads-up: Total is $0 — add estimate values before exporting." });
  if (mats <= 0) insights.push({ level: "fyi", text: "FYI: Materials are $0 — confirm inputs." });
  if (labor <= 0) insights.push({ level: "fyi", text: "FYI: Labor is $0 — confirm inputs." });

  if (insights.length === 0) {
    insights.push({ level: "good", text: "Looks good — nothing unusual detected." });
  }

  const priority = (lvl: InsightLevel) => (lvl === "heads_up" ? 2 : lvl === "fyi" ? 1 : 0);
  insights.sort((a, b) => priority(b.level) - priority(a.level));

  return insights.slice(0, 3);
}

type ReviewLevel = "good" | "heads_up" | "fyi";

type ReviewItem = {
  level: ReviewLevel;
  text: string;
};

function buildEstimateReview({
  deterministicInsights,
  gptComment,
}: {
  deterministicInsights: ReviewItem[];
  gptComment?: string;
}): ReviewItem[] {
  const items: ReviewItem[] = [];
  deterministicInsights.forEach((i) => items.push(i));
  if (gptComment && gptComment.trim().length > 0) {
    items.push({ level: "fyi", text: gptComment.trim() });
  }
  if (items.length === 0) {
    items.push({ level: "good", text: "Looks good — nothing unusual detected." });
  }
  return items.slice(0, 4);
}

type DebrisSettings = {
  includeDebrisRemoval: boolean;
  removalType: DebrisRemovalType;
  dumpFeePerTon: number;
};

const DEBRIS_WEIGHT_PER_SQ: Record<DebrisRemovalType, number> = {
  standard: 240,
  architectural: 300,
};

type PitchKey = "walkable" | "moderate" | "steep";
type StoriesKey = "1" | "2" | "3";
type ComplexityKey = "simple" | "moderate" | "complex";

const PITCH_MULTIPLIER: Record<PitchKey, number> = {
  walkable: 1.0,
  moderate: 1.1,
  steep: 1.2,
};

const STORY_MULTIPLIER: Record<StoriesKey, number> = {
  "1": 1.0,
  "2": 1.08,
  "3": 1.15,
};

const COMPLEXITY_MULTIPLIER: Record<ComplexityKey, number> = {
  simple: 1.0,
  moderate: 1.07,
  complex: 1.15,
};

type LaborInputMode = "perSquare" | "total";
/** Labor mode: manual = user-entered total; guided = base $/sq × explainable multipliers */
type LaborMode = "manual" | "guided";
type GuidedStories = "one" | "two" | "threePlus";
type GuidedWalkable = "walkable" | "steep";

/** ZIP preset: labor/material + debris defaults per ZIP */
type ZipPresetInputs = {
  wastePct: number;
  bundlesPerSquare: number;
  bundleCost: number;
  laborMode?: LaborInputMode;
  laborPerSquare: number;
  totalLabor?: number;
  marginPct: number;
};
type ZipPresetDebris = {
  enabled: boolean;
  tearOffType: "standard" | "architectural";
  dumpFeePerTon: number;
};
type ZipPreset = {
  updatedAt: string;
  inputs: ZipPresetInputs;
  debris: ZipPresetDebris;
};
type ZipPresetsMap = Record<string, ZipPreset>;

function getStoredLastZip(): string {
  if (typeof window === "undefined") return "";
  const z = localStorage.getItem(STORAGE_KEY_LAST_ZIP);
  return z && /^\d{5}$/.test(z) ? z : "";
}

function setStoredLastZip(zip: string): void {
  if (typeof window === "undefined") return;
  if (/^\d{5}$/.test(zip)) localStorage.setItem(STORAGE_KEY_LAST_ZIP, zip);
}

function getStoredLaborMethod(): LaborMode {
  if (typeof window === "undefined") return "manual";
  const v = localStorage.getItem(STORAGE_KEY_LABOR_METHOD);
  return v === "perSquare" || v === "guided" ? "guided" : "manual";
}

function setStoredLaborMethod(mode: LaborMode): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY_LABOR_METHOD, mode === "guided" ? "guided" : "manual");
}

/** Pure helper: get preset from in-memory map. Does NOT touch localStorage. */
function getZipPresetFromState(
  zip: string,
  presets: ZipPresetsMap | null
): ZipPreset | null {
  if (!/^\d{5}$/.test(zip) || !presets) return null;
  const p = presets[zip];
  if (!p || !p.inputs || !p.debris) return null;
  const tearOff = p.debris.tearOffType;
  const debris: ZipPresetDebris =
    tearOff === "standard" || tearOff === "architectural"
      ? p.debris
      : { ...p.debris, tearOffType: "standard" };
  return { ...p, debris };
}

function sanitizeZipInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 5);
}

const DEFAULT_DEBRIS: DebrisSettings = {
  includeDebrisRemoval: true,
  removalType: "standard",
  dumpFeePerTon: 0,
};

function getStoredDebrisSettings(): DebrisSettings {
  if (typeof window === "undefined") return DEFAULT_DEBRIS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DEBRIS);
    if (!raw) return DEFAULT_DEBRIS;
    const parsed = JSON.parse(raw) as Partial<DebrisSettings & { removalType?: string }>;
    const r = parsed?.removalType;
    const removalType: DebrisRemovalType =
      r === "architectural" ? "architectural" : "standard";
    return {
      includeDebrisRemoval: Boolean(parsed?.includeDebrisRemoval),
      removalType,
      dumpFeePerTon: Number(parsed?.dumpFeePerTon) || 0,
    };
  } catch {
    return DEFAULT_DEBRIS;
  }
}

function getHelpSeenDebris(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(STORAGE_KEY_HELP_DEBRIS) === "true";
}

function setHelpSeenDebris(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY_HELP_DEBRIS, "true");
}

function TooltipIcon({ text, id }: { text: string; id: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label="More info"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        className="ml-1 inline-flex shrink-0 rounded-full p-0.5 text-slate-500 hover:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && (
        <span
          role="tooltip"
          id={id}
          className="absolute left-0 top-full z-10 mt-1 max-w-[200px] rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-normal text-slate-200 shadow-lg ring-1 ring-white/10"
          style={{ bottom: "auto" }}
        >
          {text}
        </span>
      )}
    </span>
  );
}

export type RoofingEstimate = {
  id: string;
  savedAt: number;
  area: string;
  waste: string;
  bundlesPerSquare: string;
  bundleCost: string;
  laborPerSquare: string;
  margin: string;
  squares: number;
  adjustedSquares: number;
  bundles: number;
  materialsCost: number;
  laborCost: number;
  subtotal: number;
  suggestedPrice: number;
};

function getStoredEstimates(): RoofingEstimate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ESTIMATES);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RoofingEstimate[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const DEFAULTS = {
  area: "",
  waste: 10,
  bundlesPerSquare: 3,
  bundleCost: "",
  laborPerSquare: "",
  margin: 20,
};

const EXAMPLE = {
  area: "2400",
  waste: "10",
  bundlesPerSquare: "3",
  bundleCost: "42",
  laborPerSquare: "180",
  margin: "20",
};

function clampNonNegative(value: number): number {
  return value < 0 ? 0 : value;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtMoney(n: number): string {
  if (!Number.isFinite(n)) return "$0";
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export type LaborAdjPcts = { twoStoryAdjPct?: number; threePlusAdjPct?: number; steepAdjPct?: number };

function getStoriesMultiplier(s: GuidedStories, pcts?: LaborAdjPcts): number {
  switch (s) {
    case "one":
      return 1.0;
    case "two":
      return 1 + ((pcts?.twoStoryAdjPct ?? 12) || 0) / 100;
    case "threePlus":
      return 1 + ((pcts?.threePlusAdjPct ?? 22) || 0) / 100;
    default:
      return 1.0;
  }
}

function getWalkableMultiplier(w: GuidedWalkable, pcts?: LaborAdjPcts): number {
  switch (w) {
    case "walkable":
      return 1.0;
    case "steep":
      return 1 + ((pcts?.steepAdjPct ?? 18) || 0) / 100;
    default:
      return 1.0;
  }
}

function pctMultiplier(m: number): number {
  return Math.round((m - 1) * 100);
}

type PriceAdj = { label: string; multiplier: number; pct: number; delta: number };

function buildGuidedLaborBreakdown(
  baseLabor: number,
  stories: GuidedStories,
  walkable: GuidedWalkable,
  pcts?: LaborAdjPcts
): { breakdown: PriceAdj[]; totalMultiplier: number; totalLabor: number } {
  const items: { label: string; multiplier: number }[] = [
    { label: `Stories: ${stories === "one" ? "1" : stories === "two" ? "2" : "3+"}`, multiplier: getStoriesMultiplier(stories, pcts) },
    { label: `Roof: ${walkable === "walkable" ? "Walkable" : "Steep"}`, multiplier: getWalkableMultiplier(walkable, pcts) },
  ];
  const breakdown: PriceAdj[] = items.map((it) => ({
    label: it.label,
    multiplier: it.multiplier,
    pct: pctMultiplier(it.multiplier),
    delta: Math.round(baseLabor * (it.multiplier - 1)),
  }));
  const totalMultiplier = items.reduce((acc, it) => acc * it.multiplier, 1);
  const totalLabor = Math.round(baseLabor * totalMultiplier);
  return { breakdown, totalMultiplier, totalLabor };
}

type InputFieldProps = {
  id: string;
  label: string;
  helper: string;
  value: string;
  onChange: (v: string) => void;
  unitChip: string;
  icon: React.ReactNode;
  type?: "number";
  min?: number;
  max?: number;
  step?: string;
  placeholder?: string;
  labelTooltip?: string;
  labelTooltipId?: string;
};

function InputField({
  id,
  label,
  helper,
  value,
  onChange,
  unitChip,
  icon,
  type = "number",
  min = 0,
  max,
  step = "1",
  placeholder,
  labelTooltip,
  labelTooltipId = `tip-${id}`,
}: InputFieldProps) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="flex items-center text-sm font-medium text-slate-300"
      >
        {label}
        {labelTooltip && <TooltipIcon id={labelTooltipId} text={labelTooltip} />}
      </label>
      <p className="text-xs text-slate-500">{helper}</p>
      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.11] ring-2 ring-white/5 px-4 transition-all duration-200 ease-out focus-within:border-blue-400/30 focus-within:ring-blue-500/35 focus-within:shadow-[0_0_0_6px_rgba(59,130,246,0.10)] focus-within:bg-white/[0.12] hover:bg-white/[0.12]">
        <span className="text-slate-400 shrink-0 w-4 flex justify-center" aria-hidden>{icon}</span>
        <input
          id={id}
          type={type}
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 border-0 bg-transparent py-3.5 pr-2 text-white/95 placeholder:text-white/35 focus:outline-none focus:ring-0 caret-blue-400 [appearance:textfield]"
        />
        <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 shrink-0">
          {unitChip}
        </span>
      </div>
    </div>
  );
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

/** Snapshot of form state for Undo autofill */
type FormSnapshot = {
  area: string;
  waste: string;
  bundlesPerSquare: string;
  bundleCost: string;
  laborMode: LaborMode;
  laborCostRaw: string;
  laborCost: number;
  guidedLaborBasePerSquare: number;
  guidedStories: GuidedStories;
  guidedWalkable: GuidedWalkable;
  margin: string;
  includeDebrisRemoval: boolean;
  removalType: DebrisRemovalType;
  dumpFeePerTon: string;
};

export default function Page() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const loadSavedId = searchParams.get("loadSaved");
  const [zipPresets, setZipPresets] = useState<ZipPresetsMap | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [restoreTick, setRestoreTick] = useState(0);
  const loadAppliedRef = useRef(false);
  const isRestoringRef = useRef(false);
  const restoreTimerRef = useRef<number | null>(null);
  const autoSendFiredRef = useRef(false);

  const beginRestoreWindow = useCallback((id: string) => {
    if (restoreTimerRef.current) window.clearTimeout(restoreTimerRef.current);
    isRestoringRef.current = true;
    restoreTimerRef.current = window.setTimeout(() => {
      isRestoringRef.current = false;
      restoreTimerRef.current = null;
      setRestoreTick((n) => n + 1);
    }, 500);
  }, []);
  const aiAssistRef = useRef<HTMLDivElement | null>(null);
  const [area, setArea] = useState(DEFAULTS.area);
  const [waste, setWaste] = useState(String(DEFAULTS.waste));
  const [bundlesPerSquare, setBundlesPerSquare] = useState(
    String(DEFAULTS.bundlesPerSquare)
  );
  const [bundleCost, setBundleCost] = useState(DEFAULTS.bundleCost);
  const [laborMode, setLaborModeState] = useState<LaborMode>(() => getStoredLaborMethod());
  const setLaborMode = useCallback((value: LaborMode | ((prev: LaborMode) => LaborMode)) => {
    setLaborModeState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      setStoredLaborMethod(next);
      return next;
    });
  }, []);
  const [laborCostRaw, setLaborCostRaw] = useState<string>("");
  const [laborCost, setLaborCost] = useState<number>(0);
  const [guidedLaborBasePerSquare, setGuidedLaborBasePerSquare] = useState<number>(DEFAULT_GUIDED_BASE_PER_SQ);
  const [guidedStories, setGuidedStories] = useState<GuidedStories>("one");
  const [guidedWalkable, setGuidedWalkable] = useState<GuidedWalkable>("walkable");
  const [twoStoryAdjPct, setTwoStoryAdjPct] = useState<number>(DEFAULT_TWO_STORY_PCT);
  const [threePlusAdjPct, setThreePlusAdjPct] = useState<number>(DEFAULT_THREE_PLUS_PCT);
  const [steepAdjPct, setSteepAdjPct] = useState<number>(DEFAULT_STEEP_PCT);
  const [manualLaborBackup, setManualLaborBackup] = useState<number>(0);
  const [laborPerSquare, setLaborPerSquare] = useState(DEFAULTS.laborPerSquare);
  const [totalLabor, setTotalLabor] = useState("");
  const [margin, setMargin] = useState(String(DEFAULTS.margin));
  const [saveAsZipDefaults, setSaveAsZipDefaults] = useState(false);
  const [autofillFromZip, setAutofillFromZip] = useState(false);
  const [preAutofillSnapshot, setPreAutofillSnapshot] = useState<FormSnapshot | null>(null);
  const [zipNoPresetMessage, setZipNoPresetMessage] = useState(false);
  const [zipDefaultsSavedToast, setZipDefaultsSavedToast] = useState(false);
  const [zipClearedToast, setZipClearedToast] = useState(false);
  const [includeDebrisRemoval, setIncludeDebrisRemoval] = useState(DEFAULT_DEBRIS.includeDebrisRemoval);
  const [removalType, setRemovalType] = useState<DebrisRemovalType>(DEFAULT_DEBRIS.removalType);
  const [dumpFeePerTon, setDumpFeePerTon] = useState(String(DEFAULT_DEBRIS.dumpFeePerTon));
  const [helpSeenDebris, setHelpSeenDebrisState] = useState(true);
  const [showLaborAdjustments, setShowLaborAdjustments] = useState(false);
  const [showAdvancedMaterials, setShowAdvancedMaterials] = useState(false);
  const [laborFlash, setLaborFlash] = useState(false);
  const [showClientSummary, setShowClientSummary] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [useGptWording, setUseGptWording] = useState(true);
  const [gptState, setGptState] = useState<"idle" | "loading" | "error">("idle");
  const [gptError, setGptError] = useState<string>("");
  const [gptPackageDescription, setGptPackageDescription] = useState("");
  const [gptScheduleCta, setGptScheduleCta] = useState("");
  const [isEditingAiWording, setIsEditingAiWording] = useState(false);
  const [draftPackageDesc, setDraftPackageDesc] = useState("");
  const [draftScheduleCta, setDraftScheduleCta] = useState("");
  const [isEditingAi, setIsEditingAi] = useState(false);
  const [aiFavoriteLocked, setAiFavoriteLocked] = useState(false);
  const [aiToast, setAiToast] = useState<string | null>(null);
  const [voiceTone, setVoiceTone] = useState<VoiceTone>("professional");
  const [voiceNotes, setVoiceNotes] = useState("");
  const [showAiPanel, setShowAiPanel] = useState(false);

  const showAiToast = (msg: string) => {
    setAiToast(msg);
    window.setTimeout(() => setAiToast(null), 1600);
  };

  const beginEditAi = () => {
    setDraftPackageDesc((gptPackageDescription || "").trim());
    setDraftScheduleCta((gptScheduleCta || "").trim());
    setIsEditingAi(true);
  };

  const cancelEditAi = () => {
    setIsEditingAi(false);
  };

  const saveEditAi = () => {
    const pd = (draftPackageDesc || "").trim();
    const cta = (draftScheduleCta || "").trim();
    setGptPackageDescription(pd);
    setGptScheduleCta(cta);
    setUseGptWording(true);
    setIsEditingAi(false);
    try {
      if (typeof window !== "undefined") {
        sessionStorage.setItem(STORAGE_KEY_PACKAGE_DESC, pd);
        sessionStorage.setItem(STORAGE_KEY_SCHEDULE_CTA, cta);
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const pd = sessionStorage.getItem(STORAGE_KEY_PACKAGE_DESC);
      const cta = sessionStorage.getItem(STORAGE_KEY_SCHEDULE_CTA);
      if (pd) setGptPackageDescription(pd);
      if (cta) setGptScheduleCta(cta);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const v = loadCompanyVoiceProfile();
    setVoiceTone(v.tone);
    setVoiceNotes(v.styleNotes || "");
  }, []);

  useEffect(() => {
    if (laborMode === "manual") {
      setLaborCostRaw(laborCost ? String(Math.round(laborCost)) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laborCost, laborMode]);

  useEffect(() => {
    if (!loadSavedId || loadAppliedRef.current) return;

    const list = getSavedEstimates();
    const match = list.find((e) => e.id === loadSavedId);
    if (!match) return;

    beginRestoreWindow(loadSavedId);

    console.groupCollapsed("🟦 RESTORE apply", loadSavedId);
    console.log("match keys:", Object.keys(match as any));
    console.log("snapshot keys:", Object.keys(((match as any).snapshot ?? match) as any));
    console.log("snapshot:", (match as any).snapshot ?? match);
    console.groupEnd();

    const s: any = (match as any)?.snapshot ?? (match as any)?.inputs ?? (match as any);
    const normalized: any = {
      ...s,
      laborMode:
        (s as any).laborMode ??
        ((s as any).laborPerSquare != null ? "perSquare" : undefined),
      manualLaborCost:
        (s as any).manualLaborCost ??
        ((s as any).manualLabor != null ? (s as any).manualLabor : undefined) ??
        ((s as any).laborCost != null ? (s as any).laborCost : undefined),
      dumpFeePerTon:
        (s as any).dumpFeePerTon ??
        ((s as any).dumpFee != null ? (s as any).dumpFee : undefined),
      tearOffEnabled:
        (s as any).tearOffEnabled ??
        ((s as any).tearOff != null ? (s as any).tearOff : undefined),
      removalType:
        (s as any).removalType ??
        ((s as any).removal != null ? (s as any).removal : undefined),
    };
    setCustomerName(match.customerName || "");
    setCustomerEmail(match.customerEmail || "");
    setCustomerPhone(match.customerPhone || "");
    setJobAddress1(match.jobAddress1 || "");
    setJobCity(match.jobCity || "");
    setJobState(match.jobState || "");
    setJobZip(match.jobZip || match.zip || "");
    setArea(match.area ?? String(Number(match.roofAreaSqFt || 0)));
    setWaste(match.waste ?? "");
    setBundlesPerSquare(match.bundlesPerSquare ?? "");
    if (typeof s?.bundleCost === "number") setBundleCost(String(s.bundleCost));
    else if (typeof s?.bundleCost === "string" && s.bundleCost.trim() !== "") setBundleCost(s.bundleCost);
    else setBundleCost(match.bundleCost ?? "");
    setLaborPerSquare(match.laborPerSquare ?? "");
    const savedLabor = Number(match.laborCost ?? 0) || 0;
    setLaborCost(savedLabor);
    setLaborCostRaw(savedLabor ? String(Math.round(savedLabor)) : "");
    if (s?.laborMode === "manual" || s?.laborMode === "guided") setLaborMode(s.laborMode);
    const manualLabor =
      (typeof s?.manualLaborCost === "number" ? s.manualLaborCost : null) ??
      (typeof s?.laborCostManual === "number" ? s.laborCostManual : null) ??
      (typeof s?.manualLabor === "number" ? s.manualLabor : null) ??
      null;
    if (manualLabor != null) {
      try { setLaborMode("manual"); } catch { /* ignore */ }
      setLaborCost(manualLabor);
      setLaborCostRaw(String(Math.round(manualLabor)));
    }
    const fee =
      (typeof s?.dumpFeePerTon === "number" ? s.dumpFeePerTon : null) ??
      (typeof s?.landfillFeePerTon === "number" ? s.landfillFeePerTon : null) ??
      (typeof s?.disposalFeePerTon === "number" ? s.disposalFeePerTon : null) ??
      null;
    if (fee != null) {
      setDumpFeePerTon(typeof fee === "number" ? String(fee) : String(fee ?? ""));
    }
    const savedBasePerSq = Number(match.laborPerSquare ?? 0) || 0;
    if (savedBasePerSq > 0) setGuidedLaborBasePerSquare(savedBasePerSq);
    setMargin(match.margin ?? "");

    if (match.selectedTier === "Core") setRoofingTier("standard");
    if (match.selectedTier === "Enhanced") setRoofingTier("enhanced");
    if (match.selectedTier === "Premium") setRoofingTier("premium");

    if ((normalized as any).laborMode != null) {
      const mode = (normalized as any).laborMode === "perSquare" ? "guided" : (normalized as any).laborMode;
      if (mode === "manual" || mode === "guided") setLaborMode(mode);
    }
    if ((normalized as any).manualLaborCost != null) {
      const val = Number((normalized as any).manualLaborCost);
      if (Number.isFinite(val)) {
        setLaborCost(val);
        setLaborCostRaw(String(Math.round(val)));
      }
    }
    if ((normalized as any).dumpFeePerTon != null) {
      const v = (normalized as any).dumpFeePerTon;
      setDumpFeePerTon(typeof v === "number" ? String(v) : String(v ?? ""));
    }
    if ((normalized as any).tearOffEnabled != null) {
      setIncludeDebrisRemoval(Boolean((normalized as any).tearOffEnabled));
    }
    if ((normalized as any).removalType != null) {
      setRemovalType((normalized as any).removalType as DebrisRemovalType);
    }

    setCurrentLoadedSavedId(loadSavedId);

    loadAppliedRef.current = true;
  }, [loadSavedId, router, beginRestoreWindow]);

  useEffect(() => {
    if (!loadSavedId) return;

    const list = getSavedEstimates();
    const match = list.find((e) => e.id === loadSavedId);
    if (!match) return;

    const targetArea = match.area ?? String(Number(match.roofAreaSqFt || 0));
    const targetWaste = match.waste ?? "";
    const targetBundlesPerSquare = match.bundlesPerSquare ?? "";
    const targetBundleCost = match.bundleCost ?? "";
    const targetLaborPerSquare = match.laborPerSquare ?? "";
    const targetMargin = match.margin ?? "";

    const areaOk = String(area ?? "") === targetArea;
    const wasteOk = String(waste ?? "") === targetWaste;
    const bundlesPerSquareOk = String(bundlesPerSquare ?? "") === targetBundlesPerSquare;
    const bundleCostOk = String(bundleCost ?? "") === targetBundleCost;
    const laborPerSquareOk = String(laborPerSquare ?? "") === targetLaborPerSquare;
    const marginOk = String(margin ?? "") === targetMargin;

    if (!areaOk || !wasteOk || !bundlesPerSquareOk || !bundleCostOk || !laborPerSquareOk || !marginOk) {
      if (!areaOk) setArea(targetArea);
      if (!wasteOk) setWaste(targetWaste);
      if (!bundlesPerSquareOk) setBundlesPerSquare(targetBundlesPerSquare);
      if (!bundleCostOk) setBundleCost(targetBundleCost);
      if (!laborPerSquareOk) setLaborPerSquare(targetLaborPerSquare);
      if (!marginOk) setMargin(targetMargin);
      return;
    }

    // Only once all values "stick", clean the URL without remounting.
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", "/tools/roofing");
    }
  }, [loadSavedId, area, waste, bundlesPerSquare, bundleCost, laborPerSquare, margin]);

  const [gptReviewComment, setGptReviewComment] = useState("");
  const [showEmailTemplate, setShowEmailTemplate] = useState(false);
  const [showSendDetails, setShowSendDetails] = useState(false);
  const [showEmailPreviewPanel, setShowEmailPreviewPanel] = useState(false);
  const [showAiWordingPanel, setShowAiWordingPanel] = useState(false);
  const [showPdfToolsPanel, setShowPdfToolsPanel] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailState, setEmailState] = useState<"idle" | "loading" | "error">("idle");
  const [copyEmailSubjectState, setCopyEmailSubjectState] = useState<"idle" | "copied" | "error">("idle");
  const [copyEmailBodyState, setCopyEmailBodyState] = useState<"idle" | "copied" | "error">("idle");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [jobAddress1, setJobAddress1] = useState("");
  const [jobCity, setJobCity] = useState("");
  const [jobState, setJobState] = useState("");
  const [jobZip, setJobZip] = useState("");
  const [proposalNumber, setProposalNumber] = useState("");
  const [proposalDate, setProposalDate] = useState("");
  const [roofingTier, setRoofingTier] = useState<RoofingTier>("standard");

  useEffect(() => {
    const label = tierLabelFromRoofingTier(roofingTier);
    const fav = getFavorite(label);
    if (fav && (fav.packageDescription || fav.scheduleCta)) {
      setGptPackageDescription(fav.packageDescription || "");
      setGptScheduleCta(fav.scheduleCta || "");
      setUseGptWording(true);
      setAiFavoriteLocked(Boolean(fav.locked));
    } else {
      setAiFavoriteLocked(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roofingTier]);

  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(() =>
    typeof window !== "undefined" ? loadCompanyProfile() : { companyName: "", phone: "", email: "", license: "", logoDataUrl: "" }
  );
  const validDays = 30;

  useEffect(() => {
    setCompanyProfile(loadCompanyProfile());
  }, []);
  useEffect(() => {
    const onFocus = () => setCompanyProfile(loadCompanyProfile());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);
  const [sendState, setSendState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [sendError, setSendError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendEstimateError, setSendEstimateError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [isPreviewingPdf, setIsPreviewingPdf] = useState(false);
  const [attentionField, setAttentionField] = useState<null | "roofArea" | "customerEmail">(null);
  const [pdfError, setPdfError] = useState<string>("");
  const [showDisposalAdvanced, setShowDisposalAdvanced] = useState(false);
  const [disposalOverride, setDisposalOverride] = useState("");
  const [pitch, setPitch] = useState<PitchKey>("walkable");
  const [stories, setStories] = useState<StoriesKey>("1");
  const [complexity, setComplexity] = useState<ComplexityKey>("simple");

  const captureSnapshot = useCallback((): FormSnapshot => ({
    area,
    waste,
    bundlesPerSquare,
    bundleCost,
    laborMode,
    laborCostRaw,
    laborCost,
    guidedLaborBasePerSquare,
    guidedStories,
    guidedWalkable,
    margin,
    includeDebrisRemoval,
    removalType,
    dumpFeePerTon,
  }), [area, waste, bundlesPerSquare, bundleCost, laborMode, laborCostRaw, laborCost, guidedLaborBasePerSquare, guidedStories, guidedWalkable, margin, includeDebrisRemoval, removalType, dumpFeePerTon]);

  const applyPreset = useCallback((p: ZipPreset) => {
    const i = p.inputs;
    const d = p.debris;
    const mode: LaborMode = i.laborMode === "perSquare" ? "guided" : "manual";
    setArea("");
    setWaste(String(i.wastePct));
    setBundlesPerSquare(String(i.bundlesPerSquare));
    setBundleCost(i.bundleCost > 0 ? String(i.bundleCost) : "");
    setLaborMode(mode);
    setGuidedLaborBasePerSquare(i.laborPerSquare > 0 ? i.laborPerSquare : 65);
    const manualVal = i.totalLabor ?? 0;
    setLaborCost(manualVal);
    setLaborCostRaw(manualVal > 0 ? String(Math.round(manualVal)) : "");
    setMargin(String(i.marginPct));
    setIncludeDebrisRemoval(d.enabled);
    setRemovalType(d.tearOffType);
    setDumpFeePerTon(d.dumpFeePerTon > 0 ? String(d.dumpFeePerTon) : "");
  }, []);

  const undoAutofill = useCallback(() => {
    if (!preAutofillSnapshot) return;
    const s = preAutofillSnapshot;
    setArea(s.area);
    setWaste(s.waste);
    setBundlesPerSquare(s.bundlesPerSquare);
    setBundleCost(s.bundleCost);
    setLaborMode(s.laborMode);
    setLaborCostRaw(s.laborCostRaw);
    setLaborCost(s.laborCost);
    setGuidedLaborBasePerSquare(s.guidedLaborBasePerSquare);
    setGuidedStories(s.guidedStories);
    setGuidedWalkable(s.guidedWalkable);
    setMargin(s.margin);
    setIncludeDebrisRemoval(s.includeDebrisRemoval);
    setRemovalType(s.removalType);
    setDumpFeePerTon(s.dumpFeePerTon);
    setPreAutofillSnapshot(null);
    setAutofillFromZip(false);
  }, [preAutofillSnapshot]);

  const reset = useCallback(() => {
    setCurrentLoadedSavedId(null);
    setArea(DEFAULTS.area);
    setWaste(String(DEFAULTS.waste));
    setBundlesPerSquare(String(DEFAULTS.bundlesPerSquare));
    setBundleCost(DEFAULTS.bundleCost);
    setLaborMode("manual");
    setLaborCostRaw("");
    setLaborCost(0);
    setGuidedLaborBasePerSquare(DEFAULT_GUIDED_BASE_PER_SQ);
    setGuidedStories("one");
    setGuidedWalkable("walkable");
    setLaborPerSquare(DEFAULTS.laborPerSquare);
    setTotalLabor("");
    setMargin(String(DEFAULTS.margin));
    setDisposalOverride("");
    setShowDisposalAdvanced(false);
  }, []);

  const loadExample = useCallback(() => {
    setArea(EXAMPLE.area);
    setWaste(EXAMPLE.waste);
    setBundlesPerSquare(EXAMPLE.bundlesPerSquare);
    setBundleCost(EXAMPLE.bundleCost);
    setLaborMode("guided");
    setGuidedLaborBasePerSquare(Number(EXAMPLE.laborPerSquare) || DEFAULT_GUIDED_BASE_PER_SQ);
    setGuidedStories("one");
    setGuidedWalkable("walkable");
    setLaborCostRaw("");
    setLaborCost(0);
    setMargin(EXAMPLE.margin);
  }, []);

  const spring = useSpring(0, { stiffness: 45, damping: 28 });
  const [displayPrice, setDisplayPrice] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [estimateCount, setEstimateCount] = useState(0);

  const initialPresetAppliedRef = useRef(false);
  const hasMountedRef = useRef(false);

  const {
    areaNum,
    wasteNum,
    bundlesPerSquareNum,
    bundleCostNum,
    laborPerSquareNum,
    totalLaborNum,
    marginNum,
    hasArea,
    hasLaborInput,
    hasMonetaryInputs,
    marginInvalid,
    canCompute,
    divisor,
    squares,
    adjustedSquares,
    bundles,
    materialsCost,
    laborCostEffective,
    impliedLaborPerSquare,
    guidedBreakdown,
    guidedLaborTotal,
    guidedBaseLabor,
    guidedTotalMultiplier,
    showDash,
    weightPerSquare,
    debrisWeightLbs,
    debrisTons,
    dumpFeeNum,
    debrisEnabled,
    debrisRemovalCost,
    effectiveDebrisRemovalCost,
    subtotal,
    priceWithMargin,
    suggestedPriceDisplay,
  } = useMemo(() => {
    const areaNum = parseFloat(area) || 0;
    const wasteNum = clampNonNegative(parseFloat(waste) ?? DEFAULTS.waste);
    const bundlesPerSquareNum = clampNonNegative(
      parseFloat(bundlesPerSquare) || DEFAULTS.bundlesPerSquare
    );
    const bundleCostNum = clampNonNegative(parseFloat(bundleCost) || 0);
    const laborPerSquareNum = clampNonNegative(parseFloat(laborPerSquare) || 0);
    const totalLaborNum = clampNonNegative(parseFloat(totalLabor) || 0);
    const marginNum = clampNonNegative(parseFloat(margin) ?? DEFAULTS.margin);

    const hasArea = areaNum > 0;
    const hasLaborInput =
      laborMode === "manual"
        ? (laborCostRaw.trim() !== "" || laborCost > 0)
        : (hasArea && guidedLaborBasePerSquare >= 0);
    const hasMonetaryInputs =
      (bundleCost.trim() !== "" || bundleCostNum > 0) && hasLaborInput;
    const marginInvalid = marginNum >= 100;

    const canCompute = hasArea && hasMonetaryInputs && !marginInvalid;
    const divisor = 1 - marginNum / 100;

    const squares = hasArea ? areaNum / 100 : 0;
    const adjustedSquares = squares * (1 + wasteNum / 100);
    const billableSquares = adjustedSquares ?? squares ?? 0;
    const rawBundles = adjustedSquares * bundlesPerSquareNum;
    const bundles = Math.ceil(rawBundles);
    const materialsCost = canCompute ? bundles * bundleCostNum : 0;

    const guidedBaseLabor = Math.round(billableSquares * guidedLaborBasePerSquare);
    const { breakdown: guidedBreakdown, totalMultiplier: guidedTotalMultiplier, totalLabor: guidedLaborTotal } =
      buildGuidedLaborBreakdown(guidedBaseLabor, guidedStories, guidedWalkable, { twoStoryAdjPct, threePlusAdjPct, steepAdjPct });

    const laborCostEffective =
      laborMode === "guided"
        ? (canCompute ? guidedLaborTotal : 0)
        : (laborMode === "manual" ? laborCost : 0);

    const impliedLaborPerSquare =
      adjustedSquares > 0 ? laborCostEffective / adjustedSquares : 0;

    const showDash = !hasMonetaryInputs || marginInvalid;

    const weightPerSquare = DEBRIS_WEIGHT_PER_SQ[removalType];
    const debrisWeightLbs = adjustedSquares * weightPerSquare;
    const debrisTons = debrisWeightLbs / 2000;
    const dumpFeeNum = parseFloat(dumpFeePerTon) || 0;
    const debrisEnabled = includeDebrisRemoval && dumpFeeNum > 0;
    const debrisRemovalCost = debrisEnabled ? debrisTons * dumpFeeNum : 0;
    const disposalOverrideNum = parseFloat(disposalOverride);
    const useDisposalOverride = disposalOverride.trim() !== "" && !Number.isNaN(disposalOverrideNum) && disposalOverrideNum >= 0;
    const effectiveDebrisRemovalCost = debrisEnabled
      ? (useDisposalOverride ? disposalOverrideNum : debrisRemovalCost)
      : 0;

    const subtotal = materialsCost + laborCostEffective + effectiveDebrisRemovalCost;
    const priceWithMargin =
      canCompute && divisor > 0 ? subtotal / divisor : 0;
    const suggestedPriceDisplay = showDash
      ? "—"
      : formatCurrency(priceWithMargin);

    return {
      areaNum,
      wasteNum,
      bundlesPerSquareNum,
      bundleCostNum,
      laborPerSquareNum,
      totalLaborNum,
      marginNum,
      hasArea,
      hasLaborInput,
      hasMonetaryInputs,
      marginInvalid,
      canCompute,
      divisor,
      squares,
      adjustedSquares,
      bundles,
      materialsCost,
      laborCostEffective,
      impliedLaborPerSquare,
      guidedBreakdown,
      guidedLaborTotal,
      guidedBaseLabor,
      guidedTotalMultiplier,
      showDash,
      weightPerSquare,
      debrisWeightLbs,
      debrisTons,
      dumpFeeNum,
      debrisEnabled,
      debrisRemovalCost,
      effectiveDebrisRemovalCost,
      subtotal,
      priceWithMargin,
      suggestedPriceDisplay,
    };
  }, [
    area,
    waste,
    bundlesPerSquare,
    bundleCost,
    laborMode,
    laborCostRaw,
    laborCost,
    guidedLaborBasePerSquare,
    guidedStories,
    guidedWalkable,
    twoStoryAdjPct,
    threePlusAdjPct,
    steepAdjPct,
    laborPerSquare,
    totalLabor,
    margin,
    includeDebrisRemoval,
    removalType,
    dumpFeePerTon,
    disposalOverride,
  ]);

  useEffect(() => {
    if (laborMode !== "guided") return;
    setLaborCost(guidedLaborTotal);
  }, [laborMode, guidedLaborTotal]);

  useEffect(() => {
    try {
      const pref = typeof window !== "undefined" ? localStorage.getItem(LABOR_MODE_KEY) : null;
      if (pref === "manual" || pref === "guided") setLaborMode(pref);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      localStorage.setItem(LABOR_MODE_KEY, laborMode);
    } catch {
      /* ignore */
    }
  }, [laborMode]);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(GUIDED_LABOR_DEFAULTS_KEY) : null;
      if (!raw) return;
      const parsed = JSON.parse(raw) as { basePerSq?: number; twoStoryPct?: number; threePlusPct?: number; steepPct?: number };
      if (typeof parsed.basePerSq === "number") setGuidedLaborBasePerSquare(clampInt(parsed.basePerSq, BASE_PER_SQ_MIN, BASE_PER_SQ_MAX));
      if (typeof parsed.twoStoryPct === "number") setTwoStoryAdjPct(clampInt(parsed.twoStoryPct, ADJ_PCT_MIN, ADJ_PCT_MAX));
      if (typeof parsed.threePlusPct === "number") setThreePlusAdjPct(clampInt(parsed.threePlusPct, ADJ_PCT_MIN, ADJ_PCT_MAX));
      if (typeof parsed.steepPct === "number") setSteepAdjPct(clampInt(parsed.steepPct, ADJ_PCT_MIN, ADJ_PCT_MAX));
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      localStorage.setItem(
        GUIDED_LABOR_DEFAULTS_KEY,
        JSON.stringify({
          basePerSq: guidedLaborBasePerSquare,
          twoStoryPct: twoStoryAdjPct,
          threePlusPct: threePlusAdjPct,
          steepPct: steepAdjPct,
        })
      );
    } catch {
      /* ignore */
    }
  }, [guidedLaborBasePerSquare, twoStoryAdjPct, threePlusAdjPct, steepAdjPct]);

  const switchToManual = useCallback(() => {
    setLaborMode("manual");
    if (manualLaborBackup > 0) setLaborCost(manualLaborBackup);
  }, [manualLaborBackup]);

  const switchToGuided = useCallback(() => {
    setManualLaborBackup(laborCost ?? 0);
    setLaborMode("guided");
  }, [laborCost]);

  const resetGuidedDefaults = useCallback(() => {
    setGuidedLaborBasePerSquare(DEFAULT_GUIDED_BASE_PER_SQ);
    setTwoStoryAdjPct(DEFAULT_TWO_STORY_PCT);
    setThreePlusAdjPct(DEFAULT_THREE_PLUS_PCT);
    setSteepAdjPct(DEFAULT_STEEP_PCT);
  }, []);

  const pricingInsights = useMemo(() => {
    return getPricingInsights({
      adjustedSquares,
      laborCost: laborCostEffective,
      materialsCost,
      tearOffEnabled: includeDebrisRemoval,
      tearOffAndDisposalCost: effectiveDebrisRemovalCost,
      suggestedPrice: priceWithMargin,
      marginPct: marginNum,
    });
  }, [
    adjustedSquares,
    laborCostEffective,
    materialsCost,
    includeDebrisRemoval,
    effectiveDebrisRemovalCost,
    priceWithMargin,
    marginNum,
  ]);

  // Estimate Review (quiet, non-blocking)
  // Rules:
  // - Hide entirely when the estimate is effectively empty (no pricing yet)
  // - Max 2 messages
  // - Only meaningful checks (no "scolding")
  const estimateReviewItems = useMemo(() => {
    const total = Number(priceWithMargin ?? 0);
    const materials = Number(materialsCost ?? 0);
    const labor = Number(laborCostEffective ?? 0);
    const disposal = Number(effectiveDebrisRemovalCost ?? 0);

    const isEmpty =
      (!Number.isFinite(total) || total <= 0) &&
      (!Number.isFinite(materials) || materials <= 0) &&
      (!Number.isFinite(labor) || labor <= 0) &&
      (!Number.isFinite(disposal) || disposal <= 0);

    if (isEmpty) return [];

    const items: { tone: "headsUp" | "fyi"; text: string }[] = [];

    // Meaningful checks only (keep it calm)
    if (includeDebrisRemoval && disposal <= 0) {
      items.push({
        tone: "headsUp",
        text: "Heads-up: Tear-off is on but disposal is $0.",
      });
    }

    if (total > 0 && materials <= 0) {
      items.push({
        tone: "headsUp",
        text: "Heads-up: Materials are $0 — confirm inputs.",
      });
    }

    if (total > 0 && labor <= 0) {
      items.push({
        tone: "fyi",
        text: "FYI: Labor is $0 — confirm you didn't miss labor.",
      });
    }

    if (Number.isFinite(subtotal) && subtotal > 0 && total > 0 && total < subtotal) {
      items.push({
        tone: "headsUp",
        text: "Heads-up: Total is below job cost — double-check pricing.",
      });
    }

    return items.slice(0, 2);
  }, [
    priceWithMargin,
    materialsCost,
    laborCostEffective,
    effectiveDebrisRemovalCost,
    includeDebrisRemoval,
    subtotal,
  ]);

  const canSave = canCompute;

  // AI Review: snapshot + rule-based result (client-safe, no hydration issues)
  const aiReviewResult = useMemo(() => {
    const snapshot = {
      zip: jobZip ?? "",
      roofAreaSqFt: areaNum,
      squares,
      adjustedSquares,
      bundles,
      materialsCost,
      laborCost: laborCostEffective,
      tearOffEnabled: debrisEnabled,
      tearOffTons: debrisTons,
      tearOffCost: effectiveDebrisRemovalCost,
      marginPct: marginNum,
      jobCostBeforeProfit: subtotal,
      suggestedPrice: priceWithMargin,
    };
    return getAIReview(snapshot);
  }, [
    jobZip,
    areaNum,
    squares,
    adjustedSquares,
    bundles,
    materialsCost,
    laborCostEffective,
    debrisEnabled,
    debrisTons,
    effectiveDebrisRemovalCost,
    marginNum,
    subtotal,
    priceWithMargin,
  ]);

  // Only call from click handlers (no render) to avoid hydration
  function makeProposalMeta(): { proposalNumber: string; proposalDate: string } {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const last4 = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
    const proposalNumber = `R-${y}${m}${day}-${last4}`;
    const proposalDate = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    return { proposalNumber, proposalDate };
  }

  // Single source of truth for proposal (used by summary, email, PDF)
  function getProposalData(metaOverride?: { proposalNumber: string; proposalDate: string }) {
    const numbers = getProposalNumbers();
    const zipFinal = (jobZip || "").toString().trim();
    return {
      customer: { name: customerName.trim(), email: customerEmail.trim(), phone: customerPhone.trim() },
      job: { address1: jobAddress1.trim(), city: jobCity.trim(), state: jobState.trim(), zip: zipFinal },
      meta: {
        proposalNumber: metaOverride?.proposalNumber ?? proposalNumber,
        proposalDate: metaOverride?.proposalDate ?? proposalDate,
        validDays,
      },
      numbers: { ...numbers, marginNum: Number(marginNum) || 0 },
      measurements: { squares: Number(squares) || 0, adjustedSquares: Number(adjustedSquares) || 0 },
      tier: roofingTier,
    };
  }

  function getProposalDataFromSnapshot(snapshot: SavedEstimateSnapshot) {
    const meta = makeProposalMeta();
    const materials = Number(snapshot.materialsCost ?? 0) || 0;
    const labor = Number(snapshot.laborCost ?? 0) || 0;
    const disposal = Number(snapshot.disposalCost ?? 0) || 0;
    const price = Number(snapshot.suggestedPrice) || 0;
    const jobCost = materials + labor + disposal || price;
    const tier = snapshot.selectedTier === "Core" ? "standard" : snapshot.selectedTier === "Enhanced" ? "enhanced" : "premium";
    return {
      customer: {
        name: (snapshot.customerName ?? "").trim(),
        email: (snapshot.customerEmail ?? "").trim(),
        phone: (snapshot.customerPhone ?? "").trim(),
      },
      job: {
        address1: (snapshot.jobAddress1 ?? "").trim(),
        city: (snapshot.jobCity ?? "").trim(),
        state: (snapshot.jobState ?? "").trim(),
        zip: (snapshot.jobZip ?? snapshot.zip ?? "").toString().trim(),
      },
      meta: { proposalNumber: meta.proposalNumber, proposalDate: meta.proposalDate, validDays },
      numbers: {
        price,
        materials,
        labor,
        disposal,
        jobCost,
        marginNum: Number(snapshot.margin) || 0,
      },
      measurements: {
        squares: Number(snapshot.squares ?? 0) || 0,
        adjustedSquares: Number(snapshot.adjustedSquares ?? 0) || 0,
      },
      tier: tier as "standard" | "enhanced" | "premium",
    };
  }

  // Internal summary (includes job cost & margin — for your own view only, not for customer)
  const buildInternalSummary = useCallback(
    (metaOverride?: { proposalNumber: string; proposalDate: string }) => {
      const data = getProposalData(metaOverride);
      const { customer, job, meta: m, numbers, measurements } = data;
      const { price, materials, labor, disposal, jobCost } = numbers;
      const margin = data.numbers.marginNum;
      const sq = measurements.squares;
      const adjSq = measurements.adjustedSquares;

      const scopeLines: string[] = [];
      scopeLines.push("• Install new roofing system (labor + materials)");
      if (disposal > 0) scopeLines.push("• Remove and dispose of existing roofing material (tear-off)");
      scopeLines.push("• Standard jobsite cleanup included");

      const notes: string[] = [];
      notes.push("• Estimate based on inputs provided. Final price may change after onsite inspection.");
      notes.push("• Hidden damage (decking/rot) not included unless found during tear-off.");
      notes.push(`• This estimate is valid for ${validDays} days.`);

      const jobLine = [job.city, job.state, job.zip].filter(Boolean).join(", ");
      const sizeLine =
        adjSq > 0
          ? `Roof size: ${fmtNum(adjSq)} squares (adjusted)`
          : sq > 0
            ? `Roof size: ${fmtNum(sq)} squares`
            : "";

      const lines: string[] = [];
      lines.push("ROOFING ESTIMATE SUMMARY (INTERNAL)");
      lines.push(`Proposal #: ${m.proposalNumber || "(not set)"}`);
      lines.push(`Date: ${m.proposalDate || "(not set)"}`);
      lines.push("");
      lines.push(`Customer: ${customer.name || "(not provided)"}`);
      lines.push("");
      lines.push("Job Site:");
      lines.push(job.address1 || "(not provided)");
      if (jobLine) lines.push(jobLine);
      if (sizeLine) lines.push(sizeLine);
      lines.push("");
      lines.push("SCOPE");
      lines.push(...scopeLines);
      lines.push("");
      lines.push("BREAKDOWN");
      lines.push(`Materials: ${fmtMoney(materials)}`);
      lines.push(`Labor: ${fmtMoney(labor)}`);
      lines.push(`Tear-Off & Disposal: ${fmtMoney(disposal)}`);
      lines.push(`Job Cost (before profit): ${fmtMoney(jobCost)}`);
      lines.push(`Target Margin: ${fmtNum(margin)}%`);
      lines.push("");
      lines.push(`TOTAL ESTIMATE: ${fmtMoney(price)}`);
      lines.push("");
      lines.push("NOTES");
      lines.push(...notes);

      return lines.join("\n");
    },
    [
      priceWithMargin,
      materialsCost,
      laborCostEffective,
      effectiveDebrisRemovalCost,
      subtotal,
      marginNum,
      squares,
      adjustedSquares,
      jobZip,
      customerName,
      customerEmail,
      customerPhone,
      jobAddress1,
      jobCity,
      jobState,
      proposalNumber,
      proposalDate,
    ]
  );

  // Customer-facing summary (PDF / email / share) — no job cost or margin
  const buildClientSummary = useCallback(
    (metaOverride?: { proposalNumber: string; proposalDate: string }) => {
      const data = getProposalData(metaOverride);
      const { customer, job, meta: m, numbers, measurements } = data;
      const { price, materials, labor, disposal } = numbers;
      const sq = measurements.squares;
      const adjSq = measurements.adjustedSquares;

      const defaultPackageDesc = tierConfig[roofingTier].includes.join(", ");
      const defaultScheduleCta = "Contact us to schedule your installation.";
      const effectivePackageDesc = (useGptWording && gptPackageDescription?.trim()) ? gptPackageDescription.trim() : defaultPackageDesc;
      const effectiveScheduleCta = (useGptWording && gptScheduleCta?.trim()) ? gptScheduleCta.trim() : defaultScheduleCta;

      const scopeLines: string[] = [];
      scopeLines.push("• Install selected roofing system");
      if (disposal > 0) scopeLines.push("• Remove and dispose of existing roofing material (tear-off)");
      scopeLines.push("• Standard jobsite cleanup included");
      const uniqueScopeLines = Array.from(new Set(scopeLines));

      const notes: string[] = [];
      notes.push("• Estimate based on visible conditions at time of inspection.");
      notes.push(`• This estimate is valid for ${validDays} days.`);

      const jobLine = [job.city, job.state, job.zip].filter(Boolean).join(", ");
      const sizeLine =
        adjSq > 0
          ? `Roof size: ${fmtNum(adjSq)} squares (adjusted)`
          : sq > 0
            ? `Roof size: ${fmtNum(sq)} squares`
            : "";

      const validThroughDate = m.proposalDate
        ? (() => {
            const d = new Date(m.proposalDate);
            d.setDate(d.getDate() + validDays);
            return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
          })()
        : "";

      const lines: string[] = [];
      if (companyProfile.companyName.trim()) {
        lines.push(companyProfile.companyName.trim());
      }
      const contactParts = [companyProfile.phone.trim(), companyProfile.email.trim()].filter(Boolean);
      if (contactParts.length > 0) {
        lines.push(contactParts.join(" · "));
      }
      if (companyProfile.license.trim()) {
        lines.push(`License: ${companyProfile.license.trim()}`);
      }
      if (companyProfile.companyName.trim() || contactParts.length > 0 || companyProfile.license.trim()) {
        lines.push("");
      }
      lines.push("ROOFING ESTIMATE SUMMARY");
      lines.push(`Proposal #: ${m.proposalNumber || "(not set)"}`);
      lines.push(`Date: ${m.proposalDate || "(not set)"}`);
      if (validThroughDate) lines.push(`Valid through: ${validThroughDate}`);
      lines.push("");
      lines.push(`Customer: ${customer.name || "(not provided)"}`);
      lines.push("");
      lines.push("Job Site:");
      lines.push(job.address1 || "(not provided)");
      if (jobLine) lines.push(jobLine);
      if (sizeLine) lines.push(sizeLine);
      lines.push("");
      lines.push("SCOPE");
      lines.push(...uniqueScopeLines);
      lines.push("");
      lines.push(`Package: ${effectivePackageDesc}`);
      lines.push("");
      lines.push("BREAKDOWN");
      lines.push(`Materials: ${fmtMoney(materials)}`);
      lines.push(`Labor: ${fmtMoney(labor)}`);
      if (disposal > 0) lines.push(`Tear-Off & Disposal: ${fmtMoney(disposal)}`);
      lines.push("");
      lines.push(`TOTAL ESTIMATE: ${fmtMoney(price)}`);
      lines.push("");
      lines.push("NOTES");
      lines.push(...notes);
      lines.push("");
      lines.push(effectiveScheduleCta);

      return lines.join("\n");
    },
    [
      priceWithMargin,
      materialsCost,
      laborCostEffective,
      effectiveDebrisRemovalCost,
      subtotal,
      squares,
      adjustedSquares,
      jobZip,
      customerName,
      customerEmail,
      customerPhone,
      jobAddress1,
      jobCity,
      jobState,
      proposalNumber,
      proposalDate,
      roofingTier,
      companyProfile,
      useGptWording,
      gptPackageDescription,
      gptScheduleCta,
    ]
  );

  const deterministicPreview = useMemo(() => {
    const meta = proposalNumber && proposalDate ? { proposalNumber, proposalDate } : undefined;
    return buildClientSummary(meta);
  }, [buildClientSummary, proposalNumber, proposalDate]);

  const previewText = deterministicPreview;

  const handleGenerateSummary = useCallback(async () => {
    try {
      const label = tierLabelFromRoofingTier(roofingTier);
      const fav = getFavorite(label);
      if (fav?.locked) {
        setUseGptWording(true);
        setAiFavoriteLocked(true);
        showAiToast("Locked favorite — unlock to regenerate.");
        return;
      }
      setShowClientSummary(true);
      setIsGenerating(true);
      setGptError("");

      const meta = makeProposalMeta();
      setProposalNumber(meta.proposalNumber);
      setProposalDate(meta.proposalDate);

      setGptState("loading");
      const res = await fetch("/api/proposal/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: roofingTier,
          tierDetails: tierConfig[roofingTier],
          jobContext: {
            zip: (jobZip || "").trim(),
            hasAddress: Boolean((jobAddress1 || "").trim()),
            hasCustomerEmail: Boolean((customerEmail || "").trim()),
            roofAreaSqFt: Number(area || 0) || 0,
            squares: Number(squares || 0) || 0,
            adjustedSquares: Number(adjustedSquares || 0) || 0,
            pitch,
            stories,
            complexity,
            laborMode,
            tearOffEnabled: Boolean(includeDebrisRemoval),
            removalType: includeDebrisRemoval ? removalType : null,
            voiceTone: voiceTone || "professional",
            styleNotes: (voiceNotes || "").trim() || undefined,
            tierLabel: roofingTier === "standard" ? "Core" : roofingTier === "enhanced" ? "Enhanced" : "Premium",
            feedbackBias: getTierFeedbackBias(label) ?? null,
          },
        }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) throw new Error(data?.error ?? `Generate failed (HTTP ${res.status})`);

      const pd = String(data?.packageDescription ?? "").trim();
      const cta = String(data?.scheduleCta ?? "").trim();

      if (!pd || !cta) {
        throw new Error("Generate returned missing packageDescription or scheduleCta");
      }

      setGptPackageDescription(pd);
      setGptScheduleCta(cta);
      setDraftPackageDesc(pd);
      setDraftScheduleCta(cta);
      setUseGptWording(true);
      const label2 = tierLabelFromRoofingTier(roofingTier);
      const existing = getFavorite(label2);
      setAiFavoriteLocked(Boolean(existing?.locked));
      setCopyState("idle");
      setGptState("idle");
      try {
        if (typeof window !== "undefined") {
          sessionStorage.setItem(STORAGE_KEY_PACKAGE_DESC, pd);
          sessionStorage.setItem(STORAGE_KEY_SCHEDULE_CTA, cta);
        }
      } catch {
        /* ignore */
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setGptError(msg);
      setGptState("error");
    } finally {
      setIsGenerating(false);
    }
  }, [
    roofingTier,
    voiceTone,
    voiceNotes,
    area,
    squares,
    adjustedSquares,
    pitch,
    stories,
    complexity,
    laborMode,
    jobZip,
    jobAddress1,
    customerEmail,
    includeDebrisRemoval,
    removalType,
  ]);

  const onCopyClientSummary = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(previewText);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1200);
    } catch {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 1600);
    }
  }, [previewText]);

  // Proposal numbers for export/email (component-scoped helper)
  function getProposalNumbers() {
    const price = Number(priceWithMargin) || 0;
    const materials = Number(materialsCost) || 0;
    const labor = Number(laborCostEffective) || 0;
    const disposal = Number(effectiveDebrisRemovalCost) || 0;
    const jobCostRaw = Number(subtotal) || 0;
    const jobCost = jobCostRaw || materials + labor + disposal;
    return { price, materials, labor, disposal, jobCost };
  }

  const buildEmailTemplate = useCallback(
    (proposalSummary: string) => {
      const data = getProposalData();
      const { customer, job, numbers } = data;
      const { price, materials, labor, disposal } = numbers;
      const zipShow = (job.zip || "").toString().trim();
      const addressOrZip = (job.address1 || "").trim() || zipShow;

      const subject = `Roofing Estimate – ${addressOrZip || "Estimate"} – ${fmtMoney(price)}`;

      const jobAddressLine = [job.address1, [job.city, job.state, job.zip].filter(Boolean).join(", ")].filter(Boolean).join("\n");

      const optionalBreakdown =
        [materials, labor, disposal].some((n) => n > 0)
          ? `\nMaterials: ${fmtMoney(materials)}\nLabor: ${fmtMoney(labor)}\nTear-off/Disposal: ${fmtMoney(disposal)}\n`
          : "";

      const body = `Hi ${customer.name || "there"},

Attached is your roofing estimate for:
${jobAddressLine || "(job address)"}

Total Estimate: ${fmtMoney(price)}${optionalBreakdown}

Proposal Details:
${proposalSummary}

Next steps:
- To approve, please contact us to confirm scheduling.
- We'll confirm material color and start date after approval.
- Questions? Reply to this email or call/text.

Thanks,`;
      return { subject, body };
    },
    [
      priceWithMargin,
      materialsCost,
      laborCostEffective,
      effectiveDebrisRemovalCost,
      subtotal,
      jobZip,
      customerName,
      jobAddress1,
      jobCity,
      jobState,
    ]
  );

  async function generateProposalPdfBytes(
    overrideMeta?: { proposalNumber: string; proposalDate: string },
    dataOverride?: ReturnType<typeof getProposalData>
  ) {
    const meta = overrideMeta ?? (proposalNumber && proposalDate
      ? { proposalNumber, proposalDate }
      : makeProposalMeta());

    if (!dataOverride && !overrideMeta && (!proposalNumber || !proposalDate)) {
      setProposalNumber(meta.proposalNumber);
      setProposalDate(meta.proposalDate);
    }

    const summary = dataOverride ? "" : buildClientSummary(meta);

    const data = dataOverride ?? getProposalData(meta);
    const { customer, job, numbers, measurements } = data;
    const { price, materials, labor, disposal } = numbers;
    const adjSquares = measurements.adjustedSquares;
    const tierForPdf = dataOverride ? data.tier : roofingTier;
    const pageW = 612;
    const pageH = 792;
    const margin = 40;
    const contentW = pageW - margin * 2;

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    function wrap(
      text: string,
      f: { widthOfTextAtSize: (t: string, s: number) => number },
      size: number,
      maxW: number
    ): string[] {
      const words = text.split(/\s+/).filter(Boolean);
      if (words.length === 0) return [];
      const lines: string[] = [];
      let current = words[0];
      for (let i = 1; i < words.length; i++) {
        const test = current + " " + words[i];
        if (f.widthOfTextAtSize(test, size) <= maxW) current = test;
        else {
          lines.push(current);
          current = words[i];
        }
      }
      lines.push(current);
      return lines;
    }

    let page = pdfDoc.addPage([pageW, pageH]);
    let y = pageH - margin;
    const lineH = 12;
    const smallH = 10;

    // ----- Header -----
    const hasLogo = companyProfile.logoDataUrl && companyProfile.logoDataUrl.startsWith("data:image");
    const hasCompany = !!companyProfile.companyName.trim();
    const hasContact = !!(companyProfile.phone.trim() || companyProfile.email.trim());
    const hasLicense = !!companyProfile.license.trim();
    let logoW = 0;
    const logoMaxH = 40;

    if (hasLogo && companyProfile.logoDataUrl) {
      try {
        const match = companyProfile.logoDataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
        if (match) {
          const [, type, base64] = match;
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          if (type === "png") {
            const img = await pdfDoc.embedPng(bytes);
            const scale = logoMaxH / img.height;
            logoW = img.width * scale;
            const h = img.height * scale;
            page.drawImage(img, { x: margin, y: y - h, width: logoW, height: h });
          } else if (type === "jpeg" || type === "jpg") {
            const img = await pdfDoc.embedJpg(bytes);
            const scale = logoMaxH / img.height;
            logoW = img.width * scale;
            const h = img.height * scale;
            page.drawImage(img, { x: margin, y: y - h, width: logoW, height: h });
          }
        }
      } catch {
        logoW = 0;
      }
    }

    const headerX = margin + (logoW > 0 ? logoW + 12 : 0);
    let headerOff = 0;
    if (hasCompany) {
      page.drawText(companyProfile.companyName.trim(), {
        x: headerX,
        y: y - 14,
        size: 14,
        font: fontBold,
        color: rgb(0.08, 0.1, 0.14),
      });
      headerOff = 18;
    }
    if (hasContact) {
      const contactLine = [companyProfile.phone.trim(), companyProfile.email.trim()].filter(Boolean).join(" · ");
      page.drawText(contactLine, {
        x: headerX,
        y: y - headerOff - smallH,
        size: 10,
        font,
        color: rgb(0.2, 0.22, 0.28),
      });
      headerOff += smallH + 4;
    }
    if (hasLicense) {
      page.drawText(`License: ${companyProfile.license.trim()}`, {
        x: headerX,
        y: y - headerOff - smallH,
        size: 10,
        font,
        color: rgb(0.25, 0.27, 0.32),
      });
      headerOff += smallH + 4;
    }
    const headerHeight = logoW > 0 ? Math.max(logoMaxH, headerOff) : headerOff;
    y -= headerHeight + 10;
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageW - margin, y },
      thickness: 0.5,
      color: rgb(0.75, 0.76, 0.78),
    });
    y -= 14;

    // ----- Title + Meta -----
    page.drawText("ROOFING ESTIMATE", {
      x: margin,
      y,
      size: 18,
      font: fontBold,
      color: rgb(0.08, 0.1, 0.14),
    });
    const validThroughDate = (() => {
      const d = new Date(meta.proposalDate);
      if (Number.isNaN(d.getTime())) return "";
      d.setDate(d.getDate() + validDays);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    })();
    const metaLines = [
      `Proposal #: ${meta.proposalNumber}`,
      `Date: ${meta.proposalDate}`,
      validThroughDate ? `Valid Through: ${validThroughDate}` : "",
    ].filter(Boolean);
    const metaSize = 10;
    for (let i = 0; i < metaLines.length; i++) {
      const text = metaLines[i];
      const w = font.widthOfTextAtSize(text, metaSize);
      page.drawText(text, {
        x: pageW - margin - w,
        y: y - i * (metaSize + 2),
        size: metaSize,
        font,
        color: rgb(0.3, 0.32, 0.38),
      });
    }
    y -= Math.max(metaLines.length * (metaSize + 2), 22);

    // ----- Prepared For | Job Site (two columns) -----
    const prepLines: string[] = [];
    if (customer.name) prepLines.push(customer.name);
    if (customer.email) prepLines.push(customer.email);
    if (customer.phone) prepLines.push(customer.phone);
    const jobLines: string[] = [];
    if (job.address1) jobLines.push(job.address1);
    const cityStateZip = [job.city, job.state, job.zip].filter(Boolean).join(", ");
    if (cityStateZip) jobLines.push(cityStateZip);
    if (adjSquares > 0) jobLines.push(`Roof size: ${adjSquares.toFixed(2)} squares (adjusted)`);

    const colW = (contentW - 20) / 2;
    const boxFontSize = 10;
    const rightColX = margin + colW + 20;
    if (prepLines.length > 0 || jobLines.length > 0) {
      const startY = y;
      let leftY = y;
      let rightY = y;
      if (prepLines.length > 0) {
        page.drawText("Prepared For", {
          x: margin,
          y: leftY,
          size: 10,
          font: fontBold,
          color: rgb(0.2, 0.22, 0.28),
        });
        leftY -= lineH;
        for (const line of prepLines) {
          const parts = wrap(line, font, boxFontSize, colW);
          for (const p of parts) {
            page.drawText(p, { x: margin, y: leftY, size: boxFontSize, font, color: rgb(0.15, 0.17, 0.22) });
            leftY -= lineH;
          }
        }
      }
      if (jobLines.length > 0) {
        page.drawText("Job Site", {
          x: rightColX,
          y: rightY,
          size: 10,
          font: fontBold,
          color: rgb(0.2, 0.22, 0.28),
        });
        rightY -= lineH;
        for (const line of jobLines) {
          const parts = wrap(line, font, boxFontSize, colW);
          for (const p of parts) {
            page.drawText(p, { x: rightColX, y: rightY, size: boxFontSize, font, color: rgb(0.15, 0.17, 0.22) });
            rightY -= lineH;
          }
        }
      }
      y = Math.min(leftY, rightY) - 12;
    } else {
      y -= 8;
    }

    // ----- Pricing Summary -----
    const tierLabel =
      tierForPdf === "premium"
        ? "Premium Roofing System"
        : tierForPdf === "enhanced"
          ? "Enhanced Roofing System"
          : "Core Roofing System";
    const packageDescriptionText = dataOverride
      ? "Designed to provide durable, long-lasting protection for your home."
      : (useGptWording && gptPackageDescription?.trim()) ? gptPackageDescription.trim() : "Designed to provide durable, long-lasting protection for your home.";
    const packageDescriptionLines = wrap(packageDescriptionText, font, 10, contentW - 20);
    let pricingH = 10 + lineH + packageDescriptionLines.length * lineH + lineH * 2 + 4;
    if (disposal > 0) pricingH += lineH;
    const pricingBoxBottom = y - pricingH;
    page.drawRectangle({
      x: margin,
      y: pricingBoxBottom,
      width: contentW,
      height: pricingH,
      color: rgb(0.97, 0.975, 0.98),
    });
    y -= 10;
    page.drawText(`Roofing System: ${tierLabel}`, {
      x: margin + 8,
      y,
      size: 10,
      font,
      color: rgb(0.2, 0.22, 0.28),
    });
    y -= lineH;
    for (const ln of packageDescriptionLines) {
      page.drawText(ln, {
        x: margin + 8,
        y,
        size: 10,
        font,
        color: rgb(0.25, 0.27, 0.32),
      });
      y -= lineH;
    }
    page.drawText(`Materials: ${fmtMoney(materials)}`, {
      x: margin + 8,
      y,
      size: 10,
      font,
      color: rgb(0.2, 0.22, 0.28),
    });
    y -= lineH;
    page.drawText(`Labor: ${fmtMoney(labor)}`, {
      x: margin + 8,
      y,
      size: 10,
      font,
      color: rgb(0.2, 0.22, 0.28),
    });
    y -= lineH;
    if (disposal > 0) {
      page.drawText(`Tear-Off & Disposal: ${fmtMoney(disposal)}`, {
        x: margin + 8,
        y,
        size: 10,
        font,
        color: rgb(0.2, 0.22, 0.28),
      });
      y -= lineH;
    }
    y = pricingBoxBottom - 8;

    // ----- Scope -----
    page.drawText("Scope", {
      x: margin,
      y,
      size: 11,
      font: fontBold,
      color: rgb(0.2, 0.22, 0.28),
    });
    y -= lineH;
    const scopeBullets = [
      "Install selected roofing system",
      ...(disposal > 0 ? ["Remove and dispose of existing roofing material (tear-off)"] : []),
      "Standard jobsite cleanup included",
    ];
    const uniqueScopeBullets = Array.from(new Set(scopeBullets));
    for (const b of uniqueScopeBullets) {
      const lines = wrap(b, font, 10, contentW - 20);
      for (let i = 0; i < lines.length; i++) {
        const prefix = i === 0 ? "• " : "  ";
        page.drawText(prefix + lines[i], { x: margin + 4, y, size: 10, font, color: rgb(0.25, 0.27, 0.32) });
        y -= lineH;
      }
    }
    y -= 8;

    // ----- Notes -----
    page.drawText("Notes", {
      x: margin,
      y,
      size: 11,
      font: fontBold,
      color: rgb(0.2, 0.22, 0.28),
    });
    y -= lineH;
    const notesBullets = [
      "Estimate based on visible conditions at time of inspection.",
      "This estimate is valid for 30 days.",
    ];
    for (const b of notesBullets) {
      const lines = wrap(b, font, 10, contentW - 20);
      for (let i = 0; i < lines.length; i++) {
        const prefix = i === 0 ? "• " : "  ";
        page.drawText(prefix + lines[i], { x: margin + 4, y, size: 10, font, color: rgb(0.3, 0.32, 0.38) });
        y -= lineH;
      }
    }
    y -= 16;
    y -= 8;

    // ----- Bottom close (only TOTAL on page) -----
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageW - margin, y },
      thickness: 0.5,
      color: rgb(0.6, 0.62, 0.66),
    });
    y -= 24;
    page.drawText(`TOTAL: ${fmtMoney(price)}`, {
      x: margin,
      y,
      size: 24,
      font: fontBold,
      color: rgb(0.06, 0.08, 0.12),
    });
    y -= lineH + 14 + 5;
    const scheduleCtaText = dataOverride
      ? "To approve and schedule your installation, simply reply APPROVE to this email."
      : (useGptWording && gptScheduleCta?.trim()) ? gptScheduleCta.trim() : "To approve and schedule your installation, simply reply APPROVE to this email.";
    for (const ln of wrap(scheduleCtaText, font, 10, contentW)) {
      page.drawText(ln, { x: margin, y, size: 10, font, color: rgb(0.25, 0.27, 0.32) });
      y -= lineH;
    }
    const closeLine2 = "Questions? Reply to this email or call us directly.";
    for (const ln of wrap(closeLine2, font, 10, contentW)) {
      page.drawText(ln, { x: margin, y, size: 10, font, color: rgb(0.25, 0.27, 0.32) });
      y -= lineH;
    }

    const pdfBytes = await pdfDoc.save();
    const filename = `Roofing-Proposal-${meta.proposalNumber}.pdf`;
    return { pdfBytes, filename, meta };
  }

  async function getLockedPdfBytesForCurrentEstimate(): Promise<Uint8Array> {
    const { pdfBytes } = await generateProposalPdfBytes();
    return pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  }

  async function getLockedPdfBytesForSavedEstimate(snapshot: SavedEstimateSnapshot): Promise<Uint8Array> {
    const dataOverride = getProposalDataFromSnapshot(snapshot);
    const { pdfBytes } = await generateProposalPdfBytes(undefined, dataOverride);
    return pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  }

  const selectedTierLabel = roofingTier === "standard" ? "Core" : roofingTier === "enhanced" ? "Enhanced" : "Premium";

  const hasRoofArea = Number(area || 0) > 0;
  const hasAddressBasics = Boolean((jobZip || "").trim());
  const hasPrice = Number(priceWithMargin || 0) > 0;
  const hasCustomerEmail = Boolean((customerEmail || "").includes("@"));
  const hasAIWording = Boolean((gptPackageDescription || "").trim() && (gptScheduleCta || "").trim());

  const pingField = (field: "roofArea" | "customerEmail") => {
    setAttentionField(field);
    window.setTimeout(() => setAttentionField(null), 1200);
  };

  function formatPricePreview(n: number) {
    return `$${Math.round((n + Number.EPSILON) * 100) / 100}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  function buildEmailSubjectPreview(meta: { customerName?: string; selectedTier: "Core" | "Enhanced" | "Premium" }) {
    const name = (meta.customerName || "").trim() || "Customer";
    return `Roofing Estimate – ${name} – ${meta.selectedTier}`;
  }
  function buildEmailBodyPreview(meta: {
    customerName?: string;
    selectedTier: "Core" | "Enhanced" | "Premium";
    jobAddress1?: string;
    jobCity?: string;
    jobState?: string;
    jobZip?: string;
    suggestedPrice: number;
    packageDescription?: string;
    scheduleCta?: string;
    companyName?: string;
  }) {
    const customerName = (meta.customerName || "").trim() || "there";
    const lines: string[] = [];
    lines.push(`Hi ${customerName},`);
    lines.push("");
    lines.push(`Attached is your ${meta.selectedTier} roofing estimate.`);
    lines.push("");
    lines.push("Project Address:");
    const addrLine1 = (meta.jobAddress1 || "").trim();
    const city = (meta.jobCity || "").trim();
    const state = (meta.jobState || "").trim();
    const zip = (meta.jobZip || "").trim();
    const cityStateZip = [city, state, zip].filter(Boolean).join(", ");
    lines.push(addrLine1 || "(not provided)");
    lines.push(cityStateZip || "");
    lines.push("");
    lines.push("Total Investment:");
    lines.push(formatPricePreview(meta.suggestedPrice));
    lines.push("");
    lines.push("Scope Summary:");
    lines.push((meta.packageDescription || "").trim() || "(see attached PDF)");
    lines.push("");
    if ((meta.scheduleCta || "").trim()) {
      lines.push((meta.scheduleCta || "").trim());
      lines.push("");
    }
    lines.push("This estimate is valid for 30 days from the date issued.");
    lines.push("");
    lines.push("If you have any questions, feel free to reply directly to this email.");
    lines.push("");
    lines.push("Thank you,");
    const companyName = (meta.companyName || "").trim();
    lines.push(companyName || "");
    return lines.join("\n");
  }

  function markSavedEstimateStatus(id: string, status: "approved" | "scheduled" | "paid" | "estimate" | "sent") {
    try {
      if (typeof window === "undefined") return;
      const raw = localStorage.getItem("roofing_saved_estimates");
      const list: { id?: string; status?: string }[] = raw ? JSON.parse(raw) : [];
      const next = list.map((e: { id?: string; status?: string }) =>
        e.id === id ? { ...e, status } : e
      );
      localStorage.setItem("roofing_saved_estimates", JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  const currentLoadedSavedId = loadSavedId ?? (hasMounted ? getCurrentLoadedSavedId() : null) ?? null;
  const savedEstimates = hasMounted ? getSavedEstimates() : [];
  const currentSaved = savedEstimates.find((e) => e.id === currentLoadedSavedId);
  const isLocked =
    hasMounted &&
    (currentSaved?.status === "approved" ||
      currentSaved?.status === "scheduled" ||
      currentSaved?.status === "paid");
  const isApprovedLocked = currentSaved?.status === "approved";
  const isScheduledLocked = currentSaved?.status === "scheduled";

  function ensureSavedBeforeSend(): string {
    const snapshot = {
      status: "estimate" as const,
      customerName: String(customerName ?? ""),
      customerEmail: String(customerEmail ?? ""),
      customerPhone: String(customerPhone ?? ""),
      jobAddress1: String(jobAddress1 ?? ""),
      jobCity: String(jobCity ?? ""),
      jobState: String(jobState ?? ""),
      jobZip: String(jobZip ?? ""),
      address: String([jobAddress1, [jobCity, jobState, jobZip].filter(Boolean).join(", ")].filter(Boolean).join(", ") ?? ""),
      zip: String(jobZip ?? ""),
      roofAreaSqFt: Number(area || 0),
      selectedTier: (roofingTier === "standard" ? "Core" : roofingTier === "enhanced" ? "Enhanced" : "Premium") as "Core" | "Enhanced" | "Premium",
      suggestedPrice: Number(priceWithMargin ?? 0),
      area: String(area ?? ""),
      waste: String(waste ?? ""),
      bundlesPerSquare: String(bundlesPerSquare ?? ""),
      bundleCost: String(bundleCost ?? ""),
      laborPerSquare: laborMode === "guided" ? String(guidedLaborBasePerSquare) : String(Math.round(impliedLaborPerSquare * 100) / 100),
      margin: String(margin ?? ""),
      materialsCost: materialsCost,
      laborCost: laborCostEffective,
      disposalCost: effectiveDebrisRemovalCost,
      adjustedSquares: adjustedSquares,
      squares: squares,
      laborMode: laborMode === "guided" ? "guided" : "manual",
      manualLaborCost: laborMode === "manual" ? laborCostEffective : undefined,
      dumpFeePerTon: includeDebrisRemoval ? parseFloat(dumpFeePerTon) || undefined : undefined,
      tearOffEnabled: includeDebrisRemoval,
      removalType,
    };

    const activeId = loadSavedId ?? null;

    if (activeId) {
      return saveToEstimateStore(
        { ...snapshot, id: activeId, createdAt: new Date().toISOString() },
        { overwriteId: activeId }
      );
    }

    return saveToEstimateStore({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...snapshot,
    });
  }

  function failSend(msg: string) {
    setSendEstimateError(msg);
    setSendError(msg);
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  const handleSendEstimate = async () => {
    if (isSending) return;
    if (isLocked) {
      failSend("This is locked. Duplicate to revise.");
      return;
    }

    if (!customerEmail || !customerEmail.includes("@")) {
      failSend("Valid customer email required");
      pingField("customerEmail");
      return;
    }

    setSendEstimateError(null);
    setSendSuccess(false);
    setSendError("");

    const to = (customerEmail || "").trim();

    const savedEstimateId = ensureSavedBeforeSend();
    const savedSnapshot = getSavedEstimateById(savedEstimateId);

    try {
      setSendState("sending");
      setIsSending(true);

      const meta = savedSnapshot
        ? {
            customerName: (savedSnapshot.customerName || "").trim() || "there",
            customerEmail: (savedSnapshot.customerEmail || "").trim() || to,
            customerPhone: (savedSnapshot.customerPhone || "").trim() || undefined,
            addressLine1: (savedSnapshot.jobAddress1 || "").trim() || undefined,
            addressLine2: undefined,
            city: (savedSnapshot.jobCity || "").trim() || undefined,
            state: (savedSnapshot.jobState || "").trim() || undefined,
            zip: String(savedSnapshot.jobZip ?? savedSnapshot.zip ?? "").trim() || undefined,
            tier: savedSnapshot.selectedTier as "Core" | "Enhanced" | "Premium",
            totalPrice: Number(savedSnapshot.suggestedPrice) || 0,
            packageDescription: (gptPackageDescription || "").trim(),
            scheduleCta: (gptScheduleCta || "").trim(),
            companyName: (companyProfile?.companyName || "").trim() || undefined,
          }
        : {
            customerName: (customerName || "").trim() || "there",
            customerEmail: to,
            customerPhone: (customerPhone || "").trim() || undefined,
            addressLine1: (jobAddress1 || "").trim() || undefined,
            addressLine2: undefined,
            city: (jobCity || "").trim() || undefined,
            state: (jobState || "").trim() || undefined,
            zip: (jobZip || "").trim() || undefined,
            tier: selectedTierLabel as "Core" | "Enhanced" | "Premium",
            totalPrice: Number(priceWithMargin) || 0,
            packageDescription: (gptPackageDescription || "").trim(),
            scheduleCta: (gptScheduleCta || "").trim(),
            companyName: (companyProfile?.companyName || "").trim() || undefined,
          };

      const pdfBytes = savedSnapshot
        ? await getLockedPdfBytesForSavedEstimate(savedSnapshot)
        : await getLockedPdfBytesForCurrentEstimate();

      const data = await sendEstimateEmailWithPdf({
        to,
        meta,
        pdfBytes,
        pdfFilename: `Roofing-Estimate-${selectedTierLabel}.pdf`,
        savedEstimateId: savedEstimateId ?? undefined,
        contractorEmail: (companyProfile?.email || "").trim() || undefined,
      });

      if (!data?.success) {
        throw new Error("Send failed");
      }

      const approvalToken = data?.approvalToken;
      const sentAt = new Date().toISOString();
      if (approvalToken) {
        attachApprovalTokenAndMarkPending(savedEstimateId, approvalToken);
        updateSavedEstimate(savedEstimateId, { sentAt, sentToEmail: (to || "").trim() || undefined });
      } else {
        markSavedEstimateSent(savedEstimateId, { sentAt, sentToEmail: to || undefined });
      }
      setSendSuccess(true);
      setSendState("sent");
      setToast("Sent ✅");
      setTimeout(() => setToast(null), 2500);

      setTimeout(() => {
        router.push(`/tools/roofing/saved?flash=${encodeURIComponent(savedEstimateId!)}`);
      }, 800);
    } catch (e: any) {
      const msg = e?.message || "Failed to send estimate.";
      failSend(msg);
      setSendState("error");
    } finally {
      setIsSending(false);
      setSendState((s) => (s === "sending" ? "idle" : s));
    }
  };

  const previewSnapshot = loadSavedId ? getSavedEstimateById(loadSavedId) : null;
  const previewMeta = previewSnapshot
    ? {
        customerName: (previewSnapshot.customerName || "").trim() || "there",
        selectedTier: previewSnapshot.selectedTier as "Core" | "Enhanced" | "Premium",
        jobAddress1: (previewSnapshot.jobAddress1 || "").trim() || undefined,
        jobCity: (previewSnapshot.jobCity || "").trim() || undefined,
        jobState: (previewSnapshot.jobState || "").trim() || undefined,
        jobZip: String(previewSnapshot.jobZip ?? previewSnapshot.zip ?? "").trim() || undefined,
        suggestedPrice: Number(previewSnapshot.suggestedPrice) || 0,
        packageDescription: (gptPackageDescription || "").trim(),
        scheduleCta: (gptScheduleCta || "").trim(),
        companyName: (companyProfile?.companyName || "").trim() || undefined,
      }
    : {
        customerName: (customerName || "").trim() || "there",
        selectedTier: selectedTierLabel as "Core" | "Enhanced" | "Premium",
        jobAddress1: (jobAddress1 || "").trim() || undefined,
        jobCity: (jobCity || "").trim() || undefined,
        jobState: (jobState || "").trim() || undefined,
        jobZip: (jobZip || "").trim() || undefined,
        suggestedPrice: Number(priceWithMargin) || 0,
        packageDescription: (gptPackageDescription || "").trim(),
        scheduleCta: (gptScheduleCta || "").trim(),
        companyName: (companyProfile?.companyName || "").trim() || undefined,
      };

  const handlePreviewPdf = async () => {
    try {
      setIsPreviewingPdf(true);
      const toId = loadSavedId ?? null;
      const snap = toId ? getSavedEstimateById(toId) : null;
      const pdfBytes = snap
        ? await getLockedPdfBytesForSavedEstimate(snap)
        : await getLockedPdfBytesForCurrentEstimate();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
      setPreviewPdfUrl(url);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      console.error(e);
    } finally {
      setIsPreviewingPdf(false);
    }
  };

  useEffect(() => {
    return () => {
      if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
    };
  }, [previewPdfUrl]);

  useEffect(() => {
    const id = typeof window !== "undefined" ? sessionStorage.getItem("ttai_autoSendEstimateId") : null;
    if (!id) return;

    sessionStorage.removeItem("ttai_autoSendEstimateId");

    (async () => {
      try {
        const list = getSavedEstimates();
        const match = list.find((e) => e.id === id);
        if (!match) return;

        const email = (match.customerEmail || "").trim();
        if (!email || !email.includes("@")) return;

        setCustomerName(match.customerName || "");
        setCustomerEmail(match.customerEmail || "");
        setCustomerPhone(match.customerPhone || "");
        setJobAddress1(match.jobAddress1 || "");
        setJobCity(match.jobCity || "");
        setJobState(match.jobState || "");
        setJobZip(match.jobZip || match.zip || "");
        setArea(match.area ?? String(Number(match.roofAreaSqFt || 0)));
        setWaste(match.waste ?? "");
        setBundlesPerSquare(match.bundlesPerSquare ?? "");
        setBundleCost(match.bundleCost ?? "");
        setLaborPerSquare(match.laborPerSquare ?? "");
        setMargin(match.margin ?? "");
        if (match.selectedTier === "Core") setRoofingTier("standard");
        if (match.selectedTier === "Enhanced") setRoofingTier("enhanced");
        if (match.selectedTier === "Premium") setRoofingTier("premium");

        setTimeout(() => {
          handleSendEstimate();
        }, 0);
      } catch (e) {
        console.error("Auto-send load failed:", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const autoSend = searchParams.get("autoSend") === "1";
    if (!autoSend) return;

    if (!loadSavedId) return;
    if (!loadAppliedRef.current) return;
    if (autoSendFiredRef.current) return;

    const email = (customerEmail || "").trim();
    if (!email || !email.includes("@")) return;

    autoSendFiredRef.current = true;

    setTimeout(async () => {
      await handleSendEstimate();

      // remove autoSend=1 so refresh doesn't resend
      const url = new URL(window.location.href);
      url.searchParams.delete("autoSend");
      router.replace(url.pathname + url.search);
    }, 50);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerEmail, loadSavedId, searchParams]);

  const generatePdfBase64 = async (overrideMeta?: { proposalNumber: string; proposalDate: string }) => {
    const { pdfBytes, meta } = await generateProposalPdfBytes(overrideMeta);
    const bytes = new Uint8Array(pdfBytes);
    const binary = String.fromCharCode.apply(null, Array.from(bytes));
    return { base64: btoa(binary), proposalNumber: meta.proposalNumber };
  };

  const onDownloadPdf = async () => {
    setPdfError("");
    const total = Number(priceWithMargin) || 0;
    if (total <= 0) {
      setPdfError("Enter estimate values before exporting.");
      return;
    }
    const { pdfBytes, filename } = await generateProposalPdfBytes();
    const blob = new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const onSharePdf = async () => {
    setPdfError("");
    const total = Number(priceWithMargin) || 0;
    if (total <= 0) {
      setPdfError("Enter estimate values before exporting.");
      return;
    }
    try {
      const { pdfBytes, filename } = await generateProposalPdfBytes();
      const blob = new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
      const file = new File([blob], filename, { type: "application/pdf" });

      const title = "Roofing Proposal";
      const text = "Attached is your roofing estimate (PDF).";

      const nav = navigator as Navigator & {
        canShare?: (data: { files?: File[] }) => boolean;
        share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
      };
      if (nav?.canShare?.( { files: [file] }) && nav.share) {
        await nav.share({ files: [file], title, text });
        setSendState("idle");
        setSendError("");
        return;
      }

      // Fallback: download
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setSendState("error");
      setSendError("Sharing not supported on this device/browser — downloaded PDF instead.");
    } catch {
      setSendState("error");
      setSendError("Could not share PDF. Please try Download PDF.");
    }
  };

  const ensureEmailTemplate = useCallback(
    async (metaToUse: { proposalNumber: string; proposalDate: string }, summary: string) => {
      let subject = emailSubject;
      let body = emailBody;

      if (subject && body) {
        return { subject, body };
      }

      try {
        setEmailState("loading");

        const res = await fetch("/api/email/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            proposalText: summary,
            proposalData: getProposalData(metaToUse),
            companyProfile,
          }),
        });

        const data = await res.json();

        if (!res.ok) throw new Error("Email generation failed");

        setEmailSubject(data.subject);
        setEmailBody(data.body);
        setEmailState("idle");

        return { subject: data.subject, body: data.body };
      } catch {
        setEmailState("error");

        const fallbackSubject = `Roofing Estimate – ${metaToUse.proposalNumber}`;
        const fallbackBody = summary;

        setEmailSubject(fallbackSubject);
        setEmailBody(fallbackBody);

        return { subject: fallbackSubject, body: fallbackBody };
      }
    },
    [emailSubject, emailBody, companyProfile]
  );

  const onShowEmailTemplate = useCallback(async () => {
    const meta = makeProposalMeta();
    setProposalNumber(meta.proposalNumber);
    setProposalDate(meta.proposalDate);
    const summary = previewText;
    setShowClientSummary(true);
    setShowEmailTemplate(true);
    setCopyEmailSubjectState("idle");
    setCopyEmailBodyState("idle");

    if (useGptWording) {
      setEmailState("loading");
      try {
        const res = await fetch("/api/email/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            proposalText: summary,
            proposalData: getProposalData(meta),
            companyProfile,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Request failed");
        if (typeof data?.subject !== "string" || typeof data?.body !== "string") throw new Error("Invalid response");
        setEmailSubject(data.subject);
        setEmailBody(data.body);
        setEmailState("idle");
      } catch {
        setEmailState("error");
        const { subject, body } = buildEmailTemplate(summary);
        setEmailSubject(subject);
        setEmailBody(body);
      }
    } else {
      setEmailState("idle");
      const { subject, body } = buildEmailTemplate(summary);
      setEmailSubject(subject);
      setEmailBody(body);
    }
  }, [previewText, buildEmailTemplate, useGptWording, companyProfile]);

  const onCopyEmailSubject = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(emailSubject);
      setCopyEmailSubjectState("copied");
      window.setTimeout(() => setCopyEmailSubjectState("idle"), 1200);
    } catch {
      setCopyEmailSubjectState("error");
      window.setTimeout(() => setCopyEmailSubjectState("idle"), 1600);
    }
  }, [emailSubject]);

  const onCopyEmailBody = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(emailBody);
      setCopyEmailBodyState("copied");
      window.setTimeout(() => setCopyEmailBodyState("idle"), 1200);
    } catch {
      setCopyEmailBodyState("error");
      window.setTimeout(() => setCopyEmailBodyState("idle"), 1600);
    }
  }, [emailBody]);

  const onSendEstimate = useCallback(async () => {
    try {
      setSendError("");
      setSendState("sending");

      const to = (customerEmail || "").trim();
      if (!to || !to.includes("@") || !to.includes(".")) {
        setSendState("error");
        setSendError("Enter a valid customer email to send.");
        return;
      }

      let metaToUse: { proposalNumber: string; proposalDate: string } = { proposalNumber, proposalDate };

      if (!proposalNumber || !proposalDate) {
        const meta = makeProposalMeta();
        setProposalNumber(meta.proposalNumber);
        setProposalDate(meta.proposalDate);
        metaToUse = meta;
      }

      const summary = previewText;

      const { subject, body } = await ensureEmailTemplate(metaToUse, summary);

      const { base64: pdfBase64, proposalNumber: pn } = await generatePdfBase64(metaToUse);
      const fileName = `Roofing-Proposal-${pn}.pdf`;

      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          subject,
          bodyText: body,
          pdfBase64,
          pdfFilename: fileName,
        }),
      });

      const data = await res.json();
      if (!res.ok || data?.success === false) {
        const errMsg =
          typeof data?.error === "string" ? data.error : "Send failed";
        throw new Error(errMsg);
      }

      setSendState("sent");
      setTimeout(() => setSendState("idle"), 2500);
    } catch (e: unknown) {
      setSendState("error");
      setSendError(e instanceof Error ? e.message : "Failed to send. Check email settings.");
    }
  }, [
    customerEmail,
    proposalNumber,
    proposalDate,
    previewText,
    ensureEmailTemplate,
  ]);

  const prevLaborCostRef = useRef<number | null>(null);
  useEffect(() => {
    if (prevLaborCostRef.current !== null && prevLaborCostRef.current !== laborCostEffective) {
      setLaborFlash(true);
      const t = setTimeout(() => setLaborFlash(false), 800);
      return () => clearTimeout(t);
    }
    prevLaborCostRef.current = laborCostEffective;
  }, [laborCostEffective]);

  const tryApplyZipPreset = useCallback((zipOverride?: string) => {
    const z = zipOverride !== undefined ? zipOverride : jobZip;
    if (z.length !== 5) return;
    setStoredLastZip(z);
    const preset = getZipPresetFromState(z, zipPresets);
    if (preset) {
      setPreAutofillSnapshot(captureSnapshot());
      applyPreset(preset);
      setAutofillFromZip(true);
      setZipNoPresetMessage(false);
    } else {
      setZipNoPresetMessage(true);
      setAutofillFromZip(false);
      setPreAutofillSnapshot(null);
    }
  }, [jobZip, zipPresets, captureSnapshot, applyPreset]);

  useEffect(() => {
    setHasMounted(true);
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY_ZIP_PRESETS) : null;
      const parsed = raw ? (JSON.parse(raw) as ZipPresetsMap) : null;
      setZipPresets(typeof parsed === "object" && parsed !== null ? parsed : {});
    } catch {
      setZipPresets({});
    }
    if (typeof window !== "undefined" && !isRestoringRef.current) {
      setJobZip(getStoredLastZip());
      setLaborModeState(getStoredLaborMethod());
    }
  }, []);

  useEffect(() => {
    if (isRestoringRef.current) return;
    if (typeof window === "undefined") return;
    const s = getStoredDebrisSettings();
    setIncludeDebrisRemoval(s.includeDebrisRemoval);
    setRemovalType(s.removalType);
    setDumpFeePerTon(s.dumpFeePerTon > 0 ? String(s.dumpFeePerTon) : "");
    setHelpSeenDebrisState(getHelpSeenDebris());
  }, [restoreTick]);

  useEffect(() => {
    // Block during restore window
    if (isRestoringRef?.current) return;

    // Block on first mount
    if (!hasMountedRef.current) {
      return;
    }

    // 🔥 Only run recalculation logic here
    // DO NOT call setArea() inside this effect.
    // Area should be source-of-truth, not rewritten.

    // Example pattern:
    // const computedSquares = ...
    // setSquares(computedSquares)
    // setAdjustedSquares(...)
    // setBundles(...)

    // ❗ IMPORTANT:
    // Make sure nothing inside here writes back to area itself.
  }, [area]);

  useEffect(() => {
    hasMountedRef.current = true;
  }, []);

  useEffect(() => {
    if (jobZip.length === 5) setStoredLastZip(jobZip);
  }, [jobZip]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload: DebrisSettings = {
      includeDebrisRemoval,
      removalType,
      dumpFeePerTon: parseFloat(dumpFeePerTon) || 0,
    };
    localStorage.setItem(STORAGE_KEY_DEBRIS, JSON.stringify(payload));
  }, [includeDebrisRemoval, removalType, dumpFeePerTon]);

  const markHelpSeenDebris = useCallback(() => {
    setHelpSeenDebrisState(true);
    setHelpSeenDebris();
  }, []);

  const presetForCurrentZip = hasMounted && zipPresets ? getZipPresetFromState(jobZip, zipPresets) : null;

  const saveToSavedEstimates = useCallback(() => {
    const addressLine = [jobAddress1, [jobCity, jobState, jobZip].filter(Boolean).join(", ")].filter(Boolean).join(", ");
    const selectedTier = roofingTier === "standard" ? "Core" : roofingTier === "enhanced" ? "Enhanced" : "Premium";
    const effectiveLaborPerSquare = laborMode === "guided" ? String(guidedLaborBasePerSquare) : String(Math.round(impliedLaborPerSquare * 100) / 100);
    saveToEstimateStore({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      customerName: String(customerName ?? ""),
      customerEmail: String(customerEmail ?? ""),
      customerPhone: String(customerPhone ?? ""),
      address: String(addressLine ?? ""),
      zip: String(jobZip ?? ""),
      jobAddress1: String(jobAddress1 ?? ""),
      jobCity: String(jobCity ?? ""),
      jobState: String(jobState ?? ""),
      jobZip: String(jobZip ?? ""),
      roofAreaSqFt: Number(area || 0),
      selectedTier,
      suggestedPrice: Number(priceWithMargin ?? 0),
      area: String(area ?? ""),
      waste: String(waste ?? ""),
      bundlesPerSquare: String(bundlesPerSquare ?? ""),
      bundleCost: String(bundleCost ?? ""),
      laborPerSquare: effectiveLaborPerSquare,
      margin: String(margin ?? ""),
      status: "estimate",
      laborMode: laborMode === "guided" ? "guided" : "manual",
      manualLaborCost: laborMode === "manual" ? laborCostEffective : undefined,
      dumpFeePerTon: includeDebrisRemoval ? parseFloat(dumpFeePerTon) || undefined : undefined,
      tearOffEnabled: includeDebrisRemoval,
      removalType,
    } as any);
  }, [customerName, customerEmail, customerPhone, jobAddress1, jobCity, jobState, jobZip, roofingTier, area, priceWithMargin, waste, bundlesPerSquare, bundleCost, laborMode, guidedLaborBasePerSquare, impliedLaborPerSquare, margin, laborCostEffective, includeDebrisRemoval, removalType, dumpFeePerTon]);

  const saveEstimate = useCallback(() => {
    if (isLocked) {
      setToast("This is locked. Duplicate to revise.");
      setTimeout(() => setToast(null), 2500);
      return;
    }
    if (!canSave || typeof window === "undefined") return;
    setIsSaving(true);
    const savedZipDefaults = saveAsZipDefaults && jobZip.length === 5;

    const estimate: RoofingEstimate = {
      id: `roof-${Date.now()}`,
      savedAt: Date.now(),
      area,
      waste,
      bundlesPerSquare,
      bundleCost,
      laborPerSquare: laborMode === "guided" ? String(guidedLaborBasePerSquare) : String(Math.round(impliedLaborPerSquare * 100) / 100),
      margin,
      squares,
      adjustedSquares: adjustedSquares,
      bundles,
      materialsCost,
      laborCost: laborCostEffective,
      subtotal,
      suggestedPrice: priceWithMargin,
    };
    const list = getStoredEstimates();
    list.unshift(estimate);
    localStorage.setItem(STORAGE_KEY_ESTIMATES, JSON.stringify(list));
    setEstimateCount(list.length);

    saveToSavedEstimates();

    if (savedZipDefaults) {
      const preset: ZipPreset = {
        updatedAt: new Date().toISOString(),
        inputs: {
          wastePct: wasteNum,
          bundlesPerSquare: bundlesPerSquareNum,
          bundleCost: bundleCostNum,
          laborMode: laborMode === "guided" ? "perSquare" : "total",
          laborPerSquare: laborMode === "guided" ? guidedLaborBasePerSquare : impliedLaborPerSquare,
          totalLabor: laborMode === "manual" ? laborCost : guidedLaborTotal,
          marginPct: marginNum,
        },
        debris: {
          enabled: Boolean(includeDebrisRemoval),
          tearOffType: removalType,
          dumpFeePerTon: includeDebrisRemoval ? dumpFeeNum : 0,
        },
      };
      const entry = { ...preset, updatedAt: new Date().toISOString() };
      setZipPresets((prev) => {
        const next = { ...(prev ?? {}), [jobZip]: entry };
        if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY_ZIP_PRESETS, JSON.stringify(next));
        return next;
      });
      setSaveAsZipDefaults(false);
    }

    setToast(savedZipDefaults ? "Saved + ZIP defaults ✅" : "Saved ✅");
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2500);
    setTimeout(() => setToast(null), 2500);
    setIsSaving(false);
  }, [
    isLocked,
    canSave,
    area,
    waste,
    bundlesPerSquare,
    bundleCost,
    margin,
    squares,
    adjustedSquares,
    bundles,
    materialsCost,
    laborCostEffective,
    subtotal,
    priceWithMargin,
    saveAsZipDefaults,
    jobZip,
    wasteNum,
    bundlesPerSquareNum,
    bundleCostNum,
    laborMode,
    laborCost,
    guidedLaborBasePerSquare,
    guidedLaborTotal,
    impliedLaborPerSquare,
    marginNum,
    includeDebrisRemoval,
    removalType,
    dumpFeeNum,
    saveToSavedEstimates,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setEstimateCount(getStoredEstimates().length);
  }, []);

  useEffect(() => {
    if (isRestoringRef.current) return;
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(STORAGE_KEY_LAST_LOADED);
    if (!raw) return;
    try {
      const loaded = JSON.parse(raw) as RoofingEstimate;
      localStorage.removeItem(STORAGE_KEY_LAST_LOADED);
      setArea(loaded.area ?? "");
      setWaste(String(loaded.waste ?? 10));
      setBundlesPerSquare(String(loaded.bundlesPerSquare ?? 3));
      setBundleCost(loaded.bundleCost ?? "");
      setLaborPerSquare(loaded.laborPerSquare ?? "");
      const loadedLabor = Number(loaded.laborCost ?? 0) || 0;
      setLaborCost(loadedLabor);
      setLaborCostRaw(loadedLabor ? String(Math.round(loadedLabor)) : "");
      setMargin(String(loaded.margin ?? 20));
    } catch {
      localStorage.removeItem(STORAGE_KEY_LAST_LOADED);
    }
  }, [restoreTick]);

  useEffect(() => {
    if (showDash) {
      spring.set(0);
      setDisplayPrice(0);
    } else {
      spring.set(priceWithMargin);
    }
  }, [priceWithMargin, showDash, spring]);

  useEffect(() => {
    if (!sendSuccess) return;
    const t = setTimeout(() => setSendSuccess(false), 4000);
    return () => clearTimeout(t);
  }, [sendSuccess]);

  useMotionValueEvent(spring, "change", (latest: number) => {
    setDisplayPrice(latest);
  });

  const animatedPriceDisplay = showDash
    ? "—"
    : formatCurrency(Math.round(displayPrice * 100) / 100);

  return (
    <main
      className="min-h-screen relative p-6 sm:p-8 lg:p-16 pb-24"
      style={{
        /* Layer (a): page background — lightened ~5–8% for breathable luxury, cards pop more */
        backgroundImage: `
          linear-gradient(180deg, #243347 0%, #1c2838 28%, #17202f 55%, #131c2a 82%, #121826 100%),
          repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(255,255,255,0.005) 2px, rgba(255,255,255,0.005) 3px),
          repeating-linear-gradient(90deg, transparent 0px, transparent 2px, rgba(255,255,255,0.005) 2px, rgba(255,255,255,0.005) 3px)
        `,
        backgroundSize: "100% 100%, 64px 64px, 64px 64px",
        backgroundColor: "#131c2a",
      }}
    >
      {/* Layer (a) accent: radial behind summary — smooth blend, no hard edge */}
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden"
        aria-hidden
      >
        <div className="absolute top-[40%] right-0 w-[90%] max-w-2xl h-[75%] bg-blue-600/[0.035] blur-[140px] rounded-full -translate-y-1/2" />
        <div className="absolute top-0 left-0 w-full h-96 bg-slate-600/12 blur-[100px]" />
      </div>

      {toast !== null && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed top-4 right-4 z-50 flex items-center gap-3 rounded-2xl border border-white/15 bg-slate-800/90 px-4 py-3 shadow-xl shadow-black/20 backdrop-blur-md"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400" aria-hidden>
            ✓
          </span>
          <span className="text-sm font-medium text-slate-100">{toast}</span>
        </motion.div>
      )}

      <div className="relative mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Link
            href="/tools"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white mb-12 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Tools
          </Link>
        </motion.div>

        <header className="mb-14 sm:mb-16">
          <motion.h1
            className="text-4xl md:text-5xl font-extrabold tracking-tight text-white/95 leading-[1.1]"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
          >
            Roofing Calculator
          </motion.h1>
          <motion.p
            className="mt-6 text-base md:text-lg text-slate-300 max-w-xl leading-[1.6]"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            Estimate materials, labor, and a suggested price with waste and
            profit margin.
          </motion.p>
        </header>

        {process.env.NODE_ENV !== "production" ? (
          <div className="text-xs text-white/60 mb-2">
            DEV: restoring = {String(isRestoringRef.current)} | loadSavedId = {String(loadSavedId ?? "—")}
          </div>
        ) : null}

        <RoofingTabs active="estimate" />

        {hasMounted && isLocked && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
            <span className="font-medium text-amber-200">
              {isScheduledLocked
                ? `Scheduled — locked${currentSaved?.scheduledStartDate ? ` (start ${currentSaved.scheduledStartDate})` : ""}`
                : "Approved — locked"}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const idToDup = currentLoadedSavedId ?? loadSavedId;
                  if (!idToDup) return;
                  setIsDuplicating(true);
                  const newId = duplicateSavedEstimate(idToDup);
                  if (!newId) {
                    setIsDuplicating(false);
                    return;
                  }
                  setCurrentLoadedSavedId(newId);
                  loadAppliedRef.current = false;
                  setToast("Revision created ✅");
                  setTimeout(() => setToast(null), 2500);
                  router.push(`/tools/roofing?loadSaved=${encodeURIComponent(newId)}`);
                  setIsDuplicating(false);
                }}
                disabled={isDuplicating}
                className="shrink-0 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isDuplicating ? "Duplicating…" : "Duplicate to Revise"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrentLoadedSavedId(null);
                  router.push("/tools/roofing");
                }}
                className="shrink-0 rounded-full bg-white/10 hover:bg-white/20 px-4 py-2 text-sm font-semibold text-amber-100 border border-amber-400/30"
              >
                New Estimate
              </button>
            </div>
          </div>
        )}

        <div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
          {/* Inputs card */}
          <motion.section
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            custom={0}
            className="rounded-3xl border border-white/[0.14] bg-white/[0.08] backdrop-blur-2xl p-8 sm:p-10 shadow-[0_8px_32px_-6px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,255,255,0.07)] transition-all duration-300 ease-out lg:hover:-translate-y-2 lg:hover:shadow-[0_24px_56px_-12px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.09)]"
            aria-labelledby="inputs-heading"
          >
            {/* Next steps */}
            <div className="mb-6 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <div className="text-sm font-semibold text-white/90 mb-3">Next steps</div>
              <div className="space-y-1.5 text-[11px] text-white/70">
                <div className="flex items-center justify-between gap-2">
                  <span>Job details</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${hasRoofArea && hasAddressBasics ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/60"}`}>
                    {hasRoofArea && hasAddressBasics ? "Done" : "Needed"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Pricing</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${hasPrice ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/60"}`}>
                    {hasPrice ? "Done" : "Needed"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>AI Assist (Optional)</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${hasAIWording ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/60"}`}>
                    {hasAIWording ? "Done" : "Optional"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Send</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${sendSuccess ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/60"}`}>
                    {sendSuccess ? "Done" : "Needed"}
                  </span>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-white/50">
                {!hasRoofArea ? "Start with roof area + ZIP." : !hasPrice ? "Finish pricing to unlock the suggested price." : "Optional: generate AI wording, then send."}
              </p>
              <button
                type="button"
                onClick={() => aiAssistRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="mt-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-white/70 hover:bg-white/10"
              >
                Go to AI Assist
              </button>
            </div>

            {/* Customer & Job */}
            <div id="customer-job-section" className="mb-6 rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              <div className="text-sm font-semibold text-white/90">Customer & Job</div>
              <div className="text-xs text-white/60 mt-0.5">These details appear on the proposal and email.</div>
              <form autoComplete="off" className="mt-4 space-y-3">
                <div className="space-y-1.5">
                  <label htmlFor="customer-name" className="block text-sm font-medium text-slate-300">Customer Name</label>
                  <input
                    id="customer-name"
                    name="customer_name_field"
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Full name"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    className="w-full rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-3 text-white/95 placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-blue-500/35 focus:border-white/25 text-sm"
                  />
                </div>
                <div className={"space-y-1.5" + (attentionField === "customerEmail" ? " rounded-2xl ring-2 ring-amber-400/30" : "")}>
                  <label htmlFor="customer-email" className="block text-sm font-medium text-slate-300">Customer Email</label>
                  <input
                    id="customer-email"
                    name="customer_email_field"
                    type="email"
                    inputMode="email"
                    value={customerEmail}
                    onChange={(e) => {
                      setCustomerEmail(e.target.value);
                      setSendError("");
                    }}
                    placeholder="email@example.com"
                    autoComplete="new-password"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    className="w-full rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-3 text-white/95 placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-blue-500/35 focus:border-white/25 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="customer-phone" className="block text-sm font-medium text-slate-300">Customer Phone (optional)</label>
                  <input
                    id="customer-phone"
                    name="customer_phone_field"
                    type="tel"
                    inputMode="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    className="w-full rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-3 text-white/95 placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-blue-500/35 focus:border-white/25 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="job-address" className="block text-sm font-medium text-slate-300">Job Address</label>
                  <input
                    id="job-address"
                    name="job_address1_field"
                    type="text"
                    value={jobAddress1}
                    onChange={(e) => setJobAddress1(e.target.value)}
                    placeholder="Street address"
                    autoComplete="new-password"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    className="w-full rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-3 text-white/95 placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-blue-500/35 focus:border-white/25 text-sm"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor="job-city" className="block text-sm font-medium text-slate-300">City</label>
                    <input
                      id="job-city"
                      name="job_city_field"
                      type="text"
                      value={jobCity}
                      onChange={(e) => setJobCity(e.target.value)}
                      placeholder="City"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      className="w-full rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-3 text-white/95 placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-blue-500/35 focus:border-white/25 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="job-state" className="block text-sm font-medium text-slate-300">State</label>
                    <input
                      id="job-state"
                      name="job_state_field"
                      type="text"
                      value={jobState}
                      onChange={(e) => setJobState(e.target.value)}
                      placeholder="State"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      className="w-full rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-3 text-white/95 placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-blue-500/35 focus:border-white/25 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="customer-job-zip" className="flex items-center gap-1.5 text-sm font-medium text-slate-300">
                      Job ZIP
                      <TooltipIcon id="tip-job-zip" text="Drives preset pricing and appears on proposal and PDF." />
                    </label>
                    <input
                      id="customer-job-zip"
                      name="job_zip_field"
                      type="text"
                      inputMode="numeric"
                      value={jobZip}
                      onChange={(e) => setJobZip(sanitizeZipInput(e.target.value))}
                      onBlur={() => {
                        const sanitized = sanitizeZipInput(jobZip);
                        if (sanitized !== jobZip) setJobZip(sanitized);
                        if (sanitized.length === 5) tryApplyZipPreset(sanitized);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const sanitized = sanitizeZipInput(jobZip);
                          if (sanitized !== jobZip) setJobZip(sanitized);
                          if (sanitized.length === 5) tryApplyZipPreset(sanitized);
                        }
                      }}
                      placeholder="e.g. 73102"
                      autoComplete="postal-code"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      className="w-full rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-3 text-white/95 placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-blue-500/35 focus:border-white/25 text-sm"
                    />
                    {autofillFromZip && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-emerald-400/90">Auto-filled from ZIP defaults</span>
                        {preAutofillSnapshot != null && (
                          <button
                            type="button"
                            onClick={undoAutofill}
                            className="text-xs font-medium text-blue-300 hover:text-blue-200 underline underline-offset-1"
                          >
                            Undo autofill
                          </button>
                        )}
                      </div>
                    )}
                    {zipNoPresetMessage && jobZip.length === 5 && (
                      <p className="text-xs text-slate-500">No defaults saved for this ZIP yet.</p>
                    )}
                    {jobZip.length === 5 && presetForCurrentZip != null && (
                      <button
                        type="button"
                        onClick={() => {
                          setZipPresets((prev) => {
                            if (!prev) return prev;
                            const next = { ...prev };
                            delete next[jobZip];
                            if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY_ZIP_PRESETS, JSON.stringify(next));
                            return next;
                          });
                          setZipClearedToast(true);
                          setTimeout(() => setZipClearedToast(false), 2500);
                          setAutofillFromZip(false);
                          setPreAutofillSnapshot(null);
                          setZipNoPresetMessage(true);
                        }}
                        className="text-xs font-medium text-slate-400 hover:text-slate-300 underline underline-offset-1"
                      >
                        Clear ZIP defaults
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </div>

            <h2
              id="inputs-heading"
              className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400 mb-10"
            >
              Job details
            </h2>

            <div className="mb-3 rounded-3xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-white/85">Company Profile</div>
                  <div className="text-xs text-white/55">Logo, phone, email, license</div>
                </div>
                <Link
                  href="/tools/settings"
                  className="rounded-full bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white/70 hover:bg-white/10"
                >
                  Edit
                </Link>
              </div>
            </div>

            <div className="space-y-6">
              <div className={attentionField === "roofArea" ? "rounded-2xl ring-2 ring-amber-400/30" : ""}>
                <InputField
                  id="area"
                  label="Roof area"
                  helper="Total footprint in square feet"
                  value={area ?? ""}
                  onChange={(v) => setArea(v.trim() === "" ? "" : String(Number(v) || 0))}
                  unitChip="sq ft"
                  icon={<Ruler className="h-4 w-4" />}
                  placeholder="e.g. 2400"
                />
              </div>
              {squares > 0 && (
                <p className="text-gray-400 text-sm mt-1">= {squares.toFixed(2)} squares</p>
              )}
              <InputField
                id="waste"
                label="Extra Materials (%)"
                helper="Extra shingles added to account for cuts and layout (default 10%)."
                value={waste}
                onChange={setWaste}
                unitChip="%"
                step="0.5"
                icon={<Percent className="h-4 w-4" />}
                labelTooltip="Extra for cuts and waste. 8–12% is typical."
                labelTooltipId="tip-waste"
              />
              <InputField
                id="bundleCost"
                label="Bundle cost"
                helper="Your supplier price per bundle."
                value={bundleCost}
                onChange={setBundleCost}
                unitChip="$"
                step="0.01"
                placeholder="0.00"
                icon={<DollarSign className="h-4 w-4" />}
                labelTooltip="What you pay per bundle from your supplier."
                labelTooltipId="tip-bundle-cost"
              />
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setShowAdvancedMaterials((prev) => !prev)}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-left text-sm font-medium text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                  <span>Advanced Materials (Optional)</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 transition-transform duration-200 ${showAdvancedMaterials ? "rotate-180" : ""}`}
                  />
                </button>
                {!showAdvancedMaterials && (
                  <p className="mt-1.5 text-xs text-slate-500">Bundles per square (default 3). Most jobs won&apos;t need changes.</p>
                )}
                <motion.div
                  initial={false}
                  animate={{ height: showAdvancedMaterials ? "auto" : 0, opacity: showAdvancedMaterials ? 1 : 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-slate-500">Most jobs won&apos;t need changes.</p>
                    <InputField
                      id="bundles"
                      label="Bundles per square"
                      helper="Most shingles: 3 bundles = 1 square (100 sq ft)."
                      value={bundlesPerSquare}
                      onChange={setBundlesPerSquare}
                      unitChip="per sq"
                      step="0.5"
                      icon={<Package className="h-4 w-4" />}
                      labelTooltip="One square = 100 sq ft. Change only if using different shingle type."
                      labelTooltipId="tip-bundles-per-sq"
                    />
                  </div>
                </motion.div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">Labor</div>
                    <div className="text-xs text-white/70">
                      {laborMode === "manual"
                        ? "Enter your real labor cost (app will not guess it)."
                        : "Guided labor is optional and fully explainable."}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={switchToManual}
                      className={`rounded-full px-3 py-1 text-xs ${laborMode === "manual" ? "bg-white/15 text-white" : "bg-white/5 text-white/70"}`}
                    >
                      Manual
                    </button>
                    <button
                      type="button"
                      onClick={switchToGuided}
                      className={`rounded-full px-3 py-1 text-xs ${laborMode === "guided" ? "bg-white/15 text-white" : "bg-white/5 text-white/70"}`}
                    >
                      Guided
                    </button>
                  </div>
                </div>

                {laborMode === "manual" ? (
                  <div className="mt-3">
                    <label className="text-xs text-white/70">Labor Cost</label>
                    <input
                      value={laborCostRaw}
                      onChange={(e) => {
                        const next = e.target.value;
                        if (/^[0-9]*$/.test(next)) setLaborCostRaw(next);
                      }}
                      onBlur={() => {
                        const n = laborCostRaw.trim() === "" ? 0 : Number(laborCostRaw);
                        const safe = Number.isFinite(n) ? Math.round(n) : 0;
                        setLaborCostRaw(safe ? String(safe) : "");
                        setLaborCost(safe);
                      }}
                      inputMode="numeric"
                      placeholder="e.g., 3500"
                      className="mt-1 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                    />
                    <div className="mt-2 text-xs text-white/60">
                      Used in total: <span className="text-white">{fmtMoney(laborCostEffective)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <label className="text-xs text-white/70">Base $ / Square (editable)</label>
                        <input
                          value={String(guidedLaborBasePerSquare)}
                          onChange={(e) => {
                            const next = e.target.value;
                            if (!/^[0-9]*$/.test(next)) return;
                            const n = next === "" ? 0 : Number(next);
                            setGuidedLaborBasePerSquare(clampInt(n, BASE_PER_SQ_MIN, BASE_PER_SQ_MAX));
                          }}
                          inputMode="numeric"
                          className="mt-1 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                        />
                        <div className="mt-1 text-xs text-white/60">
                          Base labor (before factors): <span className="text-white">{fmtMoney(guidedBaseLabor)}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-white/70">Stories</label>
                          <select
                            value={guidedStories}
                            onChange={(e) => setGuidedStories(e.target.value as GuidedStories)}
                            className="mt-1 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                          >
                            <option value="one">1 Story</option>
                            <option value="two">2 Story</option>
                            <option value="threePlus">3+ Story</option>
                          </select>
                          <div className="mt-1 text-xs text-white/60">
                            Adds: <span className="text-white">+{pctMultiplier(getStoriesMultiplier(guidedStories, { twoStoryAdjPct, threePlusAdjPct, steepAdjPct }))}%</span>
                          </div>
                          <div className="mt-2">
                            <label className="text-xs text-white/70">2-Story Adj (%)</label>
                            <input
                              value={String(twoStoryAdjPct)}
                              onChange={(e) => {
                                const next = e.target.value;
                                if (!/^[0-9]*$/.test(next)) return;
                                const n = next === "" ? 0 : Number(next);
                                setTwoStoryAdjPct(clampInt(n, ADJ_PCT_MIN, ADJ_PCT_MAX));
                              }}
                              inputMode="numeric"
                              className="mt-1 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                            />
                            <label className="mt-2 block text-xs text-white/70">3+ Story Adj (%)</label>
                            <input
                              value={String(threePlusAdjPct)}
                              onChange={(e) => {
                                const next = e.target.value;
                                if (!/^[0-9]*$/.test(next)) return;
                                const n = next === "" ? 0 : Number(next);
                                setThreePlusAdjPct(clampInt(n, ADJ_PCT_MIN, ADJ_PCT_MAX));
                              }}
                              inputMode="numeric"
                              className="mt-1 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-xs text-white/70">Walkability</label>
                          <select
                            value={guidedWalkable}
                            onChange={(e) => setGuidedWalkable(e.target.value as GuidedWalkable)}
                            className="mt-1 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                          >
                            <option value="walkable">Walkable</option>
                            <option value="steep">Steep</option>
                          </select>
                          <div className="mt-1 text-xs text-white/60">
                            Adds: <span className="text-white">+{pctMultiplier(getWalkableMultiplier(guidedWalkable, { twoStoryAdjPct, threePlusAdjPct, steepAdjPct }))}%</span>
                          </div>
                          <div className="mt-2">
                            <label className="text-xs text-white/70">Steep Adj (%)</label>
                            <input
                              value={String(steepAdjPct)}
                              onChange={(e) => {
                                const next = e.target.value;
                                if (!/^[0-9]*$/.test(next)) return;
                                const n = next === "" ? 0 : Number(next);
                                setSteepAdjPct(clampInt(n, ADJ_PCT_MIN, ADJ_PCT_MAX));
                              }}
                              inputMode="numeric"
                              className="mt-1 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs text-white/70">Explainable adjustments</div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-white/70">
                            Total factor: <span className="text-white">x{guidedTotalMultiplier.toFixed(2)}</span>
                          </span>
                          <button
                            type="button"
                            onClick={resetGuidedDefaults}
                            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/80 hover:bg-white/[0.06]"
                          >
                            Reset Guided Defaults
                          </button>
                        </div>
                      </div>

                      <div className="mt-2 space-y-1">
                        {guidedBreakdown.map((b) => (
                          <div key={b.label} className="flex items-center justify-between text-xs">
                            <div className="text-white/80">{b.label}</div>
                            <div className="text-white">
                              {b.pct === 0 ? "+0%" : `+${b.pct}%`}{" "}
                              <span className="text-white/70">({fmtMoney(b.delta)})</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="text-white/70">Base Labor</div>
                          <div className="text-white">{fmtMoney(guidedBaseLabor)}</div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-white/70">Adjustments Total</div>
                          <div className="text-white">{fmtMoney(guidedBreakdown.reduce((acc, b) => acc + (b.delta || 0), 0))}</div>
                        </div>
                        <div className="flex items-center justify-between border-t border-white/10 pt-2 text-sm">
                          <div className="text-white/80">Guided Labor Total</div>
                          <div className="text-white font-semibold">{fmtMoney(guidedLaborTotal)}</div>
                        </div>
                      </div>

                      <div className="mt-2 text-[11px] text-white/50">
                        Internal only (not shown to homeowner). Contractors can override anytime.
                      </div>
                    </div>
                  </div>
                )}

                {adjustedSquares > 0 && laborCostEffective === 0 && (
                  <p className="mt-2 text-sm text-amber-300/90">⚠ Labor is currently $0. Most jobs include labor cost.</p>
                )}
              </div>

              <div className="space-y-2">
                <InputField
                  id="margin"
                  label="Profit margin"
                  helper="Target margin on the job"
                  value={margin}
                  onChange={setMargin}
                  unitChip="%"
                  max={99}
                  step="0.5"
                  icon={<TrendingUp className="h-4 w-4" />}
                />
                {marginInvalid && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3"
                  >
                    <p className="text-xs text-amber-200/90">
                      Margin must be under 100%. Suggested price cannot be
                      calculated.
                    </p>
                  </motion.div>
                )}
              </div>

              {/* Tear-Off & Disposal — inline */}
              <div className="mt-8 pt-6 border-t border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400 flex items-center">
                      Tear-Off & Disposal (Old Roof Removal)
                      <TooltipIcon id="tip-debris-section" text="Cost to remove old shingles and dump fees." />
                    </h3>
                    <p className="text-gray-400 text-sm mt-1">Includes removal and landfill disposal of existing roofing material.</p>
                    <p className="text-xs text-slate-500 mt-1">We estimate tons from roof size and removal type. Use Advanced override if you already have a disposal quote.</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={includeDebrisRemoval}
                    onClick={() => {
                      setIncludeDebrisRemoval((v) => !v);
                      markHelpSeenDebris();
                    }}
                    className="relative h-6 w-11 shrink-0 rounded-full border border-white/20 bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 data-[state=checked]:bg-blue-500/40"
                    style={{ backgroundColor: includeDebrisRemoval ? "rgba(59, 130, 246, 0.4)" : undefined }}
                  >
                    <span
                      className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
                      style={{ transform: includeDebrisRemoval ? "translateX(1.25rem)" : "translateX(0)" }}
                    />
                  </button>
                </div>
                {includeDebrisRemoval && (
                  <>
                    {!helpSeenDebris && (
                      <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 flex items-start justify-between gap-2">
                        <p className="text-xs text-blue-200/90">Tip: If unsure, use Standard.</p>
                        <button
                          type="button"
                          onClick={markHelpSeenDebris}
                          className="shrink-0 text-xs font-medium text-blue-300 hover:text-blue-200"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                    <div className="space-y-4" onFocus={markHelpSeenDebris}>
                      <div className="space-y-2">
                        <label className="flex items-center text-sm font-medium text-slate-300">
                          Roof Type Being Removed
                          <TooltipIcon id="tip-removal-type" text="Choose Standard if unsure." />
                        </label>
                        <p className="text-xs text-slate-500">Architectural shingles weigh more than standard 3-tab.</p>
                        <select
                          value={removalType}
                          onChange={(e) => setRemovalType(e.target.value as DebrisRemovalType)}
                          className="w-full rounded-2xl border border-white/10 bg-white/[0.11] px-4 py-3 text-white/95 focus:outline-none focus:ring-2 focus:ring-blue-500/35 focus:border-blue-400/30 text-sm"
                        >
                          <option value="standard" className="bg-slate-800 text-white">Standard (most roofs)</option>
                          <option value="architectural" className="bg-slate-800 text-white">Architectural (heavier shingles)</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="flex items-center text-sm font-medium text-slate-300">
                          Landfill Rate ($ per ton)
                          <TooltipIcon id="tip-dump-fee" text="Found on your local landfill/transfer station rate sheet." />
                        </label>
                        <div className="flex rounded-2xl border border-white/10 bg-white/[0.11] focus-within:ring-2 focus-within:ring-blue-500/35">
                          <span className="flex items-center pl-4 text-slate-500 text-sm">$</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            value={dumpFeePerTon}
                            onChange={(e) => setDumpFeePerTon(e.target.value)}
                            placeholder="0"
                            className="min-w-0 flex-1 border-0 bg-transparent py-3 pr-4 pl-2 text-white/95 placeholder:text-white/35 focus:outline-none [appearance:textfield]"
                          />
                        </div>
                        {adjustedSquares > 0 && (
                          <p className="text-xs text-slate-500/70 mt-2">
                            Estimated tons: {debrisTons.toFixed(2)} (based on {adjustedSquares.toFixed(2)} squares × {weightPerSquare} lbs/sq ÷ 2000)
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => setShowDisposalAdvanced((prev) => !prev)}
                        className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-left text-sm font-medium text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      >
                        <span>Advanced (optional)</span>
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 transition-transform duration-200 ${showDisposalAdvanced ? "rotate-180" : ""}`}
                        />
                      </button>
                      <motion.div
                        initial={false}
                        animate={{ height: showDisposalAdvanced ? "auto" : 0, opacity: showDisposalAdvanced ? 1 : 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                          <label htmlFor="disposal-override" className="block text-sm font-medium text-slate-300">
                            Override disposal total ($)
                          </label>
                          <p className="text-xs text-slate-500">Use your own disposal quote instead of the calculated cost.</p>
                          <div className="flex rounded-2xl border border-white/10 bg-white/[0.08] focus-within:ring-2 focus-within:ring-blue-500/35">
                            <span className="flex items-center pl-4 text-slate-500 text-sm">$</span>
                            <input
                              id="disposal-override"
                              type="number"
                              inputMode="decimal"
                              min={0}
                              value={disposalOverride}
                              onChange={(e) => setDisposalOverride(e.target.value)}
                              placeholder="Leave empty for calculated"
                              className="min-w-0 flex-1 border-0 bg-transparent py-2.5 pr-4 pl-2 text-white/95 placeholder:text-white/35 focus:outline-none [appearance:textfield]"
                            />
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-white/80">Roofing System</label>
                <span className="text-xs px-2 py-0.5 rounded-full border border-white/10 bg-white/[0.06] text-white/70">
                  Selected: {roofingTier === "standard" ? "Core" : roofingTier === "enhanced" ? "Enhanced" : "Premium"}
                </span>
              </div>

              <div className="relative rounded-2xl border border-white/15 bg-white/[0.07] overflow-hidden focus-within:border-white/25">
                <div
                  className={
                    "absolute left-0 top-0 h-full w-1 " +
                    (roofingTier === "standard"
                      ? "bg-white/25"
                      : roofingTier === "enhanced"
                      ? "bg-white/35"
                      : "bg-white/45")
                  }
                />
                <select
                  value={roofingTier}
                  onChange={(e) => setRoofingTier(e.target.value as RoofingTier)}
                  className="w-full appearance-none bg-transparent px-3 py-3 pl-4 pr-10 text-sm text-white/90 outline-none"
                >
                  <option value="standard">Core Roofing System</option>
                  <option value="enhanced">Enhanced Roofing System</option>
                  <option value="premium">Premium Roofing System</option>
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/60">▾</div>
              </div>

              <p className="mt-1 text-xs text-white/55">
                This label appears on the proposal and PDF.
              </p>
            </div>

            {/* AI Assist (optional) */}
            <div ref={aiAssistRef} className="mt-4 rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              {/* ===============================
                  SMART PROPOSAL ASSIST
              ================================ */}

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 mt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      ✨ Smart Proposal Assist
                    </div>
                    <div className="text-xs text-white/60 mt-1">
                      AI enhances wording and closing CTA. Pricing is never modified.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAiPanel((v) => !v)}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white/80 hover:bg-white/[0.06]"
                  >
                    {showAiPanel ? "Hide" : "Customize"}
                  </button>
                </div>

                {/* Compact Preview (always visible if GPT wording exists) */}
                {useGptWording && gptPackageDescription && (
                  <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <div className="text-xs text-emerald-400 font-semibold mb-1">
                      ✔ AI Optimized
                    </div>
                    <div className="text-sm text-white/80 line-clamp-2">
                      {gptPackageDescription}
                    </div>
                  </div>
                )}

                {/* Expanded Customization */}
                {showAiPanel && (
                  <div className="mt-6 space-y-4">
                    <div>
                      <label className="text-xs text-white/50">Company Voice</label>
                      <select
                        value={voiceTone}
                        onChange={(e) => {
                          const t = e.target.value as VoiceTone;
                          setVoiceTone(t);
                          saveCompanyVoiceProfile({ tone: t, styleNotes: voiceNotes });
                        }}
                        className="mt-1 w-full rounded-lg bg-white/[0.04] border border-white/10 px-3 py-2 text-sm text-white"
                      >
                        <option value="friendly">Friendly</option>
                        <option value="professional">Professional</option>
                        <option value="direct">Direct</option>
                        <option value="premium">Premium</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (!hasPrice || !hasRoofArea) pingField("roofArea");
                        handleGenerateSummary();
                      }}
                      disabled={isGenerating}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isGenerating ? "Generating…" : "Generate AI Wording"}
                    </button>

                    {gptPackageDescription && (
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/80">
                        {gptPackageDescription}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {showClientSummary && (
                <div className="mt-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="text-xs text-white/60">Proposal Preview</div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowClientSummary(false)}
                        className="rounded-full bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white/70 hover:bg-white/10"
                      >
                        Hide
                      </button>
                      <button
                        type="button"
                        onClick={onCopyClientSummary}
                        disabled={!previewText.trim()}
                        className="rounded-full bg-blue-500/20 px-3 py-1.5 text-[11px] font-semibold text-blue-100 hover:bg-blue-500/25 disabled:opacity-40"
                      >
                        {copyState === "copied" ? "Copied" : copyState === "error" ? "Copy failed" : "Copy"}
                      </button>
                    </div>
                  </div>
                  <div className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    <div className="mb-2 text-xs text-white/60">
                      Source: {useGptWording && (gptPackageDescription || gptScheduleCta) ? "GPT" : "Deterministic"}
                    </div>

                    <textarea
                      value={previewText}
                      readOnly
                      className="w-full h-64 rounded-xl bg-black/20 text-white text-sm p-4 resize-none"
                    />
                  </div>
                </div>
              )}

              {showEmailTemplate && (
                <div className="mt-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-white/60">Email Template</div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowEmailTemplate(false)}
                        className="rounded-full bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white/70 hover:bg-white/10"
                      >
                        Hide
                      </button>
                      <button
                        type="button"
                        onClick={onCopyEmailSubject}
                        disabled={!emailSubject || emailState === "loading"}
                        className="rounded-full bg-blue-500/20 px-3 py-1.5 text-[11px] font-semibold text-blue-100 hover:bg-blue-500/25 disabled:opacity-40"
                      >
                        {copyEmailSubjectState === "copied" ? "Copied" : copyEmailSubjectState === "error" ? "Copy failed" : "Copy Subject"}
                      </button>
                      <button
                        type="button"
                        onClick={onCopyEmailBody}
                        disabled={!emailBody || emailState === "loading"}
                        className="rounded-full bg-blue-500/20 px-3 py-1.5 text-[11px] font-semibold text-blue-100 hover:bg-blue-500/25 disabled:opacity-40"
                      >
                        {copyEmailBodyState === "copied" ? "Copied" : copyEmailBodyState === "error" ? "Copy failed" : "Copy Body"}
                      </button>
                    </div>
                  </div>
                  {emailState === "loading" && (
                    <p className="mt-2 text-xs text-white/60">Generating email…</p>
                  )}
                  {emailState === "error" && (
                    <p className="mt-2 text-xs text-amber-300/90">Could not generate email wording. Using standard template.</p>
                  )}
                  <label className="mt-2 block text-[11px] text-white/50">Subject</label>
                  <textarea
                    readOnly
                    value={emailSubject}
                    rows={2}
                    className="mt-1 w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/80 focus:outline-none"
                  />
                  <label className="mt-2 block text-[11px] text-white/50">Body</label>
                  <textarea
                    readOnly
                    value={emailBody}
                    rows={12}
                    className="mt-1 w-full resize-none rounded-2xl border border-white/10 bg-black/20 p-4 text-xs leading-relaxed text-white/80 focus:outline-none"
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled
                      className="rounded-full bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white/40 cursor-not-allowed"
                    >
                      Attach PDF (coming soon)
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              {/* Step 4 — Confirm & Send (compact, premium) */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 mt-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      Step 4 — Confirm & Send
                    </div>
                    <div className="text-xs text-white/60 mt-1">
                      Quick review, then send the PDF estimate to your customer.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowSendDetails((v) => !v)}
                    className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white/80 hover:bg-white/[0.06]"
                  >
                    {showSendDetails ? "Hide details" : "Show details"}
                  </button>
                </div>

                {/* Ready-to-send summary (always visible) */}
                <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-white/80">
                    <div className="flex justify-between">
                      <span>Recipient</span>
                      <span className="text-white font-semibold">
                        {(customerEmail || "").trim() ? customerEmail : "Email missing"}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span>Project</span>
                      <span className="text-white font-semibold">
                        {[jobAddress1, [jobCity, jobState, jobZip].filter(Boolean).join(", ")].filter(Boolean).join(" — ") || "Address missing"}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span>Tier</span>
                      <span className="text-white font-semibold">
                        {roofingTier === "standard" ? "Core" : roofingTier === "enhanced" ? "Enhanced" : "Premium"}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span>Total</span>
                      <span className="text-emerald-300 font-bold">
                        {Number(priceWithMargin ?? 0) > 0
                          ? formatCurrency(Number(priceWithMargin))
                          : "—"}
                      </span>
                    </div>
                  </div>

                  {/* Missing info banner */}
                  {(!(customerEmail || "").trim() || !(jobAddress1 || "").trim()) && (
                    <div className="mt-3 text-xs text-amber-300/80">
                      Missing:{" "}
                      {!(customerEmail || "").trim() ? "customer email" : ""}
                      {!(customerEmail || "").trim() && !(jobAddress1 || "").trim() ? " + " : ""}
                      {!(jobAddress1 || "").trim() ? "job address" : ""}
                      .
                    </div>
                  )}

                  {/* Primary send action */}
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        const el = document.getElementById("customer-job-section");
                        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                        if (!(customerEmail || "").trim()) pingField("customerEmail");
                      }}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white/80 hover:bg-white/[0.06]"
                    >
                      Edit details
                    </button>

                    <button
                      type="button"
                      disabled={!(customerEmail || "").trim() || !(jobAddress1 || "").trim() || isSending || isLocked}
                      onClick={handleSendEstimate}
                      className={`rounded-full px-7 py-2.5 text-sm font-semibold text-white shadow-lg transition-all duration-150 ${
                        (!(customerEmail || "").trim() || !(jobAddress1 || "").trim())
                          ? "bg-white/10 text-white/40 cursor-not-allowed"
                          : "bg-emerald-600 hover:bg-emerald-500 hover:shadow-emerald-500/30"
                      }`}
                    >
                      {isSending ? "Sending…" : sendSuccess ? "Sent ✓" : "Send Estimate"}
                    </button>
                  </div>
                </div>

                {sendError ? <div className="mt-3 text-xs text-red-400">{sendError}</div> : null}
                {pdfError ? <p className="mt-2 text-xs text-red-300/90">{pdfError}</p> : null}
                {sendSuccess && !isSending ? (
                  <p className="mt-2 text-xs text-emerald-300/90">Sent successfully.</p>
                ) : null}

                {/* Optional panels */}
                {showSendDetails && (
                  <div className="mt-5 space-y-3">
                    {/* AI wording panel */}
                    <div className="rounded-xl border border-white/10 bg-white/[0.015] p-4">
                      <button
                        type="button"
                        onClick={() => setShowAiWordingPanel((v) => !v)}
                        className="w-full flex items-center justify-between text-sm font-medium text-white/80 hover:text-white transition-colors"
                      >
                        <span>AI Wording</span>
                        <span className="text-xs text-white/60">{showAiWordingPanel ? "Hide" : "Show"}</span>
                      </button>

                      {showAiWordingPanel && (
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-white/80">
                          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                            <div className="text-xs text-white/50 mb-1">Package Description</div>
                            <div className="whitespace-pre-wrap">{gptPackageDescription || "—"}</div>
                          </div>
                          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                            <div className="text-xs text-white/50 mb-1">Schedule CTA</div>
                            <div className="whitespace-pre-wrap">{gptScheduleCta || "—"}</div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Email preview panel */}
                    <div className="rounded-xl border border-white/10 bg-white/[0.015] p-4">
                      <button
                        type="button"
                        onClick={() => setShowEmailPreviewPanel((v) => !v)}
                        className="w-full flex items-center justify-between text-sm font-medium text-white/80 hover:text-white transition-colors"
                      >
                        <span>Email Preview</span>
                        <span className="text-xs text-white/60">{showEmailPreviewPanel ? "Hide" : "Show"}</span>
                      </button>

                      {showEmailPreviewPanel && (
                        <div className="mt-3">
                          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-white/80 whitespace-pre-wrap">
                            {buildEmailBodyPreview(previewMeta) || "—"}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* PDF tools panel */}
                    <div className="rounded-xl border border-white/10 bg-white/[0.015] p-4">
                      <button
                        type="button"
                        onClick={() => setShowPdfToolsPanel((v) => !v)}
                        className="w-full flex items-center justify-between text-sm font-medium text-white/80 hover:text-white transition-colors"
                      >
                        <span>PDF Tools</span>
                        <span className="text-xs text-white/60">{showPdfToolsPanel ? "Hide" : "Show"}</span>
                      </button>

                      {showPdfToolsPanel && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={handlePreviewPdf}
                            disabled={isPreviewingPdf}
                            className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white/80 hover:bg-white/[0.06] disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {isPreviewingPdf ? "Opening…" : "Preview PDF"}
                          </button>
                          <button
                            type="button"
                            onClick={onDownloadPdf}
                            className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white/80 hover:bg-white/[0.06]"
                          >
                            Download PDF
                          </button>
                          <button
                            type="button"
                            onClick={onSharePdf}
                            className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white/80 hover:bg-white/[0.06]"
                          >
                            Share PDF
                          </button>
                        </div>
                      )}
                    </div>

                    {typeof process !== "undefined" &&
                      process.env.NODE_ENV !== "production" &&
                      loadSavedId &&
                      (getSavedEstimateById(loadSavedId)?.status === "sent" || getSavedEstimateById(loadSavedId)?.status === "sent_pending") && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            markSavedEstimateApproved(loadSavedId!);
                          }}
                          className="rounded-full border border-amber-500/50 bg-amber-500/20 px-4 py-2 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/30"
                        >
                          DEV: Mark Approved
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-white/10 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <motion.button
                  type="button"
                  onClick={saveEstimate}
                  disabled={!canSave || isSaving || isLocked}
                  className={`rounded-full border px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm transition-all duration-200 ease-out disabled:pointer-events-none disabled:cursor-not-allowed disabled:hover:translate-y-0 ${savedFlash ? "border-emerald-500 bg-emerald-500/90 hover:bg-emerald-500 hover:border-emerald-400" : "border-blue-500 bg-blue-500/90 hover:bg-blue-500 hover:border-blue-400"} ${isSaving ? "opacity-70" : "disabled:opacity-50"}`}
                  whileTap={{ scale: 0.98 }}
                >
                  {isSaving ? "Saving..." : savedFlash ? "Saved ✓" : "Save Estimate"}
                </motion.button>
              <motion.button
                type="button"
                onClick={loadExample}
                className="rounded-full border border-blue-500/50 bg-blue-500/20 px-5 py-2.5 text-sm font-semibold text-blue-200 shadow-sm hover:bg-blue-500/30 hover:border-blue-500/70 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm transition-all duration-200 ease-out"
                whileTap={{ scale: 0.98 }}
              >
                Example values
              </motion.button>
                <motion.button
                  type="button"
                  onClick={reset}
                  className="rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-slate-300 shadow-sm hover:bg-white/10 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm transition-all duration-200 ease-out"
                whileTap={{ scale: 0.98 }}
              >
                Reset
              </motion.button>
              <Link
                href="/tools/roofing/saved"
                className="text-xs text-white/60 underline hover:text-white/80"
              >
                View Saved Estimates
              </Link>
              <Link
                href="/tools/roofing/history"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-slate-300 shadow-sm hover:bg-white/10 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 transition-all duration-200 ease-out"
              >
                <History className="h-4 w-4" />
                View History
                {estimateCount > 0 && (
                  <span className="min-w-[1.25rem] rounded-full bg-blue-500/40 px-1.5 py-0.5 text-xs font-semibold text-white tabular-nums">
                    {estimateCount}
                  </span>
                )}
              </Link>
              {zipClearedToast && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-sm font-medium text-slate-400"
                  role="status"
                >
                  Cleared defaults for {jobZip}
                </motion.span>
              )}
            </div>
            <div className="flex flex-wrap items-start gap-3 pt-2">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveAsZipDefaults}
                  onChange={(e) => setSaveAsZipDefaults(e.target.checked)}
                  className="rounded border-white/20 bg-white/10 text-blue-500 focus:ring-blue-500/50"
                />
                <span className="text-sm font-medium text-slate-300">Save as ZIP defaults</span>
              </label>
              <p className="text-xs text-slate-500">Updates future autofill for this ZIP</p>
            </div>

            {/* Send estimate banner */}
            {(isSending || sendSuccess || sendEstimateError) && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mb-4 rounded-2xl border px-4 py-3 flex items-center gap-3 ${
                  sendEstimateError
                    ? "border-red-400/30 bg-red-500/15 text-red-200"
                    : sendSuccess
                      ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-200"
                      : "border-blue-400/30 bg-blue-500/15 text-blue-200"
                }`}
              >
                {isSending && (
                  <>
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
                    <span className="text-sm font-medium">Sending estimate...</span>
                  </>
                )}
                {sendSuccess && !isSending && (
                  <span className="text-sm font-medium">Estimate Sent ✅</span>
                )}
                {sendEstimateError && !isSending && (
                  <span className="text-sm font-medium">{sendEstimateError}</span>
                )}
              </motion.div>
            )}

            {/* Estimate Review (unified, non-blocking) — hidden when empty */}
            {estimateReviewItems.length > 0 && (
              <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl">
                <div className="text-sm font-semibold text-white/90">Estimate Review</div>
                <div className="mt-0.5 text-[11px] text-white/50">
                  Quiet checks to catch common mistakes — never blocks sending.
                </div>
                <div className="mt-3 flex flex-col gap-1.5">
                  {estimateReviewItems.map((it, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span
                        className={
                          it.tone === "headsUp"
                            ? "rounded-full bg-yellow-500/15 px-2 py-0.5 text-[11px] font-semibold text-yellow-100"
                            : "rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/70"
                        }
                      >
                        {it.tone === "headsUp" ? "Heads-up" : "FYI"}
                      </span>
                      <span className="text-[12px] text-white/75">{it.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            </div>
          </motion.section>

          {/* Sticky summary card — premium result panel */}
          <div className="lg:sticky lg:top-10 lg:self-start">
            <motion.section
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              custom={1}
              className="rounded-3xl border border-white/[0.14] bg-white/[0.09] backdrop-blur-2xl p-8 sm:p-10 shadow-[0_8px_32px_-6px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,255,255,0.07)] flex flex-col transition-all duration-300 ease-out lg:hover:-translate-y-2 lg:hover:shadow-[0_24px_56px_-12px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.09)]"
              aria-labelledby="summary-heading"
            >
              <h2
                id="summary-heading"
                className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400 mb-6"
              >
                Estimate summary
              </h2>
              <div className="mb-6 flex flex-wrap items-center gap-2">
                {includeDebrisRemoval && dumpFeeNum > 0 ? (
                  <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-400/95 ring-1 ring-emerald-400/20">
                    Tear-off included — Landfill ${Math.round(dumpFeeNum)}/ton
                  </span>
                ) : !includeDebrisRemoval ? (
                  <>
                    <span className="inline-flex items-center rounded-full bg-slate-500/20 px-2.5 py-1 text-xs font-medium text-slate-400 ring-1 ring-slate-400/20">
                      Tear-off & disposal not configured
                    </span>
                    <Link
                      href="/tools/roofing"
                      className="inline-flex items-center rounded-full border border-blue-500/40 bg-blue-500/15 px-2.5 py-1 text-xs font-medium text-blue-300 hover:bg-blue-500/25 transition-colors"
                    >
                      Configure in calculator above
                    </Link>
                  </>
                ) : null}
              </div>
              {!includeDebrisRemoval && (
                <div className="mb-6 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3">
                  <p className="text-xs text-slate-400">
                    Turn on &quot;Include debris removal&quot; in the calculator for tear-off and dump costs. Treated as $0 when off.
                  </p>
                </div>
              )}
              {/* Result panel — premium breakdown, not a table */}
              <div className="flex-1 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5 sm:p-6 space-y-1">
                <div className="flex justify-between items-center py-3 px-1">
                  <span className="text-sm text-slate-400">Squares</span>
                  <span className="text-sm font-medium tabular-nums text-slate-200">{squares.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-3 px-1 border-t border-white/[0.06]">
                  <span className="text-sm text-slate-400">Adjusted squares</span>
                  <span className="text-sm font-medium tabular-nums text-slate-200">{adjustedSquares.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-3 px-1 border-t border-white/[0.06]">
                  <span className="text-sm text-slate-400">Bundles</span>
                  <span className="text-sm font-medium tabular-nums text-slate-200">{bundles}</span>
                </div>
                <div className="flex justify-between items-center py-3 px-1 border-t border-white/[0.06]">
                  <span className="text-sm text-slate-400">Materials</span>
                  <span className="text-sm font-medium tabular-nums text-slate-200">{showDash ? "—" : formatCurrency(materialsCost)}</span>
                </div>
                <div className={`flex justify-between items-center py-3 px-1 border-t border-white/[0.06] rounded-lg transition-colors duration-500 ${laborFlash ? "bg-blue-500/10" : ""}`}>
                  <span className="text-sm text-slate-400">Labor</span>
                  <span className="text-sm font-medium tabular-nums text-slate-200">{showDash ? "—" : formatCurrency(laborCostEffective)}</span>
                </div>
                <div className="flex justify-between items-center py-3 px-1 border-t border-white/[0.06]">
                  <span className="text-sm text-slate-400">Tear-Off Tons</span>
                  <span className="text-sm font-medium tabular-nums text-slate-200">{debrisTons.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-3 px-1 border-t border-white/[0.06]">
                  <span className="text-sm text-slate-400">Tear-Off & Disposal</span>
                  <span className="text-sm font-medium tabular-nums text-slate-200">{debrisEnabled ? formatCurrency(effectiveDebrisRemovalCost) : "—"}</span>
                </div>
                <div className="flex justify-between items-center py-4 px-1 border-t border-white/15 mt-1">
                  <span className="text-sm font-semibold text-slate-300">Job Cost (before profit)</span>
                  <span className="text-sm font-semibold tabular-nums text-slate-200">{showDash ? "—" : formatCurrency(subtotal)}</span>
                </div>
              </div>

              {/* Suggested Price hero — dominant, glow + gradient */}
              <div className="mt-8">
                <div
                  className="rounded-2xl p-8 sm:p-10 text-white ring-1 ring-blue-300/20"
                  style={{
                    background: "linear-gradient(165deg, #3b82f6 0%, #2563eb 18%, #1d4ed8 38%, #1e40af 58%, #1e3a8a 78%, #172554 95%, #0f172a 100%)",
                    boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.12), 0 0 0 1px rgba(255,255,255,0.06), 0 20px 60px -15px rgba(37, 99, 235, 0.5), 0 0 80px -20px rgba(59, 130, 246, 0.35)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="h-4 w-4 text-blue-200/90" />
                    <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-blue-200/90">
                      Suggested price
                    </p>
                  </div>
                  <motion.p
                    className="text-5xl md:text-6xl lg:text-7xl font-extrabold tabular-nums tracking-tight text-white drop-shadow-[0_0_24px_rgba(255,255,255,0.15)]"
                    aria-live="polite"
                    key={suggestedPriceDisplay}
                    initial={showDash ? false : { opacity: 0.88, scale: 0.996 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
                  >
                    {animatedPriceDisplay}
                  </motion.p>
                  <p className="mt-3 text-sm text-blue-200/80">
                    Includes materials, labor, tear-off (if enabled), and your selected profit margin.
                  </p>
                  <p className="mt-2 text-xs text-blue-200/60 text-center max-w-sm mx-auto">
                    This price is calculated directly from your inputs — AI does not modify pricing.
                  </p>
                  <p className="mt-2 text-xs text-blue-200/60 text-center max-w-sm mx-auto">
                    Final total may adjust only after on-site inspection if scope changes.
                  </p>
                  {!showDash && (
                    <div className="mt-6 flex flex-wrap gap-2">
                      <span className="rounded-full bg-white/[0.1] px-3 py-1.5 text-[11px] font-medium tracking-wide text-blue-100/90">
                        Materials {formatCurrency(materialsCost)}
                      </span>
                      <span className="rounded-full bg-white/[0.1] px-3 py-1.5 text-[11px] font-medium tracking-wide text-blue-100/90">
                        Labor {formatCurrency(laborCostEffective)}
                      </span>
                      {debrisEnabled && (
                        <span className="rounded-full bg-white/[0.1] px-3 py-1.5 text-[11px] font-medium tracking-wide text-blue-100/90">
                          Tear-Off & Disposal {formatCurrency(effectiveDebrisRemovalCost)}
                        </span>
                      )}
                      <span className="rounded-full bg-white/[0.1] px-3 py-1.5 text-[11px] font-medium tracking-wide text-blue-100/90">
                        Job Cost (before profit) {formatCurrency(subtotal)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </motion.section>

          </div>
        </div>
        </div>
      </div>
    </main>
  );
}
