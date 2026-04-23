"use client";

import { useEffect, useRef, useState } from "react";
import { Ruler, Mountain, Trash2, Layers } from "lucide-react";

export type RoofingClientV2Props = {
  companyId?: string;
  companyName?: string;
  companyReplyEmail?: string;
  mode?: "standalone" | "embedded";
  viewModel?: {
    customer: {
      name: string;
      email: string;
      phone: string;
    };
    job: {
      address1: string;
      city: string;
      state: string;
      zip: string;
    };
    scope: {
      areaSqFtRaw: string;
      roofSize: string;
      pitch: string;
      tearOff: string;
      material: string;
    };
    control: {
      pricingMode: "markup" | "direct";
      tier: "standard" | "enhanced" | "premium";
      laborMode: string;
    };
    contractor: {
      finalPrice: number;
      jobCost: number;
      profit: number;
      margin: number | null;
    };
    proposal: {
      price: number;
      materials: number;
      labor: number;
      disposal: number;
    };
  };
  onPricingModeChange?: (mode: "markup" | "direct") => void;
  onProposalTierChange?: (tier: "standard" | "enhanced" | "premium") => void;
  marginValue?: number;
  onMarginChange?: (pct: number) => void;
  onTearOffChange?: (enabled: boolean) => void;
  onMaterialDensityChange?: (value: string) => void;
  onGuidedWalkabilityChange?: (value: "walkable" | "steep") => void;
  onPitchChange?: (value: "walkable" | "moderate" | "steep") => void;
  onAreaChange?: (value: string) => void;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  jobAddress1?: string;
  jobCity?: string;
  jobState?: string;
  jobZip?: string;
  onCustomerNameChange?: (value: string) => void;
  onCustomerEmailChange?: (value: string) => void;
  onCustomerPhoneChange?: (value: string) => void;
  onJobAddress1Change?: (value: string) => void;
  onJobAddress1Blur?: (value: string) => void;
  onJobCityChange?: (value: string) => void;
  onJobCityBlur?: (value: string) => void;
  onJobStateChange?: (value: string) => void;
  onJobStateBlur?: (value: string) => void;
  onJobZipChange?: (value: string) => void;
  onJobZipBlur?: () => void;
  onJobZipEnter?: () => void;
  onPreviewProposal?: () => void;
  onSaveEstimate?: () => void;
  canSaveEstimate?: boolean;
  isSavingEstimate?: boolean;
  onSendEstimate?: () => void;
  canSendEstimate?: boolean;
  isSendingEstimate?: boolean;
  wasteValue?: string;
  onWasteChange?: (value: string) => void;
  bundleCostValue?: string;
  onBundleCostChange?: (value: string) => void;
  dumpFeePerTonValue?: string;
  onDumpFeePerTonChange?: (value: string) => void;
  laborModeValue?: string;
  manualLaborTotalValue?: string;
  onManualLaborTotalChange?: (value: string) => void;
  onManualLaborTotalBlur?: () => void;
};

const presets = {
  standard: { cost: 9000, base: 12480 },
  larger: { cost: 11400, base: 15600 },
  complex: { cost: 10850, base: 16150 },
};

const tierAdjust = {
  core: 0,
  enhanced: 0,
  premium: 850,
};

const directOverride = {
  standard: 11950,
  larger: 14950,
  complex: 15495,
};

const scopeDisplayByPreset = {
  standard: {
    roofSize: "32 squares",
    pitch: "6/12 · Standard",
    tearOff: "Included",
    material: "Architectural shingles",
  },
  larger: {
    roofSize: "41 squares",
    pitch: "7/12 · Moderate",
    tearOff: "Included",
    material: "Architectural shingles",
  },
  complex: {
    roofSize: "35 squares",
    pitch: "10/12 · Steep",
    tearOff: "Included",
    material: "Impact-resistant shingles",
  },
} as const;

function tierToProposalTier(t: "standard" | "enhanced" | "premium"): "core" | "enhanced" | "premium" {
  return t === "standard" ? "core" : t === "enhanced" ? "enhanced" : "premium";
}

export default function RoofingClientV2({
  companyId = "",
  companyName: _companyName = "",
  companyReplyEmail: _companyReplyEmail = "",
  mode = "standalone",
  viewModel,
  onPricingModeChange,
  onProposalTierChange,
  marginValue,
  onMarginChange,
  onTearOffChange,
  onMaterialDensityChange,
  onGuidedWalkabilityChange,
  onPitchChange,
  onAreaChange,
  customerName,
  customerEmail,
  customerPhone,
  jobAddress1,
  jobCity,
  jobState,
  jobZip,
  onCustomerNameChange,
  onCustomerEmailChange,
  onCustomerPhoneChange,
  onJobAddress1Change,
  onJobAddress1Blur,
  onJobCityChange,
  onJobCityBlur,
  onJobStateChange,
  onJobStateBlur,
  onJobZipChange,
  onJobZipBlur,
  onJobZipEnter,
  onPreviewProposal,
  onSaveEstimate,
  canSaveEstimate,
  isSavingEstimate,
  onSendEstimate,
  canSendEstimate,
  isSendingEstimate,
  wasteValue,
  onWasteChange,
  bundleCostValue,
  onBundleCostChange,
  dumpFeePerTonValue,
  onDumpFeePerTonChange,
  laborModeValue: _laborModeValue,
  manualLaborTotalValue,
  onManualLaborTotalChange,
  onManualLaborTotalBlur,
}: RoofingClientV2Props) {
  const isEmbedded = mode === "embedded";
  const hasLive = viewModel != null;
  const isLive = hasLive;
  const intakeEditable = isLive;
  const controlPermissions = {
    pricingMode: isLive && typeof onPricingModeChange === "function",
    proposalTier: isLive && typeof onProposalTierChange === "function",
    scopeRoofSize: isLive && typeof onAreaChange === "function",
    scopePitch:
      isLive &&
      (typeof onGuidedWalkabilityChange === "function" || typeof onPitchChange === "function"),
    scopeTearOff: isLive && typeof onTearOffChange === "function",
    scopeMaterial: isLive && typeof onMaterialDensityChange === "function",
    intake: intakeEditable,
  };
  const anyScopeControlLive =
    controlPermissions.scopeRoofSize ||
    controlPermissions.scopePitch ||
    controlPermissions.scopeTearOff ||
    controlPermissions.scopeMaterial;
  const companyPreview = (companyId || "________").slice(0, 8);

  const [pricingMode, setPricingMode] = useState<"markup" | "direct">("markup");
  const [proposalTier, setProposalTier] = useState<"core" | "enhanced" | "premium">("enhanced");
  const [scopePreset, setScopePreset] = useState<"standard" | "larger" | "complex">("standard");
  const [activeScopeEditor, setActiveScopeEditor] = useState<null | "roofSize">(null);

  function money(v: number) {
    return "$" + v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function pct(v: number) {
    return v.toFixed(1) + "%";
  }

  const data = presets[scopePreset];

  const mockDealLaborAmount =
    scopePreset === "standard" ? 3150 : scopePreset === "larger" ? 4020 : 3780;

  const mockFinalPrice =
    pricingMode === "markup"
      ? data.base + tierAdjust[proposalTier]
      : directOverride[scopePreset] + tierAdjust[proposalTier];
  const mockCost = data.cost;
  const mockProfit = mockFinalPrice - mockCost;
  const mockMarginPct = mockFinalPrice > 0 ? (mockProfit / mockFinalPrice) * 100 : 0;

  const displayFinalPrice = hasLive ? viewModel!.proposal.price : mockFinalPrice;
  const displayJobCost = hasLive ? viewModel!.contractor.jobCost : mockCost;
  const displayProfit = hasLive ? viewModel!.contractor.profit : mockProfit;
  const displayMarginRatio = hasLive ? viewModel!.contractor.margin : null;

  // Step 04 margin signal bands. Anchor-first / calibrated:
  //   < 18%        → tight     (warning)
  //   18% – 24%    → balanced  (neutral; 20% must NOT read as a problem)
  //   24% – 32%    → strong    (positive)
  //   32%+         → premium   (elevated)
  const profitQuality =
    displayMarginRatio == null
      ? "unknown"
      : displayMarginRatio < 0.18
        ? "tight"
        : displayMarginRatio < 0.24
          ? "balanced"
          : displayMarginRatio < 0.32
            ? "strong"
            : "premium";

  const effectivePricingMode = hasLive ? viewModel!.control.pricingMode : pricingMode;
  const effectiveProposalTier = hasLive ? tierToProposalTier(viewModel!.control.tier) : proposalTier;

  const MARGIN_MIN = 10;
  const MARGIN_MAX = 60;
  const MARGIN_STEP = 1;

  const targetMarginPct =
    typeof marginValue === "number" ? Math.min(MARGIN_MAX, Math.max(MARGIN_MIN, marginValue)) : 28;

  const canEditMargin = effectivePricingMode === "markup" && typeof onMarginChange === "function";

  const liveMarginPct = displayMarginRatio != null ? displayMarginRatio * 100 : null;

  const shownMarginPct = effectivePricingMode === "markup" ? targetMarginPct : liveMarginPct;

  const marginColorClass =
    shownMarginPct != null && shownMarginPct >= 30
      ? "text-emerald-300/90"
      : shownMarginPct != null && shownMarginPct < 20
        ? "text-red-300/90"
        : "text-white";

  const MARGIN_TICKS = [15, 25, 35, 45];
  const marginFillPct = ((targetMarginPct - MARGIN_MIN) / (MARGIN_MAX - MARGIN_MIN)) * 100;

  const [costExpanded, setCostExpanded] = useState(false);
  const [priceDelta, setPriceDelta] = useState<number | null>(null);
  const prevPriceRef = useRef<number | null>(null);

  useEffect(() => {
    const prev = prevPriceRef.current;
    prevPriceRef.current = displayFinalPrice;
    if (prev == null || prev === displayFinalPrice) return;
    const delta = displayFinalPrice - prev;
    if (delta === 0) return;
    setPriceDelta(delta);
    const t = setTimeout(() => setPriceDelta(null), 1600);
    return () => clearTimeout(t);
  }, [displayFinalPrice]);

  const targetVsActualGap =
    effectivePricingMode === "markup" && liveMarginPct != null
      ? Math.abs(targetMarginPct - liveMarginPct)
      : null;
  const marginsDiverge = targetVsActualGap != null && targetVsActualGap >= 0.5;

  const proposalTierLabel =
    effectiveProposalTier === "core"
      ? "Standard homeowner proposal"
      : effectiveProposalTier === "enhanced"
        ? "Enhanced homeowner proposal"
        : "Premium homeowner proposal";

  const proposalTierSupport =
    effectiveProposalTier === "core"
      ? "Cost-efficient presentation"
      : effectiveProposalTier === "enhanced"
        ? "Balanced presentation"
        : "Premium presentation positioning";

  const proposalOutputClass =
    effectiveProposalTier === "core"
      ? "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.12] bg-white/[0.05] px-2.5 py-2 sm:px-3"
      : effectiveProposalTier === "enhanced"
        ? "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-cyan-400/20 bg-cyan-500/[0.08] px-2.5 py-2 sm:px-3"
        : "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-400/24 bg-emerald-500/[0.09] px-2.5 py-2 sm:px-3";

  const scopeDisp = scopeDisplayByPreset[scopePreset];
  const scopeLive = hasLive ? viewModel!.scope : null;
  const coalesceScopeField = (liveVal: string | undefined, presetVal: string) => {
    const t = (liveVal ?? "").trim();
    return t !== "" ? t : presetVal;
  };
  const effectiveScopeRoofSize = scopeLive
    ? coalesceScopeField(scopeLive.roofSize, scopeDisp.roofSize)
    : scopeDisp.roofSize;
  const effectiveScopePitch = scopeLive
    ? coalesceScopeField(scopeLive.pitch, scopeDisp.pitch)
    : scopeDisp.pitch;
  const effectiveScopeTearOff = scopeLive
    ? coalesceScopeField(scopeLive.tearOff, scopeDisp.tearOff)
    : scopeDisp.tearOff;
  const effectiveScopeMaterial = scopeLive
    ? coalesceScopeField(scopeLive.material, scopeDisp.material)
    : scopeDisp.material;

  const roofSizeCanAdjust = controlPermissions.scopeRoofSize;

  /** Numeric sq ft for Roof Size stepping from raw area state only. */
  const getCurrentRoofAreaSqFtForStepper = (): number => {
    const rawStr = (viewModel?.scope.areaSqFtRaw ?? "").trim().replace(/,/g, "");
    const n = Number.parseFloat(rawStr);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
  };

  const handleRoofSizeIncrease = () => {
    if (!roofSizeCanAdjust) return;
    const next = getCurrentRoofAreaSqFtForStepper() + 100;
    onAreaChange?.(String(next));
  };

  const handleRoofSizeDecrease = () => {
    if (!roofSizeCanAdjust) return;
    const next = Math.max(0, getCurrentRoofAreaSqFtForStepper() - 100);
    onAreaChange?.(String(next));
  };

  const materialDensityPresets = [
    { value: "3", label: "3 bundles/sq" },
    { value: "3.5", label: "3.5 bundles/sq" },
    { value: "4", label: "4 bundles/sq" },
  ] as const;
  const getNextMaterialDensityValue = (currentDisplay: string) => {
    const normalized = currentDisplay.toLowerCase().trim();
    const parsed = Number.parseFloat(normalized);
    const currentIndex = materialDensityPresets.findIndex((p) => {
      const presetNum = Number.parseFloat(p.value);
      return Number.isFinite(parsed) && Number.isFinite(presetNum) && parsed === presetNum;
    });
    if (currentIndex === -1) return materialDensityPresets[0].value;
    return materialDensityPresets[(currentIndex + 1) % materialDensityPresets.length].value;
  };
  const getMaterialCoverageLabel = (currentDisplay: string) => {
    const parsed = Number.parseFloat(currentDisplay.trim().toLowerCase());
    if (!Number.isFinite(parsed)) return "Standard roof";
    if (parsed >= 4) return "High waste roof";
    if (parsed >= 3.5) return "Complex roof";
    return "Standard roof";
  };
  const pitchDisplayCycle = ["Walkable", "Moderate", "Steep"] as const;
  const getNextPitchDisplayValue = (currentDisplay: string) => {
    const normalized = currentDisplay.trim().toLowerCase();
    const currentIndex = pitchDisplayCycle.findIndex(
      (label) => label.toLowerCase() === normalized
    );
    if (currentIndex === -1) return pitchDisplayCycle[0];
    return pitchDisplayCycle[(currentIndex + 1) % pitchDisplayCycle.length];
  };
  const mapPitchDisplayToPitchKey = (
    display: string
  ): "walkable" | "moderate" | "steep" => {
    const normalized = display.toLowerCase();
    if (normalized === "walkable") return "walkable";
    if (normalized === "moderate") return "moderate";
    return "steep";
  };
  const tearOffIsIncluded =
    effectiveScopeTearOff.toLowerCase().trim() === "included";
  const outcomeScopeSummary = `${effectiveScopeRoofSize} · ${effectiveScopePitch} · ${effectiveScopeMaterial}`;

  const squaresNum = (() => {
    const m = String(effectiveScopeRoofSize).match(/[\d.]+/);
    const n = m ? Number.parseFloat(m[0]) : NaN;
    return Number.isFinite(n) && n > 0 ? n : 0;
  })();
  const pricePerSquare =
    squaresNum > 0 && displayFinalPrice > 0
      ? Math.round(displayFinalPrice / squaresNum)
      : null;

  const laborCostNum = (() => {
    const raw = String(manualLaborTotalValue ?? "").replace(/,/g, "").trim();
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  })();
  const remainderCostNum = Math.max(0, displayJobCost - laborCostNum);
  const canShowCostBreakdown = laborCostNum > 0 && displayJobCost > 0;

  const dumpFeeNum = (() => {
    const raw = String(dumpFeePerTonValue ?? "").replace(/,/g, "").trim();
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  })();

  const scrollToId = (id: string, focusInput = false) => {
    if (typeof document === "undefined") return;
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    if (focusInput) {
      setTimeout(() => {
        try {
          (el as HTMLInputElement).focus({ preventScroll: true });
        } catch {
          /* noop */
        }
      }, 280);
    }
  };

  const intakeMissingFields: string[] = [];
  const _auditName = (intakeEditable ? customerName : viewModel?.customer.name) ?? "";
  const _auditEmail = (intakeEditable ? customerEmail : viewModel?.customer.email) ?? "";
  const _auditZip = (intakeEditable ? jobZip : viewModel?.job.zip) ?? "";
  if (!_auditName.trim()) intakeMissingFields.push("name");
  if (!_auditEmail.trim()) intakeMissingFields.push("email");
  if (!_auditZip.trim()) intakeMissingFields.push("ZIP");

  type AuditRow = {
    key: string;
    status: "ok" | "warn" | "info";
    label: string;
    onClick?: () => void;
  };

  const auditRows: AuditRow[] = [];

  auditRows.push(
    intakeMissingFields.length === 0
      ? { key: "intake", status: "ok", label: "Customer info complete" }
      : {
          key: "intake",
          status: "warn",
          label: `Customer info missing — ${intakeMissingFields.join(", ")}`,
          onClick: () => scrollToId("v2-step-01"),
        }
  );

  auditRows.push(
    laborCostNum > 0
      ? { key: "labor", status: "ok", label: "Labor cost recorded" }
      : {
          key: "labor",
          status: "warn",
          label: "Labor cost missing — affects margin",
          onClick: () => scrollToId("v2-pricing-labor-cost", true),
        }
  );

  if (tearOffIsIncluded) {
    auditRows.push(
      dumpFeeNum > 0
        ? { key: "disposal", status: "ok", label: "Tear-off + disposal rate set" }
        : {
            key: "disposal",
            status: "warn",
            label: "Disposal rate missing — required for tear-off",
            onClick: () => scrollToId("v2-pricing-dump", true),
          }
    );
  } else {
    auditRows.push({ key: "disposal", status: "info", label: "Tear-off not included" });
  }

  auditRows.push({
    key: "pitch",
    status: "info",
    label: `Pitch posture · ${effectiveScopePitch}`,
  });

  if (effectivePricingMode === "markup") {
    auditRows.push(
      marginsDiverge
        ? {
            key: "margin",
            status: "warn",
            label: `Target ${pct(targetMarginPct)} vs actual ${liveMarginPct != null ? pct(liveMarginPct) : "—"}`,
          }
        : { key: "margin", status: "ok", label: "Target margin matches actual" }
    );
  } else {
    auditRows.push({
      key: "margin",
      status: "info",
      label: `Direct pricing · margin ${liveMarginPct != null ? pct(liveMarginPct) : "—"}`,
    });
  }

  const auditWarnCount = auditRows.filter((r) => r.status === "warn").length;

  // ===== OFFER STRATEGY (Step 05) — DEAL-STATE ENGINE ==============
  // Deterministic, classifier-driven strategy engine. It first classifies
  // the deal across six independent dimensions (margin regime, complexity,
  // price posture, positioning strength, close sensitivity, risk), then
  // selects a triple of strategy archetypes for Value / Standard / Premium,
  // shapes the spreads based on deal context, applies hard rails, and
  // post-processes to eliminate trivial or incoherent moves.
  //
  // HARD CONTRACT:
  //  - Never mutates cost, scope, labor, dump fees, squares, pitch, or any
  //    other "truth" input. It only proposes a target margin (markup mode)
  //    and/or a proposal tier upgrade via existing handlers.
  //  - Deterministic: same inputs → same outputs. No randomness.
  //  - Safe: Value never crosses the global floor; Premium never exceeds
  //    the global ceiling; price moves never exceed ±10% of the anchor.

  // --- Consumer-facing types (UI contract, unchanged) --------------
  type OfferRegime = "low" | "balanced" | "high";
  type OfferCardKey = "value" | "standard" | "premium";
  type OfferMode = "margin" | "tier-positioning" | "hold";

  type ComputedOfferCard = {
    key: OfferCardKey;
    mode: OfferMode;
    regime: OfferRegime;
    tag: string;
    positioning: string;
    tagline: string;
    marginPct: number;
    price: number;
    delta: number;
    deltaPct: number;
    tierAfter: "core" | "enhanced" | "premium";
    canApply: boolean;
    recommended: boolean;
  };

  type AppliedOffer = {
    key: OfferCardKey;
    mode: OfferMode;
    regimeAtApply: OfferRegime;
    targetMarginPct: number;
    anchorPriceAtApply: number;
    anchorCostAtApply: number;
    tierAtApply: "core" | "enhanced" | "premium";
    appliedAt: number;
    // Scope/cost truth signature at the moment of apply. Used to detect
    // real input drift (stale state) independently of the strategy lock.
    signatureAtApply: string | null;
  };

  // --- Classifier dimensions ---------------------------------------
  // Estimate intent — the contractor's pricing stance as read directly
  // from the current margin. The authoritative selection driver for
  // Step 05: we respect the estimate as intentional and choose realistic
  // strategic plays around it instead of correcting it toward a
  // computed "fair" target.
  type EstimateIntent =
    | "aggressive-close"
    | "competitive-close"
    | "balanced"
    | "strong"
    | "premium";
  type ComplexityTier = "commodity" | "moderate" | "complex" | "extreme";
  type PositioningStrength = "weak" | "moderate" | "strong";
  type CloseSensitivity =
    | "price-sensitive"
    | "balanced"
    | "positioning-sensitive";

  // The 7 authoritative strategy types. The engine selects a triple from
  // this set per deal; STANDARD is always "hold-the-line".
  type StrategyType =
    | "close-harder"
    | "close-slightly"
    | "hold-the-line"
    | "hold-firmly"
    | "lift-meaningfully"
    | "lift-slightly"
    | "present-stronger";

  type DealClassification = {
    marginPct: number;
    estimateIntent: EstimateIntent;
    complexity: ComplexityTier;
    complexityScore: number;
    positioning: PositioningStrength;
    closeSensitivity: CloseSensitivity;
    materialIsImpact: boolean;
    laborBurdenPct: number | null;
  };

  type SpreadShapers = { valueWidth: number; premiumWidth: number };

  // --- Rails, constants, helpers -----------------------------------
  const OFFER_VALUE_FLOOR_PCT = 15;
  const OFFER_MARGIN_CEILING_PCT = 40;
  const OFFER_MAX_PRICE_DROP = 0.1;
  const OFFER_MAX_PRICE_BUMP = 0.1;

  const priceFromMarginPct = (cost: number, mPct: number): number => {
    const m = Math.max(0, Math.min(mPct, 95)) / 100;
    if (m >= 1) return cost;
    return Math.round(cost / (1 - m));
  };
  const marginPctFromPrice = (cost: number, price: number): number => {
    if (price <= 0) return 0;
    return ((price - cost) / price) * 100;
  };
  const clampRange = (v: number, lo: number, hi: number): number =>
    Math.max(lo, Math.min(hi, v));

  // "True protection" gate — the only condition under which VALUE is
  // hard-forced into Protect at selection time. Decoupled from
  // classifier.risk (which stays diagnostic) so that merely
  // elevated-risk balanced 18–24% jobs aren't stripped of a real
  // Value option.
  //
  // Selection-protection criteria (authoritative, strict):
  //   1. current margin < 18           — absolutely thin margin
  //   2. complexity === "extreme"      — genuinely extreme scope
  //   3. labor burden > 0.50           — heavy labor exposure
  //
  // Complexity alone CANNOT force Protect. Earlier revisions combined
  // (complex/extreme) + (posture === "under-priced") as a fourth
  // trigger, but "under-priced" is RELATIVE to the complexity-fair
  // target (22 / 26 / 30 / 34). A 20% margin on a job the classifier
  // scores as "complex" reads as "under-priced" relative to its 30%
  // fair target even though 20% is absolutely healthy — and routine
  // tear-offs with moderate pitch + labor > 0.4 can score "complex"
  // (3.0). That combo therefore over-fired Protect on balanced
  // realistic jobs. Corroborating it with a margin < 18 clause would
  // simply duplicate rule 1, so the combo is removed outright and
  // the absolute-margin rule owns all protection responsibility in
  // its own zone.
  const needsTrueProtection = (c: DealClassification): boolean =>
    c.marginPct < 18 ||
    c.complexity === "extreme" ||
    (c.laborBurdenPct ?? 0) > 0.6;

  // --- Availability gate -------------------------------------------
  const offerAvailable =
    displayMarginRatio != null && displayJobCost > 0 && displayFinalPrice > 0;
  const currentMarginPctForOffer = offerAvailable
    ? (displayMarginRatio as number) * 100
    : null;

  // --- Classifier ---------------------------------------------------
  // Respects the contractor's estimate as intentional. Derives an
  // estimate-intent band from the absolute margin and keeps only the
  // complexity / positioning / close-sensitivity / labor signals that
  // remain useful under the new selection model. Posture, margin-
  // regime bands, deal archetypes, and risk profiles were removed with
  // the deal-state engine — selection is now intent-driven and protection
  // is a strict absolute gate (see needsTrueProtection).
  const classifyDeal = (): DealClassification | null => {
    if (!offerAvailable || currentMarginPctForOffer == null) return null;
    const marginPct = currentMarginPctForOffer;

    // D1 · Estimate intent (5 bands, absolute margin)
    const estimateIntent: EstimateIntent =
      marginPct < 18
        ? "aggressive-close"
        : marginPct < 22
          ? "competitive-close"
          : marginPct < 28
            ? "balanced"
            : marginPct < 32
              ? "strong"
              : "premium";

    // Auxiliary signals
    const materialIsImpact = String(effectiveScopeMaterial)
      .toLowerCase()
      .includes("impact");
    const laborBurdenPct =
      hasLive && displayJobCost > 0
        ? (viewModel!.proposal.labor + viewModel!.proposal.disposal) /
          displayJobCost
        : null;
    const pitchKey = mapPitchDisplayToPitchKey(effectiveScopePitch);

    // D2 · Complexity tier
    const complexityScore =
      (squaresNum >= 40 ? 1 : 0) +
      (pitchKey === "steep" ? 1 : pitchKey === "moderate" ? 0.5 : 0) +
      (tearOffIsIncluded ? 1 : 0) +
      (materialIsImpact ? 1 : 0) +
      ((laborBurdenPct ?? 0) > 0.4 ? 0.5 : 0);
    const complexity: ComplexityTier =
      complexityScore <= 1
        ? "commodity"
        : complexityScore <= 2.5
          ? "moderate"
          : complexityScore <= 4
            ? "complex"
            : "extreme";

    // D3 · Positioning strength
    const isComplex = complexity === "complex" || complexity === "extreme";
    const positioning: PositioningStrength =
      effectiveProposalTier === "core" && complexity === "commodity"
        ? "weak"
        : effectiveProposalTier === "premium" ||
            (effectiveProposalTier === "enhanced" && isComplex) ||
            materialIsImpact
          ? "strong"
          : "moderate";

    // D4 · Close sensitivity
    const closeSensitivity: CloseSensitivity =
      isComplex ||
      effectiveProposalTier === "premium" ||
      materialIsImpact
        ? "positioning-sensitive"
        : effectiveProposalTier === "core" &&
            (complexity === "commodity" || complexity === "moderate")
          ? "price-sensitive"
          : "balanced";

    return {
      marginPct,
      estimateIntent,
      complexity,
      complexityScore,
      positioning,
      closeSensitivity,
      materialIsImpact,
      laborBurdenPct,
    };
  };

  // --- Decision intelligence layer ---------------------------------
  // Deterministic, weighted scoring over the classification. Three
  // scalar scores drive selection — closePotential (VALUE-side room +
  // appetite), liftPotential (PREMIUM-side money move justification),
  // and upgradePotential (same-price tier move runway, hard-gated on
  // tierHeadroom). Every signal is integer arithmetic; same inputs
  // always produce the same scores. Intent bands remain as inputs,
  // not as direct selectors.
  type DecisionScores = {
    closePotential: number;
    liftPotential: number;
    upgradePotential: number;
  };

  const computeDecisionScores = (c: DealClassification): DecisionScores => {
    const tierHeadroom = effectiveProposalTier !== "premium";
    const labor = c.laborBurdenPct ?? 0;

    // ---- Close Potential (VALUE-side) ----
    let closePotential = 0;
    // Margin headroom
    if (c.marginPct >= 30) closePotential += 4;
    else if (c.marginPct >= 24) closePotential += 3;
    else if (c.marginPct >= 20) closePotential += 2;
    else if (c.marginPct >= 18) closePotential += 1;
    // Complexity
    if (c.complexity === "commodity") closePotential += 2;
    else if (c.complexity === "moderate") closePotential += 1;
    else if (c.complexity === "extreme") closePotential -= 1;
    // Labor burden (cost-structure pressure)
    if (labor >= 0.55) closePotential -= 1;
    // Customer close sensitivity
    if (c.closeSensitivity === "price-sensitive") closePotential += 1;
    else if (c.closeSensitivity === "positioning-sensitive") closePotential -= 1;
    // Positioning strength
    if (c.positioning === "strong") closePotential -= 1;
    // Size corroborator
    if (squaresNum >= 40) closePotential += 1;

    // ---- Lift Potential (PREMIUM-side, money move) ----
    let liftPotential = 0;
    if (c.marginPct < 20) liftPotential += 4;
    else if (c.marginPct < 24) liftPotential += 3;
    else if (c.marginPct < 28) liftPotential += 2;
    else if (c.marginPct < 32) liftPotential += 1;
    if (c.complexity === "complex") liftPotential += 2;
    else if (c.complexity === "extreme") liftPotential += 3;
    else if (c.complexity === "moderate") liftPotential += 1;
    if (labor >= 0.5) liftPotential += 1;
    if (c.materialIsImpact) liftPotential += 1;
    if (effectiveProposalTier === "premium") liftPotential -= 1;
    if (c.positioning === "strong") liftPotential -= 1;

    // ---- Upgrade Potential (PREMIUM-side, tier move) ----
    // Hard gate: no tier headroom → score stays at 0.
    let upgradePotential = 0;
    if (tierHeadroom) {
      if (c.marginPct >= 28) upgradePotential += 2;
      else if (c.marginPct >= 22) upgradePotential += 1;
      // Under 22% contributes 0 — tier bump feels weak at thin margin.
      if (c.complexity === "complex" || c.complexity === "extreme")
        upgradePotential += 2;
      if (c.materialIsImpact) upgradePotential += 2;
      if (c.positioning === "strong") upgradePotential += 1;
      if (c.closeSensitivity === "positioning-sensitive") upgradePotential += 1;
      else if (c.closeSensitivity === "price-sensitive") upgradePotential -= 1;
    }

    return { closePotential, liftPotential, upgradePotential };
  };

  // --- Strategy triple selection -----------------------------------
  // Score-driven: computeDecisionScores(c) produces three scalars,
  // and each slot runs a priority cascade over them with hard gates
  // (protection, tier headroom, margin bands for lift-meaningfully).
  // Intent bands survive as copy context in computeCardForStrategy's
  // holdContext resolver; they do not drive selection here.
  const selectStrategyTriple = (
    c: DealClassification
  ): {
    value: StrategyType;
    standard: StrategyType;
    premium: StrategyType;
  } => {
    const isCommodityish =
      c.complexity === "commodity" || c.complexity === "moderate";
    const isComplex = c.complexity === "complex" || c.complexity === "extreme";
    const tierHeadroom = effectiveProposalTier !== "premium";
    const labor = c.laborBurdenPct ?? 0;
    const scores = computeDecisionScores(c);

    // --- VALUE slot -------------------------------------------------
    // 1) Absolute-risk override → Hold firmly
    // 2) High close score + margin/complexity/labor gates → Close harder
    // 3) Credible close score → Close slightly
    // 4) Otherwise → Hold the line (contextual copy)
    let value: StrategyType;
    if (needsTrueProtection(c)) {
      value = "hold-firmly";
    } else if (
      scores.closePotential >= 6 &&
      c.marginPct >= 28 &&
      isCommodityish &&
      labor < 0.5
    ) {
      value = "close-harder";
    } else if (scores.closePotential >= 3) {
      value = "close-slightly";
    } else {
      value = "hold-the-line";
    }

    // --- STANDARD slot (non-negotiable anchor) ---------------------
    const standard: StrategyType = "hold-the-line";

    // --- PREMIUM slot ----------------------------------------------
    // 1) Meaningful-lift gates (under-priced complex work) → Lift meaningfully
    // 2) Upgrade dominates Lift → Present stronger
    // 3) Any lift room → Lift slightly
    // 4) Upgrade fallback (lift has no room, tier does) → Present stronger
    // 5) Otherwise → Hold the line (contextual copy)
    let premium: StrategyType;
    if (
      scores.liftPotential >= 5 &&
      c.marginPct < 24 &&
      isComplex
    ) {
      premium = "lift-meaningfully";
    } else if (
      scores.upgradePotential >= 4 &&
      scores.upgradePotential > scores.liftPotential &&
      tierHeadroom
    ) {
      premium = "present-stronger";
    } else if (scores.liftPotential >= 1) {
      premium = "lift-slightly";
    } else if (scores.upgradePotential >= 2 && tierHeadroom) {
      premium = "present-stronger";
    } else {
      premium = "hold-the-line";
    }

    return { value, standard, premium };
  };

  // --- Decision validation layer -----------------------------------
  // Second-stage adequacy / realism check that runs AFTER score-based
  // selection. selectStrategyTriple answers "which direction?"; this
  // layer answers "is that move strong and honest enough for this
  // job?". Classifies the deal into one of three deterministic
  // decision categories and applies an escalation table primarily to
  // the PREMIUM slot. VALUE validation is near no-op by design —
  // needsTrueProtection + the closePotential cascade already handle
  // VALUE-side honesty. The recurring failure this layer targets is:
  // correction-case job selected only a cosmetic lift.
  //
  // Priority: correction > presentation > optimization (first match).
  // Direction: escalation-only under correction; swaps at the 28%
  // lift/upgrade seam; no downgrades of healthy selections.
  type DecisionCase = {
    category: "correction" | "presentation" | "optimization";
    deep: boolean;
  };

  const classifyDecisionCase = (
    c: DealClassification,
    scores: DecisionScores
  ): DecisionCase => {
    const labor = c.laborBurdenPct ?? 0;
    const isComplex = c.complexity === "complex" || c.complexity === "extreme";
    const tierHeadroom = effectiveProposalTier !== "premium";

    // Correction rules (any match fires).
    const deepAbsolute = c.marginPct < 18;
    const correctionFires =
      deepAbsolute ||
      c.marginPct < 20 ||
      (c.marginPct < 22 && isComplex) ||
      (c.marginPct < 24 && labor > 0.5) ||
      (c.marginPct < 26 && c.complexity === "extreme") ||
      (c.marginPct < 22 &&
        c.materialIsImpact &&
        (tearOffIsIncluded || c.complexity !== "commodity"));

    if (correctionFires) {
      const deep =
        deepAbsolute || (c.marginPct < 22 && (isComplex || labor > 0.5));
      return { category: "correction", deep };
    }

    // Presentation rules — hard form (margin ≥ 32 with tier room) or
    // soft form (margin ≥ 28 with substance behind the upgrade story).
    const hardPresentation = c.marginPct >= 32 && tierHeadroom;
    const softPresentation =
      c.marginPct >= 28 &&
      tierHeadroom &&
      scores.upgradePotential >= 4 &&
      (isComplex ||
        c.materialIsImpact ||
        c.closeSensitivity === "positioning-sensitive");

    if (hardPresentation || softPresentation) {
      return { category: "presentation", deep: false };
    }

    return { category: "optimization", deep: false };
  };

  // Compelling-reason gate for PREMIUM-side lifts. Deterministic
  // disjunction over existing classification signals + the active
  // decisionCase. Sibling of needsTrueProtection in intent (a hard
  // gate over the raw selection) and kept separate from scoring so
  // it can be reasoned about in isolation.
  //
  // A lift is compelling when ANY of:
  //   R1  decisionCase.category === "correction"
  //       (classifier has already established the estimate is thin
  //        for scope)
  //   R2  c.marginPct < 28
  //       (pre-restraint zone — balanced / competitive-close band;
  //        respects contractor intent, no second-guessing)
  //   R3  scope substance:
  //        - complexity === "extreme", or
  //        - complexity === "complex" AND
  //            (labor > 0.45 OR impact OR tearOff), or
  //        - labor > 0.55
  //       (the scope itself carries the lift story at strong margin)
  //
  // Complex alone with no corroborator does NOT qualify — by the time
  // complexityScore reaches "complex" it has almost always folded in
  // a corroborator; the pure synthetic case is rare and shouldn't be
  // rewarded with a price push at 30%+.
  const isLiftCompelling = (
    c: DealClassification,
    decisionCase: DecisionCase
  ): boolean => {
    if (decisionCase.category === "correction") return true;
    if (c.marginPct < 28) return true;
    const labor = c.laborBurdenPct ?? 0;
    if (c.complexity === "extreme") return true;
    if (
      c.complexity === "complex" &&
      (labor > 0.45 || c.materialIsImpact || tearOffIsIncluded)
    ) {
      return true;
    }
    if (labor > 0.55) return true;
    return false;
  };

  // Post-selection adequacy transform. Returns a final triple ready
  // for card computation. Pure — no side effects, integer-band logic.
  const validateSelectedStrategies = (
    raw: { value: StrategyType; standard: StrategyType; premium: StrategyType },
    c: DealClassification,
    scores: DecisionScores
  ): { value: StrategyType; standard: StrategyType; premium: StrategyType } => {
    const decisionCase = classifyDecisionCase(c, scores);
    const labor = c.laborBurdenPct ?? 0;
    const isComplex = c.complexity === "complex" || c.complexity === "extreme";
    const tierHeadroom = effectiveProposalTier !== "premium";

    // Simple-scope carve-out for deep correction at thin margin on
    // structurally simple work (commodity, low labor, no impact, no
    // tearOff). A meaningful-lift claim lacks substance here; the
    // honest move is a strong-magnitude slight lift instead.
    const simpleScopeCarveOut =
      c.complexity === "commodity" &&
      labor < 0.45 &&
      !c.materialIsImpact &&
      !tearOffIsIncluded;

    // --- VALUE validation (intentionally minimal) ------------------
    // needsTrueProtection + the closePotential cascade already enforce
    // VALUE-side honesty. The only defensive rule here guards against
    // a close-slightly move that the scoring couldn't make meaningful.
    let value: StrategyType = raw.value;
    if (value === "close-slightly" && scores.closePotential < 3) {
      value = "hold-the-line";
    }

    // --- STANDARD (non-negotiable anchor) --------------------------
    const standard: StrategyType = raw.standard;

    // --- PREMIUM validation (the real work) ------------------------
    let premium: StrategyType = raw.premium;

    if (decisionCase.category === "correction") {
      if (decisionCase.deep) {
        // Deep correction (margin < 18 or margin < 22 with complexity /
        // labor corroboration). Every non-meaningful move escalates.
        if (premium === "lift-slightly") {
          premium = simpleScopeCarveOut
            ? "lift-slightly"
            : "lift-meaningfully";
        } else if (premium === "present-stronger") {
          premium = "lift-meaningfully";
        } else if (premium === "hold-the-line") {
          premium = "lift-meaningfully";
        }
        // lift-meaningfully / lift-firmly / close-* not applicable on PREMIUM.
      } else {
        // Shallow correction — escalate only when scope corroborates
        // the under-pricing story. Otherwise leave a realistic small lift.
        const corroborated = isComplex || labor > 0.5 || c.materialIsImpact;
        if (premium === "lift-slightly") {
          if (corroborated) premium = "lift-meaningfully";
        } else if (premium === "present-stronger") {
          premium =
            isComplex || labor > 0.5 ? "lift-meaningfully" : "lift-slightly";
        } else if (premium === "hold-the-line") {
          premium =
            isComplex || labor > 0.5 ? "lift-meaningfully" : "lift-slightly";
        }
      }
    } else if (decisionCase.category === "presentation") {
      // Prefer same-price tier move when its substance clearly
      // dominates and tier has room. Never force a downgrade from an
      // already-correct lift selection unless upgrade truly wins.
      if (premium === "lift-slightly") {
        if (
          scores.upgradePotential > scores.liftPotential + 1 &&
          c.marginPct >= 28 &&
          tierHeadroom
        ) {
          premium = "present-stronger";
        }
      } else if (premium === "hold-the-line") {
        if (tierHeadroom && scores.upgradePotential >= 2) {
          premium = "present-stronger";
        }
      }
      // present-stronger / lift-meaningfully — keep.
    } else {
      // Optimization — trust scoring. Only defensive swap: a
      // present-stronger selected below the 28% seam violates the
      // anti-duplicate invariant. Swap to a real dollar lift.
      if (premium === "present-stronger" && c.marginPct < 28) {
        premium = "lift-slightly";
      }
    }

    // --- Compelling-reason lift gate -------------------------------
    // Reframes the engine's question from "is there room to lift?"
    // to "is there a compelling reason to lift?". A lift survives
    // only when isLiftCompelling(c, decisionCase) returns true AND
    // the margin band allows the magnitude:
    //   - lift-slightly blocked at margin ≥ 32 (premium-margin band;
    //     dollar bump reads as greedy)
    //   - lift-meaningfully blocked at margin ≥ 28 (not honest at
    //     strong margin; safety net — selection shouldn't produce
    //     this here, correction pathways might)
    // When the gate rejects, route to present-stronger if there is
    // tier room and any upgrade story, otherwise to an honest hold.
    // Supersedes the narrower strong-positioning override: catches
    // lift-meaningfully at strong margin and lift-slightly at
    // premium-margin in addition to everything the prior rule caught.
    if (premium === "lift-slightly" || premium === "lift-meaningfully") {
      let allowed = isLiftCompelling(c, decisionCase);
      if (premium === "lift-slightly" && c.marginPct >= 32) allowed = false;
      if (premium === "lift-meaningfully" && c.marginPct >= 28) allowed = false;

      if (!allowed) {
        if (tierHeadroom && scores.upgradePotential >= 2) {
          premium = "present-stronger";
        } else {
          premium = "hold-the-line";
        }
      }
    }

    // --- Belt-and-suspenders ---------------------------------------
    // When VALUE is hold-firmly (protection fired), PREMIUM must carry
    // a credible corrective lift — never just a cosmetic dusting.
    if (value === "hold-firmly" && premium === "lift-slightly") {
      premium = "lift-meaningfully";
    }

    return { value, standard, premium };
  };

  // --- Spread shapers (anchor-relative) ----------------------------
  // valueWidth  = margin points to drop from current (bounded [1.5, 3.0])
  // premiumWidth = margin points to lift from current (bounded [0, 6])
  // Shape depends on complexity, labor burden, size, tier, and
  // positioning. Posture-based shaping was removed with the deal-state
  // engine; the anchor is the only baseline.
  const computeSpreadShapers = (c: DealClassification): SpreadShapers => {
    // VALUE drop (below current margin)
    let sValue = 2.0;
    if (c.complexity === "commodity") sValue += 0.5;
    if (c.complexity === "complex") sValue -= 0.5;
    if (c.complexity === "extreme") sValue -= 1.0;
    if (c.positioning === "strong") sValue -= 0.25;
    if ((c.laborBurdenPct ?? 0) > 0.45) sValue -= 0.5;
    if (squaresNum >= 40) sValue += 0.25;

    // PREMIUM lift (above current margin)
    let sPremium = 3.0;
    if (c.complexity === "complex") sPremium -= 0.5;
    if (c.complexity === "extreme") sPremium -= 1.0;
    if (effectiveProposalTier === "premium") sPremium -= 1.0;
    if (c.positioning === "strong") sPremium -= 0.5;

    return {
      valueWidth: clampRange(sValue, 1.5, 3.0),
      premiumWidth: clampRange(sPremium, 0, 6),
    };
  };

  // --- Label resolver (strategy → display copy) -------------------
  // Slot-aware and context-aware: HOLD THE LINE reads as "Already
  // competitive" in VALUE on aggressive/competitive-close intent and
  // "Hold premium" / "Already well-positioned" in PREMIUM on
  // strong/premium intent. Standard always shows the fixed anchor copy.
  type HoldContext =
    | "generic"
    | "already-competitive"
    | "already-well-positioned"
    | "risk";
  const labelForStrategy = (
    slot: OfferCardKey,
    strategy: StrategyType,
    clamped: boolean,
    holdContext: HoldContext
  ): { tag: string; positioning: string; tagline: string } => {
    const tag =
      slot === "value"
        ? "Value"
        : slot === "premium"
          ? "Premium"
          : "Standard";

    if (slot === "standard") {
      return {
        tag,
        positioning: "Current estimate",
        tagline: "Your anchor — could be stronger.",
      };
    }

    switch (strategy) {
      case "hold-firmly":
        return {
          tag,
          positioning: "Hold firmly",
          tagline: "Discounting is unsafe on this scope.",
        };
      case "hold-the-line":
        if (slot === "value") {
          if (holdContext === "already-competitive") {
            return {
              tag,
              positioning: "Already competitive",
              tagline:
                "Your estimate is the close — no further room without risking margin.",
            };
          }
          return {
            tag,
            positioning: "Hold",
            tagline: "No meaningful close available here.",
          };
        }
        if (holdContext === "already-well-positioned") {
          return {
            tag,
            positioning: "Hold premium",
            tagline: "Already well-positioned — no credible lift from here.",
          };
        }
        return {
          tag,
          positioning: "Hold",
          tagline: "No meaningful lift available here.",
        };
      case "close-harder":
        return {
          tag,
          positioning: clamped ? "Close harder (rail-capped)" : "Close harder",
          tagline: clamped
            ? "10% rail capped this move."
            : "Room to drop without hurting margin.",
        };
      case "close-slightly":
        return {
          tag,
          positioning: clamped ? "Close (rail-capped)" : "Close",
          tagline: clamped
            ? "10% rail capped this move."
            : "Sharper price without undercutting the job.",
        };
      case "lift-meaningfully":
        return {
          tag,
          positioning: clamped ? "Lift (partial)" : "Lift meaningfully",
          tagline: clamped
            ? "Partial lift — 10% rail capped this move."
            : "Room to lift — this job is under-priced for the scope.",
        };
      case "lift-slightly":
        return {
          tag,
          positioning: clamped ? "Lift (rail-capped)" : "Lift",
          tagline: clamped
            ? "10% rail capped this move."
            : "Small lift — margin has room to grow.",
        };
      case "present-stronger":
        return {
          tag,
          positioning: "Upgrade the proposal",
          tagline: "Same price — premium proposal tier.",
        };
    }
  };

  // --- Structured explanation layer --------------------------------
  // Reason-anchored template lookup with priority cascade. Drives the
  // per-card tagline. labelForStrategy keeps ownership of the tag and
  // positioning label; this layer owns ONLY the explanation sentence.
  //
  // Model:
  //   1) Closed set of reason atoms — pure predicates over existing
  //      DealClassification / DecisionScores / DecisionCase / HoldContext
  //      fields plus closure-captured scope signals (tearOff, size, tier).
  //   2) Per-strategy priority cascade — first matching condition wins,
  //      deterministic ordering from most specific to most general.
  //   3) Strategy defaults for cascade miss; dedicated clamp sentences
  //      short-circuit the cascade entirely.
  //
  // Variation comes from signal diversity across real jobs — two jobs
  // with different dominant reasons naturally render different copy.
  // No randomness, no LLM, no async.
  // Magnitude band type + resolver. Shared by the 4 price-move
  // strategies (close-harder, close-slightly, lift-slightly,
  // lift-meaningfully). Pure, no closure deps, no randomness.
  // Fallback chains let cascade leaves be full, partial, or string,
  // so we only author variant copy where magnitude actually matters.
  //
  // v8 language layer — each band may now be either a single string
  // (legacy) or an array of 2–3 human-authored variants. Variant
  // selection is deterministic via stableHash() at the call site, so
  // the same job always renders the same sentence while similar jobs
  // cycle through the authored variant bank.
  type MagnitudeBand = "micro" | "light" | "moderate" | "strong";
  type MagnitudeVariants = string | string[];
  /** Bounded composable slots — composed only via fixed patterns (P1–P4). */
  type ComposablePatternId = "p1" | "p2" | "p3" | "p4";
  type ExplanationComposable = {
    readonly move: readonly string[];
    readonly anchor: readonly string[];
    readonly observation: readonly string[];
    readonly softener: readonly string[];
    readonly patterns?: readonly ComposablePatternId[];
  };
  type MagnitudeBandValue = MagnitudeVariants | ExplanationComposable;
  type MagnitudeLeaf =
    | MagnitudeBandValue
    | Partial<Record<MagnitudeBand, MagnitudeBandValue>>;

  const isExplanationComposable = (v: unknown): v is ExplanationComposable =>
    typeof v === "object" &&
    v !== null &&
    Array.isArray((v as ExplanationComposable).move) &&
    (v as ExplanationComposable).move.length > 0 &&
    Array.isArray((v as ExplanationComposable).anchor) &&
    (v as ExplanationComposable).anchor.length > 0 &&
    Array.isArray((v as ExplanationComposable).observation) &&
    Array.isArray((v as ExplanationComposable).softener);

  const DEFAULT_COMPOSABLE_PATTERNS: readonly ComposablePatternId[] = [
    "p1",
    "p2",
    "p3",
    "p4",
  ];

  /** Deterministic composition: salted stableHash picks per slot; no randomness. */
  const composeExplanation = (
    slots: ExplanationComposable,
    sig: number,
    explainKey: string,
    mag: MagnitudeBand | "clamped"
  ): string => {
    const patternSrc =
      slots.patterns && slots.patterns.length > 0
        ? slots.patterns
        : DEFAULT_COMPOSABLE_PATTERNS;
    let pattern: ComposablePatternId =
      patternSrc[stableHash(sig, explainKey, mag, "pat") % patternSrc.length] ??
      "p1";
    if (pattern === "p3" && slots.observation.length === 0) pattern = "p1";
    if (pattern === "p4" && slots.softener.length === 0) pattern = "p1";

    const move =
      slots.move[stableHash(sig, explainKey, mag, "move") % slots.move.length] ??
      "";
    const anchor =
      slots.anchor[stableHash(sig, explainKey, mag, "anc") % slots.anchor.length] ??
      "";
    const obsLen = Math.max(slots.observation.length, 1);
    const observation =
      slots.observation[
        stableHash(sig, explainKey, mag, "obs") % obsLen
      ] ?? "";
    const softLen = Math.max(slots.softener.length, 1);
    const softener =
      slots.softener[
        stableHash(sig, explainKey, mag, "soft") % softLen
      ] ?? "";

    switch (pattern) {
      case "p1":
        return `${move} — ${anchor}`;
      case "p2":
        return `${anchor} — ${move}`;
      case "p3":
        return `${observation}. ${move}`;
      case "p4":
        return `${move} — ${anchor} — ${softener}`;
      default:
        return `${move} — ${anchor}`;
    }
  };

  // 32-bit FNV-1a. Pure, synchronous, deterministic. Used only by the
  // explanation variant selector; not used for pricing, selection, or
  // any non-language decision.
  const stableHash = (...inputs: (string | number)[]): number => {
    let h = 2166136261 >>> 0;
    for (const raw of inputs) {
      const s = typeof raw === "number" ? String(raw) : raw;
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
    }
    return h >>> 0;
  };

  // Deterministic variant picker. Strings pass through unchanged;
  // arrays pick one variant by sig % length. Zero randomness.
  const pickVariant = (bank: MagnitudeVariants, sig: number): string => {
    if (typeof bank === "string") return bank;
    if (bank.length === 0) return "";
    return bank[sig % bank.length] ?? "";
  };

  // Raw band resolver — returns the authored variant bank (string or
  // string[]) for the best-matching magnitude band. Variant selection
  // happens in the call-site wrapper inside buildStrategyExplanation,
  // where selectorSig is in scope.
  const resolveBand = (
    leaf: MagnitudeLeaf | undefined,
    magnitude: MagnitudeBand
  ): MagnitudeVariants | ExplanationComposable | "" => {
    if (!leaf) return "";
    if (typeof leaf === "string" || Array.isArray(leaf)) return leaf;
    if (isExplanationComposable(leaf)) return leaf;
    const partial = leaf as Partial<Record<MagnitudeBand, MagnitudeBandValue>>;
    const chains: Record<MagnitudeBand, MagnitudeBand[]> = {
      micro: ["micro", "light", "moderate", "strong"],
      light: ["light", "moderate", "strong", "micro"],
      moderate: ["moderate", "strong", "light", "micro"],
      strong: ["strong", "moderate", "light", "micro"],
    };
    for (const band of chains[magnitude]) {
      const val = partial[band];
      if (typeof val === "string" && val.length > 0) return val;
      if (Array.isArray(val) && val.length > 0) return val;
      if (isExplanationComposable(val)) return val;
    }
    return "";
  };

  // Back-compat wrapper. Retained for call sites outside
  // buildStrategyExplanation (e.g. clamp short-circuit). Inside
  // buildStrategyExplanation the local shadow uses selectorSig.
  const resolveMagnitude = (
    leaf: MagnitudeLeaf | undefined,
    magnitude: MagnitudeBand
  ): string => {
    const bank = resolveBand(leaf, magnitude);
    if (typeof bank === "string" || Array.isArray(bank)) {
      return pickVariant(bank, 0);
    }
    if (isExplanationComposable(bank)) {
      return composeExplanation(bank, 0, "outer.resolveMagnitude", magnitude);
    }
    return "";
  };

  const EXPLANATION_MAP = {
    standard: "Your priced estimate as-is.",
    clamped: {
      "close-harder": {
        move: [
          "That's the real floor on this job",
          "You're tapped out on how low you can go",
          "This is the bottom that still respects the work",
          "Can't chase the number any lower here",
        ],
        anchor: [
          "another cut starts eating real margin",
          "push past this and you're funding it yourself",
          "there's no honest slack left to give",
          "going sharper breaks the math on labor and material",
        ],
        observation: [
          "Rails have you pinned at the safe end",
          "You've already given what the job can carry",
          "This is where the estimate stops being fiction",
        ],
        softener: [
          "still reads as a straight number to most buyers",
          "usually the right place to stop negotiating",
          "typically where experienced crews hold the line",
        ],
      },
      "close-slightly": {
        move: [
          "You're as sharp as margin allows",
          "That's the tightest honest number here",
          "The trim stops here — no more room",
          "You've maxed the sharpen without bleeding",
        ],
        anchor: [
          "another nudge costs more than it buys",
          "margin won't absorb another haircut",
          "the scope doesn't support going leaner",
          "anything further is coming out of profit",
        ],
        observation: [
          "You're already sitting on the workable floor",
          "The number's about as lean as it should be",
          "There's no clean way to go tighter",
        ],
        softener: [
          "usually enough for a price-driven buyer to bite",
          "often the line where the job still feels fair",
          "typically still defensible in front of the customer",
        ],
      },
      "lift-slightly": {
        move: [
          "That's the credible top for this one",
          "You're at the ceiling that still holds",
          "The raise stops here — story won't support more",
          "This is the honest cap on the number",
        ],
        anchor: [
          "push higher and the bid stops sounding real",
          "another bump is a stretch past what the work shows",
          "the scope doesn't defend a bigger ask",
          "buyers get skeptical past this point",
        ],
        observation: [
          "Rails capped you where the price still lands",
          "You're already at the upper bound that reads fair",
          "The market won't wear much more on this roof",
        ],
        softener: [
          "still leaves you with a defendable position",
          "usually where premium tone stops feeling forced",
          "often the last lift that still sounds grounded",
        ],
      },
      "lift-meaningfully": {
        move: [
          "Partial lift only — full jump won't stick",
          "You get a capped correction, not the whole runway",
          "Meaningful raise, but not the max the math might want",
          "Honest bump without overselling the scope",
        ],
        anchor: [
          "the story breaks if you reach too far",
          "buyers won't wear the full correction narrative",
          "rails stop you short of the aggressive number",
          "defensibility drops off past this point",
        ],
        observation: [
          "You're already asking for a lot of trust at this tier",
          "The job only carries so much lift before it squeaks",
          "There's a hard limit on how greedy this reads",
        ],
        softener: [
          "still often enough to recover honest margin",
          "usually the biggest lift that feels professional",
          "typically where confident stops and pushy starts",
        ],
      },
    } as Partial<
      Record<StrategyType, MagnitudeVariants | ExplanationComposable>
    >,
    defaults: {
      "close-harder": {
        micro: {
          move: [
            "Knock a touch off the number",
            "Shave a hair for a cleaner ask",
            "Give back a sliver on price",
            "Nudge the bid down a notch",
          ],
          anchor: [
            "margin barely flinches",
            "you're still deep inside profit",
            "the give-back's cheap at this margin",
            "nobody's going to feel that on the spread",
          ],
          observation: [
            "There's easy slack without drama",
            "You're not tight enough for this to sting",
            "Healthy margin buys a small gesture",
          ],
          softener: [
            "often enough to look cooperative",
            "usually still reads as a confident price",
            "typically an easy yes for a tactical crew",
          ],
        },
        light: {
          move: [
            "Drop it slightly to tighten the ask",
            "A modest cut keeps you competitive",
            "Sharpen the number a step",
            "Take a small bite out of the top line",
          ],
          anchor: [
            "margin still carries it comfortably",
            "you're nowhere near the danger zone",
            "profit holds with room to spare",
            "the job still prints clean after the give",
          ],
          observation: [
            "You're in a safe band to negotiate",
            "There's honest headroom without drama",
            "The spread can absorb a practical trim",
          ],
          softener: [
            "often makes the number easier to say yes to",
            "usually still lands in a defensible range",
            "typically harder for them to walk past",
          ],
        },
        moderate: {
          move: [
            "Cut it a noticeable step",
            "Give a real trim to meet the market",
            "Move the number down meaningfully",
            "Take a solid slice off the ask",
          ],
          anchor: [
            "margin still backs the work honestly",
            "you're not flirting with a bad job yet",
            "profit survives a serious give-back",
            "volume or margin still carries the hit",
          ],
          observation: [
            "This is still a disciplined drop, not panic",
            "You're buying speed without giving away the farm",
            "There's enough air in the bid to flex",
          ],
          softener: [
            "often the right trade for a price-first buyer",
            "usually still easier to defend than it feels",
            "typically keeps you in the hunt without bleeding",
          ],
        },
        strong: {
          move: [
            "Drop it hard to match a hungry market",
            "Take a big step down on price",
            "Move aggressively to anchor the close",
            "Give a heavy trim to own the number",
          ],
          anchor: [
            "margin's fat enough to eat it",
            "you're sitting on real cushion here",
            "profit still holds after a serious move",
            "the bid was high enough to absorb the hit",
          ],
          observation: [
            "This is a price play, not a margin fantasy",
            "You're buying the table with margin you actually have",
            "The job can carry an aggressive stance",
          ],
          softener: [
            "often what it takes when they're shopping hard",
            "usually still safer than it sounds on paper",
            "typically the move when you want the work on the board",
          ],
        },
      },
      "close-slightly": {
        micro: {
          move: [
            "Tighten the number a hair",
            "Nudge the ask down slightly",
            "Polish the price with a tiny give",
            "Ease the top line a touch",
          ],
          anchor: [
            "margin hardly notices",
            "the spread stays boringly healthy",
            "it's mostly optics for the buyer",
            "you're not risking the job over pennies",
          ],
          observation: [
            "Small moves read confident, not desperate",
            "You're flirting with a cleaner close",
            "There's no reason to overthink a tiny flex",
          ],
          softener: [
            "often enough to soften a picky buyer",
            "usually reads as fair without looking weak",
            "typically an easy concession to offer",
          ],
        },
        light: {
          move: [
            "Sharpen the bid a step",
            "A modest trim tightens the story",
            "Clip the number slightly to help it land",
            "Give a small, clean concession",
          ],
          anchor: [
            "margin stays relaxed",
            "profit still feels honest after the move",
            "you're buying goodwill without drama",
            "the job doesn't flinch at a light give",
          ],
          observation: [
            "This is a tactical nudge, not a fire sale",
            "You're still in the range that looks professional",
            "There's room to flex without sounding cheap",
          ],
          softener: [
            "often makes the package easier to swallow",
            "usually still sounds like you know your number",
            "typically a low-risk way to stay competitive",
          ],
        },
        moderate: {
          move: [
            "Trim meaningfully while staying disciplined",
            "Take a firmer cut that still respects margin",
            "Move the price down in a serious but controlled way",
            "Give enough to matter without giving away the farm",
          ],
          anchor: [
            "profit still holds after the move",
            "you're not crossing into charity work",
            "margin absorbs it without squeaking",
            "the scope still earns what you're leaving",
          ],
          observation: [
            "This is where price pressure meets real math",
            "You're buying attention from a sharp buyer",
            "The bid had enough honesty to flex here",
          ],
          softener: [
            "often the sweet spot between sharp and stupid",
            "usually still easier to defend than a bigger drop",
            "typically reads as serious without sounding desperate",
          ],
        },
        strong: {
          move: [
            "Drop harder while keeping the job honest",
            "Take a big visible step toward their number",
            "Move the ask aggressively but on purpose",
            "Give a heavy trim because you can afford it",
          ],
          anchor: [
            "margin still carries the work",
            "you're not betting the shop on hope",
            "profit survives because the spread was real",
            "the job was priced with room to negotiate",
          ],
          observation: [
            "This is a deliberate price play, not panic",
            "You're leaning in because the math allows it",
            "The close is probably coming down to the number",
          ],
          softener: [
            "often what it takes when they're comparing hard",
            "usually still safer when margin was honest upfront",
            "typically the move when you want the job locked",
          ],
        },
      },
      "hold-firmly": [
        "Margin's too thin — don't discount this one.",
        "No safe room to drop here — hold the number.",
        "Giving ground here costs more than it buys.",
      ],
      "hold-the-line-value": [
        "Already sharp — nothing more to give back.",
        "You're competitive as-is — don't hand over margin.",
        "Dropping here costs more than it wins.",
      ],
      "hold-the-line-premium": [
        "Nothing here supports pushing the number up.",
        "Lifting this isn't credible — hold steady.",
        "You're already where you should be — leave it.",
      ],
      "lift-slightly": {
        micro: {
          move: [
            "Nudge the number up a touch",
            "Ask for a small lift on the bid",
            "Bump the price a hair where it fits",
            "Ease the ask upward slightly",
          ],
          anchor: [
            "the scope already earns it",
            "what's on the ground backs a hair more",
            "margin has room for a modest correction",
            "the work reads a little ahead of the number",
          ],
          observation: [
            "You're not reaching — just catching up",
            "This is a light correction, not a flex",
            "The story still sounds grounded",
          ],
          softener: [
            "often reads fair when labor or material ran heavy",
            "usually an easy detail to defend in review",
            "typically still sounds confident, not greedy",
          ],
        },
        light: {
          move: [
            "Raise the bid a clean step",
            "Lift the number to match the real work",
            "Move the ask up where the scope supports it",
            "Push for a modest but visible correction",
          ],
          anchor: [
            "the job's carrying more than the price shows",
            "margin can wear a practical lift",
            "what you priced doesn't match what's involved",
            "the field conditions argue for a bit more",
          ],
          observation: [
            "You're buying honesty into the estimate",
            "This is a professional correction, not a stunt",
            "The buyer can still hear this without flinching",
          ],
          softener: [
            "often lands when impact or pitch added real cost",
            "usually still easier to say than a big jump",
            "typically reads as you tightening your own math",
          ],
        },
        moderate: {
          move: [
            "Lift meaningfully — the bid's behind the work",
            "Push a real correction into the number",
            "Move the price up in a way buyers can hear",
            "Ask for a noticeable bump tied to scope",
          ],
          anchor: [
            "you're under for what's actually involved",
            "margin needs air for the real labor and material",
            "the scope outruns the current ask",
            "the roof is asking for a serious number",
          ],
          observation: [
            "This is opportunity, not wishful thinking",
            "You're correcting a mismatch, not gouging",
            "The work on the ground supports the lift",
          ],
          softener: [
            "often still defensible when photos and pitch tell the story",
            "usually reads better than leaving money on the table",
            "typically where confident crews get paid for the real job",
          ],
        },
        strong: {
          move: [
            "Push a big correction — you're materially under",
            "Lift hard where the scope clearly earns it",
            "Move the number up aggressively but honestly",
            "Ask for a serious bump tied to real burden",
          ],
          anchor: [
            "the price is visibly behind the job",
            "margin's too thin for what's on the ticket",
            "you left real dollars out of the ask",
            "the field story outruns the spreadsheet",
          ],
          observation: [
            "This is a rare case where the bid whispers 'too low'",
            "You're not greedy — you're catching a bad miss",
            "The customer can still buy a grounded story here",
          ],
          softener: [
            "often necessary when complexity or labor blew past the quote",
            "usually still credible when you can point to real scope",
            "typically the move when you priced optimism instead of reality",
          ],
        },
      },
      "lift-meaningfully": {
        micro: {
          move: [
            "Start the correction with a small lift",
            "Open with a modest raise toward honest margin",
            "Begin moving the number toward the real job",
            "Chip upward while keeping the story tight",
          ],
          anchor: [
            "scope's already ahead of the price",
            "margin's too lean for the labor you're carrying",
            "the estimate didn't catch the real burden",
            "what's priced doesn't match what's involved",
          ],
          observation: [
            "Deep lifts start with credibility, not theater",
            "You're fixing math, not fishing for premium",
            "The job needs air before you talk bigger moves",
          ],
          softener: [
            "often the first step before a larger correction lands",
            "usually easier to hear than jumping straight to the max",
            "typically buys trust while you tighten the bid",
          ],
        },
        light: {
          move: [
            "Lift the bid in a clear, controlled step",
            "Move the number up to protect the work",
            "Correct upward where margin's clearly thin",
            "Raise the ask to match labor and material reality",
          ],
          anchor: [
            "the price isn't carrying the scope",
            "you're exposed if this goes to production as-is",
            "margin needs relief for the real roof",
            "the ticket undervalues what's on the ground",
          ],
          observation: [
            "This is a correction lane, not a luxury upsell",
            "You're defending the job, not flexing on the customer",
            "The story still has to sound professional",
          ],
          softener: [
            "often necessary when the walk revealed more than the takeoff",
            "usually reads fair when pitch or deck complexity shows up late",
            "typically the honest move before you eat the difference",
          ],
        },
        moderate: {
          move: [
            "Push a serious raise tied to real scope",
            "Move the number up in a meaningful, defensible way",
            "Correct hard where the bid missed the job",
            "Lift materially — the work earned a bigger ask",
          ],
          anchor: [
            "margin can't survive at the current number",
            "you're meaningfully under for what's involved",
            "the scope outruns the price by a wide margin",
            "labor and material reality demand more room",
          ],
          observation: [
            "This is the kind of job that punishes a soft bid",
            "You're past small talk — the math is wrong",
            "Buyers can still hear you if you point to real conditions",
          ],
          softener: [
            "often the difference between a clean job and a bleeding one",
            "usually still credible when complexity is obvious",
            "typically where experienced crews stop apologizing for the price",
          ],
        },
        strong: {
          move: [
            "Demand a large correction toward honest margin",
            "Lift aggressively because the bid is dangerously light",
            "Move the price up hard where the miss is obvious",
            "Push the ask to where the work can actually be built",
          ],
          anchor: [
            "you're carrying a massive gap to real cost",
            "the current number isn't a serious production price",
            "margin is effectively fictional at this ask",
            "the roof will eat you alive if you don't fix this",
          ],
          observation: [
            "This is red-flag territory for the estimate",
            "You're not upselling — you're stopping a train wreck",
            "Even a sharp buyer should understand the miss here",
          ],
          softener: [
            "often the last honest chance before you walk or re-scope",
            "usually only works when the scope story is undeniable",
            "typically the move when the quote was built on hope",
          ],
        },
      },
      "present-stronger": [
        "Same price, stronger package — that closes it.",
        "Don't move the number — upgrade what's in it.",
        "Better package at the same price reads smarter here.",
      ],
    },
    cascades: {
      // Flat composite sub-context keys, priority-ordered in the resolver.
      // Leaves may be full 4-band, partial, or string; resolveMagnitude
      // handles fallback deterministically.
      "close-harder": {
        priceSensitive_marginPremium_simple: {
          micro: [
            "Simple job with fat margin — a touch off won't cost you.",
            "They want a number — knock a hair off, you're still flush.",
            "Easy scope and strong profit — trim's effectively free here.",
          ],
          light: [
            "Simple scope, great margin — small cut, easy close.",
            "Drop it a bit — you've got more than enough on this one.",
            "They're on price — a small trim here seals it.",
          ],
          moderate: [
            "Real room to sharpen — simple job, profit's deep.",
            "Cut noticeably — you're still printing on a simple scope.",
            "They want it under — drop it and still do well.",
          ],
          strong: [
            "Meaningful cut — simple work, plenty of profit to give.",
            "Go hard on price — you're sitting on real margin here.",
            "Drop this significantly — still comes in well profitable.",
          ],
        },
        priceSensitive_largeJob_marginStrong: {
          micro: [
            "Big job, they want sharp — a touch off does it.",
            "At this size with healthy margin, a hair sharper seals it.",
            "Volume's there — nudge it down and it closes.",
          ],
          light: [
            "Shave it a bit — volume carries a small trim easily.",
            "They're shopping this big one — a small cut lands it.",
            "Big number, healthy margin — trim slightly and close it.",
          ],
          moderate: [
            "Cut it real — volume and margin both absorb it.",
            "They're on price, you're on scale — drop noticeably.",
            "Sharpen meaningfully — you're well inside the math.",
          ],
          strong: [
            "Go hard — size and margin easily carry a real drop.",
            "This one's price-driven — cut it big, still profits.",
            "Push the number way down — volume backs it comfortably.",
          ],
        },
        priceSensitive_marginStrong_simple: {
          micro: [
            "Simple job, they want sharp — a touch off does it cleanly.",
            "Easy scope with solid margin — trim's barely noticed.",
            "They're on price — small sharpen closes a simple one.",
          ],
          light: [
            "Trim slightly — simple work covers the move.",
            "Drop a bit — easy job, margin won't blink.",
            "They want a number — small cut wins it here.",
          ],
          moderate: [
            "Real cut here — simple scope, strong margin, plenty of room.",
            "Push the price down — you're still sitting in good profit.",
            "Sharpen noticeably — this one won't flinch at it.",
          ],
          strong: [
            "Meaningful drop — easy work and healthy margin carry it.",
            "Cut it hard — price-sensitive buyer, margin absorbs it.",
            "Big trim is fine — simple job, profit easily holds.",
          ],
        },
        largeJob_marginPremium: {
          micro: [
            "Big job with great margin — a hair off is nothing.",
            "Knock a touch off — volume and profit easily carry it.",
            "At this size on premium margin, the trim's basically free.",
          ],
          light: [
            "Drop it slightly — you're well inside profit at this scale.",
            "Small cut here barely moves the number on a big job.",
            "Trim a bit — volume and margin both cover it.",
          ],
          moderate: [
            "Real cut here — big job, strong profit to give.",
            "You can drop this meaningfully and still do very well.",
            "Push the price down — size and margin absorb it easily.",
          ],
          strong: [
            "Go hard on price — big job, deep margin, room to spare.",
            "Meaningful cut is safe — you're sitting on real profit.",
            "Drop significantly — volume and premium margin hold it.",
          ],
        },
        largeJob_marginStrong: {
          micro: [
            "Big job, healthy margin — touch off adds weight to the close.",
            "Shave a hair — volume easily carries it on a solid margin.",
            "Small sharpen helps land this one at this size.",
          ],
          light: [
            "Trim it a bit — you've got the scale to absorb it.",
            "Small cut here lands a big job cleanly.",
            "Drop slightly — volume and margin both back it.",
          ],
          moderate: [
            "Real trim — big job, margin's there, still comfortable.",
            "Cut noticeably — the scale covers the give-back.",
            "Push it down — you're not tight on a job this size.",
          ],
          strong: [
            "Meaningful cut — volume and margin both carry the move.",
            "Go hard — a big job on healthy margin handles a real drop.",
            "Push the price down — scale alone covers the give-back.",
          ],
        },
        highCloseStory: {
          micro: [
            "Lots of room here — a touch off is nothing.",
            "Easy close story — shave a hair and move on.",
            "You're well inside on this one — trim a touch.",
          ],
          light: [
            "Plenty of close room — drop it slightly, no issue.",
            "Trim a bit — this one's got easy give-back space.",
            "Small cut is comfortable — you're well inside here.",
          ],
          moderate: [
            "Real cut's fine — close potential's high on this.",
            "Drop meaningfully — still well inside healthy profit.",
            "Push the price down — margin absorbs it cleanly.",
          ],
          strong: [
            "Go hard — lots of close room, aggressive pricing is safe.",
            "Cut it real — this one carries a meaningful drop easily.",
            "Drop significantly — profit's deep enough to handle it.",
          ],
        },
        marginStrong_simple: {
          micro: [
            "Simple scope, solid margin — a hair off won't be felt.",
            "Easy work, healthy profit — the trim's costless.",
            "Shave a touch — nothing complicated here to eat into.",
          ],
          light: [
            "Trim slightly — simple job, you've got the room.",
            "Drop a bit — this one's straightforward, margin holds.",
            "Small cut is safe — nothing on the ground to worry about.",
          ],
          moderate: [
            "Real room to sharpen — simple scope absorbs it cleanly.",
            "Cut noticeably — easy job, profit's still healthy.",
            "Push it down — simple work backs a real trim.",
          ],
          strong: [
            "Go aggressive — simple scope plus healthy margin covers it.",
            "Meaningful drop's fine — nothing tricky on this to worry about.",
            "Cut hard — easy job, still comes in well profitable.",
          ],
        },
        highCloseStory_largeJob: {
          light: [
            "Big job with easy close room — trim it a bit.",
            "Drop slightly — at this size, close room is wide.",
            "Small cut lands cleanly on a big, forgiving job.",
          ],
          moderate: [
            "Real trim — big job, close room's there.",
            "Cut noticeably — volume and close story back it.",
            "Push it down — this one won't fight a meaningful drop.",
          ],
          strong: [
            "Go hard — big job with room to spare on price.",
            "Meaningful cut — scale and margin both carry it.",
            "Drop significantly — close story's strong enough to take it.",
          ],
        },
        highCloseStory_midJob_involved: {
          light: [
            "Lots going on, but you've got room — trim a bit.",
            "Mid-size, real scope, but close story holds — drop slightly.",
            "Scope is heavy but not tight — small cut is safe.",
          ],
          moderate: [
            "Real cut — you've got room even with real scope here.",
            "Drop it noticeably — close story absorbs the work.",
            "Push it down — more going on, but margin's not tight.",
          ],
          strong: [
            "Meaningful cut is workable — close room backs the scope.",
            "Go hard — you've got enough room to handle the involved work.",
            "Drop real — scope's heavier, but profit still covers it.",
          ],
        },
        marginStrong_involved: {
          light: [
            "More going on, but margin's healthy — small trim is safe.",
            "Drop it slightly — the work's real but you're not tight.",
            "Trim a bit — involved scope, solid margin, fine call.",
          ],
          moderate: [
            "Cut noticeably — margin covers the work here.",
            "Real trim's safe — scope's real, but profit's not pinched.",
            "Drop it — you've got enough margin for the scope involved.",
          ],
          strong: [
            "Real drop is workable — healthy margin covers involved work.",
            "Cut hard — scope's heavy but margin's there to absorb it.",
            "Push it down — involved job, but you're sitting well.",
          ],
        },
        marginPremium_involved: {
          light: [
            "Involved work, but margin's premium — small drop is easy.",
            "Trim slightly — real scope, but you've got deep profit.",
            "Drop a bit — heavy work meets heavier margin.",
          ],
          moderate: [
            "Real cut here — involved scope, premium profit absorbs it.",
            "Push it down — lots going on, but margin's well ahead.",
            "Drop noticeably — premium margin carries the work easily.",
          ],
          strong: [
            "Go real on price — premium margin handles involved scope.",
            "Meaningful cut is safe — the work's heavy but profit's deeper.",
            "Drop hard — involved job, margin's way out ahead.",
          ],
        },
        scopeDominant_extreme: {
          light: [
            "Scope is heavy — only margin lets you trim at all here.",
            "Extreme work — a small cut is safe because profit absorbs it.",
            "Tough job — trim a touch only because margin backs it.",
          ],
          moderate: [
            "Real cut holds only because margin covers extreme scope.",
            "Drop noticeably — but only because profit's there for it.",
            "Heavy work — real trim is safe thanks to margin, not scope.",
          ],
          strong: [
            "Big drop works only because margin's carrying extreme scope.",
            "Cut hard — profit's the only reason this move is safe.",
            "Aggressive trim — extreme work, margin does all the lifting.",
          ],
        },
        scopeDominant_steep_labor: {
          light: [
            "Steep roof, heavy labor — small trim only because margin's strong.",
            "Pitch and labor are both rough — margin makes the cut safe.",
            "Tight work, but profit lets you give a little back.",
          ],
          moderate: [
            "Real cut holds only because margin covers the steep, heavy labor.",
            "Drop it — but only because margin's where the room is, not scope.",
            "Push it down — profit absorbs a steep, labor-heavy job.",
          ],
          strong: [
            "Big drop works only because margin's doing the carrying.",
            "Cut hard — steep and labor-heavy, but profit still backs it.",
            "Meaningful trim — only safe because margin's got the room.",
          ],
        },
        scopeDominant_steep_complex: {
          light: [
            "Steep and complex — small trim only because margin holds it.",
            "Tough pitch and tricky scope — margin's the reason to give.",
            "Hard job — a little cut is safe thanks to profit, not scope.",
          ],
          moderate: [
            "Real cut is safe only because margin covers the complexity.",
            "Drop noticeably — but only because profit backs this steep one.",
            "Complex pitch — trim holds only due to strong margin.",
          ],
          strong: [
            "Go real on price — margin's the only reason it's safe here.",
            "Big drop works — steep, complex, but profit's deeper than scope.",
            "Cut hard — hard job, margin does all the lifting.",
          ],
        },
        scopeDominant_complex_labor: {
          light: [
            "Complex work, heavy labor — small trim only because margin's strong.",
            "Labor and complexity both up — margin lets you give a little.",
            "Tough combo — profit's what makes the small cut safe.",
          ],
          moderate: [
            "Real cut holds only because margin covers a tough combo.",
            "Drop it — but only because profit backs complex, heavy labor.",
            "Push it down — complexity and labor need margin to enable it.",
          ],
          strong: [
            "Big drop works only because margin's carrying the real work.",
            "Cut hard — heavy labor and complexity, but profit still wins.",
            "Meaningful trim — only safe because margin's deep enough.",
          ],
        },
        scopeDominant_generic: {
          light: [
            "Heavy scope — small trim only because margin allows it.",
            "Tough job overall — profit lets you give a little back.",
            "Work's heavy — a little cut is only safe thanks to margin.",
          ],
          moderate: [
            "Real cut holds only because margin covers heavy scope.",
            "Drop noticeably — but margin's the reason, not the work.",
            "Push it down — scope's tough, profit's what makes it fine.",
          ],
          strong: [
            "Big drop works only because margin's carrying heavy scope.",
            "Cut hard — real work on the ground, but profit's deeper.",
            "Meaningful trim is safe only because margin has the room.",
          ],
        },
        priceSensitive_largeJob_involved_strong: {
          micro: [
            "Big involved job, they're on price — a touch off still holds.",
            "Lots going on at this size — small sharpen does it.",
            "They want sharp on a big real job — hair off is fine.",
          ],
          light: [
            "Trim a bit — big involved job, margin backs the move.",
            "They're on price — small cut fits, scope and margin carry it.",
            "Drop slightly — at this size with real work, you've got room.",
          ],
          moderate: [
            "Real cut — big involved work, margin covers it comfortably.",
            "They want sharp — you've got room even with the scope here.",
            "Drop noticeably — volume and profit absorb the work.",
          ],
          strong: [
            "Go hard on price — big job, real work, margin handles it.",
            "Cut real — they're shopping, scope's heavy, still room to give.",
            "Meaningful drop fits — at this scale with this margin, safe.",
          ],
        },
        priceSensitive_largeJob_clean_strong: {
          micro: [
            "Big simple job, they're on price — knock a touch off.",
            "Clean at scale — a hair off lands it cleanly.",
            "They want sharp — easy work at volume covers it.",
          ],
          light: [
            "Trim a bit — big walkable job with solid margin.",
            "Small cut lands it — easy job, healthy margin, they want sharp.",
            "Drop slightly — volume covers it, nothing tricky on the ground.",
          ],
          moderate: [
            "Real cut — simple big job, volume and margin both back it.",
            "They're on price — push it down, scope isn't fighting you.",
            "Drop noticeably — easy work at scale absorbs it clean.",
          ],
          strong: [
            "Go hard on price — big clean job with healthy margin.",
            "Cut real — they're shopping, but nothing's in your way here.",
            "Push the price down — simple scope, strong margin, real room.",
          ],
        },
        priceSensitive_midJob_involved_strong: {
          micro: [
            "More going on, they want sharp — a touch off fits.",
            "Real work on a mid-size, but margin lets you nudge it down.",
            "They're on price — small sharpen is fine with real scope.",
          ],
          light: [
            "Trim a bit — real scope, but margin backs a small cut.",
            "They want sharp — small drop fits what's on the ground.",
            "Drop slightly — involved mid-size, profit covers it.",
          ],
          moderate: [
            "Real cut — margin's strong enough for the work involved.",
            "Push it down — they're on price, scope's there but profit holds.",
            "Drop noticeably — lots going on, but you've got the room.",
          ],
          strong: [
            "Go hard — they're shopping, margin handles the involved work.",
            "Cut real — the scope's heavy, but profit's well ahead of it.",
            "Meaningful drop fits — real work, real margin to absorb it.",
          ],
        },
        priceSensitive_midJob_clean_strong: {
          micro: [
            "Clean mid-size, they're on price — trim's essentially free.",
            "Easy work, they want sharp — a hair off does it.",
            "Walkable job — small sharpen lands a price-sensitive bid.",
          ],
          light: [
            "Small cut here — simple mid-size with solid margin.",
            "Drop a bit — they want sharp, nothing on the job to stop you.",
            "Trim slightly — easy scope, healthy margin, fine move.",
          ],
          moderate: [
            "Real cut — simple work and strong margin both carry it.",
            "Push it down — they want sharp, you've got comfortable room.",
            "Drop noticeably — straightforward job absorbs it cleanly.",
          ],
          strong: [
            "Go hard — simple mid-size with strong margin takes a real drop.",
            "Cut big — they're on price, nothing complicated to eat into.",
            "Meaningful trim — easy scope, solid profit, lots of room.",
          ],
        },
        priceSensitive_smallJob_strong: {
          micro: [
            "Small job, they want sharp — a touch off wraps it.",
            "Quick one — knock a hair off to tighten the close.",
            "Easy call — small sharpen lands it, profit holds fine.",
          ],
          light: [
            "Trim slightly — small job, margin carries the move.",
            "Small cut seals this — quick scope, they're on price.",
            "Drop a bit — margin's fine, the job's simple enough.",
          ],
          moderate: [
            "Real trim fits — small job, margin's well ahead.",
            "They want sharp — cut noticeably, still plenty of profit.",
            "Push it down — quick job, you've got comfortable room.",
          ],
          strong: [
            "Go hard — small job, strong margin, easy to carry a big cut.",
            "Meaningful drop — they're on price, profit easily absorbs it.",
            "Cut real — nothing on this job to worry about margin-wise.",
          ],
        },
        marginStrong_largeJob_involved: {
          micro: [
            "Big involved job, solid margin — hair off barely registers.",
            "Real work at scale — a touch off fits without straining anything.",
            "Volume and margin carry a small sharpen on heavier scope.",
          ],
          light: [
            "Trim a bit — real work, but volume and margin both back it.",
            "Drop slightly — big involved job, profit holds fine.",
            "Small cut lands it — at this size, scope doesn't fight back.",
          ],
          moderate: [
            "Real cut — involved scope, but margin's there to absorb it.",
            "Push it down — big job, real work, still comfortable profit.",
            "Drop noticeably — volume covers the work, margin's healthy.",
          ],
          strong: [
            "Go hard — scale and margin both carry involved work.",
            "Meaningful drop — heavy scope, but profit's deep at this size.",
            "Cut real — the work's real, but you've got room to spare.",
          ],
        },
        marginStrong_largeJob_clean: {
          micro: [
            "Big walkable job, healthy margin — a touch off is easy.",
            "Clean at scale — shave a hair, nothing on the ground to fight.",
            "Simple big job — margin hardly notices a small sharpen.",
          ],
          light: [
            "Trim a bit — easy work at volume, margin's solid.",
            "Small cut lands cleanly on a big walkable job.",
            "Drop slightly — nothing tricky here, margin covers it.",
          ],
          moderate: [
            "Real cut — simple scope at scale, profit absorbs it easily.",
            "Push it down — big clean job, margin's well ahead.",
            "Drop noticeably — volume and straightforward work back it.",
          ],
          strong: [
            "Go hard — simple big job on solid margin takes a real drop.",
            "Cut big — nothing complicated to worry about, margin's there.",
            "Meaningful drop fits — easy work at scale, profit's deep.",
          ],
        },
        marginStrong_midJob_involved: {
          micro: [
            "More going on, but margin's solid — a hair off lands fine.",
            "Real work on a mid-size — small sharpen barely dents margin.",
            "Involved scope, healthy profit — the trim's easy.",
          ],
          light: [
            "Trim a bit — mid-size with real work, margin's there.",
            "Drop slightly — scope's real, but you've got the room.",
            "Small cut is safe — solid margin handles the work involved.",
          ],
          moderate: [
            "Real cut — involved work, but margin covers it cleanly.",
            "Push it down — scope's heavy, profit's still well ahead.",
            "Drop noticeably — mid-size with real work, margin holds.",
          ],
          strong: [
            "Go hard — healthy margin absorbs involved mid-size work.",
            "Meaningful drop — scope's real, but profit's deeper than it.",
            "Cut real — the work's heavy, margin still carries it.",
          ],
        },
        marginStrong_midJob_clean: {
          micro: [
            "Easy mid-size, healthy margin — a touch off does it.",
            "Clean work, solid profit — the sharpen's essentially free.",
            "Simple scope on a mid-size — hair off won't be felt.",
          ],
          light: [
            "Trim a bit — walkable mid-size with margin to spare.",
            "Small cut lands cleanly — nothing on the ground to worry about.",
            "Drop slightly — easy scope, solid margin, fine move.",
          ],
          moderate: [
            "Real cut — simple mid-size with solid margin backs it.",
            "Push it down — easy work, profit's well ahead.",
            "Drop noticeably — straightforward job absorbs the move.",
          ],
          strong: [
            "Go hard — simple mid-size on strong margin handles a big drop.",
            "Cut real — easy work, profit's deep enough to take it.",
            "Meaningful drop fits — nothing complicated to eat into here.",
          ],
        },
        marginStrong_smallJob_clean: {
          micro: [
            "Small easy job, healthy margin — a touch off is nothing.",
            "Quick clean work — hair off barely registers.",
            "Simple small scope — the trim's basically free.",
          ],
          light: [
            "Trim slightly — small walkable job with solid margin.",
            "Small cut wraps it — easy work, profit holds fine.",
            "Drop a bit — quick job, nothing to eat into here.",
          ],
          moderate: [
            "Real cut fits — easy small job, margin's comfortable.",
            "Push it down — simple scope, solid profit, lots of room.",
            "Drop noticeably — straightforward small job takes it.",
          ],
          strong: [
            "Go hard — simple small job, margin handles a real drop.",
            "Cut big — easy work, profit's deep enough to carry it.",
            "Meaningful drop's fine — nothing tricky to eat into margin.",
          ],
        },
        marginPremium_largeJob_clean: {
          micro: [
            "Big walkable job with deep margin — a touch off is free.",
            "Clean at scale, profit's premium — the sharpen's a gift.",
            "Easy work at this size — margin won't blink at a hair off.",
          ],
          light: [
            "Trim slightly — big simple job with premium profit.",
            "Small cut here barely dents a deep margin at this scale.",
            "Drop a bit — walkable at volume, margin covers it easily.",
          ],
          moderate: [
            "Real cut — big easy job with premium margin to give.",
            "Push it down — simple at scale, profit's well ahead.",
            "Drop noticeably — volume plus deep margin both back it.",
          ],
          strong: [
            "Go hard — big clean job, premium margin, tons of room.",
            "Cut big — the work's easy, profit's deep, drop is comfortable.",
            "Meaningful drop fits — scale and margin both carry it easy.",
          ],
        },
        marginPremium_midJob_clean: {
          micro: [
            "Easy mid-size, deep margin — a hair off won't be felt.",
            "Clean job with premium profit — the sharpen's basically free.",
            "Walkable scope on fat margin — trim's costless.",
          ],
          light: [
            "Trim slightly — simple mid-size with premium margin to give.",
            "Small cut is easy — nothing on the ground, profit's deep.",
            "Drop a bit — easy work, premium profit, move's comfortable.",
          ],
          moderate: [
            "Real cut — simple mid-size, premium margin covers it fine.",
            "Push it down — easy scope with deep margin, plenty of room.",
            "Drop noticeably — walkable work, profit's well ahead.",
          ],
          strong: [
            "Go hard — easy mid-size on premium margin takes a real drop.",
            "Meaningful cut — simple work, profit's deeper than needed.",
            "Drop big — nothing tricky here, premium margin handles it.",
          ],
        },
        marginPremium_smallJob_clean: {
          micro: [
            "Quick easy job with premium margin — a touch off is free.",
            "Small walkable scope, deep profit — trim barely registers.",
            "Simple small job, fat margin — hair off is costless.",
          ],
          light: [
            "Trim slightly — small easy job with premium margin to spare.",
            "Small cut wraps it — quick work, profit's well ahead.",
            "Drop a bit — nothing to worry about, margin's premium.",
          ],
          moderate: [
            "Real cut — simple small job, premium margin carries it fine.",
            "Push it down — easy scope, profit's deeper than the work.",
            "Drop noticeably — walkable job, margin's way out ahead.",
          ],
          strong: [
            "Go hard — small easy job with premium margin takes a big drop.",
            "Meaningful cut — simple work, profit's deep, room to spare.",
            "Drop real — nothing complicated, margin handles the move easy.",
          ],
        },
        marginPremium_largeJob_involved: {
          micro: [
            "Big involved job but margin's deep — hair off is comfortable.",
            "Real work at scale, premium profit — trim barely moves it.",
            "Lots going on, but margin's well ahead — small sharpen's fine.",
          ],
          light: [
            "Trim a bit — involved at scale, premium margin absorbs it.",
            "Drop slightly — real work, but profit's deeper than the scope.",
            "Small cut fits — volume plus deep margin cover it.",
          ],
          moderate: [
            "Real cut — scope's heavy, but premium margin carries it.",
            "Push it down — involved volume, profit's still well ahead.",
            "Drop noticeably — lots going on, margin's way out in front.",
          ],
          strong: [
            "Go hard — big involved job, premium margin handles the work.",
            "Meaningful drop — scope's real, but profit's deeper than it.",
            "Cut big — the work's heavy, margin easily carries a real drop.",
          ],
        },
        marginPremium_midJob_involved: {
          micro: [
            "More going on, but margin's deep — a touch off barely dents it.",
            "Real work on a mid-size, premium profit — trim's comfortable.",
            "Involved scope meets premium margin — small sharpen's easy.",
          ],
          light: [
            "Trim a bit — real mid-size work with premium margin to give.",
            "Drop slightly — the scope's there, but profit's well ahead.",
            "Small cut is safe — premium margin covers involved work fine.",
          ],
          moderate: [
            "Real cut — involved mid-size, premium margin handles it cleanly.",
            "Push it down — scope's heavy, but profit's deeper than it.",
            "Drop noticeably — real work, margin's well out in front.",
          ],
          strong: [
            "Go hard — involved mid-size on premium margin carries a big drop.",
            "Meaningful cut — scope's real, but profit has plenty of room.",
            "Drop real — the work's heavy, premium margin handles the move.",
          ],
        },
        marginPremium_smallJob_involved: {
          micro: [
            "Small involved job, premium margin — a touch off is fine.",
            "Real work on a quick job, but profit's deep — trim's easy.",
            "Tight scope at small size, fat margin — hair off barely moves it.",
          ],
          light: [
            "Trim a bit — real work on a small one, margin backs it easily.",
            "Small cut fits — involved scope, but profit's well ahead.",
            "Drop slightly — small job with real scope, premium margin holds.",
          ],
          moderate: [
            "Real cut — small involved job, premium margin covers the work.",
            "Push it down — tight scope, but profit's deeper than it.",
            "Drop noticeably — involved small job, margin's way out ahead.",
          ],
          strong: [
            "Go hard — small involved job with premium margin carries it.",
            "Meaningful cut — scope's real, profit's deeper, room to spare.",
            "Drop real — tight work, but premium margin handles the move.",
          ],
        },
        priceSensitive_largeJob_premium_clean: {
          micro: [
            "Big simple job, they're on price, margin's deep — knock a bit off.",
            "They want sharp — easy work at scale with premium profit, trim it.",
            "Hair off seals this one — nothing on the ground to worry about.",
          ],
          light: [
            "Trim slightly — big walkable job, premium margin, they want sharp.",
            "Small cut locks it — simple at scale with deep margin backing you.",
            "Drop a bit — they're shopping, volume and premium margin both help.",
          ],
          moderate: [
            "Real cut — they want sharp, easy big job, premium margin to give.",
            "Push the price down — nothing to fight, profit's well ahead.",
            "Drop noticeably — they're on price, this one can clearly take it.",
          ],
          strong: [
            "Go hard on price — big easy job, premium margin, tons of room.",
            "Cut real — they're shopping, simple work, profit's way out ahead.",
            "Meaningful drop — easy at scale with deep margin, they'll take it.",
          ],
        },
        priceSensitive_midJob_premium_clean: {
          micro: [
            "They want sharp, easy mid-size, margin's deep — knock a bit off.",
            "Simple walkable job, they're on price — hair off seals it.",
            "Clean scope with premium profit — small trim lands a price bid.",
          ],
          light: [
            "Trim slightly — easy mid-size, premium margin, they're shopping.",
            "Small cut locks it — nothing on the ground, profit's well ahead.",
            "Drop a bit — walkable work with deep margin, they'll take it.",
          ],
          moderate: [
            "Real cut — simple mid-size, premium margin, they want sharp.",
            "Push the price down — easy scope with profit deeper than needed.",
            "Drop noticeably — they're on price, this one's built to give.",
          ],
          strong: [
            "Go hard — easy mid-size with premium margin, they'll close on price.",
            "Cut real — simple work, deep margin, nothing to lose on the drop.",
            "Meaningful drop fits — they're shopping and you've got real room.",
          ],
        },
        priceSensitive_smallJob_premium_clean: {
          micro: [
            "Small easy job, they want sharp, margin's deep — trim a touch.",
            "Quick walkable one — they're on price, hair off wraps it.",
            "Simple small job with premium profit — trim seals a price bid.",
          ],
          light: [
            "Trim slightly — quick easy job with premium margin, they want sharp.",
            "Small cut wraps it — nothing tricky, profit's well ahead.",
            "Drop a bit — they're shopping, walkable work handles the give.",
          ],
          moderate: [
            "Real cut — small easy job, premium margin, they want it sharper.",
            "Push the price down — simple work, deep margin, plenty of room.",
            "Drop noticeably — quick job on premium margin, they'll take it.",
          ],
          strong: [
            "Go hard — small easy job with premium margin, drop is comfortable.",
            "Cut real — simple work, deep profit, they're on price.",
            "Meaningful drop fits — nothing on the ground, margin's way ahead.",
          ],
        },
        marginStrong_largeJob_neutral: {
          micro: [
            "Big job, solid margin — a hair off still holds the close.",
            "At this scale with healthy profit, trim's controlled and easy.",
            "Touch off here — volume and margin both back it.",
          ],
          light: [
            "Trim slightly — big job with solid margin, controlled move.",
            "Drop a bit — you've got the size and margin to carry it.",
            "Small cut lands cleanly at this scale with healthy profit.",
          ],
          moderate: [
            "Real cut — big job, margin's there, still well profitable.",
            "Push it down — at this size with this margin, you've got room.",
            "Drop noticeably — volume and profit both absorb it cleanly.",
          ],
          strong: [
            "Go hard — big job on healthy margin carries a real drop.",
            "Meaningful cut — scale and margin both back an aggressive move.",
            "Drop big — volume covers it, profit's deep enough to hold it.",
          ],
        },
        marginStrong_midJob_neutral: {
          micro: [
            "Mid-size, healthy margin — a touch off stays comfortable.",
            "Controlled move — trim's fine on a solid-margin job.",
            "Hair off — margin's healthy, nothing to worry about.",
          ],
          light: [
            "Trim a bit — mid-size with solid margin, fine move.",
            "Drop slightly — you've got the room, nothing tight here.",
            "Small cut lands cleanly — controlled and inside profit.",
          ],
          moderate: [
            "Real cut — mid-size with healthy margin, still profitable.",
            "Push it down — margin's solid, this one can take a real trim.",
            "Drop noticeably — you're not tight, profit holds the move.",
          ],
          strong: [
            "Go hard — mid-size on healthy margin carries a real drop.",
            "Meaningful cut fits — margin's deep enough to handle it.",
            "Drop big — you're well inside profit, move's comfortable.",
          ],
        },
        marginStrong_smallJob_neutral: {
          micro: [
            "Small job, healthy margin — a touch off barely registers.",
            "Quick one with solid profit — hair off is nothing.",
            "Trim's costless on a small job with margin like this.",
          ],
          light: [
            "Trim slightly — small job, solid margin, easy call.",
            "Small cut wraps it — you've got the room, easy move.",
            "Drop a bit — nothing tight here, margin holds fine.",
          ],
          moderate: [
            "Real cut fits — small job with healthy margin, plenty of room.",
            "Push it down — quick one with solid profit, comfortable move.",
            "Drop noticeably — small work, margin's well ahead.",
          ],
          strong: [
            "Go hard — small job on solid margin carries a real drop.",
            "Meaningful cut — profit's deep enough, move's safe.",
            "Drop big — quick work, margin handles the give easily.",
          ],
        },
      },
      "close-slightly": {
        priceSensitive_largeJob: {
          micro: {
            move: [
              "Nudge the ask down a hair",
              "Give a tiny concession on a big ticket",
              "Ease the number slightly at volume",
              "Shave the top line on a large job",
            ],
            anchor: [
              "they're comparing hard at this scale",
              "volume makes a small give-back cheap",
              "scale carries a light trim without drama",
              "big square count rewards a tactical flex",
            ],
            observation: [
              "Price talk gets loud when the ticket is big",
              "They're shopping square footage, not poetry",
              "This is where a small move reads decisive",
            ],
            softener: [
              "often enough to stay in the running",
              "usually still leaves margin honest",
              "typically easier for them to say yes to",
            ],
          },
          light: {
            move: [
              "Drop the bid a clean step",
              "Take a modest cut on the big number",
              "Sharpen the ask where scale absorbs it",
              "Move the price down with volume behind you",
            ],
            anchor: [
              "they want a sharper figure at size",
              "the spread still carries a practical trim",
              "square count backs a give-back that lands",
              "you're not flirting with a bad job here",
            ],
            observation: [
              "Big jobs reward crews who can flex without panic",
              "They're reading the total, not your feelings",
              "This is a volume play, not a margin fantasy",
            ],
            softener: [
              "often the right trade for a price-first buyer",
              "usually still reads as confident, not desperate",
              "typically harder for them to walk past cleanly",
            ],
          },
          moderate: {
            move: [
              "Cut meaningfully on the large ticket",
              "Give a serious trim backed by scale",
              "Move the big number down in a controlled way",
              "Take a visible step toward their ask",
            ],
            anchor: [
              "volume still eats the hit without squeaking",
              "they're pushing hard because the total matters",
              "scale lets you buy the close without bleeding",
              "margin survives when the job is this big",
            ],
            observation: [
              "This is where price discipline meets real square count",
              "They're not wrong to squeeze a big line item",
              "You're buying attention with margin you can access",
            ],
            softener: [
              "often what it takes when they're comparing three bids",
              "usually still safer than it feels on paper",
              "typically keeps you credible while staying competitive",
            ],
          },
          strong: {
            move: [
              "Drop hard on the big ticket",
              "Take an aggressive cut at scale",
              "Move the large number sharply to anchor the close",
              "Give a heavy trim because volume can carry it",
            ],
            anchor: [
              "scale absorbs a real move without breaking the job",
              "they're shopping this hard because it's a big check",
              "margin was healthy enough to negotiate with",
              "square footage is doing the heavy lifting here",
            ],
            observation: [
              "This is a price fight on a big roof, plain and simple",
              "You're leaning in because the math allows it",
              "Volume is the only reason this move is sane",
            ],
            softener: [
              "often the move when you want the work on the board",
              "usually still workable when margin was honest upfront",
              "typically what separates a busy crew from an empty calendar",
            ],
          },
        },
        priceSensitive_simpleMarginStrong: {
          micro: {
            move: [
              "Nudge the ask down a hair",
              "Ease the number on easy scope",
              "Tighten the bid a touch",
              "Offer a tiny flex on simple work",
            ],
            anchor: [
              "they're shopping and the job stays walkable",
              "healthy margin makes the gesture cheap",
              "solid profit absorbs a small sharpen",
              "easy scope carries light price pressure fine",
            ],
            observation: [
              "Simple roofs still get compared like everything else",
              "This reads cooperative without sounding soft",
              "Small moves land easy when nothing tricky fights you",
            ],
            softener: [
              "often enough for a price-sensitive buyer",
              "usually still leaves margin feeling honest",
              "typically easier for them to say yes to",
            ],
          },
          light: {
            move: [
              "Trim the bid a practical step",
              "Drop slightly on straightforward scope",
              "Give a modest cut they can point to",
              "Sharpen the ask where the job stays simple",
            ],
            anchor: [
              "they want a sharper number on easy work",
              "margin still holds after a light give",
              "nothing on the ground punishes the move",
              "profit's well ahead of a price-first conversation",
            ],
            observation: [
              "Walkable scope makes a measured flex believable",
              "You're buying speed without giving away the farm",
              "This is competitive lane, not a complexity lecture",
            ],
            softener: [
              "often lands when they're comparing clean bids",
              "usually still reads as confident, not desperate",
              "typically makes the package harder to pass on",
            ],
          },
          moderate: {
            move: [
              "Cut a noticeable step on simple scope",
              "Move the number down in a serious but safe way",
              "Give a real trim tied to staying competitive",
              "Take a firmer concession without sounding panicked",
            ],
            anchor: [
              "they're pushing because the lane is noisy",
              "simple work still earns what you're leaving",
              "margin survives a meaningful flex here",
              "easy scope keeps a bigger give believable",
            ],
            observation: [
              "This is the part of the call where numbers do the talking",
              "You're past small talk on price",
              "Buyers respect crews who can move without flinching",
            ],
            softener: [
              "often the difference between second place and signed",
              "usually still easier to defend than it feels",
              "typically keeps you in range without sounding cheap",
            ],
          },
          strong: {
            move: [
              "Drop hard to meet a hungry buyer",
              "Take a big visible step on price",
              "Move aggressively because the lane demands it",
              "Give a heavy trim tied to anchoring the close",
            ],
            anchor: [
              "they're shopping this like a commodity",
              "margin was strong enough to negotiate with",
              "you're trading margin for position on easy work",
              "the close is probably coming down to the bottom line",
            ],
            observation: [
              "This is a price-forward voice on a simple roof",
              "You're leaning in because the math allows it",
              "Sometimes the number has to move a lot to matter",
            ],
            softener: [
              "often what it takes when three bids are on the table",
              "usually still workable when margin wasn't fiction",
              "typically the move when empty trucks cost more than pride",
            ],
          },
        },
        priceSensitive: {
          micro: {
            move: [
              "Tighten the number a touch",
              "Ease the ask down slightly",
              "Offer a small, clean concession",
              "Nudge the bid without drama",
            ],
            anchor: [
              "they're reading every line on price",
              "the conversation keeps circling the total",
              "you're competing in a sharp lane",
              "margin can wear a gesture without pain",
            ],
            observation: [
              "This one's going to come down to the number",
              "They're not pretending budget doesn't matter",
              "Small moves read cooperative, not weak",
            ],
            softener: [
              "often enough to stay in the conversation",
              "usually still sounds like you know your costs",
              "typically an easy flex to offer first",
            ],
          },
          light: {
            move: [
              "Drop the bid a practical step",
              "Sharpen the number where it helps the close",
              "Give a modest cut they can point to",
              "Move the price down in a controlled way",
            ],
            anchor: [
              "they want something tangible to compare",
              "margin still holds after a light give",
              "you're buying speed without giving away the farm",
              "the job can carry a tactical trim",
            ],
            observation: [
              "This is competitive work, not a lecture",
              "They're comparing, not admiring",
              "A measured move reads professional here",
            ],
            softener: [
              "often lands when the bid felt a hair proud",
              "usually still easier to defend than a bigger drop",
              "typically makes the package harder to pass on",
            ],
          },
          moderate: {
            move: [
              "Cut a noticeable step toward their world",
              "Move the number down in a serious but safe way",
              "Give a real trim tied to staying competitive",
              "Take a firmer concession without sounding desperate",
            ],
            anchor: [
              "they're pushing because the market is noisy",
              "margin still survives a meaningful flex",
              "you're trading dollars for position, not pride",
              "the scope still earns what you're leaving",
            ],
            observation: [
              "This is the part of the call where numbers do the talking",
              "You're past small talk on price",
              "Buyers respect crews who can move without flinching",
            ],
            softener: [
              "often the difference between second place and signed",
              "usually still reads as disciplined, not panicked",
              "typically keeps you in range without sounding cheap",
            ],
          },
          strong: {
            move: [
              "Drop hard to meet a hungry buyer",
              "Take a big visible step on price",
              "Move aggressively because the lane demands it",
              "Give a heavy trim tied to winning the board",
            ],
            anchor: [
              "they're shopping this like a commodity",
              "margin was strong enough to negotiate with",
              "you're buying the job with dollars you can access",
              "the close is probably coming down to the bottom line",
            ],
            observation: [
              "This is a price war voice, not a premium sermon",
              "You're leaning in because you want the work",
              "Sometimes the number has to move a lot to matter",
            ],
            softener: [
              "often what it takes when three bids are on the table",
              "usually still workable when margin wasn't fiction",
              "typically the move when empty trucks cost more than pride",
            ],
          },
        },
        largeJob_marginStrong: {
          micro: {
            move: [
              "Ease the big-ticket number slightly",
              "Offer a small give-back at scale",
              "Nudge the large bid down a touch",
              "Polish the price on a big roof",
            ],
            anchor: [
              "healthy margin makes the gesture cheap",
              "volume turns a hair-cut into nothing dramatic",
              "scale carries a light trim cleanly",
              "profit still sits comfortable after the move",
            ],
            observation: [
              "Big jobs like a little flexibility on the ask",
              "You're not tight — you're tactical",
              "Square footage is doing you a favor here",
            ],
            softener: [
              "often reads as cooperative without sounding soft",
              "usually still leaves you looking sharp",
              "typically an easy concession to signal good faith",
            ],
          },
          light: {
            move: [
              "Trim the big number a step",
              "Drop slightly where scale absorbs it",
              "Give a modest cut on the large ticket",
              "Sharpen the ask while volume backs you",
            ],
            anchor: [
              "margin and square count both carry the move",
              "you're buying goodwill without drama",
              "the spread still feels honest after the flex",
              "big roofs forgive small gives",
            ],
            observation: [
              "This is a volume-backed move, not desperation",
              "You're flexing because you can afford to",
              "Buyers notice when big numbers move a little",
            ],
            softener: [
              "often helps the close without changing the story",
              "usually still sounds like you know your production costs",
              "typically lands cleaner than a stubborn sticker price",
            ],
          },
          moderate: {
            move: [
              "Cut a real step on the large ticket",
              "Move the big number down meaningfully",
              "Give a noticeable trim backed by scale",
              "Take a serious give where volume carries it",
            ],
            anchor: [
              "scale eats the hit without breaking the job",
              "strong margin buys a real negotiation move",
              "you're still inside honest profit after the flex",
              "the job prints clean even after a bigger give",
            ],
            observation: [
              "This is where size becomes your negotiating friend",
              "You're trading a slice of margin for momentum",
              "Big tickets reward crews who can move with confidence",
            ],
            softener: [
              "often the right move when they're comparing totals",
              "usually still safer than it feels in the moment",
              "typically keeps you competitive without sounding cheap",
            ],
          },
          strong: {
            move: [
              "Drop hard on the big ticket",
              "Take a big cut at scale on purpose",
              "Move the large number sharply with volume behind you",
              "Give a heavy trim because scale can carry it",
            ],
            anchor: [
              "margin was fat enough to negotiate aggressively",
              "square footage is absorbing a real move",
              "you're buying the table with cushion you actually have",
              "the bid had room for a serious flex",
            ],
            observation: [
              "This is an aggressive stance only big spreads earn",
              "You're leaning in because the math allows it",
              "Volume is the reason this doesn't read as panic",
            ],
            softener: [
              "often what it takes when the job is worth fighting for",
              "usually still workable when margin was real",
              "typically separates a booked week from an empty one",
            ],
          },
        },
        largeJob_marginBalanced: {
          micro: {
            move: [
              "Ease the large bid a hair",
              "Offer a tiny flex on the big number",
              "Nudge down slightly where scale helps",
              "Polish the price on a big square count",
            ],
            anchor: [
              "volume keeps the move from pinching",
              "balanced margin still tolerates a small give",
              "scale makes a light trim feel honest",
              "the total can move a touch without drama",
            ],
            observation: [
              "Big jobs often expect a little room on the ask",
              "You're not bleeding — you're being practical",
              "Square footage buys you a small gesture",
            ],
            softener: [
              "often reads fair without sounding apologetic",
              "usually still keeps the math boringly stable",
              "typically an easy move when the schedule matters",
            ],
          },
          light: {
            move: [
              "Trim the big ticket slightly",
              "Drop a step where volume carries the give",
              "Give a modest cut on a large scope",
              "Sharpen the ask while scale backs the move",
            ],
            anchor: [
              "balanced margin meets big square count halfway",
              "you're not tight enough for this to hurt",
              "the size of the job absorbs a practical flex",
              "profit still feels controlled after the move",
            ],
            observation: [
              "This is a calm, volume-backed negotiation move",
              "You're buying cooperation without charity work",
              "Buyers like seeing movement on big numbers",
            ],
            softener: [
              "often enough to break a stalemate politely",
              "usually still sounds steady, not desperate",
              "typically easier to say yes to than a stubborn total",
            ],
          },
          moderate: {
            move: [
              "Cut a noticeable step on the large ticket",
              "Move the big number down in a measured way",
              "Give a real trim where scale does the lifting",
              "Take a firm concession backed by square footage",
            ],
            anchor: [
              "volume covers a meaningful give cleanly",
              "balanced margin can still wear a real flex",
              "you're trading margin for momentum, not panic",
              "the job stays honest after a bigger move",
            ],
            observation: [
              "This is disciplined price movement at scale",
              "You're flexing because the roof is big enough to allow it",
              "Totals matter more when the check is large",
            ],
            softener: [
              "often lands when they're comparing big numbers side by side",
              "usually still reads as professional, not weak",
              "typically keeps you in the hunt without bleeding out",
            ],
          },
          strong: {
            move: [
              "Drop meaningfully on the big ticket",
              "Take a big cut where scale saves the story",
              "Move the large number sharply with volume behind you",
              "Give a heavy trim because size can carry it",
            ],
            anchor: [
              "square footage is doing the heavy lifting here",
              "balanced margin meets a big give without breaking",
              "you're buying the close with scale, not fantasy",
              "the bid had enough honesty to flex hard",
            ],
            observation: [
              "This is a big-number move that still feels grounded",
              "You're leaning in because volume allows it",
              "Sometimes a big roof needs a big gesture",
            ],
            softener: [
              "often what it takes when the job is worth the squeeze",
              "usually still safer when the spread was never imaginary",
              "typically the difference between booked and ghosted",
            ],
          },
        },
        simpleMarginStrong: {
          micro: {
            move: [
              "Ease the number slightly on easy scope",
              "Offer a hair-cut on straightforward work",
              "Nudge down where nothing tricky fights margin",
              "Polish the ask on a clean job",
            ],
            anchor: [
              "simple work makes the flex basically free",
              "strong margin eats a tiny give without noticing",
              "nothing on the ground complicates the move",
              "easy scope means cheap goodwill",
            ],
            observation: [
              "Straight roofs reward simple negotiation",
              "You're not buying trouble with this flex",
              "Clean work reads confident when you move a little",
            ],
            softener: [
              "often lands without opening a scope argument",
              "usually still leaves you looking sharp",
              "typically an easy concession to offer first",
            ],
          },
          light: {
            move: [
              "Trim slightly on straightforward work",
              "Drop a step where the scope is clean",
              "Give a modest cut on an easy job",
              "Sharpen the bid without inviting risk",
            ],
            anchor: [
              "healthy margin carries a light move cleanly",
              "simple scope doesn't punish a small give",
              "you're buying speed, not solving a puzzle",
              "profit still feels boring after the trim",
            ],
            observation: [
              "This is tactical, not emotional",
              "Easy jobs shouldn't require a speech",
              "Buyers like a clean number that moves a little",
            ],
            softener: [
              "often reads as professional flexibility",
              "usually still sounds like you trust your production",
              "typically makes the close easier to swallow",
            ],
          },
          moderate: {
            move: [
              "Cut a real step on clean scope",
              "Move meaningfully where the job stays simple",
              "Give a noticeable trim without inviting risk",
              "Take a firm concession on straightforward work",
            ],
            anchor: [
              "strong margin absorbs a real move on easy work",
              "nothing complicated is waiting to bite you",
              "the scope stays honest after a bigger give",
              "simple roofs forgive bigger trims",
            ],
            observation: [
              "This is where easy work becomes your negotiating edge",
              "You're flexing because the ground is predictable",
              "Clean scope means you can move without fear",
            ],
            softener: [
              "often the sweet spot between sharp and stupid",
              "usually still easier to defend than it sounds",
              "typically keeps you competitive without drama",
            ],
          },
          strong: {
            move: [
              "Drop hard on easy scope",
              "Take a big cut where the job stays clean",
              "Move aggressively on straightforward work",
              "Give a heavy trim because margin can carry it",
            ],
            anchor: [
              "simple work plus strong margin buys a big flex",
              "nothing on the ground is going to punish the move",
              "you're trading dollars for a locked schedule",
              "the bid had cushion because the scope is honest",
            ],
            observation: [
              "This is an aggressive move only clean jobs earn",
              "You're leaning in because the risk profile is low",
              "Sometimes the easy roof is the right place to fight",
            ],
            softener: [
              "often what it takes when price is the only story",
              "usually still workable when margin wasn't a fantasy",
              "typically the move when you want the calendar full",
            ],
          },
        },
        simpleMarginBalanced: {
          micro: {
            move: [
              "Ease the ask slightly on easy work",
              "Offer a small flex where margin is even",
              "Nudge down on a straightforward scope",
              "Polish the number without overthinking it",
            ],
            anchor: [
              "balanced margin tolerates a light gesture",
              "simple scope keeps the move calm",
              "nothing tricky is waiting to explode costs",
              "the job stays honest after a tiny give",
            ],
            observation: [
              "This is a steady, low-drama adjustment",
              "You're not negotiating a nightmare roof",
              "Even margin likes a little cooperation",
            ],
            softener: [
              "often reads fair without sounding apologetic",
              "usually still keeps the tone professional",
              "typically an easy yes to offer early",
            ],
          },
          light: {
            move: [
              "Trim slightly where margin is even",
              "Drop a modest step on clean work",
              "Give a small cut that keeps the math calm",
              "Sharpen the bid in a measured way",
            ],
            anchor: [
              "balanced spread absorbs a practical flex",
              "easy scope makes the move feel controlled",
              "you're buying goodwill without charity pricing",
              "profit still reads steady after the trim",
            ],
            observation: [
              "This is calm contractor math, not theater",
              "You're flexing because the job allows it",
              "Straightforward work deserves straightforward moves",
            ],
            softener: [
              "often enough to keep the conversation moving",
              "usually still sounds grounded, not soft",
              "typically easier for a buyer to accept quietly",
            ],
          },
          moderate: {
            move: [
              "Cut a noticeable step on easy scope",
              "Move the number down in a fair, controlled way",
              "Give a real trim where margin stays even",
              "Take a firm concession without sounding desperate",
            ],
            anchor: [
              "balanced margin meets a bigger give without panic",
              "simple work keeps the story believable",
              "you're trading a slice of margin for momentum",
              "the scope doesn't punish an honest flex",
            ],
            observation: [
              "This is disciplined movement on a predictable job",
              "You're not solving complexity — you're solving price",
              "Even spreads can wear a meaningful gesture",
            ],
            softener: [
              "often lands when they're comparing clean bids",
              "usually still reads as professional discipline",
              "typically keeps you in range without sounding cheap",
            ],
          },
          strong: {
            move: [
              "Drop meaningfully on straightforward work",
              "Take a big cut where margin stays honest",
              "Move aggressively on a clean, even spread",
              "Give a heavy trim tied to staying competitive",
            ],
            anchor: [
              "simple scope is why the big flex still reads real",
              "balanced margin can still carry a serious move",
              "you're buying the close with dollars you can justify",
              "nothing on the ground turns this into a trap",
            ],
            observation: [
              "This is a strong move on a simple job — and that's OK",
              "You're leaning in because the risk profile is controlled",
              "Sometimes easy work is where price fights happen",
            ],
            softener: [
              "often what it takes when the buyer is blunt about budget",
              "usually still workable when your math was honest",
              "typically the difference between polite interest and a signature",
            ],
          },
        },
        midJob_marginStrong: {
          micro: {
            move: [
              "Ease the mid-size bid slightly",
              "Offer a hair-cut on a middle ticket",
              "Nudge down where margin is healthy",
              "Polish the number on a mid-size roof",
            ],
            anchor: [
              "strong margin makes the gesture cheap",
              "mid-size work still forgives a small give",
              "you're not flirting with a dangerous spread",
              "profit stays relaxed after the touch",
            ],
            observation: [
              "Mid-size jobs love a confident small flex",
              "You're not big enough to panic, not small enough to ignore",
              "Healthy margin buys easy cooperation here",
            ],
            softener: [
              "often reads sharp without sounding brittle",
              "usually still leaves room to negotiate later",
              "typically an easy concession to offer first",
            ],
          },
          light: {
            move: [
              "Trim the mid-size ask a step",
              "Drop slightly where healthy margin backs you",
              "Give a modest cut on a middle ticket",
              "Sharpen the bid while the spread stays strong",
            ],
            anchor: [
              "solid margin carries a light move cleanly",
              "mid-size scope doesn't punish a practical flex",
              "you're buying momentum without drama",
              "the job still prints well after the trim",
            ],
            observation: [
              "This is a tactical mid-market move",
              "You're flexing because you can afford to",
              "Buyers compare mid-size bids hard — a little helps",
            ],
            softener: [
              "often lands when your number felt a touch proud",
              "usually still sounds like you trust your crew",
              "typically makes you easier to say yes to",
            ],
          },
          moderate: {
            move: [
              "Cut a real step on the mid-size ticket",
              "Move the middle number down meaningfully",
              "Give a noticeable trim with margin behind you",
              "Take a firm concession on mid-size work",
            ],
            anchor: [
              "healthy margin absorbs a real move without squeaking",
              "mid-size roofs still reward disciplined flex",
              "you're trading margin for position, not pride",
              "profit survives a meaningful give here",
            ],
            observation: [
              "This is where mid-market negotiations get real",
              "You're moving because the spread allows it",
              "Strong margin is what makes this feel controlled",
            ],
            softener: [
              "often the right trade when they're shopping three mids",
              "usually still easier to defend than a bigger drop",
              "typically keeps you in the running without bleeding",
            ],
          },
          strong: {
            move: [
              "Drop hard on the mid-size ticket",
              "Take a big cut where strong margin carries it",
              "Move aggressively on middle square footage",
              "Give a heavy trim because the spread was real",
            ],
            anchor: [
              "solid margin buys an aggressive stance safely",
              "mid-size work can carry a big flex when math is honest",
              "you're buying the close with cushion you actually have",
              "the bid wasn't fantasy — that's why this works",
            ],
            observation: [
              "This is a strong mid-market price play",
              "You're leaning in because margin allows it",
              "Sometimes the middle ticket needs a big gesture",
            ],
            softener: [
              "often what it takes when they're comparing mids aggressively",
              "usually still workable when you priced with discipline",
              "typically separates booked weeks from 'we'll think about it'",
            ],
          },
        },
        priceSensitive_involved: {
          micro: [
            "More going on, but they want sharp — hair off nudges the close.",
            "Real scope, they're on price — small sharpen helps.",
            "Involved work with a price-driven buyer — trim a touch.",
          ],
          light: [
            "Trim a bit — real work, but they want a sharper number.",
            "Small cut helps close it — scope's there, they're shopping.",
            "Drop slightly — the work's real, but give them something.",
          ],
          moderate: [
            "Real trim — involved scope, they want a tighter number.",
            "Cut noticeably — they're shopping, work still gets covered.",
            "Push it down — they want sharp even on this scope.",
          ],
          strong: [
            "Go real on price — they want sharp, scope still gets paid.",
            "Cut hard — they're shopping, work justifies the move.",
            "Meaningful trim — they want a number, scope still covered.",
          ],
        },
        priceSensitive_midJob_clean: {
          micro: {
            move: [
              "Ease the mid-size ask slightly",
              "Offer a hair-cut on clean, walkable scope",
              "Nudge the number where nothing tricky fights you",
              "Polish the bid on an easy mid-size roof",
            ],
            anchor: [
              "they're comparing mids like commodities",
              "clean scope makes a small flex cheap",
              "price pressure shows even when the job is easy",
              "margin can wear a gesture without drama",
            ],
            observation: [
              "Mid-size clean jobs still get shopped hard",
              "Walkable doesn't mean blind budget",
              "This is tactical, not emotional",
            ],
            softener: [
              "often enough to look cooperative",
              "usually still leaves margin feeling honest",
              "typically an easy flex to signal good faith",
            ],
          },
          light: {
            move: [
              "Trim the mid-size clean bid a step",
              "Drop slightly on straightforward mid work",
              "Give a modest cut where scope stays simple",
              "Sharpen the ask on an easy middle ticket",
            ],
            anchor: [
              "they want a sharper number on a simple roof",
              "walkable work carries a light give cleanly",
              "nothing on the ground punishes the move",
              "margin stays relaxed after a practical trim",
            ],
            observation: [
              "This is a clean mid-market negotiation",
              "You're not solving complexity — you're solving price",
              "Buyers like mids that move a little without drama",
            ],
            softener: [
              "often lands when your bid felt a touch proud",
              "usually still sounds confident, not soft",
              "typically makes you easier to say yes to",
            ],
          },
          moderate: {
            move: [
              "Cut a real step on clean mid-size work",
              "Move the middle number down meaningfully",
              "Give a noticeable trim on walkable scope",
              "Take a firm concession where the job stays simple",
            ],
            anchor: [
              "they're shopping mids aggressively anyway",
              "easy scope keeps a bigger flex believable",
              "margin still holds after a meaningful move",
              "clean work means you're not buying hidden risk",
            ],
            observation: [
              "This is where simple roofs still demand real price talk",
              "You're flexing because the spread allows it",
              "Mid-size tickets get compared line by line",
            ],
            softener: [
              "often the right trade when three mids are on the table",
              "usually still easier to defend than it feels",
              "typically keeps you competitive without sounding cheap",
            ],
          },
          strong: {
            move: [
              "Drop hard on clean mid-size work",
              "Take a big cut where walkable scope backs the story",
              "Move aggressively on a simple middle ticket",
              "Give a heavy trim because the job stays predictable",
            ],
            anchor: [
              "they want a sharp mid and they'll take it if you offer it",
              "clean scope is why an aggressive flex still reads real",
              "margin was honest enough to negotiate with",
              "nothing tricky turns this into a trap mid-job",
            ],
            observation: [
              "This is a price-forward move on an easy roof",
              "You're leaning in because the risk profile is controlled",
              "Sometimes the simplest job is the hardest price fight",
            ],
            softener: [
              "often what it takes when they're comparing clean bids brutally",
              "usually still workable when you priced with discipline",
              "typically the difference between second call and signed",
            ],
          },
        },
        largeJob_marginBalanced_involved: {
          light: {
            move: [
              "Trim the big involved ticket slightly",
              "Drop a clean step where volume backs the give",
              "Ease the large number on real scope",
              "Offer a modest flex at scale",
            ],
            anchor: [
              "square count still carries a light give honestly",
              "involved work meets volume halfway on the move",
              "balanced margin tolerates a small, fair gesture",
              "the size of the job absorbs a practical trim",
            ],
            observation: [
              "Real work at scale still expects a little room on the ask",
              "You're not bleeding — you're being practical with volume",
              "Lots going on, but scale buys cooperation",
            ],
            softener: [
              "often reads fair without sounding apologetic",
              "usually still keeps the math stable",
              "typically easier to say yes to than a stubborn total",
            ],
          },
          moderate: {
            move: [
              "Cut a noticeable step on a big involved ticket",
              "Move the large number down in a measured way",
              "Give a real trim where volume does the lifting",
              "Take a firm concession backed by square footage",
            ],
            anchor: [
              "scope is real but scale still eats the hit cleanly",
              "involved work at volume earns the give-back back",
              "balanced margin meets a meaningful flex without panic",
              "the job stays honest after a bigger move",
            ],
            observation: [
              "This is disciplined price movement at scale",
              "Volume is the reason the drop doesn't read as desperation",
              "They're comparing big totals — a measured flex helps",
            ],
            softener: [
              "often lands when they're shopping large bids side by side",
              "usually still reads as professional, not weak",
              "typically keeps you competitive without sounding cheap",
            ],
          },
          strong: {
            move: [
              "Drop meaningfully on a big involved ticket",
              "Take a big cut where scale saves the story",
              "Move the large number sharply with volume behind you",
              "Give a heavy trim because size can carry it",
            ],
            anchor: [
              "square footage is doing the heavy lifting here",
              "involved scope still meets scale on a big give",
              "balanced margin can wear an aggressive stance at size",
              "the bid had enough honesty to flex hard",
            ],
            observation: [
              "This is an aggressive stance only big spreads earn",
              "You're leaning in because the math allows it",
              "Volume is the reason this doesn't read as panic",
            ],
            softener: [
              "often what it takes when the job is worth fighting for",
              "usually still workable when margin was real",
              "typically separates a booked week from an empty one",
            ],
          },
        },
        largeJob_marginBalanced_clean: {
          light: {
            move: [
              "Trim the big clean ticket slightly",
              "Drop a step where walkable scale carries the give",
              "Ease the large walkable number a touch",
              "Polish the big simple bid without drama",
            ],
            anchor: [
              "volume turns a light give into nothing dramatic",
              "clean at scale makes a small flex read honest",
              "balanced margin still tolerates a practical trim",
              "nothing tricky fights the move on the ground",
            ],
            observation: [
              "Big simple jobs often expect a little flexibility",
              "You're buying cooperation without charity work",
              "Walkable square count is doing you a favor here",
            ],
            softener: [
              "often helps the close without changing the story",
              "usually still sounds steady, not desperate",
              "typically lands cleaner than a stubborn sticker price",
            ],
          },
          moderate: {
            move: [
              "Cut a real step on a big clean ticket",
              "Move the large walkable number down meaningfully",
              "Give a noticeable trim backed by scale",
              "Take a serious give where volume carries it",
            ],
            anchor: [
              "simple work at scale absorbs a bigger flex cleanly",
              "balanced margin buys a real negotiation move",
              "the spread still feels honest after the flex",
              "big roofs forgive measured gives when scope is easy",
            ],
            observation: [
              "This is where size becomes your negotiating friend",
              "You're trading a slice of margin for momentum",
              "Totals matter more when the check is large",
            ],
            softener: [
              "often the right move when they're comparing totals",
              "usually still safer than it feels in the moment",
              "typically keeps you competitive without sounding cheap",
            ],
          },
          strong: {
            move: [
              "Drop hard on the big clean ticket",
              "Take a big cut at walkable scale on purpose",
              "Move the large number sharply with volume behind you",
              "Give a heavy trim because scale can carry it",
            ],
            anchor: [
              "margin was honest enough to negotiate aggressively at size",
              "square footage is absorbing a real move",
              "you're buying the table with cushion you actually have",
              "easy scope at volume is why the big flex still reads real",
            ],
            observation: [
              "This is an aggressive stance only big spreads earn",
              "You're leaning in because the risk profile is controlled",
              "Sometimes the simplest big job is the hardest price fight",
            ],
            softener: [
              "often what it takes when they're comparing clean bids brutally",
              "usually still workable when you priced with discipline",
              "typically the difference between second call and signed",
            ],
          },
        },
        midJob_marginBalanced_clean: {
          micro: {
            move: [
              "Ease the mid-size clean bid a hair",
              "Nudge the walkable mid number slightly",
              "Tighten the ask a touch on simple mids",
              "Polish the middle ticket without drama",
            ],
            anchor: [
              "fair margin makes the gesture cheap",
              "clean scope barely notices a small sharpen",
              "balanced spread tolerates a tiny flex",
              "nothing tight here fights a hair-cut",
            ],
            observation: [
              "Easy mids still deserve clean, calm moves",
              "You're tactical, not emotional, on walkable work",
              "Small gives read confident when scope is simple",
            ],
            softener: [
              "often enough to look cooperative",
              "usually still keeps margin feeling honest",
              "typically an easy flex to signal good faith",
            ],
          },
          light: {
            move: [
              "Trim the mid-size clean bid a step",
              "Drop slightly on straightforward mid work",
              "Give a modest cut where scope stays simple",
              "Sharpen the ask on an easy middle ticket",
            ],
            anchor: [
              "walkable mids carry a light give cleanly",
              "balanced margin meets simple scope halfway",
              "nothing on the ground punishes the move",
              "profit still feels controlled after the flex",
            ],
            observation: [
              "This is a clean mid-market negotiation",
              "Buyers like mids that move a little without drama",
              "You're solving price, not complexity",
            ],
            softener: [
              "often lands when your bid felt a touch proud",
              "usually still sounds confident, not soft",
              "typically makes you easier to say yes to",
            ],
          },
          moderate: {
            move: [
              "Cut a real step on clean mid-size work",
              "Move the middle number down meaningfully",
              "Give a noticeable trim on walkable scope",
              "Take a firm concession where the job stays simple",
            ],
            anchor: [
              "easy scope keeps a bigger flex believable",
              "balanced margin still holds after a meaningful move",
              "mids get compared line by line — a real flex helps",
              "clean work means you're not buying hidden risk",
            ],
            observation: [
              "This is where simple roofs still demand real price talk",
              "You're flexing because the spread allows it",
              "Measured aggression reads professional on easy mids",
            ],
            softener: [
              "often the right trade when three mids are on the table",
              "usually still easier to defend than it feels",
              "typically keeps you competitive without sounding cheap",
            ],
          },
        },
        midJob_marginBalanced_involved: {
          micro: {
            move: [
              "Ease the involved mid bid a hair",
              "Nudge the number on real mid-size scope",
              "Tighten the ask a touch when work is real",
              "Offer a tiny flex on an involved mid",
            ],
            anchor: [
              "fair margin keeps a small sharpen honest",
              "real scope still tolerates a light gesture",
              "balanced spread meets involved work halfway",
              "the work earns back what you give on a small move",
            ],
            observation: [
              "Involved mids punish lazy pricing quietly",
              "Small moves read fair when margin isn't tight",
              "This stays tactical — not a big heroic give",
            ],
            softener: [
              "often enough to break a polite stalemate",
              "usually still leaves the job feeling paid for",
              "typically easier for them to say yes to",
            ],
          },
          light: {
            move: [
              "Trim the involved mid ticket a step",
              "Drop slightly where real scope stays balanced",
              "Give a modest cut the work can absorb",
              "Sharpen the mid ask without overreaching",
            ],
            anchor: [
              "scope is real but margin still carries a light give",
              "involved work meets fair margin on a measured flex",
              "drop reads honest when the crew reality is real",
              "profit holds after a practical trim",
            ],
            observation: [
              "You're buying speed without pretending scope is easy",
              "Buyers respect mids that move when the story is tight",
              "This is balanced voice — not discount panic",
            ],
            softener: [
              "often lands when they're comparing mids seriously",
              "usually still sounds steady, not desperate",
              "typically makes the package harder to pass on",
            ],
          },
          moderate: {
            move: [
              "Cut a noticeable step on involved mid work",
              "Move the middle number down in a measured way",
              "Give a real trim tied to real scope",
              "Take a firm concession the job can still defend",
            ],
            anchor: [
              "involved mids still need margin to stay honest",
              "real work absorbs a meaningful give when margin is fair",
              "balanced spread survives a serious flex here",
              "scope earns what you leave on the table",
            ],
            observation: [
              "This is where real work meets real price talk",
              "You're flexing because the spread allows it — not because you're tight",
              "Measured cuts read professional on involved mids",
            ],
            softener: [
              "often the difference between second place and signed",
              "usually still easier to defend than a bigger panic drop",
              "typically keeps you in the hunt without bleeding out",
            ],
          },
        },
        scopeDominant_extreme: {
          light: [
            "Extreme scope — a slight trim is the most you should give.",
            "Heavy work — only margin lets you sharpen at all.",
            "Tough job — small cut only because profit's there to cover it.",
          ],
          moderate: [
            "Extreme scope — trim is narrow but workable.",
            "Heavy work — real trim holds, but measured, not aggressive.",
            "Push too far and margin breaks — stay measured on this one.",
          ],
          strong: [
            "Extreme scope — only a measured trim is safe here.",
            "Tough job — push further and the math starts to hurt.",
            "Heavy work — don't go bigger than this or margin breaks.",
          ],
        },
        scopeDominant_steep_labor: {
          light: [
            "Steep and labor-heavy — slight trim is the ceiling.",
            "Tough pitch with labor — small cut's all margin will carry.",
            "Hard job — a little trim only because profit backs it.",
          ],
          moderate: [
            "Steep, labor-heavy — trim is narrow but workable.",
            "Real work here — measured trim only, not aggressive.",
            "Push further and margin breaks — keep it measured.",
          ],
          strong: [
            "Steep, labor-heavy — only a measured trim is safe.",
            "Hard job — this is as far as the drop should go.",
            "Heavy labor and steep pitch — more than this hurts margin.",
          ],
        },
        scopeDominant_steep_complex: {
          light: [
            "Steep and complex — a slight trim is the ceiling here.",
            "Tough pitch and tricky scope — small cut is the most you give.",
            "Hard job — measured trim only because margin's strong.",
          ],
          moderate: [
            "Steep complex job — trim is narrow but workable.",
            "Real work on a tough pitch — stay measured on the drop.",
            "Push further and margin starts to break — keep it controlled.",
          ],
          strong: [
            "Steep complex job — only a measured trim is safe.",
            "Hard job — don't go bigger than this without hurting margin.",
            "Tough combo — this is the ceiling on the drop.",
          ],
        },
        scopeDominant_complex_labor: {
          light: [
            "Complex and labor-heavy — slight trim is the ceiling.",
            "Hard combo — small cut is all margin will carry.",
            "Real work — a little trim only because profit backs it.",
          ],
          moderate: [
            "Complex, labor-heavy — trim is narrow but workable.",
            "Tough job — measured trim holds, don't push further.",
            "Push further and margin breaks — stay controlled here.",
          ],
          strong: [
            "Complex, labor-heavy — only a measured trim is safe.",
            "Hard combo — this is the ceiling, more hurts the math.",
            "Real work — don't go bigger than a measured drop.",
          ],
        },
        scopeDominant_generic: {
          light: [
            "Scope is heavy — small trim is the ceiling here.",
            "Tough job overall — a little cut is all margin allows.",
            "Real work — slight trim only because profit backs it.",
          ],
          moderate: [
            "Heavy scope — trim is narrow but workable.",
            "Real work — stay measured, don't push the drop further.",
            "Push harder and margin starts to break — keep it controlled.",
          ],
          strong: [
            "Heavy scope — only a measured trim is safe on this one.",
            "Tough job — don't go bigger than this without hurting margin.",
            "Real work — this is as far as the drop should go.",
          ],
        },
        priceSensitive_largeJob_involved: {
          micro: [
            "Big involved job, they're on price — hair off still holds.",
            "Real work at scale — small sharpen is fine, they want sharp.",
            "Lots going on, but they're shopping — touch off fits.",
          ],
          light: [
            "Trim a bit — real work at scale, they want sharp.",
            "Small cut fits — the scope earns it back on a big job.",
            "Drop slightly — they're on price, scale covers the work.",
          ],
          moderate: [
            "Real trim — involved work at scale, they want a number.",
            "Cut noticeably — they're shopping, scale handles the move.",
            "Push it down — real work, but volume backs the give.",
          ],
          strong: [
            "Go hard — big real job, they want sharp, scale covers it.",
            "Cut real — involved work at volume absorbs the move.",
            "Meaningful trim — the scope's real, but so is the size.",
          ],
        },
        priceSensitive_largeJob_clean: {
          micro: [
            "Big walkable job, they want sharp — touch off seals it.",
            "Clean at scale, they're on price — hair off lands it.",
            "Simple big job with a shopping buyer — trim slightly.",
          ],
          light: [
            "Trim a bit — easy big job, they want a number, volume helps.",
            "Small cut closes it — simple at scale, nothing to fight.",
            "Drop slightly — they're on price, big clean job absorbs it.",
          ],
          moderate: [
            "Real trim — big clean job, they want sharp, volume covers it.",
            "Cut noticeably — simple at scale, they're shopping hard.",
            "Push it down — easy work at this size handles the move.",
          ],
          strong: [
            "Go hard — big walkable job, they want sharp, volume backs it.",
            "Cut real — simple scope, price-driven buyer, easy move.",
            "Meaningful trim — nothing in the way at this size.",
          ],
        },
        priceSensitive_midJob_involved: {
          micro: [
            "More going on, they want sharp — hair off nudges the close.",
            "Real mid-size scope, buyer's on price — trim slightly.",
            "Involved work with a price-driven buyer — small sharpen fits.",
          ],
          light: [
            "Trim a bit — involved mid-size, they want a number.",
            "Small cut earns the close — the work's real but they're shopping.",
            "Drop slightly — they want sharp, scope still gets covered.",
          ],
          moderate: [
            "Real trim fits — mid-size involved work earns it back.",
            "Cut noticeably — they want sharp, the scope absorbs it.",
            "Push it down — they're shopping, real work still gets paid.",
          ],
          strong: [
            "Go real — involved mid-size, they want sharp, scope covers it.",
            "Cut hard — they're price-driven, the work's real but fine.",
            "Meaningful trim — scope earns what you give back.",
          ],
        },
        priceSensitive_smallJob: {
          micro: {
            move: [
              "Ease the small ticket slightly",
              "Offer a hair-cut on a quick scope",
              "Nudge the little bid where it helps",
              "Polish a tight number without drama",
            ],
            anchor: [
              "small jobs still get shopped like everything else",
              "they want a clean, sharp small total",
              "quick scope makes a tiny flex cheap",
              "margin can wear a gesture without pain",
            ],
            observation: [
              "Little roofs can still drive loud price talk",
              "Fast jobs deserve fast, clean moves",
              "This wraps faster when the number moves a touch",
            ],
            softener: [
              "often enough to close a picky small buyer",
              "usually still leaves you looking sharp",
              "typically an easy flex to offer and move on",
            ],
          },
          light: {
            move: [
              "Trim the small bid a step",
              "Drop slightly on a quick ticket",
              "Give a modest cut on little square footage",
              "Sharpen the small ask where it lands clean",
            ],
            anchor: [
              "they want a tighter number on a small check",
              "quick scope carries a light give easily",
              "you're buying speed, not negotiating a saga",
              "margin stays relaxed after a small flex",
            ],
            observation: [
              "Small tickets still get compared aggressively",
              "This is a quick close conversation, not a seminar",
              "Buyers respect a crew that can move on little jobs",
            ],
            softener: [
              "often wraps the job without a second meeting",
              "usually still sounds confident, not soft",
              "typically makes the decision easier to say yes to",
            ],
          },
          moderate: {
            move: [
              "Cut a real step on the small ticket",
              "Move the little number down meaningfully",
              "Give a noticeable trim on quick scope",
              "Take a firm concession on a fast job",
            ],
            anchor: [
              "they're pushing because small checks still matter",
              "quick work forgives a bigger flex when margin allows",
              "you're trading a slice for a signed small job",
              "the scope stays simple after a meaningful give",
            ],
            observation: [
              "This is price pressure on a small roof — still real",
              "You're moving because the buyer is blunt",
              "Sometimes the smallest jobs are the loudest on price",
            ],
            softener: [
              "often the difference between 'think about it' and booked",
              "usually still workable when margin wasn't imaginary",
              "typically keeps you competitive on small bids",
            ],
          },
          strong: {
            move: [
              "Drop hard on the small ticket",
              "Take a big cut on quick scope on purpose",
              "Move aggressively on a little bid",
              "Give a heavy trim to lock a fast job",
            ],
            anchor: [
              "they want sharp and they'll move if you meet them",
              "small jobs reward crews who can flex fast",
              "margin was strong enough to negotiate hard",
              "the calendar likes small wins too",
            ],
            observation: [
              "This is an aggressive small-job price play",
              "You're leaning in because the job is quick to turn",
              "Sometimes the little ticket needs a big gesture",
            ],
            softener: [
              "often what it takes when they're comparing small bids brutally",
              "usually still OK when your small-job margin was real",
              "typically buys a fast signature and a clean closeout",
            ],
          },
        },
        marginBalanced_largeJob_involved: {
          micro: {
            move: [
              "Ease the big involved bid a hair",
              "Nudge the large ticket on real scope",
              "Tighten the ask slightly at scale",
              "Offer a tiny flex when work is real",
            ],
            anchor: [
              "balanced margin still tolerates a small honest gesture",
              "volume meets involved scope halfway on the move",
              "real work at scale still leaves room for a light give",
              "square count keeps a hair-cut from pinching",
            ],
            observation: [
              "Lots going on, but scale buys a calm, tactical flex",
              "You're not tight — you're being practical with volume",
              "Small moves read fair when margin isn't deep-thin",
            ],
            softener: [
              "often reads cooperative without sounding soft",
              "usually still keeps the math boringly stable",
              "typically easier for them to say yes to",
            ],
          },
          light: {
            move: [
              "Trim the big involved ticket a step",
              "Drop slightly where volume and scope both back you",
              "Give a modest cut on a large real job",
              "Sharpen the large ask while scale helps",
            ],
            anchor: [
              "involved work at volume earns a measured flex",
              "balanced margin carries a light give cleanly",
              "scope is real but the size absorbs a practical trim",
              "profit still feels controlled after the move",
            ],
            observation: [
              "Volume and real work both show up in the total",
              "This is a balanced negotiation move, not panic",
              "Buyers notice when big numbers move a little fairly",
            ],
            softener: [
              "often helps the close without changing the story",
              "usually still sounds steady, not desperate",
              "typically lands cleaner than a stubborn sticker price",
            ],
          },
          moderate: {
            move: [
              "Cut a noticeable step on a big involved ticket",
              "Move the large number down in a measured way",
              "Give a real trim where volume does the lifting",
              "Take a firm concession backed by square footage",
            ],
            anchor: [
              "scope's real but scale still eats the hit cleanly",
              "balanced margin survives a meaningful flex here",
              "involved work at size still prints after a bigger give",
              "the job stays honest after a real negotiation move",
            ],
            observation: [
              "This is disciplined price movement at scale",
              "You're trading margin for momentum with eyes open",
              "Totals matter more when the roof is big and real",
            ],
            softener: [
              "often the right move when they're comparing large bids",
              "usually still easier to defend than it feels",
              "typically keeps you competitive without sounding cheap",
            ],
          },
          strong: {
            move: [
              "Drop hard on a big involved ticket",
              "Take a big cut where scale and scope both back the story",
              "Move the large number sharply with volume behind you",
              "Give a heavy trim because size can carry real work",
            ],
            anchor: [
              "volume and scope together absorb a serious flex",
              "balanced margin can still wear an aggressive stance at size",
              "the bid had enough honesty to flex hard",
              "real work at scale is why the big drop can still read real",
            ],
            observation: [
              "This is an aggressive stance only big spreads earn",
              "You're leaning in because the math allows it",
              "Meaningful trims need a believable story — volume helps",
            ],
            softener: [
              "often what it takes when the job is worth fighting for",
              "usually still workable when margin was real",
              "typically separates a booked week from an empty one",
            ],
          },
        },
        marginBalanced_largeJob_clean: {
          micro: {
            move: [
              "Ease the big walkable bid a hair",
              "Nudge the large simple number slightly",
              "Tighten the clean big ticket a touch",
              "Polish the price on easy scope at scale",
            ],
            anchor: [
              "volume rides a tiny flex without drama",
              "balanced margin makes the gesture cheap",
              "clean at scale barely notices a small sharpen",
              "walkable square count keeps the move honest",
            ],
            observation: [
              "Big easy jobs still expect a little room on the ask",
              "You're tactical — not funding charity work",
              "Small gives read confident when scope is simple",
            ],
            softener: [
              "often reads fair without sounding apologetic",
              "usually still leaves you looking sharp",
              "typically an easy concession when schedule matters",
            ],
          },
          light: {
            move: [
              "Trim the big clean ticket a step",
              "Drop slightly where simple scale carries the give",
              "Give a modest cut on a large walkable job",
              "Sharpen the big ask while volume backs you",
            ],
            anchor: [
              "easy work at scale absorbs a light trim cleanly",
              "balanced margin meets big square count halfway",
              "nothing tricky punishes the move on the ground",
              "profit still feels boringly stable after the flex",
            ],
            observation: [
              "This is a calm, volume-backed negotiation move",
              "Buyers like seeing movement on big, simple numbers",
              "You're buying cooperation without hidden risk",
            ],
            softener: [
              "often enough to break a stalemate politely",
              "usually still sounds like you know your production costs",
              "typically easier to say yes to than a stubborn total",
            ],
          },
          moderate: {
            move: [
              "Cut a real step on a big clean ticket",
              "Move the large walkable number down meaningfully",
              "Give a noticeable trim backed by scale",
              "Take a serious give where volume carries it",
            ],
            anchor: [
              "simple at scale eats a bigger flex without squeaking",
              "balanced margin buys a real negotiation move",
              "walkable work keeps a meaningful give believable",
              "the spread still feels honest after the flex",
            ],
            observation: [
              "This is where size becomes your negotiating friend",
              "You're trading a slice of margin for momentum",
              "Big tickets reward crews who can move with confidence",
            ],
            softener: [
              "often the right move when they're comparing totals",
              "usually still safer than it feels in the moment",
              "typically keeps you competitive without sounding cheap",
            ],
          },
          strong: {
            move: [
              "Drop hard on the big clean ticket",
              "Take a big cut at walkable scale on purpose",
              "Move the large number sharply with volume behind you",
              "Give a heavy trim because scale can carry easy scope",
            ],
            anchor: [
              "square footage is absorbing a real move",
              "balanced margin was honest enough to negotiate hard",
              "nothing complicated turns the flex into a trap mid-job",
              "the bid had room for a serious flex at size",
            ],
            observation: [
              "This is an aggressive stance only big spreads earn",
              "You're leaning in because the risk profile is controlled",
              "Sometimes the simplest big job is the hardest price fight",
            ],
            softener: [
              "often what it takes when they're comparing clean bids brutally",
              "usually still workable when you priced with discipline",
              "typically the difference between second call and signed",
            ],
          },
        },
        marginBalanced_midJob_involved: {
          micro: {
            move: [
              "Ease the involved mid bid a hair",
              "Nudge the mid ticket on real scope",
              "Tighten the ask slightly on involved mids",
              "Offer a tiny flex when work is real",
            ],
            anchor: [
              "fair margin keeps a small sharpen honest",
              "real scope still tolerates a light gesture",
              "balanced spread meets involved work halfway",
              "the work earns back what you give on a small move",
            ],
            observation: [
              "Involved mids punish lazy pricing quietly",
              "Small moves read fair when margin isn't tight",
              "This stays tactical — not a heroic give",
            ],
            softener: [
              "often enough to look cooperative",
              "usually still leaves the job feeling paid for",
              "typically easier for them to say yes to",
            ],
          },
          light: {
            move: [
              "Trim the involved mid ticket a step",
              "Drop slightly where real scope stays balanced",
              "Give a modest cut the work can absorb",
              "Sharpen the mid ask without overreaching",
            ],
            anchor: [
              "scope is real but margin still carries a light give",
              "involved work meets fair margin on a measured flex",
              "drop reads honest when crew reality is real",
              "profit holds after a practical trim",
            ],
            observation: [
              "You're buying speed without pretending scope is easy",
              "Buyers respect mids that move when the story is tight",
              "This is balanced voice — not discount panic",
            ],
            softener: [
              "often lands when they're comparing mids seriously",
              "usually still sounds steady, not desperate",
              "typically makes the package harder to pass on",
            ],
          },
          moderate: {
            move: [
              "Cut a noticeable step on involved mid work",
              "Move the middle number down in a measured way",
              "Give a real trim tied to real scope",
              "Take a firm concession the job can still defend",
            ],
            anchor: [
              "involved mids still need margin to stay honest",
              "real work absorbs a meaningful give when margin is fair",
              "balanced spread survives a serious flex here",
              "scope earns what you leave on the table",
            ],
            observation: [
              "This is where real work meets real price talk",
              "Measured cuts read professional on involved mids",
              "You're flexing because the spread allows it",
            ],
            softener: [
              "often the difference between second place and signed",
              "usually still easier to defend than a panic drop",
              "typically keeps you in the hunt without bleeding out",
            ],
          },
        },
        marginBalanced_midJob_clean: {
          micro: {
            move: [
              "Ease the clean mid bid a hair",
              "Nudge the walkable mid number slightly",
              "Tighten the simple mid ask a touch",
              "Polish the middle ticket without drama",
            ],
            anchor: [
              "fair margin makes the gesture cheap",
              "clean scope barely notices a small sharpen",
              "balanced spread tolerates a tiny flex",
              "walkable mids forgive a hair-cut",
            ],
            observation: [
              "Easy mids still deserve clean, calm moves",
              "Small gives read confident when scope is simple",
              "You're tactical on straightforward work",
            ],
            softener: [
              "often enough to signal good faith",
              "usually still keeps margin feeling honest",
              "typically an easy flex to offer first",
            ],
          },
          light: {
            move: [
              "Trim the clean mid ticket a step",
              "Drop slightly on straightforward mid work",
              "Give a modest cut where scope stays simple",
              "Sharpen the mid ask on walkable scope",
            ],
            anchor: [
              "walkable mids carry a light give cleanly",
              "balanced margin meets simple scope halfway",
              "nothing on the ground punishes the move",
              "profit still feels controlled after the flex",
            ],
            observation: [
              "This is a clean mid-market negotiation",
              "Buyers like mids that move a little without drama",
              "You're solving price, not complexity",
            ],
            softener: [
              "often lands when your bid felt a touch proud",
              "usually still sounds confident, not soft",
              "typically makes you easier to say yes to",
            ],
          },
          moderate: {
            move: [
              "Cut a real step on clean mid-size work",
              "Move the middle number down meaningfully",
              "Give a noticeable trim on walkable scope",
              "Take a firm concession where the job stays simple",
            ],
            anchor: [
              "easy scope keeps a bigger flex believable",
              "balanced margin still holds after a meaningful move",
              "mids get compared line by line — a real flex helps",
              "clean work means you're not buying hidden risk",
            ],
            observation: [
              "This is where simple roofs still demand real price talk",
              "You're flexing because the spread allows it",
              "Measured aggression reads professional on easy mids",
            ],
            softener: [
              "often the right trade when three mids are on the table",
              "usually still easier to defend than it feels",
              "typically keeps you competitive without sounding cheap",
            ],
          },
        },
        marginBalanced_smallJob_clean: {
          micro: {
            move: [
              "Ease the small walkable bid a hair",
              "Nudge the quick clean number slightly",
              "Tighten the little ask a touch",
              "Polish a tight small ticket without drama",
            ],
            anchor: [
              "fair margin makes a tiny flex cheap",
              "clean small scope barely notices a sharpen",
              "quick work carries a light give easily",
              "balanced spread tolerates a small gesture",
            ],
            observation: [
              "Little roofs can still drive loud price talk",
              "Small moves wrap fast jobs cleanly",
              "This reads cooperative without sounding soft",
            ],
            softener: [
              "often enough to close a picky small buyer",
              "usually still leaves you looking sharp",
              "typically an easy flex to offer and move on",
            ],
          },
          light: {
            move: [
              "Trim the small clean bid a step",
              "Drop slightly on a quick walkable scope",
              "Give a modest cut on little square footage",
              "Sharpen the small ask where it lands clean",
            ],
            anchor: [
              "they want a tighter number on a small check",
              "quick scope carries a light give easily",
              "margin stays relaxed after a small flex",
              "nothing tricky turns a small give into a trap",
            ],
            observation: [
              "Small tickets still get compared aggressively",
              "This is a quick close conversation, not a seminar",
              "Buyers respect crews that can move on little jobs",
            ],
            softener: [
              "often wraps the job without a second meeting",
              "usually still sounds confident, not soft",
              "typically makes the decision easier to say yes to",
            ],
          },
          moderate: {
            move: [
              "Cut a real step on a small clean ticket",
              "Move the little number down meaningfully",
              "Give a noticeable trim on quick scope",
              "Take a firm concession on a fast, simple job",
            ],
            anchor: [
              "they're pushing because small checks still matter",
              "quick work forgives a bigger flex when margin allows",
              "simple scope stays honest after a meaningful give",
              "balanced margin still holds after a real trim",
            ],
            observation: [
              "This is price pressure on a small roof — still real",
              "Sometimes the smallest jobs are the loudest on price",
              "You're moving because the buyer is blunt",
            ],
            softener: [
              "often the difference between 'think about it' and booked",
              "usually still workable when margin wasn't imaginary",
              "typically keeps you competitive on small bids",
            ],
          },
        },
        priceSensitive_largeJob_neutral: {
          micro: {
            move: [
              "Nudge the big ticket down a hair",
              "Ease the large ask for a shopping buyer",
              "Tighten the big number slightly",
              "Offer a tiny flex at volume",
            ],
            anchor: [
              "they're reading the total hard at this scale",
              "square count makes a small give-back cheap",
              "price pressure shows even when the job is big",
              "margin can wear a gesture without pain",
            ],
            observation: [
              "Big tickets still get compared like everything else",
              "Small moves read decisive when the check is large",
              "This is tactical lane on a price-driven buyer",
            ],
            softener: [
              "often enough to stay in the running",
              "usually still leaves margin honest",
              "typically easier for them to say yes to",
            ],
          },
          light: {
            move: [
              "Trim the big bid a practical step",
              "Drop slightly where scale backs the give",
              "Give a modest cut they can point to",
              "Sharpen the large ask while volume helps",
            ],
            anchor: [
              "they want something tangible to compare at size",
              "scale carries a light trim without drama",
              "margin still holds after a measured flex",
              "the spread can absorb a practical trim",
            ],
            observation: [
              "They're shopping square footage, not poetry",
              "Volume is doing you a favor on the negotiation",
              "Measured moves read professional here",
            ],
            softener: [
              "often lands when the bid felt a hair proud",
              "usually still easier to defend than a bigger drop",
              "typically makes the package harder to pass on",
            ],
          },
          moderate: {
            move: [
              "Cut a noticeable step on the large ticket",
              "Move the big number down in a serious but safe way",
              "Give a real trim tied to staying competitive",
              "Take a firmer concession without sounding panicked",
            ],
            anchor: [
              "they're pushing because the total matters",
              "scale still eats a meaningful hit cleanly",
              "margin survives when the job is this big",
              "you're trading dollars for position, not pride",
            ],
            observation: [
              "This is where price discipline meets real square count",
              "You're buying attention with margin you can access",
              "Buyers respect crews who can move without flinching",
            ],
            softener: [
              "often what it takes when they're comparing three bids",
              "usually still reads as disciplined, not desperate",
              "typically keeps you credible while staying competitive",
            ],
          },
          strong: {
            move: [
              "Drop hard on the big ticket",
              "Take a big visible step on price at scale",
              "Move aggressively because the lane demands it",
              "Give a heavy trim tied to anchoring the close",
            ],
            anchor: [
              "they're shopping this hard because it's a big check",
              "scale absorbs a real move without breaking the job",
              "margin was healthy enough to negotiate with",
              "the close is probably coming down to the bottom line",
            ],
            observation: [
              "This is a price fight on a big roof, plain and simple",
              "Volume is the reason this move can still read sane",
              "You're leaning in because the math allows it",
            ],
            softener: [
              "often the move when you want the work on the board",
              "usually still workable when margin was honest upfront",
              "typically what separates a busy crew from an empty calendar",
            ],
          },
        },
        priceSensitive_midJob_neutral: {
          micro: {
            move: [
              "Nudge the mid ticket down a hair",
              "Ease the middle ask for a sharp buyer",
              "Tighten the mid number slightly",
              "Offer a tiny flex on a balanced job",
            ],
            anchor: [
              "they want a cleaner number on a mid-size check",
              "price pressure shows even when scope is moderate",
              "margin can wear a small gesture without drama",
              "balanced jobs still get shopped hard",
            ],
            observation: [
              "Mids get compared line by line",
              "Small moves read fair when margin holds",
              "This wraps faster when the number moves a touch",
            ],
            softener: [
              "often enough to stay in the conversation",
              "usually still sounds like you know your costs",
              "typically an easy flex to offer first",
            ],
          },
          light: {
            move: [
              "Trim the mid bid a practical step",
              "Drop slightly where the move stays fair",
              "Give a modest cut they can point to",
              "Sharpen the mid ask in a controlled way",
            ],
            anchor: [
              "they want something tangible to compare",
              "margin still holds after a light give",
              "the job can carry a tactical trim",
              "fair margin meets a price-first buyer halfway",
            ],
            observation: [
              "This is competitive work, not a lecture",
              "They're comparing, not admiring",
              "A measured move reads professional here",
            ],
            softener: [
              "often lands when the bid felt a hair proud",
              "usually still easier to defend than a bigger drop",
              "typically makes the package harder to pass on",
            ],
          },
          moderate: {
            move: [
              "Cut a noticeable step toward their world",
              "Move the mid number down in a serious but safe way",
              "Give a real trim tied to staying competitive",
              "Take a firmer concession without sounding desperate",
            ],
            anchor: [
              "they're pushing because the market is noisy",
              "margin still survives a meaningful flex",
              "honest margin keeps the drop from sounding panicked",
              "the scope still earns what you're leaving",
            ],
            observation: [
              "This is the part of the call where numbers do the talking",
              "You're past small talk on price",
              "Buyers respect crews who can move without flinching",
            ],
            softener: [
              "often the difference between second place and signed",
              "usually still reads as disciplined, not panicked",
              "typically keeps you in range without sounding cheap",
            ],
          },
          strong: {
            move: [
              "Drop hard to meet a hungry buyer",
              "Take a big visible step on a mid-size ticket",
              "Move aggressively because the lane demands it",
              "Give a heavy trim while keeping margin honest",
            ],
            anchor: [
              "they're shopping mids like a commodity",
              "margin was strong enough to negotiate with",
              "you're buying position with dollars you can access",
              "the close is probably coming down to the bottom line",
            ],
            observation: [
              "This is a price war voice, not a premium sermon",
              "You're leaning in because you want the work",
              "Sometimes the number has to move a lot to matter",
            ],
            softener: [
              "often what it takes when three bids are on the table",
              "usually still workable when margin wasn't fiction",
              "typically the move when empty trucks cost more than pride",
            ],
          },
        },
        priceSensitive_smallJob_neutral: {
          micro: {
            move: [
              "Nudge the small ticket down a hair",
              "Ease the quick ask for a sharp buyer",
              "Tighten the little number slightly",
              "Offer a tiny flex on fast scope",
            ],
            anchor: [
              "they want a clean, sharp small total",
              "quick scope makes a tiny flex cheap",
              "small checks still get compared brutally",
              "margin can wear a gesture without pain",
            ],
            observation: [
              "Fast jobs deserve fast, clean moves",
              "Little roofs can still drive loud price talk",
              "This wraps faster when the number moves a touch",
            ],
            softener: [
              "often enough to close a picky small buyer",
              "usually still leaves you looking sharp",
              "typically an easy flex to offer and move on",
            ],
          },
          light: {
            move: [
              "Trim the small bid a step",
              "Drop slightly on a quick ticket",
              "Give a modest cut on little square footage",
              "Sharpen the small ask where it lands clean",
            ],
            anchor: [
              "they want a tighter number on a small check",
              "quick scope carries a light give easily",
              "margin stays relaxed after a small flex",
              "you're buying speed, not negotiating a saga",
            ],
            observation: [
              "Small tickets still get compared aggressively",
              "This is a quick close conversation, not a seminar",
              "Buyers respect crews that can move on little jobs",
            ],
            softener: [
              "often wraps the job without a second meeting",
              "usually still sounds confident, not soft",
              "typically makes the decision easier to say yes to",
            ],
          },
          moderate: {
            move: [
              "Cut a real step on the small ticket",
              "Move the little number down meaningfully",
              "Give a noticeable trim on quick scope",
              "Take a firm concession on a fast job",
            ],
            anchor: [
              "they're pushing because small checks still matter",
              "quick work forgives a bigger flex when margin allows",
              "the scope stays simple after a meaningful give",
              "margin still holds after a real trim",
            ],
            observation: [
              "This is price pressure on a small roof — still real",
              "You're moving because the buyer is blunt",
              "Sometimes the smallest jobs are the loudest on price",
            ],
            softener: [
              "often the difference between 'think about it' and booked",
              "usually still workable when margin wasn't imaginary",
              "typically keeps you competitive on small bids",
            ],
          },
          strong: {
            move: [
              "Drop hard on the small ticket",
              "Take a big cut on quick scope on purpose",
              "Move aggressively on a little bid",
              "Give a heavy trim to lock a fast job",
            ],
            anchor: [
              "they want sharp and they'll move if you meet them",
              "small jobs reward crews who can flex fast",
              "margin was strong enough to negotiate hard",
              "the calendar likes small wins too",
            ],
            observation: [
              "This is an aggressive small-job price play",
              "You're leaning in because the job is quick to turn",
              "Sometimes the little ticket needs a big gesture",
            ],
            softener: [
              "often what it takes when they're comparing small bids brutally",
              "usually still OK when your small-job margin was real",
              "typically buys a fast signature and a clean closeout",
            ],
          },
        },
        marginBalanced_largeJob_neutral: {
          micro: {
            move: [
              "Ease the large bid a hair on fair margin",
              "Nudge the big number slightly",
              "Tighten the big ticket a touch",
              "Offer a tiny flex where scale helps",
            ],
            anchor: [
              "balanced margin still tolerates a small honest gesture",
              "volume keeps the move from pinching",
              "fair spread meets big square count halfway",
              "the total can move a touch without drama",
            ],
            observation: [
              "Big jobs often expect a little room on the ask",
              "You're not bleeding — you're being practical",
              "Square footage buys you a small gesture",
            ],
            softener: [
              "often reads fair without sounding apologetic",
              "usually still keeps the math boringly stable",
              "typically an easy move when the schedule matters",
            ],
          },
          light: {
            move: [
              "Trim the big ticket slightly",
              "Drop a step where volume carries the give",
              "Give a modest cut on a large scope",
              "Sharpen the large ask while scale backs the move",
            ],
            anchor: [
              "balanced margin meets big square count halfway",
              "you're not tight enough for this to hurt",
              "the size of the job absorbs a practical flex",
              "profit still feels controlled after the move",
            ],
            observation: [
              "This is a calm, volume-backed negotiation move",
              "Buyers like seeing movement on big numbers",
              "You're buying cooperation without charity work",
            ],
            softener: [
              "often enough to break a stalemate politely",
              "usually still sounds steady, not desperate",
              "typically easier to say yes to than a stubborn total",
            ],
          },
          moderate: {
            move: [
              "Cut a noticeable step on the large ticket",
              "Move the big number down in a measured way",
              "Give a real trim where scale does the lifting",
              "Take a firm concession backed by square footage",
            ],
            anchor: [
              "volume covers a meaningful give cleanly",
              "balanced margin can still wear a real flex",
              "you're trading margin for momentum, not panic",
              "the job stays honest after a bigger move",
            ],
            observation: [
              "This is disciplined price movement at scale",
              "Totals matter more when the check is large",
              "You're flexing because the roof is big enough to allow it",
            ],
            softener: [
              "often lands when they're comparing big numbers side by side",
              "usually still reads as professional, not weak",
              "typically keeps you in the hunt without bleeding out",
            ],
          },
          strong: {
            move: [
              "Drop meaningfully on the big ticket",
              "Take a big cut where scale saves the story",
              "Move the large number sharply with volume behind you",
              "Give a heavy trim because size can carry it",
            ],
            anchor: [
              "square footage is doing the heavy lifting here",
              "balanced margin meets a big give without breaking",
              "you're buying the close with scale, not fantasy",
              "the bid had enough honesty to flex hard",
            ],
            observation: [
              "This is an aggressive stance only big spreads earn",
              "Volume is the reason this doesn't read as panic",
              "You're leaning in because the math allows it",
            ],
            softener: [
              "often what it takes when the job is worth fighting for",
              "usually still workable when margin was real",
              "typically separates a booked week from an empty one",
            ],
          },
        },
        marginBalanced_midJob_neutral: {
          micro: {
            move: [
              "Ease the mid bid a hair on fair margin",
              "Nudge the middle number slightly",
              "Tighten the mid ticket a touch",
              "Offer a tiny flex on balanced spread",
            ],
            anchor: [
              "fair margin makes the gesture cheap",
              "balanced spread tolerates a small sharpen",
              "nothing tight here fights a hair-cut",
              "honest margin keeps the move from sounding weak",
            ],
            observation: [
              "Mids punish soft pricing quietly",
              "Small moves read steady when margin is fair",
              "This is tactical, not emotional",
            ],
            softener: [
              "often enough to look cooperative",
              "usually still keeps margin feeling honest",
              "typically an easy flex to signal good faith",
            ],
          },
          light: {
            move: [
              "Trim the mid ticket a step",
              "Drop slightly where the move reads fair",
              "Give a modest cut on balanced margin",
              "Sharpen the mid ask without drama",
            ],
            anchor: [
              "fair margin meets a price conversation halfway",
              "drop reads balanced — no strain",
              "profit still feels controlled after the flex",
              "walkable mids carry a light give cleanly",
            ],
            observation: [
              "This is a clean mid-market negotiation",
              "Buyers like mids that move a little without drama",
              "Measured flex reads professional here",
            ],
            softener: [
              "often lands when your bid felt a touch proud",
              "usually still sounds confident, not soft",
              "typically makes you easier to say yes to",
            ],
          },
          moderate: {
            move: [
              "Cut a noticeable step on fair mid work",
              "Move the middle number down meaningfully",
              "Give a real trim tied to honest margin",
              "Take a firm concession that stays balanced",
            ],
            anchor: [
              "balanced margin survives a meaningful flex",
              "mid-size totals still need discipline",
              "the scope still earns what you're leaving",
              "profit holds after a real negotiation move",
            ],
            observation: [
              "This is where simple honesty beats stubborn stickers",
              "You're flexing because the spread allows it",
              "Real trim can still hold the work when margin is fair",
            ],
            softener: [
              "often the right trade when three mids are on the table",
              "usually still easier to defend than it feels",
              "typically keeps you competitive without sounding cheap",
            ],
          },
          strong: {
            move: [
              "Drop hard while keeping margin honest",
              "Take a big visible step on a mid-size ticket",
              "Move aggressively but stay inside fair math",
              "Give a heavy trim that still holds the work",
            ],
            anchor: [
              "you've got enough room — just stay fair",
              "balanced margin was real enough to negotiate with",
              "mids still break crews that flex without discipline",
              "the close shouldn't turn the job into charity work",
            ],
            observation: [
              "Sometimes the number has to move a lot to matter",
              "This is still a balanced move — not a panic",
              "Buyers respect crews who can move without flinching",
            ],
            softener: [
              "often what it takes when they're comparing mids brutally",
              "usually still workable when margin wasn't fiction",
              "typically the move when empty trucks cost more than pride",
            ],
          },
        },
        marginBalanced_smallJob_involved: {
          micro: {
            move: [
              "Ease the small involved bid a hair",
              "Nudge the tight scope number slightly",
              "Tighten the little ask on real small work",
              "Offer a tiny flex when scope is real",
            ],
            anchor: [
              "fair margin keeps a small sharpen honest",
              "tight scope still tolerates a light gesture",
              "real work on a quick roof earns a measured flex",
              "balanced spread meets involved small work halfway",
            ],
            observation: [
              "Small involved jobs still need honest pricing",
              "Tiny scopes can still hide real work",
              "This reads fair without sounding apologetic",
            ],
            softener: [
              "often enough to break a polite stalemate",
              "usually still leaves the job feeling paid for",
              "typically easier for them to say yes to",
            ],
          },
          light: {
            move: [
              "Trim the small involved ticket a step",
              "Drop slightly where real scope stays balanced",
              "Give a modest cut the work can absorb",
              "Sharpen the small ask without overreaching",
            ],
            anchor: [
              "tight scope backs a light give when margin is fair",
              "the work earns back what you give on a small move",
              "involved small jobs still print after a practical trim",
              "profit holds after a measured flex",
            ],
            observation: [
              "You're buying speed without pretending scope is easy",
              "Small real jobs deserve clean, calm moves",
              "This is balanced voice — not discount panic",
            ],
            softener: [
              "often lands when they're comparing small bids seriously",
              "usually still sounds steady, not desperate",
              "typically makes the package harder to pass on",
            ],
          },
          moderate: {
            move: [
              "Cut a noticeable step on small involved work",
              "Move the little number down in a measured way",
              "Give a real trim tied to tight scope",
              "Take a firm concession the job can still defend",
            ],
            anchor: [
              "real work absorbs a meaningful give when margin is fair",
              "tight scope still needs honest margin afterward",
              "balanced spread survives a serious flex here",
              "the work earns what you leave on the table",
            ],
            observation: [
              "This is price pressure on a small roof — still real",
              "Measured cuts read professional on involved small jobs",
              "You're flexing because the spread allows it",
            ],
            softener: [
              "often the difference between 'think about it' and booked",
              "usually still easier to defend than a panic drop",
              "typically keeps you competitive on small bids",
            ],
          },
          strong: {
            move: [
              "Drop hard on a small involved ticket",
              "Take a big cut where tight scope still carries",
              "Move aggressively on little real work",
              "Give a heavy trim that still stays fair",
            ],
            anchor: [
              "scope carries it when margin was honest upfront",
              "small real jobs still need cushion after a big flex",
              "tight work meets fair margin on an aggressive stance",
              "the calendar likes small wins — not small disasters",
            ],
            observation: [
              "Sometimes the little ticket needs a big gesture",
              "This is still a real-job story — not fantasy scope",
              "You're leaning in because the buyer is blunt",
            ],
            softener: [
              "often what it takes when they're comparing small bids brutally",
              "usually still OK when your small-job margin was real",
              "typically buys a fast signature and a clean closeout",
            ],
          },
        },
      },
      "hold-firmly": {
        marginDeepThin: [
          "Margin's thin — don't give any back on this one.",
          "You're already tight here — any drop hurts.",
          "Nothing to spare on margin — hold the number.",
        ],
        laborHeavy: [
          "Labor's heavy — no safe room to drop here.",
          "With this much labor, you can't afford to give back.",
          "Hold it — the labor already eats what little room you have.",
        ],
        scopeExtreme: [
          "Scope is extreme — a drop puts this job at risk.",
          "Too much work here to discount — hold the number.",
          "Heavy scope leaves no safe margin to give up.",
        ],
      },
      "hold-the-line-value": {
        alreadyCompetitiveThin: [
          "Already sharp and thin on margin — nothing to give.",
          "You're competitive as-is — a drop costs more than it wins.",
          "Can't sharpen further without bleeding on this one.",
        ],
        alreadyCompetitive: [
          "Already the sharp price on this job — leave it alone.",
          "You're competitive as-is — nothing sharper to hand over.",
          "This is the tight number — don't chase it lower.",
        ],
        complexElevatedLabor: [
          "Complex work with real labor — no safe room to drop.",
          "Labor's running, scope's complex — nothing to give back.",
          "Hold it — the complexity is already pulling on margin.",
        ],
        scopeExtreme: [
          "Scope is too heavy to discount — hold the number.",
          "Real work on the ground — no room to chase a lower price.",
          "Heavy scope makes a drop unsafe here.",
        ],
        marginBalanced: [
          "Margin's balanced — a drop costs more than it buys.",
          "You're fair as-is — no point giving margin back here.",
          "Hold the number — discounting trades profit for little.",
        ],
      },
      "hold-the-line-premium": {
        wellPositionedPremiumTier: [
          "Already premium on strong margin — nothing to push for.",
          "You're well-positioned — a lift won't stick here.",
          "Top tier already with real profit — leave it be.",
        ],
        wellPositioned: [
          "Estimate's already strong — no credible room to push higher.",
          "You're where you should be — a lift won't hold.",
          "Positioning's solid — don't reach for more here.",
        ],
        simpleStrongMargin: [
          "Simple job with strong margin — a lift won't land.",
          "Easy scope at healthy profit — hard to justify more.",
          "Nothing on this one to support a push — hold it.",
        ],
        tierPremium: [
          "Already at premium tier — no story left for a bump.",
          "You're at the top — pushing higher lacks a reason.",
          "Premium already — no upgrade room on this one.",
        ],
        priceSensitive: [
          "They're on price — pushing higher loses this one.",
          "Buyer's shopping — a lift will cost you the close.",
          "Don't push — they'll walk if the number goes up.",
        ],
      },
      "lift-slightly": {
        correctionShallow_scopeExtreme: {
          micro: [
            "Scope is heavy — nudge it up, margin's too thin for this work.",
            "Extreme scope needs a touch more — the math is tight.",
            "Small raise here — you're under on what this job actually is.",
          ],
          light: [
            "Bump it slightly — extreme scope deserves more than this price.",
            "Heavy work on thin margin — push it up a bit to make it honest.",
            "Raise it a touch — scope is way ahead of the current number.",
          ],
          moderate: [
            "Push it up real — extreme scope, margin's too thin to ignore.",
            "Real raise here — the work far outruns this price.",
            "Bump it noticeably — scope says more than the number does.",
          ],
          strong: [
            "Big raise needed — extreme scope, margin's got nowhere to go.",
            "Push hard — the work's way ahead of what you're charging.",
            "Correct meaningfully — this job is plainly under-priced.",
          ],
        },
        correctionShallow_laborHeavy_impact: {
          micro: [
            "Heavy labor plus impact material — nudge it up, price is behind.",
            "Small bump — you're under on labor and the material premium.",
            "Push a touch — real cost is ahead of this number.",
          ],
          light: [
            "Bump it slightly — labor's heavy and the material earns more.",
            "Push it up a bit — impact and labor both deserve the raise.",
            "Raise it a touch — real cost justifies a small move up.",
          ],
          moderate: [
            "Push it up — heavy labor with impact material deserves more.",
            "Real raise — the cost of this work is ahead of the price.",
            "Bump it noticeably — labor and material both earn the move.",
          ],
          strong: [
            "Big raise — heavy labor plus impact material, you're well under.",
            "Push hard — real cost outruns the price meaningfully here.",
            "Correct real — labor and material both earn a bigger number.",
          ],
        },
        correctionShallow_laborHeavy: {
          micro: [
            "Labor's running heavy — nudge it up, margin's tight.",
            "Small raise — labor cost is ahead of the current price.",
            "Push a touch — you're under on what the labor really costs.",
          ],
          light: [
            "Bump it slightly — heavy labor earns more than this number.",
            "Push it up a bit — margin won't carry this labor as-is.",
            "Raise it a touch — labor cost outruns the math here.",
          ],
          moderate: [
            "Real raise — heavy labor on thin margin needs a real bump.",
            "Push it up — labor cost is clearly ahead of the price.",
            "Bump it noticeably — the labor deserves a fair number.",
          ],
          strong: [
            "Big raise — heavy labor, thin margin, you're well under here.",
            "Push hard — labor cost far outruns what you're charging.",
            "Correct meaningfully — the work needs a real number.",
          ],
        },
        correctionShallow_complex_impact: {
          micro: [
            "Complex scope with impact material — nudge it up, price is behind.",
            "Small raise — complexity and the material premium both add cost.",
            "Push a touch — you're under on a complex job with real material.",
          ],
          light: [
            "Bump it slightly — complex work with impact material earns more.",
            "Push it up a bit — the scope and material both deserve it.",
            "Raise it a touch — real cost is ahead of this number.",
          ],
          moderate: [
            "Real raise — complex scope plus impact material, you're under.",
            "Push it up — the work is clearly ahead of the price.",
            "Bump it noticeably — complexity and material both earn the move.",
          ],
          strong: [
            "Big raise — complex job with impact material, you're well under.",
            "Push hard — scope and material both outrun the current number.",
            "Correct meaningfully — this one deserves a real move up.",
          ],
        },
        correctionShallow_complex: {
          micro: [
            "Complex work on tight margin — nudge it up, price is behind.",
            "Small raise — the complexity earns more than this number.",
            "Push a touch — scope outruns the current price.",
          ],
          light: [
            "Bump it slightly — complex scope deserves a fair number.",
            "Push it up a bit — margin's tight for what this actually is.",
            "Raise it a touch — complexity is ahead of the price here.",
          ],
          moderate: [
            "Real raise — complex job on thin margin, you're under.",
            "Push it up — scope clearly outruns the current number.",
            "Bump it noticeably — the work deserves more than this price.",
          ],
          strong: [
            "Big raise — complex scope, thin margin, you're well under.",
            "Push hard — complexity far outruns what you're charging.",
            "Correct meaningfully — this one needs a real number.",
          ],
        },
        correctionShallow_impact: {
          micro: [
            "Impact material isn't fully priced — nudge it up.",
            "Small raise — you're under on the material premium here.",
            "Push a touch — real cost of the material outruns the price.",
          ],
          light: [
            "Bump it slightly — impact material deserves the premium.",
            "Push it up a bit — the material earns more than this number.",
            "Raise it a touch — impact-rated work needs to be priced for it.",
          ],
          moderate: [
            "Real raise — impact material is under-priced on this one.",
            "Push it up — the material premium isn't in the number yet.",
            "Bump it noticeably — impact work deserves real pricing.",
          ],
          strong: [
            "Big raise — impact material is well under-priced here.",
            "Push hard — the material premium is completely missing.",
            "Correct meaningfully — impact work earns a real move up.",
          ],
        },
        tightMargin_largeJob: {
          micro: [
            "Big job on tight margin — nudge it up, protect the work.",
            "Small raise — at this scale you can't afford to run thin.",
            "Push a touch — tight margin on a big job needs cushion.",
          ],
          light: [
            "Bump it slightly — tight margin on a big job isn't safe.",
            "Push it up a bit — protect yourself at this size.",
            "Raise it a touch — the scale needs a healthier margin.",
          ],
          moderate: [
            "Real raise — big job on tight margin, you're exposed.",
            "Push it up — at this size you need real cushion.",
            "Bump it noticeably — scale and thin margin don't mix well.",
          ],
          strong: [
            "Big raise — large job on tight margin, the risk is real.",
            "Push hard — you need real margin at this scale.",
            "Correct meaningfully — thin margin on a big job is dangerous.",
          ],
        },
        tightMargin_midJob: {
          micro: [
            "Mid-size job on tight margin — nudge it up, protect the math.",
            "Small raise — margin's too thin for the work involved.",
            "Push a touch — you need cushion on this one.",
          ],
          light: [
            "Bump it slightly — tight margin on a mid-size isn't safe.",
            "Push it up a bit — protect yourself on this one.",
            "Raise it a touch — margin needs room for this scope.",
          ],
          moderate: [
            "Real raise — mid-size on tight margin needs protection.",
            "Push it up — margin's not enough for what this is.",
            "Bump it noticeably — you need room on this job.",
          ],
          strong: [
            "Big raise — mid-size on very tight margin, real correction.",
            "Push hard — margin's too thin for the work here.",
            "Correct meaningfully — this one needs real cushion.",
          ],
        },
        strongPositioning_balanced: {
          micro: [
            "You're well-positioned — nudge it up, it'll hold.",
            "Small raise — positioning is strong enough to carry it.",
            "Push a touch — customer reads you as the right choice.",
          ],
          light: [
            "Bump it slightly — positioning holds a small raise easily.",
            "Push it up a bit — you've got the trust to carry it.",
            "Raise it a touch — they'll take it, you're positioned right.",
          ],
          moderate: [
            "Real raise — positioning is strong enough to defend it.",
            "Push it up — you've got the standing to hold a real number.",
            "Bump it noticeably — no pushback coming at this positioning.",
          ],
          strong: [
            "Big raise — your positioning easily backs a real move up.",
            "Push hard — they trust you, the raise holds without issue.",
            "Correct meaningfully — positioning gives you the room.",
          ],
        },
        impactMaterial: {
          micro: [
            "Impact material earns a touch of premium — nudge it up.",
            "Small raise — impact-rated work is worth more than standard.",
            "Push a touch — the material deserves a small premium.",
          ],
          light: [
            "Bump it slightly — impact material carries real premium.",
            "Push it up a bit — this material is worth more than the price.",
            "Raise it a touch — impact-rated work earns the premium.",
          ],
          moderate: [
            "Real raise — impact material deserves real premium.",
            "Push it up — this material is clearly worth more.",
            "Bump it noticeably — impact work earns a real premium.",
          ],
          strong: [
            "Big raise — impact material earns meaningful premium.",
            "Push hard — the material is significantly under-priced.",
            "Correct real — impact work deserves a real move up.",
          ],
        },
        correctionShallow_complex_largeJob: {
          light: [
            "Big complex job on tight margin — bump it slightly up.",
            "Push it up a bit — complexity at scale needs room.",
            "Raise it a touch — big complex work deserves the move.",
          ],
          moderate: [
            "Real raise — complex big job on thin margin, you're under.",
            "Push it up — the scope and scale both earn a real move.",
            "Bump it noticeably — complexity at this size deserves more.",
          ],
          strong: [
            "Big raise — complex big job, margin's too thin to hold.",
            "Push hard — scope and scale both outrun the number.",
            "Correct meaningfully — this one's well under-priced.",
          ],
        },
        correctionShallow_complex_midJob: {
          light: [
            "Complex mid-size on tight margin — bump it up slightly.",
            "Push it up a bit — complexity deserves more on this one.",
            "Raise it a touch — the scope earns the move.",
          ],
          moderate: [
            "Real raise — complex mid-size, you're under on the work.",
            "Push it up — scope clearly earns more than this price.",
            "Bump it noticeably — complex work deserves real pricing.",
          ],
          strong: [
            "Big raise — complex mid-size, margin's far too thin.",
            "Push hard — the scope far outruns what you're charging.",
            "Correct meaningfully — this one needs a real number.",
          ],
        },
        correctionShallow_laborHeavy_largeJob: {
          light: [
            "Heavy labor at scale — bump it slightly, cost is ahead.",
            "Push it up a bit — big job with real labor earns more.",
            "Raise it a touch — labor cost outruns the price here.",
          ],
          moderate: [
            "Real raise — heavy labor on a big job deserves more.",
            "Push it up — labor is clearly ahead of the number at scale.",
            "Bump it noticeably — big labor-heavy work earns the move.",
          ],
          strong: [
            "Big raise — heavy labor at scale, you're well under.",
            "Push hard — the labor cost far outruns the price here.",
            "Correct meaningfully — big labor-heavy job needs real pricing.",
          ],
        },
        correctionShallow_laborHeavy_midJob: {
          light: [
            "Heavy labor on a mid-size — bump it slightly, cost is ahead.",
            "Push it up a bit — real labor deserves more on this one.",
            "Raise it a touch — labor cost earns the move.",
          ],
          moderate: [
            "Real raise — heavy labor on a mid-size, you're under.",
            "Push it up — labor clearly outruns the current number.",
            "Bump it noticeably — the labor earns a real move up.",
          ],
          strong: [
            "Big raise — heavy labor, mid-size, well under-priced.",
            "Push hard — labor cost far outruns the price here.",
            "Correct meaningfully — this one needs real pricing.",
          ],
        },
        correctionShallow_impact_largeJob: {
          light: [
            "Big job on impact material — bump it slightly, price is behind.",
            "Push it up a bit — impact material at scale earns more.",
            "Raise it a touch — you're under on the material premium.",
          ],
          moderate: [
            "Real raise — impact material at scale is under-priced.",
            "Push it up — the material premium isn't fully in the number.",
            "Bump it noticeably — big impact-rated work earns it.",
          ],
          strong: [
            "Big raise — impact material at scale, you're well under.",
            "Push hard — material premium is far behind the real cost.",
            "Correct meaningfully — impact work at this size earns more.",
          ],
        },
        correctionShallow_impact_midJob: {
          light: [
            "Impact material mid-size — bump it slightly, price is behind.",
            "Push it up a bit — the material premium earns more.",
            "Raise it a touch — impact work on a mid-size deserves it.",
          ],
          moderate: [
            "Real raise — impact material on a mid-size, under-priced.",
            "Push it up — the material premium isn't fully captured.",
            "Bump it noticeably — impact work earns the move.",
          ],
          strong: [
            "Big raise — impact material, mid-size, well under.",
            "Push hard — material premium is far behind real cost.",
            "Correct meaningfully — impact work needs real pricing.",
          ],
        },
        tightMargin_midJob_involved: {
          light: [
            "Mid-size with real scope on tight margin — bump it slightly.",
            "Push it up a bit — the work earns more than the price.",
            "Raise it a touch — tight margin for real work isn't safe.",
          ],
          moderate: [
            "Real raise — involved mid-size on tight margin needs cushion.",
            "Push it up — the work outruns the current number.",
            "Bump it noticeably — real scope deserves real pricing.",
          ],
          strong: [
            "Big raise — mid-size with real scope, margin's too thin.",
            "Push hard — the work far outruns the current number.",
            "Correct meaningfully — real scope needs real margin.",
          ],
        },
        impactMaterial_involved: {
          light: [
            "Impact material on real scope — bump it slightly, premium is earned.",
            "Push it up a bit — involved work with real material deserves it.",
            "Raise it a touch — material and scope both carry premium.",
          ],
          moderate: [
            "Real raise — impact material on involved scope, under-priced.",
            "Push it up — material and real work both earn the move.",
            "Bump it noticeably — this combo carries real premium.",
          ],
          strong: [
            "Big raise — impact material on real scope, well under.",
            "Push hard — both material and scope outrun the price.",
            "Correct meaningfully — this one's earning real premium.",
          ],
        },
        strongPositioning_involved: {
          light: [
            "Strong positioning on real scope — bump it slightly, it holds.",
            "Push it up a bit — you've got standing even with the scope.",
            "Raise it a touch — positioning plus real work backs the move.",
          ],
          moderate: [
            "Real raise — positioning holds a real move on involved work.",
            "Push it up — you've got standing for a real number here.",
            "Bump it noticeably — scope and positioning both back it.",
          ],
          strong: [
            "Big raise — positioning backs a real correction on real work.",
            "Push hard — you've got the standing to defend a real move.",
            "Correct meaningfully — positioning gives you the room.",
          ],
        },
        correctionShallow_steep_laborHeavy: {
          light: [
            "Steep pitch, heavy labor — bump it slightly, cost is ahead.",
            "Push it up a bit — steep work earns real cost coverage.",
            "Raise it a touch — pitch and labor both deserve more.",
          ],
          moderate: [
            "Real raise — steep and labor-heavy, you're under on cost.",
            "Push it up — pitch plus labor outruns the number clearly.",
            "Bump it noticeably — this combo earns real pricing.",
          ],
          strong: [
            "Big raise — steep roof, heavy labor, you're well under.",
            "Push hard — real cost far outruns the current price.",
            "Correct meaningfully — pitch and labor both need room.",
          ],
        },
        liftRoom_largeJob_involved: {
          micro: [
            "Big involved job — nudge it up, scope earns more.",
            "Small raise — the work on the ground is ahead of the price.",
            "Push a touch — scope at this scale carries a bigger number.",
          ],
          light: [
            "Bump it up — big involved job deserves more than this.",
            "Push it slightly — scope at scale easily backs the raise.",
            "Raise it a bit — volume plus real work earn a fair number.",
          ],
          moderate: [
            "Real raise — involved big job, you're under for what it is.",
            "Push it up — scope and scale both outrun the number.",
            "Bump it noticeably — the work at this size earns more.",
          ],
          strong: [
            "Big raise — involved big job is visibly under-priced.",
            "Push hard — the scope and scale both back a real move.",
            "Correct meaningfully — the work deserves a real number.",
          ],
        },
        liftRoom_largeJob_clean: {
          micro: [
            "Clean big job — nudge it up, volume's worth more than this.",
            "Small raise — at this scale, price is a little behind.",
            "Push a touch — walkable at scale still earns a bigger number.",
          ],
          light: [
            "Bump it up — big walkable job can carry a fair raise.",
            "Push it slightly — volume alone earns more than the price.",
            "Raise it a bit — at this scale, the number can move up.",
          ],
          moderate: [
            "Real raise — big clean job is under for what it is.",
            "Push it up — volume clearly earns more than this number.",
            "Bump it noticeably — walkable at scale deserves real pricing.",
          ],
          strong: [
            "Big raise — big clean job is visibly under-priced.",
            "Push hard — volume at this scale far outruns the number.",
            "Correct meaningfully — easy work at scale earns more.",
          ],
        },
        liftRoom_midJob_involved: {
          micro: [
            "Involved mid-size — nudge it up, scope earns more.",
            "Small raise — the work is ahead of what you're charging.",
            "Push a touch — real scope on a mid-size deserves it.",
          ],
          light: [
            "Bump it up — involved mid-size deserves a fair raise.",
            "Push it slightly — scope earns more on this one.",
            "Raise it a bit — the work justifies a real move.",
          ],
          moderate: [
            "Real raise — involved mid-size, you're under for the work.",
            "Push it up — scope clearly outruns the current number.",
            "Bump it noticeably — this work earns more than the price.",
          ],
          strong: [
            "Big raise — involved mid-size is visibly under-priced.",
            "Push hard — the scope far outruns what you're charging.",
            "Correct meaningfully — real work deserves a real number.",
          ],
        },
        liftRoom_midJob_clean: {
          micro: [
            "Clean mid-size — nudge it up, price is a little light.",
            "Small raise — there's honest room on this one.",
            "Push a touch — the number can come up fairly.",
          ],
          light: [
            "Bump it up — walkable mid-size can take a fair raise.",
            "Push it slightly — there's room to move this one up.",
            "Raise it a bit — clean work earns a move up.",
          ],
          moderate: [
            "Real raise — walkable mid-size, you're under fairly.",
            "Push it up — honest room to take a real number here.",
            "Bump it noticeably — simple work deserves more than this.",
          ],
          strong: [
            "Big raise — clean mid-size is under-priced for the work.",
            "Push hard — there's real room to move this one up.",
            "Correct meaningfully — honest scope earns a real move.",
          ],
        },
        liftRoom_smallJob_clean: {
          micro: [
            "Small clean job — nudge it up, the number's a little light.",
            "Small raise — honest room on a simple small scope.",
            "Push a touch — quick job can take a fair move.",
          ],
          light: [
            "Bump it up — small walkable job earns a fair raise.",
            "Push it slightly — simple scope handles a move up.",
            "Raise it a bit — quick clean work earns more than this.",
          ],
          moderate: [
            "Real raise — small clean job is under-priced fairly.",
            "Push it up — quick simple work earns a real move.",
            "Bump it noticeably — this job carries a bigger number honestly.",
          ],
          strong: [
            "Big raise — small clean job is visibly under-priced.",
            "Push hard — easy work at this scope earns a real move.",
            "Correct meaningfully — quick work still deserves real value.",
          ],
        },
        balancedMargin_midJob_involved: {
          micro: [
            "Involved mid-size, fair margin — nudge it up, scope earns more.",
            "Small raise — the work is ahead of the current price.",
            "Push a touch — real work on a mid-size deserves it.",
          ],
          light: [
            "Bump it up — involved mid-size can carry a fair raise.",
            "Push it slightly — scope earns a move up honestly.",
            "Raise it a bit — real work deserves more than this.",
          ],
          moderate: [
            "Real raise — involved mid-size earns more on this scope.",
            "Push it up — the work deserves a real move.",
            "Bump it noticeably — scope backs a real number here.",
          ],
          strong: [
            "Big raise — involved mid-size deserves a real move up.",
            "Push hard — the scope justifies a meaningful number.",
            "Correct meaningfully — real work earns a bigger price.",
          ],
        },
        balancedMargin_midJob_clean: {
          micro: {
            move: [
              "Lift the mid clean bid slightly",
              "Ask for a small bump on walkable mids",
              "Ease the middle number up a touch",
              "Correct lightly where fair margin allows",
            ],
            anchor: [
              "simple mids still deserve honest dollars",
              "balanced spread tolerates a modest nudge",
              "walkable work makes a small lift read steady",
              "the ticket is a little light for what it is",
            ],
            observation: [
              "This is calm, neutral tone on straightforward work",
              "You're aligning the bid, not performing",
              "Mids punish shy pricing without making a scene",
            ],
            softener: [
              "often reads fair when setup was priced conservatively",
              "usually still sounds professional, not pushy",
              "typically an easy correction to offer quietly",
            ],
          },
          light: {
            move: [
              "Raise the mid clean ask a step",
              "Move the middle number up in a measured way",
              "Push a modest lift on walkable mids",
              "Lift the bid where fair margin backs it",
            ],
            anchor: [
              "even margin meets a practical bump halfway",
              "clean scope keeps the story believable",
              "the price is shy of a grounded mid-size number",
              "you're buying honesty without drama",
            ],
            observation: [
              "This is steady contractor voice, not a pitch",
              "You're tightening math the buyer can respect",
              "Straight mids like straightforward moves",
            ],
            softener: [
              "often lands when flashing or detail work added quiet hours",
              "usually still easier to defend than a surprise later",
              "typically reads as cleanup, not attitude",
            ],
          },
          moderate: {
            move: [
              "Push a real lift on clean mids",
              "Move the middle number up meaningfully",
              "Ask for a noticeable bump tied to walkable scope",
              "Lift materially where fair margin holds",
            ],
            anchor: [
              "balanced spread still carries a real correction",
              "the mid ask is behind an honest walkable job",
              "simple work shouldn't train customers to expect discounts",
              "you're fixing a bid that was a little too polite",
            ],
            observation: [
              "This is where even margin earns a real sentence",
              "You're moving because the job deserves cleaner math",
              "Mids are where profit quietly leaks if you're shy",
            ],
            softener: [
              "often still credible when your notes match the roof",
              "usually reads better than eating labor in silence",
              "typically keeps the tone controlled and professional",
            ],
          },
          strong: {
            move: [
              "Lift hard on the clean mid ticket",
              "Push a big correction on walkable mids",
              "Move the middle number up aggressively but honestly",
              "Ask for a serious bump — fair margin still defends it",
            ],
            anchor: [
              "the mid ticket is materially behind the easy job",
              "balanced margin can still carry a strong lift when real",
              "walkable scope is your stability argument",
              "you're collecting dollars shy estimating left behind",
            ],
            observation: [
              "This is a strong mid move — still grounded in simple scope",
              "You're leaning in because the profile is predictable",
              "Sometimes the straightforward mid is under-priced worst",
            ],
            softener: [
              "often necessary when you chased the schedule too hard",
              "usually defendable when production assumptions were tight",
              "typically separates steady crews from busy, broke ones",
            ],
          },
        },
        balancedMargin_smallJob: {
          micro: {
            move: [
              "Lift the small bid slightly",
              "Ask for a modest bump on a quick scope",
              "Ease the little number up a touch",
              "Correct lightly where fair margin allows",
            ],
            anchor: [
              "small jobs still need real dollars to be worth rolling",
              "balanced spread tolerates a tiny honest lift",
              "quick work shouldn't trade like a giveaway",
              "the ticket is a hair light for mobilization reality",
            ],
            observation: [
              "This is calm confidence on a fast job",
              "You're not grandstanding on square footage",
              "Little roofs still add up across a season",
            ],
            softener: [
              "often reads fair when minimums were priced honestly",
              "usually still sounds steady, not greedy",
              "typically an easy move to explain once",
            ],
          },
          light: {
            move: [
              "Raise the small ask a step",
              "Move the quick ticket up in a measured way",
              "Push a modest lift on little walkable scope",
              "Lift the bid where fair margin backs it",
            ],
            anchor: [
              "even margin meets a practical small bump halfway",
              "simple scope keeps the correction believable",
              "the price is shy of an honest quick job",
              "you're tightening without turning it into theater",
            ],
            observation: [
              "This is professional small-job tone",
              "You're aligning dollars with truck time",
              "Fast bids still deserve clean math",
            ],
            softener: [
              "often lands when travel and setup were real",
              "usually still easier to say than eating mobilization",
              "typically reads as disciplined, not pushy",
            ],
          },
          moderate: {
            move: [
              "Push a real lift on the small job",
              "Move the quick number up meaningfully",
              "Ask for a noticeable bump tied to honest minimums",
              "Lift materially where fair margin holds",
            ],
            anchor: [
              "balanced spread still carries a real small correction",
              "the little ticket is behind what the day costs",
              "quick work shouldn't erase margin by habit",
              "you're fixing a bid that was too friendly",
            ],
            observation: [
              "This is where small jobs stop subsidizing bad habits",
              "You're moving because even margin allows honesty",
              "Little checks matter when the week is tight",
            ],
            softener: [
              "often still credible when line items match reality",
              "usually reads better than pretending the price was perfect",
              "typically keeps small work profitable, not just busy",
            ],
          },
          strong: {
            move: [
              "Lift hard on the small ticket",
              "Push a big correction on quick scope",
              "Move the little number up aggressively but honestly",
              "Ask for a serious bump — small isn't free",
            ],
            anchor: [
              "fair margin is why a strong small lift can hold",
              "the quick bid is materially behind real cost",
              "minimums and mobilization earn a real voice here",
              "you're collecting value polite estimating leaked",
            ],
            observation: [
              "This is a bold small-job move — margin makes it sane",
              "You're leaning in because the calendar likes paid work",
              "Sometimes the fastest job is the sneakiest under-bid",
            ],
            softener: [
              "often necessary when you bought the lead too cheap",
              "usually defendable when setup and teardown were documented",
              "typically separates pros from hobby pricing on small roofs",
            ],
          },
        },
        liftStrong_largeJob_clean: {
          micro: {
            move: [
              "Lift the big clean bid a touch",
              "Ask for a small bump at scale",
              "Ease the large walkable number upward",
              "Correct slightly where healthy margin backs you",
            ],
            anchor: [
              "volume makes a modest lift read steady",
              "strong margin carries a small move without drama",
              "simple big jobs often earn more than a shy ask",
              "square footage supports a confident nudge",
            ],
            observation: [
              "This is calm strength, not a hard sell",
              "You're tightening the bid, not reinventing it",
              "Big clean roofs forgive small upward corrections",
            ],
            softener: [
              "often reads fair when labor hours were tight in the estimate",
              "usually still sounds professional, not pushy",
              "typically an easy move to defend in review",
            ],
          },
          light: {
            move: [
              "Raise the big clean ask a step",
              "Move the large walkable number up cleanly",
              "Push a modest lift backed by scale",
              "Lift the bid where margin and volume agree",
            ],
            anchor: [
              "healthy margin means the raise holds without squeaking",
              "walkable at scale can wear a practical bump",
              "the job is priced a little behind the ease of production",
              "strong spread buys a grounded correction",
            ],
            observation: [
              "This is controlled confidence on a big ticket",
              "You're moving because the math allows it",
              "Buyers hear big numbers better when the scope is simple",
            ],
            softener: [
              "often lands when waste or access was under-counted",
              "usually still easier to say than eating margin later",
              "typically reads as disciplined, not greedy",
            ],
          },
          moderate: {
            move: [
              "Push a real lift on the big clean job",
              "Move the large number up noticeably",
              "Ask for a meaningful bump tied to scale",
              "Lift materially where volume defends the move",
            ],
            anchor: [
              "strong margin plus big square count is a stable combo",
              "the ask is behind what an easy big roof earns",
              "walkable scale carries a real correction cleanly",
              "you're fixing a bid that left headroom on the table",
            ],
            observation: [
              "This is where healthy margin earns a real voice",
              "You're correcting, not auditioning for drama",
              "Big easy jobs are easy to under-price — fix it",
            ],
            softener: [
              "often still credible with a tight production story",
              "usually reads better than pretending the price was perfect",
              "typically where steady crews get paid for steady work",
            ],
          },
          strong: {
            move: [
              "Lift hard on the big clean ticket",
              "Push a big correction at walkable scale",
              "Move the large number up aggressively with margin behind you",
              "Ask for a serious bump — the spread can carry it",
            ],
            anchor: [
              "healthy margin is what makes the strong lift believable",
              "volume turns a big move into a grounded story",
              "you're collecting value the estimate left behind",
              "simple at scale shouldn't trade like a fire sale",
            ],
            observation: [
              "This is a strong move — margin and size earned it",
              "You're leaning in because the profile is forgiving",
              "Sometimes the easy big job is under-priced the worst",
            ],
            softener: [
              "often necessary when you priced optimism instead of production",
              "usually defendable when line items match the site reality",
              "typically separates strong margin from strong luck",
            ],
          },
        },
        liftStrong_midJob_clean: {
          micro: {
            move: [
              "Lift the mid-size clean bid slightly",
              "Ask for a small bump on walkable mids",
              "Ease the middle number up a touch",
              "Correct slightly where solid margin backs you",
            ],
            anchor: [
              "healthy margin carries a modest lift cleanly",
              "simple mids should pay like professional work",
              "walkable scope supports a confident nudge",
              "the spread is strong enough to be honest",
            ],
            observation: [
              "This is steady confidence on straightforward work",
              "You're not reaching — you're aligning",
              "Mids reward crews who price like adults",
            ],
            softener: [
              "often reads fair when setup time was priced honestly",
              "usually still sounds calm, not salesy",
              "typically an easy correction to explain quietly",
            ],
          },
          light: {
            move: [
              "Raise the mid clean ask a step",
              "Move the middle number up with control",
              "Push a modest lift on walkable mids",
              "Lift the bid where margin feels strong",
            ],
            anchor: [
              "solid margin defends a practical bump",
              "clean mids forgive a grounded correction",
              "the price is a little shy of the work's ease",
              "you're buying honesty into the estimate",
            ],
            observation: [
              "This is professional tone on a mid ticket",
              "You're moving because the spread allows it",
              "Buyers compare mids — a fair lift still lands",
            ],
            softener: [
              "often lands when pitch or flashing added quiet hours",
              "usually still easier to defend than a surprise change order",
              "typically reads as tightening math, not pushing luck",
            ],
          },
          moderate: {
            move: [
              "Push a real lift on clean mids",
              "Move the middle number up meaningfully",
              "Ask for a noticeable bump tied to walkable scope",
              "Lift materially where healthy margin holds",
            ],
            anchor: [
              "strong spread means a real move still reads steady",
              "the mid ticket is behind what the job earns",
              "simple work shouldn't punish your margin story",
              "you're correcting a bid that was a little too polite",
            ],
            observation: [
              "This is where strong margin earns a real voice",
              "You're fixing a miss, not flexing ego",
              "Mids are where a lot of 'almost profit' lives",
            ],
            softener: [
              "often still credible when notes match the roof photos",
              "usually reads better than eating labor on the back end",
              "typically the move when you want the number to match the crew",
            ],
          },
          strong: {
            move: [
              "Lift hard on the clean mid ticket",
              "Push a big correction on walkable mids",
              "Move the middle number up aggressively with margin behind you",
              "Ask for a serious bump — strong spread earns it",
            ],
            anchor: [
              "healthy margin is why the strong lift doesn't sound wild",
              "the mid ask is materially behind the work",
              "walkable scope carries a big correction when math is honest",
              "you're collecting dollars polite estimating left behind",
            ],
            observation: [
              "This is a strong mid move — and the spread supports it",
              "You're leaning in because the job profile is stable",
              "Sometimes the simple mid is the quiet under-bid",
            ],
            softener: [
              "often necessary when you chased schedule over margin",
              "usually defendable when production assumptions were tight",
              "typically separates a strong crew from a busy broke one",
            ],
          },
        },
        liftStrong_smallJob_clean: {
          micro: [
            "Small clean job, healthy margin — nudge it up, it'll hold.",
            "Small raise — quick walkable work defends the move.",
            "Push a touch — simple small scope with solid margin takes it.",
          ],
          light: [
            "Bump it up — small clean job holds a raise easily.",
            "Push it slightly — simple scope with solid margin earns it.",
            "Raise it a bit — walkable small work backs the move.",
          ],
          moderate: [
            "Real raise — small clean job with solid margin holds it.",
            "Push it up — walkable small work defends a real number.",
            "Bump it noticeably — simple scope takes a real raise.",
          ],
          strong: [
            "Big raise — small clean job defends a real move cleanly.",
            "Push hard — simple work plus solid margin holds a real raise.",
            "Correct real — quick walkable scope carries a meaningful number.",
          ],
        },
        liftStrong_largeJob_involved: {
          micro: [
            "Big involved job, solid margin — nudge it up, scope earns more.",
            "Small raise — real work at scale, number can move up.",
            "Push a touch — heavy scope plus solid margin backs it.",
          ],
          light: [
            "Bump it up — involved big job holds a raise comfortably.",
            "Push it slightly — scope at scale defends the move.",
            "Raise it a bit — real work backs a fair number.",
          ],
          moderate: [
            "Real raise — involved big job earns more than this price.",
            "Push it up — scope and margin both back a real move.",
            "Bump it noticeably — real work at scale takes a real number.",
          ],
          strong: [
            "Big raise — involved big job defends a real move cleanly.",
            "Push hard — scope and scale both back a meaningful raise.",
            "Correct real — heavy work at this size carries a big number.",
          ],
        },
        liftStrong_midJob_involved: {
          micro: [
            "Involved mid-size, solid margin — nudge it up, scope earns it.",
            "Small raise — real work deserves more, margin's safe.",
            "Push a touch — real scope on solid margin backs the move.",
          ],
          light: [
            "Bump it up — involved mid-size holds a raise comfortably.",
            "Push it slightly — scope and margin both back the move.",
            "Raise it a bit — real work earns more than this number.",
          ],
          moderate: [
            "Real raise — involved mid-size earns a real move up.",
            "Push it up — scope justifies the number, margin's safe.",
            "Bump it noticeably — real work deserves real pricing.",
          ],
          strong: [
            "Big raise — involved mid-size defends a real move up.",
            "Push hard — real work plus solid margin backs the raise.",
            "Correct real — heavy scope earns a meaningful number.",
          ],
        },
        liftStrong_smallJob_involved: {
          micro: [
            "Small involved job, solid margin — nudge it up, scope earns it.",
            "Small raise — real work on a quick job earns more.",
            "Push a touch — tight scope with solid margin takes it.",
          ],
          light: [
            "Bump it up — small involved job holds a raise cleanly.",
            "Push it slightly — scope earns more, margin's fine.",
            "Raise it a bit — tight work with solid margin backs it.",
          ],
          moderate: [
            "Real raise — small involved job earns a real move up.",
            "Push it up — scope backs the number, margin's safe.",
            "Bump it noticeably — real work deserves real pricing.",
          ],
          strong: [
            "Big raise — small involved job defends a real move up.",
            "Push hard — scope plus solid margin carries the raise.",
            "Correct real — tight work earns a meaningful number.",
          ],
        },
        liftStrong_largeJob_neutral: {
          micro: [
            "Big job, solid margin — nudge it up, scale takes it easily.",
            "Small raise — at this size with room to spare, push slightly.",
            "Push a touch — volume plus healthy margin holds it.",
          ],
          light: [
            "Bump it up — big job with solid margin holds a raise.",
            "Push it slightly — scale backs the move comfortably.",
            "Raise it a bit — at this size, margin holds a fair raise.",
          ],
          moderate: [
            "Real raise — big job holds a real move up comfortably.",
            "Push it up — volume and solid margin both back it.",
            "Bump it noticeably — at this scale, a real raise holds.",
          ],
          strong: [
            "Big raise — big job defends a real move without issue.",
            "Push hard — volume plus solid margin backs a meaningful raise.",
            "Correct real — scale carries a big number cleanly.",
          ],
        },
        liftStrong_midJob_neutral: {
          micro: [
            "Mid-size, solid margin — nudge it up, number can move.",
            "Small raise — healthy margin holds a fair move up.",
            "Push a touch — mid-size with room to spare takes it.",
          ],
          light: [
            "Bump it up — mid-size with solid margin backs a raise.",
            "Push it slightly — margin holds a small move comfortably.",
            "Raise it a bit — healthy margin defends the move.",
          ],
          moderate: [
            "Real raise — mid-size holds a real number comfortably.",
            "Push it up — solid margin backs a real move up.",
            "Bump it noticeably — room here for a real raise.",
          ],
          strong: [
            "Big raise — mid-size defends a real move up cleanly.",
            "Push hard — solid margin backs a meaningful raise.",
            "Correct real — healthy margin carries a big number.",
          ],
        },
        liftStrong_smallJob_neutral: {
          micro: [
            "Small job, solid margin — nudge it up, it'll hold.",
            "Small raise — quick work with margin to spare takes it.",
            "Push a touch — small scope plus healthy margin backs it.",
          ],
          light: [
            "Bump it up — small job with solid margin holds a raise.",
            "Push it slightly — healthy margin backs a move up.",
            "Raise it a bit — quick work with room takes a fair number.",
          ],
          moderate: [
            "Real raise — small job holds a real move comfortably.",
            "Push it up — solid margin backs a real number.",
            "Bump it noticeably — quick work with margin defends the move.",
          ],
          strong: [
            "Big raise — small job defends a real move up cleanly.",
            "Push hard — healthy margin carries a meaningful raise.",
            "Correct real — quick work with margin holds a big number.",
          ],
        },
        liftPremium_largeJob_clean: {
          micro: {
            move: [
              "Lift the big clean bid a touch",
              "Ask for a modest bump at volume",
              "Move the large walkable number up slightly",
              "Correct the big ticket where margin is deep",
            ],
            anchor: [
              "premium spread says the ask is light for the scale",
              "easy square footage is carrying more than the price shows",
              "deep margin makes a small lift read confident",
              "volume plus fat margin is rare — use it",
            ],
            observation: [
              "This is opportunity voice, not apology",
              "You're catching up, not gouging",
              "Big clean jobs can wear a premium stance",
            ],
            softener: [
              "often still sounds grounded when labor was priced honestly",
              "usually an easy detail to defend in review",
              "typically reads as tightening math, not flexing ego",
            ],
          },
          light: {
            move: [
              "Raise the large walkable ask a clean step",
              "Push the big number up where volume backs it",
              "Move the bid meaningfully at scale",
              "Lift the clean big ticket with confidence",
            ],
            anchor: [
              "the price is behind the square count you priced",
              "deep margin gives you room to correct without drama",
              "walkable at scale often earns more than this ask",
              "premium spread is your license to move",
            ],
            observation: [
              "This is a correction toward honest premium pricing",
              "You're not inventing margin — you're collecting it",
              "Buyers can still hear a grounded lift at size",
            ],
            softener: [
              "often lands when your production assumptions were conservative",
              "usually still easier to say than a huge jump later",
              "typically reads as professional confidence, not greed",
            ],
          },
          moderate: {
            move: [
              "Push a real lift on the big clean ticket",
              "Move the large number up noticeably",
              "Ask for a meaningful bump tied to volume",
              "Correct materially where premium margin backs you",
            ],
            anchor: [
              "the bid is clearly light for walkable scale",
              "deep margin means you can defend a real move",
              "square footage is doing work the price isn't paying for",
              "this is the kind of spread that earns a correction",
            ],
            observation: [
              "This is where premium margin stops being theoretical",
              "You're moving because the math is obviously behind",
              "Big clean roofs often hide under-priced tickets",
            ],
            softener: [
              "often still credible when your scope notes are tight",
              "usually reads better than leaving money in the driveway",
              "typically where confident crews get paid for scale",
            ],
          },
          strong: {
            move: [
              "Lift hard on the big clean job",
              "Push a big correction at walkable scale",
              "Move the large number aggressively with premium margin",
              "Ask for a serious bump — the ask is too light",
            ],
            anchor: [
              "premium margin plus volume is a rare combo to waste",
              "the ticket is visibly behind what this roof earns",
              "you're correcting a miss, not fishing for luxury",
              "deep spread is what makes the big lift believable",
            ],
            observation: [
              "This is a strong premium move — and the spread earned it",
              "You're collecting value the estimate left behind",
              "Sometimes the big easy job is the most under-priced",
            ],
            softener: [
              "often necessary when the takeoff was polite, not realistic",
              "usually still defendable when production costs are documented",
              "typically the difference between premium profit and premium wish",
            ],
          },
        },
        liftPremium_midJob_clean: {
          micro: {
            move: [
              "Lift the mid-size clean bid slightly",
              "Ask for a small bump on walkable mids",
              "Move the middle number up a touch",
              "Correct the mid ticket where margin is deep",
            ],
            anchor: [
              "premium spread says you're light for a simple mid",
              "clean mids get under-priced when crews compete hard",
              "deep margin buys a confident small lift",
              "walkable work earns more than a shy ask",
            ],
            observation: [
              "This is opportunity on a straightforward mid roof",
              "You're tightening premium math, not showing off",
              "Mids punish soft pricing quietly",
            ],
            softener: [
              "often reads fair when your line items were honest",
              "usually an easy correction to explain on review",
              "typically sounds confident without sounding pushy",
            ],
          },
          light: {
            move: [
              "Raise the mid-size clean ask a step",
              "Push the middle number up with purpose",
              "Move the bid where walkable scope supports it",
              "Lift the mid ticket on premium margin",
            ],
            anchor: [
              "the price is behind what a clean mid earns",
              "deep margin makes a real lift feel professional",
              "simple mids should pay like simple mids, not giveaways",
              "you're catching the bid up to the crew reality",
            ],
            observation: [
              "This is premium correction voice on easy work",
              "You're not creating margin — you're reclaiming it",
              "Buyers still hear mids when the story is tight",
            ],
            softener: [
              "often lands when pitch or deck wasn't fully paid for",
              "usually still easier to defend than eating the difference",
              "typically reads as tightening, not inflating",
            ],
          },
          moderate: {
            move: [
              "Push a noticeable lift on clean mids",
              "Move the mid number up meaningfully",
              "Ask for a real bump tied to walkable scope",
              "Correct materially on a mid-size easy roof",
            ],
            anchor: [
              "the ask is clearly light for what this mid is",
              "premium margin is why this correction can hold",
              "clean work shouldn't trade like a discount brand",
              "you're fixing a bid that left value on the table",
            ],
            observation: [
              "This is where premium margin earns its keep",
              "You're moving because the miss is obvious",
              "Mids are where a lot of profit quietly leaks",
            ],
            softener: [
              "often still credible with a tight scope write-up",
              "usually reads better than pretending the price was perfect",
              "typically the move when you priced to get in, not to finish rich",
            ],
          },
          strong: {
            move: [
              "Lift hard on the clean mid ticket",
              "Push a big correction on walkable mids",
              "Move the mid number aggressively with deep margin",
              "Ask for a serious bump — you're materially light",
            ],
            anchor: [
              "premium spread makes a strong mid lift believable",
              "the ticket is behind the real value of the job",
              "you're collecting what polite estimating left behind",
              "clean mids can carry a big ask when math is honest",
            ],
            observation: [
              "This is a bold premium move on straightforward work",
              "You're correcting aggressively because margin allows it",
              "Sometimes the easy mid is the sneaky under-bid",
            ],
            softener: [
              "often necessary when you chased the bid too hard early",
              "usually defendable when labor and waste were real",
              "typically separates premium profit from premium posture",
            ],
          },
        },
        liftPremium_smallJob_clean: {
          micro: {
            move: [
              "Lift the small clean bid a touch",
              "Ask for a modest bump on a quick roof",
              "Move the little number up slightly",
              "Correct the small ticket where margin is deep",
            ],
            anchor: [
              "premium margin makes even small lifts read confident",
              "quick clean work still earns honest dollars",
              "deep spread buys a small correction without drama",
              "little jobs shouldn't train customers to expect giveaways",
            ],
            observation: [
              "This is a premium nudge on a small ticket",
              "You're tightening, not grandstanding",
              "Small scopes still deserve professional pricing",
            ],
            softener: [
              "often reads fair when mobilization was priced honestly",
              "usually easy to explain as math cleanup",
              "typically sounds confident on a tight crew day",
            ],
          },
          light: {
            move: [
              "Raise the small clean ask a step",
              "Push the quick ticket up purposefully",
              "Move the little bid where premium margin backs it",
              "Lift small walkable work with confidence",
            ],
            anchor: [
              "the price is light for even a small honest job",
              "deep margin lets you defend a practical lift",
              "quick work still carries real cost and risk",
              "you're catching the bid up to reality",
            ],
            observation: [
              "This is premium correction on a fast job",
              "You're not apologizing for wanting to get paid",
              "Small tickets add up across a season",
            ],
            softener: [
              "often lands when minimums and mobilization matter",
              "usually still easier to say than eating travel cost",
              "typically reads as professional, not greedy",
            ],
          },
          moderate: {
            move: [
              "Push a noticeable lift on the small clean job",
              "Move the quick number up meaningfully",
              "Ask for a real bump tied to honest minimums",
              "Correct materially on little walkable scope",
            ],
            anchor: [
              "premium margin means you can ask without sounding weak",
              "the small ticket is still under what's fair",
              "even little roofs need real margin to be worth rolling",
              "you're fixing a bid that was too polite",
            ],
            observation: [
              "This is where small jobs stop being charity practice",
              "You're moving because premium spread allows honesty",
              "Quick work shouldn't mean quick losses",
            ],
            softener: [
              "often still credible when your minimums were real",
              "usually reads better than subsidizing small work",
              "typically the move when your calendar is tight and costs aren't",
            ],
          },
          strong: {
            move: [
              "Lift hard on the small clean ticket",
              "Push a big correction on a quick job",
              "Move the little number aggressively with deep margin",
              "Ask for a serious bump — small doesn't mean free",
            ],
            anchor: [
              "premium spread makes a strong small lift believable",
              "you're correcting a bid that trained the wrong expectation",
              "little checks still need to pay for real trucks and crews",
              "deep margin is the only reason this reads confident",
            ],
            observation: [
              "This is a bold move on a small roof — margin earned it",
              "You're collecting value small jobs quietly leak",
              "Sometimes the quickest job is the most under-priced",
            ],
            softener: [
              "often necessary when you bought the lead with a soft number",
              "usually defendable when setup and teardown were real",
              "typically separates premium crews from hobby pricing",
            ],
          },
        },
        liftPremium_largeJob_involved: {
          micro: [
            "Involved big job, premium margin — you're well under here.",
            "Small raise — real work at scale, price is behind what it is.",
            "Push a touch — heavy scope plus deep margin says push.",
          ],
          light: [
            "Bump it up — big involved job is under for the real work.",
            "Push it slightly — scope at scale says there's real room.",
            "Raise it a bit — premium margin plus real work earns it.",
          ],
          moderate: [
            "Real raise — involved big job is clearly under-priced.",
            "Push it up — scope and scale both say there's real room.",
            "Bump it noticeably — this one's below what the work earns.",
          ],
          strong: [
            "Big raise — involved big job is visibly under-priced.",
            "Push hard — real work at this scale earns a meaningful raise.",
            "The work on this one outruns the price — push it up real.",
          ],
        },
        liftPremium_midJob_involved: {
          micro: [
            "Involved mid-size, premium margin — you're under for the work.",
            "Small raise — the scope here says price is light.",
            "Push a touch — real work with deep margin earns more.",
          ],
          light: [
            "Bump it up — involved mid-size is under-priced.",
            "Push it slightly — scope says there's real room here.",
            "Raise it a bit — premium margin plus real scope earns it.",
          ],
          moderate: [
            "Real raise — involved mid-size is clearly under-priced.",
            "Push it up — scope clearly says more than the current number.",
            "Bump it noticeably — this one's below its real worth.",
          ],
          strong: [
            "Big raise — involved mid-size is visibly under-priced.",
            "Push hard — real work plus premium margin earns real.",
            "The scope on this one outruns the price — push up meaningfully.",
          ],
        },
        liftPremium_smallJob_involved: {
          micro: [
            "Small involved job, premium margin — you're under-asking.",
            "Small raise — real work on a quick scope, price is light.",
            "Push a touch — tight scope with deep margin earns it.",
          ],
          light: [
            "Bump it up — small involved job is under-priced.",
            "Push it slightly — scope says there's real room on this one.",
            "Raise it a bit — premium margin on real work earns the move.",
          ],
          moderate: [
            "Real raise — small involved job is clearly under-priced.",
            "Push it up — real work with deep margin says more room.",
            "Bump it noticeably — this quick job is below its worth.",
          ],
          strong: [
            "Big raise — small involved job is visibly under-priced.",
            "Push hard — real work plus premium margin earns real.",
            "The work here outruns the price — push it up meaningfully.",
          ],
        },
        liftPremium_largeJob_neutral: {
          micro: [
            "Big job, premium margin — you're under at this scale.",
            "Small raise — volume plus deep margin, price is light.",
            "Push a touch — this one's under-asking for its size.",
          ],
          light: [
            "Bump it up — big job with premium margin is under-priced.",
            "Push it slightly — volume plus deep margin backs the move.",
            "Raise it a bit — at this scale, the number can move up.",
          ],
          moderate: [
            "Real raise — big job with premium margin earns more.",
            "Push it up — volume and deep margin both say push.",
            "Bump it noticeably — at this scale, this one's under.",
          ],
          strong: [
            "Big raise — big job with premium margin is visibly under.",
            "Push hard — volume plus premium margin earns a real number.",
            "This one's under-priced at this scale — push up meaningfully.",
          ],
        },
        liftPremium_midJob_neutral: {
          micro: [
            "Mid-size, premium margin — you're under-asking here.",
            "Small raise — there's opportunity, the price is light.",
            "Push a touch — deep margin says room to move up.",
          ],
          light: [
            "Bump it up — mid-size with premium margin is under.",
            "Push it slightly — deep margin backs a confident move.",
            "Raise it a bit — the number can come up fairly.",
          ],
          moderate: [
            "Real raise — mid-size with premium margin earns more.",
            "Push it up — deep margin says there's real room.",
            "Bump it noticeably — this one's below its worth.",
          ],
          strong: [
            "Big raise — mid-size with premium margin is under-priced.",
            "Push hard — deep margin backs a meaningful raise.",
            "Real room on this one — push the number up meaningfully.",
          ],
        },
        liftPremium_smallJob_neutral: {
          micro: [
            "Small job, premium margin — you're under-asking here.",
            "Small raise — deep margin on a quick job says push.",
            "Push a touch — this one's light for what it is.",
          ],
          light: [
            "Bump it up — small job with premium margin is under.",
            "Push it slightly — deep margin backs a fair move up.",
            "Raise it a bit — quick work with room earns it.",
          ],
          moderate: [
            "Real raise — small job with premium margin earns more.",
            "Push it up — deep margin says real room on this one.",
            "Bump it noticeably — quick work with room is under.",
          ],
          strong: [
            "Big raise — small job with premium margin is under-priced.",
            "Push hard — deep margin backs a real raise even on a small scope.",
            "Real room here — push the number up meaningfully.",
          ],
        },
        balancedMargin_largeJob_clean: {
          micro: {
            move: [
              "Lift the big clean bid a hair",
              "Ask for a modest bump at scale",
              "Ease the large walkable number up slightly",
              "Correct lightly where fair margin meets volume",
            ],
            anchor: [
              "even margin plus big square count buys a small move",
              "walkable scale makes a gentle lift read honest",
              "the ticket can move a touch without drama",
              "volume is doing quiet work for you here",
            ],
            observation: [
              "This is calm, neutral-premium tone at size",
              "You're not pushing luck — you're aligning",
              "Big simple jobs like steady, believable lifts",
            ],
            softener: [
              "often reads fair when waste was conservatively counted",
              "usually still sounds steady, not salesy",
              "typically an easy detail to justify quietly",
            ],
          },
          light: {
            move: [
              "Raise the big clean ask a step",
              "Move the large number up in a measured way",
              "Push a modest lift backed by volume",
              "Lift the bid where fair margin allows",
            ],
            anchor: [
              "balanced spread still tolerates a practical correction",
              "walkable at scale earns a grounded bump",
              "the price is a little shy of an honest big job",
              "square footage supports a fair move up",
            ],
            observation: [
              "This is disciplined confidence, not theater",
              "You're tightening the estimate like a pro",
              "Buyers hear big totals — small lifts still matter",
            ],
            softener: [
              "often lands when access or logistics added quiet cost",
              "usually still easier to defend than a late surprise",
              "typically reads as math cleanup, not attitude",
            ],
          },
          moderate: {
            move: [
              "Push a real lift on the big clean job",
              "Move the large number up meaningfully",
              "Ask for a noticeable bump tied to scale",
              "Lift materially where volume carries the story",
            ],
            anchor: [
              "fair margin still meets a real correction halfway",
              "walkable big work shouldn't trade shy forever",
              "the bid is behind what an easy large roof earns",
              "volume is the reason the move reads stable",
            ],
            observation: [
              "This is where even margin still earns a voice",
              "You're correcting without sounding desperate",
              "Big tickets deserve big-boy math sometimes",
            ],
            softener: [
              "often still credible when notes match the site",
              "usually reads better than eating margin in silence",
              "typically keeps the tone professional and controlled",
            ],
          },
          strong: {
            move: [
              "Lift hard on the big clean ticket",
              "Push a big correction at walkable scale",
              "Move the large number up aggressively but honestly",
              "Ask for a serious bump — volume defends the move",
            ],
            anchor: [
              "even margin plus scale can carry a strong lift when real",
              "the large ask is materially behind the easy job",
              "walkable square footage is your stability argument",
              "you're fixing a bid that left value on the table",
            ],
            observation: [
              "This is a strong move — size makes it feel grounded",
              "You're leaning in because the profile is forgiving",
              "Sometimes the big easy roof is priced too politely",
            ],
            softener: [
              "often necessary when you bought the job with a soft opener",
              "usually defendable when production math is documented",
              "typically separates steady profit from steady busywork",
            ],
          },
        },
        balancedMargin_largeJob_involved: {
          micro: [
            "Involved big job, fair margin — nudge it up, scope earns it.",
            "Small raise — real work at scale, number can move.",
            "Push a touch — heavy scope at this size deserves more.",
          ],
          light: [
            "Bump it up — involved big job can take a fair raise.",
            "Push it slightly — scope at scale backs the move honestly.",
            "Raise it a bit — real work at this size earns more.",
          ],
          moderate: [
            "Real raise — involved big job earns more for the work.",
            "Push it up — scope and scale both back a real move.",
            "Bump it noticeably — heavy work at size takes a real number.",
          ],
          strong: [
            "Big raise — involved big job deserves a real move up.",
            "Push hard — scope plus scale carries a meaningful raise.",
            "Correct real — heavy work at this size earns a real number.",
          ],
        },
        balancedMargin_largeJob_neutral: {
          micro: [
            "Big job, fair margin — nudge it up, volume earns it.",
            "Small raise — at this scale there's honest room to move.",
            "Push a touch — volume on fair margin handles it.",
          ],
          light: [
            "Bump it up — big job can take a fair raise on volume.",
            "Push it slightly — scale backs a move up honestly.",
            "Raise it a bit — at this size the number moves up fairly.",
          ],
          moderate: [
            "Real raise — big job earns a real move on volume.",
            "Push it up — scale says there's real room to move.",
            "Bump it noticeably — volume carries a real raise honestly.",
          ],
          strong: [
            "Big raise — big job deserves a real move up.",
            "Push hard — volume backs a meaningful number.",
            "Correct real — at this scale, a big raise holds honestly.",
          ],
        },
        balancedMargin_midJob_neutral: {
          micro: [
            "Mid-size, fair margin — nudge it up, room's there honestly.",
            "Small raise — fair margin with honest room to move.",
            "Push a touch — mid-size takes a small move fairly.",
          ],
          light: [
            "Bump it up — mid-size on fair margin handles a raise.",
            "Push it slightly — honest room on a mid-size.",
            "Raise it a bit — fair margin backs the move up.",
          ],
          moderate: [
            "Real raise — mid-size on fair margin earns a real move.",
            "Push it up — honest room to take a real number.",
            "Bump it noticeably — fair margin backs the raise honestly.",
          ],
          strong: [
            "Big raise — mid-size deserves a real move up fairly.",
            "Push hard — fair margin handles a meaningful raise.",
            "Correct real — honest room to move this one up.",
          ],
        },
        balancedMargin_smallJob_neutral: {
          micro: [
            "Small job, fair margin — nudge it up, room's there honestly.",
            "Small raise — quick job earns a small move fairly.",
            "Push a touch — fair margin on a small job handles it.",
          ],
          light: [
            "Bump it up — small job on fair margin takes a raise.",
            "Push it slightly — honest room on a quick scope.",
            "Raise it a bit — fair margin backs a fair move.",
          ],
          moderate: [
            "Real raise — small job earns a real move fairly.",
            "Push it up — honest room for a real number.",
            "Bump it noticeably — fair margin backs the raise.",
          ],
          strong: [
            "Big raise — small job deserves a real move up.",
            "Push hard — fair margin handles a meaningful raise.",
            "Correct real — honest room to push this one up.",
          ],
        },
        balancedMargin_smallJob_involved: {
          micro: [
            "Small involved job, fair margin — nudge it up, scope earns it.",
            "Small raise — real work on a quick job deserves more.",
            "Push a touch — tight scope with fair margin takes it.",
          ],
          light: [
            "Bump it up — small involved job earns a fair raise.",
            "Push it slightly — scope backs the move honestly.",
            "Raise it a bit — real work on a small job earns more.",
          ],
          moderate: [
            "Real raise — small involved job earns a real move.",
            "Push it up — scope backs a real number honestly.",
            "Bump it noticeably — tight work deserves real pricing.",
          ],
          strong: [
            "Big raise — small involved job deserves a real move up.",
            "Push hard — real work plus fair margin backs a real raise.",
            "Correct real — tight scope earns a meaningful number.",
          ],
        },
      },
      "lift-meaningfully": {
        correctionDeep_scopeExtreme_laborHeavy: {
          micro: [
            "Extreme scope, heavy labor, thin margin — you're well under here.",
            "Small correction — this combo is not earning what it should.",
            "Push the number up — you can't run thin on work this heavy.",
          ],
          light: [
            "Push it up — extreme scope with heavy labor needs real margin.",
            "Bump the price — you're exposed on a heavy, thin-margin job.",
            "Raise it up — this job needs a healthier number, period.",
          ],
          moderate: [
            "Real correction — extreme scope and heavy labor can't run thin.",
            "Push it up noticeably — the math is broken at this margin.",
            "Bump it up real — you're well under on the work here.",
          ],
          strong: [
            "Big correction — you're significantly under-priced on this one.",
            "Push hard — extreme scope on thin margin is dangerous math.",
            "Real raise needed — the work far outruns the price here.",
          ],
        },
        correctionDeep_scopeExtreme: {
          micro: [
            "Extreme scope, thin margin — push it up, you're under.",
            "Small correction — this work outruns what you're charging.",
            "Raise it up — margin can't carry scope this heavy.",
          ],
          light: [
            "Push it up — extreme scope needs more than a thin margin.",
            "Bump the price — protect yourself on work this heavy.",
            "Raise it up — you're under for what's really involved.",
          ],
          moderate: [
            "Real correction — extreme scope on thin margin needs a fix.",
            "Push it up noticeably — the work earns more than this.",
            "Bump it up real — you're under on a tough job.",
          ],
          strong: [
            "Big correction — extreme scope is significantly under-priced.",
            "Push hard — the scope far outruns the current number.",
            "Real raise needed — you can't run thin on work this heavy.",
          ],
        },
        correctionDeep_laborHeavy_impact: {
          micro: [
            "Heavy labor plus impact material, thin margin — you're under.",
            "Small correction — labor and material both outrun the price.",
            "Push it up — margin can't carry this cost as-is.",
          ],
          light: [
            "Push it up — labor and material both deserve real pricing.",
            "Bump the price — you're under for the real cost of this work.",
            "Raise it up — heavy labor plus impact material needs margin.",
          ],
          moderate: [
            "Real correction — labor and material both earn real premium.",
            "Push it up noticeably — the math is tight for this work.",
            "Bump it up real — you're under for the full cost here.",
          ],
          strong: [
            "Big correction — this one's significantly under-priced.",
            "Push hard — labor plus impact material far outrun the price.",
            "Real raise needed — the cost is way ahead of the number.",
          ],
        },
        correctionDeep_laborHeavy: {
          micro: [
            "Heavy labor, thin margin — push it up, you're under.",
            "Small correction — labor is ahead of what you're charging.",
            "Raise it up — margin is too thin for this labor cost.",
          ],
          light: [
            "Push it up — heavy labor on thin margin doesn't work.",
            "Bump the price — labor cost outruns the number here.",
            "Raise it up — protect the job from a thin-margin mistake.",
          ],
          moderate: [
            "Real correction — heavy labor deserves real margin.",
            "Push it up noticeably — you're under for what labor runs.",
            "Bump it up real — the work is clearly ahead of the price.",
          ],
          strong: [
            "Big correction — labor-heavy work is well under-priced.",
            "Push hard — labor cost far outruns the number here.",
            "Real raise needed — this one earns a real correction.",
          ],
        },
        correctionDeep_impact: {
          micro: [
            "Impact material, thin margin — push it up, material earns more.",
            "Small correction — the material premium isn't in the number.",
            "Raise it up — impact work needs real pricing.",
          ],
          light: [
            "Push it up — impact material is under-priced here.",
            "Bump the price — the material premium is missing.",
            "Raise it up — impact-rated work deserves real margin.",
          ],
          moderate: [
            "Real correction — impact material earns real premium.",
            "Push it up noticeably — the material is clearly under-priced.",
            "Bump it up real — material premium outruns the number.",
          ],
          strong: [
            "Big correction — impact material is significantly under.",
            "Push hard — the material premium is far from captured.",
            "Real raise needed — this material earns a real move up.",
          ],
        },
        correctionDeep_complex: {
          micro: [
            "Complex scope, thin margin — push it up, work earns more.",
            "Small correction — complexity is ahead of the price here.",
            "Raise it up — you priced this like it was simple, it isn't.",
          ],
          light: [
            "Push it up — complex work on thin margin isn't safe.",
            "Bump the price — the scope clearly earns more.",
            "Raise it up — this isn't a simple job, don't price it like one.",
          ],
          moderate: [
            "Real correction — complex scope needs real margin.",
            "Push it up noticeably — you're under for the complexity.",
            "Bump it up real — priced like a simple job, but it isn't.",
          ],
          strong: [
            "Big correction — complex scope is significantly under-priced.",
            "Push hard — complexity far outruns the current number.",
            "Real raise needed — priced like simple, actually complex.",
          ],
        },
        correctionDeep: {
          micro: [
            "Margin's thin for this work — push it up, you're under.",
            "Small correction — scope outruns what you're charging.",
            "Raise it up — the price doesn't match the work here.",
          ],
          light: [
            "Push it up — margin's too thin for what this actually is.",
            "Bump the price — scope is clearly ahead of the number.",
            "Raise it up — the work deserves more than this margin.",
          ],
          moderate: [
            "Real correction — scope clearly outruns the current price.",
            "Push it up noticeably — margin's too thin for this scope.",
            "Bump it up real — the work far outruns the number.",
          ],
          strong: [
            "Big correction — scope is significantly ahead of the price.",
            "Push hard — margin's way too thin for this work.",
            "Real raise needed — this one's well under-priced.",
          ],
        },
        correctionShallow_complex_laborHeavy: {
          micro: [
            "Complex work with heavy labor — nudge it up, it's earned.",
            "Small raise — complexity and labor both deserve more.",
            "Push a touch — the work outruns what you're charging.",
          ],
          light: [
            "Bump it up — complex scope plus heavy labor earns more.",
            "Push it slightly — the work clearly deserves it.",
            "Raise it a bit — scope and labor both back the move.",
          ],
          moderate: [
            "Real raise — complex scope with heavy labor earns more.",
            "Push it up — scope and labor both outrun the price.",
            "Bump it noticeably — this combo deserves real pricing.",
          ],
          strong: [
            "Big raise — complex, labor-heavy work is well under.",
            "Push hard — scope and labor both far outrun the number.",
            "Correct meaningfully — this one earns a real move up.",
          ],
        },
        correctionShallow_complex: {
          micro: [
            "Scope outruns the price a bit — nudge it up.",
            "Small raise — the work doesn't fully match the number.",
            "Push a touch — the scope is ahead of what you're charging.",
          ],
          light: [
            "Bump it up — scope clearly earns more than this number.",
            "Push it slightly — the work deserves a fair raise.",
            "Raise it a bit — scope outruns the current price.",
          ],
          moderate: [
            "Real raise — scope doesn't match the price here.",
            "Push it up — the work clearly earns more.",
            "Bump it noticeably — scope outruns the number fairly.",
          ],
          strong: [
            "Big raise — scope far outruns the current price.",
            "Push hard — the work is meaningfully under-priced.",
            "Real correction — scope significantly exceeds the number.",
          ],
        },
        correctionShallow_laborHeavy: {
          micro: [
            "Labor cost outruns margin — nudge it up, fair move.",
            "Small raise — labor runs ahead of the current price.",
            "Push a touch — the labor burden deserves more.",
          ],
          light: [
            "Bump it up — labor burden exceeds margin here.",
            "Push it slightly — labor cost earns a fair move up.",
            "Raise it a bit — you're under for the labor involved.",
          ],
          moderate: [
            "Real raise — labor burden clearly exceeds margin.",
            "Push it up — labor cost outruns the number fairly.",
            "Bump it noticeably — real labor deserves real pricing.",
          ],
          strong: [
            "Big raise — labor burden significantly exceeds margin.",
            "Push hard — labor cost far outruns what you're charging.",
            "Real correction — labor far outruns margin here.",
          ],
        },
        correctionDeep_laborHeavy_largeJob: {
          light: [
            "Heavy labor at scale, thin margin — push it up.",
            "Bump the price — big job with real labor can't run thin.",
            "Raise it up — protect yourself on a labor-heavy big job.",
          ],
          moderate: [
            "Real correction — big labor-heavy job needs real margin.",
            "Push it up noticeably — you're exposed at this size on labor.",
            "Bump it up real — big job on thin margin is risky.",
          ],
          strong: [
            "Big correction — big job, heavy labor, margin way too thin.",
            "Push hard — labor at this scale far outruns the price.",
            "Real raise needed — can't run thin on big labor work.",
          ],
        },
        correctionDeep_laborHeavy_midJob: {
          light: [
            "Heavy labor on a mid-size, thin margin — push it up.",
            "Bump the price — mid-size with real labor can't run thin.",
            "Raise it up — protect the math on this labor-heavy job.",
          ],
          moderate: [
            "Real correction — labor-heavy mid-size needs real margin.",
            "Push it up noticeably — labor clearly outruns the number.",
            "Bump it up real — you're under for what labor runs here.",
          ],
          strong: [
            "Big correction — mid-size, heavy labor, thin margin is bad math.",
            "Push hard — labor cost far outruns what you're charging.",
            "Real raise needed — this one's significantly under-priced.",
          ],
        },
        correctionDeep_complex_largeJob: {
          light: [
            "Complex big job on thin margin — push it up, it's earned.",
            "Bump the price — complexity at scale can't run thin.",
            "Raise it up — the work and size both deserve more.",
          ],
          moderate: [
            "Real correction — complex big job needs real margin.",
            "Push it up noticeably — you're under for the scope at size.",
            "Bump it up real — priced like simple, actually complex.",
          ],
          strong: [
            "Big correction — complex big job is well under-priced.",
            "Push hard — scope and scale both far outrun the number.",
            "Real raise needed — this one's significantly under.",
          ],
        },
        correctionDeep_complex_midJob: {
          light: [
            "Complex mid-size on thin margin — push it up, it's earned.",
            "Bump the price — complexity deserves real margin.",
            "Raise it up — the scope clearly outruns the number.",
          ],
          moderate: [
            "Real correction — complex mid-size needs real margin.",
            "Push it up noticeably — complexity outruns the number.",
            "Bump it up real — priced like simple, but it isn't.",
          ],
          strong: [
            "Big correction — complex mid-size is well under-priced.",
            "Push hard — scope far outruns the current number.",
            "Real raise needed — this one earns a real move up.",
          ],
        },
        correctionDeep_largeJob: {
          light: [
            "Big job on thin margin — push it up, protect the work.",
            "Bump the price — at this scale you need real margin.",
            "Raise it up — thin margin on a big job is risky.",
          ],
          moderate: [
            "Real correction — big job needs real margin to be safe.",
            "Push it up noticeably — thin at this scale is exposed.",
            "Bump it up real — you can't run this thin at size.",
          ],
          strong: [
            "Big correction — big job on very thin margin is dangerous.",
            "Push hard — you need real margin at this scale.",
            "Real raise needed — this one's significantly under.",
          ],
        },
        correctionDeep_midJob: {
          light: [
            "Mid-size on thin margin — push it up, protect the math.",
            "Bump the price — margin's too thin for this work.",
            "Raise it up — you need cushion on this one.",
          ],
          moderate: [
            "Real correction — mid-size on thin margin needs more.",
            "Push it up noticeably — you're exposed on the math.",
            "Bump it up real — margin's not enough for this work.",
          ],
          strong: [
            "Big correction — mid-size on very thin margin is risky.",
            "Push hard — you need real margin on this one.",
            "Real raise needed — this one's significantly under.",
          ],
        },
        correctionDeep_steep_laborHeavy: {
          light: [
            "Steep roof, heavy labor, thin margin — push it up.",
            "Bump the price — steep plus labor can't run thin.",
            "Raise it up — the real cost outruns what you're charging.",
          ],
          moderate: [
            "Real correction — steep roof with heavy labor needs margin.",
            "Push it up noticeably — you're under for the real work.",
            "Bump it up real — pitch and labor both outrun the price.",
          ],
          strong: [
            "Big correction — steep, labor-heavy, thin margin is bad math.",
            "Push hard — real cost far outruns the current number.",
            "Real raise needed — this one's significantly under-priced.",
          ],
        },
      },
      "present-stronger": {
        presentationImpact: [
          "Lead with the impact material — that's the real upgrade story.",
          "Keep the price, show them what the impact-rated material really is.",
          "Don't move the number — put the impact material front and center.",
        ],
        presentationComplex: [
          "Keep the price, lead with what the complex scope actually involves.",
          "Show them what this job really takes — the scope sells itself.",
          "The complexity is your pitch — let the work do the selling.",
        ],
        premiumTierRoom: [
          "Don't drop the number — put the margin into the package.",
          "Keep the price, upgrade what's in it instead.",
          "Healthy margin here — spend it on the package, not the price.",
        ],
        positioningSensitive: [
          "This buyer reads tier — upgrade the story, not the price.",
          "Don't chase a discount — they want better, not cheaper.",
          "They care about what they're getting — sell the package.",
        ],
        highUpgradeStory: [
          "Keep the price — a stronger package closes this one.",
          "Same number, better package — that's the move here.",
          "Don't cut — upgrade what's in the proposal instead.",
        ],
      },
    },
  };

  // Pure explanation helper. Reads only the inputs listed + closure-
  // captured scope/tier signals; derives scores and decisionCase via
  // their pure producers. No side effects, no random, no async.
  const buildStrategyExplanation = (
    slot: OfferCardKey,
    strategy: StrategyType,
    clamped: boolean,
    c: DealClassification,
    holdContext: HoldContext,
    deltaPct: number
  ): string => {
    // Standard slot always renders the neutral anchor sentence.
    if (slot === "standard") return EXPLANATION_MAP.standard;

    // Clamp short-circuit — rails state trumps job-state reasoning.
    if (clamped) {
      const clampSentence = EXPLANATION_MAP.clamped[strategy];
      if (clampSentence) {
        const clampSig = stableHash(
          strategy,
          Math.round(squaresNum),
          Math.round(c.marginPct * 100)
        );
        if (typeof clampSentence === "string" || Array.isArray(clampSentence)) {
          return pickVariant(clampSentence, clampSig);
        }
        if (isExplanationComposable(clampSentence)) {
          return composeExplanation(
            clampSentence,
            clampSig,
            `clamped:${strategy}`,
            "clamped"
          );
        }
      }
    }

    const scores = computeDecisionScores(c);
    const decisionCase = classifyDecisionCase(c, scores);
    const labor = c.laborBurdenPct ?? 0;

    // Deterministic 4-band magnitude from |deltaPct|. Used only by the
    // four price-move strategies. Thresholds pivot wording from "nudge"
    // language (micro/light) to "correction" language (moderate/strong).
    const absDelta = Math.abs(deltaPct);
    const magnitude: MagnitudeBand =
      absDelta >= 5
        ? "strong"
        : absDelta >= 3
          ? "moderate"
          : absDelta >= 1.5
            ? "light"
            : "micro";

    // --- Reason atoms ------------------------------------------------
    const marginDeepThin = c.marginPct < 18;
    const marginThin = c.marginPct < 22;
    const marginTight = c.marginPct >= 22 && c.marginPct < 26;
    const marginBalanced = c.marginPct >= 26 && c.marginPct < 28;
    const marginStrong = c.marginPct >= 28 && c.marginPct < 32;
    const marginPremium = c.marginPct >= 32;

    const scopeExtreme = c.complexity === "extreme";
    const scopeComplex = c.complexity === "complex";
    const scopeSimple = c.complexity === "commodity";
    const laborHeavy = labor > 0.55;
    const laborElevated = labor > 0.45 && labor <= 0.55;
    const impactMaterial = c.materialIsImpact;
    const largeJob = squaresNum >= 40;
    const midJob = squaresNum >= 20 && squaresNum < 40;
    // Derived from the existing size thresholds above — not a new
    // threshold. Used only by the v6 normal-job refinement cascades.
    const smallJob = !largeJob && !midJob;

    // v5 pitch atoms — closure-captured pitch read through the same
    // display→key mapper the pricing engine uses.
    const pitchKey = mapPitchDisplayToPitchKey(effectiveScopePitch);
    const steepRoof = pitchKey === "steep";
    const moderatePitch = pitchKey === "moderate";

    // v4 derived cleanness axis — layered on top of existing atoms so
    // similar-size jobs with different real work burden produce
    // distinct explanations without destabilizing strategy selection.
    const scopeClean = scopeSimple && !laborElevated && !laborHeavy;
    const scopeInvolved = scopeComplex || laborElevated || laborHeavy;
    // v7 neutral cleanness band — closes the moderate-complexity /
    // moderate-labor hole that previously fell straight to bare
    // fallbacks. Pure derivation from existing atoms — no new
    // threshold, no new truth input.
    const scopeNeutral = !scopeClean && !scopeInvolved;

    // v5 deterministic scope-burden score. Used ONLY by the explanation
    // layer (close-* branches) to gate a scope-dominance lane when the
    // real-work burden is meaningfully stronger than the price-sensitive
    // story. No pricing / selection impact.
    let scopeBurden = 0;
    if (scopeExtreme) scopeBurden += 3;
    if (scopeComplex) scopeBurden += 2;
    if (laborHeavy) scopeBurden += 2;
    else if (laborElevated) scopeBurden += 1;
    if (steepRoof) scopeBurden += 2;
    else if (moderatePitch) scopeBurden += 1;
    if (impactMaterial) scopeBurden += 1;
    if (largeJob && scopeComplex) scopeBurden += 1;
    const scopeDominant = scopeBurden >= 4;

    const positioningStrong = c.positioning === "strong";
    const priceSensitive = c.closeSensitivity === "price-sensitive";
    const positioningSensitive = c.closeSensitivity === "positioning-sensitive";
    const tierHeadroom = effectiveProposalTier !== "premium";
    const tierPremium = effectiveProposalTier === "premium";

    const correctionDeep =
      decisionCase.category === "correction" && decisionCase.deep;
    const correctionShallow =
      decisionCase.category === "correction" && !decisionCase.deep;
    const presentationCase = decisionCase.category === "presentation";

    const highUpgradeStory = scores.upgradePotential >= 4;
    const highCloseStory = scores.closePotential >= 6;

    // v8 language-layer variant selector. Deterministic hash of atoms
    // already computed above: same job → same sentence; similar jobs
    // with slightly different squares/margin cycle the variant bank.
    // No new truth inputs, no randomness, no runtime AI.
    const selectorSig = stableHash(
      Math.round(squaresNum),
      Math.round(c.marginPct * 100),
      strategy,
      slot,
      magnitude,
      decisionCase.category,
      decisionCase.deep ? 1 : 0,
      c.closeSensitivity,
      c.positioning,
      effectiveProposalTier
    );

    // Local shadow of resolveMagnitude — unwraps string banks or
    // composable slot objects; picks variants via selectorSig + per-key
    // explainKey salts for pattern/move/anchor/softener independence.
    const resolveMagnitude = (
      leaf: MagnitudeLeaf | undefined,
      mag: MagnitudeBand,
      explainKey: string
    ): string => {
      const resolved = resolveBand(leaf, mag);
      if (typeof resolved === "string" || Array.isArray(resolved)) {
        return pickVariant(resolved, selectorSig);
      }
      if (isExplanationComposable(resolved)) {
        return composeExplanation(resolved, selectorSig, explainKey, mag);
      }
      return "";
    };

    // Variant picker for flat (non-magnitude) leaves — hold-firmly,
    // hold-the-line-*, present-stronger. Same selectorSig so multiple
    // calls within the same card render cohere.
    const pick = (bank: string | string[] | undefined): string =>
      bank === undefined ? "" : pickVariant(bank, selectorSig);

    const C = EXPLANATION_MAP.cascades;

    // --- Strategy-specific cascades ----------------------------------
    switch (strategy) {
      case "close-harder": {
        const k = C["close-harder"];
        // --- v5 scope-dominance lane (weighted override) ---
        // Only fires when scopeBurden ≥ 4; otherwise the existing v4
        // price-sensitive cascade below runs unchanged.
        if (scopeDominant) {
          if (scopeExtreme)
            return resolveMagnitude(k.scopeDominant_extreme, magnitude, "close-harder:scopeDominant_extreme");
          if (steepRoof && laborHeavy)
            return resolveMagnitude(k.scopeDominant_steep_labor, magnitude, "close-harder:scopeDominant_steep_labor");
          if (steepRoof && scopeComplex)
            return resolveMagnitude(k.scopeDominant_steep_complex, magnitude, "close-harder:scopeDominant_steep_complex");
          if (scopeComplex && laborHeavy)
            return resolveMagnitude(k.scopeDominant_complex_labor, magnitude, "close-harder:scopeDominant_complex_labor");
          return resolveMagnitude(k.scopeDominant_generic, magnitude, "close-harder:scopeDominant_generic");
        }
        // --- priceSensitive + marginPremium TIER (v7) — size +
        // cleanliness specific premium-tier keys lead; existing
        // priceSensitive_marginPremium_simple is the tier fallback.
        if (priceSensitive && largeJob && marginPremium && scopeClean)
          return resolveMagnitude(
            k.priceSensitive_largeJob_premium_clean,
            magnitude
          , "close-harder:priceSensitive_largeJob_premium_clean");
        if (priceSensitive && midJob && marginPremium && scopeClean)
          return resolveMagnitude(
            k.priceSensitive_midJob_premium_clean,
            magnitude
          , "close-harder:priceSensitive_midJob_premium_clean");
        if (priceSensitive && smallJob && marginPremium && scopeClean)
          return resolveMagnitude(
            k.priceSensitive_smallJob_premium_clean,
            magnitude
          , "close-harder:priceSensitive_smallJob_premium_clean");
        if (priceSensitive && marginPremium && scopeSimple)
          return resolveMagnitude(
            k.priceSensitive_marginPremium_simple,
            magnitude
          , "close-harder:priceSensitive_marginPremium_simple");
        // --- priceSensitive + marginStrong TIER (v6 size+cleanliness
        // keys lead; existing broader priceSensitive_*_marginStrong /
        // _simple remain as fallbacks within the tier).
        if (priceSensitive && largeJob && marginStrong && scopeInvolved)
          return resolveMagnitude(
            k.priceSensitive_largeJob_involved_strong,
            magnitude
          , "close-harder:priceSensitive_largeJob_involved_strong");
        if (priceSensitive && largeJob && marginStrong && scopeClean)
          return resolveMagnitude(
            k.priceSensitive_largeJob_clean_strong,
            magnitude
          , "close-harder:priceSensitive_largeJob_clean_strong");
        if (priceSensitive && largeJob && marginStrong)
          return resolveMagnitude(
            k.priceSensitive_largeJob_marginStrong,
            magnitude
          , "close-harder:priceSensitive_largeJob_marginStrong");
        if (priceSensitive && midJob && marginStrong && scopeInvolved)
          return resolveMagnitude(
            k.priceSensitive_midJob_involved_strong,
            magnitude
          , "close-harder:priceSensitive_midJob_involved_strong");
        if (priceSensitive && midJob && marginStrong && scopeClean)
          return resolveMagnitude(
            k.priceSensitive_midJob_clean_strong,
            magnitude
          , "close-harder:priceSensitive_midJob_clean_strong");
        if (priceSensitive && smallJob && marginStrong)
          return resolveMagnitude(k.priceSensitive_smallJob_strong, magnitude, "close-harder:priceSensitive_smallJob_strong");
        if (priceSensitive && marginStrong && scopeSimple)
          return resolveMagnitude(
            k.priceSensitive_marginStrong_simple,
            magnitude
          , "close-harder:priceSensitive_marginStrong_simple");
        // --- marginPremium TIER (v7, non-priceSensitive) — size +
        // cleanliness keys lead; existing largeJob_marginPremium and
        // marginPremium_involved remain as fallbacks.
        if (largeJob && marginPremium && scopeClean)
          return resolveMagnitude(k.marginPremium_largeJob_clean, magnitude, "close-harder:marginPremium_largeJob_clean");
        if (largeJob && marginPremium && scopeInvolved)
          return resolveMagnitude(
            k.marginPremium_largeJob_involved,
            magnitude
          , "close-harder:marginPremium_largeJob_involved");
        if (midJob && marginPremium && scopeClean)
          return resolveMagnitude(k.marginPremium_midJob_clean, magnitude, "close-harder:marginPremium_midJob_clean");
        if (midJob && marginPremium && scopeInvolved)
          return resolveMagnitude(k.marginPremium_midJob_involved, magnitude, "close-harder:marginPremium_midJob_involved");
        if (smallJob && marginPremium && scopeClean)
          return resolveMagnitude(k.marginPremium_smallJob_clean, magnitude, "close-harder:marginPremium_smallJob_clean");
        if (smallJob && marginPremium && scopeInvolved)
          return resolveMagnitude(
            k.marginPremium_smallJob_involved,
            magnitude
          , "close-harder:marginPremium_smallJob_involved");
        if (largeJob && marginPremium)
          return resolveMagnitude(k.largeJob_marginPremium, magnitude, "close-harder:largeJob_marginPremium");
        if (marginPremium && scopeInvolved)
          return resolveMagnitude(k.marginPremium_involved, magnitude, "close-harder:marginPremium_involved");
        // --- marginStrong TIER (v7 size + cleanliness + neutral keys
        // lead; existing largeJob_marginStrong / marginStrong_simple /
        // marginStrong_involved remain as fallbacks).
        if (largeJob && marginStrong && scopeInvolved)
          return resolveMagnitude(k.marginStrong_largeJob_involved, magnitude, "close-harder:marginStrong_largeJob_involved");
        if (largeJob && marginStrong && scopeClean)
          return resolveMagnitude(k.marginStrong_largeJob_clean, magnitude, "close-harder:marginStrong_largeJob_clean");
        if (largeJob && marginStrong && scopeNeutral)
          return resolveMagnitude(k.marginStrong_largeJob_neutral, magnitude, "close-harder:marginStrong_largeJob_neutral");
        if (largeJob && marginStrong)
          return resolveMagnitude(k.largeJob_marginStrong, magnitude, "close-harder:largeJob_marginStrong");
        if (midJob && marginStrong && scopeInvolved)
          return resolveMagnitude(k.marginStrong_midJob_involved, magnitude, "close-harder:marginStrong_midJob_involved");
        if (midJob && marginStrong && scopeClean)
          return resolveMagnitude(k.marginStrong_midJob_clean, magnitude, "close-harder:marginStrong_midJob_clean");
        if (midJob && marginStrong && scopeNeutral)
          return resolveMagnitude(k.marginStrong_midJob_neutral, magnitude, "close-harder:marginStrong_midJob_neutral");
        if (smallJob && marginStrong && scopeClean)
          return resolveMagnitude(k.marginStrong_smallJob_clean, magnitude, "close-harder:marginStrong_smallJob_clean");
        if (smallJob && marginStrong && scopeNeutral)
          return resolveMagnitude(k.marginStrong_smallJob_neutral, magnitude, "close-harder:marginStrong_smallJob_neutral");
        if (marginStrong && scopeSimple)
          return resolveMagnitude(k.marginStrong_simple, magnitude, "close-harder:marginStrong_simple");
        if (marginStrong && scopeInvolved)
          return resolveMagnitude(k.marginStrong_involved, magnitude, "close-harder:marginStrong_involved");
        // --- GENERIC FALLBACKS (highCloseStory family, then default).
        // Only reached if no margin tier above resolved the case.
        if (highCloseStory && largeJob)
          return resolveMagnitude(k.highCloseStory_largeJob, magnitude, "close-harder:highCloseStory_largeJob");
        if (highCloseStory && midJob && scopeInvolved)
          return resolveMagnitude(
            k.highCloseStory_midJob_involved,
            magnitude
          , "close-harder:highCloseStory_midJob_involved");
        if (highCloseStory)
          return resolveMagnitude(k.highCloseStory, magnitude, "close-harder:highCloseStory");
        return resolveMagnitude(
          EXPLANATION_MAP.defaults["close-harder"],
          magnitude
        , "defaults:close-harder");
      }
      case "close-slightly": {
        const k = C["close-slightly"];
        // --- v5 scope-dominance lane (weighted override) ---
        // Only fires when scopeBurden ≥ 4; otherwise the existing v4
        // price-sensitive cascade below runs unchanged.
        if (scopeDominant) {
          if (scopeExtreme)
            return resolveMagnitude(k.scopeDominant_extreme, magnitude, "close-slightly:scopeDominant_extreme");
          if (steepRoof && laborHeavy)
            return resolveMagnitude(k.scopeDominant_steep_labor, magnitude, "close-slightly:scopeDominant_steep_labor");
          if (steepRoof && scopeComplex)
            return resolveMagnitude(k.scopeDominant_steep_complex, magnitude, "close-slightly:scopeDominant_steep_complex");
          if (scopeComplex && laborHeavy)
            return resolveMagnitude(k.scopeDominant_complex_labor, magnitude, "close-slightly:scopeDominant_complex_labor");
          return resolveMagnitude(k.scopeDominant_generic, magnitude, "close-slightly:scopeDominant_generic");
        }
        // --- Price-sensitive tier (size + cleanliness/neutral, most
        // specific → bare fallback). v7 inserts scopeNeutral variants
        // so moderate-complexity + moderate-labor jobs stop collapsing
        // onto the bare priceSensitive fallback.
        if (priceSensitive && largeJob && scopeInvolved)
          return resolveMagnitude(
            k.priceSensitive_largeJob_involved,
            magnitude
          , "close-slightly:priceSensitive_largeJob_involved");
        if (priceSensitive && largeJob && scopeClean)
          return resolveMagnitude(k.priceSensitive_largeJob_clean, magnitude, "close-slightly:priceSensitive_largeJob_clean");
        if (priceSensitive && largeJob && scopeNeutral)
          return resolveMagnitude(
            k.priceSensitive_largeJob_neutral,
            magnitude
          , "close-slightly:priceSensitive_largeJob_neutral");
        if (priceSensitive && largeJob)
          return resolveMagnitude(k.priceSensitive_largeJob, magnitude, "close-slightly:priceSensitive_largeJob");
        if (priceSensitive && midJob && scopeInvolved)
          return resolveMagnitude(
            k.priceSensitive_midJob_involved,
            magnitude
          , "close-slightly:priceSensitive_midJob_involved");
        if (priceSensitive && midJob && scopeClean)
          return resolveMagnitude(k.priceSensitive_midJob_clean, magnitude, "close-slightly:priceSensitive_midJob_clean");
        if (priceSensitive && midJob && scopeNeutral)
          return resolveMagnitude(k.priceSensitive_midJob_neutral, magnitude, "close-slightly:priceSensitive_midJob_neutral");
        if (priceSensitive && scopeSimple && marginStrong)
          return resolveMagnitude(
            k.priceSensitive_simpleMarginStrong,
            magnitude
          , "close-slightly:priceSensitive_simpleMarginStrong");
        if (priceSensitive && scopeInvolved)
          return resolveMagnitude(k.priceSensitive_involved, magnitude, "close-slightly:priceSensitive_involved");
        if (priceSensitive && smallJob && scopeNeutral)
          return resolveMagnitude(
            k.priceSensitive_smallJob_neutral,
            magnitude
          , "close-slightly:priceSensitive_smallJob_neutral");
        if (priceSensitive && smallJob)
          return resolveMagnitude(k.priceSensitive_smallJob, magnitude, "close-slightly:priceSensitive_smallJob");
        // Bare priceSensitive sentence — LAST in the priceSensitive
        // tier so every specific variant above has first pass.
        if (priceSensitive)
          return resolveMagnitude(k.priceSensitive, magnitude, "close-slightly:priceSensitive");
        // --- Large-job tier with cleanness/neutral split on balanced
        // margin. v7 adds marginBalanced_largeJob_neutral; existing
        // largeJob_marginBalanced_* keys remain in the map as
        // fallbacks.
        if (largeJob && marginStrong)
          return resolveMagnitude(k.largeJob_marginStrong, magnitude, "close-slightly:largeJob_marginStrong");
        if (largeJob && marginBalanced && scopeInvolved)
          return resolveMagnitude(
            k.marginBalanced_largeJob_involved,
            magnitude
          , "close-slightly:marginBalanced_largeJob_involved");
        if (largeJob && marginBalanced && scopeClean)
          return resolveMagnitude(k.marginBalanced_largeJob_clean, magnitude, "close-slightly:marginBalanced_largeJob_clean");
        if (largeJob && marginBalanced && scopeNeutral)
          return resolveMagnitude(
            k.marginBalanced_largeJob_neutral,
            magnitude
          , "close-slightly:marginBalanced_largeJob_neutral");
        if (largeJob && marginBalanced && scopeInvolved)
          return resolveMagnitude(
            k.largeJob_marginBalanced_involved,
            magnitude
          , "close-slightly:largeJob_marginBalanced_involved");
        if (largeJob && marginBalanced && scopeClean)
          return resolveMagnitude(k.largeJob_marginBalanced_clean, magnitude, "close-slightly:largeJob_marginBalanced_clean");
        if (largeJob && marginBalanced)
          return resolveMagnitude(k.largeJob_marginBalanced, magnitude, "close-slightly:largeJob_marginBalanced");
        // --- Simple / smallJob marginBalanced tier. v7 inserts
        // marginBalanced_smallJob_involved before simpleMarginBalanced
        // so small involved balanced jobs get their own wording.
        if (scopeSimple && marginStrong)
          return resolveMagnitude(k.simpleMarginStrong, magnitude, "close-slightly:simpleMarginStrong");
        if (smallJob && scopeClean && marginBalanced)
          return resolveMagnitude(k.marginBalanced_smallJob_clean, magnitude, "close-slightly:marginBalanced_smallJob_clean");
        if (smallJob && scopeInvolved && marginBalanced)
          return resolveMagnitude(
            k.marginBalanced_smallJob_involved,
            magnitude
          , "close-slightly:marginBalanced_smallJob_involved");
        if (scopeSimple && marginBalanced)
          return resolveMagnitude(k.simpleMarginBalanced, magnitude, "close-slightly:simpleMarginBalanced");
        // --- Mid-job tier with cleanness/neutral split. v7 adds
        // marginBalanced_midJob_neutral; existing midJob_marginBalanced_*
        // keys remain in the map as fallbacks.
        if (midJob && marginStrong)
          return resolveMagnitude(k.midJob_marginStrong, magnitude, "close-slightly:midJob_marginStrong");
        if (midJob && marginBalanced && scopeInvolved)
          return resolveMagnitude(
            k.marginBalanced_midJob_involved,
            magnitude
          , "close-slightly:marginBalanced_midJob_involved");
        if (midJob && marginBalanced && scopeClean)
          return resolveMagnitude(k.marginBalanced_midJob_clean, magnitude, "close-slightly:marginBalanced_midJob_clean");
        if (midJob && marginBalanced && scopeNeutral)
          return resolveMagnitude(k.marginBalanced_midJob_neutral, magnitude, "close-slightly:marginBalanced_midJob_neutral");
        if (midJob && marginBalanced && scopeInvolved)
          return resolveMagnitude(
            k.midJob_marginBalanced_involved,
            magnitude
          , "close-slightly:midJob_marginBalanced_involved");
        if (midJob && marginBalanced && scopeClean)
          return resolveMagnitude(k.midJob_marginBalanced_clean, magnitude, "close-slightly:midJob_marginBalanced_clean");
        return resolveMagnitude(
          EXPLANATION_MAP.defaults["close-slightly"],
          magnitude
        , "defaults:close-slightly");
      }
      case "hold-firmly": {
        const k = C["hold-firmly"];
        if (marginDeepThin) return pick(k.marginDeepThin);
        if (laborHeavy) return pick(k.laborHeavy);
        if (scopeExtreme) return pick(k.scopeExtreme);
        return pick(EXPLANATION_MAP.defaults["hold-firmly"]);
      }
      case "hold-the-line": {
        if (slot === "value") {
          const k = C["hold-the-line-value"];
          if (holdContext === "already-competitive" && marginThin)
            return pick(k.alreadyCompetitiveThin);
          if (holdContext === "already-competitive")
            return pick(k.alreadyCompetitive);
          if (scopeComplex && laborElevated) return pick(k.complexElevatedLabor);
          if (scopeExtreme) return pick(k.scopeExtreme);
          if (marginBalanced) return pick(k.marginBalanced);
          return pick(EXPLANATION_MAP.defaults["hold-the-line-value"]);
        }
        const k = C["hold-the-line-premium"];
        if (holdContext === "already-well-positioned" && tierPremium)
          return pick(k.wellPositionedPremiumTier);
        if (holdContext === "already-well-positioned") return pick(k.wellPositioned);
        if (scopeSimple && marginStrong) return pick(k.simpleStrongMargin);
        if (tierPremium) return pick(k.tierPremium);
        if (priceSensitive) return pick(k.priceSensitive);
        return pick(EXPLANATION_MAP.defaults["hold-the-line-premium"]);
      }
      case "lift-slightly": {
        const k = C["lift-slightly"];
        if (correctionShallow && scopeExtreme)
          return resolveMagnitude(k.correctionShallow_scopeExtreme, magnitude, "lift-slightly:correctionShallow_scopeExtreme");
        // --- Labor-heavy tier: impact > size-split > bare fallback ---
        if (correctionShallow && laborHeavy && impactMaterial)
          return resolveMagnitude(
            k.correctionShallow_laborHeavy_impact,
            magnitude
          , "lift-slightly:correctionShallow_laborHeavy_impact");
        // v5 pitch enrichment — steep + heavy labor outranks size-split.
        if (correctionShallow && steepRoof && laborHeavy)
          return resolveMagnitude(
            k.correctionShallow_steep_laborHeavy,
            magnitude
          , "lift-slightly:correctionShallow_steep_laborHeavy");
        if (correctionShallow && laborHeavy && largeJob)
          return resolveMagnitude(
            k.correctionShallow_laborHeavy_largeJob,
            magnitude
          , "lift-slightly:correctionShallow_laborHeavy_largeJob");
        if (correctionShallow && laborHeavy && midJob)
          return resolveMagnitude(
            k.correctionShallow_laborHeavy_midJob,
            magnitude
          , "lift-slightly:correctionShallow_laborHeavy_midJob");
        if (correctionShallow && laborHeavy)
          return resolveMagnitude(k.correctionShallow_laborHeavy, magnitude, "lift-slightly:correctionShallow_laborHeavy");
        // --- Complex tier: impact > size-split > bare fallback ---
        if (correctionShallow && scopeComplex && impactMaterial)
          return resolveMagnitude(
            k.correctionShallow_complex_impact,
            magnitude
          , "lift-slightly:correctionShallow_complex_impact");
        if (correctionShallow && scopeComplex && largeJob)
          return resolveMagnitude(
            k.correctionShallow_complex_largeJob,
            magnitude
          , "lift-slightly:correctionShallow_complex_largeJob");
        if (correctionShallow && scopeComplex && midJob)
          return resolveMagnitude(
            k.correctionShallow_complex_midJob,
            magnitude
          , "lift-slightly:correctionShallow_complex_midJob");
        if (correctionShallow && scopeComplex)
          return resolveMagnitude(k.correctionShallow_complex, magnitude, "lift-slightly:correctionShallow_complex");
        // --- Impact-only tier: size-split > bare fallback ---
        if (correctionShallow && impactMaterial && largeJob)
          return resolveMagnitude(
            k.correctionShallow_impact_largeJob,
            magnitude
          , "lift-slightly:correctionShallow_impact_largeJob");
        if (correctionShallow && impactMaterial && midJob)
          return resolveMagnitude(
            k.correctionShallow_impact_midJob,
            magnitude
          , "lift-slightly:correctionShallow_impact_midJob");
        if (correctionShallow && impactMaterial)
          return resolveMagnitude(k.correctionShallow_impact, magnitude, "lift-slightly:correctionShallow_impact");
        // --- Tight-margin tier: size + involved cleanness split ---
        if (marginTight && largeJob)
          return resolveMagnitude(k.tightMargin_largeJob, magnitude, "lift-slightly:tightMargin_largeJob");
        if (marginTight && midJob && scopeInvolved)
          return resolveMagnitude(k.tightMargin_midJob_involved, magnitude, "lift-slightly:tightMargin_midJob_involved");
        if (marginTight && midJob)
          return resolveMagnitude(k.tightMargin_midJob, magnitude, "lift-slightly:tightMargin_midJob");
        // --- Strong-positioning tier: involved split before balanced ---
        if (positioningStrong && scopeInvolved)
          return resolveMagnitude(k.strongPositioning_involved, magnitude, "lift-slightly:strongPositioning_involved");
        if (positioningStrong && marginBalanced)
          return resolveMagnitude(k.strongPositioning_balanced, magnitude, "lift-slightly:strongPositioning_balanced");
        // --- v7 marginPremium tier (liftPremium_*): opportunity /
        // underpriced / confidence voice. Fires before marginStrong so
        // the two tiers read distinctly.
        if (marginPremium && largeJob && scopeClean)
          return resolveMagnitude(k.liftPremium_largeJob_clean, magnitude, "lift-slightly:liftPremium_largeJob_clean");
        if (marginPremium && largeJob && scopeInvolved)
          return resolveMagnitude(k.liftPremium_largeJob_involved, magnitude, "lift-slightly:liftPremium_largeJob_involved");
        if (marginPremium && largeJob && scopeNeutral)
          return resolveMagnitude(k.liftPremium_largeJob_neutral, magnitude, "lift-slightly:liftPremium_largeJob_neutral");
        if (marginPremium && midJob && scopeClean)
          return resolveMagnitude(k.liftPremium_midJob_clean, magnitude, "lift-slightly:liftPremium_midJob_clean");
        if (marginPremium && midJob && scopeInvolved)
          return resolveMagnitude(k.liftPremium_midJob_involved, magnitude, "lift-slightly:liftPremium_midJob_involved");
        if (marginPremium && midJob && scopeNeutral)
          return resolveMagnitude(k.liftPremium_midJob_neutral, magnitude, "lift-slightly:liftPremium_midJob_neutral");
        if (marginPremium && smallJob && scopeClean)
          return resolveMagnitude(k.liftPremium_smallJob_clean, magnitude, "lift-slightly:liftPremium_smallJob_clean");
        if (marginPremium && smallJob && scopeInvolved)
          return resolveMagnitude(k.liftPremium_smallJob_involved, magnitude, "lift-slightly:liftPremium_smallJob_involved");
        if (marginPremium && smallJob && scopeNeutral)
          return resolveMagnitude(k.liftPremium_smallJob_neutral, magnitude, "lift-slightly:liftPremium_smallJob_neutral");
        // --- v7 marginStrong tier (liftStrong_*): balanced /
        // controlled / no-pressure voice for healthy-margin jobs.
        if (marginStrong && largeJob && scopeClean)
          return resolveMagnitude(k.liftStrong_largeJob_clean, magnitude, "lift-slightly:liftStrong_largeJob_clean");
        if (marginStrong && largeJob && scopeInvolved)
          return resolveMagnitude(k.liftStrong_largeJob_involved, magnitude, "lift-slightly:liftStrong_largeJob_involved");
        if (marginStrong && largeJob && scopeNeutral)
          return resolveMagnitude(k.liftStrong_largeJob_neutral, magnitude, "lift-slightly:liftStrong_largeJob_neutral");
        if (marginStrong && midJob && scopeClean)
          return resolveMagnitude(k.liftStrong_midJob_clean, magnitude, "lift-slightly:liftStrong_midJob_clean");
        if (marginStrong && midJob && scopeInvolved)
          return resolveMagnitude(k.liftStrong_midJob_involved, magnitude, "lift-slightly:liftStrong_midJob_involved");
        if (marginStrong && midJob && scopeNeutral)
          return resolveMagnitude(k.liftStrong_midJob_neutral, magnitude, "lift-slightly:liftStrong_midJob_neutral");
        if (marginStrong && smallJob && scopeClean)
          return resolveMagnitude(k.liftStrong_smallJob_clean, magnitude, "lift-slightly:liftStrong_smallJob_clean");
        if (marginStrong && smallJob && scopeInvolved)
          return resolveMagnitude(k.liftStrong_smallJob_involved, magnitude, "lift-slightly:liftStrong_smallJob_involved");
        if (marginStrong && smallJob && scopeNeutral)
          return resolveMagnitude(k.liftStrong_smallJob_neutral, magnitude, "lift-slightly:liftStrong_smallJob_neutral");
        // --- v7 marginBalanced tier (balancedMargin_*): fair /
        // defensible voice for even-margin jobs. Combines v6 keys with
        // v7 largeJob and neutral-zone additions.
        if (marginBalanced && largeJob && scopeClean)
          return resolveMagnitude(k.balancedMargin_largeJob_clean, magnitude, "lift-slightly:balancedMargin_largeJob_clean");
        if (marginBalanced && largeJob && scopeInvolved)
          return resolveMagnitude(
            k.balancedMargin_largeJob_involved,
            magnitude
          , "lift-slightly:balancedMargin_largeJob_involved");
        if (marginBalanced && largeJob && scopeNeutral)
          return resolveMagnitude(
            k.balancedMargin_largeJob_neutral,
            magnitude
          , "lift-slightly:balancedMargin_largeJob_neutral");
        if (marginBalanced && midJob && scopeInvolved)
          return resolveMagnitude(k.balancedMargin_midJob_involved, magnitude, "lift-slightly:balancedMargin_midJob_involved");
        if (marginBalanced && midJob && scopeClean)
          return resolveMagnitude(k.balancedMargin_midJob_clean, magnitude, "lift-slightly:balancedMargin_midJob_clean");
        if (marginBalanced && midJob && scopeNeutral)
          return resolveMagnitude(k.balancedMargin_midJob_neutral, magnitude, "lift-slightly:balancedMargin_midJob_neutral");
        if (marginBalanced && smallJob && scopeInvolved)
          return resolveMagnitude(
            k.balancedMargin_smallJob_involved,
            magnitude
          , "lift-slightly:balancedMargin_smallJob_involved");
        if (marginBalanced && smallJob && scopeNeutral)
          return resolveMagnitude(
            k.balancedMargin_smallJob_neutral,
            magnitude
          , "lift-slightly:balancedMargin_smallJob_neutral");
        if (marginBalanced && smallJob)
          return resolveMagnitude(k.balancedMargin_smallJob, magnitude, "lift-slightly:balancedMargin_smallJob");
        // --- Impact material fallback tier: involved split first ---
        if (impactMaterial && scopeInvolved)
          return resolveMagnitude(k.impactMaterial_involved, magnitude, "lift-slightly:impactMaterial_involved");
        if (impactMaterial)
          return resolveMagnitude(k.impactMaterial, magnitude, "lift-slightly:impactMaterial");
        return resolveMagnitude(
          EXPLANATION_MAP.defaults["lift-slightly"],
          magnitude
        , "defaults:lift-slightly");
      }
      case "lift-meaningfully": {
        const k = C["lift-meaningfully"];
        if (correctionDeep && scopeExtreme && laborHeavy)
          return resolveMagnitude(
            k.correctionDeep_scopeExtreme_laborHeavy,
            magnitude
          , "lift-meaningfully:correctionDeep_scopeExtreme_laborHeavy");
        if (correctionDeep && scopeExtreme)
          return resolveMagnitude(k.correctionDeep_scopeExtreme, magnitude, "lift-meaningfully:correctionDeep_scopeExtreme");
        // --- Deep labor tier: impact > size-split > bare fallback ---
        if (correctionDeep && laborHeavy && impactMaterial)
          return resolveMagnitude(
            k.correctionDeep_laborHeavy_impact,
            magnitude
          , "lift-meaningfully:correctionDeep_laborHeavy_impact");
        // v5 pitch enrichment — steep + heavy labor outranks size-split.
        if (correctionDeep && steepRoof && laborHeavy)
          return resolveMagnitude(
            k.correctionDeep_steep_laborHeavy,
            magnitude
          , "lift-meaningfully:correctionDeep_steep_laborHeavy");
        if (correctionDeep && laborHeavy && largeJob)
          return resolveMagnitude(
            k.correctionDeep_laborHeavy_largeJob,
            magnitude
          , "lift-meaningfully:correctionDeep_laborHeavy_largeJob");
        if (correctionDeep && laborHeavy && midJob)
          return resolveMagnitude(
            k.correctionDeep_laborHeavy_midJob,
            magnitude
          , "lift-meaningfully:correctionDeep_laborHeavy_midJob");
        if (correctionDeep && laborHeavy)
          return resolveMagnitude(k.correctionDeep_laborHeavy, magnitude, "lift-meaningfully:correctionDeep_laborHeavy");
        if (correctionDeep && impactMaterial)
          return resolveMagnitude(k.correctionDeep_impact, magnitude, "lift-meaningfully:correctionDeep_impact");
        // --- Deep complex tier: size-split > bare fallback ---
        if (correctionDeep && scopeComplex && largeJob)
          return resolveMagnitude(
            k.correctionDeep_complex_largeJob,
            magnitude
          , "lift-meaningfully:correctionDeep_complex_largeJob");
        if (correctionDeep && scopeComplex && midJob)
          return resolveMagnitude(
            k.correctionDeep_complex_midJob,
            magnitude
          , "lift-meaningfully:correctionDeep_complex_midJob");
        if (correctionDeep && scopeComplex)
          return resolveMagnitude(k.correctionDeep_complex, magnitude, "lift-meaningfully:correctionDeep_complex");
        // --- Deep bare tier: size-split > bare fallback ---
        if (correctionDeep && largeJob)
          return resolveMagnitude(k.correctionDeep_largeJob, magnitude, "lift-meaningfully:correctionDeep_largeJob");
        if (correctionDeep && midJob)
          return resolveMagnitude(k.correctionDeep_midJob, magnitude, "lift-meaningfully:correctionDeep_midJob");
        if (correctionDeep)
          return resolveMagnitude(k.correctionDeep, magnitude, "lift-meaningfully:correctionDeep");
        if (correctionShallow && scopeComplex && laborHeavy)
          return resolveMagnitude(
            k.correctionShallow_complex_laborHeavy,
            magnitude
          , "lift-meaningfully:correctionShallow_complex_laborHeavy");
        if (correctionShallow && scopeComplex)
          return resolveMagnitude(k.correctionShallow_complex, magnitude, "lift-meaningfully:correctionShallow_complex");
        if (correctionShallow && laborHeavy)
          return resolveMagnitude(k.correctionShallow_laborHeavy, magnitude, "lift-meaningfully:correctionShallow_laborHeavy");
        return resolveMagnitude(
          EXPLANATION_MAP.defaults["lift-meaningfully"],
          magnitude
        , "defaults:lift-meaningfully");
      }
      case "present-stronger": {
        const k = C["present-stronger"];
        if (presentationCase && impactMaterial) return pick(k.presentationImpact);
        if (presentationCase && scopeComplex) return pick(k.presentationComplex);
        if (marginPremium && tierHeadroom) return pick(k.premiumTierRoom);
        if (positioningSensitive) return pick(k.positioningSensitive);
        if (highUpgradeStory) return pick(k.highUpgradeStory);
        return pick(EXPLANATION_MAP.defaults["present-stronger"]);
      }
    }
  };

  // --- Per-strategy card computation -------------------------------
  // Computes price/margin for the chosen strategy. Anchor-first: STANDARD
  // and all HOLD / PROTECT variants sit at the current estimate; price-
  // move strategies derive from the anchor via the spread shapers.
  const computeCardForStrategy = (
    slot: OfferCardKey,
    strategy: StrategyType,
    c: DealClassification,
    shapers: SpreadShapers,
    basePrice: number,
    baseCost: number
  ): ComputedOfferCard => {
    // Legacy 3-band regime for UI chip continuity (intent-derived)
    const legacyRegime: OfferRegime =
      c.estimateIntent === "aggressive-close"
        ? "low"
        : c.estimateIntent === "premium"
          ? "high"
          : "balanced";

    const minPrice = Math.round(basePrice * (1 - OFFER_MAX_PRICE_DROP));
    const maxPrice = Math.round(basePrice * (1 + OFFER_MAX_PRICE_BUMP));

    let mode: OfferMode = "margin";
    let targetMargin = c.marginPct;
    let tierAfter: "core" | "enhanced" | "premium" = effectiveProposalTier;
    let clamped = false;

    switch (strategy) {
      case "hold-the-line":
      case "hold-firmly":
        // Non-move — sit on the anchor regardless of slot.
        mode = "hold";
        targetMargin = c.marginPct;
        break;

      case "close-slightly": {
        // Anchor-relative modest drop. Strictly below STANDARD by ≥ 0.5 pt.
        const drop = shapers.valueWidth;
        const softFloor = c.marginPct >= 18 ? 18 : OFFER_VALUE_FLOOR_PCT;
        const candidate = Math.max(softFloor, c.marginPct - drop);
        targetMargin = Math.min(c.marginPct - 0.5, candidate);
        targetMargin = Math.max(OFFER_VALUE_FLOOR_PCT, targetMargin);
        break;
      }

      case "close-harder": {
        // Anchor-relative aggressive drop; only selected on premium-intent
        // commodity/moderate work.
        const drop = shapers.valueWidth + 1.0;
        const softFloor = c.marginPct >= 18 ? 18 : OFFER_VALUE_FLOOR_PCT;
        const candidate = Math.max(softFloor, c.marginPct - drop);
        targetMargin = Math.min(c.marginPct - 0.5, candidate);
        targetMargin = Math.max(OFFER_VALUE_FLOOR_PCT, targetMargin);
        break;
      }

      case "lift-meaningfully": {
        // Anchor-relative meaningful lift, soft-capped at 32%.
        const lift = Math.max(3, shapers.premiumWidth);
        targetMargin = Math.min(
          32,
          Math.min(OFFER_MARGIN_CEILING_PCT, c.marginPct + lift)
        );
        tierAfter = "premium";
        break;
      }

      case "lift-slightly": {
        // Anchor-relative modest bump (2–5 pts typical), capped at 32%.
        const bump = Math.max(1.5, shapers.premiumWidth);
        targetMargin = Math.min(
          32,
          Math.min(OFFER_MARGIN_CEILING_PCT, c.marginPct + bump)
        );
        tierAfter = "premium";
        break;
      }

      case "present-stronger":
        // Same price, tier/presentation move.
        mode = "tier-positioning";
        targetMargin = c.marginPct;
        tierAfter = "premium";
        break;
    }

    // Derive price and apply hard rails (only for margin-mode slots)
    let price =
      mode === "margin"
        ? priceFromMarginPct(baseCost, targetMargin)
        : basePrice;

    if (mode === "margin") {
      if (slot === "value" && price < minPrice) {
        price = minPrice;
        targetMargin = marginPctFromPrice(baseCost, price);
        clamped = true;
      }
      if (slot === "premium" && price > maxPrice) {
        price = maxPrice;
        targetMargin = marginPctFromPrice(baseCost, price);
        clamped = true;
      }
      if (targetMargin < OFFER_VALUE_FLOOR_PCT) {
        targetMargin = OFFER_VALUE_FLOOR_PCT;
        price = priceFromMarginPct(baseCost, targetMargin);
      }
      if (targetMargin > OFFER_MARGIN_CEILING_PCT) {
        targetMargin = OFFER_MARGIN_CEILING_PCT;
        price = priceFromMarginPct(baseCost, targetMargin);
      }
    }

    const delta = price - basePrice;
    const deltaPct = basePrice > 0 ? (delta / basePrice) * 100 : 0;

    // Hold-context resolver — gives Hold/Hold firmly the right copy
    // based on intent + slot. Risk wins; otherwise VALUE reads as
    // "Already competitive" on aggressive/competitive-close intent and
    // PREMIUM reads as "Already well-positioned" on strong/premium.
    let holdContext: HoldContext = "generic";
    if (strategy === "hold-firmly") {
      holdContext = "risk";
    } else if (strategy === "hold-the-line") {
      if (slot === "value") {
        holdContext =
          c.estimateIntent === "aggressive-close" ||
          c.estimateIntent === "competitive-close"
            ? "already-competitive"
            : "generic";
      } else if (slot === "premium") {
        holdContext =
          c.estimateIntent === "strong" || c.estimateIntent === "premium"
            ? "already-well-positioned"
            : "generic";
      }
    }

    const labels = labelForStrategy(slot, strategy, clamped, holdContext);

    // canApply
    let canApply = false;
    if (slot === "standard") {
      canApply = false;
    } else if (mode === "hold") {
      canApply = false;
    } else if (mode === "tier-positioning") {
      canApply =
        typeof onProposalTierChange === "function" &&
        effectiveProposalTier !== "premium";
    } else {
      canApply = canEditMargin && Math.abs(delta) >= 1;
    }

    return {
      key: slot,
      mode,
      regime: legacyRegime,
      tag: labels.tag,
      positioning: labels.positioning,
      tagline: buildStrategyExplanation(
        slot,
        strategy,
        clamped,
        c,
        holdContext,
        deltaPct
      ),
      marginPct: targetMargin,
      price,
      delta,
      deltaPct,
      tierAfter,
      canApply,
      recommended: false,
    };
  };

  // --- Post-process (dumb-move detection) --------------------------
  // Runs after all three cards are built. Trivial / incoherent moves
  // degrade honestly:
  //   - trivial VALUE   → HOLD THE LINE (or PROTECT MARGIN under true protection)
  //   - trivial PREMIUM → PREMIUM POSITIONING (if credible) or HOLD THE LINE
  //   - VALUE ≥ STANDARD → HOLD THE LINE (or PROTECT MARGIN under protection)
  //   - Premium margin dipping under Standard → degrade as above
  //   - tier-positioning while already premium → HOLD THE LINE
  const applyOfferPostProcess = (
    raw: [ComputedOfferCard, ComputedOfferCard, ComputedOfferCard],
    c: DealClassification,
    shapers: SpreadShapers
  ): [ComputedOfferCard, ComputedOfferCard, ComputedOfferCard] => {
    const basePrice = displayFinalPrice;
    const baseCost = displayJobCost;
    const deltaThreshold = Math.max(150, basePrice * 0.01);

    const rebuild = (slot: OfferCardKey, s: StrategyType) =>
      computeCardForStrategy(slot, s, c, shapers, basePrice, baseCost);

    // VALUE degradation is ALWAYS HOLD THE LINE — never Hold firmly.
    //
    // Hold firmly is a selection-only outcome, produced only when
    // selectStrategyTriple sees needsTrueProtection(c) === true. A
    // margin-mode VALUE card only reaches post-process when the triple
    // picked close-slightly / close-harder, which itself requires
    // needsTrueProtection === false. Using Hold firmly as a degradation
    // fallback here would (1) contradict that invariant and (2) surface
    // "discounting is unsafe here" on non-protected balanced jobs whose
    // only sin is a rails-collapsed tiny delta. HOLD THE LINE (which
    // will pick up contextual "Already competitive" copy where
    // appropriate) is the honest neutral fallback in that case.
    const degradeValue = (): ComputedOfferCard =>
      rebuild("value", "hold-the-line");

    // PREMIUM degradation reuses the decision-intelligence upgrade score
    // for a clean, consistent fallback: if the tier story has genuine
    // substance (upgradePotential ≥ 4, which already enforces
    // tierHeadroom internally) then present-stronger is the honest
    // remaining move. Otherwise HOLD THE LINE with contextual copy.
    const scores = computeDecisionScores(c);
    const degradePremium = (): ComputedOfferCard =>
      rebuild(
        "premium",
        scores.upgradePotential >= 4 ? "present-stronger" : "hold-the-line"
      );

    let [value, standard, premium] = raw;

    // 1) Trivial Value delta — only collapse when the move is truly
    //    rails-collapsed / identical to anchor. A small-but-directional
    //    competitive move survives.
    if (value.mode === "margin" && Math.abs(value.delta) < deltaThreshold) {
      value = degradeValue();
    }

    // 2) Trivial Premium margin-mode delta → positioning or hold.
    if (premium.mode === "margin" && Math.abs(premium.delta) < deltaThreshold) {
      premium = degradePremium();
    }

    // 3) Anchor safety — VALUE must remain strictly below STANDARD.
    //    Under anchor-first this is enforced by construction; this is
    //    the authoritative safety net for any rail edge case. On violation
    //    we degrade to HOLD THE LINE, NOT Protect.
    if (
      value.mode === "margin" &&
      value.marginPct >= standard.marginPct - 0.25
    ) {
      value = degradeValue();
    }

    // 4) Positioning integrity — Premium margin must not dip below Standard.
    if (
      premium.mode === "margin" &&
      premium.marginPct < standard.marginPct - 0.5
    ) {
      premium = degradePremium();
    }

    // 5) Tier-positioning sanity — premium-positioning is only meaningful
    //    when the tier is not already premium.
    if (
      premium.mode === "tier-positioning" &&
      effectiveProposalTier === "premium"
    ) {
      premium = rebuild("premium", "hold-the-line");
    }

    return [value, standard, premium];
  };

  // --- Recommendation ----------------------------------------------
  // Picks at most one card to flag as recommended. Non-credible / hold
  // cards are never recommended by default (STANDARD is the neutral
  // fallback). Cascade order:
  //   1) PREMIUM = Recover margin with ≥ 3% lift  → PREMIUM
  //   2) VALUE   = Win the job (credible)         → VALUE
  //   3) closeSensitivity = price-sensitive       → VALUE (if credible)
  //   4) closeSensitivity = positioning-sensitive → PREMIUM (if credible)
  //   5) VALUE is hold AND PREMIUM is positioning → PREMIUM
  //   6) fallback                                 → STANDARD
  const pickRecommended = (
    cards: [ComputedOfferCard, ComputedOfferCard, ComputedOfferCard],
    c: DealClassification
  ): [ComputedOfferCard, ComputedOfferCard, ComputedOfferCard] => {
    const [value, standard, premium] = cards;
    const valueIsMove = value.mode !== "hold";
    const premiumIsMove = premium.mode !== "hold";

    let recSlot: OfferCardKey = "standard";

    if (
      premium.positioning.startsWith("Lift meaningfully") &&
      premiumIsMove &&
      Math.abs(premium.deltaPct) >= 3
    ) {
      recSlot = "premium";
    } else if (value.positioning.startsWith("Close harder") && valueIsMove) {
      recSlot = "value";
    } else if (c.closeSensitivity === "price-sensitive" && valueIsMove) {
      recSlot = "value";
    } else if (
      c.closeSensitivity === "positioning-sensitive" &&
      premiumIsMove
    ) {
      recSlot = "premium";
    } else if (premium.mode === "tier-positioning" && !valueIsMove) {
      recSlot = "premium";
    }

    // Hard exclusions — never recommend a non-move as "the" move.
    if (recSlot === "value" && !valueIsMove) recSlot = "standard";
    if (recSlot === "premium" && !premiumIsMove) recSlot = "standard";

    // Never recommend an "Already competitive" VALUE hold — STANDARD is
    // the honest recommendation when the estimate is already the close.
    if (recSlot === "value" && value.positioning === "Already competitive") {
      recSlot = "standard";
    }

    return [
      { ...value, recommended: recSlot === "value" },
      { ...standard, recommended: recSlot === "standard" },
      { ...premium, recommended: recSlot === "premium" },
    ];
  };

  // --- Engine runner -----------------------------------------------
  const offerEngineResult = (() => {
    const classification = classifyDeal();
    if (!classification) return null;
    const scores = computeDecisionScores(classification);
    const rawTriple = selectStrategyTriple(classification);
    const triple = validateSelectedStrategies(rawTriple, classification, scores);
    const shapers = computeSpreadShapers(classification);
    const rawCards: [
      ComputedOfferCard,
      ComputedOfferCard,
      ComputedOfferCard,
    ] = [
      computeCardForStrategy(
        "value",
        triple.value,
        classification,
        shapers,
        displayFinalPrice,
        displayJobCost
      ),
      computeCardForStrategy(
        "standard",
        triple.standard,
        classification,
        shapers,
        displayFinalPrice,
        displayJobCost
      ),
      computeCardForStrategy(
        "premium",
        triple.premium,
        classification,
        shapers,
        displayFinalPrice,
        displayJobCost
      ),
    ];
    const processed = applyOfferPostProcess(
      rawCards,
      classification,
      shapers
    );
    const cards = pickRecommended(processed, classification);
    return { cards, classification };
  })();

  // Live engine output (pre-lock). The displayed cards may come from a
  // locked snapshot instead; see lockedOfferSnapshot below.
  const liveOfferCards: ComputedOfferCard[] | null =
    offerEngineResult?.cards ?? null;
  const liveOfferClassification = offerEngineResult?.classification ?? null;

  // Legacy 3-band regime consumed by the Step 05 chip (UI unchanged).
  // Maps 4-band regime → existing low / balanced / high palette.
  const liveOfferRegime: OfferRegime | null = liveOfferClassification
    ? liveOfferClassification.estimateIntent === "aggressive-close"
      ? "low"
      : liveOfferClassification.estimateIntent === "premium"
        ? "high"
        : "balanced"
    : null;

  // --- Strategy lock -------------------------------------------------
  // After a strategy is applied, the estimate mutates (margin and/or
  // proposal tier), which would normally cause the engine to regenerate
  // a fresh triple from the newly applied anchor. That turns apply into
  // a suggestion loop. We freeze the strategy set by snapshotting the
  // cards/classification/regime that the user actually chose from, and
  // render from the snapshot until real scope/cost inputs change.
  //
  // Signature = scope / cost truth inputs only (NOT margin, NOT tier).
  // Applying a strategy does not shift the signature → lock holds.
  // User-edited area / pitch / tear-off / material / labor / disposal
  // (and therefore jobCost) all shift the signature → lock releases.
  type LockedOfferSnapshot = {
    cards: ComputedOfferCard[];
    classification: DealClassification;
    regime: OfferRegime;
    signature: string;
  };

  const offerTruthSignature: string | null = offerAvailable
    ? [
        Math.round(displayJobCost),
        Math.round((squaresNum || 0) * 100) / 100,
        String(effectiveScopePitch ?? ""),
        tearOffIsIncluded ? "t" : "n",
        String(effectiveScopeMaterial ?? ""),
        hasLive ? Math.round(viewModel!.proposal.labor) : 0,
        hasLive ? Math.round(viewModel!.proposal.disposal) : 0,
      ].join("|")
    : null;

  const [lockedOfferSnapshot, setLockedOfferSnapshot] =
    useState<LockedOfferSnapshot | null>(null);

  // Release the lock as soon as a real truth input shifts.
  useEffect(() => {
    if (!offerTruthSignature) return;
    setLockedOfferSnapshot((prev) => {
      if (!prev) return prev;
      if (prev.signature === offerTruthSignature) return prev;
      return null;
    });
  }, [offerTruthSignature]);

  // Displayed values — prefer the locked snapshot when present.
  const offerCards: ComputedOfferCard[] | null =
    lockedOfferSnapshot?.cards ?? liveOfferCards;
  const offerClassification =
    lockedOfferSnapshot?.classification ?? liveOfferClassification;
  const offerRegime: OfferRegime | null =
    lockedOfferSnapshot?.regime ?? liveOfferRegime;

  const [selectedOfferKey, setSelectedOfferKey] = useState<OfferCardKey | null>(
    null
  );
  const [appliedOffer, setAppliedOffer] = useState<AppliedOffer | null>(null);

  // Stale marker — triggers only on real scope/cost drift. Margin/tier
  // changes caused by the apply action do not move the signature, so
  // applying a strategy never flips the applied offer into stale state.
  const appliedOfferStale =
    appliedOffer != null &&
    appliedOffer.signatureAtApply != null &&
    offerTruthSignature != null &&
    appliedOffer.signatureAtApply !== offerTruthSignature;

  // Auto-clear applied strategy if the user edits the underlying control
  // (margin slider for margin-mode, proposal tier for positioning-mode).
  // Also releases the lock so the engine can recompute from the new state.
  useEffect(() => {
    if (!appliedOffer) return;
    if (appliedOffer.mode === "tier-positioning") {
      if (effectiveProposalTier !== "premium") {
        setAppliedOffer(null);
        setLockedOfferSnapshot(null);
      }
      return;
    }
    if (appliedOffer.mode === "margin") {
      if (Math.abs(targetMarginPct - appliedOffer.targetMarginPct) > 0.5) {
        setAppliedOffer(null);
        setLockedOfferSnapshot(null);
      }
    }
  }, [targetMarginPct, effectiveProposalTier, appliedOffer]);

  const commitOfferCard = (card: ComputedOfferCard) => {
    if (card.key === "standard") return;
    if (offerRegime == null) return;

    // Freeze the current (visible) strategy set BEFORE mutating inputs,
    // so the engine does not immediately regenerate a fresh triple from
    // the newly applied anchor.
    if (
      offerCards &&
      offerClassification &&
      offerRegime &&
      offerTruthSignature
    ) {
      setLockedOfferSnapshot({
        cards: offerCards,
        classification: offerClassification,
        regime: offerRegime,
        signature: offerTruthSignature,
      });
    }

    if (card.mode === "tier-positioning") {
      if (typeof onProposalTierChange !== "function") return;
      onProposalTierChange("premium");
      setAppliedOffer({
        key: card.key,
        mode: card.mode,
        regimeAtApply: offerRegime,
        targetMarginPct: card.marginPct,
        anchorPriceAtApply: displayFinalPrice,
        anchorCostAtApply: displayJobCost,
        tierAtApply: effectiveProposalTier,
        appliedAt: Date.now(),
        signatureAtApply: offerTruthSignature,
      });
      setSelectedOfferKey(null);
      return;
    }

    if (card.mode === "margin") {
      if (!canEditMargin) return;
      const rounded = Math.round(card.marginPct * 10) / 10;
      onMarginChange?.(rounded);
      setAppliedOffer({
        key: card.key,
        mode: card.mode,
        regimeAtApply: offerRegime,
        targetMarginPct: rounded,
        anchorPriceAtApply: card.price,
        anchorCostAtApply: displayJobCost,
        tierAtApply: effectiveProposalTier,
        appliedAt: Date.now(),
        signatureAtApply: offerTruthSignature,
      });
      setSelectedOfferKey(null);
    }
  };

  const clearAppliedOffer = () => {
    setAppliedOffer(null);
    setSelectedOfferKey(null);
    setLockedOfferSnapshot(null);
  };

  const reapplyOffer = () => {
    if (!appliedOffer) return;

    // Re-freeze the currently visible strategy set against the new truth
    // signature. The user is confirming this choice from the live cards
    // shown after the truth drift, and we don't want the engine to loop
    // again on the next render.
    if (
      offerCards &&
      offerClassification &&
      offerRegime &&
      offerTruthSignature
    ) {
      setLockedOfferSnapshot({
        cards: offerCards,
        classification: offerClassification,
        regime: offerRegime,
        signature: offerTruthSignature,
      });
    }

    if (appliedOffer.mode === "margin" && canEditMargin) {
      onMarginChange?.(appliedOffer.targetMarginPct);
      setAppliedOffer({
        ...appliedOffer,
        anchorCostAtApply: displayJobCost,
        anchorPriceAtApply: priceFromMarginPct(
          displayJobCost,
          appliedOffer.targetMarginPct
        ),
        appliedAt: Date.now(),
        signatureAtApply: offerTruthSignature,
      });
    } else if (
      appliedOffer.mode === "tier-positioning" &&
      typeof onProposalTierChange === "function"
    ) {
      onProposalTierChange("premium");
      setAppliedOffer({
        ...appliedOffer,
        anchorCostAtApply: displayJobCost,
        anchorPriceAtApply: displayFinalPrice,
        appliedAt: Date.now(),
        signatureAtApply: offerTruthSignature,
      });
    }
  };

  const outcomeCustomerName = hasLive
    ? viewModel!.customer.name.trim() || "New Customer"
    : "New Customer";
  const outcomeJobLine = hasLive
    ? (() => {
        const addr = viewModel!.job.address1.trim() || "Address not set";
        const cs = [viewModel!.job.city, viewModel!.job.state]
          .map((s) => (s ?? "").trim())
          .filter(Boolean)
          .join(", ");
        return cs ? `${addr} · ${cs}` : addr;
      })()
    : "Address not set";

  const outcomeCardClass =
    effectivePricingMode === "direct"
      ? "mt-3.5 rounded-[22px] border border-white/[0.16] bg-[radial-gradient(ellipse_100%_80%_at_50%_0%,rgba(34,211,238,0.08),transparent_55%),linear-gradient(180deg,rgba(12,18,28,0.95)_0%,rgba(8,12,20,0.98)_100%)] p-1 shadow-[0_24px_60px_-14px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)]"
      : "mt-3.5 rounded-[22px] border border-cyan-400/20 bg-[radial-gradient(ellipse_100%_80%_at_50%_0%,rgba(34,211,238,0.12),transparent_55%),linear-gradient(180deg,rgba(12,18,28,0.95)_0%,rgba(8,12,20,0.98)_100%)] p-1 shadow-[0_24px_60px_-14px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.05)]";

  const outcomeHeaderBandClass =
    effectivePricingMode === "direct"
      ? "rounded-[14px] border border-white/[0.12] bg-gradient-to-r from-white/[0.12] via-white/[0.06] to-white/[0.04] px-3.5 py-2 sm:px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
      : "rounded-[14px] border border-white/[0.10] bg-gradient-to-r from-white/[0.09] via-white/[0.05] to-cyan-500/[0.08] px-3.5 py-2 sm:px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]";

  const customerFields = hasLive
    ? [
        { label: "Customer name", value: viewModel!.customer.name.trim() || "—" },
        { label: "Phone", value: viewModel!.customer.phone.trim() || "—" },
        { label: "Email", value: viewModel!.customer.email.trim() || "—" },
      ]
    : [
        { label: "Customer name", value: "Homeowner name" },
        { label: "Phone", value: "(555) 123-4567" },
        { label: "Email", value: "name@example.com" },
      ];

  const jobLine2 = hasLive
    ? [viewModel!.job.city, viewModel!.job.state, viewModel!.job.zip].filter(Boolean).join(", ").trim() || "—"
    : "Full roof replacement";

  const jobFields = hasLive
    ? [
        { label: "Property address", value: viewModel!.job.address1.trim() || "—" },
        { label: "City, State, ZIP", value: jobLine2 },
      ]
    : [
        { label: "Property address", value: "123 Example St" },
        { label: "Project type", value: "Full roof replacement" },
      ];

  const intakeReady =
    intakeEditable
      ? Boolean((customerName ?? "").trim()) &&
        Boolean((customerEmail ?? "").trim()) &&
        Boolean((jobZip ?? "").trim())
      : hasLive
        ? Boolean((viewModel!.customer.name ?? "").trim()) &&
          Boolean((viewModel!.customer.email ?? "").trim()) &&
          Boolean((viewModel!.job.zip ?? "").trim())
        : true;

  const canUseSaveEstimate =
    typeof onSaveEstimate === "function" && canSaveEstimate === true && !isSavingEstimate;

  const canUseSendEstimate =
    typeof onSendEstimate === "function" && canSendEstimate === true && !isSendingEstimate;

  const canEditBundleCost = typeof onBundleCostChange === "function";

  const canEditDumpFee = typeof onDumpFeePerTonChange === "function";

  const laborModeIsManual = true;

  const canEditManualLaborTotal = typeof onManualLaborTotalChange === "function";

  const intakeFieldInputClass =
    "w-full rounded-xl border border-white/[0.12] bg-black/25 px-3 py-2.5 text-sm text-white/95 placeholder:text-white/28 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/30";

  const pricingFieldInputClass =
    "w-full rounded-lg border border-white/[0.12] bg-black/25 px-2.5 py-2 text-sm text-white/95 placeholder:text-white/28 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/30";

  const mainStyle = isEmbedded
    ? { backgroundColor: "#101820" as const }
    : {
        backgroundImage: `
          linear-gradient(180deg, #1b2636 0%, #131c28 38%, #0d151e 100%),
          radial-gradient(ellipse 90% 55% at 75% -5%, rgba(59, 130, 246, 0.10), transparent 58%),
          radial-gradient(ellipse 70% 45% at 12% 85%, rgba(34, 211, 238, 0.075), transparent 55%)
        `,
        backgroundColor: "#0d151e",
      };

  const innerMaxWClass = isEmbedded
    ? "relative mx-auto max-w-6xl px-4 py-4 sm:px-5 sm:py-5"
    : "relative mx-auto max-w-6xl px-5 py-7 sm:px-8 sm:py-8 lg:px-10 lg:py-10";

  const Root = isEmbedded ? "div" : "main";
  const rootExtra = isEmbedded
    ? ({ role: "region" as const, "aria-label": "Roofing V2 embedded preview" } as const)
    : {};

  const shell = (
    <Root
      className={isEmbedded ? "text-white" : "min-h-screen text-white"}
      style={mainStyle}
      {...rootExtra}
    >
      {!isEmbedded ? (
        <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
          <div className="absolute top-[20%] right-0 h-[50vh] w-[55vw] max-w-3xl rounded-full bg-blue-500/[0.04] blur-[120px]" />
          <div className="absolute bottom-0 left-1/4 h-64 w-64 rounded-full bg-cyan-500/[0.05] blur-[100px]" />
        </div>
      ) : null}

      <div className={innerMaxWClass}>
        {/* TOP HEADER STRIP */}
        <header className="mb-6 border-b border-white/[0.06] px-6 pb-6 sm:px-8 sm:mb-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_12px_2px_rgba(34,211,238,0.7)]"
                />
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.24em] text-cyan-200/85">
                  Roofing V2 Workflow
                </p>
              </div>
              <h1 className="mt-2 text-[1.85rem] font-bold tracking-[-0.02em] text-white sm:text-[2.15rem]">
                Build the deal
              </h1>
              <p className="mt-2 max-w-xl text-[12.5px] leading-relaxed text-white/60">
                Intake to outcome to delivery — pricing updates live as you go.
              </p>
              <ol className="mt-4 flex flex-wrap items-center gap-1.5" aria-label="Build flow progress">
                {(
                  [
                    { n: "01", label: "Intake", done: intakeReady, active: !intakeReady },
                    { n: "02", label: "Strategy", done: intakeReady, active: false },
                    { n: "03", label: "Scope & Costs", done: intakeReady, active: false },
                    { n: "04", label: "Outcome", done: intakeReady, active: intakeReady && !canUseSendEstimate },
                    { n: "05", label: "Readiness", done: canUseSendEstimate, active: false },
                    { n: "06", label: "Deliver", done: false, active: canUseSendEstimate },
                  ] as const
                ).map((step) => (
                  <li
                    key={step.n}
                    className={
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] " +
                      (step.active
                        ? "border-cyan-400/40 bg-gradient-to-b from-cyan-500/[0.22] to-cyan-600/[0.08] text-cyan-50 shadow-[0_0_14px_-3px_rgba(34,211,238,0.5),inset_0_1px_0_rgba(255,255,255,0.10)]"
                        : step.done
                          ? "border-emerald-400/25 bg-emerald-500/[0.10] text-emerald-100/90"
                          : "border-white/[0.08] bg-white/[0.03] text-white/45")
                    }
                  >
                    <span
                      aria-hidden
                      className={
                        "tabular-nums text-[9.5px] " +
                        (step.active ? "text-cyan-100" : step.done ? "text-emerald-200/80" : "text-white/35")
                      }
                    >
                      {step.n}
                    </span>
                    {step.label}
                  </li>
                ))}
              </ol>
            </div>
            <div className="flex flex-shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end sm:gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-gradient-to-b from-amber-500/[0.18] to-amber-600/[0.08] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-100 shadow-[0_0_12px_-2px_rgba(251,191,36,0.35),inset_0_1px_0_rgba(255,255,255,0.08)]">
                <span aria-hidden className="h-1 w-1 rounded-full bg-amber-200 shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
                {hasLive ? "Live pricing" : "Preview mode"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.02] px-3 py-1.5 text-[11.5px] font-medium text-white/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <span aria-hidden className="h-1 w-1 rounded-full bg-cyan-300/70 shadow-[0_0_5px_rgba(34,211,238,0.55)]" />
                Workspace active
              </span>
            </div>
          </div>
        </header>

        {/* MAIN LAYOUT — paired rows: intake/deal, scope/live, readiness/next */}
        <div className="grid grid-cols-1 gap-y-8 lg:grid-cols-12 lg:gap-x-8 lg:gap-y-10 lg:items-start">
          {/* Section A — Job intake */}
          <section id="v2-step-01" className="relative lg:col-span-7">
            <div className="relative overflow-hidden rounded-[22px] border border-white/[0.07] bg-[radial-gradient(ellipse_100%_60%_at_50%_-10%,rgba(34,211,238,0.07),transparent_60%),linear-gradient(180deg,rgba(16,24,34,0.60)_0%,rgba(10,16,24,0.70)_100%)] p-5 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-6">
              <span
                aria-hidden
                className="pointer-events-none absolute -top-20 right-[-10%] h-48 w-48 rounded-full bg-cyan-400/[0.07] blur-[90px]"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute left-0 top-8 bottom-8 w-px bg-gradient-to-b from-cyan-400/45 via-cyan-400/14 to-transparent"
              />
              <div className="relative flex flex-wrap items-start justify-between gap-3 pl-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span aria-hidden className="h-1 w-1 rounded-full bg-cyan-300 shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-200/85">
                      Step 01 — Intake
                    </p>
                  </div>
                  <h2 className="mt-1 text-[1.2rem] font-semibold tracking-tight text-white">Job intake</h2>
                  <p className="mt-1 max-w-md text-[11.5px] leading-relaxed text-white/55">
                    Customer and property information that anchors pricing confidence.
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                  <div
                    role="status"
                    className={
                      intakeReady
                        ? "inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-gradient-to-b from-emerald-500/[0.18] to-emerald-600/[0.08] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-50 shadow-[0_0_14px_-2px_rgba(16,185,129,0.4),inset_0_1px_0_rgba(255,255,255,0.10)]"
                        : "inline-flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-500/[0.10] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-100/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                    }
                  >
                    <span
                      aria-hidden
                      className={
                        "h-1 w-1 rounded-full " +
                        (intakeReady
                          ? "bg-emerald-300 shadow-[0_0_6px_rgba(16,185,129,0.7)]"
                          : "bg-amber-300 shadow-[0_0_6px_rgba(251,191,36,0.7)]")
                      }
                    />
                    {intakeReady ? "Ready to price" : "Missing details"}
                  </div>
                  <span className="text-[10px] leading-snug text-white/45">
                    {intakeReady ? "All required details present" : "Complete intake to unlock full pricing"}
                  </span>
                </div>
              </div>
              <div className="relative mt-5 grid grid-cols-1 gap-5 pl-3 sm:gap-6 lg:grid-cols-[1fr_auto_1fr] lg:gap-7">
                {intakeEditable ? (
                  <>
                    <div className="min-w-0">
                      <h3 className="text-[9px] font-semibold uppercase tracking-[0.2em] text-cyan-200/70">Customer</h3>
                      <div className="mt-3 flex flex-col gap-2.5">
                        <div className="space-y-1">
                          <label htmlFor="v2-intake-customer-name" className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">
                            Name
                          </label>
                          <input
                            id="v2-intake-customer-name"
                            type="text"
                            autoComplete="off"
                            value={customerName ?? ""}
                            onChange={(e) => onCustomerNameChange?.(e.target.value)}
                            className={intakeFieldInputClass}
                          />
                        </div>
                        <div className="space-y-1">
                          <label htmlFor="v2-intake-customer-email" className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">
                            Email
                          </label>
                          <input
                            id="v2-intake-customer-email"
                            type="email"
                            inputMode="email"
                            autoComplete="off"
                            value={customerEmail ?? ""}
                            onChange={(e) => onCustomerEmailChange?.(e.target.value)}
                            className={intakeFieldInputClass}
                          />
                        </div>
                        <div className="space-y-1">
                          <label htmlFor="v2-intake-customer-phone" className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">
                            Phone
                          </label>
                          <input
                            id="v2-intake-customer-phone"
                            type="tel"
                            inputMode="tel"
                            autoComplete="off"
                            value={customerPhone ?? ""}
                            onChange={(e) => onCustomerPhoneChange?.(e.target.value)}
                            className={intakeFieldInputClass}
                          />
                        </div>
                      </div>
                    </div>
                    <div aria-hidden className="hidden lg:block lg:w-px lg:bg-gradient-to-b lg:from-transparent lg:via-white/[0.08] lg:to-transparent" />
                    <div className="min-w-0">
                      <h3 className="text-[9px] font-semibold uppercase tracking-[0.2em] text-cyan-200/70">Property</h3>
                      <div className="mt-3 flex flex-col gap-2.5">
                        <div className="space-y-1">
                          <label htmlFor="v2-intake-job-address" className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">
                            Address
                          </label>
                          <input
                            id="v2-intake-job-address"
                            type="text"
                            autoComplete="off"
                            value={jobAddress1 ?? ""}
                            onChange={(e) => onJobAddress1Change?.(e.target.value)}
                            onBlur={(e) => onJobAddress1Blur?.(e.target.value)}
                            className={intakeFieldInputClass}
                          />
                        </div>
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                          <div className="space-y-1">
                            <label htmlFor="v2-intake-job-city" className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">
                              City
                            </label>
                            <input
                              id="v2-intake-job-city"
                              type="text"
                              autoComplete="off"
                              value={jobCity ?? ""}
                              onChange={(e) => onJobCityChange?.(e.target.value)}
                              onBlur={(e) => onJobCityBlur?.(e.target.value)}
                              className={intakeFieldInputClass}
                            />
                          </div>
                          <div className="space-y-1">
                            <label htmlFor="v2-intake-job-state" className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">
                              State
                            </label>
                            <input
                              id="v2-intake-job-state"
                              type="text"
                              autoComplete="off"
                              value={jobState ?? ""}
                              onChange={(e) => onJobStateChange?.(e.target.value)}
                              onBlur={(e) => onJobStateBlur?.(e.target.value)}
                              className={intakeFieldInputClass}
                            />
                          </div>
                          <div className="space-y-1">
                            <label htmlFor="v2-intake-job-zip" className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">
                              ZIP
                            </label>
                            <input
                              id="v2-intake-job-zip"
                              type="text"
                              inputMode="numeric"
                              autoComplete="postal-code"
                              value={jobZip ?? ""}
                              onChange={(e) => onJobZipChange?.(e.target.value)}
                              onBlur={() => onJobZipBlur?.()}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  onJobZipEnter?.();
                                }
                              }}
                              className={intakeFieldInputClass}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="min-w-0">
                      <h3 className="text-[9px] font-semibold uppercase tracking-[0.2em] text-cyan-200/70">Customer details</h3>
                      <div className="mt-3 flex flex-col gap-2">
                        {customerFields.map((field) => (
                          <div
                            key={field.label}
                            className="rounded-xl border border-white/[0.08] bg-gradient-to-b from-white/[0.045] to-white/[0.02] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                          >
                            <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/45">{field.label}</div>
                            <div className="mt-1 truncate text-sm font-semibold tracking-tight text-white">{field.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div aria-hidden className="hidden lg:block lg:w-px lg:bg-gradient-to-b lg:from-transparent lg:via-white/[0.08] lg:to-transparent" />
                    <div className="min-w-0">
                      <h3 className="text-[9px] font-semibold uppercase tracking-[0.2em] text-cyan-200/70">Job details</h3>
                      <div className="mt-3 flex flex-col gap-2">
                        {jobFields.map((field) => (
                          <div
                            key={field.label}
                            className="rounded-xl border border-white/[0.08] bg-gradient-to-b from-white/[0.045] to-white/[0.02] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                          >
                            <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/45">{field.label}</div>
                            <div className="mt-1 truncate text-sm font-semibold tracking-tight text-white">{field.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="relative mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3 pl-3">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
                  <span
                    aria-hidden
                    className={
                      "h-1 w-1 rounded-full " +
                      (intakeReady ? "bg-emerald-400/80 shadow-[0_0_5px_rgba(16,185,129,0.6)]" : "bg-amber-400/80 shadow-[0_0_5px_rgba(251,191,36,0.6)]")
                    }
                  />
                  Intake signal
                </span>
                <span className="text-[10.5px] leading-snug text-white/45">
                  {intakeReady
                    ? "All core intake fields are present for pricing."
                    : "If key fields are missing, pricing confidence will be limited."}
                </span>
              </div>
            </div>
          </section>

          {/* Section D — Deal Control */}
          <section className="relative lg:col-span-5">
            <div className="relative overflow-hidden rounded-[22px] border border-white/[0.07] bg-[radial-gradient(ellipse_100%_60%_at_50%_-10%,rgba(34,211,238,0.07),transparent_60%),linear-gradient(180deg,rgba(16,24,34,0.60)_0%,rgba(10,16,24,0.70)_100%)] p-5 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-6">
              <span
                aria-hidden
                className="pointer-events-none absolute -top-20 right-[-10%] h-48 w-48 rounded-full bg-cyan-400/[0.07] blur-[90px]"
              />
              <div className="relative flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span aria-hidden className="h-1 w-1 rounded-full bg-cyan-300 shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-200/85">
                      Step 02 — Strategy
                    </p>
                  </div>
                  <h2 className="mt-1 text-[1.2rem] font-semibold tracking-tight text-white">Deal control</h2>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                  <div
                    role="status"
                    className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-gradient-to-b from-cyan-500/[0.16] to-cyan-600/[0.06] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-50 shadow-[0_0_14px_-3px_rgba(34,211,238,0.45),inset_0_1px_0_rgba(255,255,255,0.10)]"
                  >
                    <span aria-hidden className="h-1 w-1 rounded-full bg-cyan-300 shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
                    {effectivePricingMode === "markup" ? "Markup" : "Direct"}
                    {shownMarginPct != null ? (
                      <>
                        <span aria-hidden className="opacity-50">
                          ·
                        </span>
                        <span className="tabular-nums">{Math.round(shownMarginPct)}%</span>
                      </>
                    ) : null}
                    <span aria-hidden className="opacity-50">
                      ·
                    </span>
                    {effectiveProposalTier === "core"
                      ? "Core"
                      : effectiveProposalTier === "enhanced"
                        ? "Enhanced"
                        : "Premium"}
                  </div>
                  <span className="text-[10px] leading-snug text-white/45">Current pricing &amp; proposal stance</span>
                </div>
              </div>
              <div className="relative mt-4 flex flex-col gap-4">
                {/* GROUP 1 — PRICING (Contractor) */}
                <div>
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">
                      <span aria-hidden className="h-1 w-1 rounded-full bg-cyan-300/65 shadow-[0_0_5px_rgba(34,211,238,0.5)]" />
                      Pricing mode
                    </div>
                    <div className="mt-1.5 flex gap-2">
                      <button
                        type="button"
                        disabled={isLive ? !controlPermissions.pricingMode : false}
                        onClick={() => {
                          if (controlPermissions.pricingMode) {
                            onPricingModeChange?.("markup");
                            return;
                          }
                          if (isLive) return;
                          setPricingMode("markup");
                        }}
                        className={
                          (effectivePricingMode === "markup"
                            ? "rounded-full border border-cyan-400/40 bg-gradient-to-b from-cyan-500/[0.22] to-cyan-600/[0.10] px-3 py-1 text-[10.5px] font-semibold tracking-tight text-cyan-50 shadow-[0_0_14px_-2px_rgba(34,211,238,0.5),inset_0_1px_0_rgba(255,255,255,0.1)] transition active:scale-[0.97]"
                            : "rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[10.5px] font-semibold tracking-tight text-white/55 transition hover:border-white/[0.14] hover:bg-white/[0.06] hover:text-white/80 active:scale-[0.97]") +
                          (!controlPermissions.pricingMode && isLive ? " cursor-not-allowed opacity-45" : "")
                        }
                      >
                        Markup
                      </button>
                      <button
                        type="button"
                        disabled={isLive ? !controlPermissions.pricingMode : false}
                        onClick={() => {
                          if (controlPermissions.pricingMode) {
                            onPricingModeChange?.("direct");
                            return;
                          }
                          if (isLive) return;
                          setPricingMode("direct");
                        }}
                        className={
                          (effectivePricingMode === "direct"
                            ? "rounded-full border border-cyan-400/40 bg-gradient-to-b from-cyan-500/[0.22] to-cyan-600/[0.10] px-3 py-1 text-[10.5px] font-semibold tracking-tight text-cyan-50 shadow-[0_0_14px_-2px_rgba(34,211,238,0.5),inset_0_1px_0_rgba(255,255,255,0.1)] transition active:scale-[0.97]"
                            : "rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[10.5px] font-semibold tracking-tight text-white/55 transition hover:border-white/[0.14] hover:bg-white/[0.06] hover:text-white/80 active:scale-[0.97]") +
                          (!controlPermissions.pricingMode && isLive ? " cursor-not-allowed opacity-45" : "")
                        }
                      >
                        Direct
                      </button>
                    </div>
                  </div>

                  {/* Slider */}
                  <div
                    className={
                      "mt-3 transition-all duration-200 " +
                      (effectivePricingMode === "markup"
                        ? "opacity-100 saturate-100"
                        : "opacity-30 saturate-50")
                    }
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">
                        <span aria-hidden className="h-1 w-1 rounded-full bg-cyan-300/65 shadow-[0_0_5px_rgba(34,211,238,0.5)]" />
                        Target margin
                      </span>
                      <span className={`tabular-nums text-[1.4rem] font-semibold leading-none ${marginColorClass}`}>
                        {`${Math.round(targetMarginPct)}%`}
                      </span>
                    </div>

                    <div
                      className="group relative mt-1.5 h-6"
                      style={{ ["--mfill" as string]: `${marginFillPct}%` }}
                    >
                      <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-[4px] -translate-y-1/2 rounded-full bg-white/[0.06] shadow-[inset_0_1px_0_rgba(0,0,0,0.35)]" />

                      <div
                        className="pointer-events-none absolute left-0 top-1/2 h-[5px] -translate-y-1/2 rounded-full bg-gradient-to-r from-cyan-400/95 via-cyan-300 to-cyan-200 shadow-[0_0_12px_-1px_rgba(34,211,238,0.7)]"
                        style={{ width: `var(--mfill)` }}
                      />

                      <div
                        className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-100/70 bg-gradient-to-b from-cyan-200 to-cyan-500 shadow-[0_0_0_3px_rgba(34,211,238,0),0_0_14px_-1px_rgba(34,211,238,0.85),inset_0_1px_0_rgba(255,255,255,0.55)] transition-all duration-150 group-hover:scale-110 group-hover:shadow-[0_0_0_4px_rgba(34,211,238,0.18),0_0_18px_-1px_rgba(34,211,238,0.95),inset_0_1px_0_rgba(255,255,255,0.6)] group-active:scale-95"
                        style={{ left: `var(--mfill)` }}
                      />

                      <input
                        type="range"
                        min={MARGIN_MIN}
                        max={MARGIN_MAX}
                        step={MARGIN_STEP}
                        value={targetMarginPct}
                        onChange={(e) => canEditMargin && onMarginChange?.(Number(e.target.value))}
                        disabled={!canEditMargin}
                        aria-label="Target margin percentage"
                        className={
                          "absolute inset-0 z-10 h-full w-full appearance-none bg-transparent opacity-0 " +
                          (canEditMargin ? "cursor-pointer" : "pointer-events-none cursor-not-allowed")
                        }
                      />
                    </div>

                    {/* Tick labels */}
                    <div className="relative mt-1.5 h-2.5">
                      {MARGIN_TICKS.map((t) => {
                        const left = ((t - MARGIN_MIN) / (MARGIN_MAX - MARGIN_MIN)) * 100;
                        return (
                          <span
                            key={t}
                            aria-hidden
                            className={
                              "absolute -translate-x-1/2 text-[9.5px] font-medium tabular-nums tracking-[0.06em] " +
                              (t <= targetMarginPct ? "text-cyan-200/70" : "text-white/35")
                            }
                            style={{ left: `${left}%` }}
                          >
                            {t}
                          </span>
                        );
                      })}
                    </div>

                    {effectivePricingMode === "direct" && (
                      <p className="mt-2 text-[10.5px] leading-snug text-white/50">
                        Margin is not used in direct pricing.
                      </p>
                    )}
                  </div>
                </div>

                {/* DIVIDER */}
                <div aria-hidden className="h-px w-full bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

                {/* GROUP 2 — PRESENTATION (Homeowner) */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">
                        <span aria-hidden className="h-1 w-1 rounded-full bg-cyan-300/65 shadow-[0_0_5px_rgba(34,211,238,0.5)]" />
                        Proposal tier
                      </div>
                      <div className="mt-1.5 flex gap-2">
                        <button
                          type="button"
                          disabled={isLive ? !controlPermissions.proposalTier : false}
                          onClick={() => {
                            if (controlPermissions.proposalTier) {
                              onProposalTierChange?.("standard");
                              return;
                            }
                            if (isLive) return;
                            setProposalTier("core");
                          }}
                          className={
                            (effectiveProposalTier === "core"
                              ? "rounded-full border border-cyan-400/40 bg-gradient-to-b from-cyan-500/[0.22] to-cyan-600/[0.10] px-3 py-1 text-[10.5px] font-semibold tracking-tight text-cyan-50 shadow-[0_0_14px_-2px_rgba(34,211,238,0.5),inset_0_1px_0_rgba(255,255,255,0.1)] transition active:scale-[0.97]"
                              : "rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[10.5px] font-semibold tracking-tight text-white/55 transition hover:border-white/[0.14] hover:bg-white/[0.06] hover:text-white/80 active:scale-[0.97]") +
                            (!controlPermissions.proposalTier && isLive ? " cursor-not-allowed opacity-45" : "")
                          }
                        >
                          Core
                        </button>
                        <button
                          type="button"
                          disabled={isLive ? !controlPermissions.proposalTier : false}
                          onClick={() => {
                            if (controlPermissions.proposalTier) {
                              onProposalTierChange?.("enhanced");
                              return;
                            }
                            if (isLive) return;
                            setProposalTier("enhanced");
                          }}
                          className={
                            (effectiveProposalTier === "enhanced"
                              ? "rounded-full border border-cyan-400/40 bg-gradient-to-b from-cyan-500/[0.22] to-cyan-600/[0.10] px-3 py-1 text-[10.5px] font-semibold tracking-tight text-cyan-50 shadow-[0_0_14px_-2px_rgba(34,211,238,0.5),inset_0_1px_0_rgba(255,255,255,0.1)] transition active:scale-[0.97]"
                              : "rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[10.5px] font-semibold tracking-tight text-white/55 transition hover:border-white/[0.14] hover:bg-white/[0.06] hover:text-white/80 active:scale-[0.97]") +
                            (!controlPermissions.proposalTier && isLive ? " cursor-not-allowed opacity-45" : "")
                          }
                        >
                          Enhanced
                        </button>
                        <button
                          type="button"
                          disabled={isLive ? !controlPermissions.proposalTier : false}
                          onClick={() => {
                            if (controlPermissions.proposalTier) {
                              onProposalTierChange?.("premium");
                              return;
                            }
                            if (isLive) return;
                            setProposalTier("premium");
                          }}
                          className={
                            (effectiveProposalTier === "premium"
                              ? "rounded-full border border-cyan-400/40 bg-gradient-to-b from-cyan-500/[0.22] to-cyan-600/[0.10] px-3 py-1 text-[10.5px] font-semibold tracking-tight text-cyan-50 shadow-[0_0_14px_-2px_rgba(34,211,238,0.5),inset_0_1px_0_rgba(255,255,255,0.1)] transition active:scale-[0.97]"
                              : "rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[10.5px] font-semibold tracking-tight text-white/55 transition hover:border-white/[0.14] hover:bg-white/[0.06] hover:text-white/80 active:scale-[0.97]") +
                            (!controlPermissions.proposalTier && isLive ? " cursor-not-allowed opacity-45" : "")
                          }
                        >
                          Premium
                        </button>
                      </div>
                    </div>
                    <p className="max-w-[14rem] text-[10.5px] leading-snug text-white/50 sm:text-right">
                      {proposalTierSupport}.
                    </p>
                  </div>
                </div>
              </div>
              <div className="relative mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
                  <span aria-hidden className="h-1 w-1 rounded-full bg-cyan-300/75 shadow-[0_0_5px_rgba(34,211,238,0.6)]" />
                  Strategy signal
                </span>
                <span className="text-[10.5px] leading-snug text-white/45">
                  Tune pricing and tier — Outcome updates live.
                </span>
              </div>
            </div>
          </section>

          <div className="col-span-12 flex flex-col gap-y-8 lg:grid lg:grid-cols-12 lg:gap-x-8 lg:gap-y-10 lg:items-start">
            <div className="contents lg:col-span-7 lg:flex lg:flex-col lg:items-stretch lg:gap-y-10">
          {/* Section B — Scope & Costs (unified configurator) */}
          <section id="v2-step-03" className="relative order-1 lg:order-none">
            <div className="relative overflow-hidden rounded-[22px] border border-white/[0.07] bg-[radial-gradient(ellipse_100%_60%_at_50%_-10%,rgba(34,211,238,0.07),transparent_60%),linear-gradient(180deg,rgba(16,24,34,0.60)_0%,rgba(10,16,24,0.70)_100%)] p-5 shadow-[0_22px_55px_-24px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-6">
              <span
                aria-hidden
                className="pointer-events-none absolute -top-24 right-[-12%] h-56 w-56 rounded-full bg-cyan-400/[0.07] blur-[100px]"
              />
              {/* Panel header */}
              <div className="relative flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span aria-hidden className="h-1 w-1 rounded-full bg-cyan-300 shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-200/85">
                      Step 03 — Scope &amp; Costs
                    </p>
                  </div>
                  <h2 className="mt-1 text-[1.45rem] font-semibold tracking-tight text-white">Configure the job</h2>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-white/55">
                    Four decisions and three inputs become the outcome.
                  </p>
                </div>
              </div>
              {/* Stage A — Decisions */}
              <div className="relative mt-5">
                <div className="mb-2 flex items-center gap-2">
                  <span
                    aria-hidden
                    className="flex h-5 w-5 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-500/[0.10] text-[9px] font-bold tabular-nums text-cyan-100/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  >
                    A
                  </span>
                  <p className="text-[9.5px] font-semibold uppercase tracking-[0.2em] text-white/55">
                    Decisions
                  </p>
                  <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-white/[0.10] to-transparent" />
                </div>
                <div className="divide-y divide-white/[0.06] border-t border-white/[0.06]">
              {(
                [
                  {
                    id: "roofSize" as const,
                    title: "Roof size",
                    value: effectiveScopeRoofSize,
                    helper: "Measured footprint",
                    isTileLive: controlPermissions.scopeRoofSize,
                    Icon: Ruler,
                  },
                  {
                    id: "pitch" as const,
                    title: "Roof difficulty",
                    value: effectiveScopePitch,
                    helper: "Affects labor posture",
                    isTileLive: controlPermissions.scopePitch,
                    Icon: Mountain,
                  },
                  {
                    id: "tearOff" as const,
                    title: "Tear-off",
                    value: effectiveScopeTearOff,
                    helper: "Removal and disposal ready",
                    isTileLive: controlPermissions.scopeTearOff,
                    Icon: Trash2,
                  },
                  {
                    id: "material" as const,
                    title: "Material coverage",
                    value: effectiveScopeMaterial,
                    helper: "Primary install package",
                    isTileLive: controlPermissions.scopeMaterial,
                    Icon: Layers,
                  },
                ] as const
              ).map((tile) => {
                const isTileLocked = isLive && !tile.isTileLive;
                const disabled =
                  tile.id === "roofSize"
                    ? isLive
                      ? !controlPermissions.scopeRoofSize
                      : false
                    : tile.id === "tearOff"
                      ? isLive
                        ? !controlPermissions.scopeTearOff
                        : false
                      : tile.id === "material"
                        ? isLive
                          ? !controlPermissions.scopeMaterial
                          : false
                        : tile.id === "pitch"
                          ? isLive
                            ? !controlPermissions.scopePitch
                            : false
                          : isLive;
                const tileInteractive = !disabled;
                const rowNumber =
                  tile.id === "roofSize" ? "01" : tile.id === "pitch" ? "02" : tile.id === "tearOff" ? "03" : "04";
                if (tile.id === "roofSize" && tile.isTileLive) {
                  const isOpen = activeScopeEditor === "roofSize";
                  return (
                    <div
                      key={tile.id}
                      className={
                        "group w-full py-4 text-left transition-all duration-200 ease-out hover:bg-gradient-to-r hover:from-white/[0.025] hover:via-white/[0.015] hover:to-transparent hover:pl-1 active:scale-[0.997]" +
                        (disabled ? " cursor-not-allowed opacity-55" : "")
                      }
                    >
                      <button
                        type="button"
                        disabled={disabled}
                        aria-expanded={isOpen}
                        onClick={() =>
                          setActiveScopeEditor((prev) => (prev === "roofSize" ? null : "roofSize"))
                        }
                        className={
                          "flex w-full items-center gap-5 rounded-lg text-left outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-400/30 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent" +
                          (disabled ? " cursor-not-allowed opacity-55" : "")
                        }
                      >
                        <span className="w-6 shrink-0 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25 tabular-nums transition group-hover:text-cyan-300/70">
                          {rowNumber}
                        </span>
                        <tile.Icon
                          aria-hidden
                          strokeWidth={1.65}
                          className="h-4 w-4 shrink-0 text-white/48 drop-shadow-[0_0_8px_rgba(34,211,238,0.35)] transition group-hover:text-cyan-200/95 group-hover:drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]"
                        />
                        <span className="w-32 shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/63 transition group-hover:text-white/78 sm:w-40">
                          {tile.title}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[1.48rem] font-semibold tracking-tight text-white [text-shadow:0_1px_0_rgba(0,0,0,0.25)] sm:text-[1.62rem]">
                          {tile.value}
                          <span className="ml-2 text-[11px] font-medium tabular-nums tracking-tight text-white/45 transition group-hover:text-white/60">
                            {getCurrentRoofAreaSqFtForStepper().toLocaleString()} sq ft
                          </span>
                        </span>
                        <span
                          className={
                            "shrink-0 text-[11px] font-semibold uppercase tracking-[0.16em] transition " +
                            (tileInteractive
                              ? "text-white/45 group-hover:text-cyan-200 group-hover:[text-shadow:0_0_12px_rgba(34,211,238,0.45)]"
                              : "text-white/30")
                          }
                        >
                          {isOpen ? "Close" : "Adjust"}
                          <span aria-hidden className="ml-1 inline-block transition group-hover:translate-x-0.5">
                            {isOpen ? "↓" : "→"}
                          </span>
                        </span>
                      </button>
                      {isOpen && roofSizeCanAdjust ? (
                        <div className="mt-3 ml-10 flex items-center gap-3 sm:ml-[184px]">
                          <button
                            type="button"
                            aria-label="Decrease roof size by 100 sq ft"
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.10] bg-gradient-to-b from-white/[0.06] to-white/[0.02] text-base font-semibold text-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_2px_rgba(0,0,0,0.3)] transition hover:border-cyan-400/40 hover:from-cyan-500/[0.10] hover:to-white/[0.03] hover:text-white active:scale-95"
                            onClick={handleRoofSizeDecrease}
                          >
                            −
                          </button>
                          <span className="min-w-[8rem] text-center text-[14px] font-semibold tabular-nums tracking-tight text-white">
                            {getCurrentRoofAreaSqFtForStepper().toLocaleString()} sq ft
                          </span>
                          <button
                            type="button"
                            aria-label="Increase roof size by 100 sq ft"
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.10] bg-gradient-to-b from-white/[0.06] to-white/[0.02] text-base font-semibold text-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_2px_rgba(0,0,0,0.3)] transition hover:border-cyan-400/40 hover:from-cyan-500/[0.10] hover:to-white/[0.03] hover:text-white active:scale-95"
                            onClick={handleRoofSizeIncrease}
                          >
                            +
                          </button>
                          <span className="text-[10px] uppercase tracking-[0.16em] text-white/40">
                            Fine adjust · 100 sq ft steps
                          </span>
                        </div>
                      ) : null}
                    </div>
                  );
                }
                return (
                  <button
                    key={tile.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      if (tile.id === "material" && controlPermissions.scopeMaterial) {
                        onMaterialDensityChange?.(getNextMaterialDensityValue(effectiveScopeMaterial));
                        return;
                      }
                      if (tile.id === "tearOff" && controlPermissions.scopeTearOff) {
                        onTearOffChange?.(!tearOffIsIncluded);
                        return;
                      }
                      if (tile.id === "pitch" && controlPermissions.scopePitch) {
                        const nextDisplay = getNextPitchDisplayValue(effectiveScopePitch);
                        onPitchChange?.(mapPitchDisplayToPitchKey(nextDisplay));
                        return;
                      }
                      if (isLive) return;
                      setScopePreset((prev) =>
                        prev === "standard"
                          ? "larger"
                          : prev === "larger"
                            ? "complex"
                            : "standard"
                      );
                    }}
                    className={
                      "group flex w-full items-center gap-5 py-4 text-left transition-all duration-200 ease-out hover:bg-gradient-to-r hover:from-white/[0.025] hover:via-white/[0.015] hover:to-transparent hover:pl-1 active:scale-[0.997]" +
                      (isTileLocked ? " cursor-not-allowed opacity-55" : "")
                    }
                  >
                    <span className="w-6 shrink-0 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25 tabular-nums transition group-hover:text-cyan-300/70">
                      {rowNumber}
                    </span>
                    <tile.Icon
                      aria-hidden
                      strokeWidth={1.65}
                      className="h-4 w-4 shrink-0 text-white/48 drop-shadow-[0_0_8px_rgba(34,211,238,0.35)] transition group-hover:text-cyan-200/95 group-hover:drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]"
                    />
                    <span className="w-32 shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/63 transition group-hover:text-white/78 sm:w-40">
                      {tile.title}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[1.48rem] font-semibold tracking-tight text-white [text-shadow:0_1px_0_rgba(0,0,0,0.25)] sm:text-[1.62rem]">
                      {tile.id === "material" ? getMaterialCoverageLabel(effectiveScopeMaterial) : tile.value}
                      {tile.id === "material" ? (
                        <span className="ml-2 text-[11px] font-medium tabular-nums tracking-tight text-white/45 transition group-hover:text-white/60">
                          {effectiveScopeMaterial}
                        </span>
                      ) : null}
                    </span>
                    <span
                      data-scope-adjust
                      className={
                        "shrink-0 text-[11px] font-semibold uppercase tracking-[0.16em] transition " +
                        (tileInteractive
                          ? "text-white/45 group-hover:text-cyan-200 group-hover:[text-shadow:0_0_12px_rgba(34,211,238,0.45)]"
                          : "text-white/30")
                      }
                    >
                      Change
                      <span aria-hidden className="ml-1 inline-block transition group-hover:translate-x-0.5">→</span>
                    </span>
                  </button>
                );
              })}
                </div>
              </div>
              {/* Stage B — Inputs */}
              <div className="relative mt-8">
                <div className="mb-3 flex items-center gap-2">
                  <span
                    aria-hidden
                    className="flex h-5 w-5 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/[0.10] text-[9px] font-bold tabular-nums text-emerald-100/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  >
                    B
                  </span>
                  <p className="text-[9.5px] font-semibold uppercase tracking-[0.2em] text-white/55">
                    Inputs
                  </p>
                  <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-white/[0.10] to-transparent" />
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <span aria-hidden className="h-1 w-1 rounded-full bg-emerald-400/80 shadow-[0_0_5px_rgba(16,185,129,0.6)]" />
                    Live
                  </span>
                </div>
                <div className={"grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-" + (tearOffIsIncluded ? "3" : "2")}>
                  <label className="group flex flex-col">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50 transition group-focus-within:text-cyan-200/90">
                      Bundle cost
                    </span>
                    <span className="mt-1.5 flex items-baseline gap-1.5 border-b border-white/[0.12] pb-2 transition-all duration-200 focus-within:border-cyan-400/65 focus-within:shadow-[0_1px_0_rgba(34,211,238,0.40)]">
                      <span className="text-base font-medium text-white/60">$</span>
                      <input
                        id="v2-pricing-bundle"
                        type="number"
                        inputMode="decimal"
                        disabled={!canEditBundleCost}
                        value={bundleCostValue ?? ""}
                        onChange={(e) => onBundleCostChange?.(e.target.value)}
                        className="min-w-0 flex-1 bg-transparent text-[1.2rem] font-semibold tabular-nums tracking-tight text-white placeholder:text-white/25 focus:outline-none disabled:cursor-not-allowed disabled:opacity-45"
                      />
                    </span>
                  </label>
                  <label className="group flex flex-col">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50 transition group-focus-within:text-cyan-200/90">
                      Labor cost
                    </span>
                    <span className="mt-1.5 flex items-baseline gap-1.5 border-b border-white/[0.12] pb-2 transition-all duration-200 focus-within:border-cyan-400/65 focus-within:shadow-[0_1px_0_rgba(34,211,238,0.40)]">
                      <span className="text-base font-medium text-white/60">$</span>
                      <input
                        id="v2-pricing-labor-cost"
                        type="text"
                        inputMode="numeric"
                        disabled={!canEditManualLaborTotal || !laborModeIsManual}
                        value={manualLaborTotalValue ?? ""}
                        onChange={(e) => onManualLaborTotalChange?.(e.target.value)}
                        onBlur={() => onManualLaborTotalBlur?.()}
                        className="min-w-0 flex-1 bg-transparent text-[1.2rem] font-semibold tabular-nums tracking-tight text-white placeholder:text-white/25 focus:outline-none disabled:cursor-not-allowed disabled:opacity-45"
                      />
                    </span>
                    <span className="mt-1.5 text-[10px] leading-snug text-white/48">
                      Real labor total for this job.
                    </span>
                  </label>
                  {tearOffIsIncluded ? (
                    <label className="group flex flex-col">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50 transition group-focus-within:text-cyan-200/90">
                        Disposal rate
                      </span>
                      <span className="mt-1.5 flex items-baseline gap-1.5 border-b border-white/[0.12] pb-2 transition-all duration-200 focus-within:border-cyan-400/65 focus-within:shadow-[0_1px_0_rgba(34,211,238,0.40)]">
                        <span className="text-base font-medium text-white/60">$</span>
                        <input
                          id="v2-pricing-dump"
                          type="text"
                          inputMode="decimal"
                          disabled={!canEditDumpFee}
                          value={dumpFeePerTonValue ?? ""}
                          onChange={(e) => onDumpFeePerTonChange?.(e.target.value)}
                          className="min-w-0 flex-1 bg-transparent text-[1.2rem] font-semibold tabular-nums tracking-tight text-white placeholder:text-white/25 focus:outline-none disabled:cursor-not-allowed disabled:opacity-45"
                        />
                        <span className="text-[10px] uppercase tracking-[0.14em] text-white/40">/ ton</span>
                      </span>
                      <span className="mt-1.5 text-[10px] leading-snug text-white/48">
                        Used when tear-off is included.
                      </span>
                    </label>
                  ) : null}
                </div>
              </div>
              {/* Closing hand-off strip */}
              <div className="relative mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
                  <span aria-hidden className="h-1 w-1 rounded-full bg-cyan-300 shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
                  Scope &amp; costs locked
                </span>
                <span className="text-[10.5px] leading-snug text-white/45">
                  Outcome is recomputing live from these values.
                </span>
              </div>
            </div>
          </section>


          {/* Step 05 — Offer Strategy */}
          <section id="v2-step-05" className="relative order-3 lg:order-none">
            <div className="relative overflow-hidden rounded-[22px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,24,34,0.86)_0%,rgba(10,16,24,0.93)_100%)] p-5 shadow-[0_26px_64px_-28px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-6 lg:min-h-[20rem] lg:p-7">
              <span
                aria-hidden
                className="pointer-events-none absolute -top-20 right-[-15%] h-44 w-44 rounded-full bg-cyan-400/[0.08] blur-[80px]"
              />

              {/* HEADER */}
              <div className="relative flex items-center justify-between gap-3 pl-3">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_2px_rgba(34,211,238,0.55)]"
                  />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-200/85">
                    Step 05 — Offer Strategy
                  </p>
                </div>
                {offerAvailable && offerRegime != null && (
                  <span
                    className={
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] " +
                      (offerRegime === "low"
                        ? "border border-red-400/30 bg-red-500/[0.10] text-red-100/90"
                        : offerRegime === "balanced"
                          ? "border border-amber-400/25 bg-amber-500/[0.08] text-amber-100/90"
                          : "border border-emerald-400/25 bg-emerald-500/[0.08] text-emerald-100/90")
                    }
                  >
                    <span
                      aria-hidden
                      className="h-1 w-1 rounded-full"
                      style={{ backgroundColor: "currentColor" }}
                    />
                    {offerRegime === "low"
                      ? "Low margin"
                      : offerRegime === "balanced"
                        ? "Balanced"
                        : "High margin"}
                  </span>
                )}
              </div>
              <p className="relative mt-1 pl-3 text-[11px] leading-snug text-white/58">
                Three adaptive paths derived from your current estimate.
              </p>

              <div className="relative pl-3">
              {/* APPLIED CHIP / STALE BANNER */}
              {appliedOffer && !appliedOfferStale && (
                <div className="relative mt-3 flex items-center justify-between gap-3 rounded-lg border border-emerald-400/25 bg-emerald-500/[0.07] px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200/85">
                      Strategy active
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-emerald-50/85">
                      {appliedOffer.key === "value"
                        ? "Value"
                        : appliedOffer.key === "premium"
                          ? "Premium"
                          : "Standard"}
                      {" · "}
                      {appliedOffer.mode === "tier-positioning"
                        ? "Premium positioning"
                        : `Target margin ${pct(appliedOffer.targetMarginPct)}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={clearAppliedOffer}
                    className="shrink-0 rounded-md border border-white/[0.10] bg-white/[0.02] px-2 py-1 text-[10.5px] font-semibold text-white/70 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400/40"
                  >
                    Clear
                  </button>
                </div>
              )}
              {appliedOffer && appliedOfferStale && (
                <div className="relative mt-3 flex items-center justify-between gap-3 rounded-lg border border-amber-400/25 bg-amber-500/[0.08] px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-100/85">
                      Strategy outdated
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-amber-50/85">
                      Job cost changed since apply.
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={reapplyOffer}
                      className="rounded-md border border-amber-400/30 bg-amber-500/[0.14] px-2 py-1 text-[10.5px] font-semibold text-amber-50 hover:bg-amber-500/[0.20] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400/50"
                    >
                      Reapply
                    </button>
                    <button
                      type="button"
                      onClick={clearAppliedOffer}
                      className="rounded-md border border-white/[0.10] bg-white/[0.02] px-2 py-1 text-[10.5px] font-semibold text-white/70 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400/40"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

              {/* CONTENT */}
              {!offerAvailable || offerCards == null ? (
                <div className="relative mt-5 rounded-lg border border-dashed border-white/[0.10] bg-white/[0.02] px-3 py-5 text-center">
                  <p className="text-[11.5px] font-medium text-white/65">
                    Add job cost to generate offer strategies
                  </p>
                  <p className="mt-1 text-[10.5px] leading-snug text-white/48">
                    Strategies appear when live margin is available.
                  </p>
                </div>
              ) : (
                <div className="relative mt-4 space-y-2.5">
                  {offerCards.map((card) => {
                    const isSelected = selectedOfferKey === card.key;
                    const isApplied =
                      appliedOffer != null && appliedOffer.key === card.key;
                    const isAnchor = card.key === "standard";
                    const isValueSlot = card.key === "value";
                    const isPremiumSlot = card.key === "premium";
                    const interactive = !isAnchor;
                    const deltaPositive = card.delta > 0;
                    const deltaNegative = card.delta < 0;
                    const marginTone =
                      card.marginPct >= 30
                        ? "text-emerald-200/90"
                        : card.marginPct < 20
                          ? "text-red-200/90"
                          : "text-white/85";

                    const containerClass =
                      "group relative overflow-hidden rounded-xl border px-3 py-3 transition-colors " +
                      (isSelected
                        ? "border-cyan-400/45 bg-cyan-500/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_0_1px_rgba(34,211,238,0.18)]"
                        : isApplied
                          ? "border-emerald-400/30 bg-emerald-500/[0.05]"
                          : isAnchor
                            ? "border-white/[0.10] bg-white/[0.035]"
                            : isValueSlot
                              ? "border-white/[0.06] bg-white/[0.018] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] hover:border-white/[0.11] hover:bg-white/[0.03]"
                              : isPremiumSlot
                                ? "border-cyan-400/28 bg-cyan-500/[0.045] shadow-[0_0_26px_-12px_rgba(34,211,238,0.32),inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-cyan-400/36 hover:bg-cyan-500/[0.055]"
                                : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.04]");

                    return (
                      <div key={card.key} className={containerClass}>
                        <button
                          type="button"
                          disabled={!interactive}
                          onClick={() => {
                            if (!interactive) return;
                            setSelectedOfferKey((k) =>
                              k === card.key ? null : card.key
                            );
                          }}
                          aria-expanded={isSelected}
                          aria-disabled={!interactive}
                          className="relative block w-full text-left outline-none disabled:cursor-default"
                        >
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={
                                    "text-[9.5px] font-semibold uppercase tracking-[0.18em] " +
                                    (isAnchor
                                      ? "text-white/55"
                                      : card.key === "value"
                                        ? "text-cyan-200/72"
                                        : "text-emerald-200/88")
                                  }
                                >
                                  {card.tag}
                                </span>
                                <span
                                  aria-hidden
                                  className="h-0.5 w-0.5 rounded-full bg-white/30"
                                />
                                <span className="truncate text-[10.5px] font-medium text-white/80">
                                  {card.positioning}
                                </span>
                                {isApplied && (
                                  <span className="ml-0.5 inline-flex items-center gap-0.5 rounded-full border border-emerald-400/30 bg-emerald-500/[0.12] px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-[0.14em] text-emerald-100/90">
                                    ✓ Applied
                                  </span>
                                )}
                                {isAnchor && !isApplied && (
                                  <span className="ml-0.5 inline-flex items-center rounded-full border border-white/[0.10] bg-white/[0.03] px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-[0.14em] text-white/55">
                                    Anchor
                                  </span>
                                )}
                              </div>
                              <p className="mt-1.5 truncate text-[10.5px] leading-snug text-white/[0.72]">
                                {card.tagline}
                              </p>
                            </div>
                            <div className="shrink-0 space-y-0.5 text-right">
                              <div className="text-[1.08rem] font-bold leading-none tabular-nums tracking-tight text-white">
                                {money(card.price)}
                              </div>
                              <div
                                className={
                                  "text-[10px] font-medium tabular-nums leading-none " +
                                  marginTone
                                }
                              >
                                {pct(card.marginPct)}
                              </div>
                              <div
                                className={
                                  "text-[10px] font-medium tabular-nums leading-none " +
                                  (isAnchor
                                    ? "text-white/40"
                                    : deltaPositive
                                      ? "text-emerald-200/90"
                                      : deltaNegative
                                        ? "text-red-200/90"
                                        : "text-white/45")
                                }
                              >
                                {isAnchor
                                  ? "current"
                                  : card.delta === 0
                                    ? card.mode === "tier-positioning"
                                      ? "tier only"
                                      : "no change"
                                    : (deltaPositive ? "+" : "−") +
                                      money(Math.abs(card.delta)) +
                                      " · " +
                                      (deltaPositive ? "+" : "−") +
                                      Math.abs(card.deltaPct).toFixed(1) +
                                      "%"}
                              </div>
                            </div>
                          </div>
                        </button>

                        {/* PREVIEW PANEL (inline, only for selected non-anchor card) */}
                        {isSelected && !isAnchor && (
                          <div className="relative mt-2.5 rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5">
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10.5px] tabular-nums">
                              {card.mode === "tier-positioning" ? (
                                <>
                                  <span className="text-white/55">Price</span>
                                  <span className="text-right font-medium text-white/85">
                                    {money(displayFinalPrice)} → {money(displayFinalPrice)}
                                  </span>
                                  <span className="text-white/55">Tier</span>
                                  <span className="text-right font-medium text-white/85">
                                    {effectiveProposalTier === "core"
                                      ? "Standard"
                                      : effectiveProposalTier === "enhanced"
                                        ? "Enhanced"
                                        : "Premium"}
                                    {" → Premium"}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="text-white/55">Target margin</span>
                                  <span className="text-right font-medium text-white/85">
                                    {currentMarginPctForOffer != null
                                      ? pct(currentMarginPctForOffer)
                                      : "—"}
                                    {" → "}
                                    {pct(card.marginPct)}
                                  </span>
                                  <span className="text-white/55">Price</span>
                                  <span className="text-right font-medium text-white/85">
                                    {money(displayFinalPrice)} → {money(card.price)}
                                  </span>
                                </>
                              )}
                            </div>
                            <p className="mt-2 text-[10px] leading-snug text-white/[0.58]">
                              Job inputs stay unchanged — bundle cost, roof size,
                              pitch, tear-off, labor, disposal.
                            </p>
                            <div className="mt-2.5 flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedOfferKey(null)}
                                className="rounded-md border border-white/[0.10] bg-white/[0.02] px-2 py-1 text-[10.5px] font-semibold text-white/70 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400/40"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={!card.canApply}
                                onClick={() => commitOfferCard(card)}
                                className="rounded-md border border-cyan-400/35 bg-gradient-to-b from-cyan-500/[0.20] to-cyan-600/[0.10] px-2.5 py-1 text-[10.5px] font-semibold text-cyan-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.10)] hover:from-cyan-500/[0.28] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400/50 disabled:pointer-events-none disabled:opacity-40"
                              >
                                Apply strategy
                              </button>
                            </div>
                            {!card.canApply && (
                              <p className="mt-1.5 text-right text-[10px] text-white/48">
                                {effectivePricingMode !== "markup" &&
                                card.mode === "margin"
                                  ? "Switch to markup pricing to apply."
                                  : card.mode === "tier-positioning"
                                    ? "Tier handler unavailable."
                                    : card.delta === 0
                                      ? "No change vs current."
                                      : "Apply unavailable in current mode."}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* FOOTER NOTES */}
              {offerAvailable && effectivePricingMode !== "markup" && (
                <p className="relative mt-3 text-[10px] leading-snug text-white/48">
                  Direct pricing · preview only. Switch to markup to apply.
                </p>
              )}
              {offerAvailable && auditWarnCount > 0 && (
                <p className="relative mt-2 text-[10.5px] leading-snug text-amber-200/65">
                  {auditWarnCount === 1
                    ? "1 input needs review"
                    : `${auditWarnCount} inputs need review`}
                  {" — strategies may shift once resolved."}
                </p>
              )}
              </div>
            </div>
          </section>

            </div>
            <div className="contents lg:col-span-5 lg:flex lg:flex-col lg:items-stretch lg:gap-y-14">
          {/* Section E — Live Outcome (unified product surface) */}
          <section className="relative order-2 lg:order-none overflow-hidden rounded-[28px] border border-cyan-400/25 bg-[radial-gradient(ellipse_120%_80%_at_50%_-10%,rgba(34,211,238,0.22),transparent_60%),linear-gradient(180deg,rgba(15,24,36,0.92)_0%,rgba(9,15,24,0.96)_100%)] p-7 shadow-[0_40px_90px_-30px_rgba(34,211,238,0.35),0_2px_0_rgba(255,255,255,0.05)_inset,0_0_0_1px_rgba(34,211,238,0.08)_inset] sm:p-8 lg:sticky lg:top-6">
            <span
              aria-hidden
              className="pointer-events-none absolute -top-28 -right-24 h-72 w-72 rounded-full bg-cyan-400/[0.18] blur-[110px]"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute -bottom-32 -left-20 h-64 w-64 rounded-full bg-teal-500/[0.10] blur-[120px]"
            />
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_14px_3px_rgba(34,211,238,0.7)]" aria-hidden />
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-200/90">
                  Step 04 — Outcome
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/35 bg-gradient-to-b from-cyan-500/[0.22] to-cyan-600/[0.10] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-50 shadow-[0_0_20px_-4px_rgba(34,211,238,0.55),inset_0_1px_0_rgba(255,255,255,0.12)]">
                Homeowner-ready
              </span>
            </div>
            <div className="relative mt-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
                {outcomeCustomerName}
              </p>
              <p className="mt-0.5 text-[11.5px] text-white/60">{outcomeJobLine}</p>
            </div>
            {/* HERO PRICE */}
            <div className="relative mt-6 flex items-end justify-between gap-4">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">
                Final price
                <span className="ml-2 rounded-full border border-white/[0.12] bg-white/[0.05] px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.18em] text-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  {effectivePricingMode === "markup" ? "Markup" : "Direct"}
                </span>
              </span>
              <div className="relative flex flex-col items-end">
                {priceDelta != null && (
                  <span
                    aria-hidden
                    className={
                      "pointer-events-none absolute -top-4 right-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums leading-none shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-opacity duration-500 " +
                      (priceDelta > 0
                        ? "border border-emerald-400/30 bg-emerald-500/[0.14] text-emerald-200"
                        : "border border-red-400/25 bg-red-500/[0.10] text-red-200")
                    }
                  >
                    {priceDelta > 0 ? "+" : "−"}
                    {money(Math.abs(priceDelta))}
                  </span>
                )}
                <span
                  className={
                    "bg-gradient-to-b from-white to-white/82 bg-clip-text text-[3.55rem] font-bold leading-none tabular-nums tracking-[-0.02em] text-transparent transition-all duration-300 ease-out sm:text-[4rem] " +
                    (priceDelta != null
                      ? "scale-[1.012] drop-shadow-[0_2px_18px_rgba(34,211,238,0.55)]"
                      : "drop-shadow-[0_2px_12px_rgba(34,211,238,0.28)]")
                  }
                >
                  {money(displayFinalPrice)}
                </span>
              </div>
            </div>
            <p className="relative mt-2 text-right text-[11px] font-medium tabular-nums leading-snug text-white/55">
              {money(displayJobCost)} cost + {money(displayProfit)} profit
            </p>
            {pricePerSquare != null && (
              <p className="relative mt-0.5 text-right text-[10.5px] font-medium tabular-nums leading-snug text-white/40">
                {money(pricePerSquare)} / square
              </p>
            )}
            <p className="relative mt-1 text-right text-[10.5px] leading-snug text-white/40">
              {outcomeScopeSummary}
            </p>
            {/* METRIC STRIP — typographic, not boxes */}
            <div className="relative mt-6 grid grid-cols-3 divide-x divide-white/[0.08] border-y border-white/[0.08] py-4">
              <button
                type="button"
                onClick={() => setCostExpanded((v) => !v)}
                aria-expanded={costExpanded}
                className="group rounded-sm px-4 text-left outline-none first:pl-0 focus-visible:ring-1 focus-visible:ring-cyan-400/40"
              >
                <div className="flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-white/45 transition group-hover:text-white/70">
                  Your cost
                  <span
                    aria-hidden
                    className={
                      "ml-0.5 inline-block text-[8px] leading-none transition-transform " +
                      (costExpanded
                        ? "rotate-180 text-cyan-300/70"
                        : "text-white/35 group-hover:text-cyan-300/70")
                    }
                  >
                    ▾
                  </span>
                </div>
                <div className="mt-1 text-[1.05rem] font-bold tabular-nums tracking-tight text-white">
                  {money(displayJobCost)}
                </div>
              </button>
              <div className="px-4">
                <div
                  className={
                    "text-[9.5px] font-semibold uppercase tracking-[0.16em] " +
                    (profitQuality === "premium"
                      ? "text-cyan-200/85"
                      : profitQuality === "strong"
                        ? "text-emerald-300/85"
                        : profitQuality === "tight"
                          ? "text-red-300/85"
                          : "text-white/45")
                  }
                >
                  Your profit
                </div>
                <div
                  className={
                    "mt-1 text-[1.05rem] font-bold tabular-nums tracking-tight " +
                    (profitQuality === "premium"
                      ? "text-cyan-100 [text-shadow:0_0_14px_rgba(34,211,238,0.3)]"
                      : profitQuality === "strong"
                        ? "text-emerald-200 [text-shadow:0_0_14px_rgba(16,185,129,0.3)]"
                        : profitQuality === "tight"
                          ? "text-red-200"
                          : "text-white")
                  }
                >
                  {money(displayProfit)}
                </div>
              </div>
              <div className="px-4 last:pr-0">
                <div className="flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-white/45">
                  Margin
                  {marginsDiverge && (
                    <span
                      aria-hidden
                      title="Target and actual differ"
                      className="h-1 w-1 rounded-full bg-white/30 shadow-[0_0_4px_rgba(255,255,255,0.25)]"
                    />
                  )}
                </div>
                {effectivePricingMode === "markup" ? (
                  <div className="mt-1 flex items-baseline gap-2">
                    <div className="flex flex-col leading-none">
                      <span className="text-[8.5px] font-semibold uppercase tracking-[0.14em] text-white/35">Target</span>
                      <span className="mt-0.5 text-[0.95rem] font-bold tabular-nums tracking-tight text-white/85">
                        {pct(targetMarginPct)}
                      </span>
                    </div>
                    <span aria-hidden className="h-5 w-px bg-white/[0.10]" />
                    <div className="flex flex-col leading-none">
                      <span className="text-[8.5px] font-semibold uppercase tracking-[0.14em] text-white/35">Actual</span>
                      <span className="mt-0.5 text-[0.95rem] font-bold tabular-nums tracking-tight text-white">
                        {liveMarginPct != null ? pct(liveMarginPct) : hasLive ? "—" : pct(mockMarginPct)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 text-[1.05rem] font-bold tabular-nums tracking-tight text-white">
                    {displayMarginRatio != null ? pct(displayMarginRatio * 100) : hasLive ? "—" : pct(mockMarginPct)}
                  </div>
                )}
              </div>
            </div>
            {costExpanded && (
              <div className="relative mt-3 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-[11px] tabular-nums leading-snug">
                {canShowCostBreakdown ? (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <span className="text-white/55">Labor</span>
                    <span className="text-right font-medium text-white/85">{money(laborCostNum)}</span>
                    <span className="text-white/55">Materials &amp; other</span>
                    <span className="text-right font-medium text-white/85">{money(remainderCostNum)}</span>
                    <span className="border-t border-white/[0.06] pt-1 text-white/45">Total cost</span>
                    <span className="border-t border-white/[0.06] pt-1 text-right font-semibold text-white">
                      {money(displayJobCost)}
                    </span>
                  </div>
                ) : (
                  <span className="text-[10.5px] text-white/45">
                    Enter labor cost in Step 03 to see a detailed breakdown.
                  </span>
                )}
              </div>
            )}
            {profitQuality !== "unknown" && (
              <div
                className={
                  "relative mt-4 flex items-center gap-2 text-[11.5px] font-medium leading-snug " +
                  (profitQuality === "premium"
                    ? "text-cyan-300"
                    : profitQuality === "strong"
                      ? "text-emerald-300"
                      : profitQuality === "tight"
                        ? "text-red-300"
                        : "text-amber-200")
                }
              >
                <span
                  className="h-1.5 w-1.5 rounded-full shadow-[0_0_8px_currentColor]"
                  style={{ backgroundColor: "currentColor" }}
                  aria-hidden
                />
                {profitQuality === "tight"
                  ? "Tight margin for this scope"
                  : profitQuality === "balanced"
                    ? "Balanced margin for this job"
                    : profitQuality === "strong"
                      ? "Strong margin position"
                      : "Premium pricing posture"}
              </div>
            )}
            {/* PROPOSAL ROW — inline, not another card */}
            <div className="relative mt-6 border-t border-white/[0.08] pt-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/75">
                  Homeowner proposal
                </span>
                <span className="shrink-0 text-[14px] font-semibold tracking-tight text-white">{proposalTierLabel}</span>
              </div>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-white/45">
                {hasLive
                  ? `PDF-aligned · ${money(viewModel!.proposal.price)}  ·  M ${money(viewModel!.proposal.materials)}  ·  L ${money(viewModel!.proposal.labor)}  ·  D ${money(viewModel!.proposal.disposal)}`
                  : "Customer-facing presentation paired with contractor-facing economics."}
              </p>
            </div>
          </section>

          {/* Section F — Next Actions */}
          <section
            id="v2-step-06"
            className="relative order-4 lg:order-none overflow-hidden rounded-[28px] border border-cyan-400/25 bg-[radial-gradient(ellipse_120%_80%_at_50%_-10%,rgba(34,211,238,0.16),transparent_60%),linear-gradient(180deg,rgba(15,24,36,0.92)_0%,rgba(9,15,24,0.96)_100%)] p-7 shadow-[0_34px_82px_-30px_rgba(34,211,238,0.28),0_2px_0_rgba(255,255,255,0.05)_inset,0_0_0_1px_rgba(34,211,238,0.06)_inset] sm:p-8"
          >
            {/* Ambient accent echoing Outcome's vignette */}
            <span
              aria-hidden
              className="pointer-events-none absolute -top-24 right-[-20%] h-52 w-52 rounded-full bg-cyan-400/[0.07] blur-[88px]"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute -bottom-28 -left-20 h-56 w-56 rounded-full bg-teal-500/[0.08] blur-[110px]"
            />
            {/* Header row — kicker left, status pill right; title block below */}
            <div className="relative">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-200/85">
                  Step 06 — Delivery
                </p>
                <div className="shrink-0 sm:pt-0.5">
                  <div
                    role="status"
                    className={
                      (canUseSendEstimate
                        ? "inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-gradient-to-b from-emerald-500/[0.18] to-emerald-600/[0.08] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-50 shadow-[0_0_14px_-2px_rgba(16,185,129,0.4),inset_0_1px_0_rgba(255,255,255,0.10)] "
                        : canUseSaveEstimate || typeof onPreviewProposal === "function"
                          ? "inline-flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-500/[0.10] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-100/95 "
                          : "inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55 ")
                    }
                  >
                    {canUseSendEstimate ? "Ready to send" : canUseSaveEstimate || typeof onPreviewProposal === "function" ? "Ready for review" : "Needs completion"}
                  </div>
                </div>
              </div>

              <div className="mt-2">
                <h2 className="text-[1.2rem] font-semibold tracking-tight text-white">
                  Deliver the proposal
                </h2>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-white/55">
                  Outcome is aligned — move from review to proposal delivery.
                </p>
              </div>

              <p className="mt-2 text-[10px] leading-snug text-white/45">
                {canUseSendEstimate
                  ? "Proposal can be delivered using the current workflow"
                  : canUseSaveEstimate || typeof onPreviewProposal === "function"
                    ? "Preview and save are available before delivery"
                    : "Complete the estimate to unlock delivery actions"}
              </p>
            </div>
            {/* Action lane */}
            <div className="relative mt-4 space-y-3">
              {/* 01 — Send (hero) */}
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-400/45 bg-gradient-to-b from-emerald-500/[0.22] to-emerald-600/[0.10] text-[10px] font-bold tabular-nums text-emerald-50 shadow-[0_0_12px_-2px_rgba(16,185,129,0.55),inset_0_1px_0_rgba(255,255,255,0.14)]"
                >
                  01
                </span>
                <button
                  type="button"
                  disabled={!canUseSendEstimate}
                  onClick={() => {
                    if (canUseSendEstimate) onSendEstimate?.();
                  }}
                  className="group relative flex-1 overflow-hidden rounded-2xl border border-emerald-400/38 bg-gradient-to-b from-emerald-500/[0.22] via-emerald-500/[0.13] to-emerald-600/[0.09] px-5 py-3.5 text-left shadow-[0_11px_30px_-10px_rgba(16,185,129,0.38),inset_0_1px_0_rgba(255,255,255,0.11)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-emerald-400/50 hover:from-emerald-500/[0.28] hover:shadow-[0_16px_38px_-10px_rgba(16,185,129,0.48),inset_0_1px_0_rgba(255,255,255,0.13)] active:translate-y-0 active:scale-[0.995] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-200/45 to-transparent"
                  />
                  <div className="flex items-center justify-between gap-3">
                    <span className="block text-[15px] font-semibold tracking-tight text-white drop-shadow-[0_1px_0_rgba(0,0,0,0.3)]">
                      {isSendingEstimate ? "Sending..." : "Send estimate"}
                    </span>
                    <span
                      aria-hidden
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-400/15 text-sm font-semibold text-white/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:bg-emerald-400/25"
                    >
                      →
                    </span>
                  </div>
                  <span className="mt-1 block text-[11.5px] leading-snug text-white/65 group-hover:text-white/80">
                    Deliver the real proposal using the existing V1 delivery flow.
                  </span>
                </button>
              </div>
              {/* 02 + 03 — secondary tier paired */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-500/[0.10] text-[10px] font-bold tabular-nums text-cyan-100/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                  >
                    02
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (onPreviewProposal) onPreviewProposal();
                    }}
                    className="group relative flex-1 rounded-2xl border border-white/[0.07] bg-gradient-to-b from-cyan-500/[0.09] to-cyan-600/[0.03] px-4 py-3 text-left shadow-[0_6px_20px_-8px_rgba(34,211,238,0.28),inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-cyan-400/28 hover:from-cyan-500/[0.13] hover:shadow-[0_10px_26px_-8px_rgba(34,211,238,0.38),inset_0_1px_0_rgba(255,255,255,0.06)] active:translate-y-0"
                  >
                    <span className="block text-[13px] font-semibold tracking-tight text-white/85 group-hover:text-white">
                      Preview proposal
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-white/50 group-hover:text-white/65">
                      Review the homeowner view.
                    </span>
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.04] text-[10px] font-bold tabular-nums text-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                  >
                    03
                  </span>
                  <button
                    type="button"
                    disabled={!canUseSaveEstimate}
                    onClick={() => {
                      if (canUseSaveEstimate) onSaveEstimate?.();
                    }}
                    className="group relative flex-1 rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.045] to-white/[0.02] px-4 py-3 text-left shadow-[0_4px_14px_-8px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-white/[0.10] hover:from-white/[0.065] hover:to-white/[0.03] hover:shadow-[0_8px_20px_-10px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span className="block text-[13px] font-semibold tracking-tight text-white/75 group-hover:text-white/92">
                      {isSavingEstimate ? "Saving..." : "Save estimate"}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-white/48 group-hover:text-white/62">
                      Snapshot current inputs.
                    </span>
                  </button>
                </div>
              </div>
            </div>
            {/* Closing trust strip */}
            <div className="relative mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
                <span
                  aria-hidden
                  className="h-1 w-1 rounded-full bg-emerald-400/75 shadow-[0_0_6px_rgba(16,185,129,0.55)]"
                />
                Secure delivery
              </span>
              <span className="text-[10.5px] leading-snug text-white/40">
                Sent through your workflow · logged to company history
              </span>
            </div>
          </section>
            </div>
          </div>
        </div>

        {/* BOTTOM FOOTER STRIP */}
        <footer className="mt-8 flex flex-col gap-2.5 rounded-[22px] border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-white/[0.01] px-5 py-4 text-xs text-white/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:mt-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="inline-flex items-center gap-1.5 leading-relaxed">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-400/80 shadow-[0_0_6px_rgba(16,185,129,0.55)]" />
            Auto-saved draft · Live workflow surface
          </span>
          <span className="shrink-0 rounded-full border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-white/65 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:text-right">
            Ready to send proposal
          </span>
        </footer>
      </div>
    </Root>
  );

  return shell;
}
