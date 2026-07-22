"use client";

import { useSearchParams, useRouter } from "next/navigation"
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { motion, useSpring, useMotionValueEvent } from "framer-motion";
import { getAIReview } from "./aiReview";
import {
  ArrowLeft,
  Ruler,
  Package,
  DollarSign,
  Trash2,
  Triangle,
  TrendingUp,
  Sparkles,
  Info,
  MapPin,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  ClipboardList,
  Image as ImageIcon,
  Mic,
  MessageCircle,
  Percent,
  CheckCircle2,
  ArrowRight,
  Pencil,
  CircleHelp,
  Eye,
  Home,
  User,
  ShieldCheck,
  Camera,
  Download,
  Save,
  Send,
  MoreHorizontal,
  Truck,
  Settings,
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
import type {
  MeasurementRecord,
  MeasurementSummary,
  MeasurementStatus,
  MeasurementSourceType,
} from "@/app/lib/measurementTypes";
import {
  createJob,
  getJobById,
  getOrCreateJobForEstimate,
  isUuidLike,
  buildFormattedAddress,
  updateJob,
} from "@/app/lib/jobStore";
import { findOrCreateCustomer } from "@/app/lib/customerStore";
import { ensureJobCustomerPersisted } from "@/app/lib/jobCardCustomerPersist";
import { LAST_DB_JOB_ID_STORAGE_KEY } from "@/app/lib/jobBoardAdapter";
import { LEGACY_ESTIMATE_SEND_BLOCKED_FOR_DB_MESSAGE } from "@/app/lib/legacyEstimateSendGuard";
import { productSpineRouteHintsFromSearchParams } from "@/app/lib/productSpine";
import { getSupabaseClient } from "@/app/lib/supabaseClient";
import {
  getSelectedMeasurementForJob,
  getMeasurementsForJob,
  createMeasurementRecord,
  updateMeasurementRecord,
  selectMeasurementRecord,
  type MeasurementRecordDraft,
} from "@/app/lib/measurementStore";
import type { MeasurementRecord } from "@/app/lib/measurementTypes";
import {
  deriveEstimateReadiness,
  deriveProductionReadiness,
  deriveMeasurementMissingFields,
  deriveAllMissingFieldsForPersistence,
  deriveMeasurementStatusForPersistence,
  deriveMeasurementReadinessScore,
  measurementRecordsDiffer,
  resolveMeasurementWorkspaceState,
  resolveActivityMeasurementLine,
  formatSourceTypeLabel,
  formatReportStatusLabel,
  formatReportLastUpdatedLabel,
  formatReportAttachedLabel,
  formatDiagramAvailableLabel,
  formatNullableId,
  formatReportPathHelperText,
  hasRoofSize,
} from "@/app/lib/measurementReadiness";
import {
  buildMeasurementProposalHandoff,
  deriveQuantityMapFromRecord,
  resolveProposalHandoffNextAction,
} from "@/app/lib/measurementProposalHandoff";
import { getActiveCatalogItemsByCompany } from "@/app/lib/catalogStore";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import {
  deriveCatalogReadiness,
  formatCatalogReadinessLabel,
} from "@/app/lib/catalogReadiness";
import { DEFAULT_ROOFING_CATALOG_DEFINITIONS } from "@/app/lib/defaultRoofingCatalog";
import {
  buildProposalBuilderHref,
  deriveProposalBuilderReadiness,
  resolveJobCardProposalActivityLine,
} from "@/app/lib/proposalBuilderReadiness";
import {
  createNewProposalDraftEntry,
  isExpectedProposalDraftEntryFailure,
  type ResolveOrCreateProposalDraftEntryReason,
} from "@/app/lib/proposalDraftEntry";
import { getResolvedCompanyPricingPolicy } from "@/app/lib/companyPricingPolicyStore";
import {
  createDraftProposal,
  getProposalOptionLabel,
  listProposalsForJob,
} from "@/app/lib/proposalRecordStore";
import type { ProposalRecordStatusSummary } from "@/app/lib/proposalRecordTypes";
import {
  filterContractorVisibleProposals,
  filterContractorVisibleTemplates,
  pickContractorVisibleJobDraft,
} from "@/app/lib/contractorFixtureIsolation";
import { deriveProposalTemplateReadiness } from "@/app/lib/proposalTemplateReadiness";
import {
  getProposalTemplateGraph,
  getProposalTemplatesByCompany,
  type ProposalTemplateGraph,
} from "@/app/lib/proposalTemplateStore";
import { getPreferredSetupTemplateId } from "@/app/lib/companyTemplatePreferenceStore";
import type { ProposalTemplate } from "@/app/lib/proposalTemplateTypes";
import { findStarterProposalTemplate } from "@/app/tools/roofing/templates/templatesSetupUtils";
import {
  buildJobCardPackageSetup,
  deriveJobCardSelectedTemplateEligibility,
  filterJobCardCreateProposalTemplates,
  resolveDefaultJobCardTemplateId,
  resolveDefaultPackageOptionId,
} from "@/app/tools/roofing/jobCard/jobCardProposalSetup";
import JobCardProposalsTab, {
  JobCardProposalsAddHeaderButton,
} from "@/app/tools/roofing/jobCard/JobCardProposalsTab";
import { JobCardCreateProposalModal } from "@/app/tools/roofing/jobCard/JobCardCreateProposalModal";
import {
  buildCreateProposalMeasurementChoice,
  type CreateProposalMeasurementChoice,
  type CreateProposalModalStep,
} from "@/app/tools/roofing/jobCard/jobCardCreateProposalModalModel";
import {
  JOB_CARD_PROPOSAL_ACTIVITY_CREATED_LABEL,
  JOB_CARD_PROPOSAL_ACTIVITY_READY_LABEL,
  JOB_CARD_PROPOSAL_ACTIVITY_READY_NOTE,
  JOB_CARD_PROPOSALS_TAB_SUBTITLE,
  buildJobCardProposalRowViews,
  formatJobCardContractorProposalStatusLabel,
  formatJobCardProposalCreatedActivityNote,
} from "@/app/tools/roofing/jobCard/jobCardProposalsTabModel";
import type { JobDraft, JobAddress, JobRecord } from "@/app/lib/jobTypes";
import { sendEstimateEmailWithPdf } from "@/app/lib/sendEstimateClient";
import { getFavorite, setFavorite, setLocked, appendFeedback, getTierFeedbackBias, type TierLabel } from "@/app/lib/aiWordingPrefs";
import RoofingTabs from "@/app/tools/roofing/RoofingTabs";
import RoofingClientV2 from "../roofing-v2/RoofingClientV2";
import FieldDiveAppShell from "@/app/tools/roofing/FieldDiveAppShell";
import { buildJobCardDisplayModel } from "@/app/tools/roofing/saved/jobsBoardUtils";
import JobCardHeader from "@/app/tools/roofing/jobCard/JobCardHeader";
import JobCardMetadataStrip from "@/app/tools/roofing/jobCard/JobCardMetadataStrip";
import JobCardTabs, { type JobCardTabId } from "@/app/tools/roofing/jobCard/JobCardTabs";
import { JOB_CARD_TABS } from "@/app/tools/roofing/jobCard/jobCardTypes";
import JobCardSectionPanel from "@/app/tools/roofing/jobCard/JobCardSectionPanel";
import JobCardActivityPanel, { type JobCardActivityItem } from "@/app/tools/roofing/jobCard/JobCardActivityPanel";
import JobCardOverviewSummary from "@/app/tools/roofing/jobCard/JobCardOverviewSummary";
import { resolveJobCardIdentityFromRecord } from "@/app/tools/roofing/jobCard/jobCardIdentityUtils";
import { loadCompanyVoiceProfile, saveCompanyVoiceProfile, type VoiceTone } from "@/app/lib/companyVoiceProfile";

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

/** Local Job Card display bundle — not persisted. */
type JobCardMeasurementView = {
  record: MeasurementRecord;
  summary: MeasurementSummary;
  missingFields: string[];
};

type PacketFieldSnapshot = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  jobAddress1: string;
  jobCity: string;
  jobState: string;
  jobZip: string;
};

type PacketReadinessRow = {
  id: string;
  label: string;
  hint: string;
  ready: boolean;
};

function getPacketReadinessRows(fields: PacketFieldSnapshot): PacketReadinessRow[] {
  return [
    {
      id: "contact",
      label: "Customer contact",
      hint: "Name, email, or phone",
      ready: Boolean((fields.customerName || fields.customerEmail || fields.customerPhone).trim()),
    },
    {
      id: "street",
      label: "Street address",
      hint: "Service location line 1",
      ready: Boolean((fields.jobAddress1 || "").trim()),
    },
    {
      id: "zip",
      label: "ZIP code",
      hint: "Five digits for presets",
      ready: (fields.jobZip || "").trim().length === 5,
    },
    {
      id: "citystate",
      label: "City & state",
      hint: "Refines routing & tax context",
      ready: Boolean((fields.jobCity || "").trim()) && Boolean((fields.jobState || "").trim()),
    },
  ];
}

function getPacketMinimumFieldsComplete(fields: PacketFieldSnapshot): boolean {
  const rows = getPacketReadinessRows(fields);
  return rows.every((row) => row.ready);
}

type BuildJobCardMeasurementInput = {
  area: string;
  waste: string;
  squares: number;
  adjustedSquares: number;
  pitch: PitchKey;
  stories: StoriesKey;
  complexity: ComplexityKey;
  debrisTons: number;
  includeDebrisRemoval: boolean;
  removalType: DebrisRemovalType;
  guidedStories: GuidedStories;
  guidedWalkable: GuidedWalkable;
  laborMode: LaborMode;
  loadSavedId: string | null;
  currentLoadedSavedId: string | null;
  companyId?: string;
};

function formatJobCardStoriesLabel(stories: string | null | undefined): string {
  if (stories === "1") return "1 story";
  if (stories === "2") return "2 stories";
  if (stories === "3") return "3+ stories";
  return "Not selected";
}

function formatJobCardComplexityLabel(complexity: string | null | undefined): string {
  if (complexity === "simple") return "Simple";
  if (complexity === "moderate") return "Moderate";
  if (complexity === "complex") return "Complex";
  return "Not selected";
}

function formatJobCardLf(value: number | null | undefined): string {
  return value != null && Number.isFinite(value) ? String(value) : "—";
}

function formatJobCardCount(value: number | null | undefined): string {
  return value != null && Number.isFinite(value) ? String(value) : "Not measured";
}

/**
 * Local Job Card display adapter only.
 * Not a persisted MeasurementRecord; does not write to database or pricing.
 */
function buildJobCardSelectedMeasurement(input: BuildJobCardMeasurementInput): JobCardMeasurementView {
  const roofAreaSqft = parseFloat(input.area) || 0;
  const wastePercent = parseFloat(input.waste);
  const wasteValid = Number.isFinite(wastePercent);
  const roofSquares =
    Number.isFinite(input.squares) && input.squares > 0 ? input.squares : roofAreaSqft > 0 ? roofAreaSqft / 100 : null;
  const adjustedRoofSquares =
    Number.isFinite(input.adjustedSquares) && input.adjustedSquares > 0 ? input.adjustedSquares : null;
  const debrisEstimate =
    Number.isFinite(input.debrisTons) && input.debrisTons > 0 ? input.debrisTons : null;

  const hasMeasurement = roofAreaSqft > 0 || (roofSquares != null && roofSquares > 0);

  const missingFields: string[] = [];
  if (!hasMeasurement) missingFields.push("Roof size");
  missingFields.push("Report measurements");
  missingFields.push("Measurement report");

  const status: MeasurementStatus = hasMeasurement ? "measured" : "incomplete";
  const estimateReady = hasMeasurement;
  const productionReady = false;

  const estimateId = input.loadSavedId ?? input.currentLoadedSavedId ?? null;
  const recordId = estimateId ?? "job-card-local-draft";

  const pitchLabel =
    input.pitch === "walkable" ? "Walkable" : input.pitch === "moderate" ? "Moderate" : "Steep";

  const record: MeasurementRecord = {
    id: recordId,
    company_id: input.companyId?.trim() || "local",
    estimate_id: estimateId,
    job_id: null,
    created_at: "local-draft",
    updated_at: "local-draft",
    status,
    is_selected: true,
    source_type: "manual" as MeasurementSourceType,
    source_provider: null,
    source_report_id: null,
    source_file_id: null,
    is_verified: false,
    confidence_score: null,
    confidence_label: null,
    field_confidence: null,
    roof_area_sqft: hasMeasurement ? roofAreaSqft : null,
    roof_squares: roofSquares,
    adjusted_roof_squares: adjustedRoofSquares,
    waste_percent: wasteValid ? wastePercent : null,
    pitch_label: pitchLabel,
    stories: input.stories,
    roof_complexity: input.complexity,
    roof_type: null,
    structure_count: null,
    roof_facets_count: null,
    eaves_lf: null,
    rakes_lf: null,
    ridges_lf: null,
    hips_lf: null,
    valleys_lf: null,
    wall_flashing_lf: null,
    step_flashing_lf: null,
    transitions_lf: null,
    parapet_wall_lf: null,
    drip_edge_lf: null,
    starter_lf: null,
    ridge_cap_lf: null,
    tear_off_required: input.includeDebrisRemoval,
    debris_tons_estimate: debrisEstimate,
    report_attached: false,
    diagram_available: false,
    report_status: "Not attached",
    report_source: "Manual",
    report_last_updated_at: null,
    report_type: null,
    quantity_map: null,
    assumptions: {
      guidedStories: input.guidedStories,
      guidedWalkable: input.guidedWalkable,
      removalType: input.removalType,
      laborMode: input.laborMode,
    },
    missing_fields: missingFields,
    measurement_readiness_score: null,
    estimate_ready: estimateReady,
    production_ready: productionReady,
  };

  const summary: MeasurementSummary = {
    id: record.id,
    status: record.status,
    source_type: record.source_type,
    confidence_label: record.confidence_label,
    is_verified: record.is_verified,
    roof_squares: record.roof_squares,
    adjusted_roof_squares: record.adjusted_roof_squares,
    waste_percent: record.waste_percent,
    pitch_label: record.pitch_label,
    stories: record.stories,
    estimate_ready: record.estimate_ready,
    production_ready: record.production_ready,
  };

  return { record, summary, missingFields };
}

function jobCardHasAnyLineMeasurement(record: MeasurementRecord): boolean {
  const values = [
    record.roof_facets_count,
    record.eaves_lf,
    record.rakes_lf,
    record.ridges_lf,
    record.hips_lf,
    record.valleys_lf,
    record.wall_flashing_lf,
    record.step_flashing_lf,
    record.transitions_lf,
    record.parapet_wall_lf,
    record.drip_edge_lf,
    record.starter_lf,
    record.ridge_cap_lf,
  ];
  return values.some((v) => v != null && Number.isFinite(v));
}

function deriveJobCardMissingFieldsFromRecord(record: MeasurementRecord): string[] {
  const estimate = deriveMeasurementMissingFields(record, "estimate");
  const production = deriveMeasurementMissingFields(record, "production");
  return [...new Set([...estimate, ...production])];
}

/** Read-only Job Card view from a persisted measurement_records row. */
function buildJobCardMeasurementViewFromRecord(record: MeasurementRecord): JobCardMeasurementView {
  const missingFields =
    Array.isArray(record.missing_fields) && record.missing_fields.length > 0
      ? [...record.missing_fields]
      : deriveJobCardMissingFieldsFromRecord(record);

  const summary: MeasurementSummary = {
    id: record.id,
    status: record.status,
    source_type: record.source_type,
    confidence_label: record.confidence_label,
    is_verified: record.is_verified,
    roof_squares: record.roof_squares,
    adjusted_roof_squares: record.adjusted_roof_squares,
    waste_percent: record.waste_percent,
    pitch_label: record.pitch_label,
    stories: record.stories,
    estimate_ready: record.estimate_ready,
    production_ready: record.production_ready,
  };

  return { record, summary, missingFields };
}

type BuildManualMeasurementDraftInput = {
  companyId: string;
  currentJobId: string;
  currentLoadedSavedId: string | null;
  localMeasurement: JobCardMeasurementView;
};

/** Maps Job Card local measurement state to a persistence draft (no pricing/proposal fields). */
function buildManualMeasurementDraftFromJobCardState(
  input: BuildManualMeasurementDraftInput
): MeasurementRecordDraft {
  const record = input.localMeasurement.record;
  const estimate = deriveEstimateReadiness(record);
  const production = deriveProductionReadiness(record);
  const estimateReady = estimate.ready;
  const productionReady = production.ready;
  const missingFields = deriveAllMissingFieldsForPersistence(record);
  const status = deriveMeasurementStatusForPersistence(record, estimateReady);
  const measurementReadinessScore = deriveMeasurementReadinessScore(
    estimateReady,
    productionReady,
    hasRoofSize(record)
  );

  return {
    company_id: input.companyId,
    job_id: input.currentJobId,
    estimate_id: isUuidLike(input.currentLoadedSavedId) ? input.currentLoadedSavedId : null,
    source_type: "manual",
    status,
    is_selected: false,
    is_verified: false,
    roof_area_sqft: record.roof_area_sqft,
    roof_squares: record.roof_squares,
    adjusted_roof_squares: record.adjusted_roof_squares,
    waste_percent: record.waste_percent,
    pitch_label: record.pitch_label,
    stories: record.stories,
    roof_complexity: record.roof_complexity,
    tear_off_required: record.tear_off_required,
    debris_tons_estimate: record.debris_tons_estimate,
    report_attached: false,
    diagram_available: false,
    report_status: record.report_status ?? "Not attached",
    report_source: record.report_source ?? "Manual",
    assumptions: record.assumptions ?? null,
    missing_fields: missingFields,
    measurement_readiness_score: measurementReadinessScore,
    estimate_ready: estimateReady,
    production_ready: productionReady,
  };
}

