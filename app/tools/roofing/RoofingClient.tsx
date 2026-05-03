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
  ClipboardList,
  Image as ImageIcon,
  Mic,
  MessageCircle,
  Gauge,
  Percent,
  CheckCircle2,
  ArrowRight,
  Pencil,
  CircleHelp,
  Eye,
  Home,
  User,
  Building2,
  ShieldCheck,
  Camera,
  Download,
  Save,
  Send,
  MoreHorizontal,
  Truck,
  Search,
  Bell,
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
  const handleCustomizeDescription = () => {
    beginEditAi();
    setShowAiPanel(true);
  };

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
      className="min-h-screen relative pb-20"
      style={{
        backgroundColor: "#0b1120",
        backgroundImage: `
          radial-gradient(ellipse at 60% 0%, rgba(34,211,238,0.06) 0%, transparent 55%),
          radial-gradient(ellipse at 0% 80%, rgba(59,130,246,0.05) 0%, transparent 50%),
          repeating-linear-gradient(0deg, transparent 0px, transparent 3px, rgba(255,255,255,0.0035) 3px, rgba(255,255,255,0.0035) 4px),
          repeating-linear-gradient(90deg, transparent 0px, transparent 3px, rgba(255,255,255,0.0035) 3px, rgba(255,255,255,0.0035) 4px)
        `,
        backgroundSize: "100% 100%, 100% 100%, 72px 72px, 72px 72px",
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

      <div className="relative mx-auto w-full max-w-[1680px] px-0">
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
        <div>
          <motion.nav
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex min-h-[72px] items-stretch gap-0 border-b border-cyan-400/[0.12] bg-[#07111f]/96 shadow-[0_1px_0_rgba(255,255,255,0.045),0_20px_80px_-62px_rgba(37,99,235,0.75)] backdrop-blur-xl"
            aria-label="FieldDive workspace"
          >
            {/* Logo block */}
            <Link
              href="/tools"
              className="group flex shrink-0 items-center gap-3.5 border-r border-cyan-400/[0.13] px-7 py-3 transition hover:bg-white/[0.035]"
            >
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center" aria-hidden>
                <span className="absolute left-0 top-0 h-3.5 w-7 rounded-[7px] bg-gradient-to-r from-sky-400 to-blue-500 shadow-[0_0_18px_rgba(56,189,248,0.70)]" />
                <span className="absolute left-0 top-[13px] h-3.5 w-5.5 rounded-[7px] bg-gradient-to-r from-sky-500 to-blue-600 shadow-[0_0_14px_rgba(37,99,235,0.55)]" />
                <span className="absolute left-0 top-[26px] h-3.5 w-3.5 rounded-[7px] bg-gradient-to-r from-sky-500 to-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.45)]" />
                <span className="absolute left-[18px] top-[13px] h-3.5 w-3.5 rounded-[7px] bg-gradient-to-r from-sky-400 to-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.55)]" />
              </div>
              <div className="hidden flex-col leading-none sm:flex">
                <span className="text-[25px] font-extrabold tracking-[-0.045em] text-white">FieldDive</span>
              </div>
            </Link>

            {/* Nav tabs */}
            <div className="flex flex-1 items-center gap-0 px-4">
              <Link
                href="/tools/roofing"
                className="relative flex min-h-[58px] items-center gap-3 rounded-t-xl border border-blue-300/45 border-b-blue-400/70 bg-gradient-to-b from-slate-800/82 via-blue-950/42 to-blue-700/28 px-7 text-[15px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_18px_42px_-20px_rgba(59,130,246,0.95)]"
              >
                <span className="pointer-events-none absolute inset-x-0 bottom-[-1px] h-[3px] rounded-full bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_16px_rgba(59,130,246,1)]" aria-hidden />
                <ClipboardList className="h-5.5 w-5.5 shrink-0 text-blue-100 drop-shadow-[0_0_10px_rgba(147,197,253,0.65)]" aria-hidden />
                New Job
              </Link>
              <span className="mx-3 hidden h-8 w-px bg-white/[0.10] lg:block" aria-hidden />
              <Link
                href="/tools/roofing/saved"
                className="flex min-h-[58px] items-center gap-3 rounded-xl px-5 text-[15px] font-semibold text-white/62 transition hover:bg-white/[0.045] hover:text-white"
              >
                <ShieldCheck className="h-5.5 w-5.5 shrink-0 text-white/62" aria-hidden />
                <span className="hidden xl:inline">Command Center</span>
                <span className="xl:hidden">Cmd</span>
              </Link>
              <span className="mx-3 hidden h-8 w-px bg-white/[0.10] xl:block" aria-hidden />
              <Link
                href="/tools/roofing/ai"
                className="flex min-h-[58px] items-center gap-3 rounded-xl px-5 text-[15px] font-semibold text-white/62 transition hover:bg-white/[0.045] hover:text-white"
              >
                <Package className="h-5.5 w-5.5 shrink-0 text-white/62" aria-hidden />
                AI Library
              </Link>
              <span className="mx-3 hidden h-8 w-px bg-white/[0.10] xl:block" aria-hidden />
              <Link
                href="/tools/settings"
                className="flex min-h-[58px] items-center gap-3 rounded-xl px-5 text-[15px] font-semibold text-white/62 transition hover:bg-white/[0.045] hover:text-white"
              >
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Settings
              </Link>
            </div>

            {/* Right actions */}
            <div className="flex shrink-0 items-center gap-3 border-l border-cyan-400/[0.12] px-5 py-2">
              <div className="flex min-w-[230px] items-center gap-2 rounded-xl border border-white/[0.10] bg-white/[0.035] px-3.5 py-2.5 text-[12px] text-white/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <Search className="h-4 w-4 shrink-0" aria-hidden />
                <span className="hidden lg:inline text-white/40">Search jobs…</span>
                <span className="hidden rounded border border-white/[0.10] bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-semibold text-white/35 lg:inline">⌘K</span>
              </div>
              <button
                type="button"
                className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.10] bg-white/[0.035] text-white/70 transition hover:bg-white/[0.06] hover:text-white"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" aria-hidden />
                <span className="absolute right-1.5 top-1.5 h-[7px] w-[7px] rounded-full border-[1.5px] border-[#0d1117] bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,1)]" />
              </button>
              <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.10] bg-white/[0.035] py-1.5 pl-1.5 pr-2.5 transition hover:bg-white/[0.055]">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-200/80 via-orange-300/50 to-slate-800 text-[11px] font-extrabold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_0_20px_-10px_rgba(251,191,36,0.90)]">
                  MA
                </div>
                <div className="hidden flex-col leading-none xl:flex">
                  <span className="text-[13px] font-bold text-white/92">Mike Anderson</span>
                  <span className="mt-0.5 text-[10.5px] text-white/48">Anderson Roofing</span>
                </div>
                <ChevronDown className="hidden h-4 w-4 text-white/45 xl:block" aria-hidden />
                <div className="ml-1 hidden opacity-55 transition hover:opacity-100 2xl:block">
                  <SignOutButton />
                </div>
              </div>
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

        <div className="px-3 pt-3 sm:px-4 sm:pt-4 xl:px-5 2xl:px-6">
        <div className="relative overflow-hidden rounded-2xl border border-cyan-400/[0.22] bg-[#0b1526] px-5 py-4 shadow-[0_0_0_1px_rgba(34,211,238,0.06),0_18px_60px_-34px_rgba(34,211,238,0.45),inset_0_1px_0_rgba(255,255,255,0.07)] sm:px-6 sm:py-5 xl:px-7">
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute -left-24 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-cyan-500/[0.16] blur-[72px]" />
            <div className="absolute right-0 top-0 h-52 w-[34rem] bg-blue-500/[0.09] blur-[72px]" />
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-300/25 to-transparent" />
          </div>

          <div className="relative flex items-center gap-7">
            <div className="flex shrink-0 items-center gap-5">
              <div className="relative flex h-[86px] w-[86px] shrink-0 items-center justify-center" aria-hidden>
                <span className="absolute -inset-4 rounded-full bg-cyan-400/[0.20] blur-2xl animate-pulse" />
                <span className="absolute -inset-2 rounded-full bg-cyan-400/[0.10] blur-xl" />
                <span className="absolute -inset-2 rounded-full border border-cyan-300/18" />
                <span className="absolute -inset-0.5 rounded-full border border-cyan-300/42" />
                <span className="absolute inset-0.5 rounded-full bg-gradient-to-br from-cyan-300/70 via-blue-500/45 to-slate-950/85 shadow-[inset_0_0_36px_rgba(165,243,252,0.60),0_0_44px_rgba(34,211,238,0.80)]" />
                <span className="absolute inset-3 rounded-full bg-[radial-gradient(circle_at_30%_25%,rgba(186,230,253,1),rgba(34,211,238,0.35)_55%,transparent_78%)]" />
                <span className="absolute inset-5 rounded-full bg-cyan-50/13 blur-[3px]" />
                <span className="relative text-[14px] font-extrabold uppercase tracking-widest text-cyan-50 drop-shadow-[0_0_12px_rgba(165,243,252,0.98)]">AI</span>
              </div>
              <div className="min-w-0">
                <div className="text-[22px] font-extrabold leading-tight tracking-[-0.025em] text-white sm:text-[25px]">FieldDive is preparing this job</div>
                <div className="mt-2 max-w-[35rem] text-[13px] leading-snug text-white/60">AI is assembling the job packet and proposal path. You verify what matters.</div>
              </div>
            </div>

            <span className="hidden h-16 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent lg:block" aria-hidden />

            <div className="min-w-0 flex-1">
              <ol
                className="relative grid grid-cols-5 gap-0"
                role="list"
                aria-label="Job preparation timeline"
              >
                {aiConductorStripItems.map((item, idx) => {
                  const timelineLabels = ["Address checked", "Photos analyzed", "Scope estimated", "Proposal draft", "Waiting on contractor"];
                  const timelineSubLabels = ["", "", "", "", "Roofing system"];
                  const status = item.ready ? "Complete" : item.notReadyStatus === "Needs input" ? "Needs input" : "Waiting";
                  const isFirst = idx === 0;
                  const isLast = idx === aiConductorStripItems.length - 1;
                  const prevReady = idx > 0 && aiConductorStripItems[idx - 1].ready;
                  const isInProgress = !item.ready && idx > 0 && aiConductorStripItems[idx - 1].ready;
                  const nodeStateClass = item.ready
                    ? "border-emerald-300/75 bg-gradient-to-br from-emerald-400/40 to-emerald-600/25 text-emerald-50 shadow-[0_0_22px_rgba(16,185,129,0.65),inset_0_0_10px_rgba(167,243,208,0.30)]"
                    : isInProgress
                      ? "border-cyan-300/75 bg-gradient-to-br from-cyan-400/40 to-cyan-600/25 text-cyan-50 shadow-[0_0_22px_rgba(34,211,238,0.75),inset_0_0_10px_rgba(165,243,252,0.35)]"
                      : "border-white/20 bg-white/[0.04] text-white/60";
                  const labelTone = item.ready
                    ? "text-white"
                    : isInProgress
                      ? "text-cyan-50"
                      : "text-white/65";
                  const statusTone = item.ready
                    ? "text-emerald-200/90"
                    : isInProgress
                      ? "text-cyan-200/90"
                      : item.notReadyStatus === "Needs input"
                        ? "text-amber-200/80"
                        : "text-white/45";
                  return (
                    <li key={item.label} className="relative flex flex-col items-center" role="listitem">
                      {!isFirst && (
                        <span
                          className={`pointer-events-none absolute right-1/2 top-[22px] h-[3px] w-full ${
                            prevReady ? "bg-gradient-to-r from-emerald-500/82 to-emerald-400/66 shadow-[0_0_13px_rgba(16,185,129,0.75)]" : "bg-white/[0.12]"
                          }`}
                          aria-hidden
                        />
                      )}
                      {!isLast && (
                        <span
                          className={`pointer-events-none absolute left-1/2 top-[22px] h-[3px] w-full ${
                            item.ready ? "bg-gradient-to-r from-emerald-400/66 to-emerald-500/82 shadow-[0_0_13px_rgba(16,185,129,0.75)]" : isInProgress ? "bg-gradient-to-r from-cyan-400/58 to-white/12 shadow-[0_0_12px_rgba(34,211,238,0.55)]" : "bg-white/[0.12]"
                          }`}
                          aria-hidden
                        />
                      )}
                      <span
                        className={`relative z-10 flex h-11 w-11 items-center justify-center rounded-full border-2 text-[15px] font-bold tabular-nums ${nodeStateClass}`}
                        aria-hidden
                      >
                        {item.ready ? "✓" : idx + 1}
                      </span>
                      <span className={`mt-2 text-center text-[12px] font-bold leading-tight ${labelTone}`}>
                        {timelineLabels[idx] ?? item.label}
                      </span>
                      <span className={`text-center text-[10.5px] font-medium leading-tight ${statusTone}`}>
                        {status}
                      </span>
                      {timelineSubLabels[idx] ? (
                        <span className="text-center text-[10px] font-medium leading-tight text-white/45">
                          {timelineSubLabels[idx]}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </div>
        </div>
        <div className="px-3 pt-3 pb-0 sm:px-4 sm:pt-3 xl:px-5 2xl:px-6">
        <div>
        <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_390px] 2xl:grid-cols-[minmax(0,1fr)_410px] lg:gap-3 xl:gap-3">
          {/* Workflow canvas */}
          <div className="space-y-2.5 xl:space-y-3">

            {/* Customer & Job */}
            <div
              id="customer-job-section"
              className="rounded-2xl border border-cyan-400/[0.20] bg-[#0b1526] p-3 shadow-[0_0_0_1px_rgba(34,211,238,0.07),0_4px_24px_-8px_rgba(34,211,238,0.12),inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-4"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-blue-300/40 bg-blue-500/20 text-[12px] font-bold tabular-nums text-blue-100 shadow-[0_0_22px_rgba(59,130,246,0.25)]"
                  aria-hidden
                >
                  1
                </span>
                <h2 className="text-[15px] font-bold tracking-tight text-white sm:text-[17px]">Job Capture</h2>
                <span className="text-[12px] text-white/50">Customer + property</span>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.65fr)]">
                <div className="flex flex-wrap items-center gap-1.5 sm:col-span-2 lg:col-span-2">
                  <button
                    type="button"
                    aria-current="step"
                    className="inline-flex items-center gap-2 rounded-lg border border-blue-400/45 bg-blue-500/[0.20] px-3 py-1.5 text-[12px] font-semibold text-blue-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_0_22px_-10px_rgba(59,130,246,0.85)]"
                  >
                    <ClipboardList className="h-3.5 w-3.5 text-blue-200" aria-hidden />
                    Manual entry
                  </button>
                  <button
                    type="button"
                    disabled
                    aria-label="Photos capture (coming soon)"
                    className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-white/[0.10] bg-white/[0.03] px-3 py-1.5 text-[12px] font-medium text-white/60"
                  >
                    <ImageIcon className="h-3.5 w-3.5 text-white/55" aria-hidden />
                    Photos
                  </button>
                  <button
                    type="button"
                    disabled
                    aria-label="Voice capture (coming soon)"
                    className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-white/[0.10] bg-white/[0.03] px-3 py-1.5 text-[12px] font-medium text-white/60"
                  >
                    <Mic className="h-3.5 w-3.5 text-white/55" aria-hidden />
                    Voice
                  </button>
                  <button
                    type="button"
                    disabled
                    aria-label="Customer message capture (coming soon)"
                    className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-white/[0.10] bg-white/[0.03] px-3 py-1.5 text-[12px] font-medium text-white/60"
                  >
                    <MessageCircle className="h-3.5 w-3.5 text-white/55" aria-hidden />
                    Customer message
                  </button>
                </div>
                  <div className="min-h-[7.45rem] rounded-xl border border-white/[0.10] bg-slate-950/45 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                    <div className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wide text-white/55">
                      <User className="h-3 w-3 text-white/55" aria-hidden />
                      Customer
                    </div>
                    <p className="mt-1.5 text-[14px] font-semibold leading-snug text-white">
                      {(customerName || "").trim() ? customerName : "Customer not added"}
                    </p>
                    <p className="mt-0.5 break-all text-[12px] leading-snug text-blue-300/90">
                      {(customerEmail || "").trim() ? customerEmail : "Email needed"}
                    </p>
                    <p className="text-[11px] text-white/55">
                      {(customerPhone || "").trim() ? customerPhone : "Phone optional"}
                    </p>
                  </div>
                  <div className="min-h-[7.45rem] rounded-xl border border-white/[0.10] bg-slate-950/45 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                    <div className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wide text-white/55">
                      <Home className="h-3 w-3 text-white/55" aria-hidden />
                      Property
                    </div>
                    <p className="mt-1.5 text-[14px] font-semibold leading-snug text-white">
                      {(jobAddress1 || "").trim() ? jobAddress1 : "Property address needed"}
                    </p>
                    <p className="mt-0.5 text-[12px] leading-snug text-white/70">
                      {[jobCity, jobState, jobZip].filter(Boolean).join(", ") || "City, state, and ZIP"}
                    </p>
                    {(jobAddress1 || "").trim() && (jobZip || "").trim().length === 5 ? (
                      <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/12 px-2 py-0.5 text-[10px] font-semibold text-emerald-100/95">
                        <ShieldCheck className="h-3 w-3" aria-hidden />
                        Address ready
                      </span>
                    ) : (
                      <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-100/85">
                        Needs input
                      </span>
                    )}
                  </div>
                <div
                  className="relative overflow-hidden rounded-xl border border-cyan-400/35 bg-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_0_0_1px_rgba(34,211,238,0.08),0_24px_80px_-40px_rgba(34,211,238,0.55)] sm:col-span-2 lg:col-start-3 lg:row-span-2 lg:row-start-1"
                >
                  {/* Sky / background */}
                  <div className="pointer-events-none absolute inset-0" aria-hidden style={{background:"linear-gradient(180deg, #1a2d4a 0%, #1e3a5f 22%, #0e1f35 58%, #060d1a 100%)"}}>
                    {/* Subtle clouds */}
                    <div style={{position:"absolute",top:"8%",left:"12%",width:"28%",height:"12%",background:"radial-gradient(ellipse,rgba(255,255,255,0.07),transparent 70%)",borderRadius:"50%"}} />
                    <div style={{position:"absolute",top:"12%",right:"18%",width:"20%",height:"9%",background:"radial-gradient(ellipse,rgba(255,255,255,0.05),transparent 70%)",borderRadius:"50%"}} />
                  </div>

                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" aria-hidden />

                  {/* Detailed house SVG */}
                  <svg
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-[78%] w-full"
                    viewBox="0 0 500 230"
                    preserveAspectRatio="xMidYMax meet"
                    aria-hidden
                  >
                    <defs>
                      <linearGradient id="hp2Roof" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3d4d62" />
                        <stop offset="40%" stopColor="#2c3a4e" />
                        <stop offset="100%" stopColor="#1a2535" />
                      </linearGradient>
                      <linearGradient id="hp2RoofGarage" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#354460" />
                        <stop offset="100%" stopColor="#1e2d42" />
                      </linearGradient>
                      <linearGradient id="hp2Wall" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#c4a882" />
                        <stop offset="100%" stopColor="#9a7d58" />
                      </linearGradient>
                      <linearGradient id="hp2WallGarage" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#b89b72" />
                        <stop offset="100%" stopColor="#8a7050" />
                      </linearGradient>
                      <linearGradient id="hp2Win" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(190,220,255,0.85)" />
                        <stop offset="100%" stopColor="rgba(100,150,210,0.65)" />
                      </linearGradient>
                      <linearGradient id="hp2Garage" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2a3040" />
                        <stop offset="100%" stopColor="#1a1f2a" />
                      </linearGradient>
                      <linearGradient id="hp2Lawn" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2d5a3a" />
                        <stop offset="100%" stopColor="#1a3a24" />
                      </linearGradient>
                      <linearGradient id="hp2Drive" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#555f6e" />
                        <stop offset="100%" stopColor="#363d47" />
                      </linearGradient>
                      <filter id="hp2Shadow"><feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="rgba(0,0,0,0.5)" /></filter>
                    </defs>

                    {/* Lawn */}
                    <rect x="0" y="182" width="500" height="48" fill="url(#hp2Lawn)" />
                    {/* Driveway */}
                    <polygon points="320,225 420,225 370,182 290,182" fill="url(#hp2Drive)" />
                    {/* Driveway lines */}
                    <line x1="340" y1="182" x2="380" y2="225" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                    <line x1="350" y1="182" x2="395" y2="225" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />

                    {/* Main house body */}
                    <rect x="80" y="115" width="240" height="67" fill="url(#hp2Wall)" />
                    {/* Center line */}
                    <line x1="200" y1="115" x2="200" y2="182" stroke="rgba(0,0,0,0.12)" strokeWidth="0.5" />

                    {/* Main roof */}
                    <polygon points="70,120 200,52 330,120 320,125 200,62 80,125" fill="url(#hp2Roof)" filter="url(#hp2Shadow)" />
                    {/* Roof ridge highlight */}
                    <line x1="200" y1="52" x2="200" y2="62" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
                    {/* Roof shingle lines — left side */}
                    {Array.from({length:9}).map((_,i)=>{
                      const t=(i+1)/10; const lx=70+t*(200-70); const ly=120+t*(62-120); const rx=200; const ry=62;
                      return <line key={`hs-l-${i}`} x1={lx} y1={ly} x2={rx} y2={ry} stroke="rgba(0,0,0,0.22)" strokeWidth="0.6" />;
                    })}
                    {/* Roof shingle lines — right side */}
                    {Array.from({length:9}).map((_,i)=>{
                      const t=(i+1)/10; const lx=200; const ly=62; const rx=200+t*(330-200); const ry=62+t*(120-62);
                      return <line key={`hs-r-${i}`} x1={lx} y1={ly} x2={rx} y2={ry} stroke="rgba(0,0,0,0.22)" strokeWidth="0.6" />;
                    })}
                    {/* Horizontal shingle courses */}
                    {[0.2,0.38,0.55,0.70,0.84].map((t,i)=>{
                      const y=62+t*(120-62);
                      const lx=70+t*(200-70); const rx=200+t*(330-200);
                      return <line key={`hc-${i}`} x1={lx} y1={y} x2={rx} y2={y} stroke="rgba(0,0,0,0.18)" strokeWidth="0.7" />;
                    })}

                    {/* Garage wing */}
                    <rect x="316" y="140" width="110" height="42" fill="url(#hp2WallGarage)" />
                    <polygon points="308,144 371,108 434,144 430,148 371,116 312,148" fill="url(#hp2RoofGarage)" />
                    {/* Garage shingle lines */}
                    {Array.from({length:6}).map((_,i)=>{
                      const t=(i+1)/7;
                      return <line key={`gs-${i}`} x1={308+t*(371-308)} y1={144+t*(116-144)} x2={371} y2={116} stroke="rgba(0,0,0,0.20)" strokeWidth="0.5" />;
                    })}

                    {/* Garage door */}
                    <rect x="325" y="150" width="75" height="32" fill="url(#hp2Garage)" rx="2" />
                    {/* Garage door panels */}
                    {[0,1,2].map(i=><rect key={`gp-${i}`} x="325" y={150+i*10.5} width="75" height="9.5" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="0.6" />)}
                    {/* Garage door vertical */}
                    <line x1="362" y1="150" x2="362" y2="182" stroke="rgba(255,255,255,0.06)" strokeWidth="0.6" />

                    {/* Front door */}
                    <rect x="179" y="145" width="42" height="37" fill="rgba(24,18,10,0.9)" rx="1" />
                    <rect x="183" y="150" width="35" height="27" fill="rgba(40,28,16,0.85)" rx="1" />
                    <line x1="200" y1="150" x2="200" y2="177" stroke="rgba(0,0,0,0.4)" strokeWidth="0.5" />
                    {/* Door handle */}
                    <circle cx="196" cy="164" r="2" fill="rgba(200,160,60,0.85)" />

                    {/* Left windows (main house) */}
                    <rect x="90" y="130" width="32" height="26" fill="url(#hp2Win)" rx="1" stroke="rgba(0,0,0,0.3)" strokeWidth="0.5" />
                    <line x1="106" y1="130" x2="106" y2="156" stroke="rgba(0,0,0,0.25)" strokeWidth="0.5" />
                    <line x1="90" y1="143" x2="122" y2="143" stroke="rgba(0,0,0,0.25)" strokeWidth="0.5" />
                    <rect x="130" y="130" width="32" height="26" fill="url(#hp2Win)" rx="1" stroke="rgba(0,0,0,0.3)" strokeWidth="0.5" />
                    <line x1="146" y1="130" x2="146" y2="156" stroke="rgba(0,0,0,0.25)" strokeWidth="0.5" />
                    <line x1="130" y1="143" x2="162" y2="143" stroke="rgba(0,0,0,0.25)" strokeWidth="0.5" />

                    {/* Right windows (main house) */}
                    <rect x="234" y="130" width="32" height="26" fill="url(#hp2Win)" rx="1" stroke="rgba(0,0,0,0.3)" strokeWidth="0.5" />
                    <line x1="250" y1="130" x2="250" y2="156" stroke="rgba(0,0,0,0.25)" strokeWidth="0.5" />
                    <line x1="234" y1="143" x2="266" y2="143" stroke="rgba(0,0,0,0.25)" strokeWidth="0.5" />
                    <rect x="274" y="130" width="32" height="26" fill="url(#hp2Win)" rx="1" stroke="rgba(0,0,0,0.3)" strokeWidth="0.5" />
                    <line x1="290" y1="130" x2="290" y2="156" stroke="rgba(0,0,0,0.25)" strokeWidth="0.5" />
                    <line x1="274" y1="143" x2="306" y2="143" stroke="rgba(0,0,0,0.25)" strokeWidth="0.5" />

                    {/* Trees */}
                    <ellipse cx="28" cy="170" rx="22" ry="18" fill="rgba(22,60,38,0.80)" />
                    <ellipse cx="34" cy="158" rx="14" ry="12" fill="rgba(34,80,52,0.88)" />
                    <ellipse cx="460" cy="168" rx="20" ry="16" fill="rgba(22,60,38,0.80)" />
                    <ellipse cx="466" cy="156" rx="13" ry="11" fill="rgba(34,80,52,0.88)" />
                    <ellipse cx="48" cy="175" rx="12" ry="9" fill="rgba(28,70,44,0.75)" />

                    {/* Walkway */}
                    <polygon points="185,182 215,182 225,215 175,215" fill="rgba(160,148,128,0.35)" />

                    {/* Ground shadow under house */}
                    <ellipse cx="220" cy="183" rx="160" ry="6" fill="rgba(0,0,0,0.18)" />
                  </svg>

                  {/* Atmospheric overlay for depth */}
                  <div className="pointer-events-none absolute inset-0" aria-hidden style={{background:"linear-gradient(to bottom, transparent 30%, rgba(6,13,26,0.25) 70%, rgba(6,13,26,0.60) 100%)"}} />

                  {/* Content layer */}
                  <div className="relative flex h-full min-h-[14rem] flex-col justify-between p-4 sm:p-4.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-300/90">Property Preview</div>
                        <div className="mt-1 truncate text-[15px] font-bold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
                          {(jobAddress1 || "").trim() ? jobAddress1 : "Awaiting address"}
                        </div>
                        <div className="truncate text-[11.5px] text-white/65 drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]">
                          {[jobCity, jobState, jobZip].filter(Boolean).join(", ") || "Location pending"}
                        </div>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/[0.20] bg-black/55 backdrop-blur-md px-2.5 py-1 text-[10px] font-semibold text-white shadow-[0_4px_20px_rgba(0,0,0,0.45)]">
                        <Camera className="h-3 w-3 text-cyan-300" aria-hidden />
                        Add Photos
                      </span>
                    </div>
                    <div className="flex items-end justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-md border border-white/[0.14] bg-black/50 backdrop-blur-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/80">Satellite</span>
                        <span className="rounded-md border border-white/[0.14] bg-black/50 backdrop-blur-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/80">Street view</span>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/35 bg-black/50 backdrop-blur-sm px-2.5 py-1 text-[10px] font-bold text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.25)]">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909" /></svg>
                        Preview mode
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <details className="group mt-1.5">
                <summary className="flex cursor-pointer list-none items-center justify-end gap-1.5 pr-1 text-[10px] font-medium text-white/36 transition hover:text-white/70">
                  <Pencil className="h-3 w-3" aria-hidden />
                  <span>Edit manual details</span>
                  <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" aria-hidden />
                </summary>
              <form autoComplete="off" className="mt-2 space-y-3">
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

            <div className="rounded-2xl border border-cyan-400/[0.20] bg-[#0b1526] p-3 shadow-[0_0_0_1px_rgba(34,211,238,0.07),0_4px_24px_-8px_rgba(34,211,238,0.12),inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-blue-300/40 bg-blue-500/20 text-[12px] font-bold tabular-nums text-blue-100 shadow-[0_0_22px_rgba(59,130,246,0.25)]"
                  aria-hidden
                >
                  2
                </span>
                <h2 className="text-[15px] font-bold tracking-tight text-white sm:text-[17px]">FieldDive Prepared Scope</h2>
                <span className="text-[12px] text-white/50">FieldDive prepared these scope details from the inputs you provided. Review and edit if needed.</span>
                <span className="ml-auto rounded-full border border-emerald-400/30 bg-emerald-500/14 px-2.5 py-0.5 text-[10px] font-semibold tabular-nums text-emerald-100/95 shadow-[0_0_16px_-6px_rgba(16,185,129,0.55)]">
                  {jobReadinessReadyCount}/{jobReadinessItems.length} prepared
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-6">
                {/* Tile 1 — Roof size */}
                <div className="group relative flex flex-col rounded-xl border border-emerald-400/28 bg-gradient-to-b from-emerald-500/[0.14] to-emerald-500/[0.07] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_16px_-8px_rgba(16,185,129,0.25)]">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-200/90">
                      <Ruler className="h-3.5 w-3.5" aria-hidden />
                      Roof Size
                    </div>
                    <a href="#scope-inputs" aria-label="Edit roof size" className="text-white/35 opacity-0 transition group-hover:opacity-100 hover:text-white/75">
                      <Pencil className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="mt-2 text-[22px] font-extrabold tabular-nums leading-none text-white">
                    {hasRoofArea ? `${squares.toFixed(1)}` : "—"}
                  </div>
                  {hasRoofArea && <div className="text-[11px] font-medium text-emerald-100/70">squares</div>}
                  <div className="mt-2 flex items-center gap-1">
                    <CheckCircle2 className={`h-3 w-3 shrink-0 ${hasRoofArea ? "text-emerald-300" : "text-amber-300/70"}`} aria-hidden />
                    <span className={`text-[9px] font-bold uppercase tracking-wide ${hasRoofArea ? "text-emerald-200/90" : "text-amber-200/80"}`}>
                      {hasRoofArea ? "Verified" : "Needs input"}
                    </span>
                  </div>
                </div>

                {/* Tile 2 — Roof pitch */}
                <div className="group relative flex flex-col rounded-xl border border-emerald-400/22 bg-gradient-to-b from-emerald-500/[0.11] to-emerald-500/[0.05] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-200/90">
                      <Gauge className="h-3.5 w-3.5" aria-hidden />
                      Roof Pitch
                    </div>
                    <a href="#scope-inputs" aria-label="Edit pitch" className="text-white/35 opacity-0 transition group-hover:opacity-100 hover:text-white/75">
                      <Pencil className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="mt-2 text-[22px] font-extrabold tabular-nums leading-none text-white">
                    {pitch ? pitch : "—"}
                  </div>
                  {pitch && <div className="text-[11px] font-medium text-emerald-100/70">pitch</div>}
                  <div className="mt-2 flex items-center gap-1">
                    <CheckCircle2 className={`h-3 w-3 shrink-0 ${pitch ? "text-emerald-300" : "text-white/35"}`} aria-hidden />
                    <span className={`text-[9px] font-bold uppercase tracking-wide ${pitch ? "text-emerald-200/90" : "text-white/55"}`}>
                      {pitch ? "Verified" : "Waiting"}
                    </span>
                  </div>
                </div>

                {/* Tile 3 — Stories */}
                <div className="group relative flex flex-col rounded-xl border border-emerald-400/22 bg-gradient-to-b from-emerald-500/[0.11] to-emerald-500/[0.05] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-200/90">
                      <Building2 className="h-3.5 w-3.5" aria-hidden />
                      Stories
                    </div>
                    <Pencil className="h-3 w-3 text-white/25" aria-hidden />
                  </div>
                  <div className="mt-2 text-[22px] font-extrabold tabular-nums leading-none text-white">—</div>
                  <div className="text-[11px] font-medium text-white/40">stories</div>
                  <div className="mt-2 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 shrink-0 text-white/30" aria-hidden />
                    <span className="text-[9px] font-bold uppercase tracking-wide text-white/50">Waiting</span>
                  </div>
                </div>

                {/* Tile 4 — Tear-off */}
                <div className="group relative flex flex-col rounded-xl border border-amber-400/28 bg-gradient-to-b from-amber-500/[0.14] to-amber-500/[0.06] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-200/90">
                      <HardHat className="h-3.5 w-3.5" aria-hidden />
                      Tear-off
                    </div>
                    <Pencil className="h-3 w-3 text-white/25" aria-hidden />
                  </div>
                  <div className="mt-2 text-[18px] font-extrabold leading-none text-white">
                    {includeDebrisRemoval ? "1 layer" : "—"}
                  </div>
                  {includeDebrisRemoval && <div className="text-[11px] font-medium text-amber-100/70">included</div>}
                  <div className="mt-2 flex items-center gap-1">
                    <CheckCircle2 className={`h-3 w-3 shrink-0 ${includeDebrisRemoval ? "text-emerald-300" : "text-white/35"}`} aria-hidden />
                    <span className={`text-[9px] font-bold uppercase tracking-wide ${includeDebrisRemoval ? "text-emerald-200/90" : "text-white/50"}`}>
                      {includeDebrisRemoval ? "Verified" : "Off"}
                    </span>
                  </div>
                </div>

                {/* Tile 5 — Material */}
                <div className="group relative flex flex-col rounded-xl border border-violet-400/28 bg-gradient-to-b from-violet-500/[0.14] to-violet-500/[0.06] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-violet-200/90">
                      <Package className="h-3.5 w-3.5" aria-hidden />
                      Material
                    </div>
                    <Pencil className="h-3 w-3 text-white/25" aria-hidden />
                  </div>
                  <div className="mt-2 text-[14px] font-extrabold leading-tight text-white">
                    Architectural<br />shingles
                  </div>
                  <div className="mt-2 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-300" aria-hidden />
                    <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-200/90">Verified</span>
                  </div>
                </div>

                {/* Tile 6 — Confidence */}
                <div className="group relative flex flex-col rounded-xl border border-cyan-400/28 bg-gradient-to-b from-cyan-500/[0.14] to-cyan-500/[0.06] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-200/90">
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                      Confidence
                    </div>
                    <Pencil className="h-3 w-3 text-white/25" aria-hidden />
                  </div>
                  <div className="mt-2 text-[22px] font-extrabold tabular-nums leading-none text-white">
                    {Math.round((jobReadinessReadyCount / Math.max(1, jobReadinessItems.length)) * 100)}%
                  </div>
                  <div className="text-[11px] font-medium text-cyan-100/70">readiness</div>
                  <div className="mt-2 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 shrink-0 text-cyan-300" aria-hidden />
                    <span className="text-[9px] font-bold uppercase tracking-wide text-cyan-200/90">High</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="rounded-2xl border border-cyan-400/[0.20] bg-[#0b1526] p-3 shadow-[0_0_0_1px_rgba(34,211,238,0.07),0_4px_24px_-8px_rgba(34,211,238,0.12),inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-blue-300/40 bg-blue-500/20 text-[12px] font-bold tabular-nums text-blue-100 shadow-[0_0_22px_rgba(59,130,246,0.25)]"
                    aria-hidden
                  >
                    3
                  </span>
                  <h2
                    id="inputs-heading"
                    className="text-[15px] font-bold tracking-tight text-white sm:text-[17px]"
                  >
                    Scope Builder
                  </h2>
                  <span className="text-[12px] text-white/50">AI recommends the optimal roofing system for this property.</span>
                </div>
                <div className="mt-3 h-px w-full bg-gradient-to-r from-white/[0.10] via-white/[0.05] to-transparent" />

                <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-12">
                  <div className="rounded-xl border border-cyan-400/25 bg-slate-900/65 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_4px_20px_-8px_rgba(34,211,238,0.20)] lg:col-span-4">
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-200/80">Recommended Roofing System</div>
                    <div className="mt-2.5 flex items-start gap-3">
                      {/* Shingle visual card */}
                      <div
                        className="relative h-16 w-[4.5rem] shrink-0 overflow-hidden rounded-lg border border-white/[0.14] shadow-[0_4px_16px_-4px_rgba(0,0,0,0.5)]"
                        style={{
                          backgroundImage:
                            "linear-gradient(160deg, rgba(71,85,105,0.95) 0%, rgba(51,65,85,0.98) 40%, rgba(30,41,59,0.99) 100%)",
                        }}
                        aria-hidden
                      >
                        {/* Shingle texture lines */}
                        <svg viewBox="0 0 72 64" className="absolute inset-0 h-full w-full opacity-85">
                          {/* Shingle rows */}
                          {[0, 10, 20, 30, 40, 50].map((y, i) => (
                            <g key={y}>
                              <rect x={i % 2 === 0 ? 0 : -9} y={y} width="18" height="10" fill="rgba(51,65,85,0.9)" stroke="rgba(15,23,42,0.5)" strokeWidth="0.4" rx="0.5" />
                              <rect x={i % 2 === 0 ? 18 : 9} y={y} width="18" height="10" fill="rgba(45,58,75,0.9)" stroke="rgba(15,23,42,0.5)" strokeWidth="0.4" rx="0.5" />
                              <rect x={i % 2 === 0 ? 36 : 27} y={y} width="18" height="10" fill="rgba(51,65,85,0.9)" stroke="rgba(15,23,42,0.5)" strokeWidth="0.4" rx="0.5" />
                              <rect x={i % 2 === 0 ? 54 : 45} y={y} width="18" height="10" fill="rgba(45,58,75,0.9)" stroke="rgba(15,23,42,0.5)" strokeWidth="0.4" rx="0.5" />
                            </g>
                          ))}
                          <rect x="0" y="0" width="72" height="64" fill="url(#shingleOverlay)" />
                          <defs>
                            <linearGradient id="shingleOverlay" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="rgba(125,211,252,0.12)" />
                              <stop offset="100%" stopColor="rgba(0,0,0,0.35)" />
                            </linearGradient>
                          </defs>
                        </svg>
                        <div className="absolute bottom-1 left-1 right-1 rounded-sm bg-black/50 px-1 py-0.5 text-center text-[7px] font-bold uppercase tracking-wide text-cyan-200/90">
                          {selectedTierLabel}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-bold leading-tight text-white">
                          {tierConfig[roofingTier].label}
                        </div>
                        <div className="mt-0.5 text-[11px] capitalize text-white/55">
                          Architectural Shingles
                        </div>
                        <div className="mt-1 text-[10px] text-white/40">Lifetime Limited Warranty</div>
                        <span className="mt-2 inline-flex rounded-full border border-cyan-400/28 bg-cyan-500/[0.12] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-cyan-100/90">
                          {selectedTierLabel} tier
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/[0.10] bg-slate-900/60 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] lg:col-span-5">
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/60">Included Scope</div>
                    <div className="mt-2.5 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
                      {[
                        ...tierConfig[roofingTier].includes,
                        includeDebrisRemoval ? "Tear-off & disposal (1 layer)" : "Tear-off (not included)",
                        "Starter strip",
                        "Ridge cap shingles",
                        "Proper ventilation",
                      ].slice(0, 6).map((item, i) => {
                        const isTearOff = item.toLowerCase().includes("tear-off");
                        const isReady = isTearOff ? includeDebrisRemoval : true;
                        return (
                          <div key={`${item}-${i}`} className="flex items-center gap-2 text-[11.5px]">
                            <span
                              className={
                                isReady
                                  ? "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-emerald-300/55 bg-emerald-400/25 text-[9px] text-emerald-50 shadow-[0_0_8px_rgba(16,185,129,0.50)]"
                                  : "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-[9px] text-white/40"
                              }
                              aria-hidden
                            >
                              {isReady ? "✓" : "·"}
                            </span>
                            <span className={`capitalize ${isReady ? "text-white/80" : "text-white/45"}`}>{item}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 lg:col-span-3">
                    <a
                      href="#scope-inputs"
                      className="group relative flex items-center justify-between gap-2 overflow-hidden rounded-xl border border-blue-300/40 bg-gradient-to-br from-blue-500/95 via-blue-500/85 to-blue-600/85 px-3.5 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.20),0_18px_40px_-18px_rgba(59,130,246,0.85)] transition hover:from-blue-400 hover:to-blue-500"
                    >
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-white">Confirm system</div>
                        <div className="text-[10px] text-blue-50/80">Lock system &amp; continue</div>
                      </div>
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]" aria-hidden>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </a>
                    <a
                      href="#scope-inputs"
                      className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.10] bg-white/[0.03] px-3 py-2 text-left transition hover:bg-white/[0.06]"
                    >
                      <div className="flex items-center gap-2 text-[12px] font-medium text-white/85">
                        <Pencil className="h-3.5 w-3.5 text-white/55" aria-hidden />
                        Edit scope
                      </div>
                    </a>
                    <button
                      type="button"
                      className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-left text-[12px] font-medium text-white/65 transition hover:bg-white/[0.04]"
                    >
                      <span className="flex items-center gap-2">
                        <CircleHelp className="h-3.5 w-3.5 text-white/45" aria-hidden />
                        Need more info
                      </span>
                    </button>
                  </div>
                </div>

                <details id="scope-inputs" className="group mt-2">
                  <summary className="flex cursor-pointer list-none items-center justify-end gap-1.5 text-[11px] font-medium text-white/45 transition hover:text-white/75">
                    <Pencil className="h-3 w-3" aria-hidden />
                    <span>Edit roof size, waste &amp; bundle cost</span>
                    <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  <div className="mt-2 space-y-2 border-t border-white/[0.06] pt-3">
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

              <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 lg:items-stretch">
                <div id="deal-control" className="flex flex-col rounded-2xl border border-cyan-400/[0.18] bg-[#0b1526] p-3 shadow-[0_0_0_1px_rgba(34,211,238,0.06),0_4px_24px_-8px_rgba(34,211,238,0.12),inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-500/20 text-[12px] font-bold tabular-nums text-emerald-100 shadow-[0_0_22px_rgba(16,185,129,0.25)]"
                      aria-hidden
                    >
                      4
                    </span>
                    <h2 className="text-[15px] font-bold tracking-tight text-white sm:text-[17px]">Deal Control</h2>
                    <span className="text-[12px] text-white/50">Pricing command</span>
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPricingMode(pricingMode === "direct" ? "markup" : "direct")}
                        className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-white/65 transition hover:bg-white/[0.07]"
                      >
                        {pricingMode === "direct" ? "Direct cost" : "Markup mode"}
                      </button>
                    </div>
                  </div>
                  <div className="mt-2.5 h-px w-full bg-gradient-to-r from-white/[0.10] via-white/[0.05] to-transparent" />

                  {/* Mock-aligned 3-column layout */}
                  <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)_minmax(0,0.7fr)]">
                    {/* Col 1: Target Margin slider */}
                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-white/55">Target Margin</div>
                        <label className="flex items-center gap-1 rounded-md border border-cyan-400/25 bg-black/20 px-2 py-1">
                          <input
                            type="number"
                            value={finalMarginNum}
                            onChange={(e) => setMargin(e.target.value)}
                            disabled={pricingMode === "direct"}
                            className="w-10 border-0 bg-transparent p-0 text-right text-[13px] font-extrabold tabular-nums text-white focus:outline-none focus:ring-0 disabled:opacity-50 [appearance:textfield]"
                          />
                          <span className="text-[11px] font-semibold text-white/55">%</span>
                        </label>
                      </div>
                      <div className="mt-3">
                        <div className="relative h-2 rounded-full bg-white/[0.08] shadow-inner">
                          <div
                            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-500 to-blue-400 shadow-[0_0_18px_rgba(34,211,238,0.45)]"
                            style={{
                              width: `${Math.min(100, Math.max(0, ((finalMarginNum || 0) / 50) * 100))}%`,
                            }}
                          />
                          <span
                            className="absolute top-1/2 h-4.5 w-4.5 -translate-y-1/2 rounded-full border-2 border-cyan-200/80 bg-white shadow-[0_0_18px_rgba(59,130,246,0.70)]"
                            style={{
                              left: `calc(${Math.min(100, Math.max(0, ((finalMarginNum || 0) / 50) * 100))}% - 0.5rem)`,
                              width: "1.1rem",
                              height: "1.1rem",
                            }}
                            aria-hidden
                          />
                        </div>
                        <div className="mt-2 flex justify-between text-[10px] tabular-nums text-white/35">
                          <span>10%</span>
                          <span>20%</span>
                          <span>30%</span>
                          <span>40%</span>
                          <span>50%</span>
                        </div>
                      </div>
                    </div>

                    {/* Col 2: Pricing Mode — Retail / Competitive / Aggressive */}
                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
                      <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-white/55">Pricing Mode</div>
                      <div className="mt-2.5 flex gap-1.5">
                        {([
                          { label: "Retail", value: 25 },
                          { label: "Competitive", value: 20 },
                          { label: "Aggressive", value: 15 },
                        ] as const).map((option) => {
                          const isActive = pricingMode !== "direct" && finalMarginNum === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setMargin(String(option.value))}
                              disabled={pricingMode === "direct"}
                              className={`flex-1 rounded-lg border py-2 text-center transition disabled:opacity-50 disabled:cursor-not-allowed ${
                                isActive
                                  ? "border-blue-400/55 bg-blue-500/[0.22] text-white shadow-[0_0_20px_-8px_rgba(59,130,246,0.70)]"
                                  : "border-white/[0.08] bg-white/[0.02] text-white/55 hover:bg-white/[0.05] hover:text-white/80"
                              }`}
                            >
                              <div className="text-[10px] font-semibold">{option.label}</div>
                              <div className="text-[12px] font-bold tabular-nums">{option.value}%</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Col 3: Labor adj (compact) */}
                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
                      <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-white/55">Labor Adj.</div>
                      <label className="mt-2.5 flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-black/15 px-2 py-2">
                          <span className="shrink-0 text-[11px] font-medium text-white/40">$</span>
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
                            placeholder="0"
                            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-right text-[13px] font-bold tabular-nums text-white placeholder:text-white/30 focus:outline-none focus:ring-0 [appearance:textfield]"
                          />
                        </div>
                        <span className="text-[9px] text-white/30">per job override</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col rounded-2xl border border-cyan-400/[0.18] bg-[#0b1526] p-3 shadow-[0_0_0_1px_rgba(34,211,238,0.06),0_4px_24px_-8px_rgba(34,211,238,0.12),inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-500/20 text-[12px] font-bold tabular-nums text-emerald-100 shadow-[0_0_22px_rgba(16,185,129,0.25)]"
                      aria-hidden
                    >
                      5
                    </span>
                    <h2 className="text-[15px] font-bold tracking-tight text-white sm:text-[17px]">Proposal Readiness</h2>
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
                      <div className="mt-3 flex flex-1 flex-col gap-3 sm:flex-row sm:gap-0">
                        {/* Left: progress + preview button */}
                        <div className="flex flex-col sm:w-[52%] sm:pr-4">
                          <div className="flex items-end justify-between gap-2">
                            <span className="text-[24px] font-extrabold tabular-nums leading-none text-white">{pct}%</span>
                            <span className="mb-1 text-[11px] text-white/55">{done} of {checklist.length} components ready</span>
                          </div>
                          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/[0.07] shadow-inner">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-300 to-blue-400 shadow-[0_0_22px_rgba(34,211,238,0.45)]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handlePreviewPdf}
                            disabled={isPreviewingPdf}
                            className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-500/[0.16] px-4 py-2.5 text-[13px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_28px_-8px_rgba(34,211,238,0.55)] transition hover:bg-cyan-500/[0.24] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Eye className="h-4 w-4" aria-hidden />
                            {isPreviewingPdf ? "Opening preview…" : "Preview proposal"}
                          </button>

                          <details className="mt-3 group rounded-xl border border-white/[0.07] bg-white/[0.02] open:bg-white/[0.03]">
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[11px] font-medium text-white/50">
                              <span>Package settings</span>
                              <ChevronDown className="h-3 w-3 text-white/40 transition group-open:rotate-180" aria-hidden />
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

                        {/* Vertical divider */}
                        <div className="hidden w-px shrink-0 self-stretch bg-gradient-to-b from-transparent via-white/[0.12] to-transparent sm:block" aria-hidden />

                        {/* Right: two-column checklist */}
                        <div className="flex flex-1 flex-col sm:pl-4">
                          <div className="grid grid-cols-1 gap-y-2 gap-x-3 xs:grid-cols-2">
                            {checklist.map((item) => (
                              <div key={item.label} className="flex items-center gap-2">
                                <span
                                  className={
                                    item.ready
                                      ? "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-emerald-300/60 bg-emerald-400/28 text-[9px] font-bold text-emerald-50 shadow-[0_0_8px_rgba(16,185,129,0.50)]"
                                      : "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/18 bg-white/[0.04]"
                                  }
                                  aria-hidden
                                >
                                  {item.ready ? "✓" : ""}
                                </span>
                                <span className={`text-[11.5px] font-medium ${item.ready ? "text-white/90" : "text-white/50"}`}>{item.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

            <div className="rounded-xl border border-white/[0.06] bg-slate-950/45 px-3 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                  <Truck className="h-3 w-3" aria-hidden />
                  Delivery
                </span>

                <div className="ml-auto flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handlePreviewPdf}
                    disabled={isPreviewingPdf}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11.5px] font-medium text-white/80 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Eye className="h-3 w-3" aria-hidden />
                    {isPreviewingPdf ? "Opening…" : "Preview"}
                  </button>
                  <button
                    type="button"
                    onClick={onDownloadPdf}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11.5px] font-medium text-white/80 transition hover:bg-white/[0.06]"
                  >
                    <Download className="h-3 w-3" aria-hidden />
                    Download PDF
                  </button>
                  <motion.button
                    type="button"
                    onClick={saveEstimate}
                    disabled={!canSave || isSaving || isLocked}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11.5px] font-semibold transition disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 ${savedFlash ? "border-emerald-400/45 bg-emerald-500/20 text-emerald-50" : "border-white/[0.08] bg-white/[0.03] text-white/80 hover:bg-white/[0.06]"}`}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Save className="h-3 w-3" aria-hidden />
                    {isSaving ? "Saving…" : savedFlash ? "Saved" : "Save"}
                  </motion.button>
                  <button
                    type="button"
                    onClick={handleSendEstimate}
                    disabled={!(customerEmail || "").trim() || !(jobAddress1 || "").trim() || isSending || isLocked}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-400/45 bg-blue-500/[0.85] px-3 py-1 text-[11.5px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Send className="h-3 w-3" aria-hidden />
                    {isSending ? "Sending…" : sendSuccess ? "Sent" : "Send proposal"}
                  </button>
                  <details className="group relative">
                    <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11.5px] font-medium text-white/65 transition hover:bg-white/[0.05]">
                      <MoreHorizontal className="h-3 w-3" aria-hidden />
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
              {showAiPanel && (
                <div className="mt-3 rounded-xl border border-cyan-400/18 bg-cyan-500/[0.055] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-100/70">
                        Proposal wording
                      </div>
                      <p className="mt-1 text-[11px] text-white/50">
                        Edit the customer-facing package language and next-step CTA. Pricing is not editable here.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        cancelEditAi();
                        setShowAiPanel(false);
                      }}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.035] px-2 py-1 text-[11px] font-medium text-white/60 transition hover:bg-white/[0.06] hover:text-white/80"
                    >
                      Close
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <label className="block">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-white/45">
                        Package description
                      </span>
                      <textarea
                        value={draftPackageDesc}
                        onChange={(e) => setDraftPackageDesc(e.target.value)}
                        rows={4}
                        className="mt-1 w-full resize-none rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 text-[12px] leading-relaxed text-white/85 outline-none placeholder:text-white/30 focus:border-cyan-300/35 focus:ring-2 focus:ring-cyan-400/10"
                        placeholder="Describe the roofing package in customer-friendly language."
                      />
                    </label>

                    <label className="block">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-white/45">
                        Schedule CTA
                      </span>
                      <textarea
                        value={draftScheduleCta}
                        onChange={(e) => setDraftScheduleCta(e.target.value)}
                        rows={4}
                        className="mt-1 w-full resize-none rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 text-[12px] leading-relaxed text-white/85 outline-none placeholder:text-white/30 focus:border-cyan-300/35 focus:ring-2 focus:ring-cyan-400/10"
                        placeholder="Tell the customer what happens next."
                      />
                    </label>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        cancelEditAi();
                        setShowAiPanel(false);
                      }}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-[12px] font-medium text-white/65 transition hover:bg-white/[0.06]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        saveEditAi();
                        setShowAiPanel(false);
                      }}
                      className="rounded-lg border border-cyan-400/35 bg-cyan-500/[0.18] px-3 py-1.5 text-[12px] font-semibold text-cyan-50 transition hover:bg-cyan-500/[0.24]"
                    >
                      Save wording
                    </button>
                  </div>
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
            <div className="sticky top-2">
              <div className="relative space-y-2">

              {/* HEADER + LIVE OUTCOME (4 METRICS) */}
              <div className="relative overflow-hidden rounded-xl border border-cyan-400/28 bg-gradient-to-br from-[#0f1e38] via-[#0c1830] to-[#080f1c] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_0_0_1px_rgba(34,211,238,0.07),0_8px_32px_-8px_rgba(34,211,238,0.25)] sm:p-3.5">
                <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-cyan-500/[0.16] blur-3xl" aria-hidden />
                <div className="pointer-events-none absolute -left-8 bottom-0 h-32 w-32 rounded-full bg-blue-500/[0.10] blur-3xl" aria-hidden />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/55 to-transparent" aria-hidden />

                <div className="relative flex items-center justify-between gap-3">
                  <div className="text-[14px] font-bold tracking-tight text-white">Live Outcome</div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-200/90">
                    <span className="relative flex h-2 w-2" aria-hidden>
                      <span className="absolute inset-0 rounded-full bg-emerald-400/60 animate-ping" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(16,185,129,1)]" />
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
                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/[0.14] px-3 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_1px_rgba(34,211,238,0.06)]">
                          <div className="text-[10px] font-bold uppercase tracking-wide text-white/45">Customer Price</div>
                          <div className="mt-2 text-[22px] font-extrabold leading-none tracking-tight text-cyan-300 tabular-nums drop-shadow-[0_0_12px_rgba(34,211,238,0.40)]">
                            {showLive ? animatedPriceDisplay : <span className="text-white/30">—</span>}
                          </div>
                        </div>
                        <div className="rounded-xl border border-cyan-400/22 bg-cyan-500/[0.09] px-3 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                          <div className="text-[10px] font-bold uppercase tracking-wide text-white/45">Job Cost</div>
                          <div className="mt-2 text-[22px] font-extrabold leading-none tracking-tight text-cyan-300/75 tabular-nums">
                            {showLive ? formatCurrency(cost) : <span className="text-white/30">—</span>}
                          </div>
                        </div>
                        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/[0.12] px-3 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_1px_rgba(16,185,129,0.06)]">
                          <div className="text-[10px] font-bold uppercase tracking-wide text-white/45">Profit</div>
                          <div className="mt-2 text-[22px] font-extrabold leading-none tracking-tight text-emerald-300 tabular-nums drop-shadow-[0_0_12px_rgba(16,185,129,0.35)]">
                            {showLive ? formatCurrency(profit) : <span className="text-white/30">—</span>}
                          </div>
                        </div>
                        <div className="rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
                          <div className="text-[10px] font-bold uppercase tracking-wide text-white/45">Margin</div>
                          <div className="mt-2 text-[22px] font-extrabold leading-none tracking-tight text-white tabular-nums">
                            {pricingMode === "direct"
                              ? <span className="text-white/30">—</span>
                              : showLive
                                ? `${finalMarginNum.toFixed(1)}%`
                                : <span className="text-white/30">—</span>}
                          </div>
                        </div>
                      </div>
                      <a
                        href="#deal-control"
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-cyan-200/70 transition hover:text-cyan-100"
                      >
                        View pricing breakdown
                        <span aria-hidden>›</span>
                      </a>
                    </div>
                  );
                })()}
              </div>

              <div className="rounded-xl border border-cyan-400/[0.16] bg-[#0a1422] p-3 shadow-[0_0_0_1px_rgba(34,211,238,0.05),inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[14px] font-bold tracking-tight text-white">Job Readiness</div>
                </div>
                {(() => {
                  const total = jobReadinessItems.length;
                  const done = jobReadinessReadyCount;
                  const pct = total > 0 ? done / total : 0;
                  const radius = 36;
                  const circumference = 2 * Math.PI * radius;
                  const dash = circumference * pct;
                  return (
                    <div className="mt-3 flex items-center gap-3">
                      <div className="relative h-24 w-24 shrink-0">
                        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden>
                          <circle
                            cx="50"
                            cy="50"
                            r={radius}
                            stroke="rgba(148,163,184,0.14)"
                            strokeWidth="9"
                            fill="transparent"
                          />
                          <circle
                            cx="50"
                            cy="50"
                            r={radius}
                            stroke="rgba(34,211,238,0.95)"
                            strokeWidth="9"
                            fill="transparent"
                            strokeDasharray={`${dash} ${circumference}`}
                            strokeLinecap="round"
                            style={{ filter: "drop-shadow(0 0 8px rgba(34,211,238,0.55))" }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                          <div className="text-[18px] font-extrabold text-cyan-300 tabular-nums leading-none">
                            {Math.round(pct * 100)}%
                          </div>
                          <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-white/55">
                            Ready
                          </div>
                        </div>
                      </div>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        {jobReadinessItems.map((item) => (
                          <div key={item.label} className="flex items-center gap-2 text-[11.5px]">
                            <span
                              className={
                                item.ready
                                  ? "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-emerald-300/55 bg-emerald-400/25 text-[9px] text-emerald-50 shadow-[0_0_8px_rgba(16,185,129,0.50)]"
                                  : "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-[9px] text-white/45"
                              }
                              aria-hidden
                            >
                              {item.ready ? "✓" : ""}
                            </span>
                            <span className={item.ready ? "text-white/85" : "text-white/50"}>{item.label}</span>
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
                  <div className="relative overflow-hidden rounded-xl border border-cyan-400/30 bg-gradient-to-br from-[#0f1e36] via-[#0c1930] to-[#080f1c] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_0_0_1px_rgba(34,211,238,0.08),0_8px_32px_-8px_rgba(34,211,238,0.30)] sm:p-4">
                    <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-blue-500/[0.18] blur-3xl" aria-hidden />
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/55 to-transparent" aria-hidden />
                    {/* Header row */}
                    <div className="relative flex items-center gap-2">
                      <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                        <span className="absolute inset-0 rounded-full bg-cyan-400/55 animate-ping" />
                        <span className="relative h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,1)]" />
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200/90">Next Action</span>
                      <span
                        className={`ml-auto rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                          allReady
                            ? "border-emerald-400/28 bg-emerald-500/14 text-emerald-100/90"
                            : "border-amber-400/28 bg-amber-500/14 text-amber-100/90"
                        }`}
                      >
                        {allReady ? "Ready" : "Waiting"}
                      </span>
                    </div>
                    {/* Side-by-side: text left, CTA button right */}
                    <div className="relative mt-2.5 flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-[16px] font-bold leading-snug text-white">{headline}</div>
                        <p className="mt-1 text-[11px] leading-relaxed text-white/55">{detail}</p>
                      </div>
                      <button
                        type="button"
                        className="flex shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border border-blue-300/50 bg-gradient-to-br from-blue-500 to-blue-600 px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_0_0_1px_rgba(59,130,246,0.45),0_12px_40px_-12px_rgba(59,130,246,0.80)] transition hover:from-blue-400 hover:to-blue-500"
                        aria-label={allReady ? "Open proposal review" : "Let's go"}
                      >
                        <ArrowRight className="h-5 w-5 text-white" aria-hidden />
                        <span className="text-[10px] font-bold text-white/90">{allReady ? "Review" : "Go"}</span>
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* AI OFFICE / ACTIVE TASKS */}
              <div className="rounded-xl border border-cyan-400/[0.16] bg-[#0a1422] p-3 shadow-[0_0_0_1px_rgba(34,211,238,0.05),inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-400/40 bg-cyan-500/[0.20] text-[10px] font-extrabold uppercase tracking-wider text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.45)]" aria-hidden>
                    AI
                  </span>
                  <div className="text-[13px] font-bold tracking-tight text-white">
                    AI Office <span className="font-normal text-white/40">· Active Tasks</span>
                  </div>
                </div>

                {(() => {
                  const items = jobReadinessItems;
                  const completed = items.filter((x) => x.ready);
                  const pending = items.filter((x) => !x.ready);
                  const waiting = pending[0];
                  const upcoming = pending.slice(1);
                  return (
                    <div className="mt-3 space-y-2">
                      {/* Completed row */}
                      <div className="overflow-hidden rounded-xl border border-emerald-400/22 bg-emerald-500/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                        <div className="flex items-center justify-between gap-3 px-3.5 py-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-300/50 bg-emerald-400/22 text-[14px] font-bold text-emerald-50 shadow-[0_0_16px_rgba(16,185,129,0.55)]" aria-hidden>
                              ✓
                            </span>
                            <div>
                              <div className="text-[12.5px] font-bold text-white">Completed</div>
                              <div className="text-[10px] text-emerald-200/65 leading-tight">
                                {completed.length > 0 ? completed.slice(0,2).map(i=>i.label).join(", ") + (completed.length > 2 ? "…" : "") : "None yet"}
                              </div>
                            </div>
                          </div>
                          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-emerald-300/35 bg-emerald-500/22 text-[13px] font-extrabold tabular-nums text-emerald-100 shadow-[0_0_12px_rgba(16,185,129,0.40)]">
                            {completed.length}
                          </span>
                        </div>
                      </div>

                      {/* Waiting on you row */}
                      <div className={`overflow-hidden rounded-xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${waiting ? "border-amber-400/28 bg-amber-500/[0.10]" : "border-white/[0.07] bg-white/[0.025]"}`}>
                        <div className="flex items-center justify-between gap-3 px-3.5 py-3">
                          <div className="flex items-center gap-3">
                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[14px] font-extrabold ${waiting ? "border-amber-300/50 bg-amber-400/22 text-amber-50 shadow-[0_0_16px_rgba(245,158,11,0.55)]" : "border-white/15 bg-white/[0.05] text-white/35"}`} aria-hidden>
                              {waiting ? "!" : "·"}
                            </span>
                            <div>
                              <div className={`text-[12.5px] font-bold ${waiting ? "text-white" : "text-white/45"}`}>Waiting on you</div>
                              <div className={`text-[10px] leading-tight ${waiting ? "text-amber-200/65" : "text-white/30"}`}>
                                {waiting ? waiting.label : "Nothing waiting"}
                              </div>
                            </div>
                          </div>
                          <span className={`flex h-7 w-7 items-center justify-center rounded-full border text-[13px] font-extrabold tabular-nums ${waiting ? "border-amber-300/35 bg-amber-500/22 text-amber-100 shadow-[0_0_12px_rgba(245,158,11,0.40)]" : "border-white/10 bg-white/[0.04] text-white/30"}`}>
                            {waiting ? 1 : 0}
                          </span>
                        </div>
                      </div>

                      {/* Next up row */}
                      <div className="overflow-hidden rounded-xl border border-white/[0.09] bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                        <div className="flex items-center justify-between gap-3 px-3.5 py-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.14] bg-white/[0.07] text-[16px] font-bold text-white/60" aria-hidden>
                              ›
                            </span>
                            <div>
                              <div className="text-[12.5px] font-bold text-white/75">Next up</div>
                              <div className="text-[10px] text-white/40 leading-tight">
                                {upcoming.length > 0 ? `${upcoming.length} tasks queued` : "Queue clear"}
                              </div>
                            </div>
                          </div>
                          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.05] text-[13px] font-extrabold tabular-nums text-white/55">
                            {upcoming.length}
                          </span>
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
        </div>
        </div>
          </>
        )}
      </div>
    </main>
  );
}
