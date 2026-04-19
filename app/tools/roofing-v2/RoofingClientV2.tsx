"use client";

import { useEffect, useRef, useState } from "react";
import { Ruler, Mountain, Trash2, Layers } from "lucide-react";

export type RoofingClientV2Props = {
  companyId?: string;
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

  const profitQuality =
    displayMarginRatio == null
      ? "unknown"
      : displayMarginRatio < 0.2
        ? "low"
        : displayMarginRatio < 0.3
          ? "healthy"
          : "strong";

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
        <div className="grid grid-cols-1 gap-y-8 lg:grid-cols-12 lg:gap-x-8 lg:gap-y-10">
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

          {/* Section B — Scope & Costs (unified configurator) */}
          <section id="v2-step-03" className="relative lg:col-span-7">
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
                          "flex w-full items-baseline gap-4 rounded-lg text-left outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-400/30 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent" +
                          (disabled ? " cursor-not-allowed opacity-55" : "")
                        }
                      >
                        <span className="w-6 shrink-0 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25 tabular-nums transition group-hover:text-cyan-300/70">
                          {rowNumber}
                        </span>
                        <tile.Icon
                          aria-hidden
                          strokeWidth={1.6}
                          className="h-3.5 w-3.5 shrink-0 text-white/35 transition group-hover:text-cyan-300/80"
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
                      "group flex w-full items-baseline gap-4 py-4 text-left transition-all duration-200 ease-out hover:bg-gradient-to-r hover:from-white/[0.025] hover:via-white/[0.015] hover:to-transparent hover:pl-1 active:scale-[0.997]" +
                      (isTileLocked ? " cursor-not-allowed opacity-55" : "")
                    }
                  >
                    <span className="w-6 shrink-0 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25 tabular-nums transition group-hover:text-cyan-300/70">
                      {rowNumber}
                    </span>
                    <tile.Icon
                      aria-hidden
                      strokeWidth={1.6}
                      className="h-3.5 w-3.5 shrink-0 text-white/35 transition group-hover:text-cyan-300/80"
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

          {/* Section E — Live Outcome (unified product surface) */}
          <section className="relative overflow-hidden rounded-[28px] border border-cyan-400/25 bg-[radial-gradient(ellipse_120%_80%_at_50%_-10%,rgba(34,211,238,0.22),transparent_60%),linear-gradient(180deg,rgba(15,24,36,0.92)_0%,rgba(9,15,24,0.96)_100%)] p-7 shadow-[0_40px_90px_-30px_rgba(34,211,238,0.35),0_2px_0_rgba(255,255,255,0.05)_inset,0_0_0_1px_rgba(34,211,238,0.08)_inset] sm:p-8 lg:col-span-5 lg:sticky lg:top-6 lg:self-start">
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
                    (profitQuality === "strong" ? "text-emerald-300/85" : profitQuality === "low" ? "text-red-300/85" : "text-white/45")
                  }
                >
                  Your profit
                </div>
                <div
                  className={
                    "mt-1 text-[1.05rem] font-bold tabular-nums tracking-tight " +
                    (profitQuality === "strong"
                      ? "text-emerald-200 [text-shadow:0_0_14px_rgba(16,185,129,0.3)]"
                      : profitQuality === "low"
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
            {(profitQuality === "low" || profitQuality === "healthy" || profitQuality === "strong") && (
              <div
                className={
                  "relative mt-4 flex items-center gap-2 text-[11.5px] font-medium leading-snug " +
                  (profitQuality === "strong"
                    ? "text-emerald-300"
                    : profitQuality === "low"
                      ? "text-red-300"
                      : "text-amber-200")
                }
              >
                <span
                  className="h-1.5 w-1.5 rounded-full shadow-[0_0_8px_currentColor]"
                  style={{ backgroundColor: "currentColor" }}
                  aria-hidden
                />
                {profitQuality === "low"
                  ? "Low margin — consider increasing price"
                  : profitQuality === "healthy"
                    ? "Healthy margin — competitive pricing"
                    : "Strong margin — high profitability"}
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

          {/* Step 05 — Pre-send audit */}
          <section id="v2-step-05" className="relative lg:col-span-7">
            <div className="relative overflow-hidden rounded-[18px] border border-white/[0.04] bg-white/[0.018] px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:px-6">
              <div className="flex items-center gap-3 border-b border-white/[0.05] pb-3">
                <div className="flex items-center gap-2">
                  <span aria-hidden className="h-1 w-1 rounded-full bg-cyan-300 shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-200/85">
                    Step 05 — Pre-send audit
                  </p>
                </div>
                <span aria-hidden className="h-3.5 w-px bg-white/[0.10]" />
                <span className="text-[10.5px] text-white/45">
                  {auditWarnCount === 0
                    ? "All checks passed"
                    : `${auditWarnCount} item${auditWarnCount === 1 ? "" : "s"} need attention`}
                </span>
              </div>
              <ul className="mt-3 grid gap-1 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-1">
                {auditRows.map((row) => {
                  const isClickable = typeof row.onClick === "function";
                  const baseClasses =
                    "group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11.5px] leading-snug transition";
                  const interactiveClasses = isClickable
                    ? " cursor-pointer hover:bg-white/[0.035] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400/30"
                    : "";
                  const labelClasses =
                    "min-w-0 truncate " +
                    (row.status === "warn"
                      ? "text-amber-100/85"
                      : row.status === "ok"
                        ? "text-white/65"
                        : "text-white/45");
                  const dotClasses =
                    "inline-flex h-3 w-3 shrink-0 items-center justify-center rounded-full text-[8px] font-bold leading-none " +
                    (row.status === "ok"
                      ? "bg-emerald-500/[0.18] text-emerald-200"
                      : row.status === "warn"
                        ? "bg-amber-500/[0.20] text-amber-200"
                        : "bg-white/[0.08] text-white/55");
                  const dotGlyph = row.status === "ok" ? "✓" : row.status === "warn" ? "!" : "·";

                  return (
                    <li key={row.key} className="min-w-0">
                      {isClickable ? (
                        <button
                          type="button"
                          onClick={row.onClick}
                          className={baseClasses + interactiveClasses}
                        >
                          <span aria-hidden className={dotClasses}>
                            {dotGlyph}
                          </span>
                          <span className={labelClasses}>{row.label}</span>
                          <span
                            aria-hidden
                            className="ml-auto shrink-0 text-[10px] text-white/25 transition group-hover:text-cyan-200/70"
                          >
                            →
                          </span>
                        </button>
                      ) : (
                        <div className={baseClasses}>
                          <span aria-hidden className={dotClasses}>
                            {dotGlyph}
                          </span>
                          <span className={labelClasses}>{row.label}</span>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>

          {/* Section F — Next Actions */}
          <section className="relative lg:col-span-5">
            {/* Premium action rail */}
            <div className="relative overflow-hidden rounded-[24px] border border-white/[0.08] bg-[radial-gradient(ellipse_100%_65%_at_50%_-10%,rgba(34,211,238,0.10),transparent_65%),linear-gradient(180deg,rgba(16,24,34,0.86)_0%,rgba(10,16,24,0.93)_100%)] p-5 shadow-[0_30px_70px_-30px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-6">
              {/* Ambient accent echoing Outcome's vignette */}
              <span
                aria-hidden
                className="pointer-events-none absolute -top-24 right-[-20%] h-56 w-56 rounded-full bg-cyan-400/[0.10] blur-[90px]"
              />
              {/* Vertical cyan rail track */}
              <span
                aria-hidden
                className="pointer-events-none absolute left-0 top-10 bottom-10 w-px bg-gradient-to-b from-cyan-400/55 via-cyan-400/14 to-transparent"
              />
              {/* Header row */}
              <div className="relative flex flex-wrap items-start justify-between gap-3 pl-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-200/85">
                    Step 06 — Delivery
                  </p>
                  <h2 className="mt-1 text-[1.2rem] font-semibold tracking-tight text-white">
                    Deliver the proposal
                  </h2>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-white/55">
                    Outcome is aligned — move from review to proposal delivery.
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-right">
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
                  <span className="text-[10px] leading-snug text-white/45">
                    {canUseSendEstimate
                      ? "Proposal can be delivered using the current workflow"
                      : canUseSaveEstimate || typeof onPreviewProposal === "function"
                        ? "Preview and save are available before delivery"
                        : "Complete the estimate to unlock delivery actions"}
                  </span>
                </div>
              </div>
              {/* Action lane */}
              <div className="relative mt-5 space-y-3">
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
                    className="group relative flex-1 overflow-hidden rounded-2xl border border-emerald-400/40 bg-gradient-to-b from-emerald-500/[0.25] via-emerald-500/[0.15] to-emerald-600/[0.10] px-5 py-4 text-left shadow-[0_14px_36px_-10px_rgba(16,185,129,0.45),inset_0_1px_0_rgba(255,255,255,0.12)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-emerald-400/55 hover:from-emerald-500/[0.32] hover:shadow-[0_20px_44px_-10px_rgba(16,185,129,0.55),inset_0_1px_0_rgba(255,255,255,0.14)] active:translate-y-0 active:scale-[0.995] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
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
              {/* Closing trust strip inside the rail */}
              <div className="relative mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3 pl-3">
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
            </div>
          </section>
        </div>

        {/* BOTTOM FOOTER STRIP */}
        <footer className="mt-4 flex flex-col gap-2.5 rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-white/[0.01] px-5 py-4 text-xs text-white/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:mt-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
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
