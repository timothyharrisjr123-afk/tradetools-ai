"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation"
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { motion, useSpring, useMotionValueEvent } from "framer-motion";
import { getAIReview } from "./aiReview";
import {
  ArrowLeft,
  Ruler,
  Package,
  DollarSign,
  HardHat,
  TrendingUp,
  Sparkles,
  Info,
  MapPin,
  ChevronDown,
  Layers,
} from "lucide-react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { loadCompanyProfile, getCompanyProfileEmailSafe, type CompanyProfile } from "@/app/lib/companyProfile";
import {
  saveEstimate as saveToEstimateStore,
  getSavedEstimates,
  getSavedEstimateById,
  getCurrentLoadedSavedId,
  setCurrentLoadedSavedId,
  updateSavedEstimate,
  patchSavedEstimate,
  markSavedEstimateSent,
  markSavedEstimateApproved,
  markSavedEstimateStatus,
  setSavedEstimateApprovalToken,
  attachApprovalTokenAndMarkPending,
  duplicateSavedEstimate,
  setEstimateStoreCompanyScope,
  type RoofingEstimate as SavedEstimateSnapshot,
} from "@/app/lib/estimateStore";
import { sendEstimateEmailWithPdf } from "@/app/lib/sendEstimateClient";
import { getFavorite, setFavorite, setLocked, appendFeedback, getTierFeedbackBias, type TierLabel } from "@/app/lib/aiWordingPrefs";
import RoofingTabs from "@/app/tools/roofing/RoofingTabs";
import RoofingClientV2 from "../roofing-v2/RoofingClientV2";
import { loadCompanyVoiceProfile, saveCompanyVoiceProfile, type VoiceTone } from "@/app/lib/companyVoiceProfile";
import { SignOutButton } from "@/app/components/auth/SignOutButton";