export default function RoofingClient({ companyId }: { companyId?: string }) {
  setEstimateStoreCompanyScope(companyId ?? null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const loadSavedId = searchParams.get("loadSaved");
  const entryParam = searchParams.get("entry");
  const fromParam = searchParams.get("from");
  const isBoardOriginParam = fromParam === "board";
  const jobParam = searchParams.get("job");
  const legacyManual = searchParams.get("legacy") === "1";
  const entryMode: "packet" | "manual" | "instant" | "job-card" = loadSavedId
    ? "job-card"
    : entryParam === "manual"
      ? legacyManual
        ? "manual"
        : "job-card"
      : entryParam === "instant"
        ? "instant"
        : entryParam === "job-card"
          ? "job-card"
          : "packet";
  const [zipPresets, setZipPresets] = useState<ZipPresetsMap | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [restoreTick, setRestoreTick] = useState(0);
  const [showV2Preview, setShowV2Preview] = useState(false);
  const hasSeededV2PreviewDefaultsRef = useRef(false);
  const loadAppliedRef = useRef(false);
  const jobLinkAppliedRef = useRef<string | null>(null);
  const jobLinkInFlightRef = useRef<string | null>(null);
  const linkedJobIdByEstimateRef = useRef<Record<string, string>>({});
  const jobHydratedRef = useRef<string | null>(null);
  const jobHydrateInFlightRef = useRef<string | null>(null);
  const isRestoringRef = useRef(false);
  const restoreTimerRef = useRef<number | null>(null);
  const autoSendFiredRef = useRef(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [isCreatingJob, setIsCreatingJob] = useState(false);
  const [jobCreationError, setJobCreationError] = useState<string | null>(null);
  const [persistedSelectedMeasurement, setPersistedSelectedMeasurement] =
    useState<MeasurementRecord | null>(null);
  const measurementFetchInFlightRef = useRef<string | null>(null);
  const [activeCatalogItems, setActiveCatalogItems] = useState<CatalogItem[]>([]);
  const [catalogLoadError, setCatalogLoadError] = useState<string | null>(null);
  const catalogFetchInFlightRef = useRef<string | null>(null);
  const [starterTemplateGraph, setStarterTemplateGraph] = useState<ProposalTemplateGraph | null>(null);
  const [companyProposalTemplates, setCompanyProposalTemplates] = useState<ProposalTemplate[]>([]);
  const [selectedJobTemplateId, setSelectedJobTemplateId] = useState<string | null>(null);
  const [jobCardSelectedPackageOptionId, setJobCardSelectedPackageOptionId] = useState<
    string | null
  >(null);
  const [templateSetupLoadComplete, setTemplateSetupLoadComplete] = useState(false);
  const templateSetupFetchInFlightRef = useRef<string | null>(null);
  const templateGraphFetchInFlightRef = useRef<string | null>(null);
  const [pricingPolicyConfigured, setPricingPolicyConfigured] = useState<boolean | null>(null);
  const [pricingPolicyLoadComplete, setPricingPolicyLoadComplete] = useState(false);
  const pricingPolicyFetchInFlightRef = useRef<string | null>(null);
  const customerPersistInFlightRef = useRef<string | null>(null);
  const [isSavingMeasurement, setIsSavingMeasurement] = useState(false);
  const [measurementSaveError, setMeasurementSaveError] = useState<string | null>(null);
  const [proposalLaunchError, setProposalLaunchError] = useState<string | null>(null);
  const [proposalLaunchReason, setProposalLaunchReason] =
    useState<ResolveOrCreateProposalDraftEntryReason | null>(null);
  const [isLaunchingProposal, setIsLaunchingProposal] = useState(false);
  const [isCreatingNewProposal, setIsCreatingNewProposal] = useState(false);
  /** Block 3: + Proposal opens measurement → template → package modal. */
  const [createProposalModalOpen, setCreateProposalModalOpen] = useState(false);
  const [createProposalModalStep, setCreateProposalModalStep] =
    useState<CreateProposalModalStep>("measurement");
  const [createProposalModalMeasurements, setCreateProposalModalMeasurements] =
    useState<CreateProposalMeasurementChoice[]>([]);
  const createProposalMeasurementRecordsRef = useRef<MeasurementRecord[]>([]);
  const proposalLaunchInFlightRef = useRef(false);
  const measurementSaveInFlightRef = useRef<string | null>(null);
  const measurementFormHydratedRef = useRef<string | null>(null);
  const [jobCardTab, setJobCardTab] = useState<JobCardTabId>("overview");
  const [jobCardBoardOrigin, setJobCardBoardOrigin] = useState(false);
  const [hydratedJobRecord, setHydratedJobRecord] = useState<JobRecord | null>(null);
  /** Listed draft for this job when jobs.active_proposal_id is unset (reuse still finds it). */
  const [listedJobDraftProposalId, setListedJobDraftProposalId] = useState<string | null>(null);
  const [listedJobDraftSummary, setListedJobDraftSummary] =
    useState<ProposalRecordStatusSummary | null>(null);
  const [listedJobDraftSummaries, setListedJobDraftSummaries] = useState<
    ProposalRecordStatusSummary[]
  >([]);
  const [listedJobDraftPackageLabel, setListedJobDraftPackageLabel] = useState<string | null>(
    null
  );
  const [listedJobDraftPackageLabels, setListedJobDraftPackageLabels] = useState<
    Record<string, string | null>
  >({});
  const listedDraftFetchInFlightRef = useRef<string | null>(null);

  useEffect(() => {
    if (loadSavedId || isBoardOriginParam) {
      setJobCardBoardOrigin(true);
      return;
    }
    if (entryParam === "packet" || entryParam === "instant") {
      setJobCardBoardOrigin(false);
      return;
    }
    if (entryParam === "job-card" && !isBoardOriginParam && !loadSavedId) {
      setJobCardBoardOrigin(false);
    }
  }, [loadSavedId, entryParam, isBoardOriginParam]);

  useEffect(() => {
    if (jobParam && isUuidLike(jobParam)) {
      setCurrentJobId(jobParam);
      return;
    }
    if (entryMode === "packet" || entryMode === "instant") {
      setCurrentJobId(null);
      jobHydratedRef.current = null;
      setHydratedJobRecord(null);
    }
  }, [jobParam, entryMode]);

  // Recovery: remember the last-opened DB Job Card so the sidebar / nav can
  // reopen it via job= even if the URL loses the param. Read-only persistence.
  useEffect(() => {
    if (entryMode !== "job-card") return;
    if (!currentJobId || !isUuidLike(currentJobId)) return;
    try {
      window.localStorage.setItem(LAST_DB_JOB_ID_STORAGE_KEY, currentJobId);
    } catch {
      // ignore storage failures
    }
  }, [entryMode, currentJobId]);

  // Honor ?tab= on the Job Card (e.g. returnTo / normalization land on Proposals).
  useEffect(() => {
    if (entryMode !== "job-card") return;
    const tab = searchParams.get("tab");
    if (!tab) return;
    if (JOB_CARD_TABS.some((t) => t.id === tab)) {
      setJobCardTab(tab as JobCardTabId);
    }
  }, [entryMode, searchParams]);

  const isJobCardBoardContext =
    jobCardBoardOrigin || Boolean(loadSavedId) || isBoardOriginParam;

  // Clean DB Job Card route: entry=job-card&job=<uuid> with no legacy/board-origin
  // context. On this route the DB job record is the sole source of truth; legacy
  // currentSaved/loadSaved state must not bleed in.
  const isCleanDbJobCardRoute =
    entryMode === "job-card" &&
    !loadSavedId &&
    !isBoardOriginParam &&
    !jobCardBoardOrigin &&
    Boolean(jobParam) &&
    isUuidLike(jobParam ?? "");

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
    if (s?.pitch === "walkable" || s?.pitch === "moderate" || s?.pitch === "steep") {
      setPitch(s.pitch as PitchKey);
    }
    if (s?.stories === "1" || s?.stories === "2" || s?.stories === "3") {
      setStories(s.stories as StoriesKey);
    }
    if (s?.complexity === "simple" || s?.complexity === "moderate" || s?.complexity === "complex") {
      setComplexity(s.complexity as ComplexityKey);
    }
    if (s?.guidedStories === "one" || s?.guidedStories === "two" || s?.guidedStories === "threePlus") {
      setGuidedStories(s.guidedStories as GuidedStories);
    }
    if (s?.guidedWalkable === "walkable" || s?.guidedWalkable === "steep") {
      setGuidedWalkable(s.guidedWalkable as GuidedWalkable);
    }

    setCurrentLoadedSavedId(loadSavedId);

    loadAppliedRef.current = true;
  }, [loadSavedId, router, beginRestoreWindow]);

  const applyJobToSession = useCallback((jobId: string, estimateId?: string | null) => {
    if (!isUuidLike(jobId)) return;
    if (estimateId) {
      linkedJobIdByEstimateRef.current[estimateId] = jobId;
    }
    setCurrentJobId(jobId);
    if (typeof window === "undefined") return;
    const targetPath = `/tools/roofing?entry=job-card&job=${encodeURIComponent(jobId)}`;
    const params = new URLSearchParams(window.location.search);
    if (params.get("entry") === "job-card" && params.get("job") === jobId) return;
    window.history.replaceState({}, "", targetPath);
  }, []);

  useEffect(() => {
    const activeEstimateId = loadSavedId ?? getCurrentLoadedSavedId();
    if (jobLinkAppliedRef.current && jobLinkAppliedRef.current !== activeEstimateId) {
      jobLinkAppliedRef.current = null;
    }
    if (jobLinkInFlightRef.current && jobLinkInFlightRef.current !== activeEstimateId) {
      jobLinkInFlightRef.current = null;
    }
  }, [loadSavedId]);

  useEffect(() => {
    const cid = (companyId ?? "").trim();
    if (!cid || entryMode !== "job-card") return;
    if (!isJobCardBoardContext) return;

    const estimateId = loadSavedId ?? getCurrentLoadedSavedId() ?? null;
    if (!estimateId) return;

    const cachedJobId = linkedJobIdByEstimateRef.current[estimateId];
    if (cachedJobId && isUuidLike(cachedJobId)) {
      applyJobToSession(cachedJobId, estimateId);
      return;
    }

    const match =
      getSavedEstimateById(estimateId) ??
      getSavedEstimates().find((e) => e.id === estimateId);

    if (match?.jobId && isUuidLike(match.jobId)) {
      applyJobToSession(match.jobId, estimateId);
      return;
    }

    if (jobLinkInFlightRef.current === estimateId) return;

    if (!match) return;

    jobLinkInFlightRef.current = estimateId;

    void (async () => {
      try {
        const job = await getOrCreateJobForEstimate({ ...match, id: match.id }, cid);
        if (job?.id) {
          jobLinkAppliedRef.current = estimateId;
          applyJobToSession(job.id, estimateId);
          if (!match.jobId) {
            patchSavedEstimate(estimateId, { jobId: job.id });
          }
        } else {
          console.warn("[RoofingClient] job link failed for estimate", estimateId);
        }
      } finally {
        if (jobLinkInFlightRef.current === estimateId) {
          jobLinkInFlightRef.current = null;
        }
      }
    })();
  }, [loadSavedId, companyId, entryMode, applyJobToSession, isJobCardBoardContext]);

  useEffect(() => {
    if (entryMode !== "job-card") return;
    if (!currentJobId || !isUuidLike(currentJobId)) return;
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const legacyFromSuffix = loadSavedId && isJobCardBoardContext ? "&from=board" : "";
    const loadSavedSuffix = loadSavedId
      ? `&loadSaved=${encodeURIComponent(loadSavedId)}`
      : "";
    const targetPath = `/tools/roofing?entry=job-card&job=${encodeURIComponent(currentJobId)}${loadSavedSuffix}${legacyFromSuffix}`;
    if (
      params.get("entry") === "job-card" &&
      params.get("job") === currentJobId &&
      (params.get("loadSaved") ?? null) === (loadSavedId ?? null) &&
      (params.get("from") === "board") === Boolean(loadSavedId && isJobCardBoardContext)
    ) {
      return;
    }
    window.history.replaceState({}, "", targetPath);
  }, [entryMode, currentJobId, isJobCardBoardContext, loadSavedId]);

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
      const jobQuery =
        currentJobId && isUuidLike(currentJobId)
          ? `&job=${encodeURIComponent(currentJobId)}`
          : "";
      window.history.replaceState({}, "", `/tools/roofing?entry=job-card${jobQuery}&from=board`);
    }
  }, [
    loadSavedId,
    area,
    waste,
    bundlesPerSquare,
    bundleCost,
    laborPerSquare,
    margin,
    pricingMode,
    currentJobId,
  ]);

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

  const resetPacketIntakeFields = useCallback(() => {
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
    setJobAddress1("");
    setJobCity("");
    setJobState("");
    setJobZip("");
    setJobCreationError(null);
    setAutofillFromZip(false);
    setZipNoPresetMessage(false);
    setPreAutofillSnapshot(null);
  }, []);

  useEffect(() => {
    if (loadSavedId || isBoardOriginParam) return;
    if (entryMode !== "packet" && entryMode !== "instant") return;
    if (jobParam && isUuidLike(jobParam)) return;
    resetPacketIntakeFields();
    setCurrentLoadedSavedId(null);
  }, [entryMode, jobParam, loadSavedId, isBoardOriginParam, resetPacketIntakeFields]);

  // Moving into the clean DB Job Card flow clears any lingering legacy
  // "current loaded saved id" so currentSaved cannot fill/override DB job fields.
  useEffect(() => {
    if (!isCleanDbJobCardRoute) return;
    if (!hasMounted) return;
    if (getCurrentLoadedSavedId()) {
      setCurrentLoadedSavedId(null);
    }
  }, [isCleanDbJobCardRoute, hasMounted]);

  const hydrateJobDisplayFromRecord = useCallback(
    (job: JobRecord, options: { fillEmptyOnly: boolean }) => {
      const { fillEmptyOnly } = options;
      const contact = job.contact;
      const address = job.address;
      setCustomerName((prev) => {
        const next = (contact?.customer_name ?? "").trim();
        if (!next) return prev;
        if (fillEmptyOnly && prev.trim()) return prev;
        return next;
      });
      setCustomerEmail((prev) => {
        const next = (contact?.customer_email ?? "").trim();
        if (!next) return prev;
        if (fillEmptyOnly && prev.trim()) return prev;
        return next;
      });
      setCustomerPhone((prev) => {
        const next = (contact?.customer_phone ?? "").trim();
        if (!next) return prev;
        if (fillEmptyOnly && prev.trim()) return prev;
        return next;
      });
      setJobAddress1((prev) => {
        const next = (address?.line1 ?? "").trim();
        if (!next) return prev;
        if (fillEmptyOnly && prev.trim()) return prev;
        return next;
      });
      setJobCity((prev) => {
        const next = (address?.city ?? "").trim();
        if (!next) return prev;
        if (fillEmptyOnly && prev.trim()) return prev;
        return next;
      });
      setJobState((prev) => {
        const next = (address?.state ?? "").trim();
        if (!next) return prev;
        if (fillEmptyOnly && prev.trim()) return prev;
        return next;
      });
      setJobZip((prev) => {
        const next = (address?.zip ?? "").trim();
        if (!next) return prev;
        if (fillEmptyOnly && prev.trim()) return prev;
        return next;
      });
    },
    []
  );

  useEffect(() => {
    const jobId = searchParams.get("job");
    if (jobHydratedRef.current && jobHydratedRef.current !== jobId) {
      jobHydratedRef.current = null;
    }
    if (jobHydrateInFlightRef.current && jobHydrateInFlightRef.current !== jobId) {
      jobHydrateInFlightRef.current = null;
    }
  }, [searchParams]);

  useEffect(() => {
    if (entryMode !== "job-card") return;

    const jobId = searchParams.get("job");
    if (!jobId || !isUuidLike(jobId)) return;

    const cid = (companyId ?? "").trim();
    if (!cid) return;

    if (isRestoringRef.current) return;
    if (loadSavedId && !loadAppliedRef.current) return;

    if (jobHydratedRef.current === jobId) return;
    if (jobHydrateInFlightRef.current === jobId) return;

    const fillEmptyOnly =
      isJobCardBoardContext &&
      (Boolean(loadSavedId) ||
        (loadAppliedRef.current && Boolean(getCurrentLoadedSavedId())));

    jobHydrateInFlightRef.current = jobId;

    void (async () => {
      try {
        const job = await getJobById(jobId);
        if (!job) {
          console.warn("[RoofingClient] job hydrate: job not found", jobId);
          setHydratedJobRecord(null);
          return;
        }
        if (String(job.company_id || "").trim() !== cid) {
          console.warn("[RoofingClient] job hydrate: company mismatch", { jobId, companyId: cid });
          setHydratedJobRecord(null);
          return;
        }
        setHydratedJobRecord(job);
        hydrateJobDisplayFromRecord(job, { fillEmptyOnly });
        jobHydratedRef.current = jobId;
        setCurrentJobId(jobId);
      } catch (err) {
        console.warn("[RoofingClient] job hydrate error:", err);
      } finally {
        if (jobHydrateInFlightRef.current === jobId) {
          jobHydrateInFlightRef.current = null;
        }
      }
    })();
  }, [
    entryMode,
    searchParams,
    companyId,
    loadSavedId,
    restoreTick,
    hydrateJobDisplayFromRecord,
    isJobCardBoardContext,
  ]);

  useEffect(() => {
    if (entryMode !== "job-card") {
      setHydratedJobRecord(null);
      setPersistedSelectedMeasurement(null);
      measurementFetchInFlightRef.current = null;
      measurementFormHydratedRef.current = null;
      return;
    }

    const cid = (companyId ?? "").trim();
    const jobId = currentJobId;
    if (!cid || !jobId || !isUuidLike(jobId)) {
      setPersistedSelectedMeasurement(null);
      measurementFetchInFlightRef.current = null;
      measurementFormHydratedRef.current = null;
      return;
    }

    if (isRestoringRef.current) return;
    if (loadSavedId && !loadAppliedRef.current) return;

    setPersistedSelectedMeasurement(null);
    measurementFormHydratedRef.current = null;

    const requestedJobId = jobId;
    measurementFetchInFlightRef.current = requestedJobId;

    void (async () => {
      try {
        const record = await getSelectedMeasurementForJob(requestedJobId);
        if (measurementFetchInFlightRef.current !== requestedJobId) return;
        setPersistedSelectedMeasurement(record);
      } catch (err) {
        console.warn("[RoofingClient] selected measurement fetch error:", err);
        if (measurementFetchInFlightRef.current !== requestedJobId) return;
        setPersistedSelectedMeasurement(null);
      } finally {
        if (measurementFetchInFlightRef.current === requestedJobId) {
          measurementFetchInFlightRef.current = null;
        }
      }
    })();
  }, [entryMode, currentJobId, companyId, loadSavedId, restoreTick]);

  useEffect(() => {
    if (entryMode !== "job-card") {
      setActiveCatalogItems([]);
      setCatalogLoadError(null);
      catalogFetchInFlightRef.current = null;
      return;
    }

    const cid = (companyId ?? "").trim();
    if (!cid || !isUuidLike(cid)) {
      setActiveCatalogItems([]);
      setCatalogLoadError(null);
      catalogFetchInFlightRef.current = null;
      return;
    }

    if (isRestoringRef.current) return;
    if (loadSavedId && !loadAppliedRef.current) return;

    catalogFetchInFlightRef.current = cid;

    void (async () => {
      try {
        const items = await getActiveCatalogItemsByCompany(cid);
        if (catalogFetchInFlightRef.current !== cid) return;
        setActiveCatalogItems(items);
        setCatalogLoadError(null);
      } catch (err) {
        console.warn("[RoofingClient] catalog fetch error:", err);
        if (catalogFetchInFlightRef.current !== cid) return;
        setActiveCatalogItems([]);
        setCatalogLoadError("Could not load catalog");
      } finally {
        if (catalogFetchInFlightRef.current === cid) {
          catalogFetchInFlightRef.current = null;
        }
      }
    })();
  }, [entryMode, companyId, loadSavedId, restoreTick]);

  useEffect(() => {
    if (entryMode !== "job-card") {
      setCompanyProposalTemplates([]);
      setSelectedJobTemplateId(null);
      setStarterTemplateGraph(null);
      setJobCardSelectedPackageOptionId(null);
      setTemplateSetupLoadComplete(false);
      templateSetupFetchInFlightRef.current = null;
      return;
    }

    const cid = (companyId ?? "").trim();
    if (!cid || !isUuidLike(cid)) {
      setCompanyProposalTemplates([]);
      setSelectedJobTemplateId(null);
      setStarterTemplateGraph(null);
      setTemplateSetupLoadComplete(true);
      templateSetupFetchInFlightRef.current = null;
      return;
    }

    if (isRestoringRef.current) return;
    if (loadSavedId && !loadAppliedRef.current) return;

    templateSetupFetchInFlightRef.current = cid;
    setTemplateSetupLoadComplete(false);

    void (async () => {
      try {
        const templates = await getProposalTemplatesByCompany(cid);
        if (templateSetupFetchInFlightRef.current !== cid) return;
        // Keep full company list in state for draft template-name lookup; Job Card
        // create picker uses contractor-visible filter (Block 1 smoke isolation).
        setCompanyProposalTemplates(templates);
        const visibleTemplates = filterContractorVisibleTemplates(templates);
        const starter = findStarterProposalTemplate(templates);
        // R2B — preferred setup for roofing proposal workflow (separate from
        // package-option is_default). Missing table / no row → null fallback.
        const preferredTemplateId = await getPreferredSetupTemplateId(cid);
        if (templateSetupFetchInFlightRef.current !== cid) return;
        const defaultId = resolveDefaultJobCardTemplateId(
          visibleTemplates,
          starter?.id ?? null,
          preferredTemplateId
        );
        setSelectedJobTemplateId((prev) => {
          // R2A — do not keep a previously-sticky selection once its template
          // has been archived; fall back to the current eligible default.
          if (
            prev &&
            visibleTemplates.some(
              (row) =>
                row.id === prev &&
                row.status !== "archived" &&
                row.active !== false
            )
          ) {
            return prev;
          }
          return defaultId;
        });
        if (!defaultId) {
          setStarterTemplateGraph(null);
        }
      } catch (err) {
        console.warn("[RoofingClient] template setup fetch error:", err);
        if (templateSetupFetchInFlightRef.current !== cid) return;
        setCompanyProposalTemplates([]);
        setSelectedJobTemplateId(null);
        setStarterTemplateGraph(null);
      } finally {
        if (templateSetupFetchInFlightRef.current === cid) {
          setTemplateSetupLoadComplete(true);
          templateSetupFetchInFlightRef.current = null;
        }
      }
    })();
  }, [entryMode, companyId, loadSavedId, restoreTick]);

  useEffect(() => {
    if (entryMode !== "job-card") {
      return;
    }

    const cid = (companyId ?? "").trim();
    const templateId = (selectedJobTemplateId ?? "").trim();
    if (!cid || !isUuidLike(cid) || !templateId || !isUuidLike(templateId)) {
      setStarterTemplateGraph(null);
      setJobCardSelectedPackageOptionId(null);
      return;
    }

    if (isRestoringRef.current) return;
    if (loadSavedId && !loadAppliedRef.current) return;

    const fetchKey = `${cid}:${templateId}`;
    templateGraphFetchInFlightRef.current = fetchKey;

    void (async () => {
      try {
        const graph = await getProposalTemplateGraph(templateId, { companyId: cid });
        if (templateGraphFetchInFlightRef.current !== fetchKey) return;
        setStarterTemplateGraph(graph);
        setJobCardSelectedPackageOptionId(resolveDefaultPackageOptionId(graph));
      } catch (err) {
        console.warn("[RoofingClient] template graph fetch error:", err);
        if (templateGraphFetchInFlightRef.current !== fetchKey) return;
        setStarterTemplateGraph(null);
        setJobCardSelectedPackageOptionId(null);
      }
    })();
  }, [entryMode, companyId, selectedJobTemplateId, loadSavedId, restoreTick]);

  useEffect(() => {
    if (entryMode !== "job-card") {
      setPricingPolicyConfigured(null);
      setPricingPolicyLoadComplete(false);
      pricingPolicyFetchInFlightRef.current = null;
      return;
    }

    const cid = (companyId ?? "").trim();
    if (!cid || !isUuidLike(cid)) {
      setPricingPolicyConfigured(null);
      setPricingPolicyLoadComplete(true);
      pricingPolicyFetchInFlightRef.current = null;
      return;
    }

    if (isRestoringRef.current) return;
    if (loadSavedId && !loadAppliedRef.current) return;

    pricingPolicyFetchInFlightRef.current = cid;
    setPricingPolicyLoadComplete(false);

    void (async () => {
      try {
        const resolution = await getResolvedCompanyPricingPolicy(cid);
        if (pricingPolicyFetchInFlightRef.current !== cid) return;
        setPricingPolicyConfigured(resolution.configured);
      } catch (err) {
        console.warn("[RoofingClient] pricing policy fetch error:", err);
        if (pricingPolicyFetchInFlightRef.current !== cid) return;
        setPricingPolicyConfigured(null);
      } finally {
        if (pricingPolicyFetchInFlightRef.current === cid) {
          setPricingPolicyLoadComplete(true);
          pricingPolicyFetchInFlightRef.current = null;
        }
      }
    })();
  }, [entryMode, companyId, loadSavedId, restoreTick]);

  useEffect(() => {
    if (entryMode !== "job-card") {
      setListedJobDraftProposalId(null);
      setListedJobDraftSummary(null);
      setListedJobDraftSummaries([]);
      setListedJobDraftPackageLabel(null);
      setListedJobDraftPackageLabels({});
      setCreateProposalModalOpen(false);
      setCreateProposalModalStep("measurement");
      setCreateProposalModalMeasurements([]);
      createProposalMeasurementRecordsRef.current = [];
      listedDraftFetchInFlightRef.current = null;
      return;
    }

    const cid = (companyId ?? "").trim();
    const jid = (currentJobId ?? "").trim();
    if (!cid || !isUuidLike(cid) || !jid || !isUuidLike(jid)) {
      setListedJobDraftProposalId(null);
      setListedJobDraftSummary(null);
      setListedJobDraftSummaries([]);
      setListedJobDraftPackageLabel(null);
      setListedJobDraftPackageLabels({});
      listedDraftFetchInFlightRef.current = null;
      return;
    }

    if (isRestoringRef.current) return;
    if (loadSavedId && !loadAppliedRef.current) return;

    const fetchKey = `${cid}:${jid}`;
    listedDraftFetchInFlightRef.current = fetchKey;

    void (async () => {
      try {
        const summaries = await listProposalsForJob(cid, jid);
        if (listedDraftFetchInFlightRef.current !== fetchKey) return;
        // Block 1 isolation + Block 2 list: contractor-visible proposals only.
        // Smoke fixtures stay in DB; direct Builder URL by id still loads.
        const contractorRows = filterContractorVisibleProposals(
          summaries.filter((row) => isUuidLike(row.id))
        );
        setListedJobDraftSummaries(contractorRows);
        const draftRows = contractorRows.filter((row) => row.status === "draft");
        const activeId =
          hydratedJobRecord?.active_proposal_id &&
          isUuidLike(hydratedJobRecord.active_proposal_id)
            ? hydratedJobRecord.active_proposal_id
            : null;
        const draft = pickContractorVisibleJobDraft(draftRows, activeId);
        setListedJobDraftProposalId(draft?.id ?? null);
        setListedJobDraftSummary(draft ?? null);

        const labelEntries = await Promise.all(
          contractorRows.map(async (row) => {
            if (!row.selected_option_id || !isUuidLike(row.selected_option_id)) {
              return [row.id, null] as const;
            }
            const label = await getProposalOptionLabel(cid, row.selected_option_id);
            return [row.id, label] as const;
          })
        );
        if (listedDraftFetchInFlightRef.current !== fetchKey) return;
        const labels: Record<string, string | null> = {};
        for (const [id, label] of labelEntries) labels[id] = label;
        setListedJobDraftPackageLabels(labels);
        setListedJobDraftPackageLabel(
          draft?.id ? labels[draft.id] ?? null : null
        );
      } catch (err) {
        console.warn("[RoofingClient] job draft list fetch error:", err);
        if (listedDraftFetchInFlightRef.current !== fetchKey) return;
        setListedJobDraftProposalId(null);
        setListedJobDraftSummary(null);
        setListedJobDraftSummaries([]);
        setListedJobDraftPackageLabel(null);
        setListedJobDraftPackageLabels({});
      }
    })();
  }, [
    entryMode,
    companyId,
    currentJobId,
    loadSavedId,
    restoreTick,
    hydratedJobRecord?.active_proposal_id,
  ]);

  const buildJobCardCustomerAddressLine = useCallback((): string => {
    return (
      buildFormattedAddress({
        line1: (jobAddress1 || "").trim() || null,
        city: (jobCity || "").trim() || null,
        state: (jobState || "").trim() || null,
        zip: (jobZip || "").trim() || null,
        country: "US",
      }) ?? ""
    );
  }, [jobAddress1, jobCity, jobState, jobZip]);

  const refreshHydratedJobRecord = useCallback(async (jobId: string) => {
    const refreshed = await getJobById(jobId);
    if (!refreshed) return null;
    setHydratedJobRecord(refreshed);
    jobHydratedRef.current = jobId;
    hydrateJobDisplayFromRecord(refreshed, { fillEmptyOnly: false });
    return refreshed;
  }, [hydrateJobDisplayFromRecord]);

  const persistJobCardCustomerForJob = useCallback(
    async (job: JobRecord) => {
      if (isJobCardBoardContext) return null;

      const cid = (companyId ?? "").trim();
      if (!cid || !job.id || !isUuidLike(job.id)) return null;

      const supabase = getSupabaseClient();
      if (!supabase) return null;

      const email = (job.contact?.customer_email ?? customerEmail ?? "").trim();
      const name = (job.contact?.customer_name ?? customerName ?? "").trim();
      const phone = (job.contact?.customer_phone ?? customerPhone ?? "").trim();
      const address =
        (job.address?.formatted ?? "").trim() ||
        buildFormattedAddress(job.address ?? null) ||
        buildJobCardCustomerAddressLine();

      return ensureJobCustomerPersisted({
        companyId: cid,
        jobId: job.id,
        existingCustomerId: job.customer_id,
        customerName: name,
        customerEmail: email,
        customerPhone: phone,
        customerAddress: address,
        deps: {
          findOrCreateCustomer: (args) =>
            findOrCreateCustomer({ supabase, ...args }),
          updateJob,
        },
      });
    },
    [
      isJobCardBoardContext,
      companyId,
      customerEmail,
      customerName,
      customerPhone,
      buildJobCardCustomerAddressLine,
    ]
  );

  const persistAndRefreshJobCardCustomer = useCallback(
    async (job: JobRecord) => {
      const result = await persistJobCardCustomerForJob(job);
      if (result?.updated && job.id) {
        await refreshHydratedJobRecord(job.id);
      }
      return result;
    },
    [persistJobCardCustomerForJob, refreshHydratedJobRecord]
  );

  useEffect(() => {
    if (entryMode !== "job-card") return;
    if (isJobCardBoardContext) return;

    const job = hydratedJobRecord;
    const jobId = currentJobId;
    if (!job || !jobId || job.id !== jobId) return;
    if (isUuidLike(job.customer_id ?? "")) return;

    const email = (job.contact?.customer_email ?? customerEmail ?? "").trim();
    if (!email) return;

    if (isRestoringRef.current) return;
    if (customerPersistInFlightRef.current === jobId) return;

    customerPersistInFlightRef.current = jobId;

    void (async () => {
      try {
        const result = await persistJobCardCustomerForJob(job);
        if (customerPersistInFlightRef.current !== jobId) return;
        if (result?.updated) {
          await refreshHydratedJobRecord(jobId);
        }
      } catch (err) {
        console.warn("[RoofingClient] job card customer persist error:", err);
      } finally {
        if (customerPersistInFlightRef.current === jobId) {
          customerPersistInFlightRef.current = null;
        }
      }
    })();
  }, [
    entryMode,
    isJobCardBoardContext,
    hydratedJobRecord,
    currentJobId,
    customerEmail,
    persistJobCardCustomerForJob,
    refreshHydratedJobRecord,
  ]);

  useEffect(() => {
    if (entryMode !== "job-card") return;
    const rec = persistedSelectedMeasurement;
    if (!rec?.id) return;
    if (measurementFormHydratedRef.current === rec.id) return;
    measurementFormHydratedRef.current = rec.id;

    const sqft = rec.roof_area_sqft;
    if (sqft != null && sqft > 0) {
      setArea(String(sqft));
    } else if (rec.roof_squares != null && rec.roof_squares > 0) {
      setArea(String(Math.round(rec.roof_squares * 100)));
    }
    if (rec.waste_percent != null && Number.isFinite(rec.waste_percent)) {
      setWaste(String(rec.waste_percent));
    }
    const pitchLabel = (rec.pitch_label ?? "").toLowerCase();
    if (pitchLabel === "walkable") setPitch("walkable");
    else if (pitchLabel === "moderate") setPitch("moderate");
    else if (pitchLabel === "steep") setPitch("steep");
    if (rec.stories === "1" || rec.stories === "2" || rec.stories === "3") {
      setStories(rec.stories as StoriesKey);
    }
    if (
      rec.roof_complexity === "simple" ||
      rec.roof_complexity === "moderate" ||
      rec.roof_complexity === "complex"
    ) {
      setComplexity(rec.roof_complexity as ComplexityKey);
    }
  }, [entryMode, persistedSelectedMeasurement]);

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

  // UI-only prototype state for Scope/System interaction.
  // Do not use these values for pricing, PDF, save/load, proposal truth, or estimate calculations.
  const scopeVisualPitchOptions = ["walkable", "moderate", "steep"] as const;
  const scopeVisualStoriesOptions = ["1 story", "2 stories", "3+ stories"] as const;
  const scopeVisualTierOptions: Array<{ key: RoofingTier; label: string; short: string }> = [
    { key: "standard", label: "Core Roofing System", short: "Core" },
    { key: "enhanced", label: "Enhanced Roofing System", short: "Enhanced" },
    { key: "premium", label: "Premium Roofing System", short: "Premium" },
  ];

  const [scopeVisualPitchIndex, setScopeVisualPitchIndex] = useState(0);
  const [scopeVisualStoriesIndex, setScopeVisualStoriesIndex] = useState(0);
  const [scopeVisualTearOffIncluded, setScopeVisualTearOffIncluded] = useState(true);
  const [scopeVisualTierIndex, setScopeVisualTierIndex] = useState(1);

  const scopeVisualPitch = scopeVisualPitchOptions[scopeVisualPitchIndex];
  const scopeVisualStories = scopeVisualStoriesOptions[scopeVisualStoriesIndex];
  const scopeVisualTier = scopeVisualTierOptions[scopeVisualTierIndex];
  const scopeVisualTierConfig = tierConfig[scopeVisualTier.key];

  const cycleScopeVisualPitch = () => {
    setScopeVisualPitchIndex((prev) => (prev + 1) % scopeVisualPitchOptions.length);
  };

  const cycleScopeVisualStories = () => {
    setScopeVisualStoriesIndex((prev) => (prev + 1) % scopeVisualStoriesOptions.length);
  };

  const moveScopeVisualTier = (direction: -1 | 1) => {
    setScopeVisualTierIndex((prev) => Math.min(scopeVisualTierOptions.length - 1, Math.max(0, prev + direction)));
  };

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

  const currentLoadedSavedId =
    loadSavedId ??
    (hasMounted && !isCleanDbJobCardRoute ? getCurrentLoadedSavedId() : null) ??
    null;
  const savedEstimates = hasMounted ? getSavedEstimates() : [];
  const currentSaved = savedEstimates.find((e) => e.id === currentLoadedSavedId);
  const isLoadedWorkspace = hasMounted && !!currentSaved;
  const workspaceStatusLabelMap: Record<string, string> = {
    estimate: "Draft estimate",
    sent: "Sent proposal",
    sent_pending: "Sent proposal",
    approved: "Approved",
    deposit_paid: "Deposit ready",
    scheduled: "Scheduled",
    in_progress: "On site",
    paid: "Completed",
  };
  const workspaceStatusLabel = currentSaved?.status
    ? workspaceStatusLabelMap[String(currentSaved.status)] ?? String(currentSaved.status)
    : "Draft";
  const workspaceDisplayName =
    (currentSaved?.customerName || customerName || "").trim() ||
    (currentSaved?.jobAddress1 || jobAddress1 || "").trim() ||
    "Loaded job";
  const workspaceAddressLine =
    [
      (currentSaved?.jobAddress1 || jobAddress1 || "").trim(),
      (currentSaved?.jobCity || jobCity || "").trim(),
      (currentSaved?.jobState || jobState || "").trim(),
      String(currentSaved?.jobZip ?? currentSaved?.zip ?? jobZip ?? "").trim(),
    ]
      .filter(Boolean)
      .join(", ") || "Property details pending";
  const workspaceUpdatedLine = currentSaved?.lastSavedAt
    ? `Updated ${new Date(currentSaved.lastSavedAt).toLocaleDateString()}`
    : currentSaved?.createdAt
      ? `Created ${new Date(currentSaved.createdAt).toLocaleDateString()}`
      : "Workspace active";
  const isLocked =
    hasMounted &&
    (currentSaved?.status === "approved" ||
      currentSaved?.status === "scheduled" ||
      currentSaved?.status === "paid");
  const isApprovedLocked = currentSaved?.status === "approved";
  const isScheduledLocked = currentSaved?.status === "scheduled";

  const handleSaveMeasurement = useCallback(async () => {
    const cid = (companyId ?? "").trim();
    const jobId = currentJobId;
    if (entryMode !== "job-card") return;
    if (!cid || !jobId || !isUuidLike(jobId)) return;
    if (
      persistedSelectedMeasurement &&
      persistedSelectedMeasurement.source_type !== "manual"
    ) {
      return;
    }
    if (measurementSaveInFlightRef.current) return;

    const localMeasurement = buildJobCardSelectedMeasurement({
      area,
      waste,
      squares,
      adjustedSquares,
      pitch,
      stories,
      complexity,
      debrisTons,
      includeDebrisRemoval,
      removalType,
      guidedStories,
      guidedWalkable,
      laborMode,
      loadSavedId,
      currentLoadedSavedId,
      companyId: cid,
    });

    const draft = buildManualMeasurementDraftFromJobCardState({
      companyId: cid,
      currentJobId: jobId,
      currentLoadedSavedId,
      localMeasurement,
    });

    measurementSaveInFlightRef.current = jobId;
    setIsSavingMeasurement(true);
    setMeasurementSaveError(null);

    try {
      let record: MeasurementRecord | null = null;

      if (!persistedSelectedMeasurement) {
        const created = await createMeasurementRecord(draft);
        if (!created?.id) {
          throw new Error("Could not create measurement record");
        }
        record = await selectMeasurementRecord(created.id, {
          jobId,
          estimateId: isUuidLike(currentLoadedSavedId) ? currentLoadedSavedId : null,
        });
      } else {
        const { is_selected: _isSelected, ...updatePatch } = draft;
        record = await updateMeasurementRecord(persistedSelectedMeasurement.id, updatePatch);
      }

      if (!record) {
        throw new Error("Could not save measurement record");
      }

      setPersistedSelectedMeasurement(record);

      const linkedJob = await updateJob(jobId, { selected_measurement_id: record.id });
      if (!linkedJob) {
        console.warn("[RoofingClient] could not set jobs.selected_measurement_id", {
          jobId,
          measurementId: record.id,
        });
      } else {
        setHydratedJobRecord(linkedJob);
      }
    } catch (err) {
      console.warn("[RoofingClient] save measurement error:", err);
      setMeasurementSaveError(
        err instanceof Error ? err.message : "Could not save measurement. Try again."
      );
    } finally {
      measurementSaveInFlightRef.current = null;
      setIsSavingMeasurement(false);
    }
  }, [
    entryMode,
    companyId,
    currentJobId,
    currentLoadedSavedId,
    persistedSelectedMeasurement,
    area,
    waste,
    squares,
    adjustedSquares,
    pitch,
    stories,
    complexity,
    debrisTons,
    includeDebrisRemoval,
    removalType,
    guidedStories,
    guidedWalkable,
    laborMode,
    loadSavedId,
  ]);

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
      pitch,
      stories,
      complexity,
      guidedStories,
      guidedWalkable,
      debrisTons,
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
    if (isCleanDbJobCardRoute) {
      failSend(LEGACY_ESTIMATE_SEND_BLOCKED_FOR_DB_MESSAGE);
      return;
    }
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
      const isFreshPacketEntry =
        !loadSavedId &&
        fromParam !== "board" &&
        (entryParam === "packet" || entryParam === "instant") &&
        !(jobParam && isUuidLike(jobParam));
      if (!isFreshPacketEntry) {
        setJobZip(getStoredLastZip());
      }
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
      pitch,
      stories,
      complexity,
      guidedStories,
      guidedWalkable,
      debrisTons,
    } as any);
  }, [hasValidEstimateSnapshot, customerName, customerEmail, customerPhone, jobAddress1, jobCity, jobState, jobZip, roofingTier, area, finalPrice, waste, bundlesPerSquare, bundleCost, laborMode, guidedLaborBasePerSquare, impliedLaborPerSquare, margin, pricingMode, laborCostEffective, includeDebrisRemoval, removalType, dumpFeePerTon, pitch, stories, complexity, guidedStories, guidedWalkable, debrisTons]);

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

  const packetFieldSnapshot = useMemo<PacketFieldSnapshot>(
    () => ({
      customerName,
      customerEmail,
      customerPhone,
      jobAddress1,
      jobCity,
      jobState,
      jobZip,
    }),
    [customerName, customerEmail, customerPhone, jobAddress1, jobCity, jobState, jobZip]
  );
  const packetMinimumComplete = useMemo(
    () => getPacketMinimumFieldsComplete(packetFieldSnapshot),
    [packetFieldSnapshot]
  );

  const buildJobDraftFromPacketState = useCallback((): JobDraft | null => {
    const cid = (companyId ?? "").trim();
    if (!cid) return null;

    const line1 = (jobAddress1 || "").trim() || null;
    const city = (jobCity || "").trim() || null;
    const stateVal = (jobState || "").trim() || null;
    const zip = (jobZip || "").trim() || null;
    const address: JobAddress = {
      line1,
      city,
      state: stateVal,
      zip,
      country: "US",
      formatted: buildFormattedAddress({ line1, city, state: stateVal, zip, country: "US" }),
    };

    const name = (customerName || "").trim() || null;
    const roofAreaSqft = parseFloat(area) || 0;
    const stage = roofAreaSqft > 0 ? "measurement" : "intake";
    const jobName = name
      ? `${name} — roofing`
      : line1
        ? line1
        : "Roofing job";

    return {
      company_id: cid,
      job_name: jobName,
      stage,
      status: "active",
      source: "intake",
      priority: "normal",
      contact: {
        customer_name: name,
        customer_email: (customerEmail || "").trim() || null,
        customer_phone: (customerPhone || "").trim() || null,
      },
      address,
      source_metadata: { source: "job_packet" },
      archived: false,
    };
  }, [
    companyId,
    customerName,
    customerEmail,
    customerPhone,
    jobAddress1,
    jobCity,
    jobState,
    jobZip,
    area,
  ]);

  const handleContinueToJobCard = useCallback(async () => {
    setJobCreationError(null);
    if (isCreatingJob) return;

    if (!packetMinimumComplete) {
      setJobCreationError("Complete customer and property details before continuing to Job Card.");
      return;
    }

    const fromUrl = searchParams.get("job");
    if (fromUrl && isUuidLike(fromUrl)) {
      setCurrentJobId(fromUrl);
      router.push(`/tools/roofing?entry=job-card&job=${encodeURIComponent(fromUrl)}`);
      return;
    }

    const cid = (companyId ?? "").trim();
    if (!cid) {
      setJobCreationError("Company context is missing. Refresh and try again.");
      return;
    }

    const draft = buildJobDraftFromPacketState();
    if (!draft) {
      setJobCreationError("Company context is missing. Refresh and try again.");
      return;
    }

    setIsCreatingJob(true);
    try {
      const record = await createJob(draft);
      if (!record?.id) {
        setJobCreationError("Could not create job. Check your connection and try again.");
        return;
      }
      setCurrentLoadedSavedId(null);
      setHydratedJobRecord(record);
      hydrateJobDisplayFromRecord(record, { fillEmptyOnly: false });
      jobHydratedRef.current = record.id;
      setCurrentJobId(record.id);
      await persistAndRefreshJobCardCustomer(record);
      if (process.env.NODE_ENV === "development") {
        const debugName =
          (record.contact?.customer_name ?? customerName ?? "").trim() || "(none)";
        console.debug(
          `[FieldDive job create] id=${record.id} company=${cid} name=${debugName}`
        );
      }
      setToast("Job saved. You can reopen it from the Job Board.");
      setTimeout(() => setToast(null), 3500);
      router.push(`/tools/roofing?entry=job-card&job=${encodeURIComponent(record.id)}`);
    } finally {
      setIsCreatingJob(false);
    }
  }, [
    isCreatingJob,
    packetMinimumComplete,
    searchParams,
    companyId,
    buildJobDraftFromPacketState,
    hydrateJobDisplayFromRecord,
    persistAndRefreshJobCardCustomer,
    router,
    customerName,
  ]);

  function renderJobPacketWorkbench(
    variant: "standalone" | "embedded" = "embedded",
    standaloneEntryMode: "packet" | "instant" = "packet"
  ) {
    const isStandalone = variant === "standalone";
    const packetReadinessRows = getPacketReadinessRows(packetFieldSnapshot);
    const packetReadyCount = packetReadinessRows.filter((row) => row.ready).length;
    const packetTotalCount = packetReadinessRows.length;
    const packetProgressPct = Math.round((packetReadyCount / packetTotalCount) * 100);
    const packetFactsComplete = packetMinimumComplete;
    const addressLine = [
      (jobAddress1 || "").trim(),
      [(jobCity || "").trim(), (jobState || "").trim()].filter(Boolean).join(", "),
      (jobZip || "").trim(),
    ]
      .filter(Boolean)
      .join(", ");
    const propertyPreview = addressLine || "Add property address";
    const beforeEstimateItems = [
      { id: "contact", label: "Contact", ready: Boolean((customerName || customerEmail || customerPhone).trim()) },
      { id: "street", label: "Address", ready: !!(jobAddress1 || "").trim() },
      { id: "zip", label: "ZIP", ready: (jobZip || "").trim().length === 5 },
      { id: "citystate", label: "City-State", ready: !!(jobCity || "").trim() && !!(jobState || "").trim() },
    ];
    const standaloneRaisedPanel =
      "rounded-2xl bg-white p-4 shadow-sm shadow-slate-200/45 ring-1 ring-slate-200/50 sm:p-5";

    return (
      <div
        id="customer-job-section"
        className={
          isStandalone
            ? "w-full"
            : "rounded-2xl border border-slate-200 bg-white shadow-[0_1px_0_rgba(15,23,42,0.04),0_12px_40px_-24px_rgba(15,23,42,0.18)]"
        }
      >
        {isStandalone ? (
          <div className="rounded-2xl bg-white px-5 py-4 shadow-sm shadow-slate-200/50 ring-1 ring-slate-200/55 sm:px-6 sm:py-5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">New Roofing Job</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full bg-slate-100/90 px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm ring-1 ring-slate-200/50">
                Packet draft
              </span>
              <span className="inline-flex items-center rounded-full bg-slate-100/90 px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm ring-1 ring-slate-200/50">
                No pricing yet
              </span>
              <span className="inline-flex items-center rounded-full bg-slate-100/90 px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm ring-1 ring-slate-200/50">
                Estimate path: {standaloneEntryMode === "instant" ? "Instant — coming soon" : "Not selected"}
              </span>
            </div>
            <div className="mt-4 rounded-xl bg-white/80 px-4 py-3.5 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04),0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-slate-200/45">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                  Before you estimate
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {beforeEstimateItems.map((item) => (
                    <span
                      key={item.id}
                      className={
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium shadow-sm " +
                        (item.ready
                          ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100/80"
                          : "bg-slate-100/90 text-slate-600 ring-1 ring-slate-200/40")
                      }
                    >
                      <span aria-hidden>{item.ready ? "✓" : "○"}</span>
                      {item.label}
                    </span>
                  ))}
                </div>
                <span className="text-[11px] font-medium text-slate-500 sm:ml-auto">
                  {packetReadyCount} of {packetTotalCount} core details captured
                </span>
              </div>
              {!packetFactsComplete ? (
                <p className="mt-2 text-[11px] leading-snug text-slate-600">
                  Complete customer and property details, then continue to Job Card.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {!isStandalone ? (
        <div className="flex flex-wrap items-start gap-3 border-b border-slate-100 px-3 pb-3 pt-3 sm:px-4 sm:pt-4">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[12px] font-bold tabular-nums text-slate-700 shadow-inner"
            aria-hidden
          >
            1
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-bold tracking-tight text-slate-900 sm:text-[17px]">Job Packet</h2>
            <p className="mt-0.5 text-[12px] leading-snug text-slate-600">
              Capture customer and property basics before estimating so scope and pricing stay consistent.
            </p>
          </div>
        </div>
        ) : null}

        {/* Capture method — embedded manual step only */}
        {!isStandalone ? (
        <div className="flex flex-wrap items-center gap-2 px-3 pt-3 sm:px-4">
                      <button
                        type="button"
                        aria-current="step"
                        className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[12px] font-semibold text-emerald-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
                      >
                        <ClipboardList className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
                        Manual entry
                      </button>
                      <button
                        type="button"
                        disabled
                        aria-label="Photos capture (coming soon)"
                        className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] font-medium text-slate-400 shadow-inner"
                      >
                        <ImageIcon className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                        Photos <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Soon</span>
                      </button>
                      <button
                        type="button"
                        disabled
                        aria-label="Voice capture (coming soon)"
                        className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] font-medium text-slate-400 shadow-inner"
                      >
                        <Mic className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                        Voice <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Soon</span>
                      </button>
                      <button
                        type="button"
                        disabled
                        aria-label="Customer message capture (coming soon)"
                        className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] font-medium text-slate-400 shadow-inner"
                      >
                        <MessageCircle className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                        Customer message <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Soon</span>
                      </button>
                    </div>
        ) : null}

        <div className={isStandalone ? "mt-5" : ""}>
        <div
          className={
            isStandalone
              ? "grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(360px,480px)] lg:gap-7 2xl:grid-cols-[minmax(0,1.4fr)_minmax(420px,540px)]"
              : "mt-3 grid grid-cols-1 gap-5 px-3 pb-3 sm:px-4 sm:pb-4 lg:grid-cols-[minmax(0,1fr)_minmax(210px,250px)] lg:gap-8"
          }
        >
          <div className={isStandalone ? "space-y-5" : "divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/30"}>
            {/* Customer */}
            <section className={isStandalone ? standaloneRaisedPanel : "bg-white px-3.5 py-3.5 sm:px-4"}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                              <User className="h-3.5 w-3.5 text-slate-500" aria-hidden />
                              Customer
                            </div>
                            {(customerName || customerEmail || customerPhone).trim() ? (
                              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-[1px] text-[9px] font-semibold uppercase tracking-[0.11em] text-emerald-800">
                                Active
                              </span>
                            ) : (
                              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-[1px] text-[9px] font-semibold uppercase tracking-[0.11em] text-amber-800">
                                Needed
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[10.5px] leading-snug text-slate-500">Who receives the proposal and follow-ups.</p>
                          <div className="mt-2 grid gap-2">
                            <input
                              id="customer-name"
                              name="customer_name_field"
                              type="text"
                              value={customerName}
                              onChange={(e) => setCustomerName(e.target.value)}
                              placeholder="Customer name"
                              autoComplete="off"
                              autoCorrect="off"
                              autoCapitalize="off"
                              spellCheck={false}
                              className="h-8.5 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[12.5px] font-medium text-slate-900 placeholder:text-slate-400 outline-none shadow-sm transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                            />
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
                              placeholder="Email address"
                              autoComplete="new-password"
                              autoCorrect="off"
                              autoCapitalize="off"
                              spellCheck={false}
                              className={
                                "h-8.5 w-full rounded-lg border bg-white px-2.5 text-[12.5px] font-medium text-slate-900 placeholder:text-slate-400 outline-none shadow-sm transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200 " +
                                (attentionField === "customerEmail" ? "border-sky-400 ring-2 ring-sky-200" : "border-slate-200")
                              }
                            />
                            <input
                              id="customer-phone"
                              name="customer_phone_field"
                              type="tel"
                              inputMode="tel"
                              value={customerPhone}
                              onChange={(e) => setCustomerPhone(e.target.value)}
                              placeholder="Phone optional"
                              autoComplete="off"
                              autoCorrect="off"
                              autoCapitalize="off"
                              spellCheck={false}
                              className="h-8.5 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[12.5px] font-medium text-slate-900 placeholder:text-slate-400 outline-none shadow-sm transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                            />
                          </div>
            </section>

            {/* Property */}
            <section className={isStandalone ? standaloneRaisedPanel : "bg-white px-3.5 py-3.5 sm:px-4"}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                              <Home className="h-3.5 w-3.5 text-slate-500" aria-hidden />
                              Property
                            </div>
                            {(jobAddress1 || "").trim() && (jobZip || "").trim().length === 5 ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-[1px] text-[9px] font-semibold uppercase tracking-[0.11em] text-emerald-800">
                                <ShieldCheck className="h-2.5 w-2.5" aria-hidden />
                                Ready
                              </span>
                            ) : (
                              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-[1px] text-[9px] font-semibold uppercase tracking-[0.11em] text-amber-800">
                                Needed
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[10.5px] leading-snug text-slate-500">Where the job is happening.</p>
                          <div className="mt-2 grid gap-2">
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
                              className="h-8.5 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[12.5px] font-medium text-slate-900 placeholder:text-slate-400 outline-none shadow-sm transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                            />
                            <div className="grid grid-cols-[minmax(0,1fr)_5rem_5.75rem] gap-2">
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
                                className="h-8.5 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[12.5px] font-medium text-slate-900 placeholder:text-slate-400 outline-none shadow-sm transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                              />
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
                                className="h-8.5 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[12.5px] font-medium uppercase text-slate-900 placeholder:text-slate-400 outline-none shadow-sm transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                              />
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
                                placeholder="ZIP"
                                autoComplete="postal-code"
                                autoCorrect="off"
                                autoCapitalize="off"
                                spellCheck={false}
                                className="h-8.5 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[12.5px] font-medium text-slate-900 placeholder:text-slate-400 outline-none shadow-sm transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                              />
                            </div>
                            <div className="min-h-[1rem]">
                              {autofillFromZip && (
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-[10.5px] font-medium text-emerald-700">Auto-filled from ZIP defaults</span>
                                  {preAutofillSnapshot != null && (
                                    <button
                                      type="button"
                                      onClick={undoAutofill}
                                      className="text-[10.5px] font-medium text-sky-700 underline underline-offset-2 hover:text-sky-800"
                                    >
                                      Undo
                                    </button>
                                  )}
                                </div>
                              )}
                              {zipNoPresetMessage && jobZip.length === 5 && (
                                <p className="text-[10.5px] text-slate-500">No ZIP defaults saved.</p>
                              )}
                              {jobZip.length === 5 && presetForCurrentZip != null && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setZipPresets((prev) => {
                                      if (!prev) return prev;
                                      const next = { ...prev };
                                      delete next[jobZip];
                                      if (typeof window !== "undefined")
                                        localStorage.setItem(STORAGE_KEY_ZIP_PRESETS, JSON.stringify(next));
                                      return next;
                                    });
                                    setZipClearedToast(true);
                                    setTimeout(() => setZipClearedToast(false), 2500);
                                    setAutofillFromZip(false);
                                    setPreAutofillSnapshot(null);
                                    setZipNoPresetMessage(true);
                                  }}
                                  className="text-[10.5px] font-medium text-slate-500 underline underline-offset-2 hover:text-slate-700"
                                >
                                  Clear ZIP defaults
                                </button>
                              )}
                            </div>
                          </div>
            </section>

            {/* Job request / notes — placeholder */}
            <section className={isStandalone ? standaloneRaisedPanel : "bg-white px-3.5 py-3.5 sm:px-4"}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  <MessageCircle className="h-3.5 w-3.5 text-slate-500" aria-hidden />
                  Job request &amp; notes
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-[1px] text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                  Coming soon
                </span>
              </div>
              <p className="mt-1 text-[10.5px] leading-snug text-slate-500">
                Homeowner requests, HOA notes, and access instructions will live here.
              </p>
              <textarea
                disabled
                readOnly
                rows={3}
                value=""
                placeholder="Notes capture is not wired yet — continue to Job Card if you need to add context now."
                aria-disabled="true"
                className="mt-2 w-full resize-none rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-2.5 py-2 text-[12px] leading-relaxed text-slate-400 placeholder:text-slate-400"
              />
            </section>

            {/* Photos / evidence stub — embedded only; standalone uses right column */}
            {!isStandalone ? (
            <section className="bg-white px-3.5 py-4 sm:px-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400">
                  <Camera className="h-4.5 w-4.5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">Photos &amp; evidence</span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-[1px] text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                      0 attached
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-[1px] text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                      Coming soon
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-slate-500">
                    Site photos and damage docs will attach here. Instant Estimate will require photos plus a property address.
                  </p>
                </div>
              </div>
            </section>
            ) : null}
          </div>

          {/* Status rail — embedded only; standalone uses context column above */}
          {isStandalone ? (
          <div className="space-y-5 xl:sticky xl:top-4 xl:self-start">
            <section className={standaloneRaisedPanel}>
              <div className="mb-3 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                <MapPin className="h-3.5 w-3.5 text-slate-500" aria-hidden />
                Property preview
              </div>
              <div className="flex aspect-[16/10] flex-col items-center justify-center rounded-xl bg-slate-50/45 px-4 text-center ring-1 ring-dashed ring-slate-200/55">
                  {addressLine ? (
                    <>
                      <MapPin className="mb-2 h-6 w-6 text-slate-400" aria-hidden />
                      <p className="text-sm font-medium text-slate-700">{propertyPreview}</p>
                      <p className="mt-1 text-xs text-slate-500">Map preview when address is confirmed</p>
                    </>
                  ) : (
                    <>
                      <Home className="mb-2 h-6 w-6 text-slate-300" aria-hidden />
                      <p className="text-sm font-medium text-slate-500">Add property address</p>
                      <p className="mt-1 text-xs text-slate-400">Site context appears here</p>
                    </>
                  )}
                </div>
            </section>

            <section className={standaloneRaisedPanel}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  <Camera className="h-3.5 w-3.5 text-slate-500" aria-hidden />
                  Photos &amp; evidence
                </div>
                <span className="rounded-full bg-slate-100/90 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 shadow-sm ring-1 ring-slate-200/45">
                  0 photos attached
                </span>
              </div>
              <div className="flex min-h-[190px] flex-col items-center justify-center rounded-xl bg-slate-50/45 px-4 py-7 text-center ring-1 ring-dashed ring-slate-200/55">
                <Camera className="mb-3 h-10 w-10 text-slate-300" aria-hidden />
                <p className="text-sm font-medium text-slate-600">No photos attached yet</p>
                <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500">
                  Ground photos, roof photos, and customer-provided images will attach here.
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-100/90 px-2.5 py-1 text-[10px] font-medium text-slate-600 shadow-sm ring-1 ring-slate-200/40">Ground photos</span>
                <span className="rounded-full bg-slate-100/90 px-2.5 py-1 text-[10px] font-medium text-slate-600 shadow-sm ring-1 ring-slate-200/40">Roof photos</span>
                <span className="rounded-full bg-slate-100/90 px-2.5 py-1 text-[10px] font-medium text-slate-600 shadow-sm ring-1 ring-slate-200/40">Customer-provided</span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                Instant Estimate will require photos + property address.
              </p>
            </section>

            <section className={standaloneRaisedPanel}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  <ClipboardList className="h-3.5 w-3.5 text-slate-500" aria-hidden />
                  Site visit
                </div>
                <span className="rounded-full bg-slate-100/90 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 shadow-sm ring-1 ring-slate-200/45">
                  Not scheduled
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">Scheduling will connect here when site visits are wired.</p>
            </section>
          </div>
          ) : (
          <aside
            className={
              isStandalone
                ? "h-fit pt-1 lg:sticky lg:top-4 lg:border-l lg:border-slate-200/70 lg:pl-6"
                : "h-fit rounded-lg border border-slate-200/80 bg-slate-50/40 p-3 lg:sticky lg:top-4"
            }
          >
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">Packet status</div>
            <p className="mt-2 text-[11px] leading-snug text-slate-600">
              {packetReadyCount} of {packetTotalCount} core details captured
            </p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-200/70">
              <div
                className="h-full rounded-full bg-emerald-500/90 transition-[width] duration-300"
                style={{ width: `${packetProgressPct}%` }}
                role="progressbar"
                aria-valuenow={packetProgressPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Packet status progress"
              />
            </div>
            <ul className="mt-3 space-y-1.5">
              {packetReadinessRows.map((row) => (
                <li key={row.id} className="flex items-start gap-2 text-[11px] leading-snug">
                  <span
                    className={
                      "mt-0.5 shrink-0 " + (row.ready ? "font-semibold text-emerald-700" : "text-slate-400")
                    }
                    aria-hidden
                  >
                    {row.ready ? "✓" : "○"}
                  </span>
                  <span className={row.ready ? "text-slate-700" : "text-slate-500"}>{row.label}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-2 border-t border-slate-200/70 pt-3">
              <p className="text-[11px] leading-relaxed text-slate-700">
                {packetFactsComplete
                  ? "Customer and property are captured. Continue to Job Card to confirm measurements and start a proposal."
                  : "Complete customer and property details, then continue to Job Card."}
              </p>
              <p className="text-[10.5px] leading-relaxed text-slate-500">
                Instant Estimate will require photos + property address.
              </p>
            </div>
          </aside>
          )}
        </div>

        {/* Footer actions */}
        <div
          className={
            isStandalone
              ? "mt-5 flex flex-col gap-3 border-t border-slate-200/40 pt-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
              : "flex flex-col gap-3 border-t border-slate-100 px-3 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4"
          }
        >
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => void handleContinueToJobCard()}
                disabled={isCreatingJob || !packetMinimumComplete}
                title={
                  packetMinimumComplete
                    ? undefined
                    : "Complete customer and property details before continuing to Job Card."
                }
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreatingJob ? "Creating job…" : "Continue to Job Card"}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </button>
              {jobCreationError ? (
                <p className="text-[11px] font-medium text-red-600" role="alert">
                  {jobCreationError}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              disabled
              aria-label="Draft save coming soon"
              title="Draft save coming soon"
              className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-[13px] font-medium text-slate-400 shadow-inner"
            >
              Save Packet
              <span className="text-[10px] font-bold uppercase tracking-wide">Soon</span>
            </button>
          </div>
          <button
            type="button"
            disabled
            aria-label="Instant Estimate (coming soon)"
            className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-[13px] font-semibold text-slate-400 shadow-inner sm:w-auto"
          >
            Instant Estimate <span className="text-[10px] font-bold uppercase tracking-wide">Soon</span>
          </button>
        </div>
        </div>
      </div>
    );
  }


  function renderLegacyEstimateWorkspace() {
    return (
      <>
        <div className="px-3 pt-3 sm:px-4 sm:pt-3 xl:px-5 2xl:px-6">
        <div className="relative overflow-hidden rounded-2xl border border-cyan-400/[0.20] bg-[#0b1526] px-5 py-3 shadow-[0_0_0_1px_rgba(34,211,238,0.06),0_16px_48px_-34px_rgba(34,211,238,0.40),inset_0_1px_0_rgba(255,255,255,0.065)] sm:px-6 sm:py-3.5 xl:px-7">
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute -left-24 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-cyan-500/[0.16] blur-[72px]" />
            <div className="absolute right-0 top-0 h-52 w-[34rem] bg-blue-500/[0.09] blur-[72px]" />
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-300/25 to-transparent" />
          </div>

          <div className="relative flex items-center gap-6">
            <div className="flex shrink-0 items-center gap-5">
              <div className="relative flex h-[68px] w-[68px] shrink-0 items-center justify-center" aria-hidden>
                <span className={`absolute -inset-4 rounded-full blur-2xl animate-pulse ${isLoadedWorkspace ? "bg-emerald-400/[0.18]" : "bg-cyan-400/[0.20]"}`} />
                <span className={`absolute -inset-2 rounded-full blur-xl ${isLoadedWorkspace ? "bg-emerald-400/[0.09]" : "bg-cyan-400/[0.10]"}`} />
                <span className={`absolute -inset-2 rounded-full border ${isLoadedWorkspace ? "border-emerald-300/18" : "border-cyan-300/18"}`} />
                <span className={`absolute -inset-0.5 rounded-full border ${isLoadedWorkspace ? "border-emerald-300/42" : "border-cyan-300/42"}`} />
                <span className={`absolute inset-0.5 rounded-full shadow-[inset_0_0_36px_rgba(165,243,252,0.46),0_0_44px_rgba(34,211,238,0.62)] ${isLoadedWorkspace ? "bg-gradient-to-br from-emerald-300/70 via-cyan-500/40 to-slate-950/85" : "bg-gradient-to-br from-cyan-300/70 via-blue-500/45 to-slate-950/85"}`} />
                <span className="absolute inset-3 rounded-full bg-[radial-gradient(circle_at_30%_25%,rgba(236,253,245,0.95),rgba(34,211,238,0.30)_55%,transparent_78%)]" />
                <span className="absolute inset-5 rounded-full bg-cyan-50/13 blur-[3px]" />
                <span className="relative text-[11px] font-extrabold uppercase tracking-widest text-cyan-50 drop-shadow-[0_0_12px_rgba(165,243,252,0.98)]">
                  {isLoadedWorkspace ? "JOB" : "AI"}
                </span>
              </div>
              <div className="min-w-0">
                {isLoadedWorkspace ? (
                  <>
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full border border-emerald-300/24 bg-emerald-500/[0.13] px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.18em] text-emerald-100/90">
                        Job Workspace
                      </span>
                      <span className="inline-flex items-center rounded-full border border-cyan-300/18 bg-cyan-500/[0.09] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-cyan-100/75">
                        Loaded from Command Center
                      </span>
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] ${
                        isLocked
                          ? "border-amber-300/24 bg-amber-500/[0.12] text-amber-100/88"
                          : "border-white/[0.10] bg-white/[0.045] text-white/62"
                      }`}>
                        {workspaceStatusLabel}
                      </span>
                    </div>
                    <div className="text-[20px] font-extrabold leading-tight tracking-[-0.025em] text-white sm:text-[24px]">
                      {workspaceDisplayName}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] leading-snug text-white/58">
                      <span className="max-w-[34rem] truncate">{workspaceAddressLine}</span>
                      <span className="hidden h-1 w-1 rounded-full bg-white/25 sm:inline-block" aria-hidden />
                      <span className="text-white/42">{workspaceUpdatedLine}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-[20px] font-extrabold leading-tight tracking-[-0.025em] text-white sm:text-[23px]">FieldDive is preparing this job</div>
                    <div className="mt-1 max-w-[35rem] text-[12.5px] leading-snug text-white/58">AI is assembling the job packet and proposal path. You verify what matters.</div>
                  </>
                )}
              </div>
            </div>

            <span className="hidden h-14 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent lg:block" aria-hidden />

            <div className="min-w-0 flex-1">
              <ol
                className="relative grid grid-cols-5 gap-0"
                role="list"
                aria-label="Job preparation timeline"
              >
                {aiConductorStripItems.map((item, idx) => {
                  const timelineLabels = isLoadedWorkspace
                    ? ["Job loaded", "Customer path", "Scope restored", "Proposal state", "Next action"]
                    : ["Address checked", "Photos analyzed", "Scope estimated", "Proposal draft", "Waiting on contractor"];
                  const timelineSubLabels = isLoadedWorkspace
                    ? ["Command Center", "Contact", "Scope", "Proposal", "Contractor"]
                    : ["", "", "", "", "Roofing system"];
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
                          className={`pointer-events-none absolute right-1/2 top-[19px] h-[2px] w-full ${
                            prevReady ? "bg-gradient-to-r from-emerald-500/82 to-emerald-400/66 shadow-[0_0_13px_rgba(16,185,129,0.75)]" : "bg-white/[0.12]"
                          }`}
                          aria-hidden
                        />
                      )}
                      {!isLast && (
                        <span
                          className={`pointer-events-none absolute left-1/2 top-[19px] h-[2px] w-full ${
                            item.ready ? "bg-gradient-to-r from-emerald-400/66 to-emerald-500/82 shadow-[0_0_13px_rgba(16,185,129,0.75)]" : isInProgress ? "bg-gradient-to-r from-cyan-400/58 to-white/12 shadow-[0_0_12px_rgba(34,211,238,0.55)]" : "bg-white/[0.12]"
                          }`}
                          aria-hidden
                        />
                      )}
                      <span
                        className={`relative z-10 flex h-9.5 w-9.5 items-center justify-center rounded-full border-2 text-[13px] font-bold tabular-nums ${nodeStateClass}`}
                        aria-hidden
                      >
                        {item.ready ? "✓" : idx + 1}
                      </span>
                      <span className={`mt-2 text-center text-[11px] font-bold leading-tight ${labelTone}`}>
                        {timelineLabels[idx] ?? item.label}
                      </span>
                      <span className={`text-center text-[10px] font-medium leading-tight ${statusTone}`}>
                        {status}
                      </span>
                      {timelineSubLabels[idx] ? (
                        <span className="text-center text-[9.5px] font-medium leading-tight text-white/45">
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
        <div className="px-3 pt-2.5 pb-0 sm:px-4 sm:pt-2.5 xl:px-5 2xl:px-6">
        <div>
        <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_390px] 2xl:grid-cols-[minmax(0,1fr)_410px] lg:gap-2.5 xl:gap-3">
          {/* Workflow canvas */}
          <div className="space-y-2.5 xl:space-y-2.5">

            {renderJobPacketWorkbench()}

            <div className="rounded-2xl border border-cyan-400/[0.20] bg-[#0b1526] p-3 shadow-[0_0_0_1px_rgba(34,211,238,0.07),0_4px_24px_-8px_rgba(34,211,238,0.12),inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-blue-300/40 bg-blue-500/20 text-[12px] font-bold tabular-nums text-blue-100 shadow-[0_0_22px_rgba(59,130,246,0.25)]"
                  aria-hidden
                >
                  2
                </span>
                <h2 className="text-[15px] font-bold tracking-tight text-white sm:text-[17px]">FieldDive Prepared Scope</h2>
                <span className="text-[12px] text-white/50">Scope at a glance</span>
                <span className="ml-auto rounded-full border border-emerald-400/30 bg-emerald-500/14 px-2.5 py-0.5 text-[10px] font-semibold tabular-nums text-emerald-100/95 shadow-[0_0_16px_-6px_rgba(16,185,129,0.55)]">
                  {jobReadinessReadyCount}/{jobReadinessItems.length} prepared
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-6">
                {/* Tile 1 — Roof size */}
                <div className="group relative flex flex-col rounded-xl border border-emerald-400/28 bg-gradient-to-b from-emerald-500/[0.14] to-emerald-500/[0.07] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_16px_-8px_rgba(16,185,129,0.25)]">
                  <div className="flex items-start justify-between gap-2">
                    <Ruler className="h-[22px] w-[22px] shrink-0 text-emerald-300 drop-shadow-[0_0_10px_rgba(52,211,153,0.35)]" aria-hidden />
                    <a href="#scope-inputs" aria-label="Edit roof size" className="text-white/35 opacity-0 transition group-hover:opacity-100 hover:text-white/75">
                      <Pencil className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="mt-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-200/90">Roof Size</div>
                  <div className="mt-2 text-[22px] font-extrabold tabular-nums leading-none text-white">
                    {hasRoofArea ? `${squares.toFixed(1)}` : "—"}
                  </div>
                  {hasRoofArea && <div className="text-[11px] font-medium text-emerald-100/70">squares</div>}
                  <div className="mt-2 flex items-center gap-1">
                    <CheckCircle2 className={`h-3 w-3 shrink-0 ${hasRoofArea ? "text-emerald-300" : "text-amber-300/70"}`} aria-hidden />
                    <span className={`text-[9px] font-bold uppercase tracking-wide ${hasRoofArea ? "text-emerald-200/90" : "text-amber-200/80"}`}>
                      {hasRoofArea ? "Prepared" : "Needs input"}
                    </span>
                  </div>
                </div>

                {/* Tile 2 — Roof pitch */}
                <motion.button
                  type="button"
                  onClick={cycleScopeVisualPitch}
                  className="group relative flex w-full flex-col rounded-xl border border-emerald-400/22 bg-gradient-to-b from-emerald-500/[0.11] to-emerald-500/[0.05] p-3.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] transition hover:border-emerald-300/35 hover:from-emerald-500/[0.16] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Triangle className="h-[22px] w-[22px] shrink-0 text-emerald-300 drop-shadow-[0_0_10px_rgba(52,211,153,0.32)]" aria-hidden />
                    <Sparkles className="h-3 w-3 text-cyan-200/45" aria-hidden />
                  </div>
                  <div className="mt-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-200/90">Roof Pitch</div>
                  <div className="mt-2 text-[22px] font-extrabold capitalize leading-none text-white">{scopeVisualPitch}</div>
                  <div className="text-[11px] font-medium text-emerald-100/70">pitch</div>
                  <div className="mt-2 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 shrink-0 text-cyan-300/80" aria-hidden />
                    <span className="text-[9px] font-bold uppercase tracking-wide text-cyan-200/85">Quick adjust</span>
                  </div>
                </motion.button>

                {/* Tile 3 — Stories */}
                <motion.button
                  type="button"
                  onClick={cycleScopeVisualStories}
                  className="group relative flex w-full flex-col rounded-xl border border-emerald-400/22 bg-gradient-to-b from-emerald-500/[0.11] to-emerald-500/[0.05] p-3.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] transition hover:border-emerald-300/35 hover:from-emerald-500/[0.16] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Home className="h-[22px] w-[22px] shrink-0 text-emerald-300 drop-shadow-[0_0_10px_rgba(52,211,153,0.32)]" aria-hidden />
                    <Sparkles className="h-3 w-3 text-cyan-200/45" aria-hidden />
                  </div>
                  <div className="mt-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-200/90">Stories</div>
                  <div className="mt-2 text-[18px] font-extrabold leading-tight text-white">{scopeVisualStories}</div>
                  <div className="text-[11px] font-medium text-emerald-100/70">visual</div>
                  <div className="mt-2 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 shrink-0 text-cyan-300/80" aria-hidden />
                    <span className="text-[9px] font-bold uppercase tracking-wide text-cyan-200/85">Quick adjust</span>
                  </div>
                </motion.button>

                {/* Tile 4 — Tear-off */}
                <motion.button
                  type="button"
                  onClick={() => setScopeVisualTearOffIncluded((prev) => !prev)}
                  className="group relative flex w-full flex-col rounded-xl border border-amber-400/28 bg-gradient-to-b from-amber-500/[0.14] to-amber-500/[0.06] p-3.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] transition hover:border-amber-300/40 hover:from-amber-500/[0.18] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/35"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Trash2 className="h-[22px] w-[22px] shrink-0 text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.32)]" aria-hidden />
                    <Sparkles className="h-3 w-3 text-cyan-200/45" aria-hidden />
                  </div>
                  <div className="mt-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-200/90">Tear-off</div>
                  <div className="mt-2 text-[18px] font-extrabold leading-none text-white">
                    {scopeVisualTearOffIncluded ? "1 layer" : "Not included"}
                  </div>
                  <div className="text-[11px] font-medium text-amber-100/70">
                    {scopeVisualTearOffIncluded ? "included" : "visual"}
                  </div>
                  <div className="mt-2 flex items-center gap-1">
                    <CheckCircle2
                      className={`h-3 w-3 shrink-0 ${scopeVisualTearOffIncluded ? "text-emerald-300" : "text-white/35"}`}
                      aria-hidden
                    />
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wide ${scopeVisualTearOffIncluded ? "text-emerald-200/90" : "text-white/50"}`}
                    >
                      {scopeVisualTearOffIncluded ? "Quick adjust" : "Visual"}
                    </span>
                  </div>
                </motion.button>

                {/* Tile 5 — Material */}
                <div className="group relative flex flex-col rounded-xl border border-violet-400/28 bg-gradient-to-b from-violet-500/[0.14] to-violet-500/[0.06] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
                  <div className="flex items-start justify-between gap-2">
                    <Layers className="h-[22px] w-[22px] shrink-0 text-violet-300 drop-shadow-[0_0_10px_rgba(167,139,250,0.32)]" aria-hidden />
                    <Pencil className="h-3 w-3 text-white/25" aria-hidden />
                  </div>
                  <div className="mt-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-violet-200/90">Material</div>
                  <div className="mt-2 text-[14px] font-extrabold leading-tight text-white">
                    Architectural<br />shingles
                  </div>
                  <div className="mt-2 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-300" aria-hidden />
                    <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-200/90">Prepared</span>
                  </div>
                </div>

                {/* Tile 6 — Confidence */}
                <div className="group relative flex flex-col rounded-xl border border-cyan-400/28 bg-gradient-to-b from-cyan-500/[0.14] to-cyan-500/[0.06] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
                  <div className="flex items-start justify-between gap-2">
                    <ShieldCheck className="h-[22px] w-[22px] shrink-0 text-cyan-300 drop-shadow-[0_0_10px_rgba(34,211,238,0.32)]" aria-hidden />
                    <Eye className="h-3 w-3 text-white/25" aria-hidden />
                  </div>
                  <div className="mt-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-200/90">Confidence</div>
                  <div className="mt-2 text-[22px] font-extrabold tabular-nums leading-none text-white">
                    {Math.round((jobReadinessReadyCount / Math.max(1, jobReadinessItems.length)) * 100)}%
                  </div>
                  <div className="text-[11px] font-medium text-cyan-100/70">readiness</div>
                  <div className="mt-2 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 shrink-0 text-cyan-300" aria-hidden />
                    <span className="text-[9px] font-bold uppercase tracking-wide text-cyan-200/90">Readiness</span>
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
                  <span className="text-[12px] text-white/50">Confirm the roofing system and included scope.</span>
                </div>
                <div className="mt-3 h-px w-full bg-gradient-to-r from-white/[0.10] via-white/[0.05] to-transparent" />

                <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-12">
                  <div className="rounded-[18px] border border-cyan-400/30 bg-gradient-to-br from-slate-950/80 via-slate-900/70 to-cyan-950/20 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_12px_38px_-22px_rgba(34,211,238,0.45)] lg:col-span-4">
                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-200/85">Recommended Roofing System</div>
                    <div className="mt-2.5 flex items-center gap-2 rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(34,211,238,0.09),transparent_62%)] px-1 py-1">
                      <button
                        type="button"
                        onClick={() => moveScopeVisualTier(-1)}
                        disabled={scopeVisualTierIndex === 0}
                        aria-label="Previous tier"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-cyan-100/68 transition hover:bg-cyan-300/[0.08] hover:text-cyan-50 hover:shadow-[0_0_20px_-8px_rgba(34,211,238,0.95)] disabled:cursor-not-allowed disabled:text-white/20 disabled:hover:bg-transparent disabled:hover:shadow-none"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>

                      <div className="relative grid min-w-0 flex-1 grid-cols-3 gap-1 rounded-full px-1">
                        <div className="pointer-events-none absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-cyan-300/18 to-transparent" aria-hidden />
                        {scopeVisualTierOptions.map((opt, i) => {
                          const selected = scopeVisualTierIndex === i;
                          return (
                            <button
                              key={opt.key}
                              type="button"
                              onClick={() => setScopeVisualTierIndex(i)}
                              className={
                                selected
                                  ? "relative rounded-full px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-cyan-50 shadow-[0_0_26px_-8px_rgba(34,211,238,1)] before:absolute before:inset-x-2 before:bottom-0 before:h-px before:rounded-full before:bg-cyan-200/70 after:absolute after:inset-0 after:-z-10 after:rounded-full after:bg-cyan-400/[0.16]"
                                  : "relative rounded-full px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-white/52 transition hover:text-white/74 hover:shadow-[0_0_14px_-10px_rgba(255,255,255,0.6)]"
                              }
                            >
                              {opt.short}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={() => moveScopeVisualTier(1)}
                        disabled={scopeVisualTierIndex === scopeVisualTierOptions.length - 1}
                        aria-label="Next tier"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-cyan-100/68 transition hover:bg-cyan-300/[0.08] hover:text-cyan-50 hover:shadow-[0_0_20px_-8px_rgba(34,211,238,0.95)] disabled:cursor-not-allowed disabled:text-white/20 disabled:hover:bg-transparent disabled:hover:shadow-none"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-3 flex items-center gap-4">
                      {/* Roofing system visual */}
                      <div
                        className="relative h-[5.35rem] w-[6.35rem] shrink-0 overflow-hidden rounded-2xl border border-white/[0.14] bg-slate-950 shadow-[0_14px_34px_-15px_rgba(34,211,238,0.34),inset_0_1px_0_rgba(255,255,255,0.10)]"
                        aria-hidden
                      >
                        <div className="absolute inset-0 bg-[linear-gradient(155deg,rgba(71,85,105,1)_0%,rgba(42,56,76,1)_42%,rgba(15,23,42,1)_100%)]" />
                        <svg viewBox="0 0 112 86" className="absolute inset-0 h-full w-full">
                          <defs>
                            <linearGradient id="scopeShingleEdge" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="rgba(226,232,240,0.20)" />
                              <stop offset="45%" stopColor="rgba(148,163,184,0.08)" />
                              <stop offset="100%" stopColor="rgba(2,6,23,0.20)" />
                            </linearGradient>
                            <filter id="scopeShingleShadow" x="-20%" y="-20%" width="140%" height="140%">
                              <feDropShadow dx="0" dy="1" stdDeviation="0.6" floodColor="#020617" floodOpacity="0.55" />
                            </filter>
                          </defs>
                          {[0, 11, 22, 33, 44, 55, 66].map((y, row) => (
                            <g key={`system-shingle-${y}`} filter="url(#scopeShingleShadow)">
                              {[-18, 0, 18, 36, 54, 72, 90, 108].map((x, col) => {
                                const offsetX = x + (row % 2 === 0 ? 0 : 9);
                                const fill =
                                  col % 3 === 0
                                    ? "rgba(63,78,100,0.98)"
                                    : col % 3 === 1
                                      ? "rgba(48,62,83,0.98)"
                                      : "rgba(38,51,71,0.98)";
                                return (
                                  <g key={`${y}-${x}`}>
                                    <rect
                                      x={offsetX}
                                      y={y}
                                      width="25"
                                      height="12"
                                      rx="1.2"
                                      fill={fill}
                                      stroke="rgba(2,6,23,0.58)"
                                      strokeWidth="0.65"
                                    />
                                    <path
                                      d={`M${offsetX + 2} ${y + 2.2}h21`}
                                      stroke="rgba(226,232,240,0.12)"
                                      strokeWidth="0.55"
                                      strokeLinecap="round"
                                    />
                                  </g>
                                );
                              })}
                            </g>
                          ))}
                          <rect x="0" y="0" width="112" height="86" fill="url(#scopeShingleEdge)" />
                        </svg>
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_26%_16%,rgba(125,211,252,0.16),transparent_30%),linear-gradient(to_bottom,rgba(255,255,255,0.03),transparent_36%,rgba(2,6,23,0.52))]" />
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                        <div className="absolute bottom-1.5 left-1.5 right-1.5 rounded-lg border border-cyan-300/24 bg-black/68 px-1 py-0.5 text-center text-[7px] font-bold uppercase tracking-wide text-cyan-200/95 shadow-[0_0_14px_rgba(34,211,238,0.20)]">
                          {scopeVisualTier.short}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[15px] font-bold leading-tight text-white">
                          {scopeVisualTier.label}
                        </div>
                        <div className="mt-0.5 text-[11px] capitalize text-white/55">
                          Architectural Shingles
                        </div>
                        <div className="mt-1 text-[10.5px] text-white/42">Lifetime limited warranty</div>
                        <span className="mt-2 inline-flex rounded-full border border-cyan-400/30 bg-cyan-500/[0.14] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-cyan-100/95">
                          {scopeVisualTier.short} tier
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[18px] border border-white/[0.11] bg-slate-950/50 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.055)] lg:col-span-5">
                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/62">Included Scope</div>
                    <div className="mt-3 grid grid-cols-1 gap-x-5 gap-y-2 sm:grid-cols-2">
                      {[
                        ...scopeVisualTierConfig.includes,
                        scopeVisualTearOffIncluded ? "Tear-off & disposal (1 layer)" : "Tear-off (not included)",
                        "Starter strip",
                        "Ridge cap shingles",
                        "Proper ventilation",
                      ].slice(0, 6).map((item, i) => {
                        const isTearOff = item.toLowerCase().includes("tear-off");
                        const isReady = isTearOff ? scopeVisualTearOffIncluded : true;
                        return (
                          <div key={`${item}-${i}`} className="flex items-center gap-2 text-[11.5px]">
                            <span
                              className={
                                isReady
                                  ? "flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border border-emerald-300/45 bg-emerald-400/18 text-[9px] text-emerald-50 shadow-[0_0_8px_rgba(16,185,129,0.34)]"
                                  : "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-[9px] text-white/40"
                              }
                              aria-hidden
                            >
                              {isReady ? "✓" : "·"}
                            </span>
                            <span className={`capitalize leading-snug ${isReady ? "text-white/82" : "text-white/45"}`}>{item}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 lg:col-span-3">
                    <a
                      href="#scope-inputs"
                      className="group relative flex min-h-[3.75rem] items-center justify-between gap-3 overflow-hidden rounded-xl border border-blue-300/40 bg-gradient-to-br from-blue-500/88 via-blue-600/82 to-blue-700/78 px-3.5 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_15px_34px_-23px_rgba(59,130,246,0.78)] transition hover:from-blue-400/90 hover:to-blue-600/86"
                    >
                      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/42 to-transparent" aria-hidden />
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/22 bg-white/13 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]" aria-hidden>
                        <CheckCircle2 className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-bold leading-tight text-white">Confirm system</div>
                        <div className="mt-0.5 text-[10px] leading-tight text-blue-50/78">Lock system &amp; continue</div>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-white/58 transition group-hover:translate-x-0.5 group-hover:text-white/78" aria-hidden />
                    </a>
                    <a
                      href="#scope-inputs"
                      className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.10] bg-white/[0.035] px-3 py-2.5 text-left transition hover:bg-white/[0.06]"
                    >
                      <div className="flex items-center gap-2 text-[12px] font-medium text-white/85">
                        <Pencil className="h-3.5 w-3.5 text-white/55" aria-hidden />
                        Edit scope
                      </div>
                    </a>
                    <button
                      type="button"
                      className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-left text-[12px] font-medium text-white/65 transition hover:bg-white/[0.04]"
                    >
                      <span className="flex items-center gap-2">
                        <CircleHelp className="h-3.5 w-3.5 text-white/45" aria-hidden />
                        Need more info
                      </span>
                    </button>
                  </div>
                </div>

                <details id="scope-inputs" className="group mt-2">
                  <summary className="flex cursor-pointer list-none items-center justify-end gap-1.5 text-[10px] font-medium text-white/32 transition hover:text-white/65">
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

              <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-stretch">
                {/* Deal Control — mock-aligned three columns */}
                <div
                  id="deal-control"
                  className="flex flex-col rounded-xl border border-cyan-400/[0.20] bg-[#0b1526] px-4 py-3 shadow-[0_0_0_1px_rgba(34,211,238,0.06),0_4px_24px_-12px_rgba(34,211,238,0.18),inset_0_1px_0_rgba(255,255,255,0.05)] sm:px-4 sm:py-3.5"
                >
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-500/20 text-[11px] font-bold tabular-nums text-emerald-100 shadow-[0_0_18px_rgba(16,185,129,0.22)]"
                      aria-hidden
                    >
                      4
                    </span>
                    <h2 className="text-[15px] font-bold tracking-tight text-white">Deal Control</h2>
                    <span className="hidden text-[11px] text-white/48 sm:inline">Pricing command</span>
                    <div className="ml-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => setPricingMode(pricingMode === "direct" ? "markup" : "direct")}
                        className="rounded-md border border-white/[0.10] bg-white/[0.04] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white/65 transition hover:bg-white/[0.08]"
                      >
                        {pricingMode === "direct" ? "Direct cost" : "Markup mode"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.72fr)_minmax(0,0.68fr)] lg:gap-0">
                    {/* Column 1 — Target Margin */}
                    <div className="min-w-0 lg:border-r lg:border-white/[0.09] lg:pr-4">
                      <div className="flex items-center justify-between gap-2 whitespace-nowrap">
                        <span className="shrink-0 text-[11px] font-semibold text-white/62">Target Margin</span>
                        <span className="flex shrink-0 items-baseline gap-0.5">
                          <input
                            type="number"
                            value={finalMarginNum}
                            onChange={(e) => setMargin(e.target.value)}
                            disabled={pricingMode === "direct"}
                            className="w-10 border-0 bg-transparent p-0 text-right text-[16px] font-extrabold tabular-nums text-emerald-400 focus:outline-none focus:ring-0 disabled:opacity-50 [appearance:textfield]"
                          />
                          <span className="text-[13px] font-bold text-emerald-400/90">%</span>
                        </span>
                      </div>
                      <div className="mt-3">
                        <div className="relative h-2.5 rounded-full bg-white/[0.08] shadow-inner">
                          <div
                            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-500 to-blue-400 shadow-[0_0_16px_rgba(34,211,238,0.35)]"
                            style={{
                              width: `${Math.min(100, Math.max(0, ((finalMarginNum || 0) / 50) * 100))}%`,
                            }}
                          />
                          <span
                            className="absolute top-1/2 -translate-y-1/2 rounded-full border-2 border-cyan-200/80 bg-white shadow-[0_0_14px_rgba(59,130,246,0.65)]"
                            style={{
                              left: `calc(${Math.min(100, Math.max(0, ((finalMarginNum || 0) / 50) * 100))}% - 0.5rem)`,
                              width: "1rem",
                              height: "1rem",
                            }}
                            aria-hidden
                          />
                        </div>
                        <div className="mt-1.5 flex justify-between text-[9.5px] font-medium tabular-nums text-white/36">
                          <span>10%</span>
                          <span>20%</span>
                          <span>30%</span>
                          <span>40%</span>
                          <span>50%</span>
                        </div>
                      </div>
                    </div>

                    {/* Column 2 — Pricing Mode */}
                    <div className="min-w-0 lg:border-r lg:border-white/[0.09] lg:px-3.5">
                      <div className="text-[11px] font-semibold text-white/62">Pricing Mode</div>
                      <div className="mt-2 grid w-full grid-cols-[1.05fr_1.28fr_0.86fr] gap-1.5">
                        {([
                          { label: "Aggressive", value: 15 },
                          { label: "Competitive", value: 20 },
                          { label: "Retail", value: 25 },
                        ] as const).map((option) => {
                          const isActive = pricingMode !== "direct" && finalMarginNum === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setMargin(String(option.value))}
                              disabled={pricingMode === "direct"}
                              className={`min-h-[2.8rem] min-w-0 w-full rounded-md border px-2 py-1.5 text-center transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                isActive
                                  ? "border-blue-400/60 bg-blue-500/[0.22] text-white shadow-[0_0_18px_-8px_rgba(59,130,246,0.55)]"
                                  : "border-white/[0.10] bg-white/[0.03] text-white/58 hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white/85"
                              }`}
                            >
                              <span className="block text-[10px] font-semibold leading-tight">{option.label}</span>
                              <span className="mt-0.5 block text-[12px] font-bold tabular-nums leading-tight">{option.value}%</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Column 3 — Labor Adj. */}
                    <div className="min-w-0 lg:pl-3">
                      <div className="text-[11px] font-semibold text-white/62">Labor Adj.</div>
                      <div className="mt-2 flex min-h-[2.8rem] items-center rounded-md border border-white/[0.10] bg-black/20 px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                        <span className="shrink-0 text-[12px] font-semibold text-white/42">$</span>
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
                          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-right text-[14px] font-bold tabular-nums text-white/90 placeholder:text-white/30 focus:outline-none focus:ring-0 [appearance:textfield]"
                        />
                      </div>
                      <span className="mt-1.5 block text-[8.5px] uppercase tracking-[0.12em] text-white/34">per job override</span>
                    </div>
                  </div>
                </div>

                {/* Proposal Readiness — compact strip; package settings in header popover */}
                <div className="flex flex-col rounded-xl border border-cyan-400/[0.20] bg-[#0b1526] px-4 py-3 shadow-[0_0_0_1px_rgba(34,211,238,0.06),0_4px_20px_-10px_rgba(34,211,238,0.14),inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-500/20 text-[11px] font-bold tabular-nums text-emerald-100 shadow-[0_0_18px_rgba(16,185,129,0.22)]"
                      aria-hidden
                    >
                      5
                    </span>
                    <h2 className="min-w-0 flex-1 text-[14px] font-bold tracking-tight text-white sm:text-[15px]">Proposal Readiness</h2>
                    <details className="group relative shrink-0">
                      <summary
                        className="flex cursor-pointer list-none items-center gap-1 rounded-full border border-white/[0.10] bg-white/[0.04] py-0.5 pl-1.5 pr-2 text-[9px] font-semibold uppercase tracking-wider text-white/50 transition hover:border-white/[0.14] hover:bg-white/[0.06] hover:text-white/65 [&::-webkit-details-marker]:hidden [&::marker]:hidden"
                        aria-label="Package settings"
                      >
                        <Settings className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                        <span>Package</span>
                        <ChevronDown className="h-2.5 w-2.5 shrink-0 opacity-50 transition group-open:rotate-180" aria-hidden />
                      </summary>
                      <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-white/[0.10] bg-[#0d1829] p-3 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.75)]">
                        <div className="space-y-3">
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
                      </div>
                    </details>
                  </div>

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
                    const leftItems = checklist.slice(0, 4);
                    const rightItems = checklist.slice(4);
                    const renderItem = (item: { label: string; ready: boolean }) => (
                      <div key={item.label} className="flex min-w-0 items-center gap-1.5">
                        <span
                          className={
                            item.ready
                              ? "flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full border border-emerald-300/60 bg-emerald-400/25 text-[8px] font-bold text-emerald-50 shadow-[0_0_8px_rgba(16,185,129,0.45)]"
                              : "flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full border border-white/[0.18] bg-white/[0.04]"
                          }
                          aria-hidden
                        >
                          {item.ready ? "✓" : ""}
                        </span>
                        <span className={`min-w-0 text-[11px] font-medium leading-snug sm:text-[11.5px] ${item.ready ? "text-white/88" : "text-white/55"}`}>{item.label}</span>
                      </div>
                    );
                    return (
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-0">
                        <div className="flex min-w-0 flex-col sm:w-[43%] sm:max-w-[44%] sm:pr-3">
                          <div className="flex items-center gap-2.5">
                            <div className="h-2 min-h-[8px] flex-1 overflow-hidden rounded-full bg-white/[0.07] shadow-inner">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-300 to-blue-400 shadow-[0_0_16px_rgba(34,211,238,0.35)]"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="shrink-0 text-[13px] font-extrabold tabular-nums leading-none text-emerald-400">{pct}%</span>
                          </div>
                          <span className="mt-1.5 text-[10.5px] text-white/52">{done} of {checklist.length} components ready</span>
                          <button
                            type="button"
                            onClick={handlePreviewPdf}
                            disabled={isPreviewingPdf}
                            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-cyan-400/45 bg-cyan-500/[0.18] px-2.5 py-2 text-[12px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_20px_-10px_rgba(34,211,238,0.5)] transition hover:bg-cyan-500/[0.24] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            {isPreviewingPdf ? "Opening preview…" : "Preview proposal"}
                          </button>
                        </div>

                        <div className="hidden w-px shrink-0 self-stretch bg-gradient-to-b from-transparent via-white/[0.10] to-transparent sm:block" aria-hidden />

                        <div className="flex min-w-0 flex-1 flex-col justify-center sm:pl-3">
                          <div className="grid grid-cols-2 gap-x-5 gap-y-1.5">
                            <div className="flex min-w-0 flex-col gap-1.5">
                              {leftItems.map(renderItem)}
                            </div>
                            <div className="flex min-w-0 flex-col gap-1.5">
                              {rightItems.map(renderItem)}
                            </div>
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
                      <a href="/tools/roofing/saved" className="rounded-md px-2 py-1.5 text-left text-[12px] text-white/80 hover:bg-white/[0.05]">Open Job Board</a>
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

              <div className="rounded-xl border border-cyan-400/[0.18] bg-gradient-to-br from-[#0d1929] via-[#0a1422] to-[#07101d] p-3 shadow-[0_0_0_1px_rgba(34,211,238,0.055),inset_0_1px_0_rgba(255,255,255,0.065)] sm:p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[14px] font-bold tracking-tight text-white">Job Readiness</div>
                  <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/35">Live</span>
                </div>
                {(() => {
                  const total = jobReadinessItems.length;
                  const done = jobReadinessReadyCount;
                  const pct = total > 0 ? done / total : 0;
                  const radius = 36;
                  const circumference = 2 * Math.PI * radius;
                  const dash = circumference * pct;
                  return (
                    <div className="mt-3 grid grid-cols-[6.25rem_auto_minmax(0,1fr)] items-center gap-3.5">
                      <div className="relative h-[6.25rem] w-[6.25rem] shrink-0">
                        <div className="absolute inset-2 rounded-full bg-cyan-400/[0.06] blur-xl" aria-hidden />
                        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden>
                          <circle
                            cx="50"
                            cy="50"
                            r={radius}
                            stroke="rgba(148,163,184,0.13)"
                            strokeWidth="10"
                            fill="transparent"
                          />
                          <circle
                            cx="50"
                            cy="50"
                            r={radius}
                            stroke="rgba(34,211,238,0.95)"
                            strokeWidth="10"
                            fill="transparent"
                            strokeDasharray={`${dash} ${circumference}`}
                            strokeLinecap="round"
                            style={{ filter: "drop-shadow(0 0 8px rgba(34,211,238,0.55))" }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                          <div className="text-[19px] font-extrabold text-cyan-300 tabular-nums leading-none">
                            {Math.round(pct * 100)}%
                          </div>
                          <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-white/58">
                            Ready
                          </div>
                        </div>
                      </div>
                      <div className="h-[5.25rem] w-px shrink-0 bg-gradient-to-b from-transparent via-white/[0.12] to-transparent" aria-hidden />
                      <div className="min-w-0 space-y-1.5">
                        {jobReadinessItems.map((item) => (
                          <div key={item.label} className="flex items-center gap-2 rounded-lg px-1 py-0.5 text-[11.5px]">
                            <span
                              className={
                                item.ready
                                  ? "flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border border-emerald-300/55 bg-emerald-400/24 text-[9px] text-emerald-50 shadow-[0_0_8px_rgba(16,185,129,0.42)]"
                                  : "flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border border-white/16 bg-white/[0.04] text-[9px] text-white/45"
                              }
                              aria-hidden
                            >
                              {item.ready ? "✓" : ""}
                            </span>
                            <span className={`min-w-0 truncate ${item.ready ? "text-white/88" : "text-white/52"}`}>{item.label}</span>
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
                        className="group flex min-h-[3.1rem] min-w-[7.6rem] shrink-0 items-center justify-between gap-3 rounded-xl border border-blue-300/48 bg-gradient-to-br from-blue-500/95 via-blue-600/90 to-blue-700/86 px-3.5 py-2.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_0_0_1px_rgba(59,130,246,0.34),0_14px_36px_-18px_rgba(59,130,246,0.82)] transition hover:from-blue-400 hover:to-blue-600"
                        aria-label={allReady ? "Open proposal review" : "Let's go"}
                      >
                        <span className="text-[12px] font-bold text-white">{allReady ? "Review" : "Let's go"}</span>
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]">
                          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
                        </span>
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
    );
  }

  function renderJobCardShell() {
    const isBoardOrigin = isJobCardBoardContext;
    const identityFromJobRecord =
      !isBoardOrigin &&
      hydratedJobRecord != null &&
      currentJobId != null &&
      hydratedJobRecord.id === currentJobId;

    let displayName: string;
    let headerPhone: string;
    let headerEmail: string;
    let hasAddress: boolean;
    let addressLine: string;

    if (identityFromJobRecord) {
      const identity = resolveJobCardIdentityFromRecord(hydratedJobRecord);
      displayName = identity.displayName;
      headerPhone = identity.phone;
      headerEmail = identity.email;
      hasAddress = identity.hasAddress;
      addressLine = identity.addressLine;
    } else {
      displayName = (customerName || "").trim() || "New roofing job";
      headerPhone = customerPhone;
      headerEmail = customerEmail;
      hasAddress = (jobAddress1 || "").trim().length > 0;
      addressLine = hasAddress
        ? [jobAddress1, jobCity, jobState, jobZip].map((s) => (s || "").trim()).filter(Boolean).join(", ")
        : "Property details not complete";
    }

    const localMeasurement = buildJobCardSelectedMeasurement({
      area,
      waste,
      squares,
      adjustedSquares,
      pitch,
      stories,
      complexity,
      debrisTons,
      includeDebrisRemoval,
      removalType,
      guidedStories,
      guidedWalkable,
      laborMode,
      loadSavedId,
      currentLoadedSavedId,
      companyId,
    });
    const localRecord = localMeasurement.record;
    const hasUnsavedChanges =
      persistedSelectedMeasurement != null &&
      measurementRecordsDiffer(localRecord, persistedSelectedMeasurement);
    const workspace = resolveMeasurementWorkspaceState({
      localRecord,
      persistedRecord: persistedSelectedMeasurement,
      hasUnsavedChanges,
    });
    const readinessRecord =
      persistedSelectedMeasurement && !hasUnsavedChanges
        ? persistedSelectedMeasurement
        : localRecord;
    const estimateReadiness = deriveEstimateReadiness(readinessRecord);
    const productionReadiness = deriveProductionReadiness(readinessRecord);
    const hasLocalRoofSize = workspace.hasLocalRoofSize;
    const hasMeasurement = hasLocalRoofSize;
    const localWasteSet =
      localRecord.waste_percent != null && Number.isFinite(localRecord.waste_percent);
    const propertyForInstant = hasAddress ? addressLine : "Not entered";

    const roofAreaSqDisplay =
      localRecord.roof_squares != null && localRecord.roof_squares > 0
        ? `${localRecord.roof_squares.toFixed(1)} SQ`
        : "Not measured";
    const roofSqFtDisplay =
      localRecord.roof_area_sqft != null && localRecord.roof_area_sqft > 0
        ? `${localRecord.roof_area_sqft.toLocaleString()} sq ft`
        : "Not measured";
    const wasteFactorDisplay =
      localWasteSet && localRecord.waste_percent != null
        ? `${localRecord.waste_percent}%`
        : "Not set";
    const measurementRecordLabel = workspace.recordLabel;
    const measurementSourceLabel = workspace.sourceLabel;
    const isPersistedManual = workspace.isPersistedManual;
    const isPersistedNonManual = workspace.isPersistedNonManual;
    const statusRecord = isPersistedNonManual
      ? persistedSelectedMeasurement!
      : localRecord;
    const confidenceDisplay = statusRecord.confidence_label ?? "Not scored";
    const verificationDisplay = statusRecord.is_verified
      ? "Verified"
      : statusRecord.status === "needs_review"
        ? "Needs review"
        : "Not verified";
    const lineMeasurementRecord = isPersistedNonManual
      ? persistedSelectedMeasurement!
      : localRecord;
    const activityMeasurementLine = resolveActivityMeasurementLine({
      persistedRecord: persistedSelectedMeasurement,
      isPersistedManual,
      isPersistedNonManual,
    });
    const reportPathRecord = lineMeasurementRecord;
    const reportPathHelperText = formatReportPathHelperText({
      workspace,
      estimateReady: estimateReadiness.ready,
    });
    const reportSourceUrl = (reportPathRecord.source_url ?? "").trim();
    const proposalHandoff = buildMeasurementProposalHandoff({
      record: readinessRecord,
      workspace,
      hasUnsavedChanges,
      persistedRecord: persistedSelectedMeasurement,
    });
    const proposalHandoffNextAction = resolveProposalHandoffNextAction({
      handoff: proposalHandoff,
      workspace,
      persistedRecord: persistedSelectedMeasurement,
    });
    const catalogReadiness = deriveCatalogReadiness(
      activeCatalogItems,
      DEFAULT_ROOFING_CATALOG_DEFINITIONS.length
    );
    const catalogReadinessLabel = formatCatalogReadinessLabel(catalogReadiness);
    const proposalTemplateReadiness = deriveProposalTemplateReadiness({
      catalogReadiness,
      activeCatalogItems,
      starterGraph: starterTemplateGraph,
      templateCount: starterTemplateGraph ? 1 : 0,
      activeTemplateCount: starterTemplateGraph?.template.active ? 1 : starterTemplateGraph ? 1 : 0,
    });
    // Contractor "current proposal" uses visible drafts only (Block 1). If the
    // job's active_proposal_id points at a smoke fixture, do not surface it here.
    const jobCardActiveProposalId =
      listedJobDraftProposalId && isUuidLike(listedJobDraftProposalId)
        ? listedJobDraftProposalId
        : null;
    const proposalBuilderReadiness = deriveProposalBuilderReadiness({
      jobIdParam: currentJobId,
      job:
        currentJobId && isUuidLike(currentJobId)
          ? ({ id: currentJobId, company_id: companyId ?? "" } as JobRecord)
          : null,
      jobLoadComplete: true,
      measurementHandoff: proposalHandoff,
      measurementLoadComplete: true,
      catalogReadiness,
      catalogLoadComplete: true,
      templateReadiness: proposalTemplateReadiness,
      templateLoadComplete: templateSetupLoadComplete,
      // Connected draft means Builder should not false-block on company template install.
      hasValidPersistedDraft: Boolean(jobCardActiveProposalId),
    });

    const jobCardPackageSetup = buildJobCardPackageSetup(
      starterTemplateGraph,
      activeCatalogItems,
      jobCardSelectedPackageOptionId
    );

    // Job Card template step eligibility — per selected template graph, not company
    // starter install readiness (3 packages / 13 core lines).
    const jobCardSelectedTemplateEligibility =
      deriveJobCardSelectedTemplateEligibility({
        selectedTemplateId: selectedJobTemplateId,
        graph: starterTemplateGraph,
        catalogItems: activeCatalogItems,
        selectedOptionId: jobCardSelectedPackageOptionId,
      });

    const templateNameByTemplateId: Record<string, string | null> = {};
    for (const row of companyProposalTemplates) {
      templateNameByTemplateId[row.id] = (row.name ?? "").trim() || null;
    }
    const jobCardProposalRows = buildJobCardProposalRowViews({
      summaries: listedJobDraftSummaries,
      packageLabelsByProposalId: listedJobDraftPackageLabels,
      templateNameByTemplateId,
    });
    const proposalDraftCreatePayload =
      identityFromJobRecord &&
      hydratedJobRecord &&
      persistedSelectedMeasurement &&
      !hasUnsavedChanges &&
      proposalHandoff.proposalReady &&
      jobCardSelectedTemplateEligibility.usable &&
      starterTemplateGraph?.template.id &&
      starterTemplateGraph.template.id === selectedJobTemplateId &&
      isUuidLike(hydratedJobRecord.customer_id ?? "") &&
      isUuidLike(persistedSelectedMeasurement.id)
        ? {
            customer_id: hydratedJobRecord.customer_id!,
            template_id: starterTemplateGraph.template.id,
            measurement_record_id: persistedSelectedMeasurement.id,
            quantity_context: {
              measurementHandoff: proposalHandoff,
              quantityMap: deriveQuantityMapFromRecord(persistedSelectedMeasurement),
            },
            selected_template_option_id: jobCardPackageSetup.selectedOptionId,
            title: starterTemplateGraph.template.name ?? null,
          }
        : null;

    const proposalCreateBlockedOnBoard =
      isBoardOrigin && proposalDraftCreatePayload == null;

    const createNewDraftEnabled =
      proposalDraftCreatePayload != null &&
      !proposalCreateBlockedOnBoard &&
      (jobCardPackageSetup.choices.length === 0 ||
        (jobCardPackageSetup.selected != null &&
          (jobCardPackageSetup.selected.issueCount ?? 0) === 0));

    const openCreateProposalModal = () => {
      setProposalLaunchError(null);
      setProposalLaunchReason(null);
      setCreateProposalModalStep("measurement");
      setCreateProposalModalOpen(true);

      // Load ready measurements for modal cards (multi-record ready when present).
      const jobIdForModal = (currentJobId ?? "").trim();
      if (jobIdForModal && isUuidLike(jobIdForModal)) {
        void (async () => {
          try {
            const rows = await getMeasurementsForJob(jobIdForModal);
            createProposalMeasurementRecordsRef.current = rows;
            const choices = rows
              .filter(
                (row) =>
                  row.status !== "stale" &&
                  row.status !== "rejected" &&
                  deriveEstimateReadiness(row).ready
              )
              .map((row) =>
                buildCreateProposalMeasurementChoice({
                  id: row.id,
                  selectedLabel:
                    row.source_type === "manual"
                      ? "Saved manual"
                      : formatSourceTypeLabel(row.source_type) || "Measurement report",
                  roofAreaSqft: row.roof_area_sqft,
                  wastePercent: row.waste_percent,
                  ready: true,
                })
              );
            setCreateProposalModalMeasurements(choices);
            if (
              choices.length > 0 &&
              persistedSelectedMeasurement &&
              !choices.some((c) => c.id === persistedSelectedMeasurement.id)
            ) {
              const first = rows.find((r) => r.id === choices[0]!.id);
              if (first) setPersistedSelectedMeasurement(first);
            }
          } catch (err) {
            console.warn("[RoofingClient] create-proposal measurements fetch:", err);
            setCreateProposalModalMeasurements([]);
            createProposalMeasurementRecordsRef.current = [];
          }
        })();
      } else {
        setCreateProposalModalMeasurements([]);
        createProposalMeasurementRecordsRef.current = [];
      }
    };

    const closeCreateProposalModal = () => {
      if (proposalLaunchInFlightRef.current || isCreatingNewProposal) return;
      setCreateProposalModalOpen(false);
      setCreateProposalModalStep("measurement");
      setProposalLaunchError(null);
      setProposalLaunchReason(null);
      setCreateProposalModalMeasurements([]);
      createProposalMeasurementRecordsRef.current = [];
    };

    const visibleCreateProposalTemplates = filterJobCardCreateProposalTemplates(
      companyProposalTemplates,
      selectedJobTemplateId
    );

    const createProposalModalTemplates = visibleCreateProposalTemplates.map(
      (row) => {
        const selected = row.id === selectedJobTemplateId;
        const graphReady = jobCardSelectedTemplateEligibility.usable;
        const graphMatched =
          selected && jobCardSelectedTemplateEligibility.graphMatchesSelection;
        const packageCount = graphMatched
          ? jobCardPackageSetup.choices.length
          : 0;
        const linkedItemCount = graphMatched
          ? jobCardPackageSetup.createsSummary?.linkedCatalogCount ??
            jobCardPackageSetup.includedItemCount
          : 0;
        const availableUpgradeCount = graphMatched
          ? jobCardPackageSetup.createsSummary?.availableUpgradeCount ??
            jobCardPackageSetup.availableUpgradeCount
          : 0;
        const packageMode = graphMatched
          ? jobCardPackageSetup.packagePresentationMode
          : packageCount > 1
            ? "multi"
            : packageCount === 1
              ? "single"
              : "simple";
        // Selected: real eligibility from loaded graph. Others: available to pick
        // (do not apply company starter readiness to every row).
        const ready = selected ? graphReady : row.active !== false;
        return {
          id: row.id,
          name: (row.name ?? "").trim() || "Template",
          ready,
          linkedItemCount,
          packageCount,
          availableUpgradeCount,
          packageMode,
          archived: row.status === "archived",
        };
      }
    );

    /** Always create a distinct draft — never reuses active/listed drafts. */
    const handleCreateNewProposalDraft = () => {
      if (proposalLaunchInFlightRef.current) return;
      if (!createNewDraftEnabled) return;
      void (async () => {
        if (!currentJobId) return;
        const cid = (companyId ?? "").trim();
        if (!cid) return;
        if (isBoardOrigin && proposalDraftCreatePayload == null) return;

        proposalLaunchInFlightRef.current = true;
        setIsCreatingNewProposal(true);
        setIsLaunchingProposal(true);
        setProposalLaunchError(null);
        setProposalLaunchReason(null);

        try {
          const result = await createNewProposalDraftEntry(
            {
              companyId: cid,
              jobId: currentJobId,
              createPayload: proposalDraftCreatePayload,
              routeHints: productSpineRouteHintsFromSearchParams(
                "/tools/roofing",
                searchParams
              ),
            },
            { createDraftProposal }
          );

          if (result.proposalId && result.created) {
            setListedJobDraftProposalId(result.proposalId);
            await refreshHydratedJobRecord(currentJobId);
            try {
              const summaries = await listProposalsForJob(cid, currentJobId);
              const contractorRows = filterContractorVisibleProposals(
                summaries.filter((row) => isUuidLike(row.id))
              );
              setListedJobDraftSummaries(contractorRows);
              const draftRows = contractorRows.filter((row) => row.status === "draft");
              const active =
                draftRows.find((row) => row.id === result.proposalId) ??
                pickContractorVisibleJobDraft(draftRows, result.proposalId);
              setListedJobDraftSummary(active);
              const labels: Record<string, string | null> = {};
              await Promise.all(
                contractorRows.map(async (row) => {
                  if (!row.selected_option_id || !isUuidLike(row.selected_option_id)) {
                    labels[row.id] = null;
                    return;
                  }
                  labels[row.id] = await getProposalOptionLabel(
                    cid,
                    row.selected_option_id
                  );
                })
              );
              setListedJobDraftPackageLabels(labels);
              setListedJobDraftPackageLabel(
                active?.id ? labels[active.id] ?? null : null
              );
            } catch {
              // list refresh is best-effort; navigation still proceeds
            }
            setCreateProposalModalOpen(false);
            setCreateProposalModalStep("measurement");
            router.push(buildProposalBuilderHref(currentJobId, result.proposalId));
            return;
          }

          if (result.errorMessage) {
            setProposalLaunchError(result.errorMessage);
            setProposalLaunchReason(result.reason);
            if (!isExpectedProposalDraftEntryFailure(result.reason)) {
              console.error(
                "[RoofingClient] create new proposal draft failed:",
                result.reason,
                result.errorMessage
              );
            }
          }
        } finally {
          proposalLaunchInFlightRef.current = false;
          setIsCreatingNewProposal(false);
          setIsLaunchingProposal(false);
        }
      })();
    };

    // Board-origin identity normalization: clear sticky overlay state and open the
    // clean DB job= path (no from=board, no loadSaved). Does NOT create a proposal.
    const handleNormalizeAndOpenJobCard = (href: string) => {
      setJobCardBoardOrigin(false);
      setCurrentLoadedSavedId(null);
      if (currentJobId && isUuidLike(currentJobId)) {
        try {
          window.localStorage.setItem(LAST_DB_JOB_ID_STORAGE_KEY, currentJobId);
        } catch {
          // ignore storage failures
        }
      }
      router.push(href);
    };

    const reportMeasurementRows: { label: string; value: string; muted?: boolean }[] = [
      {
        label: "Roof facets",
        value: formatJobCardCount(lineMeasurementRecord.roof_facets_count),
        muted: lineMeasurementRecord.roof_facets_count == null,
      },
      {
        label: "Eaves",
        value: formatJobCardLf(lineMeasurementRecord.eaves_lf),
        muted: lineMeasurementRecord.eaves_lf == null,
      },
      {
        label: "Valleys",
        value: formatJobCardLf(lineMeasurementRecord.valleys_lf),
        muted: lineMeasurementRecord.valleys_lf == null,
      },
      {
        label: "Hips",
        value: formatJobCardLf(lineMeasurementRecord.hips_lf),
        muted: lineMeasurementRecord.hips_lf == null,
      },
      {
        label: "Ridges",
        value: formatJobCardLf(lineMeasurementRecord.ridges_lf),
        muted: lineMeasurementRecord.ridges_lf == null,
      },
      {
        label: "Rakes",
        value: formatJobCardLf(lineMeasurementRecord.rakes_lf),
        muted: lineMeasurementRecord.rakes_lf == null,
      },
      {
        label: "Wall flashing",
        value: formatJobCardLf(lineMeasurementRecord.wall_flashing_lf),
        muted: lineMeasurementRecord.wall_flashing_lf == null,
      },
      {
        label: "Step flashing",
        value: formatJobCardLf(lineMeasurementRecord.step_flashing_lf),
        muted: lineMeasurementRecord.step_flashing_lf == null,
      },
      {
        label: "Transitions",
        value: formatJobCardLf(lineMeasurementRecord.transitions_lf),
        muted: lineMeasurementRecord.transitions_lf == null,
      },
      {
        label: "Parapet wall",
        value: formatJobCardLf(lineMeasurementRecord.parapet_wall_lf),
        muted: lineMeasurementRecord.parapet_wall_lf == null,
      },
      {
        label: "Drip edge",
        value: formatJobCardLf(lineMeasurementRecord.drip_edge_lf),
        muted: lineMeasurementRecord.drip_edge_lf == null,
      },
      {
        label: "Starter",
        value: formatJobCardLf(lineMeasurementRecord.starter_lf),
        muted: lineMeasurementRecord.starter_lf == null,
      },
      {
        label: "Ridge cap",
        value: formatJobCardLf(lineMeasurementRecord.ridge_cap_lf),
        muted: lineMeasurementRecord.ridge_cap_lf == null,
      },
    ];

    const jcFieldLabel = "text-[11px] font-medium text-slate-600";
    const jcInput =
      "w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-200";
    const jcSelect = `${jcInput} pr-8`;
    const measurementsHeaderStatus = workspace.headerStatus;
    const canSaveMeasurement =
      hasLocalRoofSize &&
      !isSavingMeasurement &&
      Boolean((companyId ?? "").trim()) &&
      Boolean(currentJobId && isUuidLike(currentJobId)) &&
      !isPersistedNonManual;
    const measurementSaveDisabledReason = !currentJobId || !isUuidLike(currentJobId)
      ? "Create or open a job first"
      : !(companyId ?? "").trim()
        ? "Company context is required"
        : isPersistedNonManual
          ? "Selected measurement is from a report and cannot be overwritten yet"
          : !hasLocalRoofSize
            ? "Enter roof size before saving measurement."
            : undefined;

    const passiveAction = "inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed";
    const wsLabel = "text-[11px] font-semibold uppercase tracking-wide text-slate-400";
    const wsBlock = "rounded-md border border-slate-100 bg-slate-50/40 px-3 py-2.5";
    const metricTile = "rounded-md border border-slate-200/70 bg-white px-2.5 py-2 shadow-[0_1px_0_rgba(15,23,42,0.03)]";
    const statusPill = "text-xs font-medium text-slate-800";
    const statusMuted = "text-xs text-slate-400";

    const WorkspaceHeading = ({ children }: { children: string }) => (
      <p className={wsLabel}>{children}</p>
    );

    const MetricTile = ({ label, value, muted }: { label: string; value: string | number; muted?: boolean }) => (
      <div className={metricTile}>
        <dt className="text-[11px] text-slate-500">{label}</dt>
        <dd className={`mt-0.5 text-sm font-medium ${muted ? "text-slate-400" : "text-slate-800"}`}>{value}</dd>
      </div>
    );

    const StatusLine = ({ label, value, muted }: { label: string; value: string | number; muted?: boolean }) => (
      <div className="flex items-center justify-between gap-2 py-0.5 text-xs">
        <span className="text-slate-500">{label}</span>
        <span className={muted ? statusMuted : statusPill}>{value}</span>
      </div>
    );

    const PlaceholderBox = ({ lines }: { lines: string[] }) => (
      <div className={`${wsBlock} space-y-1`}>
        {lines.map((line) => (
          <p key={line} className="text-xs text-slate-500">
            {line}
          </p>
        ))}
      </div>
    );

    const CategoryFolder = ({ name }: { name: string }) => (
      <div className="flex flex-col gap-1 rounded-md border border-dashed border-slate-200 bg-slate-50/60 px-2.5 py-2">
        <span className="text-[11px] font-medium text-slate-700">{name}</span>
        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span>count: 0</span>
          <span>Empty</span>
        </div>
      </div>
    );

    const wsHelper = "mt-1.5 text-[11px] leading-snug text-slate-500";

    const jobCardDisplayBase = buildJobCardDisplayModel(
      isBoardOrigin ? (currentSaved ?? null) : null,
      {
        customerName: displayName,
        address: addressLine !== "Property details not complete" ? addressLine : undefined,
        roofAreaSqFt: Number(area || 0),
      }
    );
    // Block 1/2/3: contractor status must follow visible proposals, not hidden smoke drafts.
    const latestVisibleProposalForStatus = [...listedJobDraftSummaries].sort((a, b) => {
      const am = Date.parse(a.updated_at ?? "") || 0;
      const bm = Date.parse(b.updated_at ?? "") || 0;
      return bm - am;
    })[0];
    const latestVisiblePackageLabel =
      (latestVisibleProposalForStatus &&
        listedJobDraftPackageLabels[latestVisibleProposalForStatus.id]) ||
      listedJobDraftPackageLabel ||
      null;
    const jobCardDisplay = {
      ...jobCardDisplayBase,
      proposalLabel: formatJobCardContractorProposalStatusLabel({
        visibleSummaries: listedJobDraftSummaries,
        packageLabelsByProposalId: listedJobDraftPackageLabels,
      }),
    };
    const activityWhen = jobCardDisplay.lastUpdatedDisplay?.replace(/^Updated /, "") ?? "Just now";
    const proposalActivityLine = resolveJobCardProposalActivityLine(proposalBuilderReadiness, {
      measurementHandoff: proposalHandoff,
      catalogReadiness,
      templateReadiness: proposalTemplateReadiness,
      proposalNotStartedSubtitle: proposalHandoffNextAction.subtitle,
      hasVisibleContractorProposal: listedJobDraftSummaries.length > 0,
      readyForProposalLabel: JOB_CARD_PROPOSAL_ACTIVITY_READY_LABEL,
      readyForProposalNote: JOB_CARD_PROPOSAL_ACTIVITY_READY_NOTE,
      createdProposalLabel: JOB_CARD_PROPOSAL_ACTIVITY_CREATED_LABEL,
      createdProposalNote: formatJobCardProposalCreatedActivityNote(
        latestVisiblePackageLabel
      ),
    });
    const jobCardActivityItems: JobCardActivityItem[] = [
      isBoardOrigin && currentSaved
        ? { when: activityWhen, label: "Estimate loaded", note: "Opened from Job Board" }
        : { when: "Just now", label: "Job card opened", note: "New job / intake path" },
      { ...activityMeasurementLine, when: activityWhen },
      { ...proposalActivityLine, when: activityWhen },
    ];
    const ATTACHMENT_CATEGORIES = [
      "Inspection photos",
      "Customer photos",
      "Damage photos",
      "Measurement reports",
      "Insurance docs",
      "Contracts",
      "Other files",
      "Post-production photos",
    ] as const;

    return (
      <div className="min-h-0 w-full pb-8 pt-1 pl-3 pr-4 sm:pl-4 sm:pr-5 lg:pl-5 lg:pr-6">
        <div className="w-full max-w-[100rem]">
          <div className="overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
            <JobCardHeader
              display={jobCardDisplay}
              isBoardOrigin={isBoardOrigin}
              phone={headerPhone}
              email={headerEmail}
            />
            <JobCardMetadataStrip display={jobCardDisplay} />
            <JobCardTabs activeTab={jobCardTab} onTabChange={setJobCardTab} />

            <div className="grid min-h-[min(520px,calc(100vh-14rem))] grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px]">
              <main className="min-h-0 overflow-y-auto p-5 sm:p-6 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200/60">
              <JobCardSectionPanel tabId="overview" activeTab={jobCardTab} title="Overview" subtitle="Job summary and status at a glance">
                <JobCardOverviewSummary
                  display={jobCardDisplay}
                  phone={headerPhone}
                  email={headerEmail}
                  address={addressLine}
                  hasAddress={hasAddress}
                  measurementStatus={measurementsHeaderStatus}
                  catalogStatus={catalogReadinessLabel}
                  catalogReady={catalogReadiness.state === "ready_for_templates"}
                  onNavigateTab={setJobCardTab}
                />
              </JobCardSectionPanel>

              <JobCardSectionPanel
                tabId="measurements"
                activeTab={jobCardTab}
                title="Measurements"
                subtitle="Roof size, waste, and manual measurement entry"
                statusChip={{
                  label: measurementsHeaderStatus,
                  className: hasMeasurement ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
                }}
              >
                <div className="space-y-4">
                  <div className={wsBlock}>
                    <WorkspaceHeading>Measurement status</WorkspaceHeading>
                    <div className="mt-2 grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                      <StatusLine
                        label="Measurement record"
                        value={measurementRecordLabel}
                        muted={
                          measurementRecordLabel === "Not started" ||
                          measurementRecordLabel === "Not created"
                        }
                      />
                      <StatusLine label="Source" value={measurementSourceLabel} />
                      <StatusLine label="Confidence" value={confidenceDisplay} muted={!statusRecord.confidence_label} />
                      <StatusLine label="Verification" value={verificationDisplay} muted={!statusRecord.is_verified} />
                    </div>
                  </div>
                  <div className={wsBlock}>
                    <WorkspaceHeading>Manual measurement entry</WorkspaceHeading>
                    <p className={wsHelper}>
                      Enter roof size and details here. Saves to this job&apos;s measurement record.
                    </p>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label htmlFor="job-card-area" className={jcFieldLabel}>
                          Roof area (sq ft)
                        </label>
                        <div className="mt-1 flex items-center gap-2">
                          <input
                            id="job-card-area"
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
                            className={jcInput}
                          />
                          <span className="shrink-0 text-xs text-slate-500">sq ft</span>
                        </div>
                        {squares > 0 ? (
                          <p className="mt-1 text-[11px] tabular-nums text-slate-500">
                            ≈ {squares.toFixed(1)} squares
                            {adjustedSquares > 0 && adjustedSquares !== squares
                              ? ` · ${adjustedSquares.toFixed(1)} adj with waste`
                              : null}
                          </p>
                        ) : null}
                      </div>
                      <div>
                        <label htmlFor="job-card-waste" className={jcFieldLabel}>
                          Waste %
                        </label>
                        <input
                          id="job-card-waste"
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={100}
                          step={1}
                          value={waste ?? ""}
                          onChange={(e) => setWaste(e.target.value)}
                          className={`${jcInput} mt-1`}
                        />
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {ROOFING_WASTE_PRESETS.map((opt) => (
                            <button
                              key={opt.pct}
                              type="button"
                              onClick={() => setWaste(String(opt.pct))}
                              className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
                            >
                              {opt.label} {opt.pct}%
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label htmlFor="job-card-pitch" className={jcFieldLabel}>
                          Pitch
                        </label>
                        <select
                          id="job-card-pitch"
                          value={pitch}
                          onChange={(e) => setPitch(e.target.value as PitchKey)}
                          className={`${jcSelect} mt-1`}
                        >
                          <option value="walkable">Walkable</option>
                          <option value="moderate">Moderate</option>
                          <option value="steep">Steep</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="job-card-stories" className={jcFieldLabel}>
                          Stories
                        </label>
                        <select
                          id="job-card-stories"
                          value={stories}
                          onChange={(e) => setStories(e.target.value as StoriesKey)}
                          className={`${jcSelect} mt-1`}
                        >
                          <option value="1">1 story</option>
                          <option value="2">2 stories</option>
                          <option value="3">3+ stories</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="job-card-complexity" className={jcFieldLabel}>
                          Complexity
                        </label>
                        <select
                          id="job-card-complexity"
                          value={complexity}
                          onChange={(e) => setComplexity(e.target.value as ComplexityKey)}
                          className={`${jcSelect} mt-1`}
                        >
                          <option value="simple">Simple</option>
                          <option value="moderate">Moderate</option>
                          <option value="complex">Complex</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div>
                    <WorkspaceHeading>Roof details</WorkspaceHeading>
                    <p className={wsHelper}>Summary from your entries above (updates as you type).</p>
                    <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                      <MetricTile label="Roof area / SQ" value={roofAreaSqDisplay} muted={!hasMeasurement} />
                      <MetricTile label="SQ ft" value={roofSqFtDisplay} muted={!hasMeasurement} />
                      <MetricTile label="Waste factor" value={wasteFactorDisplay} muted={!localWasteSet} />
                      <MetricTile label="Pitch" value={localRecord.pitch_label ?? "Not selected"} />
                      <MetricTile label="Stories" value={formatJobCardStoriesLabel(localRecord.stories)} />
                      <MetricTile
                        label="Complexity"
                        value={formatJobCardComplexityLabel(localRecord.roof_complexity)}
                      />
                      <MetricTile
                        label="Roof type"
                        value={localRecord.roof_type ?? "Not selected"}
                        muted={!localRecord.roof_type}
                      />
                      <MetricTile
                        label="Structures"
                        value={formatJobCardCount(localRecord.structure_count)}
                        muted={localRecord.structure_count == null}
                      />
                      <MetricTile
                        label="Facets"
                        value={formatJobCardCount(localRecord.roof_facets_count)}
                        muted={localRecord.roof_facets_count == null}
                      />
                    </dl>
                  </div>
                  <div className={wsBlock}>
                    <WorkspaceHeading>Report measurements</WorkspaceHeading>
                    <p className={wsHelper}>
                      Line measurements from a report or manual takeoff appear here.
                    </p>
                    <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                      {reportMeasurementRows.map(({ label, value, muted }) => (
                        <MetricTile key={label} label={label} value={value} muted={muted} />
                      ))}
                    </dl>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <WorkspaceHeading>Measurement report path</WorkspaceHeading>
                      <p className={wsHelper}>{reportPathHelperText}</p>
                    </div>
                    <div className={wsBlock}>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Report source
                      </p>
                      <div className="mt-2 grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                        <StatusLine
                          label="Source type"
                          value={formatSourceTypeLabel(reportPathRecord.source_type)}
                          muted={reportPathRecord.source_type === "manual"}
                        />
                        <StatusLine
                          label="Source provider"
                          value={formatNullableId(reportPathRecord.source_provider)}
                          muted={!reportPathRecord.source_provider}
                        />
                        <StatusLine
                          label="Report type"
                          value={formatNullableId(reportPathRecord.report_type)}
                          muted={!reportPathRecord.report_type}
                        />
                        <StatusLine
                          label="Report source"
                          value={
                            (reportPathRecord.report_source ?? "").trim() ||
                            (reportPathRecord.source_type === "manual" ? "Manual" : "—")
                          }
                          muted={!(reportPathRecord.report_source ?? "").trim()}
                        />
                      </div>
                    </div>
                    <div className={wsBlock}>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Report status
                      </p>
                      <div className="mt-2 grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                        <StatusLine
                          label="Report status"
                          value={formatReportStatusLabel(reportPathRecord.report_status)}
                          muted={!reportPathRecord.report_status}
                        />
                        <StatusLine
                          label="Report attached"
                          value={formatReportAttachedLabel(reportPathRecord.report_attached)}
                          muted={!reportPathRecord.report_attached}
                        />
                        <StatusLine
                          label="Diagram"
                          value={formatDiagramAvailableLabel(reportPathRecord.diagram_available)}
                          muted={!reportPathRecord.diagram_available}
                        />
                        <StatusLine
                          label="Last updated"
                          value={formatReportLastUpdatedLabel(reportPathRecord.report_last_updated_at)}
                          muted={!(reportPathRecord.report_last_updated_at ?? "").trim()}
                        />
                      </div>
                    </div>
                    <div className={wsBlock}>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        IDs &amp; links
                      </p>
                      <div className="mt-2 grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                        <StatusLine
                          label="Report ID"
                          value={formatNullableId(reportPathRecord.source_report_id)}
                          muted={!reportPathRecord.source_report_id}
                        />
                        <StatusLine
                          label="Report file ID"
                          value={formatNullableId(reportPathRecord.report_file_id)}
                          muted={!reportPathRecord.report_file_id}
                        />
                        <StatusLine
                          label="Source file ID"
                          value={formatNullableId(reportPathRecord.source_file_id)}
                          muted={!reportPathRecord.source_file_id}
                        />
                        <div className="flex items-center justify-between gap-2 py-0.5 text-xs sm:col-span-2">
                          <span className="text-slate-500">Source URL</span>
                          {reportSourceUrl ? (
                            <a
                              href={reportSourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="max-w-[60%] truncate text-right font-medium text-sky-700 hover:underline"
                            >
                              {reportSourceUrl}
                            </a>
                          ) : (
                            <span className={statusMuted}>—</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="rounded-md border border-dashed border-slate-200 bg-slate-50/50 px-3 py-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Report path actions
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled
                          title="Orders provider reports later"
                          className={passiveAction}
                        >
                          Create report
                        </button>
                        <button
                          type="button"
                          disabled
                          title="Upload PDF/XML later"
                          className={passiveAction}
                        >
                          Attach report
                        </button>
                        <button
                          type="button"
                          disabled
                          title="Pull provider report later"
                          className={passiveAction}
                        >
                          Import provider report
                        </button>
                        <button
                          type="button"
                          disabled
                          title="Analyze inspection photos later"
                          className={passiveAction}
                        >
                          Photo / AI draft
                        </button>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500">
                        Provider orders, uploads, and photo analysis are not enabled yet. Manual save
                        remains available below.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
                    <button type="button" disabled className={passiveAction}>Edit measurement</button>
                    <button
                      type="button"
                      disabled={!canSaveMeasurement}
                      title={measurementSaveDisabledReason}
                      onClick={() => void handleSaveMeasurement()}
                      className={passiveAction}
                    >
                      {isSavingMeasurement
                        ? "Saving…"
                        : isPersistedManual
                          ? "Update measurement"
                          : "Save measurement"}
                    </button>
                    {!canSaveMeasurement && measurementSaveDisabledReason ? (
                      <p className="w-full text-[11px] text-slate-500">{measurementSaveDisabledReason}</p>
                    ) : null}
                    {measurementSaveError ? (
                      <p className="w-full text-[11px] text-red-600">{measurementSaveError}</p>
                    ) : null}
                  </div>
                </div>
              </JobCardSectionPanel>

              <JobCardSectionPanel
                tabId="attachments"
                activeTab={jobCardTab}
                title="Attachments"
                statusChip={{ label: "No attachments yet", className: "bg-slate-100 text-slate-500" }}
              >
                <div className="space-y-3">
                  <div className={wsBlock}>
                    <WorkspaceHeading>Attachment status</WorkspaceHeading>
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 sm:grid-cols-2">
                      <StatusLine label="Files" value="0" muted />
                      <StatusLine label="Folders" value="0" muted />
                      <StatusLine label="Last uploaded" value="None" muted />
                      <StatusLine label="Available for proposal" value="No" muted />
                    </div>
                  </div>
                  <div>
                    <WorkspaceHeading>Folder / category tiles</WorkspaceHeading>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {ATTACHMENT_CATEGORIES.map((cat) => (
                        <CategoryFolder key={cat} name={cat} />
                      ))}
                    </div>
                  </div>
                  <p className={wsHelper}>
                    Attachments added here can later be used when building the proposal.
                  </p>
                  <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-2">
                    <button type="button" disabled className={passiveAction}>Add attachment</button>
                    <button type="button" disabled className={passiveAction}>Create folder</button>
                    <button type="button" disabled className={passiveAction}>Sort / filter</button>
                    <button type="button" disabled className={passiveAction}>Search files</button>
                  </div>
                </div>
              </JobCardSectionPanel>

              <JobCardSectionPanel
                tabId="proposals"
                activeTab={jobCardTab}
                title="Proposals"
                subtitle={JOB_CARD_PROPOSALS_TAB_SUBTITLE}
                headerAction={
                  <JobCardProposalsAddHeaderButton
                    onClick={openCreateProposalModal}
                  />
                }
              >
                <JobCardProposalsTab
                  rows={jobCardProposalRows}
                  createReadyForBlock3={createNewDraftEnabled}
                  onAddProposal={openCreateProposalModal}
                  onOpenProposal={(proposalId) => {
                    if (!currentJobId || !isUuidLike(currentJobId)) return;
                    if (!isUuidLike(proposalId)) return;
                    router.push(
                      buildProposalBuilderHref(currentJobId, proposalId)
                    );
                  }}
                />
                <JobCardCreateProposalModal
                  open={createProposalModalOpen}
                  step={createProposalModalStep}
                  onStepChange={setCreateProposalModalStep}
                  onClose={closeCreateProposalModal}
                  measurements={createProposalModalMeasurements}
                  selectedMeasurementId={persistedSelectedMeasurement?.id ?? null}
                  onSelectMeasurement={(measurementId) => {
                    const next = createProposalMeasurementRecordsRef.current.find(
                      (row) => row.id === measurementId
                    );
                    if (next) setPersistedSelectedMeasurement(next);
                  }}
                  measurementReady={proposalHandoff.proposalReady}
                  measurementLabel={proposalHandoff.selectedLabel}
                  measurementRoofAreaSqft={
                    proposalHandoff.quantities.roof_area_sqft ?? null
                  }
                  measurementWastePercent={
                    proposalHandoff.quantities.waste_percent ?? null
                  }
                  templates={createProposalModalTemplates}
                  selectedTemplateId={selectedJobTemplateId}
                  onSelectTemplate={(templateId) => {
                    setSelectedJobTemplateId(templateId);
                    setJobCardSelectedPackageOptionId(null);
                  }}
                  templateReady={jobCardSelectedTemplateEligibility.usable}
                  selectedTemplateUnusableReason={
                    jobCardSelectedTemplateEligibility.graphMatchesSelection &&
                    !jobCardSelectedTemplateEligibility.usable
                      ? jobCardSelectedTemplateEligibility.reason
                      : null
                  }
                  selectedTemplateName={
                    (jobCardSelectedTemplateEligibility.graphMatchesSelection
                      ? starterTemplateGraph?.template.name
                      : null) ??
                    visibleCreateProposalTemplates.find(
                      (row) => row.id === selectedJobTemplateId
                    )?.name ??
                    null
                  }
                  packageChoices={
                    jobCardSelectedTemplateEligibility.graphMatchesSelection
                      ? jobCardPackageSetup.choices
                      : []
                  }
                  packagePresentationMode={
                    jobCardPackageSetup.packagePresentationMode
                  }
                  selectedPackageOptionId={jobCardPackageSetup.selectedOptionId}
                  onSelectPackage={setJobCardSelectedPackageOptionId}
                  packageIssueCount={
                    jobCardPackageSetup.selected?.issueCount ?? 0
                  }
                  selectedPackageName={
                    jobCardPackageSetup.selected?.label ?? null
                  }
                  includedItemCount={jobCardPackageSetup.includedItemCount}
                  availableUpgradeCount={
                    jobCardPackageSetup.availableUpgradeCount
                  }
                  createEnabled={createNewDraftEnabled}
                  creating={isCreatingNewProposal}
                  createError={proposalLaunchError}
                  onContinueToBuilder={handleCreateNewProposalDraft}
                />
              </JobCardSectionPanel>

              <JobCardSectionPanel
                tabId="material_orders"
                activeTab={jobCardTab}
                title="Material Orders"
                statusChip={{ label: "Not started", className: "bg-slate-100 text-slate-500" }}
              >
                <div className="space-y-3">
                  <div className={wsBlock}>
                    <WorkspaceHeading>Order status</WorkspaceHeading>
                    <div className="mt-2 grid grid-cols-1 gap-0.5 sm:grid-cols-2">
                      <StatusLine label="Status" value="Not started" muted />
                      <StatusLine label="Supplier" value="Not selected" muted />
                      <StatusLine label="Branch" value="Not selected" muted />
                      <StatusLine label="Material list" value="Not created" muted />
                      <StatusLine label="Delivery" value="Not set" muted />
                      <StatusLine label="Order total" value="—" muted />
                    </div>
                  </div>
                  <p className={wsHelper}>Material orders will be available after a proposal is ready.</p>
                  <div className="border-t border-slate-100 pt-2">
                    <button type="button" disabled className={passiveAction}>Create material order</button>
                  </div>
                </div>
              </JobCardSectionPanel>

              <JobCardSectionPanel
                tabId="work_orders"
                activeTab={jobCardTab}
                title="Work Orders"
                statusChip={{ label: "Not created", className: "bg-slate-100 text-slate-500" }}
              >
                <div className="space-y-3">
                  <div className={wsBlock}>
                    <WorkspaceHeading>Work order status</WorkspaceHeading>
                    <div className="mt-2 grid grid-cols-1 gap-0.5 sm:grid-cols-2">
                      <StatusLine label="Status" value="Not created" muted />
                      <StatusLine label="Crew" value="Not assigned" muted />
                      <StatusLine label="Schedule" value="Not scheduled" muted />
                      <StatusLine label="Scope" value="Estimate needed" muted />
                      <StatusLine label="Instructions" value="Not added" muted />
                      <StatusLine label="Material order" value="None" muted />
                    </div>
                  </div>
                  <p className={wsHelper}>Work orders will be created from an approved proposal.</p>
                  <div className="border-t border-slate-100 pt-2">
                    <button type="button" disabled className={passiveAction}>Create work order</button>
                  </div>
                </div>
              </JobCardSectionPanel>

              <JobCardSectionPanel
                tabId="invoices"
                activeTab={jobCardTab}
                title="Invoices"
                statusChip={{ label: "Not invoiced", className: "bg-slate-100 text-slate-500" }}
              >
                <div className="space-y-3">
                  <div className={wsBlock}>
                    <WorkspaceHeading>Invoice status</WorkspaceHeading>
                    <div className="mt-2 grid grid-cols-1 gap-0.5 sm:grid-cols-2">
                      <StatusLine label="Deposit invoice" value="Not created" muted />
                      <StatusLine label="Final invoice" value="Not created" muted />
                      <StatusLine label="Balance" value="—" muted />
                      <StatusLine label="Invoice status" value="Not invoiced" muted />
                      <StatusLine label="Last invoice" value="None" muted />
                    </div>
                  </div>
                  <p className={wsHelper}>Invoices will be created after proposal approval.</p>
                  <div>
                    <WorkspaceHeading>Invoice list</WorkspaceHeading>
                    <PlaceholderBox lines={["No invoices created yet"]} />
                  </div>
                  <div className="border-t border-slate-100 pt-2">
                    <button type="button" disabled className={passiveAction}>Create invoice</button>
                  </div>
                </div>
              </JobCardSectionPanel>

              <JobCardSectionPanel
                tabId="job_costing"
                activeTab={jobCardTab}
                title="Job Costing"
                statusChip={{ label: "Empty", className: "bg-slate-100 text-slate-500" }}
              >
                <div className="space-y-3">
                  <div>
                    <WorkspaceHeading>Costing summary</WorkspaceHeading>
                    <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {["Estimate total", "Projected cost", "Material cost", "Labor cost", "Gross profit"].map((label) => (
                        <MetricTile key={label} label={label} value="—" muted />
                      ))}
                      <MetricTile label="Actual cost" value="Not recorded" muted />
                    </dl>
                  </div>
                  <p className={wsHelper}>Job costing will populate once materials and labor are recorded.</p>
                  <div className="border-t border-slate-100 pt-2">
                    <button type="button" disabled className={passiveAction}>View job costing</button>
                  </div>
                </div>
              </JobCardSectionPanel>

              <JobCardSectionPanel
                tabId="tasks"
                activeTab={jobCardTab}
                title="Tasks"
                statusChip={{ label: "No tasks", className: "bg-slate-100 text-slate-500" }}
              >
                <div className="space-y-3">
                  <div className={wsBlock}>
                    <WorkspaceHeading>Tasks</WorkspaceHeading>
                    <div className="mt-2 space-y-0.5">
                      <StatusLine label="Inspection task" value="Not scheduled" muted />
                      <StatusLine label="Follow-up task" value="Not created" muted />
                      <StatusLine label="Customer call" value="Not scheduled" muted />
                    </div>
                  </div>
                  <div>
                    <WorkspaceHeading>Task list</WorkspaceHeading>
                    <PlaceholderBox lines={["No tasks created yet"]} />
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-2">
                    <button type="button" disabled className={passiveAction}>Add task</button>
                  </div>
                </div>
              </JobCardSectionPanel>

              <JobCardSectionPanel
                tabId="calendar"
                activeTab={jobCardTab}
                title="Calendar"
                statusChip={{ label: "No events", className: "bg-slate-100 text-slate-500" }}
              >
                <div className="space-y-3">
                  <div className={wsBlock}>
                    <WorkspaceHeading>Calendar</WorkspaceHeading>
                    <div className="mt-2 space-y-0.5">
                      <StatusLine label="Calendar event" value="None" muted />
                      <StatusLine label="Assigned user" value="Unassigned" muted />
                      <StatusLine label="Due date" value="Not set" muted />
                    </div>
                  </div>
                  <PlaceholderBox lines={["No calendar events scheduled"]} />
                  <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-2">
                    <button type="button" disabled className={passiveAction}>Add calendar event</button>
                  </div>
                </div>
              </JobCardSectionPanel>

              <JobCardSectionPanel
                tabId="instant_estimate"
                activeTab={jobCardTab}
                title="Instant Estimate"
                statusChip={{ label: "Not started", className: "bg-slate-100 text-slate-500" }}
              >
                <div className="space-y-3">
                  <div className={wsBlock}>
                    <WorkspaceHeading>Instant estimate status</WorkspaceHeading>
                    <div className="mt-2 grid grid-cols-1 gap-0.5 sm:grid-cols-2">
                      <StatusLine label="Status" value="Not started" muted />
                      <StatusLine label="Address" value={propertyForInstant} muted={!hasAddress} />
                      <StatusLine label="Measurement source" value="Not selected" muted />
                      <StatusLine label="Estimate type" value="Preliminary" />
                      <StatusLine label="Result" value="Not generated" muted />
                    </div>
                  </div>
                  <div className="border-t border-slate-100 pt-2">
                    <button type="button" disabled className={passiveAction}>Start instant estimate</button>
                  </div>
                </div>
              </JobCardSectionPanel>

              </main>

              <JobCardActivityPanel items={jobCardActivityItems} />

            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderEstimateBuilderShell() {
    const tierLabel =
      roofingTier === "standard"
        ? "Core"
        : roofingTier === "enhanced"
          ? "Enhanced"
          : "Premium";

    const templateLabel = `${tierLabel} Roofing System`;
    const ebProfit = Math.max(0, Number(finalPrice) - Number(subtotal));
    const ebMarginPct = pricingMode === "direct" ? 0 : finalMarginNum;
    const hasMeasurements = squares > 0;
    const hasEstimateTotal = canCompute && hasPrice;

    const roofSqDisplay =
      squares > 0
        ? adjustedSquares > 0 && adjustedSquares !== squares
          ? `${squares.toFixed(1)} SQ / ${adjustedSquares.toFixed(1)} adj`
          : `${squares.toFixed(1)} SQ`
        : "Not measured";

    const wasteDisplay =
      waste.trim() !== "" && Number.isFinite(parseFloat(waste))
        ? `${parseFloat(waste)}%`
        : "Not set";

    const disposalAmt = includeDebrisRemoval ? Number(effectiveDebrisRemovalCost) || 0 : 0;

    const bundleCostNum = parseFloat(bundleCost);
    const bundleCostDisplay =
      bundleCost.trim() !== "" && Number.isFinite(bundleCostNum)
        ? formatCurrency(bundleCostNum)
        : "—";

    const moneyOrDash = (value: number) => (canCompute ? formatCurrency(value) : "—");
    const sectionTotal = (value: number) => (canCompute ? formatCurrency(value) : "—");

    type RowTone = "derived" | "manual" | "included" | "needs" | "off" | "neutral" | "pricebook";

    type EditorRow = {
      item: string;
      mapping: string;
      source: string;
      tone: RowTone;
      unitType: string;
      unitCost: string;
      qty: string;
      waste: string;
      margin: string;
      total: string;
    };

    const sourceToneClass = (tone: RowTone) => {
      if (tone === "pricebook") return "text-sky-600/90";
      if (tone === "derived") return "text-slate-500";
      if (tone === "manual") return "text-slate-500";
      if (tone === "included") return "text-slate-500";
      if (tone === "needs") return "text-slate-400";
      if (tone === "off") return "text-slate-400";
      return "text-slate-500";
    };

    const rowMarginDisplay = (priced: boolean) => {
      if (!priced) return "—";
      if (pricingMode === "direct") return "0%";
      return `${ebMarginPct}%`;
    };

    const rowWasteDisplay = (usesGlobalWaste: boolean) => {
      if (!usesGlobalWaste) return "—";
      return wasteDisplay !== "Not set" ? wasteDisplay : "—";
    };

    const catalogMarginDisplay =
      pricingMode === "direct" ? "0%" : `${ebMarginPct}%`;
    const templateWasteForRows = rowWasteDisplay(hasMeasurements);
    const profitabilityTypeLabel = pricingMode === "direct" ? "Direct" : "Markup";

    const rowGridTemplate =
      "grid grid-cols-[minmax(14rem,1.35fr)_5.25rem_5rem_4rem_4rem_4.25rem_5rem_2rem] items-center gap-2";
    const sectionCard =
      "overflow-hidden rounded-md border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]";
    const rowGrid = `${rowGridTemplate} border-b border-slate-100 px-4 py-3 last:border-b-0`;
    const colHead = `${rowGridTemplate} border-b border-slate-200/70 bg-slate-50/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500`;
    const controlCell =
      "flex h-[34px] w-full items-center justify-end rounded-md border border-slate-200 bg-white px-2.5 text-sm font-medium tabular-nums text-slate-900";
    const controlCellText =
      "flex h-[34px] w-full items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 text-sm font-medium text-slate-800";
    const controlCellMuted =
      "flex h-[34px] w-full items-center justify-center rounded-md border border-dashed border-slate-200/80 bg-slate-50/60 px-2.5 text-sm font-normal tabular-nums text-slate-400";
    const settingsSummary =
      "flex cursor-pointer list-none items-center gap-1.5 border-t border-slate-100 px-5 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 [&::-webkit-details-marker]:hidden";
    const settingsBody = "border-t border-slate-100 bg-slate-50/50 px-5 py-4";
    const inputShell =
      "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-100";
    const inputClass =
      "w-full border-0 bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-50 [appearance:textfield]";
    const settingsModule =
      "rounded-md border border-slate-100 bg-slate-50/40 px-3 py-2.5";
    const settingsModuleLabel =
      "mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400";
    const settingsRow =
      "flex items-center justify-between gap-2 py-0.5 text-[11px] last:pb-0";
    const settingsRowLabel = "font-normal text-slate-400";
    const settingsRowValue = "text-right text-slate-600";
    const priceModule =
      "rounded-md border border-slate-200 bg-white px-3.5 py-3 shadow-[0_1px_3px_rgba(15,23,42,0.06)]";
    const priceModuleLabel =
      "mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600";
    const profitabilityModule =
      "overflow-hidden rounded-md border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]";
    const profitabilitySummary =
      "flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-xs transition hover:bg-slate-50/80 [&::-webkit-details-marker]:hidden";
    const profitabilityBody = "border-t border-slate-100 px-3 py-2.5";
    const drawerAction =
      "inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";
    const drawerActionPrimary =
      "inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-800 bg-slate-800 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50";
    const contextStrip =
      "mt-3 flex flex-wrap items-center gap-x-7 gap-y-2 rounded-md bg-slate-50 px-3 py-3 text-[13px] text-slate-600";
    const toolbarAction =
      "inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";
    const toolbarActionPrimary =
      "inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50";

    const sqQty =
      hasMeasurements
        ? `${adjustedSquares > 0 ? adjustedSquares.toFixed(1) : squares.toFixed(1)}`
        : "—";

    const materialRows: EditorRow[] = [
      {
        item: "Architectural shingles",
        mapping: `${tierLabel} system · Price book`,
        source: "Price book",
        tone: "pricebook",
        unitType: "SQ",
        unitCost: bundleCostDisplay,
        qty: sqQty,
        waste: rowWasteDisplay(true),
        margin: rowMarginDisplay(canCompute),
        total: canCompute ? formatCurrency(materialsCost) : "—",
      },
      {
        item: "Synthetic underlayment",
        mapping: hasMeasurements ? "Template item · Roof deck" : "Template item",
        source: hasMeasurements ? "Template item" : "Needs measurement",
        tone: hasMeasurements ? "included" : "needs",
        unitType: "Roll",
        unitCost: hasMeasurements ? "Included" : "—",
        qty: hasMeasurements ? sqQty : "—",
        waste: templateWasteForRows,
        margin: hasMeasurements ? catalogMarginDisplay : "—",
        total: "Included",
      },
      {
        item: "Starter strip",
        mapping: "Template item · Eave & rake",
        source: hasMeasurements ? "Template item" : "Needs measurement",
        tone: hasMeasurements ? "included" : "needs",
        unitType: "LF",
        unitCost: hasMeasurements ? "Included" : "—",
        qty: hasMeasurements ? "Est." : "—",
        waste: hasMeasurements ? templateWasteForRows : "—",
        margin: hasMeasurements ? catalogMarginDisplay : "—",
        total: "Included",
      },
      {
        item: "Ridge cap shingles",
        mapping: "Template item · Hip & ridge",
        source: hasMeasurements ? "Template item" : "Needs measurement",
        tone: hasMeasurements ? "included" : "needs",
        unitType: "LF",
        unitCost: hasMeasurements ? "Included" : "—",
        qty: hasMeasurements ? "Est." : "—",
        waste: hasMeasurements ? templateWasteForRows : "—",
        margin: hasMeasurements ? catalogMarginDisplay : "—",
        total: "Included",
      },
      {
        item: "Ice & water shield",
        mapping: "Template item · Valleys & eaves",
        source: hasMeasurements ? "Template item" : "Needs measurement",
        tone: hasMeasurements ? "included" : "needs",
        unitType: "Allowance",
        unitCost: hasMeasurements ? "Included" : "—",
        qty: hasMeasurements ? "1" : "—",
        waste: hasMeasurements ? templateWasteForRows : "—",
        margin: hasMeasurements ? catalogMarginDisplay : "—",
        total: "Included",
      },
      {
        item: "Drip edge",
        mapping: "Template item · Edge flashing",
        source: hasMeasurements ? "Template item" : "Needs measurement",
        tone: hasMeasurements ? "included" : "needs",
        unitType: "LF",
        unitCost: hasMeasurements ? "Included" : "—",
        qty: hasMeasurements ? "Est." : "—",
        waste: hasMeasurements ? templateWasteForRows : "—",
        margin: hasMeasurements ? catalogMarginDisplay : "—",
        total: "Included",
      },
    ];

    const accessoryRows: EditorRow[] = [
      {
        item: "Pipe boots / vents",
        mapping: "Template item · Penetrations",
        source: hasMeasurements ? "Template item" : "Needs measurement",
        tone: hasMeasurements ? "included" : "needs",
        unitType: "Each",
        unitCost: hasMeasurements ? "Included" : "—",
        qty: hasMeasurements ? "Est." : "—",
        waste: hasMeasurements ? templateWasteForRows : "—",
        margin: hasMeasurements ? catalogMarginDisplay : "—",
        total: "Included",
      },
      {
        item: "Fasteners / nails",
        mapping: "Template item · Fasteners",
        source: hasMeasurements ? "Template item" : "Needs measurement",
        tone: hasMeasurements ? "included" : "needs",
        unitType: "Box",
        unitCost: hasMeasurements ? "Included" : "—",
        qty: hasMeasurements ? "Est." : "—",
        waste: hasMeasurements ? templateWasteForRows : "—",
        margin: hasMeasurements ? catalogMarginDisplay : "—",
        total: "Included",
      },
      {
        item: "Sealant / caulk allowance",
        mapping: "Template item · Sealant",
        source: hasMeasurements ? "Template item" : "Needs measurement",
        tone: hasMeasurements ? "included" : "needs",
        unitType: "Allowance",
        unitCost: hasMeasurements ? "Included" : "—",
        qty: hasMeasurements ? "1" : "—",
        waste: hasMeasurements ? templateWasteForRows : "—",
        margin: hasMeasurements ? catalogMarginDisplay : "—",
        total: "Included",
      },
    ];

    const laborRows: EditorRow[] = [
      {
        item: "Roof installation labor",
        mapping: laborMode === "guided" ? "Guided · Full roof install" : "Manual · Full roof install",
        source: laborMode === "guided" ? "Derived" : "Manual",
        tone: laborMode === "guided" ? "derived" : "manual",
        unitType: laborMode === "guided" ? "SQ" : "Job",
        unitCost: laborMode === "guided" ? "Derived" : "Manual",
        qty: laborMode === "guided" && hasMeasurements ? sqQty : "1",
        waste: "—",
        margin: rowMarginDisplay(canCompute),
        total: canCompute ? formatCurrency(laborCostEffective) : "—",
      },
      {
        item: "Tear-off labor / prep",
        mapping: "Template item · Prep labor",
        source: includeDebrisRemoval ? "Included" : "Manual",
        tone: includeDebrisRemoval ? "included" : "off",
        unitType: "Job",
        unitCost: includeDebrisRemoval ? "Included" : "Manual",
        qty: "1",
        waste: "—",
        margin: includeDebrisRemoval ? catalogMarginDisplay : "—",
        total: includeDebrisRemoval ? "Included" : "—",
      },
      {
        item: "Cleanup & site protection",
        mapping: "Template item · Cleanup",
        source: "Included",
        tone: "included",
        unitType: "Job",
        unitCost: "Included",
        qty: "1",
        waste: "—",
        margin: catalogMarginDisplay,
        total: "Included",
      },
    ];

    const disposalRows: EditorRow[] = [
      {
        item: "Tear-off & disposal",
        mapping: includeDebrisRemoval ? "Derived · Layer removal" : "Not included",
        source: includeDebrisRemoval ? "Derived" : "Manual",
        tone: includeDebrisRemoval ? "derived" : "off",
        unitType: "Ton",
        unitCost: includeDebrisRemoval ? "Derived" : "—",
        qty: includeDebrisRemoval && debrisTons > 0 ? `${debrisTons.toFixed(2)}` : includeDebrisRemoval ? "Est." : "—",
        waste: "—",
        margin: rowMarginDisplay(includeDebrisRemoval && canCompute),
        total: includeDebrisRemoval && canCompute ? formatCurrency(disposalAmt) : "$0",
      },
      {
        item: "Dumpster / dump fees",
        mapping: "Template item · Disposal fees",
        source: includeDebrisRemoval ? "Included" : "Manual",
        tone: includeDebrisRemoval ? "included" : "off",
        unitType: "Job",
        unitCost: includeDebrisRemoval ? "Included" : "—",
        qty: includeDebrisRemoval ? "1" : "—",
        waste: "—",
        margin: includeDebrisRemoval ? catalogMarginDisplay : "—",
        total: includeDebrisRemoval ? "Included" : "$0",
      },
      {
        item: "Debris handling",
        mapping: "Template item · Haul-off",
        source: includeDebrisRemoval ? "Included" : "Manual",
        tone: includeDebrisRemoval ? "included" : "off",
        unitType: "Job",
        unitCost: includeDebrisRemoval ? "Included" : "—",
        qty: includeDebrisRemoval ? "1" : "—",
        waste: "—",
        margin: includeDebrisRemoval ? catalogMarginDisplay : "—",
        total: includeDebrisRemoval ? "Included" : "$0",
      },
    ];

    const otherFeesRows: EditorRow[] = [
      {
        item: "Permit allowance",
        mapping: "Template item · Permits",
        source: "Manual",
        tone: "off",
        unitType: "Job",
        unitCost: "Manual",
        qty: "—",
        waste: "—",
        margin: "0%",
        total: "$0",
      },
      {
        item: "Other items",
        mapping: "Template item · Extras",
        source: "Manual",
        tone: "off",
        unitType: "Each",
        unitCost: "Manual",
        qty: "—",
        waste: "—",
        margin: "0%",
        total: "$0",
      },
    ];

    function renderDotMenu(label: string) {
      return (
        <button
          type="button"
          disabled
          aria-label={label}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </button>
      );
    }

    function renderUnitPill(unitType: string) {
      return (
        <button
          type="button"
          disabled
          className="inline-flex h-[34px] w-full min-w-0 items-center justify-between gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-sm font-medium text-slate-900"
        >
          <span className="truncate">{unitType}</span>
          <ChevronDown className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
        </button>
      );
    }

    function renderControlValue(value: string, forceMuted = false) {
      const isEmpty = value === "—";
      const isLabelValue =
        value === "Included" || value === "Manual" || value === "Derived" || value === "Est.";
      const className = isEmpty || forceMuted
        ? controlCellMuted
        : isLabelValue
          ? controlCellText
          : controlCell;
      return (
        <div className={className}>
          <span className="truncate">{value}</span>
        </div>
      );
    }

    function renderSettingsRow(label: string, value: React.ReactNode) {
      return (
        <div className={settingsRow}>
          <dt className={settingsRowLabel}>{label}</dt>
          <dd className={`m-0 ${settingsRowValue}`}>{value}</dd>
        </div>
      );
    }

    function renderEditorRow(row: EditorRow) {
      const totalBold = row.total !== "—" && row.total !== "Included" && row.total !== "$0";
      const mutedCost = row.unitCost === "—";
      const mutedQty = row.qty === "—";
      const mutedWaste = row.waste === "—";
      const mutedMargin = row.margin === "—";
      return (
        <div key={row.item} className={rowGrid}>
          <div className="min-w-0 pl-5">
            <div className="flex min-w-0 items-start gap-1.5">
              <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden />
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold leading-tight text-slate-900">{row.item}</p>
                <p className="truncate text-[13px] leading-snug text-slate-500">{row.mapping}</p>
                <p className={`text-[11px] leading-tight ${sourceToneClass(row.tone)} ${row.tone === "needs" ? "italic" : ""}`}>
                  {row.source}
                </p>
              </div>
            </div>
          </div>
          {renderControlValue(row.unitCost, mutedCost)}
          <div>{renderUnitPill(row.unitType)}</div>
          {renderControlValue(row.qty, mutedQty)}
          {renderControlValue(row.waste, mutedWaste)}
          {renderControlValue(row.margin, mutedMargin)}
          <div className={totalBold ? `${controlCell} font-bold` : row.total === "Included" || row.total === "Manual" ? controlCellText : controlCellMuted}>
            <span className="truncate">{row.total}</span>
          </div>
          <div className="flex h-[34px] items-center justify-end">{renderDotMenu(`Actions for ${row.item}`)}</div>
        </div>
      );
    }

    function renderSectionBlock({
      title,
      rows,
      total,
      settings,
    }: {
      title: string;
      rows: EditorRow[];
      total: string;
      settings?: React.ReactNode;
    }) {
      return (
        <section className={sectionCard}>
          <div className="flex items-center gap-3 border-b border-slate-200/70 bg-slate-50/80 px-4 py-3">
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            <h2 className="min-w-0 flex-1 text-sm font-semibold tracking-tight text-slate-900">{title}</h2>
            <div className="flex shrink-0 items-baseline gap-1.5 text-sm tabular-nums">
              <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Total</span>
              <span className="font-semibold text-slate-900">{total}</span>
            </div>
            {renderDotMenu(`${title} section menu`)}
          </div>

          <div className={colHead}>
            <span>Item / Mapping</span>
            <span className="text-right">Unit Cost</span>
            <span className="text-center">Unit</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Waste</span>
            <span className="text-right">Margin</span>
            <span className="text-right">Total</span>
            <span />
          </div>

          <div>{rows.map(renderEditorRow)}</div>

          <button
            type="button"
            disabled
            className={`${rowGrid} !border-b-0 border-t border-dashed border-slate-200/90 bg-sky-50/30 py-3.5 transition hover:bg-sky-50/60 disabled:cursor-default`}
          >
            <div className="flex min-h-[34px] min-w-0 items-center pl-5 text-left">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-sky-200/90 bg-white px-3 py-1.5 text-sm font-semibold text-sky-800 shadow-sm">
                + Add item
              </span>
            </div>
            <span aria-hidden />
            <span aria-hidden />
            <span aria-hidden />
            <span aria-hidden />
            <span aria-hidden />
            <span aria-hidden />
            <span aria-hidden />
          </button>

          {settings}
        </section>
      );
    }

    const measurementSettings = (
      <details>
        <summary className={settingsSummary}>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" aria-hidden />
          Measurement settings
        </summary>
        <div className={settingsBody}>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <label htmlFor="eb-area" className="text-xs font-semibold text-slate-600">
                Roof size (sq ft)
              </label>
              <div className={`mt-1 flex items-center gap-2 ${inputShell}`}>
                <Ruler className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                <input
                  id="eb-area"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={1}
                  value={area ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setArea(v.trim() === "" ? "" : String(Number(v) || 0));
                  }}
                  disabled={isLocked}
                  placeholder="e.g. 2400"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="lg:col-span-2">
              <p className="text-xs font-semibold text-slate-600">Waste factor</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {ROOFING_WASTE_PRESETS.map((opt) => {
                  const selected =
                    waste.trim() !== "" &&
                    Number.isFinite(parseFloat(waste)) &&
                    Math.abs(parseFloat(waste) - opt.pct) < 0.0001;

                  return (
                    <button
                      key={opt.pct}
                      type="button"
                      disabled={isLocked}
                      onClick={() => setWaste(String(opt.pct))}
                      className={`rounded-lg border px-3 py-2 text-left text-sm transition disabled:opacity-50 ${
                        selected
                          ? "border-sky-500 bg-sky-50 text-sky-950"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <span className="block font-semibold">{opt.label}</span>
                      <span className="text-xs text-slate-500">{opt.pct}% waste</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-2">
              <p className="text-xs font-semibold text-slate-600">Roofing system</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {(["standard", "enhanced", "premium"] as const).map((option) => {
                  const selected = roofingTier === option;
                  const lbl =
                    option === "standard" ? "Core" : option === "enhanced" ? "Enhanced" : "Premium";

                  return (
                    <button
                      key={option}
                      type="button"
                      disabled={isLocked}
                      onClick={() => setRoofingTier(option)}
                      className={`rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                        selected
                          ? "border-emerald-500 bg-emerald-50 text-emerald-950"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      {lbl}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label htmlFor="eb-bundleCost" className="text-xs font-semibold text-slate-600">
                Bundle cost
              </label>
              <div className={`mt-1 flex items-center gap-2 ${inputShell}`}>
                <DollarSign className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                <input
                  id="eb-bundleCost"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={bundleCost}
                  onChange={(e) => setBundleCost(e.target.value)}
                  disabled={isLocked}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label htmlFor="eb-bundlesPerSquare" className="text-xs font-semibold text-slate-600">
                Bundles / square
              </label>
              <div className={`mt-1 flex items-center gap-2 ${inputShell}`}>
                <Package className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                <input
                  id="eb-bundlesPerSquare"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.5"
                  value={bundlesPerSquare}
                  onChange={(e) => setBundlesPerSquare(e.target.value)}
                  disabled={isLocked}
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        </div>
      </details>
    );

    const laborSettings = (
      <details>
        <summary className={settingsSummary}>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" aria-hidden />
          Labor settings
        </summary>
        <div className={settingsBody}>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isLocked}
                onClick={switchToGuided}
                className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition disabled:opacity-50 ${
                  laborMode === "guided"
                    ? "border-sky-500 bg-sky-50 text-sky-950"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                Guided
              </button>
              <button
                type="button"
                disabled={isLocked}
                onClick={switchToManual}
                className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition disabled:opacity-50 ${
                  laborMode === "manual"
                    ? "border-sky-500 bg-sky-50 text-sky-950"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                Manual
              </button>
            </div>

            {laborMode === "guided" ? (
              <div className="max-w-xs">
                <label className="text-xs font-semibold text-slate-600">Base labor $/square</label>
                <input
                  type="number"
                  min={0}
                  value={guidedLaborBasePerSquare}
                  onChange={(e) =>
                    setGuidedLaborBasePerSquare(
                      clampInt(Number(e.target.value) || 0, BASE_PER_SQ_MIN, BASE_PER_SQ_MAX)
                    )
                  }
                  disabled={isLocked}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm disabled:opacity-50"
                />
              </div>
            ) : (
              <div className="max-w-xs">
                <label className="text-xs font-semibold text-slate-600">Labor total ($)</label>
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
                  disabled={isLocked}
                  placeholder="0"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm disabled:opacity-50"
                />
              </div>
            )}
          </div>
        </div>
      </details>
    );

    const tearOffSettings = (
      <details>
        <summary className={settingsSummary}>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" aria-hidden />
          Tear-off settings
        </summary>
        <div className={settingsBody}>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
              <div>
                <p className="text-sm font-semibold text-slate-900">Include tear-off &amp; disposal</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {includeDebrisRemoval
                    ? "Adds disposal cost to the job cost."
                    : "Excluded from this estimate."}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={includeDebrisRemoval}
                disabled={isLocked}
                onClick={() => setIncludeDebrisRemoval((v) => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
                  includeDebrisRemoval ? "bg-sky-500" : "bg-slate-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transition ${
                    includeDebrisRemoval ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-slate-600">Removal type</label>
                <select
                  value={removalType}
                  onChange={(e) => setRemovalType(e.target.value as "standard" | "architectural")}
                  disabled={isLocked || !includeDebrisRemoval}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <option value="standard">Standard</option>
                  <option value="architectural">Architectural</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Disposal $/ton</label>
                <input
                  value={dumpFeePerTon}
                  onChange={(e) => setDumpFeePerTon(e.target.value)}
                  inputMode="decimal"
                  disabled={isLocked || !includeDebrisRemoval}
                  placeholder="e.g. 80"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                />
              </div>
            </div>
          </div>
        </div>
      </details>
    );

    const marginSliderPct = Math.min(50, Math.max(0, finalMarginNum));

    const metaSubtitle = "Manual estimate";

    return (
      <div className="min-h-0 w-full pb-8 pt-1 pl-3 pr-4 sm:pl-4 sm:pr-5 lg:pl-5 lg:pr-6">
        <div className="w-full max-w-[100rem]">
          <div className="mb-3 border-b border-slate-200 pb-3">
            <header className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Estimate</h1>
                  <span className="rounded-md bg-amber-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-amber-900">
                    Draft
                  </span>
                  <span className="text-base font-medium text-slate-700">{templateLabel}</span>
                </div>
                <p className="mt-1.5 text-sm text-slate-500">{metaSubtitle}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <motion.button
                  type="button"
                  onClick={saveEstimate}
                  disabled={!canSave || isSaving || isLocked}
                  className={`${savedFlash ? "border border-emerald-300 bg-emerald-50 text-emerald-800" : toolbarActionPrimary}`}
                  whileTap={{ scale: 0.98 }}
                >
                  <Save className="h-4 w-4" aria-hidden />
                  {isSaving ? "Saving…" : savedFlash ? "Saved" : "Save"}
                </motion.button>
                <button
                  type="button"
                  onClick={handlePreviewPdf}
                  disabled={isPreviewingPdf || isLocked}
                  className={toolbarAction}
                >
                  <Eye className="h-4 w-4" aria-hidden />
                  Preview
                </button>
                <button
                  type="button"
                  onClick={onDownloadPdf}
                  disabled={isLocked}
                  className={toolbarAction}
                >
                  <Download className="h-4 w-4" aria-hidden />
                  Download
                </button>
                <a
                  href="/tools/roofing?entry=packet"
                  className="ml-1 text-sm font-medium text-slate-500 underline-offset-2 transition hover:text-slate-800"
                >
                  ← Back to Job Packet
                </a>
              </div>
            </header>

            <div className={contextStrip}>
              <span>
                <span className="text-slate-400">Template:</span>{" "}
                <span className="font-semibold text-slate-900">{templateLabel}</span>
              </span>
              <span>
                <span className="text-slate-400">Measurement source:</span>{" "}
                <span className="font-medium text-slate-900">Manual</span>
              </span>
              <span>
                <span className="text-slate-400">Roof size:</span>{" "}
                <span className="font-medium tabular-nums text-slate-900">{roofSqDisplay}</span>
              </span>
              <span>
                <span className="text-slate-400">Waste:</span>{" "}
                <span className="font-medium tabular-nums text-slate-900">{wasteDisplay}</span>
              </span>
              <span>
                <span className="text-slate-400">Takeoff / report:</span>{" "}
                <span className="font-medium text-slate-900">Not attached · Manual</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(22.5rem,25rem)] xl:items-start xl:gap-6">
            <div className="min-w-0 w-full space-y-2">
              {renderSectionBlock({
                title: "Materials",
                rows: materialRows,
                total: sectionTotal(materialsCost),
                settings: measurementSettings,
              })}

              {renderSectionBlock({
                title: "Roofing Accessories",
                rows: accessoryRows,
                total: "—",
              })}

              {renderSectionBlock({
                title: "Labor",
                rows: laborRows,
                total: sectionTotal(laborCostEffective),
                settings: laborSettings,
              })}

              {renderSectionBlock({
                title: "Disposal / Tear-off",
                rows: disposalRows,
                total: includeDebrisRemoval && canCompute ? formatCurrency(disposalAmt) : "$0",
                settings: tearOffSettings,
              })}

              {renderSectionBlock({
                title: "Other / Fees",
                rows: otherFeesRows,
                total: "$0",
              })}
            </div>

            <aside className="flex min-w-0 w-full flex-col gap-2.5 xl:min-w-[22.5rem] xl:max-w-[25rem] xl:shrink-0">
              <div className={settingsModule}>
                <p className={settingsModuleLabel}>Estimate Settings</p>
                <dl>
                  {renderSettingsRow("Template", templateLabel)}
                  {renderSettingsRow("Profitability type", profitabilityTypeLabel)}
                  {renderSettingsRow("Quantity rounding", "Standard")}
                  {renderSettingsRow("Line item detail", "Visible")}
                  {renderSettingsRow("Catalog source", "Template")}
                </dl>
              </div>

              <div className={priceModule}>
                <p className={priceModuleLabel}>Estimate Price</p>

                <div className="flex items-baseline justify-between gap-3 rounded-md border border-slate-100 bg-slate-50/60 px-2.5 py-2">
                  <span className="text-xs font-medium text-slate-600">Estimate Total</span>
                  <span
                    className={`tabular-nums tracking-tight ${
                      canCompute ? "text-2xl font-bold text-slate-900" : "text-base font-medium text-slate-400"
                    }`}
                  >
                    {finalPriceDisplay}
                  </span>
                </div>

                <dl className="mt-2.5 space-y-0">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-50 py-1.5 text-sm">
                    <dt className="text-slate-500">Subtotal</dt>
                    <dd className="font-semibold tabular-nums text-slate-900">{moneyOrDash(subtotal)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-b border-slate-50 py-1.5 text-sm">
                    <dt className="text-slate-500">Job Cost</dt>
                    <dd className="font-semibold tabular-nums text-slate-900">{moneyOrDash(subtotal)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-b border-slate-50 py-1.5 text-sm">
                    <dt className="text-slate-500">Discounts</dt>
                    <dd className="font-medium tabular-nums text-slate-500">$0</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-b border-slate-50 py-1.5 text-sm">
                    <dt className="text-slate-500">Tax</dt>
                    <dd className="font-medium tabular-nums text-slate-500">$0</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 py-2 text-sm">
                    <dt className="font-medium text-slate-700">Gross Profit</dt>
                    <dd className="font-semibold tabular-nums text-emerald-700">
                      {canCompute ? formatCurrency(ebProfit) : "—"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2 py-1.5 text-sm">
                    <dt className="font-medium text-slate-700">Margin</dt>
                    <dd className="font-semibold tabular-nums text-slate-900">
                      {canCompute ? `${ebMarginPct}%` : "—"}
                    </dd>
                  </div>
                </dl>

                <div className="mt-3 space-y-2 border-t border-slate-200/80 pt-3">
                  <motion.button
                    type="button"
                    onClick={saveEstimate}
                    disabled={!canSave || isSaving || isLocked}
                    className={`${savedFlash ? "border border-emerald-300 bg-emerald-50 text-emerald-800" : drawerActionPrimary}`}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Save className="h-4 w-4" aria-hidden />
                    {isSaving ? "Saving…" : savedFlash ? "Saved" : "Save Estimate"}
                  </motion.button>
                  <button
                    type="button"
                    onClick={handlePreviewPdf}
                    disabled={isPreviewingPdf || isLocked}
                    className={drawerAction}
                  >
                    <Eye className="h-4 w-4" aria-hidden />
                    {isPreviewingPdf ? "Opening…" : "Preview Estimate"}
                  </button>
                  <button
                    type="button"
                    onClick={onDownloadPdf}
                    disabled={isLocked}
                    className={drawerAction}
                  >
                    <Download className="h-4 w-4" aria-hidden />
                    Download Estimate
                  </button>
                </div>
              </div>

              <details className={profitabilityModule}>
                <summary className={profitabilitySummary}>
                  <span className="min-w-0 flex-1 truncate text-slate-600">
                    <span className="font-medium text-slate-700">Profitability</span>
                    <span className="tabular-nums text-slate-500">
                      {" "}
                      · {finalMarginNum}% · {profitabilityTypeLabel}
                    </span>
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                </summary>
                <div className={profitabilityBody}>
                  <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-500">Pricing mode</span>
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => setPricingMode(pricingMode === "direct" ? "markup" : "direct")}
                      className="font-medium text-sky-700 underline-offset-2 transition hover:text-sky-800 disabled:opacity-50"
                    >
                      {profitabilityTypeLabel}
                    </button>
                  </div>
                  {pricingMode !== "direct" ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-600">Target margin</span>
                        <span className="text-xs font-semibold tabular-nums text-slate-900">{finalMarginNum}%</span>
                      </div>
                      <div className="relative flex h-7 items-center">
                        <div className="h-1.5 w-full rounded-full bg-slate-200">
                          <div
                            className="h-1.5 rounded-full bg-sky-500 transition-all"
                            style={{ width: `${(marginSliderPct / 50) * 100}%` }}
                          />
                        </div>
                        <div
                          className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 border-sky-500 bg-white shadow-sm"
                          style={{ left: `calc(${(marginSliderPct / 50) * 100}% - 7px)` }}
                        />
                        <input
                          type="range"
                          min={0}
                          max={50}
                          step={1}
                          value={marginSliderPct}
                          onChange={(e) => setMargin(e.target.value)}
                          disabled={isLocked}
                          className="absolute inset-0 h-7 w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                          aria-label="Profit margin"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={finalMarginNum}
                          onChange={(e) => setMargin(e.target.value)}
                          disabled={isLocked}
                          className="w-14 rounded-md border border-slate-300 bg-white px-2 py-1 text-right text-sm font-semibold tabular-nums text-slate-900 disabled:opacity-50"
                        />
                        <span className="text-xs text-slate-500">% margin</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(
                          [
                            { label: "15%", value: 15 },
                            { label: "20%", value: 20 },
                            { label: "25%", value: 25 },
                          ] as const
                        ).map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            disabled={isLocked}
                            onClick={() => setMargin(String(option.value))}
                            className={`rounded px-2 py-0.5 text-[10px] font-medium transition disabled:opacity-50 ${
                              finalMarginNum === option.value
                                ? "bg-sky-100 text-sky-800"
                                : "text-slate-500 hover:bg-slate-100"
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs leading-snug text-slate-500">
                      Direct pricing sets estimate total equal to job cost.
                    </p>
                  )}
                </div>
              </details>
            </aside>
          </div>
        </div>
      </div>
    );
  }



  return (
    <>
      {toast !== null && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed top-4 right-4 z-50 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600" aria-hidden>
            ✓
          </span>
          <span className="text-sm font-medium text-slate-800">{toast}</span>
        </motion.div>
      )}

      <FieldDiveAppShell
        activeNav={entryMode === "job-card" ? "jobs" : "newJob"}
        activeSubId={
          entryMode === "job-card"
            ? "job-card"
            : entryMode === "instant"
              ? "instant"
              : "packet"
        }
      >
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

        {entryMode === "manual" && legacyManual ? (
          renderLegacyEstimateWorkspace()
        ) : entryMode === "job-card" ? (
          renderJobCardShell()
        ) : (
          <div className="w-full min-w-0 max-w-[96rem]">
            {entryMode === "instant" ? (
              <div className="mb-4 rounded-lg border border-sky-100/80 bg-sky-50/70 px-4 py-3 text-sm text-slate-700">
                <span className="font-medium text-slate-900">Instant Estimate — coming soon.</span>
                {" "}
                Requires photos and a property address. Continue to Job Card when you&apos;re ready to measure and propose.
              </div>
            ) : null}
            {renderJobPacketWorkbench("standalone", entryMode === "instant" ? "instant" : "packet")}
          </div>
        )}
          </>
        )}
      </FieldDiveAppShell>
    </>
  );
}