function safeUUID() {
  try {
    return typeof crypto !== "undefined" && crypto?.randomUUID?.()
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

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
  pricingMode?: "markup" | "direct";
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

const ROOFING_WASTE_PRESETS = [
  { label: "Standard", pct: 10, helper: "Simple roof" },
  { label: "Complex", pct: 15, helper: "Multiple angles" },
  { label: "High Waste", pct: 20, helper: "Cuts / steep" },
] as const;

const ROOFING_MARGIN_PRESETS = [15, 20, 25] as const;

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
  if (!Number.isFinite(n)) return "$0.00";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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

type PricingMode = "markup" | "direct";

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
  pricingMode: PricingMode;
  margin: string;
  includeDebrisRemoval: boolean;
  removalType: DebrisRemovalType;
  dumpFeePerTon: string;
};

export default function RoofingClient({ companyId }: { companyId?: string }) {
  setEstimateStoreCompanyScope(companyId ?? null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const loadSavedId = searchParams.get("loadSaved");
  const [zipPresets, setZipPresets] = useState<ZipPresetsMap | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [restoreTick, setRestoreTick] = useState(0);
  const [showV2Preview, setShowV2Preview] = useState(false);
  const hasSeededV2PreviewDefaultsRef = useRef(false);
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
  const [pricingMode, setPricingMode] = useState<PricingMode>("markup");
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
    setPricingMode(((match as any).pricingMode === "direct" ? "direct" : "markup"));

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
    const targetPricingMode = (match as any).pricingMode === "direct" ? "direct" : "markup";

    const areaOk = String(area ?? "") === targetArea;
    const wasteOk = String(waste ?? "") === targetWaste;
    const bundlesPerSquareOk = String(bundlesPerSquare ?? "") === targetBundlesPerSquare;
    const bundleCostOk = String(bundleCost ?? "") === targetBundleCost;
    const laborPerSquareOk = String(laborPerSquare ?? "") === targetLaborPerSquare;
    const marginOk = String(margin ?? "") === targetMargin;
    const pricingModeOk = pricingMode === targetPricingMode;

    if (!areaOk || !wasteOk || !bundlesPerSquareOk || !bundleCostOk || !laborPerSquareOk || !marginOk || !pricingModeOk) {
      if (!areaOk) setArea(targetArea);
      if (!wasteOk) setWaste(targetWaste);
      if (!bundlesPerSquareOk) setBundlesPerSquare(targetBundlesPerSquare);
      if (!bundleCostOk) setBundleCost(targetBundleCost);
      if (!laborPerSquareOk) setLaborPerSquare(targetLaborPerSquare);
      if (!marginOk) setMargin(targetMargin);
      if (!pricingModeOk) setPricingMode(targetPricingMode);
      return;
    }

    // Only once all values "stick", clean the URL without remounting.
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", "/tools/roofing");
    }
  }, [loadSavedId, area, waste, bundlesPerSquare, bundleCost, laborPerSquare, margin, pricingMode]);

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
    typeof window !== "undefined" ? loadCompanyProfile() : { companyName: "", phone: "", email: "", license: "", logoDataUrl: "", notificationsEmail: "" }
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
    pricingMode,
    margin,
    includeDebrisRemoval,
    removalType,
    dumpFeePerTon,
  }), [area, waste, bundlesPerSquare, bundleCost, laborMode, laborCostRaw, laborCost, guidedLaborBasePerSquare, guidedStories, guidedWalkable, pricingMode, margin, includeDebrisRemoval, removalType, dumpFeePerTon]);

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
    setPricingMode("markup");
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
    setPricingMode(s.pricingMode ?? "markup");
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
    setPricingMode("markup");
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
    setPricingMode("markup");
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

    const manualPitchMultiplier = PITCH_MULTIPLIER[pitch] ?? 1;

    const laborCostEffective =
      laborMode === "guided"
        ? (canCompute ? guidedLaborTotal : 0)
        : (laborMode === "manual"
            ? Math.round((Number(laborCost) || 0) * manualPitchMultiplier)
            : 0);

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
    pitch,
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

  const finalPrice = pricingMode === "direct" ? subtotal : priceWithMargin;
  const finalMarginNum = pricingMode === "direct" ? 0 : marginNum;
  const finalShowDash = pricingMode === "direct" ? !hasMonetaryInputs : showDash;
  const finalPriceDisplay = finalShowDash ? "—" : formatCurrency(finalPrice);

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
    if (!showV2Preview) {
      hasSeededV2PreviewDefaultsRef.current = false;
      return;
    }
    if (hasSeededV2PreviewDefaultsRef.current) return;
    if (laborMode !== "manual") {
      setLaborMode("manual");
    }
    hasSeededV2PreviewDefaultsRef.current = true;
  }, [showV2Preview, laborMode]);

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
      suggestedPrice: finalPrice,
      marginPct: marginNum,
    });
  }, [
    adjustedSquares,
    laborCostEffective,
    materialsCost,
    includeDebrisRemoval,
    effectiveDebrisRemovalCost,
    finalPrice,
    marginNum,
  ]);

  // Estimate Review (quiet, non-blocking)
  // Rules:
  // - Hide entirely when the estimate is effectively empty (no pricing yet)
  // - Max 2 messages
  // - Only meaningful checks (no "scolding")
  const estimateReviewItems = useMemo(() => {
    const total = Number(finalPrice ?? 0);
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
    finalPrice,
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
      suggestedPrice: finalPrice,
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
    finalPrice,
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

    const rawMaterials = Number(snapshot.materialsCost ?? 0) || 0;
    const rawLabor = Number(snapshot.laborCost ?? 0) || 0;
    const rawDisposal = Number(snapshot.disposalCost ?? 0) || 0;
    const price = Number(snapshot.suggestedPrice) || 0;
    const jobCost = rawMaterials + rawLabor + rawDisposal || price;

    let materials = rawMaterials;
    let labor = rawLabor;
    let disposal = rawDisposal;

    if (price > 0 && jobCost > 0) {
      const multiplier = price / jobCost;

      materials = Math.round(rawMaterials * multiplier * 100) / 100;
      labor = Math.round(rawLabor * multiplier * 100) / 100;
      disposal = Math.round(rawDisposal * multiplier * 100) / 100;

      const displaySum = materials + labor + disposal;
      const remainder = Math.round((price - displaySum) * 100) / 100;

      if (Math.abs(remainder) > 0) {
        if (disposal > 0) {
          disposal = Math.round((disposal + remainder) * 100) / 100;
        } else if (labor > 0) {
          labor = Math.round((labor + remainder) * 100) / 100;
        } else {
          materials = Math.round((materials + remainder) * 100) / 100;
        }
      }
    }

    const tier =
      snapshot.selectedTier === "Core"
        ? "standard"
        : snapshot.selectedTier === "Enhanced"
        ? "enhanced"
        : "premium";
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

  const handleRegenerateDescription = handleGenerateSummary;
  const handleCustomizeDescription = () => setShowAiPanel(true);

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
    const price = Number(finalPrice) || 0;

    const rawMaterials = Number(materialsCost) || 0;
    const rawLabor = Number(laborCostEffective) || 0;
    const rawDisposal = Number(effectiveDebrisRemovalCost) || 0;

    const jobCostRaw = Number(subtotal) || 0;
    const jobCost = jobCostRaw || rawMaterials + rawLabor + rawDisposal;

    if (price <= 0 || jobCost <= 0) {
      return {
        price,
        materials: rawMaterials,
        labor: rawLabor,
        disposal: rawDisposal,
        jobCost,
      };
    }

    const multiplier = price / jobCost;

    let materials = Math.round(rawMaterials * multiplier * 100) / 100;
    let labor = Math.round(rawLabor * multiplier * 100) / 100;
    let disposal = Math.round(rawDisposal * multiplier * 100) / 100;

    const displaySum = materials + labor + disposal;
    const remainder = Math.round((price - displaySum) * 100) / 100;

    if (Math.abs(remainder) > 0) {
      if (disposal > 0) {
        disposal = Math.round((disposal + remainder) * 100) / 100;
      } else if (labor > 0) {
        labor = Math.round((labor + remainder) * 100) / 100;
      } else {
        materials = Math.round((materials + remainder) * 100) / 100;
      }
    }

    return {
      price,
      materials,
      labor,
      disposal,
      jobCost,
    };
  }

  const v2ViewModel = useMemo(() => {
    const price = Number(finalPrice) || 0;
    const jobCost = Number(subtotal) || 0;
    const profit = Math.max(0, price - jobCost);
    const margin =
      pricingMode === "direct" || price <= 0
        ? null
        : profit / price;

    const proposal = getProposalNumbers();

    const rawSquares = hasArea ? areaNum / 100 : 0;
    const scopeRoofSize = hasArea
      ? `${rawSquares.toFixed(1)} squares · ${fmtNum(areaNum)} sq ft`
      : "";
    // TODO: replace with richer V1 display label when scope labeling is formalized (pitch UI vs guided walkability)
    const scopePitchDisplay =
      laborMode === "guided"
        ? guidedWalkable === "walkable"
          ? "Walkable"
          : "Steep"
        : pitch === "walkable"
          ? "Walkable"
          : pitch === "moderate"
            ? "Moderate"
            : "Steep";
    // TODO: disposal/removal proxy from includeDebrisRemoval — not a formal tear-off scope label yet
    const scopeTearOff = includeDebrisRemoval ? "Included" : "Not included";
    // TODO: NOT a real material-system / product label — bundles/sq is the only explicit V1 material-density input today; replace when material labeling is formalized
    const bundlesPerSqDisplay = (() => {
      const raw = bundlesPerSquare.trim();
      const n = parseFloat(raw);
      const val = Number.isFinite(n) && n > 0 ? n : DEFAULTS.bundlesPerSquare;
      return `${val} bundles/sq`;
    })();
    const scopeMaterial = bundlesPerSqDisplay;

    return {
      // CUSTOMER
      customer: {
        name: customerName,
        email: customerEmail,
        phone: customerPhone,
      },

      job: {
        address1: jobAddress1,
        city: jobCity,
        state: jobState,
        zip: jobZip,
      },

      scope: {
        areaSqFtRaw: area,
        roofSize: scopeRoofSize,
        pitch: scopePitchDisplay,
        tearOff: scopeTearOff,
        material: scopeMaterial,
      },

      // CONTROL STATE
      control: {
        pricingMode,
        tier: roofingTier,
        laborMode,
      },

      // CONTRACTOR ECONOMICS
      contractor: {
        finalPrice: price,
        jobCost,
        profit,
        margin,
      },

      // CUSTOMER-FACING (PDF ALIGNED)
      proposal: {
        price: proposal.price,
        materials: proposal.materials,
        labor: proposal.labor,
        disposal: proposal.disposal,
      },
    };
  }, [
    finalPrice,
    subtotal,
    materialsCost,
    laborCostEffective,
    effectiveDebrisRemovalCost,
    pricingMode,
    marginNum,
    roofingTier,
    laborMode,
    hasArea,
    area,
    areaNum,
    pitch,
    guidedWalkable,
    includeDebrisRemoval,
    bundlesPerSquare,
    customerName,
    customerEmail,
    customerPhone,
    jobAddress1,
    jobCity,
    jobState,
    jobZip,
  ]);

  useEffect(() => {
    console.log("V2 VIEW MODEL", v2ViewModel);
  }, [v2ViewModel]);

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
    function drawAmountRow(
      label: string,
      value: number,
      xLeft: number,
      xRight: number,
      yPos: number
    ) {
      const valueText = fmtMoney(value);
      const valueW = fontBold.widthOfTextAtSize(valueText, 10);
      page.drawText(label, {
        x: xLeft,
        y: yPos,
        size: 10,
        font,
        color: rgb(0.24, 0.26, 0.31),
      });
      page.drawText(valueText, {
        x: xRight - valueW - 10,
        y: yPos,
        size: 10,
        font: fontBold,
        color: rgb(0.12, 0.14, 0.18),
      });
    }

    let page = pdfDoc.addPage([pageW, pageH]);
    let y = pageH - margin;
    const lineH = 13;
    const smallH = 10;

    // ----- Header -----
    const hasLogo = companyProfile.logoDataUrl && companyProfile.logoDataUrl.startsWith("data:image");
    const hasCompany = !!companyProfile.companyName.trim();
    const hasContact = !!(companyProfile.phone.trim() || companyProfile.email.trim());
    const hasLicense = !!companyProfile.license.trim();
    let logoW = 0;
    const logoMaxH = 46;
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
    const headerX = margin + (logoW > 0 ? logoW + 14 : 0);
    let headerOff = 0;
    if (hasCompany) {
      page.drawText(companyProfile.companyName.trim(), {
        x: headerX,
        y: y - 16,
        size: 16,
        font: fontBold,
        color: rgb(0.08, 0.1, 0.14),
      });
      headerOff = 22;
    }
    if (hasContact) {
      const contactLine = [companyProfile.phone.trim(), companyProfile.email.trim()].filter(Boolean).join(" · ");
      page.drawText(contactLine, {
        x: headerX,
        y: y - headerOff - smallH,
        size: 10,
        font,
        color: rgb(0.25, 0.27, 0.32),
      });
      headerOff += smallH + 6;
    }
    if (hasLicense) {
      page.drawText(`License: ${companyProfile.license.trim()}`, {
        x: headerX,
        y: y - headerOff - smallH,
        size: 10,
        font,
        color: rgb(0.33, 0.35, 0.4),
      });
      headerOff += smallH + 4;
    }
    const headerHeight = logoW > 0 ? Math.max(logoMaxH, headerOff) : headerOff;

    // more breathing room under header
    y -= headerHeight + 18;

    page.drawLine({
      start: { x: margin, y },
      end: { x: pageW - margin, y },
      thickness: 0.75,
      color: rgb(0.78, 0.79, 0.82),
    });

    // more spacing before title
    y -= 22;

    // ----- Title + Meta -----
    page.drawText("ROOFING PROPOSAL", {
      x: margin,
      y,
      size: 20,
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
        y: y - i * (metaSize + 3),
        size: metaSize,
        font,
        color: rgb(0.34, 0.36, 0.42),
      });
    }
    y -= Math.max(metaLines.length * (metaSize + 3), 26);

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
    const colW = (contentW - 28) / 2;
    const boxFontSize = 10;
    const rightColX = margin + colW + 28;
    if (prepLines.length > 0 || jobLines.length > 0) {
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
        leftY -= lineH + 1;
        for (const line of prepLines) {
          const parts = wrap(line, font, boxFontSize, colW);
          for (const p of parts) {
            page.drawText(p, {
              x: margin,
              y: leftY,
              size: boxFontSize,
              font,
              color: rgb(0.15, 0.17, 0.22),
            });
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
        rightY -= lineH + 1;
        for (const line of jobLines) {
          const parts = wrap(line, font, boxFontSize, colW);
          for (const p of parts) {
            page.drawText(p, {
              x: rightColX,
              y: rightY,
              size: boxFontSize,
              font,
              color: rgb(0.15, 0.17, 0.22),
            });
            rightY -= lineH;
          }
        }
      }
      y = Math.min(leftY, rightY) - 14;
    } else {
      y -= 10;
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
    const packageDescriptionLines = wrap(packageDescriptionText, font, 10, contentW - 28);
    const lineItemCount = disposal > 0 ? 4 : 3;
    const pricingH = 18 + 12 + packageDescriptionLines.length * lineH + 12 + lineItemCount * lineH + 22;
    const pricingBoxBottom = y - pricingH;
    page.drawRectangle({
      x: margin,
      y: pricingBoxBottom,
      width: contentW,
      height: pricingH,
      color: rgb(0.965, 0.97, 0.978),
      borderColor: rgb(0.87, 0.89, 0.92),
      borderWidth: 0.75,
    });

    y -= 16;
    page.drawText(`Roofing System: ${tierLabel}`, {
      x: margin + 12,
      y,
      size: 11,
      font: fontBold,
      color: rgb(0.16, 0.18, 0.23),
    });
    y -= lineH + 1;

    for (const ln of packageDescriptionLines) {
      page.drawText(ln, {
        x: margin + 12,
        y,
        size: 10,
        font,
        color: rgb(0.28, 0.3, 0.35),
      });
      y -= lineH;
    }

    y -= 4;
    drawAmountRow("Materials", materials, margin + 12, margin + contentW - 12, y);
    y -= lineH;

    drawAmountRow("Labor", labor, margin + 12, margin + contentW - 12, y);
    y -= lineH;

    if (disposal > 0) {
      drawAmountRow("Tear-Off & Disposal", disposal, margin + 12, margin + contentW - 12, y);
      y -= lineH;
    }

    y -= 4;

    page.drawLine({
      start: { x: margin + 12, y },
      end: { x: margin + contentW - 12, y },
      thickness: 0.6,
      color: rgb(0.80, 0.81, 0.84),
    });

    y -= 14;

    page.drawText("Total Investment", {
      x: margin + 12,
      y,
      size: 11,
      font: fontBold,
      color: rgb(0.14, 0.16, 0.2),
    });

    const totalValueText = fmtMoney(price);
    const totalValueWidth = fontBold.widthOfTextAtSize(totalValueText, 15);

    page.drawText(totalValueText, {
      x: margin + contentW - 12 - totalValueWidth,
      y: y - 1,
      size: 15,
      font: fontBold,
      color: rgb(0.08, 0.1, 0.14),
    });

    y = pricingBoxBottom - 10;

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
        page.drawText(prefix + lines[i], {
          x: margin + 4,
          y,
          size: 10,
          font,
          color: rgb(0.25, 0.27, 0.32),
        });
        y -= lineH;
      }
    }
    y -= 10;

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
        page.drawText(prefix + lines[i], {
          x: margin + 4,
          y,
          size: 10,
          font,
          color: rgb(0.3, 0.32, 0.38),
        });
        y -= lineH;
      }
    }
    y -= 14;

    // ----- Bottom close -----
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageW - margin, y },
      thickness: 0.75,
      color: rgb(0.72, 0.74, 0.78),
    });

    y -= 22;

    const scheduleCtaText = dataOverride
      ? "To approve and schedule your installation, click the approval button in your email."
      : (useGptWording && gptScheduleCta?.trim()) ? gptScheduleCta.trim() : "To approve and schedule your installation, click the approval button in your email.";

    for (const ln of wrap(scheduleCtaText, font, 10, contentW)) {
      page.drawText(ln, {
        x: margin,
        y,
        size: 10,
        font,
        color: rgb(0.25, 0.27, 0.32),
      });
      y -= lineH;
    }

    y -= 4;

    const closeLine2 = "Questions? Reply to this email or call us.";

    for (const ln of wrap(closeLine2, font, 10, contentW)) {
      page.drawText(ln, {
        x: margin,
        y,
        size: 10,
        font,
        color: rgb(0.25, 0.27, 0.32),
      });
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
  const hasPrice = Number(finalPrice || 0) > 0;
  const hasCustomerEmail = Boolean((customerEmail || "").includes("@"));
  const hasAIWording = Boolean((gptPackageDescription || "").trim() && (gptScheduleCta || "").trim());

  const pingField = (field: "roofArea" | "customerEmail") => {
    setAttentionField(field);
    window.setTimeout(() => setAttentionField(null), 1200);
  };

  function formatPricePreview(n: number) {
    return `$${Math.round((n + Number.EPSILON) * 100) / 100}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  /** Plain-text email preview only — mirrors app/api/estimate/send/route.ts buildSubject (not sent from here). */
  function buildEmailSubjectPreview(meta: { customerName?: string; selectedTier: "Core" | "Enhanced" | "Premium" }) {
    const name = (meta.customerName || "").trim() || "Customer";
    return `Your Roofing Proposal Is Ready – ${name} – ${meta.selectedTier}`;
  }

  /**
   * Plain-text email preview — mirrors route.ts buildBody + trailing APPROVAL LINK block on the text part.
   * Uses a placeholder when no stored approvalUrl exists yet (matches post-send copy without faking a URL).
   */
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
    approvalUrl?: string | null;
  }) {
    const APPROVAL_LINK_PLACEHOLDER = "[Approval link will be generated when sent]";
    const customerName = (meta.customerName || "").trim() || "there";
    const companyName = (meta.companyName || "").trim() || "Your Company";
    const addrLine1 = (meta.jobAddress1 || "").trim();
    const city = (meta.jobCity || "").trim();
    const state = (meta.jobState || "").trim();
    const zip = (meta.jobZip || "").trim();
    const cityStateZip = [city, state, zip].filter(Boolean).join(", ");
    const total = formatPricePreview(meta.suggestedPrice);
    const packageDescription = (meta.packageDescription || "").trim() || "(see attached PDF)";
    const scheduleCta = (meta.scheduleCta || "").trim();
    const isApprovalStyleCta =
      /reply\s*['"]?\s*approve\s*['"]?|approve.*below|click.*approve|use the button/i.test(scheduleCta);

    const lines: string[] = [];
    lines.push(`Hi ${customerName},`);
    lines.push("");
    lines.push("Your roofing project proposal is ready for review.");
    lines.push("");
    lines.push(`Package: ${meta.selectedTier}`);
    lines.push(`Total Investment: ${total}`);
    lines.push("");
    lines.push("Project Address:");
    lines.push(addrLine1 || "(not provided)");
    if (cityStateZip) lines.push(cityStateZip);
    lines.push("");
    lines.push("Scope Summary:");
    lines.push(packageDescription);
    lines.push("");

    if (scheduleCta && !isApprovalStyleCta) {
      lines.push(scheduleCta);
      lines.push("");
    }

    const linkForText = (meta.approvalUrl && String(meta.approvalUrl).trim()) || APPROVAL_LINK_PLACEHOLDER;
    lines.push("Approve your estimate:");
    lines.push(linkForText);
    lines.push("");
    lines.push("Use the approval link to confirm and we'll contact you to schedule next steps for your project.");
    lines.push("");

    lines.push("This proposal is valid for 30 days from the date issued.");
    lines.push("");
    lines.push("Questions? Reply directly to this email and our team will help right away.");
    lines.push("");
    lines.push("Thank you,");
    lines.push(companyName);

    const baseText = lines.join("\n");
    const approveBlockText = `\n\nAPPROVAL LINK:\n${linkForText}\n`;
    return `${baseText}${approveBlockText}`;
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

  const hasValidEstimateSnapshot = Number(area || 0) > 0 && Number(finalPrice || 0) > 0;

  function ensureSavedBeforeSend(): string {
    if (!hasValidEstimateSnapshot) throw new Error("Estimate cannot be saved yet because area or price is missing.");
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
      suggestedPrice: Number(finalPrice ?? 0),
      totalContractPrice: Number(finalPrice ?? 0),
      area: String(area ?? ""),
      waste: String(waste ?? ""),
      bundlesPerSquare: String(bundlesPerSquare ?? ""),
      bundleCost: String(bundleCost ?? ""),
      laborPerSquare: laborMode === "guided" ? String(guidedLaborBasePerSquare) : String(Math.round(impliedLaborPerSquare * 100) / 100),
      margin: String(margin ?? ""),
      pricingMode,
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
    const currentEstimateId = loadSavedId ?? (hasMounted ? getCurrentLoadedSavedId() : null) ?? null;
    console.log("[SEND CLICKED]", {
      currentEstimateId,
      customerEmail,
    });

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

    const ensuredApprovalToken = savedSnapshot?.approvalToken ?? undefined;
    const approvalTokenToUse = ensuredApprovalToken || safeUUID();

    if (savedEstimateId) {
      patchSavedEstimate(savedEstimateId, { approvalToken: approvalTokenToUse });
      console.log("[ENSURE TOKEN] patched saved estimate", { id: savedEstimateId, approvalToken: approvalTokenToUse });
    }

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
            totalPrice: Number(finalPrice) || 0,
            packageDescription: (gptPackageDescription || "").trim(),
            scheduleCta: (gptScheduleCta || "").trim(),
            companyName: (companyProfile?.companyName || "").trim() || undefined,
          };

      const pdfBytes = savedSnapshot
        ? await getLockedPdfBytesForSavedEstimate(savedSnapshot)
        : await getLockedPdfBytesForCurrentEstimate();

      console.log("[BEFORE FETCH SEND]", {
        currentEstimateId: savedEstimateId,
        approvalTokenState: approvalTokenToUse ?? null,
      });

      const data = await sendEstimateEmailWithPdf({
        to,
        meta,
        pdfBytes,
        pdfFilename: `Roofing-Estimate-${selectedTierLabel}.pdf`,
        savedEstimateId: savedEstimateId ?? undefined,
        contractorEmail: (companyProfile?.email || "").trim() || undefined,
        approvalToken: approvalTokenToUse,
        notifyEmail: (getCompanyProfileEmailSafe() || (companyProfile?.email || "").trim()) || undefined,
      });

      if (!data?.success) {
        throw new Error("Send failed");
      }

      const serverToken =
        (data?.approvalToken && String(data.approvalToken)) || approvalTokenToUse;

      console.log("[AFTER FETCH SUCCESS]", {
        currentEstimateId: savedEstimateId,
        approvalTokenUsed: serverToken ?? null,
      });
      console.log("[TOKEN SYNC]", {
        approvalTokenToUse,
        serverToken,
        approvalUrl: data?.approvalUrl,
      });

      const sentAt = new Date().toISOString();
      const sentTo = (to || "").trim() || undefined;
      const approvalUrl = data?.approvalUrl ?? null;

      if (savedEstimateId) {
        patchSavedEstimate(savedEstimateId, {
          status: "sent",
          approvalToken: serverToken,
          sentAt,
          sentToEmail: sentTo,
        });
        console.log("[SEND SUCCESS PATCH]", {
          id: savedEstimateId,
          approvalToken: serverToken,
          sentToEmail: sentTo,
        });
      }

      if (serverToken) {
        attachApprovalTokenAndMarkPending(savedEstimateId, serverToken);
      }
      markSavedEstimateStatus(savedEstimateId, "sent_pending" as any);
      updateSavedEstimate(savedEstimateId, {
        status: "sent_pending",
        sentAt,
        sentToEmail: sentTo,
        sentTo,
        approvalUrl: approvalUrl || undefined,
        approvalToken: serverToken,
        viewedAt: null,
      } as any);
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
        customerName: (previewSnapshot.customerName || "").trim(),
        selectedTier: previewSnapshot.selectedTier as "Core" | "Enhanced" | "Premium",
        jobAddress1: (previewSnapshot.jobAddress1 || "").trim() || undefined,
        jobCity: (previewSnapshot.jobCity || "").trim() || undefined,
        jobState: (previewSnapshot.jobState || "").trim() || undefined,
        jobZip: String(previewSnapshot.jobZip ?? previewSnapshot.zip ?? "").trim() || undefined,
        suggestedPrice: Number(previewSnapshot.suggestedPrice) || 0,
        packageDescription: (gptPackageDescription || "").trim(),
        scheduleCta: (gptScheduleCta || "").trim(),
        companyName: (companyProfile?.companyName || "").trim() || undefined,
        approvalUrl: (previewSnapshot.approvalUrl || "").trim() || undefined,
      }
    : {
        customerName: (customerName || "").trim(),
        selectedTier: selectedTierLabel as "Core" | "Enhanced" | "Premium",
        jobAddress1: (jobAddress1 || "").trim() || undefined,
        jobCity: (jobCity || "").trim() || undefined,
        jobState: (jobState || "").trim() || undefined,
        jobZip: (jobZip || "").trim() || undefined,
        suggestedPrice: Number(finalPrice) || 0,
        packageDescription: (gptPackageDescription || "").trim(),
        scheduleCta: (gptScheduleCta || "").trim(),
        companyName: (companyProfile?.companyName || "").trim() || undefined,
        approvalUrl: undefined,
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
        setPricingMode(((match as any).pricingMode === "direct" ? "direct" : "markup"));
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
    const total = Number(finalPrice) || 0;
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
    const total = Number(finalPrice) || 0;
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
    if (!hasValidEstimateSnapshot) return;
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
      suggestedPrice: Number(finalPrice ?? 0),
      totalContractPrice: Number(finalPrice ?? 0),
      area: String(area ?? ""),
      waste: String(waste ?? ""),
      bundlesPerSquare: String(bundlesPerSquare ?? ""),
      bundleCost: String(bundleCost ?? ""),
      laborPerSquare: effectiveLaborPerSquare,
      margin: String(margin ?? ""),
      pricingMode,
      status: "estimate",
      laborMode: laborMode === "guided" ? "guided" : "manual",
      manualLaborCost: laborMode === "manual" ? laborCostEffective : undefined,
      dumpFeePerTon: includeDebrisRemoval ? parseFloat(dumpFeePerTon) || undefined : undefined,
      tearOffEnabled: includeDebrisRemoval,
      removalType,
    } as any);
  }, [hasValidEstimateSnapshot, customerName, customerEmail, customerPhone, jobAddress1, jobCity, jobState, jobZip, roofingTier, area, finalPrice, waste, bundlesPerSquare, bundleCost, laborMode, guidedLaborBasePerSquare, impliedLaborPerSquare, margin, pricingMode, laborCostEffective, includeDebrisRemoval, removalType, dumpFeePerTon]);

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
      pricingMode,
      squares,
      adjustedSquares: adjustedSquares,
      bundles,
      materialsCost,
      laborCost: laborCostEffective,
      subtotal,
      suggestedPrice: finalPrice,
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
    router.push("/tools/roofing/saved");
  }, [
    isLocked,
    canSave,
    area,
    waste,
    bundlesPerSquare,
    bundleCost,
    margin,
    pricingMode,
    squares,
    adjustedSquares,
    bundles,
    materialsCost,
    laborCostEffective,
    subtotal,
    finalPrice,
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
      setPricingMode(loaded.pricingMode === "direct" ? "direct" : "markup");
    } catch {
      localStorage.removeItem(STORAGE_KEY_LAST_LOADED);
    }
  }, [restoreTick]);

  useEffect(() => {
    if (finalShowDash) {
      spring.set(0);
      setDisplayPrice(0);
    } else {
      spring.set(finalPrice);
    }
  }, [finalPrice, finalShowDash, spring]);

  useEffect(() => {
    if (!sendSuccess) return;
    const t = setTimeout(() => setSendSuccess(false), 4000);
    return () => clearTimeout(t);
  }, [sendSuccess]);

  useMotionValueEvent(spring, "change", (latest: number) => {
    setDisplayPrice(latest);
  });

  const animatedPriceDisplay = finalShowDash
    ? "—"
    : formatCurrency(Math.round(displayPrice * 100) / 100);

  const { price: suggestedPrice, materials, labor, disposal } = getProposalNumbers();

  const aiConductorStripItems: { label: string; ready: boolean; notReadyStatus: "Needs input" | "Waiting" }[] = [
    {
      label: "Customer info",
      ready: Boolean((customerName || "").trim() || hasCustomerEmail),
      notReadyStatus: "Needs input",
    },
    {
      label: "Property",
      ready: Boolean((jobAddress1 || "").trim() || (jobZip || "").trim()),
      notReadyStatus: "Needs input",
    },
    { label: "Scope", ready: hasRoofArea, notReadyStatus: "Waiting" },
    { label: "Pricing", ready: hasPrice, notReadyStatus: "Waiting" },
    { label: "Proposal draft", ready: hasAIWording, notReadyStatus: "Waiting" },
  ];
  const aiConductorReadyCount = aiConductorStripItems.filter((x) => x.ready).length;
  const aiConductorTotalCount = aiConductorStripItems.length;

  const jobReadinessItems = [
    { label: "Customer info", ready: Boolean((customerName || "").trim() || hasCustomerEmail) },
    { label: "Property", ready: Boolean((jobAddress1 || "").trim() || (jobZip || "").trim()) },
    { label: "Scope", ready: hasRoofArea },
    { label: "Pricing", ready: hasPrice },
    { label: "Proposal draft", ready: hasAIWording },
  ];
  const jobReadinessReadyCount = jobReadinessItems.filter((x) => x.ready).length;

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

      <div className="relative mx-auto max-w-[1480px]">
        <button
          type="button"
          onClick={() => setShowV2Preview((v) => !v)}
          className="sr-only"
          aria-hidden
          tabIndex={-1}
        >
          {showV2Preview ? "Close V2 Preview" : "Open V2 Preview"}
        </button>

        {showV2Preview ? (
          <RoofingClientV2
            companyId={companyId ?? ""}
            mode="embedded"
            viewModel={v2ViewModel}
            customerName={customerName}
            customerEmail={customerEmail}
            customerPhone={customerPhone}
            jobAddress1={jobAddress1}
            jobCity={jobCity}
            jobState={jobState}
            jobZip={jobZip}
            onCustomerNameChange={setCustomerName}
            onCustomerEmailChange={(value) => {
              setCustomerEmail(value);
              setSendError("");
            }}
            onCustomerPhoneChange={setCustomerPhone}
            onJobAddress1Change={setJobAddress1}
            onJobAddress1Blur={(value) => {
              const cleaned = value.replace(/\s+/g, " ").trim();
              if (cleaned !== jobAddress1) setJobAddress1(cleaned);
            }}
            onJobCityChange={setJobCity}
            onJobCityBlur={(value) => {
              const cleaned = value
                .replace(/[^a-zA-Z\s.'-]/g, "")
                .replace(/\s+/g, " ")
                .trim();
              if (cleaned !== jobCity) setJobCity(cleaned);
            }}
            onJobStateChange={setJobState}
            onJobStateBlur={(value) => {
              const cleaned = value
                .replace(/[^a-zA-Z]/g, "")
                .toUpperCase()
                .trim();
              if (cleaned !== jobState) setJobState(cleaned);
            }}
            onJobZipChange={(value) => setJobZip(sanitizeZipInput(value))}
            onJobZipBlur={() => {
              const sanitized = sanitizeZipInput(jobZip);
              if (sanitized !== jobZip) setJobZip(sanitized);
              if (sanitized.length === 5) tryApplyZipPreset(sanitized);
            }}
            onJobZipEnter={() => {
              const sanitized = sanitizeZipInput(jobZip);
              if (sanitized !== jobZip) setJobZip(sanitized);
              if (sanitized.length === 5) tryApplyZipPreset(sanitized);
            }}
            onPricingModeChange={setPricingMode}
            onProposalTierChange={setRoofingTier}
            marginValue={Number(margin) || 0}
            onMarginChange={(pct) => setMargin(String(pct))}
            onTearOffChange={setIncludeDebrisRemoval}
            onMaterialDensityChange={setBundlesPerSquare}
            onGuidedWalkabilityChange={setGuidedWalkable}
            onPitchChange={setPitch}
            onAreaChange={setArea}
            onPreviewProposal={handlePreviewPdf}
            onSaveEstimate={saveEstimate}
            canSaveEstimate={canSave}
            isSavingEstimate={isSaving}
            onSendEstimate={handleSendEstimate}
            canSendEstimate={Boolean(
              (customerEmail || "").trim() && (jobAddress1 || "").trim() && !isLocked
            )}
            isSendingEstimate={isSending}
            wasteValue={waste}
            onWasteChange={setWaste}
            bundleCostValue={bundleCost}
            onBundleCostChange={setBundleCost}
            dumpFeePerTonValue={dumpFeePerTon}
            onDumpFeePerTonChange={setDumpFeePerTon}
            laborModeValue="manual"
            manualLaborTotalValue={laborCostRaw}
            onManualLaborTotalChange={(value) => {
              if (/^[0-9]*$/.test(value)) setLaborCostRaw(value);
            }}
            onManualLaborTotalBlur={() => {
              const n = laborCostRaw.trim() === "" ? 0 : Number(laborCostRaw);
              const safe = Number.isFinite(n) ? Math.round(n) : 0;
              setLaborCostRaw(safe ? String(safe) : "");
              setLaborCost(safe);
            }}
          />
        ) : (
          <>
        <div className="mb-3">
          <motion.nav
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-3 flex items-center justify-between gap-4 rounded-[16px] border border-white/[0.08] bg-slate-950/55 px-3 py-2 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.6),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl sm:px-4"
            aria-label="FieldDive workspace"
          >
            <div className="flex items-center gap-3 sm:gap-5">
              <Link
                href="/tools"
                className="group flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition hover:bg-white/[0.04]"
              >
                <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-cyan-400/30 bg-gradient-to-br from-cyan-500/30 via-blue-500/20 to-slate-950/60 text-[11px] font-extrabold tracking-tight text-cyan-50 shadow-[0_0_24px_rgba(34,211,238,0.35)]">
                  <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(165,243,252,0.55),transparent_60%)]" aria-hidden />
                  <span className="relative">FD</span>
                </span>
                <div className="hidden flex-col leading-tight sm:flex">
                  <span className="text-[13px] font-semibold tracking-tight text-white">FieldDive</span>
                  <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-cyan-200/70">Contractor OS</span>
                </div>
              </Link>
              <span className="hidden h-6 w-px bg-white/[0.08] sm:block" aria-hidden />
              <div className="hidden items-center gap-1 lg:flex">
                <Link
                  href="/tools/roofing"
                  className="rounded-lg border border-cyan-400/25 bg-cyan-500/[0.10] px-3 py-1.5 text-[12px] font-semibold text-cyan-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                >
                  New Job
                </Link>
                <Link
                  href="/tools/roofing/saved"
                  className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-white/55 transition hover:bg-white/[0.04] hover:text-white/85"
                >
                  Command Center
                </Link>
                <span className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-white/40" title="Coming soon">
                  AI Library
                </span>
                <span className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-white/40" title="Coming soon">
                  Settings
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden items-center gap-2 rounded-xl border border-white/[0.10] bg-white/[0.03] px-3 py-1.5 text-[12px] text-white/55 md:flex">
                <span aria-hidden>⌕</span>
                <span className="hidden lg:inline">Search jobs, customers, ZIPs</span>
                <span className="hidden rounded-md border border-white/[0.10] bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-semibold text-white/50 lg:inline">⌘K</span>
              </div>
              <span
                className="relative hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-white/70 sm:flex"
                aria-hidden
              >
                <span className="text-base">◐</span>
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
              </span>
              <Link
                href="/tools"
                className="hidden items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[12px] font-medium text-white/65 transition hover:bg-white/[0.06] hover:text-white sm:inline-flex"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Tools
              </Link>
              <SignOutButton />
            </div>
          </motion.nav>

          <header className="sr-only">
            <h1>New Roofing Job</h1>
          </header>

          <div className="sr-only">
            <RoofingTabs active="estimate" />
          </div>

          {hasMounted && isLocked && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
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
                  className="shrink-0 rounded-full border border-amber-400/30 bg-white/10 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-white/20"
                >
                  New Job
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-cyan-400/18 bg-gradient-to-br from-slate-950/80 via-slate-950/55 to-blue-950/30 px-4 py-3 shadow-[0_24px_70px_-46px_rgba(34,211,238,0.55),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl sm:px-5 sm:py-3.5">
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute -left-12 top-1/2 h-44 w-44 -translate-y-1/2 rounded-full bg-cyan-500/[0.08] blur-3xl" />
            <div className="absolute right-0 top-0 h-28 w-56 bg-blue-500/[0.05] blur-3xl" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />
          </div>

          <div className="relative flex items-center gap-5">
            <div className="flex shrink-0 items-center gap-3">
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center" aria-hidden>
                <span className="absolute inset-0 rounded-full bg-cyan-400/[0.22] blur-lg animate-pulse" />
                <span className="absolute -inset-0.5 rounded-full border border-cyan-300/35" />
                <span className="absolute inset-1 rounded-full bg-gradient-to-br from-cyan-300/55 via-blue-500/30 to-slate-950/70 shadow-[inset_0_0_22px_rgba(165,243,252,0.45),0_0_26px_rgba(34,211,238,0.55)]" />
                <span className="absolute inset-2 rounded-full bg-[radial-gradient(circle_at_30%_25%,rgba(186,230,253,0.95),rgba(34,211,238,0.30)_55%,transparent_78%)]" />
                <span className="relative text-[10px] font-bold uppercase tracking-wider text-cyan-50">AI</span>
              </div>
              <div className="min-w-0">
                <div className="text-[12px] font-semibold text-white sm:text-[14px]">FieldDive is preparing this job</div>
                <div className="text-[10px] leading-snug text-white/50">AI is assembling the job packet and proposal path. You verify what matters.</div>
              </div>
            </div>

            <span className="hidden h-10 w-px bg-white/[0.08] lg:block" aria-hidden />

            <div className="min-w-0 flex-1">
              <ol
                className="relative grid grid-cols-5 gap-0"
                role="list"
                aria-label="Job preparation timeline"
              >
                {aiConductorStripItems.map((item, idx) => {
                  const status = item.ready ? "Complete" : item.notReadyStatus === "Needs input" ? "Needs input" : "Waiting";
                  const isFirst = idx === 0;
                  const isLast = idx === aiConductorStripItems.length - 1;
                  const prevReady = idx > 0 && aiConductorStripItems[idx - 1].ready;
                  const isInProgress = !item.ready && idx > 0 && aiConductorStripItems[idx - 1].ready;
                  const nodeStateClass = item.ready
                    ? "border-emerald-300/70 bg-emerald-500/25 text-emerald-50 shadow-[0_0_18px_rgba(16,185,129,0.55),inset_0_0_8px_rgba(167,243,208,0.25)]"
                    : isInProgress
                      ? "border-cyan-300/70 bg-cyan-500/25 text-cyan-50 shadow-[0_0_18px_rgba(34,211,238,0.65),inset_0_0_8px_rgba(165,243,252,0.30)]"
                      : "border-white/18 bg-white/[0.04] text-white/55";
                  const labelTone = item.ready
                    ? "text-white/95"
                    : isInProgress
                      ? "text-cyan-50"
                      : "text-white/60";
                  const statusTone = item.ready
                    ? "text-emerald-200/85"
                    : isInProgress
                      ? "text-cyan-200/85"
                      : item.notReadyStatus === "Needs input"
                        ? "text-amber-200/75"
                        : "text-white/40";
                  return (
                    <li key={item.label} className="relative flex flex-col items-center" role="listitem">
                      {!isFirst && (
                        <span
                          className={`pointer-events-none absolute right-1/2 top-[14px] h-[2px] w-full ${
                            prevReady ? "bg-gradient-to-r from-emerald-400/55 to-emerald-300/35" : "bg-white/10"
                          }`}
                          aria-hidden
                        />
                      )}
                      {!isLast && (
                        <span
                          className={`pointer-events-none absolute left-1/2 top-[14px] h-[2px] w-full ${
                            item.ready ? "bg-gradient-to-r from-emerald-300/35 to-emerald-400/55" : "bg-white/10"
                          }`}
                          aria-hidden
                        />
                      )}
                      <span
                        className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-bold tabular-nums ${nodeStateClass}`}
                        aria-hidden
                      >
                        {item.ready ? "✓" : idx + 1}
                      </span>
                      <span className={`mt-1.5 text-center text-[10px] font-semibold leading-tight ${labelTone}`}>
                        {item.label}
                      </span>
                      <span className={`text-center text-[9px] font-medium leading-tight ${statusTone}`}>
                        {status}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </div>

        <div className="mt-3 sm:mt-4">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_400px] 2xl:grid-cols-[minmax(0,1fr)_440px] xl:gap-5 2xl:gap-6">
          {/* Workflow canvas */}
          <div className="space-y-3 xl:space-y-4">

            {/* Customer & Job */}
            <div
              id="customer-job-section"
              className="rounded-2xl border border-blue-400/22 bg-slate-950/40 p-3 shadow-[0_28px_90px_-56px_rgba(37,99,235,0.55),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl sm:p-3.5"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-blue-300/30 bg-blue-500/15 text-[12px] font-bold tabular-nums text-blue-100 shadow-[0_0_22px_rgba(59,130,246,0.18)]"
                  aria-hidden
                >
                  1
                </span>
                <h2 className="text-base font-semibold tracking-tight text-white sm:text-[17px]">Job Capture</h2>
                <span className="text-[12px] text-white/50">Customer + property</span>
                <div className="ml-auto flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    aria-current="step"
                    className="rounded-lg border border-blue-400/45 bg-blue-500/[0.14] px-2.5 py-1 text-[11px] font-semibold text-blue-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]"
                  >
                    Manual
                  </button>
                  <button
                    type="button"
                    disabled
                    aria-label="Photos capture (coming soon)"
                    className="cursor-not-allowed rounded-lg border border-white/[0.10] bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white/55"
                  >
                    Photos
                  </button>
                  <button
                    type="button"
                    disabled
                    aria-label="Voice capture (coming soon)"
                    className="cursor-not-allowed rounded-lg border border-white/[0.10] bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white/55"
                  >
                    Voice
                  </button>
                  <button
                    type="button"
                    disabled
                    aria-label="Customer message capture (coming soon)"
                    className="cursor-not-allowed rounded-lg border border-white/[0.10] bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white/55"
                  >
                    Message
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-12">
                <div className="flex flex-col gap-3 xl:col-span-5">
                  <div className="rounded-xl border border-white/[0.10] bg-slate-950/35 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/42">Customer</div>
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                          (customerName || "").trim() && hasCustomerEmail
                            ? "border-emerald-400/28 bg-emerald-500/12 text-emerald-100/90"
                            : "border-amber-400/25 bg-amber-500/10 text-amber-100/85"
                        }`}
                      >
                        {(customerName || "").trim() && hasCustomerEmail ? "Ready" : "Needs input"}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[14px] font-semibold leading-snug text-white">
                      {(customerName || "").trim() ? customerName : "Customer not added"}
                    </p>
                    <p className="mt-1 break-all text-[12px] leading-snug text-blue-200/85">
                      {(customerEmail || "").trim() ? customerEmail : "Email needed"}
                    </p>
                    <p className="text-[11px] text-white/45">
                      {(customerPhone || "").trim() ? customerPhone : "Phone optional"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/[0.10] bg-slate-950/35 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/42">Property</div>
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                          (jobAddress1 || "").trim() && (jobZip || "").trim().length === 5
                            ? "border-emerald-400/28 bg-emerald-500/12 text-emerald-100/90"
                            : "border-amber-400/25 bg-amber-500/10 text-amber-100/85"
                        }`}
                      >
                        {(jobAddress1 || "").trim() && (jobZip || "").trim().length === 5 ? "Ready" : "Needs input"}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[14px] font-semibold leading-snug text-white">
                      {(jobAddress1 || "").trim() ? jobAddress1 : "Property address needed"}
                    </p>
                    <p className="mt-1 text-[12px] leading-snug text-blue-200/82">
                      {[jobCity, jobState, jobZip].filter(Boolean).join(", ") || "City, state, and ZIP"}
                    </p>
                  </div>
                </div>
                <div
                  className="relative overflow-hidden rounded-xl border border-blue-400/25 bg-slate-950/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_18px_60px_-40px_rgba(34,211,238,0.4)] xl:col-span-7"
                  style={{
                    backgroundImage:
                      "radial-gradient(ellipse at 70% 30%, rgba(34,211,238,0.22), transparent 55%), radial-gradient(ellipse at 30% 90%, rgba(59,130,246,0.22), transparent 60%), linear-gradient(180deg, #0a1424 0%, #0d1b30 50%, #07111e 100%)",
                  }}
                >
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/45 to-transparent" aria-hidden />

                  <svg
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-[58%] w-full opacity-[0.55]"
                    viewBox="0 0 400 220"
                    preserveAspectRatio="none"
                    aria-hidden
                  >
                    <defs>
                      <linearGradient id="roofPreviewSky" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(34,211,238,0.28)" />
                        <stop offset="100%" stopColor="rgba(15,23,42,0)" />
                      </linearGradient>
                      <linearGradient id="roofPreviewRoof" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(125,211,252,0.85)" />
                        <stop offset="100%" stopColor="rgba(56,189,248,0.55)" />
                      </linearGradient>
                      <linearGradient id="roofPreviewWall" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(148,163,184,0.42)" />
                        <stop offset="100%" stopColor="rgba(30,41,59,0.55)" />
                      </linearGradient>
                    </defs>
                    <rect x="0" y="0" width="400" height="220" fill="url(#roofPreviewSky)" />
                    <path
                      d="M40 175 L40 110 L160 60 L280 110 L280 175 Z"
                      fill="url(#roofPreviewWall)"
                      stroke="rgba(165,243,252,0.45)"
                      strokeWidth="1"
                    />
                    <path
                      d="M30 115 L160 50 L290 115 L275 122 L160 65 L45 122 Z"
                      fill="url(#roofPreviewRoof)"
                      stroke="rgba(186,230,253,0.7)"
                      strokeWidth="1"
                    />
                    <path
                      d="M280 175 L280 130 L370 90 L370 175 Z"
                      fill="url(#roofPreviewWall)"
                      stroke="rgba(165,243,252,0.4)"
                      strokeWidth="1"
                    />
                    <path
                      d="M275 132 L280 130 L370 90 L375 95 Z"
                      fill="url(#roofPreviewRoof)"
                      stroke="rgba(186,230,253,0.65)"
                      strokeWidth="1"
                    />
                    <rect x="120" y="130" width="32" height="45" fill="rgba(15,23,42,0.85)" stroke="rgba(165,243,252,0.45)" strokeWidth="1" rx="2" />
                    <rect x="170" y="125" width="22" height="22" fill="rgba(34,211,238,0.18)" stroke="rgba(165,243,252,0.45)" strokeWidth="1" rx="2" />
                    <rect x="200" y="125" width="22" height="22" fill="rgba(34,211,238,0.18)" stroke="rgba(165,243,252,0.45)" strokeWidth="1" rx="2" />
                    <rect x="60" y="125" width="22" height="22" fill="rgba(34,211,238,0.18)" stroke="rgba(165,243,252,0.45)" strokeWidth="1" rx="2" />
                    <line x1="0" y1="175" x2="400" y2="175" stroke="rgba(165,243,252,0.30)" strokeWidth="1" />
                  </svg>

                  <div className="pointer-events-none absolute inset-0 opacity-[0.10]" aria-hidden style={{
                    backgroundImage:
                      "linear-gradient(rgba(165,243,252,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(165,243,252,0.18) 1px, transparent 1px)",
                    backgroundSize: "44px 44px",
                  }} />

                  <div className="relative flex h-full min-h-[13.5rem] flex-col justify-between p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200/80">Property preview</div>
                        <div className="mt-1 truncate text-[14px] font-semibold text-white">
                          {(jobAddress1 || "").trim() ? jobAddress1 : "Awaiting address"}
                        </div>
                        <div className="truncate text-[11px] text-white/55">
                          {[jobCity, jobState, jobZip].filter(Boolean).join(", ") || "Location pending"}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full border border-white/[0.10] bg-slate-950/65 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/55">
                        Coming soon
                      </span>
                    </div>
                    <div className="flex items-end justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/55">
                        <span className="rounded-md border border-white/[0.12] bg-slate-950/60 px-2 py-0.5">Satellite</span>
                        <span className="rounded-md border border-white/[0.12] bg-slate-950/60 px-2 py-0.5">Street view</span>
                        <span className="rounded-md border border-white/[0.12] bg-slate-950/60 px-2 py-0.5">Photos</span>
                      </div>
                      <span className="rounded-full border border-cyan-400/25 bg-cyan-500/[0.12] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-cyan-100/85 shadow-[0_0_14px_rgba(34,211,238,0.28)]">
                        Preview
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <details className="group mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.02] open:bg-white/[0.03] open:border-white/[0.12]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-left">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.10] bg-white/[0.04] text-[12px] text-white/65">
                      ✎
                    </span>
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold text-white/85">Edit manual details</div>
                      <div className="text-[11px] text-white/45">
                        Customer · Property · ZIP defaults
                      </div>
                    </div>
                  </div>
                  <span className="flex items-center gap-2 text-[11px] font-medium text-white/50">
                    <span className="hidden sm:inline">Tap to expand</span>
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/[0.10] text-[10px] transition-transform group-open:rotate-180" aria-hidden>
                      ▾
                    </span>
                  </span>
                </summary>
              <form autoComplete="off" className="mt-1 space-y-3 px-4 pb-4 sm:px-5 sm:pb-5">
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 sm:p-4">
                  <div className="text-xs font-semibold tracking-wide text-white/85">Customer</div>
                  <p className="mt-1 text-[11px] leading-snug text-white/45">Who the proposal and follow-ups are for.</p>
                  <div className="mt-3 space-y-3">
                <div className="space-y-1.5">
                  <label htmlFor="customer-name" className="block text-sm font-medium text-white/80">Customer Name *</label>
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
                <div className={"space-y-1.5" + (attentionField === "customerEmail" ? " rounded-2xl ring-2 ring-cyan-400/25 bg-cyan-400/[0.04] shadow-[0_0_0_1px_rgba(34,211,238,0.10),0_0_24px_rgba(34,211,238,0.08)]" : "")}>
                  <label htmlFor="customer-email" className="block text-sm font-medium text-white/80">Customer Email *</label>
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
                  <label htmlFor="customer-phone" className="block text-sm font-medium text-white/80">Customer Phone (optional)</label>
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
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 sm:p-4">
                  <div className="text-xs font-semibold tracking-wide text-white/85">Property</div>
                  <p className="mt-1 text-[11px] leading-snug text-white/45">Where the job is happening and which ZIP defaults should apply.</p>
                  <div className="mt-3 space-y-3">
                <div className="space-y-1.5">
                  <label htmlFor="job-address" className="block text-sm font-medium text-white/80">Job Address</label>
                  <input
                    id="job-address"
                    name="job_address1_field"
                    type="text"
                    value={jobAddress1}
                    onChange={(e) => setJobAddress1(e.target.value)}
                    onBlur={(e) => {
                      const cleaned = e.target.value.replace(/\s+/g, " ").trim();
                      if (cleaned !== jobAddress1) setJobAddress1(cleaned);
                    }}
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
                    <label htmlFor="job-city" className="block text-sm font-medium text-white/80">City</label>
                    <input
                      id="job-city"
                      name="job_city_field"
                      type="text"
                      value={jobCity}
                      onChange={(e) => setJobCity(e.target.value)}
                      onBlur={(e) => {
                        const cleaned = e.target.value
                          .replace(/[^a-zA-Z\s.'-]/g, "")
                          .replace(/\s+/g, " ")
                          .trim();

                        if (cleaned !== jobCity) {
                          setJobCity(cleaned);
                        }
                      }}
                      placeholder="City"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="words"
                      spellCheck={false}
                      className="w-full rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-3 text-white/95 placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-blue-500/35 focus:border-white/25 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="job-state" className="block text-sm font-medium text-white/80">State</label>
                    <input
                      id="job-state"
                      name="job_state_field"
                      type="text"
                      value={jobState}
                      onChange={(e) => setJobState(e.target.value)}
                      onBlur={(e) => {
                        const cleaned = e.target.value
                          .replace(/[^a-zA-Z]/g, "")
                          .toUpperCase()
                          .trim();
                        if (cleaned !== jobState) setJobState(cleaned);
                      }}
                      placeholder="State"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      className="w-full rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-3 text-white/95 placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-blue-500/35 focus:border-white/25 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5 rounded-2xl transition-all duration-200">
                    <label htmlFor="customer-job-zip" className="flex items-center gap-1.5 text-sm font-medium text-white/80">
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
                  </div>
                </div>
              </form>
              </details>
            </div>

            <div className="rounded-2xl border border-blue-400/18 bg-slate-950/35 p-3 shadow-[0_28px_90px_-60px_rgba(37,99,235,0.45),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl sm:p-3.5">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-blue-300/30 bg-blue-500/15 text-[12px] font-bold tabular-nums text-blue-100 shadow-[0_0_22px_rgba(59,130,246,0.18)]"
                  aria-hidden
                >
                  2
                </span>
                <h2 className="text-base font-semibold tracking-tight text-white sm:text-[17px]">Prepared Job Packet</h2>
                <span className="text-[12px] text-white/50">Scope at a glance</span>
                <span className="ml-auto rounded-full border border-emerald-400/24 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold tabular-nums text-emerald-100/90">
                  {jobReadinessReadyCount}/{jobReadinessItems.length} prepared
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                <div className="flex flex-col rounded-xl border border-emerald-400/20 bg-emerald-500/[0.08] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-200/75">Roof size</div>
                    <span
                      className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide ${
                        hasRoofArea
                          ? "border-emerald-400/28 bg-emerald-500/14 text-emerald-100/90"
                          : "border-amber-400/24 bg-amber-500/10 text-amber-100/85"
                      }`}
                    >
                      {hasRoofArea ? "Ready" : "Need"}
                    </span>
                  </div>
                  <div className="mt-1 text-[15px] font-semibold tabular-nums leading-tight text-white">
                    {hasRoofArea ? `${squares.toFixed(1)} SQ` : "—"}
                  </div>
                  <p className="text-[10px] leading-tight text-white/50">
                    {hasRoofArea ? `${Number(area || 0).toLocaleString()} sq ft` : "Enter roof size"}
                  </p>
                </div>
                <div className="flex flex-col rounded-xl border border-blue-400/16 bg-blue-500/[0.07] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-blue-200/75">Difficulty</div>
                    <span className="shrink-0 rounded-full border border-white/12 bg-white/[0.05] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-white/65">
                      Wait
                    </span>
                  </div>
                  <div className="mt-1 text-[13px] font-semibold leading-tight text-white">Contractor input</div>
                  <p className="text-[10px] leading-tight text-white/50">Pitch · stories · access</p>
                </div>
                <div className="flex flex-col rounded-xl border border-cyan-400/16 bg-cyan-500/[0.07] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-cyan-200/75">Waste</div>
                    <span
                      className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide ${
                        hasRoofArea
                          ? "border-cyan-400/22 bg-cyan-500/12 text-cyan-100/90"
                          : "border-amber-400/24 bg-amber-500/10 text-amber-100/85"
                      }`}
                    >
                      {hasRoofArea ? "Set" : "Need"}
                    </span>
                  </div>
                  <div className="mt-1 text-[15px] font-semibold tabular-nums leading-tight text-white">
                    {hasRoofArea ? `${Number(waste || 0)}%` : "—"}
                  </div>
                  <p className="text-[10px] leading-tight text-white/50">
                    {hasRoofArea ? `${adjustedSquares.toFixed(1)} adj SQ` : "Apply after roof size"}
                  </p>
                </div>
                <div className="flex flex-col rounded-xl border border-amber-400/16 bg-amber-500/[0.075] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-amber-200/75">Tear-off</div>
                    <span className="shrink-0 rounded-full border border-white/16 bg-white/[0.07] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-white/72">
                      Pick
                    </span>
                  </div>
                  <div className="mt-1 text-[13px] font-semibold leading-tight text-white">
                    {includeDebrisRemoval ? "Included" : "Not included"}
                  </div>
                  <p className="text-[10px] leading-tight text-white/50">
                    {includeDebrisRemoval
                      ? `${removalType === "architectural" ? "Architectural" : "Standard"}`
                      : "Toggle in scope"}
                  </p>
                </div>
                <div className="flex flex-col rounded-xl border border-violet-400/16 bg-violet-500/[0.075] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-violet-200/75">System</div>
                    <span className="shrink-0 rounded-full border border-violet-400/22 bg-violet-500/12 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-violet-100/85">
                      Set
                    </span>
                  </div>
                  <div className="mt-1 text-[13px] font-semibold leading-tight text-white">{selectedTierLabel}</div>
                  <p className="text-[10px] leading-tight text-white/50">Customer-facing tier</p>
                </div>
                <div className="flex flex-col rounded-xl border border-emerald-400/16 bg-slate-950/30 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-200/75">Proposal</div>
                    <span
                      className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide ${
                        hasCustomerEmail && hasRoofArea && hasPrice && hasAIWording
                          ? "border-emerald-400/28 bg-emerald-500/14 text-emerald-100/90"
                          : "border-violet-400/20 bg-violet-500/10 text-violet-100/85"
                      }`}
                    >
                      {hasCustomerEmail && hasRoofArea && hasPrice && hasAIWording ? "Ready" : "Wait"}
                    </span>
                  </div>
                  <div className="mt-1 text-[13px] font-semibold leading-tight text-white">
                    {hasCustomerEmail && hasRoofArea && hasPrice && hasAIWording ? "Ready to send" : "Needs info"}
                  </div>
                  <p className="text-[10px] leading-tight text-white/50">
                    {hasCustomerEmail && hasRoofArea && hasPrice && hasAIWording
                      ? "Email · scope · price · wording"
                      : "Complete remaining steps"}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <div className="rounded-2xl border border-white/[0.10] bg-slate-950/40 p-3 shadow-[0_28px_90px_-60px_rgba(15,23,42,0.7),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl sm:p-3.5">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-blue-300/30 bg-blue-500/15 text-[12px] font-bold tabular-nums text-blue-100 shadow-[0_0_22px_rgba(59,130,246,0.18)]"
                    aria-hidden
                  >
                    3
                  </span>
                  <h2
                    id="inputs-heading"
                    className="text-base font-semibold tracking-tight text-white sm:text-[17px]"
                  >
                    Scope Builder
                  </h2>
                  <span className="text-[12px] text-white/50">AI recommends the optimal roofing system</span>
                </div>
                <div className="mt-2.5 h-px w-full bg-gradient-to-r from-white/[0.10] via-white/[0.05] to-transparent" />

                <div className="mt-2.5 grid grid-cols-1 gap-2.5 lg:grid-cols-12">
                  <div className="rounded-xl border border-cyan-400/22 bg-slate-950/45 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] lg:col-span-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200/75">Recommended system</div>
                    <div className="mt-2 flex items-start gap-2.5">
                      <div
                        className="relative h-12 w-14 shrink-0 overflow-hidden rounded-md border border-white/[0.10]"
                        style={{
                          backgroundImage:
                            "linear-gradient(180deg, rgba(125,211,252,0.55) 0%, rgba(56,189,248,0.30) 35%, rgba(15,23,42,0.85) 100%)",
                        }}
                        aria-hidden
                      >
                        <svg viewBox="0 0 56 48" className="h-full w-full">
                          <path d="M2 28 L28 6 L54 28 L48 32 L28 12 L8 32 Z" fill="rgba(186,230,253,0.85)" stroke="rgba(34,211,238,0.85)" strokeWidth="0.5" />
                          <path d="M8 32 L48 32 L48 46 L8 46 Z" fill="rgba(15,23,42,0.65)" stroke="rgba(165,243,252,0.45)" strokeWidth="0.5" />
                          <rect x="22" y="36" width="8" height="10" fill="rgba(34,211,238,0.30)" stroke="rgba(165,243,252,0.5)" strokeWidth="0.4" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold leading-tight text-white">
                          {tierConfig[roofingTier].label}
                        </div>
                        <div className="mt-0.5 text-[11px] text-white/55 capitalize">
                          {tierConfig[roofingTier].includes[0] || "Architectural shingles"}
                        </div>
                        <span className="mt-1.5 inline-flex rounded-full border border-cyan-400/22 bg-cyan-500/[0.08] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-cyan-100/85">
                          {selectedTierLabel} tier
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/[0.10] bg-slate-950/35 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] lg:col-span-5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">Included scope</div>
                    <div className="mt-2 grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2">
                      {[
                        ...tierConfig[roofingTier].includes,
                        includeDebrisRemoval ? "Tear-off & disposal" : "Tear-off (not included)",
                        "Starter strip",
                        "Ridge cap shingles",
                      ].slice(0, 6).map((item, i) => {
                        const isTearOff = item.toLowerCase().includes("tear-off");
                        const isReady = isTearOff ? includeDebrisRemoval : true;
                        return (
                          <div key={`${item}-${i}`} className="flex items-center gap-2 text-[11px] text-white/75">
                            <span
                              className={
                                isReady
                                  ? "flex h-3.5 w-3.5 items-center justify-center rounded-full border border-emerald-300/55 bg-emerald-400/25 text-[8px] text-emerald-50 shadow-[0_0_6px_rgba(16,185,129,0.45)]"
                                  : "flex h-3.5 w-3.5 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-[8px] text-white/45"
                              }
                              aria-hidden
                            >
                              {isReady ? "✓" : "·"}
                            </span>
                            <span className="capitalize">{item}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 lg:col-span-3">
                    <a
                      href="#scope-inputs"
                      className="group flex items-center justify-between gap-2 rounded-xl border border-cyan-400/35 bg-cyan-500/[0.14] px-3 py-2.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_22px_-8px_rgba(34,211,238,0.45)] transition hover:bg-cyan-500/[0.18]"
                    >
                      <div className="min-w-0">
                        <div className="text-[12px] font-semibold text-white">Confirm system</div>
                        <div className="text-[10px] text-cyan-100/75">Lock and continue</div>
                      </div>
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-cyan-400/30 text-[12px] text-cyan-50" aria-hidden>
                        →
                      </span>
                    </a>
                    <a
                      href="#scope-inputs"
                      className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.12] bg-white/[0.03] px-3 py-2 text-left transition hover:bg-white/[0.05]"
                    >
                      <div className="text-[12px] font-medium text-white/85">Edit scope</div>
                      <span className="text-[12px] text-white/45" aria-hidden>✎</span>
                    </a>
                    <button
                      type="button"
                      className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.10] bg-white/[0.02] px-3 py-2 text-left text-[12px] font-medium text-white/65 transition hover:bg-white/[0.04]"
                    >
                      <span>Need more info</span>
                      <span className="text-[12px] text-white/40" aria-hidden>?</span>
                    </button>
                  </div>
                </div>

                <details id="scope-inputs" className="group mt-3 rounded-xl border border-white/[0.08] bg-white/[0.02] open:bg-white/[0.03]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-left">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md border border-white/[0.10] bg-white/[0.04] text-[11px] text-white/65">✎</span>
                      <div className="min-w-0">
                        <div className="text-[12px] font-semibold text-white/85">Edit roof size, waste &amp; bundle cost</div>
                        <div className="text-[10px] text-white/45">Contractor inputs · live pricing</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-medium text-white/45 transition group-open:rotate-180" aria-hidden>▾</span>
                  </summary>
                  <div className="space-y-2 border-t border-white/[0.06] px-3 py-3">
                  <div
                    className={
                      attentionField === "roofArea"
                        ? "rounded-lg border border-white/[0.08] bg-white/[0.02] p-1 transition-all duration-200"
                        : ""
                    }
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-end sm:gap-2.5">
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/28 sm:pb-1.5">
                        Roof size
                      </span>
                      <div className="min-w-0 flex-1 sm:max-w-md">
                        <label htmlFor="area" className="sr-only">
                          Square feet
                        </label>
                        <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.04] px-3 py-2 transition-colors focus-within:border-white/14 focus-within:ring-1 focus-within:ring-white/10">
                          <Ruler className="h-4 w-4 shrink-0 text-white/70" aria-hidden />
                          <input
                            id="area"
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step={1}
                            value={area ?? ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              setArea(v.trim() === "" ? "" : String(Number(v) || 0));
                            }}
                            placeholder="e.g. 2400"
                            className="min-w-0 flex-1 border-0 bg-transparent py-0 pr-1 text-[13px] text-white/95 placeholder:text-white/35 focus:outline-none focus:ring-0 [appearance:textfield]"
                          />
                          <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/65">
                            sq ft
                          </span>
                        </div>
                      </div>
                    </div>
                    {squares > 0 && (
                      <p className="mt-0 text-[10px] tabular-nums text-white/40">
                        ≈ {squares.toFixed(1)} squares
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="mb-1 text-[11px] text-white/38">Affects material waste.</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {ROOFING_WASTE_PRESETS.map((opt) => {
                        const selected =
                          waste.trim() !== "" &&
                          Number.isFinite(parseFloat(waste)) &&
                          Math.abs(parseFloat(waste) - opt.pct) < 0.0001;
                        const idleTone =
                          opt.pct === 10
                            ? "border-sky-400/10 bg-sky-500/[0.03]"
                            : opt.pct === 15
                              ? "border-violet-400/10 bg-violet-500/[0.03]"
                              : "border-amber-400/10 bg-amber-500/[0.03]";
                        const selectedTone =
                          opt.pct === 10
                            ? "border-cyan-200/60 bg-cyan-400/[0.15] shadow-[0_0_0_2px_rgba(103,232,249,0.28),0_0_32px_-6px_rgba(34,211,238,0.38)]"
                            : opt.pct === 15
                              ? "border-violet-200/55 bg-violet-500/[0.14] shadow-[0_0_0_2px_rgba(167,139,250,0.26),0_0_30px_-6px_rgba(139,92,246,0.32)]"
                              : "border-amber-200/50 bg-amber-500/[0.12] shadow-[0_0_0_2px_rgba(251,191,36,0.24),0_0_30px_-6px_rgba(245,158,11,0.26)]";
                        return (
                          <button
                            key={opt.pct}
                            type="button"
                            onClick={() => setWaste(String(opt.pct))}
                            className={`rounded-2xl border px-5 py-6 text-left transition sm:min-h-[6.75rem] ${
                              selected
                                ? `${selectedTone} text-white`
                                : `${idleTone} text-white/45 hover:border-white/14 hover:bg-white/[0.045] hover:text-white/65`
                            }`}
                          >
                            <div className="text-sm font-semibold text-white">{opt.label}</div>
                            <div className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-white">
                              {opt.pct}%
                            </div>
                            <div
                              className={`mt-1 truncate text-[11px] leading-tight ${selected ? "text-white/58" : "text-white/28"}`}
                            >
                              {opt.helper}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {squares > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                          <div className="relative h-2 w-full">
                            <div className="absolute inset-0 bg-white/60" style={{ width: "100%" }} />
                            <div
                              className="absolute inset-y-0 left-0 bg-white/20"
                              style={{ width: `${Math.min(100, Math.max(0, wasteNum))}%` }}
                            />
                          </div>
                        </div>
                        <div className="flex justify-between text-[10px] text-white/50">
                          <span>Base</span>
                          <span>Waste</span>
                        </div>
                        <div className="text-[11px] text-white/60">
                          Adjusted: {adjustedSquares.toFixed(1)} squares
                        </div>
                      </div>
                    )}
                    <p className="mt-0.5 text-sm font-medium text-white/70">Most contractors use Standard</p>
                    {(() => {
                      const wn = parseFloat(waste);
                      const isPreset =
                        waste.trim() !== "" &&
                        Number.isFinite(wn) &&
                        ROOFING_WASTE_PRESETS.some((p) => Math.abs(wn - p.pct) < 0.0001);
                      if (isPreset || !waste.trim() || !Number.isFinite(wn)) return null;
                      return (
                        <div className="mt-0.5 inline-flex rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10px] text-white/48">
                          Custom {waste}%
                        </div>
                      );
                    })()}
                  </div>

                  <div className="-mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <Layers className="h-4 w-4 shrink-0 text-white/70" aria-hidden />
                    <label
                      htmlFor="bundleCost"
                      className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/80"
                    >
                      Bundle cost
                    </label>
                    <div className="flex min-w-[9rem] flex-1 items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.04] px-3 py-2 transition-colors focus-within:border-white/14 focus-within:ring-1 focus-within:ring-white/10 sm:max-w-[11rem]">
                      <DollarSign className="h-4 w-4 shrink-0 text-white/70" aria-hidden />
                      <input
                        id="bundleCost"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        value={bundleCost}
                        onChange={(e) => setBundleCost(e.target.value)}
                        placeholder="0.00"
                        title="What you pay per bundle from your supplier."
                        className="min-w-0 flex-1 border-0 bg-transparent py-0 text-[13px] text-white outline-none placeholder:text-white/25 [appearance:textfield]"
                      />
                    </div>
                  </div>
                  <p className="mt-0 text-[9px] text-white/26">Typical $30–45 per bundle</p>
                  {bundles > 0 && adjustedSquares > 0 && (
                    <div className="space-y-1">
                      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                        <div
                          className="h-full shrink-0 rounded-l-full bg-sky-500/50"
                          style={{
                            width: `${Math.min(100, Math.max(0, (squares / adjustedSquares) * 100))}%`,
                          }}
                        />
                        <div
                          className="h-full shrink-0 rounded-r-full bg-white/[0.12]"
                          style={{
                            width: `${Math.min(100, Math.max(0, ((adjustedSquares - squares) / adjustedSquares) * 100))}%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-white/38">
                        <span>Material usage</span>
                        <span className="tabular-nums text-white/62">{bundles} bundles</span>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowAdvancedMaterials((prev) => !prev)}
                    className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-left text-[11px] font-medium text-white/48 transition hover:bg-white/[0.04]"
                  >
                      <span>Advanced (bundles per square)</span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-white/35 transition-transform duration-200 ${showAdvancedMaterials ? "rotate-180" : ""}`}
                      />
                    </button>
                    <motion.div
                      initial={false}
                      animate={{ height: showAdvancedMaterials ? "auto" : 0, opacity: showAdvancedMaterials ? 1 : 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2">
                        <InputField
                          id="bundles"
                          label="Bundles per square"
                          helper="3 per square for most shingles."
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
                </details>
              </div>
            </div>

              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 xl:items-start">
                <div className="rounded-2xl border border-emerald-400/15 bg-slate-950/40 p-4 shadow-[0_28px_90px_-60px_rgba(16,185,129,0.40),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl sm:p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-500/15 text-[12px] font-bold tabular-nums text-emerald-100 shadow-[0_0_22px_rgba(16,185,129,0.18)]"
                      aria-hidden
                    >
                      4
                    </span>
                    <h2 className="text-base font-semibold tracking-tight text-white sm:text-[17px]">Deal Control</h2>
                    <span className="text-[12px] text-white/50">Pricing &amp; tier</span>
                    <div className="ml-auto flex items-center gap-1.5">
                      <span className="rounded-md border border-emerald-400/22 bg-emerald-500/[0.08] px-2 py-0.5 text-[10px] font-semibold text-emerald-100/85">
                        Pricing mode
                      </span>
                      <span className="rounded-md border border-violet-400/22 bg-violet-500/[0.08] px-2 py-0.5 text-[10px] font-semibold text-violet-100/85">
                        Proposal tier
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 h-px w-full bg-gradient-to-r from-white/[0.10] via-white/[0.05] to-transparent" />

                  <div>
                    {/* Pricing mode */}
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                      <div className="text-sm font-medium text-white">Pricing mode</div>
                      <p className="mt-1 text-xs text-white/50">
                        Choose how you want to price this job.
                      </p>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setPricingMode("markup")}
                          className={`rounded-xl border px-4 py-3 text-left transition ${
                            pricingMode === "markup"
                              ? "border-emerald-400/40 bg-emerald-500/[0.08] text-white"
                              : "border-white/[0.08] bg-white/[0.02] text-white/70 hover:bg-white/[0.04]"
                          }`}
                        >
                          <div className="text-sm font-medium">Markup pricing</div>
                          <div className="mt-1 text-xs text-white/50">
                            Apply margin automatically.
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPricingMode("direct")}
                          className={`rounded-xl border px-4 py-3 text-left transition ${
                            pricingMode === "direct"
                              ? "border-emerald-400/40 bg-emerald-500/[0.08] text-white"
                              : "border-white/[0.08] bg-white/[0.02] text-white/70 hover:bg-white/[0.04]"
                          }`}
                        >
                          <div className="text-sm font-medium">Direct pricing</div>
                          <div className="mt-1 text-xs text-white/50">
                            Set your total directly.
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Pricing strategy */}
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 mt-5">
                      <div className="text-sm font-medium text-white">Pricing strategy</div>
                      <p className="mt-1 text-xs text-white/50">
                        Adjust your position on this job.
                      </p>

                      <div className="mt-4 grid grid-cols-3 gap-3">
                        {[
                          { label: "Competitive", value: 15 },
                          { label: "Balanced", value: 20 },
                          { label: "Premium", value: 25 },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setMargin(String(option.value))}
                            className={`rounded-xl border px-3 py-3 text-center transition ${
                              finalMarginNum === option.value
                                ? "border-emerald-400/40 bg-emerald-500/[0.08] text-white"
                                : "border-white/[0.08] bg-white/[0.02] text-white/70 hover:bg-white/[0.04]"
                            }`}
                          >
                            <div className="text-xs">{option.label}</div>
                            <div className="mt-1 text-sm font-semibold">
                              {option.value}%
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Manual adjustments */}
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 mt-5">
                      <div className="text-sm font-medium text-white">Manual adjustments</div>
                      <p className="mt-1 text-xs text-white/50">
                        Fine tune your numbers if needed.
                      </p>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-[11px] text-white/40 mb-1">
                            Custom margin
                          </div>
                          <input
                            type="number"
                            value={finalMarginNum}
                            onChange={(e) => setMargin(e.target.value)}
                            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm text-white"
                          />
                        </div>

                        <div>
                          <div className="text-[11px] text-white/40 mb-1">
                            Labor override
                          </div>
                          <input
                            type="number"
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
                            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm text-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.10] bg-slate-950/40 p-4 shadow-[0_28px_90px_-60px_rgba(15,23,42,0.7),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl sm:p-5">

                  {/* Header */}
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-500/15 text-[12px] font-bold tabular-nums text-emerald-100 shadow-[0_0_22px_rgba(16,185,129,0.18)]"
                      aria-hidden
                    >
                      5
                    </span>
                    <h2 className="text-base font-semibold tracking-tight text-white sm:text-[17px]">Proposal Readiness</h2>
                    {(() => {
                      const items = [
                        { label: "Customer", ready: hasCustomerEmail },
                        { label: "Scope", ready: hasRoofArea },
                        { label: "Pricing", ready: hasPrice },
                        { label: "Wording", ready: hasAIWording },
                      ];
                      const done = items.filter((i) => i.ready).length;
                      return (
                        <span className="ml-auto flex items-center gap-2 text-[11px] font-semibold tabular-nums text-emerald-100/85">
                          <span>{done}/{items.length} ready</span>
                          <span className="rounded-full border border-emerald-400/22 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                            {Math.round((done / items.length) * 100)}%
                          </span>
                        </span>
                      );
                    })()}
                  </div>
                  <div className="mt-3 h-px w-full bg-gradient-to-r from-white/[0.10] via-white/[0.05] to-transparent" />

                  {(() => {
                    const checklist = [
                      { label: "Customer & Property", ready: hasCustomerEmail },
                      { label: "Scope & System", ready: hasRoofArea },
                      { label: "Measurements", ready: hasRoofArea },
                      { label: "Photos & Notes", ready: hasAIWording },
                      { label: "Pricing Summary", ready: hasPrice },
                      { label: "Payment Options", ready: false },
                      { label: "Proposal Draft", ready: false },
                    ];
                    const done = checklist.filter((i) => i.ready).length;
                    const pct = Math.round((done / checklist.length) * 100);
                    return (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-medium text-white/65">{done} of {checklist.length} components ready</span>
                          <span className="rounded-full border border-emerald-400/22 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-emerald-100/90">
                            {pct}%
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
                          {checklist.map((item) => (
                            <div key={item.label} className="flex items-center gap-2 text-[11px]">
                              <span
                                className={
                                  item.ready
                                    ? "flex h-3.5 w-3.5 items-center justify-center rounded-full border border-emerald-300/55 bg-emerald-400/25 text-[8px] text-emerald-50 shadow-[0_0_6px_rgba(16,185,129,0.45)]"
                                    : "flex h-3.5 w-3.5 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-[8px] text-white/45"
                                }
                                aria-hidden
                              >
                                {item.ready ? "✓" : ""}
                              </span>
                              <span className={item.ready ? "text-white/85" : "text-white/55"}>{item.label}</span>
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={handlePreviewPdf}
                          disabled={isPreviewingPdf}
                          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/35 bg-cyan-500/[0.14] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_22px_-8px_rgba(34,211,238,0.45)] transition hover:bg-cyan-500/[0.18] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <span aria-hidden>👁</span>
                          {isPreviewingPdf ? "Opening preview…" : "Preview proposal"}
                        </button>

                        <details className="mt-3 group rounded-xl border border-white/[0.08] bg-white/[0.02] open:bg-white/[0.03]">
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[11px] font-medium text-white/55">
                            <span>Tear-off &amp; package settings</span>
                            <span className="text-white/40 transition group-open:rotate-180" aria-hidden>▾</span>
                          </summary>
                          <div className="space-y-3 border-t border-white/[0.06] px-3 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-[11px] font-medium text-white/85">Include tear-off &amp; disposal</div>
                                <div className="text-[10px] text-white/45">{includeDebrisRemoval ? "Included in estimate total" : "Excluded from estimate total"}</div>
                              </div>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={includeDebrisRemoval}
                                onClick={() => setIncludeDebrisRemoval((v) => !v)}
                                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition ${
                                  includeDebrisRemoval
                                    ? "border-emerald-400/40 bg-emerald-500/20"
                                    : "border-white/[0.10] bg-white/[0.06]"
                                }`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transition ${
                                    includeDebrisRemoval ? "translate-x-6" : "translate-x-1"
                                  }`}
                                />
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] font-medium uppercase tracking-wide text-white/45">Removal type</label>
                                <select
                                  value={removalType}
                                  onChange={(e) => setRemovalType(e.target.value as "standard" | "architectural")}
                                  disabled={!includeDebrisRemoval}
                                  className="mt-1 w-full rounded-lg border border-white/[0.07] bg-black/15 px-2 py-1.5 text-[12px] text-white outline-none disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <option value="standard">Standard</option>
                                  <option value="architectural">Architectural</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-[10px] font-medium uppercase tracking-wide text-white/45">Disposal $/ton</label>
                                <input
                                  value={dumpFeePerTon}
                                  onChange={(e) => setDumpFeePerTon(e.target.value)}
                                  inputMode="decimal"
                                  placeholder="e.g. 80"
                                  disabled={!includeDebrisRemoval}
                                  className="mt-1 w-full rounded-lg border border-white/[0.07] bg-black/15 px-2 py-1.5 text-[12px] text-white outline-none disabled:cursor-not-allowed disabled:opacity-50"
                                />
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] font-medium uppercase tracking-wide text-white/45">Roofing system</div>
                              <div className="mt-1 grid grid-cols-3 gap-1.5">
                                {(["standard","enhanced","premium"] as const).map((option) => {
                                  const selected = roofingTier === option;
                                  const label = option === "standard" ? "Core" : option === "enhanced" ? "Enhanced" : "Premium";
                                  return (
                                    <button
                                      key={option}
                                      type="button"
                                      onClick={() => setRoofingTier(option)}
                                      className={`rounded-lg border px-2 py-1.5 text-[11px] font-medium transition ${
                                        selected
                                          ? "border-emerald-300/50 bg-emerald-500/[0.18] text-white shadow-[0_0_18px_-8px_rgba(16,185,129,0.45)]"
                                          : "border-white/[0.08] bg-white/[0.025] text-white/65 hover:bg-white/[0.045]"
                                      }`}
                                    >
                                      {label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </details>
                      </div>
                    );
                  })()}
                </div>
              </div>

            <div className="rounded-2xl border border-blue-400/22 bg-slate-950/45 p-3 shadow-[0_28px_90px_-60px_rgba(59,130,246,0.45),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl sm:p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-blue-300/30 bg-blue-500/15 text-[11px] font-bold tabular-nums text-blue-100"
                  aria-hidden
                >
                  6
                </span>
                <h2 className="text-[14px] font-semibold tracking-tight text-white">Delivery</h2>
                <span className="text-[11px] text-white/45">Preview · Save · Send</span>

                <div className="ml-auto flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handlePreviewPdf}
                    disabled={isPreviewingPdf}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.10] bg-white/[0.04] px-2.5 py-1.5 text-[12px] font-medium text-white/85 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span aria-hidden>👁</span>
                    {isPreviewingPdf ? "Opening…" : "Preview"}
                  </button>
                  <button
                    type="button"
                    onClick={onDownloadPdf}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.10] bg-white/[0.04] px-2.5 py-1.5 text-[12px] font-medium text-white/85 transition hover:bg-white/[0.07]"
                  >
                    <span aria-hidden>⬇</span>
                    Download PDF
                  </button>
                  <motion.button
                    type="button"
                    onClick={saveEstimate}
                    disabled={!canSave || isSaving || isLocked}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold transition disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 ${savedFlash ? "border-emerald-400/45 bg-emerald-500/20 text-emerald-50" : "border-white/[0.10] bg-white/[0.04] text-white/85 hover:bg-white/[0.07]"}`}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isSaving ? "Saving…" : savedFlash ? "Saved ✓" : "Save"}
                  </motion.button>
                  <button
                    type="button"
                    onClick={handleSendEstimate}
                    disabled={!(customerEmail || "").trim() || !(jobAddress1 || "").trim() || isSending || isLocked}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-400/55 bg-blue-500/[0.85] px-3 py-1.5 text-[12px] font-semibold text-white shadow-[0_0_22px_-8px_rgba(59,130,246,0.7)] transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSending ? "Sending…" : sendSuccess ? "Sent ✓" : "Send proposal →"}
                  </button>
                  <details className="group relative">
                    <summary className="cursor-pointer list-none rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[12px] font-medium text-white/65 transition hover:bg-white/[0.05]">
                      More
                    </summary>
                    <div className="absolute right-0 z-20 mt-1.5 flex w-56 flex-col gap-1 rounded-lg border border-white/[0.10] bg-slate-950/95 p-1.5 shadow-xl">
                      <button type="button" onClick={handleRegenerateDescription} className="rounded-md px-2 py-1.5 text-left text-[12px] text-white/80 hover:bg-white/[0.05]">Regenerate description</button>
                      <button type="button" onClick={handleCustomizeDescription} className="rounded-md px-2 py-1.5 text-left text-[12px] text-white/80 hover:bg-white/[0.05]">Customize description</button>
                      <button type="button" onClick={loadExample} className="rounded-md px-2 py-1.5 text-left text-[12px] text-white/80 hover:bg-white/[0.05]">Load example values</button>
                      <button type="button" onClick={reset} className="rounded-md px-2 py-1.5 text-left text-[12px] text-white/80 hover:bg-white/[0.05]">Reset</button>
                      <a href="/tools/roofing/saved" className="rounded-md px-2 py-1.5 text-left text-[12px] text-white/80 hover:bg-white/[0.05]">Open Command Center</a>
                      <label className="mt-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-white/70">
                        <input
                          type="checkbox"
                          checked={saveAsZipDefaults}
                          onChange={(e) => setSaveAsZipDefaults(e.target.checked)}
                          className="rounded border-white/20 bg-white/10 text-blue-500 focus:ring-blue-500/50"
                        />
                        Save as ZIP defaults
                      </label>
                    </div>
                  </details>
                </div>
              </div>

              {(sendError || pdfError || (sendSuccess && !isSending) || zipClearedToast) && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                  {sendError ? <span className="rounded-md border border-red-400/30 bg-red-500/10 px-2 py-1 text-red-200">{sendError}</span> : null}
                  {pdfError ? <span className="rounded-md border border-red-400/30 bg-red-500/10 px-2 py-1 text-red-200">{pdfError}</span> : null}
                  {sendSuccess && !isSending ? <span className="rounded-md border border-blue-400/30 bg-blue-500/10 px-2 py-1 text-blue-200">Sent successfully.</span> : null}
                  {zipClearedToast ? <span className="rounded-md border border-white/[0.10] bg-white/[0.04] px-2 py-1 text-white/60">Cleared defaults for {jobZip}</span> : null}
                </div>
              )}
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

          {/* Sticky contractor outcome panel */}
          <div className="w-full min-w-0">
            <div className="sticky top-4 space-y-3">

              {/* HEADER + LIVE OUTCOME (4 METRICS) */}
              <div className="relative overflow-hidden rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-slate-950/75 via-blue-500/[0.08] to-slate-950/45 p-3.5 shadow-[0_30px_100px_-58px_rgba(34,211,238,0.65),inset_0_1px_0_rgba(255,255,255,0.07)] sm:p-4">
                <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-cyan-500/[0.10] blur-3xl" aria-hidden />
                <div className="pointer-events-none absolute -left-10 bottom-0 h-36 w-36 rounded-full bg-blue-500/[0.06] blur-3xl" aria-hidden />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/35 to-transparent" aria-hidden />

                <div className="relative flex items-center justify-between gap-3">
                  <div className="text-[13px] font-semibold tracking-tight text-white">Live Outcome</div>
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200/85">
                    <span className="relative flex h-1.5 w-1.5" aria-hidden>
                      <span className="absolute inset-0 rounded-full bg-emerald-400/60 animate-ping" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
                    </span>
                    Live
                  </div>
                </div>

                {(() => {
                  const total = Number(finalPrice) || 0;
                  const cost = Number(subtotal) || 0;
                  const profit = Math.max(0, total - cost);
                  const showLive = !finalShowDash && total > 0;
                  return (
                    <div className="relative mt-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-cyan-400/22 bg-cyan-500/[0.08] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                          <div className="text-[10px] font-medium text-white/55">Customer Price</div>
                          <div className="mt-1 text-[20px] font-bold leading-tight tracking-tight text-cyan-300 tabular-nums">
                            {showLive ? animatedPriceDisplay : "—"}
                          </div>
                        </div>
                        <div className="rounded-xl border border-cyan-400/22 bg-cyan-500/[0.08] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                          <div className="text-[10px] font-medium text-white/55">Job Cost</div>
                          <div className="mt-1 text-[20px] font-bold leading-tight tracking-tight text-cyan-300 tabular-nums">
                            {showLive ? formatCurrency(cost) : "—"}
                          </div>
                        </div>
                        <div className="rounded-xl border border-emerald-400/22 bg-emerald-500/[0.08] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                          <div className="text-[10px] font-medium text-white/55">Profit</div>
                          <div className="mt-1 text-[20px] font-bold leading-tight tracking-tight text-emerald-300 tabular-nums">
                            {showLive ? formatCurrency(profit) : "—"}
                          </div>
                        </div>
                        <div className="rounded-xl border border-white/[0.10] bg-white/[0.04] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                          <div className="text-[10px] font-medium text-white/55">Margin</div>
                          <div className="mt-1 text-[20px] font-bold leading-tight tracking-tight text-white tabular-nums">
                            {pricingMode === "direct"
                              ? "—"
                              : showLive
                                ? `${finalMarginNum.toFixed(1)}%`
                                : "—"}
                          </div>
                        </div>
                      </div>
                      <a
                        href="#deal-control"
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-cyan-200/75 transition hover:text-cyan-100"
                      >
                        View pricing breakdown
                        <span aria-hidden>›</span>
                      </a>
                    </div>
                  );
                })()}
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[13px] font-semibold tracking-tight text-white">
                    Job Readiness
                  </div>
                </div>
                {(() => {
                  const total = jobReadinessItems.length;
                  const done = jobReadinessReadyCount;
                  const pct = total > 0 ? done / total : 0;
                  const radius = 36;
                  const circumference = 2 * Math.PI * radius;
                  const dash = circumference * pct;
                  return (
                    <div className="mt-2.5 flex items-center gap-3">
                      <div className="relative h-20 w-20 shrink-0">
                        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden>
                          <circle
                            cx="50"
                            cy="50"
                            r={radius}
                            stroke="rgba(148,163,184,0.16)"
                            strokeWidth="8"
                            fill="transparent"
                          />
                          <circle
                            cx="50"
                            cy="50"
                            r={radius}
                            stroke="rgba(34,211,238,0.92)"
                            strokeWidth="8"
                            fill="transparent"
                            strokeDasharray={`${dash} ${circumference}`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                          <div className="text-[15px] font-bold text-cyan-300 tabular-nums leading-none">
                            {Math.round(pct * 100)}%
                          </div>
                          <div className="mt-0.5 text-[8px] font-semibold uppercase tracking-wide text-white/55">
                            Ready
                          </div>
                        </div>
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        {jobReadinessItems.map((item) => (
                          <div key={item.label} className="flex items-center gap-2 text-[11px] text-white/80">
                            <span
                              className={
                                item.ready
                                  ? "flex h-3.5 w-3.5 items-center justify-center rounded-full border border-emerald-300/55 bg-emerald-400/25 text-[8px] text-emerald-50 shadow-[0_0_6px_rgba(16,185,129,0.45)]"
                                  : "flex h-3.5 w-3.5 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-[8px] text-white/45"
                              }
                              aria-hidden
                            >
                              {item.ready ? "✓" : ""}
                            </span>
                            <span className={item.ready ? "" : "text-white/55"}>{item.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* NEXT ACTION */}
              {(() => {
                const allReady = hasCustomerEmail && hasRoofArea && hasPrice && hasAIWording;
                const headline = !hasCustomerEmail
                  ? "Add customer email"
                  : !hasRoofArea
                    ? "Enter roof size"
                    : !hasPrice
                      ? "Complete pricing inputs"
                      : !hasAIWording
                        ? "Prepare proposal wording"
                        : "Ready for proposal review";
                const detail = !hasCustomerEmail
                  ? "FieldDive needs an email before the proposal can be sent."
                  : !hasRoofArea
                    ? "Roof size unlocks material coverage and pricing readiness."
                    : !hasPrice
                      ? "Add materials and labor so FieldDive can complete the live outcome."
                      : !hasAIWording
                        ? "Proposal language is the last piece before review."
                        : "Review the proposal and send when everything looks right.";
                return (
                  <div className="relative overflow-hidden rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-cyan-500/[0.12] via-blue-500/[0.07] to-slate-950/45 p-4 shadow-[0_28px_90px_-50px_rgba(34,211,238,0.55),inset_0_1px_0_rgba(255,255,255,0.07)] sm:p-4">
                    <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-cyan-500/[0.12] blur-3xl" aria-hidden />
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/35 to-transparent" aria-hidden />
                    <div className="relative flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_6px_rgba(34,211,238,0.9)]" aria-hidden />
                        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200/85">Next action</span>
                      </div>
                      <span
                        className={
                          allReady
                            ? "rounded-full border border-emerald-400/22 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-100/85"
                            : "rounded-full border border-amber-400/22 bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-100/85"
                        }
                      >
                        {allReady ? "Ready" : "Waiting"}
                      </span>
                    </div>
                    <div className="relative mt-1.5 text-[16px] font-semibold leading-snug text-white">
                      {headline}
                    </div>
                    <p className="relative mt-1 text-[11px] leading-relaxed text-white/65">
                      {detail}
                    </p>
                    <div className="relative mt-3 flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-500/[0.14] px-3 py-2 text-[12px] font-semibold text-cyan-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-cyan-400/30 text-[12px]" aria-hidden>
                        →
                      </span>
                      <span className="truncate">{allReady ? "Open proposal review" : headline}</span>
                    </div>
                  </div>
                );
              })()}

              {/* AI OFFICE / ACTIVE TASKS */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 sm:p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md border border-cyan-400/25 bg-cyan-500/[0.10] text-[9px] font-bold uppercase tracking-wider text-cyan-100/90 shadow-[0_0_10px_rgba(34,211,238,0.3)]" aria-hidden>
                      AI
                    </span>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">
                      AI Office · Active tasks
                    </div>
                  </div>
                </div>

                {(() => {
                  const items = jobReadinessItems;
                  const completed = items.filter((x) => x.ready);
                  const pending = items.filter((x) => !x.ready);
                  const waiting = pending[0];
                  const upcoming = pending.slice(1);
                  return (
                    <div className="mt-3 space-y-3">
                      <div>
                        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em]">
                          <span className="text-emerald-200/80">Completed</span>
                          <span className="tabular-nums text-white/45">{completed.length}</span>
                        </div>
                        <div className="mt-2 space-y-1.5">
                          {completed.length === 0 && (
                            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] italic text-white/40">
                              No tasks completed yet.
                            </div>
                          )}
                          {completed.map((item) => (
                            <div key={item.label} className="flex items-center gap-2 rounded-lg border border-emerald-400/15 bg-emerald-500/[0.05] px-3 py-1.5">
                              <span className="flex h-4 w-4 items-center justify-center rounded-full border border-emerald-300/45 bg-emerald-400/25 text-[9px] text-emerald-50" aria-hidden>
                                ✓
                              </span>
                              <span className="text-[12px] font-medium text-white/80">{item.label}</span>
                              <span className="ml-auto text-[9px] font-semibold uppercase tracking-wide text-emerald-100/75">
                                Prepared
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em]">
                          <span className="text-amber-200/85">Waiting on you</span>
                          <span className="tabular-nums text-white/45">{waiting ? 1 : 0}</span>
                        </div>
                        <div className="mt-2">
                          {waiting ? (
                            <div className="flex items-center gap-2 rounded-lg border border-amber-400/22 bg-amber-500/[0.07] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                              <span className="flex h-4 w-4 items-center justify-center rounded-full border border-amber-300/55 bg-amber-400/25 text-[9px] text-amber-50" aria-hidden>
                                !
                              </span>
                              <span className="text-[12px] font-semibold text-white/85">{waiting.label}</span>
                              <span className="ml-auto text-[9px] font-semibold uppercase tracking-wide text-amber-100/85">
                                Needs input
                              </span>
                            </div>
                          ) : (
                            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] italic text-white/40">
                              Nothing waiting on you.
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em]">
                          <span className="text-white/55">Next up</span>
                          <span className="tabular-nums text-white/45">{upcoming.length}</span>
                        </div>
                        <div className="mt-2 space-y-1.5">
                          {upcoming.length === 0 && (
                            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] italic text-white/40">
                              Queue is clear.
                            </div>
                          )}
                          {upcoming.map((item) => (
                            <div key={item.label} className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5">
                              <span className="flex h-4 w-4 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] text-[9px] text-white/55" aria-hidden>
                                ·
                              </span>
                              <span className="text-[12px] font-medium text-white/65">{item.label}</span>
                              <span className="ml-auto text-[9px] font-semibold uppercase tracking-wide text-white/40">
                                Waiting
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

            </div>
          </div>
        </div>
        </div>
          </>
        )}
      </div>
    </main>
  );
}
