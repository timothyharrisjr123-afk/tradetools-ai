"use client";

import { useState } from "react";

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
      ? "mt-3.5 rounded-[20px] border border-white/[0.20] bg-gradient-to-b from-black/50 via-black/40 to-black/35 p-1 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.68),0_0_40px_-12px_rgba(34,211,238,0.12),0_0_0_1px_rgba(255,255,255,0.10),0_10px_40px_rgba(0,255,200,0.07)]"
      : "mt-3.5 rounded-[20px] border border-white/[0.14] bg-gradient-to-b from-black/50 via-black/40 to-black/35 p-1 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.65),0_0_40px_-12px_rgba(34,211,238,0.12),0_0_0_1px_rgba(0,255,200,0.08),0_10px_40px_rgba(0,255,200,0.06)]";

  const outcomeHeaderBandClass =
    effectivePricingMode === "direct"
      ? "rounded-[14px] border border-white/[0.14] bg-gradient-to-r from-white/[0.11] via-white/[0.065] to-white/[0.05] px-3.5 py-2 sm:px-4"
      : "rounded-[14px] border border-white/[0.10] bg-gradient-to-r from-white/[0.08] via-white/[0.05] to-cyan-500/[0.06] px-3.5 py-2 sm:px-4";

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
    "w-full rounded-xl border border-white/[0.10] bg-black/20 px-3 py-2.5 text-sm text-white/95 placeholder:text-white/28 focus:border-cyan-400/35 focus:outline-none focus:ring-1 focus:ring-cyan-500/25";

  const pricingFieldInputClass =
    "w-full rounded-lg border border-white/[0.10] bg-black/20 px-2.5 py-2 text-sm text-white/95 placeholder:text-white/28 focus:border-cyan-400/35 focus:outline-none focus:ring-1 focus:ring-cyan-500/25";

  const mainStyle = isEmbedded
    ? { backgroundColor: "#101820" as const }
    : {
        backgroundImage: `
          linear-gradient(180deg, #1a2332 0%, #141c28 40%, #101820 100%),
          radial-gradient(ellipse 80% 50% at 70% 0%, rgba(59, 130, 246, 0.08), transparent 55%),
          radial-gradient(ellipse 60% 40% at 10% 80%, rgba(34, 211, 238, 0.06), transparent 50%)
        `,
        backgroundColor: "#101820",
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
        <header className="mb-4 rounded-[28px] border border-white/[0.10] bg-white/[0.04] px-6 py-5 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:px-8 sm:py-5 sm:mb-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200/70">
                Roofing V2 Workflow
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Build the deal
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/55">
                A contractor-first workflow surface connected to the live estimator engine.
              </p>
              {/* Segmented preview rail */}
              <div
                className="mt-3.5 flex flex-wrap gap-1.5 border-t border-white/[0.07] pt-3.5"
                role="list"
                aria-label="Build flow preview"
              >
                {["Intake", "Scope", "Outcome", "Delivery"].map((label) => (
                  <span
                    key={label}
                    role="listitem"
                    className="inline-flex items-center rounded-lg border border-white/[0.07] bg-white/[0.04] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-white/48"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end sm:gap-2">
              <span className="rounded-full border border-amber-400/25 bg-amber-500/[0.12] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-100/90">
                {hasLive ? "Live V1 data" : "Preview Only"}
              </span>
              <span className="rounded-full border border-white/[0.10] bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-white/70">
                Company • {companyPreview}
              </span>
            </div>
          </div>
        </header>

        {/* MAIN LAYOUT — paired rows: intake/deal, scope/live, readiness/next */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
          {/* Section A — Job intake */}
          <section className="rounded-[26px] border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6 lg:col-span-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-semibold tracking-tight text-white">Job intake</h2>
                <p className="mt-1 max-w-md text-xs leading-relaxed text-white/45">
                  Start with the customer and property information needed before pricing.
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                <div
                  role="status"
                  className={
                    "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide " +
                    (intakeReady
                      ? "border-emerald-400/28 bg-emerald-500/[0.12] text-emerald-100/95"
                      : "border-amber-400/30 bg-amber-500/[0.12] text-amber-100/90")
                  }
                >
                  {intakeReady ? "Ready to price" : "Missing details"}
                </div>
                <span className="text-[10px] leading-snug text-white/45">
                  {intakeReady ? "All required details present" : "Complete intake to unlock full pricing"}
                </span>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-2 lg:gap-8">
              {intakeEditable ? (
                <>
                  <div className="min-w-0">
                    <h3 className="text-[9px] font-medium uppercase tracking-[0.18em] text-white/28">Customer</h3>
                    <div className="mt-2.5 flex flex-col gap-2.5">
                      <div className="space-y-1">
                        <label htmlFor="v2-intake-customer-name" className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
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
                        <label htmlFor="v2-intake-customer-email" className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
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
                        <label htmlFor="v2-intake-customer-phone" className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
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
                  <div className="min-w-0">
                    <h3 className="text-[9px] font-medium uppercase tracking-[0.18em] text-white/28">Property</h3>
                    <div className="mt-2.5 flex flex-col gap-2.5">
                      <div className="space-y-1">
                        <label htmlFor="v2-intake-job-address" className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
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
                          <label htmlFor="v2-intake-job-city" className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
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
                          <label htmlFor="v2-intake-job-state" className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
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
                          <label htmlFor="v2-intake-job-zip" className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
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
                    <h3 className="text-[9px] font-medium uppercase tracking-[0.18em] text-white/28">Customer details</h3>
                    <div className="mt-2.5 flex flex-col gap-2">
                      {customerFields.map((field) => (
                        <div
                          key={field.label}
                          className="rounded-xl border border-white/[0.09] bg-white/[0.04] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                        >
                          <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/40">{field.label}</div>
                          <div className="mt-1 truncate text-sm font-semibold tracking-tight text-white">{field.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[9px] font-medium uppercase tracking-[0.18em] text-white/28">Job details</h3>
                    <div className="mt-2.5 flex flex-col gap-2">
                      {jobFields.map((field) => (
                        <div
                          key={field.label}
                          className="rounded-xl border border-white/[0.09] bg-white/[0.04] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                        >
                          <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/40">{field.label}</div>
                          <div className="mt-1 truncate text-sm font-semibold tracking-tight text-white">{field.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            <p className="mt-3 text-[10px] leading-snug text-white/38">
              {intakeReady
                ? "All core intake fields are present for pricing."
                : "If key fields are missing, pricing confidence will be limited."}
            </p>
          </section>

          {/* Section D — Deal Control */}
          <section className="rounded-[26px] border border-white/[0.09] bg-white/[0.035] p-4 sm:p-5 lg:col-span-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">
              Control surface
            </p>
            <h2 className="mt-1 text-base font-semibold tracking-tight text-white">Deal control</h2>
            <p className="mt-1 text-xs leading-relaxed text-white/48">
              The future home for pricing mode, margin posture, and final proposal control.
            </p>
            <div className="mt-3.5 rounded-[18px] border border-white/[0.10] bg-gradient-to-b from-white/[0.08] to-white/[0.04] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="flex flex-col divide-y divide-white/[0.07] rounded-[14px] border border-white/[0.06] bg-black/20">
                <div className="flex items-start justify-between gap-3 px-3.5 py-2.5 first:rounded-t-[12px]">
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/38">Pricing mode</div>
                    <div className="flex gap-2 mt-1">
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
                            ? "rounded-full border border-cyan-400/35 bg-cyan-500/[0.18] px-2.5 py-0.5 text-[10px] font-semibold text-cyan-50"
                            : "rounded-full border border-white/[0.10] bg-white/[0.05] px-2.5 py-0.5 text-[10px] font-semibold text-white/55") +
                          (!controlPermissions.pricingMode && isLive ? " cursor-not-allowed opacity-45" : "") +
                          (!isLive || controlPermissions.pricingMode ? " active:scale-[0.97]" : "")
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
                            ? "rounded-full border border-cyan-400/35 bg-cyan-500/[0.18] px-2.5 py-0.5 text-[10px] font-semibold text-cyan-50"
                            : "rounded-full border border-white/[0.10] bg-white/[0.05] px-2.5 py-0.5 text-[10px] font-semibold text-white/55") +
                          (!controlPermissions.pricingMode && isLive ? " cursor-not-allowed opacity-45" : "") +
                          (!isLive || controlPermissions.pricingMode ? " active:scale-[0.97]" : "")
                        }
                      >
                        Direct
                      </button>
                    </div>
                    <p className="mt-1 max-w-[14rem] text-[9px] leading-snug text-white/40">
                      {effectivePricingMode === "markup"
                        ? "Final price adjusts based on target margin"
                        : "Final price follows direct homeowner quote"}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/42">
                    Tuned
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3 px-3.5 py-2.5">
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/38">Manual labor total</div>
                    <div className="mt-0.5 text-[15px] font-semibold leading-snug tracking-tight text-white">
                      {hasLive ? money(viewModel!.proposal.labor) : money(mockDealLaborAmount)}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/42">
                    Tuned
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3 px-3.5 py-2.5 last:rounded-b-[12px]">
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/38">Proposal tier</div>
                    <div className="flex gap-2 mt-1">
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
                            ? "rounded-full border border-cyan-400/35 bg-cyan-500/[0.18] px-2.5 py-0.5 text-[10px] font-semibold text-cyan-50"
                            : "rounded-full border border-white/[0.10] bg-white/[0.05] px-2.5 py-0.5 text-[10px] font-semibold text-white/55") +
                          (!controlPermissions.proposalTier && isLive ? " cursor-not-allowed opacity-45" : "") +
                          (!isLive || controlPermissions.proposalTier ? " active:scale-[0.97]" : "")
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
                            ? "rounded-full border border-cyan-400/35 bg-cyan-500/[0.18] px-2.5 py-0.5 text-[10px] font-semibold text-cyan-50"
                            : "rounded-full border border-white/[0.10] bg-white/[0.05] px-2.5 py-0.5 text-[10px] font-semibold text-white/55") +
                          (!controlPermissions.proposalTier && isLive ? " cursor-not-allowed opacity-45" : "") +
                          (!isLive || controlPermissions.proposalTier ? " active:scale-[0.97]" : "")
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
                            ? "rounded-full border border-cyan-400/35 bg-cyan-500/[0.18] px-2.5 py-0.5 text-[10px] font-semibold text-cyan-50"
                            : "rounded-full border border-white/[0.10] bg-white/[0.05] px-2.5 py-0.5 text-[10px] font-semibold text-white/55") +
                          (!controlPermissions.proposalTier && isLive ? " cursor-not-allowed opacity-45" : "") +
                          (!isLive || controlPermissions.proposalTier ? " active:scale-[0.97]" : "")
                        }
                      >
                        Premium
                      </button>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/42">
                    Tuned
                  </span>
                </div>
              </div>
            </div>
            <p className="mt-2 text-[10px] leading-snug text-white/42">
              Pricing mode and proposal controls are live here in the embedded workflow.
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.07] bg-white/[0.04] px-3 py-2 text-xs">
              <span className="font-medium text-white/50">Current posture</span>
              <span className="text-right font-semibold text-white/80">
                {effectivePricingMode === "markup" ? "Markup-driven / homeowner-friendly" : "Direct price / homeowner-friendly"}
              </span>
            </div>
            <p className="mt-2 text-[10px] text-white/35">
              {effectivePricingMode === "markup"
                ? "Adjusting margin will shift final price and profit"
                : "Direct mode locks price — profit adjusts from cost"}
            </p>
          </section>

          {/* Section B — Scope Builder */}
          <section className="rounded-[28px] border border-white/[0.09] bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-6 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.4)] sm:p-7 lg:col-span-7">
            <div className="mb-6">
              <h2 className="text-lg font-semibold tracking-tight text-white">Scope builder</h2>
              <p className="mt-1 text-xs text-white/48">Decisions first, inputs second.</p>
              <p className="mt-1 text-[10px] text-white/38">
                Core scope decisions are live here in the embedded workflow.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4">
              {(
                [
                  {
                    id: "roofSize" as const,
                    title: "Roof size",
                    value: effectiveScopeRoofSize,
                    helper: "Measured footprint",
                    isTileLive: controlPermissions.scopeRoofSize,
                  },
                  {
                    id: "pitch" as const,
                    title: "Roof difficulty",
                    value: effectiveScopePitch,
                    helper: "Affects labor posture",
                    isTileLive: controlPermissions.scopePitch,
                  },
                  {
                    id: "tearOff" as const,
                    title: "Tear-off",
                    value: effectiveScopeTearOff,
                    helper: "Removal and disposal ready",
                    isTileLive: controlPermissions.scopeTearOff,
                  },
                  {
                    id: "material" as const,
                    title: "Material coverage",
                    value: effectiveScopeMaterial,
                    helper: "Primary install package",
                    isTileLive: controlPermissions.scopeMaterial,
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

                if (tile.id === "roofSize" && tile.isTileLive) {
                  const roofLiveOuterClass =
                    "group flex flex-col rounded-2xl border border-white/[0.10] bg-white/[0.04] p-5 text-left transition duration-200" +
                    (disabled
                      ? " cursor-not-allowed opacity-60"
                      : " hover:-translate-y-0.5 hover:border-white/[0.20] hover:bg-white/[0.09] hover:shadow-[0_16px_40px_-14px_rgba(0,0,0,0.45)] active:scale-[0.97]");
                  return (
                    <div key={tile.id} className={roofLiveOuterClass}>
                      <button
                        type="button"
                        disabled={disabled}
                        aria-expanded={activeScopeEditor === "roofSize"}
                        onClick={() =>
                          setActiveScopeEditor((prev) => (prev === "roofSize" ? null : "roofSize"))
                        }
                        className={
                          "flex w-full flex-col rounded-lg text-left outline-none transition focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent" +
                          (disabled ? " cursor-not-allowed" : "")
                        }
                      >
                        <span
                          className={
                            "text-[9px] font-semibold uppercase tracking-[0.18em] text-white/35" +
                            (tileInteractive ? " group-hover:text-white/45" : "")
                          }
                        >
                          Decision
                        </span>
                        <span
                          className={
                            "mt-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-white/45" +
                            (tileInteractive ? " group-hover:text-white/55" : "")
                          }
                        >
                          {tile.title}
                        </span>
                        <span className="mt-2.5 text-xl font-bold tracking-tight text-white sm:text-[1.3rem]">
                          {tile.value}
                        </span>
                        <span className="mt-1 text-[11px] tabular-nums text-white/45">
                          {getCurrentRoofAreaSqFtForStepper().toLocaleString()} sq ft
                        </span>
                      </button>
                      {activeScopeEditor === "roofSize" && roofSizeCanAdjust ? (
                        <div className="mt-3 rounded-xl border border-white/[0.10] bg-white/[0.05] px-2 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              aria-label="Decrease roof size by 100 sq ft"
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.06] text-sm font-semibold text-white/80 transition hover:border-white/[0.18] hover:bg-white/[0.10] active:scale-95"
                              onClick={handleRoofSizeDecrease}
                            >
                              −
                            </button>
                            <span className="min-w-0 flex-1 text-center text-[13px] font-semibold tabular-nums tracking-tight text-white/90">
                              {getCurrentRoofAreaSqFtForStepper().toLocaleString()} sq ft
                            </span>
                            <button
                              type="button"
                              aria-label="Increase roof size by 100 sq ft"
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.06] text-sm font-semibold text-white/80 transition hover:border-white/[0.18] hover:bg-white/[0.10] active:scale-95"
                              onClick={handleRoofSizeIncrease}
                            >
                              +
                            </button>
                          </div>
                          <p className="mt-1.5 text-center text-[9px] font-medium uppercase tracking-[0.14em] text-white/38">
                            Fine adjust
                          </p>
                        </div>
                      ) : null}
                      <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-3">
                        <span className="text-left text-[11px] leading-snug text-white/42">{tile.helper}</span>
                        <span
                          className={
                            "shrink-0 rounded-full border border-white/[0.10] bg-white/[0.06] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/55" +
                            (tileInteractive
                              ? " group-hover:border-white/[0.14] group-hover:bg-white/[0.10] group-hover:text-white/70"
                              : "")
                          }
                        >
                          {activeScopeEditor === "roofSize" ? "Tap to close" : "Fine adjust"}
                        </span>
                      </div>
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
                      "group flex flex-col rounded-2xl border border-white/[0.10] bg-white/[0.04] p-5 text-left transition duration-200" +
                      (tile.isTileLive
                        ? " hover:-translate-y-0.5 hover:border-white/[0.20] hover:bg-white/[0.09] hover:shadow-[0_16px_40px_-14px_rgba(0,0,0,0.45)] active:scale-[0.97]"
                        : isTileLocked
                          ? " cursor-not-allowed opacity-60"
                          : " hover:-translate-y-0.5 hover:border-white/[0.20] hover:bg-white/[0.09] hover:shadow-[0_16px_40px_-14px_rgba(0,0,0,0.45)]")
                    }
                  >
                    <span
                      className={
                        "text-[9px] font-semibold uppercase tracking-[0.18em] text-white/35" +
                        (tileInteractive ? " group-hover:text-white/45" : "")
                      }
                    >
                      Decision
                    </span>
                    <span
                      className={
                        "mt-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-white/45" +
                        (tileInteractive ? " group-hover:text-white/55" : "")
                      }
                    >
                      {tile.title}
                    </span>
                    {tile.id === "material" ? (
                      <>
                        <span className="mt-2.5 text-xl font-bold tracking-tight text-white sm:text-[1.3rem]">
                          {getMaterialCoverageLabel(effectiveScopeMaterial)}
                        </span>
                        <span className="mt-1 text-[11px] font-medium tabular-nums tracking-tight text-white/45 sm:text-xs">
                          {effectiveScopeMaterial}
                        </span>
                      </>
                    ) : (
                      <span className="mt-2.5 text-xl font-bold tracking-tight text-white sm:text-[1.3rem]">
                        {tile.value}
                      </span>
                    )}
                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-3">
                      <span className="text-left text-[11px] leading-snug text-white/42">{tile.helper}</span>
                      <span
                        data-scope-adjust
                        className={
                          "shrink-0 rounded-full border border-white/[0.10] bg-white/[0.06] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/55" +
                          (tileInteractive
                            ? " group-hover:border-white/[0.14] group-hover:bg-white/[0.10] group-hover:text-white/70"
                            : "")
                        }
                      >
                        Adjust
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/38">
              Pricing
            </p>
            <div className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4">
              <div className="rounded-2xl border border-white/[0.10] bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <label htmlFor="v2-pricing-bundle" className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
                  Bundle cost
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="shrink-0 text-sm font-medium text-white/50">$</span>
                  <input
                    id="v2-pricing-bundle"
                    type="number"
                    inputMode="decimal"
                    disabled={!canEditBundleCost}
                    value={bundleCostValue ?? ""}
                    onChange={(e) => onBundleCostChange?.(e.target.value)}
                    className={
                      "min-w-0 flex-1 " + pricingFieldInputClass + " disabled:cursor-not-allowed disabled:opacity-45"
                    }
                  />
                </div>
              </div>
              <div className="rounded-2xl border border-white/[0.10] bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <label htmlFor="v2-pricing-labor-cost" className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
                  Labor cost
                </label>
                <input
                  id="v2-pricing-labor-cost"
                  type="text"
                  inputMode="numeric"
                  disabled={!canEditManualLaborTotal || !laborModeIsManual}
                  value={manualLaborTotalValue ?? ""}
                  onChange={(e) => onManualLaborTotalChange?.(e.target.value)}
                  onBlur={() => onManualLaborTotalBlur?.()}
                  className={"mt-1.5 " + pricingFieldInputClass + " disabled:cursor-not-allowed disabled:opacity-45"}
                />
                <p className="mt-1 text-[9px] leading-snug text-white/38">Manual labor input used for the V2 workflow.</p>
              </div>
            </div>
            {tearOffIsIncluded ? (
              <div className="mt-3.5 rounded-2xl border border-white/[0.10] bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <label htmlFor="v2-pricing-dump" className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
                  Disposal rate
                </label>
                <input
                  id="v2-pricing-dump"
                  type="text"
                  inputMode="decimal"
                  disabled={!canEditDumpFee}
                  value={dumpFeePerTonValue ?? ""}
                  onChange={(e) => onDumpFeePerTonChange?.(e.target.value)}
                  className={"mt-1.5 " + pricingFieldInputClass + " disabled:cursor-not-allowed disabled:opacity-45"}
                />
                <p className="mt-1 text-[9px] leading-snug text-white/38">Used only when tear-off is included.</p>
              </div>
            ) : null}
            <p className="mt-5 text-[10px] leading-snug text-white/42">
              These decisions shape labor difficulty, material cost, and how the final price is perceived.
            </p>
          </section>

          {/* Section E — Live Outcome */}
          <section className="rounded-[28px] border border-cyan-400/30 bg-gradient-to-b from-cyan-500/[0.14] via-cyan-500/[0.06] to-black/30 p-4 shadow-[0_24px_60px_-20px_rgba(34,211,238,0.18),0_0_0_1px_rgba(34,211,238,0.08)_inset] ring-1 ring-cyan-400/18 sm:p-4 lg:col-span-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200/75">
              Projected outcome
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-white">Live outcome</h2>
            <p className="mt-1 max-w-md text-xs leading-snug text-white/55">
              {effectivePricingMode === "markup"
                ? "Deterministic pricing preview — economics and presentation in one glance."
                : "Direct price posture preview — homeowner presentation and contractor economics aligned."}
            </p>
            <div className={outcomeCardClass}>
              <div className={outcomeHeaderBandClass}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
                    Presentation target
                  </span>
                  <span className="rounded-full border border-cyan-400/35 bg-cyan-500/[0.18] px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-cyan-50 shadow-[0_0_16px_-4px_rgba(34,211,238,0.3)]">
                    Homeowner-ready
                  </span>
                </div>
              </div>
              <div className="px-3.5 pb-2 pt-2 sm:px-4 sm:pb-2.5 sm:pt-2.5">
                <div className="mb-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
                    Project
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white">{outcomeCustomerName}</div>
                  <div className="text-[11px] text-white/50">{outcomeJobLine}</div>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.1em] text-white/50">
                      Final price
                    </span>
                    <span className="rounded-full border border-white/[0.12] bg-white/[0.05] px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-white/50">
                      {effectivePricingMode === "markup" ? "Markup" : "Direct"}
                    </span>
                  </div>
                  <span className="text-[2.4rem] font-bold tabular-nums tracking-tight text-white transition-all duration-200 ease-out sm:text-[2.6rem]">
                    {money(displayFinalPrice)}
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-white/42 text-center">{outcomeScopeSummary}</p>
                <p className="mt-1 text-left text-[10px] tabular-nums leading-snug text-white/45 sm:text-center">
                  {money(displayFinalPrice)} = {money(displayJobCost)} cost + {money(displayProfit)} profit
                </p>
                <p className="mt-1 text-[10px] text-white/40">
                  {effectivePricingMode === "markup"
                    ? "Driven by margin target and cost structure"
                    : "Driven by direct homeowner price"}
                </p>
                <p className="mt-1 text-[10px] text-white/42">
                  Based on roof complexity, material choice, and installation conditions.
                </p>
                <p className="mt-1 text-[10px] text-white/42">
                  {effectiveProposalTier === "core"
                    ? "Lean presentation designed for speed and clarity."
                    : effectiveProposalTier === "enhanced"
                      ? "Balanced presentation designed to build homeowner confidence."
                      : "Premium presentation designed to strengthen perceived value."}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-1.5 sm:gap-2">
                  {[
                    { label: "Your cost", value: money(displayJobCost) },
                    { label: "Your profit", value: money(displayProfit) },
                    {
                      label: "Margin",
                      value:
                        displayMarginRatio != null
                          ? pct(displayMarginRatio * 100)
                          : hasLive
                            ? "—"
                            : pct(mockMarginPct),
                      hint: "Healthy range for residential roofing",
                    },
                    {
                      label: "Pricing mode",
                      value: effectivePricingMode === "markup" ? "Markup" : "Direct",
                      hint:
                        effectivePricingMode === "markup" ? "Driven by margin target" : "Direct homeowner price posture",
                    },
                  ].map((m) => (
                    <div
                      key={m.label}
                      className={
                        m.label === "Your profit" && profitQuality === "strong"
                          ? "rounded-lg border border-emerald-400/30 bg-emerald-500/[0.06] px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:px-2.5 sm:py-2"
                          : m.label === "Your profit" && profitQuality === "low"
                            ? "rounded-lg border border-red-400/30 bg-red-500/[0.06] px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:px-2.5 sm:py-2"
                            : m.label === "Pricing mode" && effectivePricingMode === "direct"
                              ? "rounded-lg border border-white/[0.14] bg-white/[0.07] px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:px-2.5 sm:py-2"
                              : "rounded-lg border border-white/[0.08] bg-white/[0.05] px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:px-2.5 sm:py-2"
                      }
                    >
                      <div
                        className={
                          "text-[9px] font-semibold uppercase tracking-[0.1em] " +
                          (m.label === "Pricing mode" && effectivePricingMode === "direct"
                            ? "text-white/48"
                            : "text-white/38")
                        }
                      >
                        {m.label}
                      </div>
                      <div
                        className={
                          "mt-0.5 truncate text-sm font-bold tabular-nums tracking-tight " +
                          (m.label === "Pricing mode" && effectivePricingMode === "direct"
                            ? "text-white/95"
                            : "text-white")
                        }
                      >
                        {m.value}
                      </div>
                      {"hint" in m && m.hint ? (
                        <p className="mt-0.5 text-[9px] leading-snug text-white/38">{m.hint}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
                {(profitQuality === "low" || profitQuality === "healthy" || profitQuality === "strong") && (
                  <div
                    className={
                      profitQuality === "strong"
                        ? "mt-3 rounded-md border border-emerald-400/30 bg-emerald-500/[0.06] px-3 py-2"
                        : profitQuality === "low"
                          ? "mt-3 rounded-md border border-red-400/30 bg-red-500/[0.06] px-3 py-2"
                          : "mt-3 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2"
                    }
                  >
                    {profitQuality === "low" && (
                      <div className="text-[10px] text-red-400">Low margin — consider increasing price</div>
                    )}
                    {profitQuality === "healthy" && (
                      <div className="text-[10px] text-amber-300">Healthy margin — competitive pricing</div>
                    )}
                    {profitQuality === "strong" && (
                      <div className="text-[10px] font-semibold text-emerald-300">
                        Strong margin — high profitability
                      </div>
                    )}
                    {profitQuality === "low" && (
                      <p className="mt-1 text-[10px] text-red-300/70">
                        Increase margin or reduce cost before sending
                      </p>
                    )}
                    {profitQuality === "strong" && (
                      <p className="mt-1 text-[10px] font-semibold text-emerald-300/70">
                        Strong deal — safe to present to homeowner
                      </p>
                    )}
                  </div>
                )}
                <div className="my-1.5 border-t border-white/[0.08]" aria-hidden />
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/38">Ready to present</span>
                  <span className="shrink-0 rounded-full border border-white/[0.10] bg-white/[0.04] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/45">
                    Send-confidence preview
                  </span>
                </div>
                <div className={"mt-2 " + proposalOutputClass}>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-100/55">Homeowner proposal</span>
                    <p className="mt-0.5 text-[9px] leading-snug text-white/40">Proposal tier sets how this reads to homeowners.</p>
                  </div>
                  <span className="shrink-0 text-right text-xs font-semibold leading-snug text-white">{proposalTierLabel}</span>
                </div>
                <p className="mt-0.5 text-center text-[10px] leading-snug text-white/42">{proposalTierSupport}</p>
                <p className="mt-0.5 text-center text-[10px] leading-snug text-white/38">
                  Built to match the homeowner-facing proposal experience.
                </p>
                <p className="mt-1 text-center text-[10px] text-white/40">
                  {effectiveProposalTier === "core"
                    ? "Ready for a clean, straightforward proposal presentation."
                    : effectiveProposalTier === "enhanced"
                      ? "Ready for a balanced proposal presentation with stronger confidence."
                      : "Ready for a premium proposal presentation with elevated perceived value."}
                </p>
                <p className="mt-1 text-center text-[10px] text-white/40">
                  Scope and material choices support this proposal presentation.
                </p>
                <p className="mt-1 text-center text-[10px] leading-snug text-white/42">
                  {hasLive
                    ? `PDF-aligned total ${money(viewModel!.proposal.price)} · M ${money(viewModel!.proposal.materials)} · L ${money(viewModel!.proposal.labor)} · D ${money(viewModel!.proposal.disposal)}`
                    : "Customer-facing presentation paired with contractor-facing economics."}
                </p>
              </div>
            </div>
            <p className="mt-2.5 text-center text-[11px] text-white/40">
              Live preview of pricing posture and homeowner-facing proposal output.
            </p>
          </section>

          {/* Production readiness — merged momentum + notes */}
          <section className="rounded-[26px] border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6 lg:col-span-7">
            <h2 className="text-base font-semibold tracking-tight text-white">Production readiness</h2>
            <p className="mt-1 text-xs leading-relaxed text-white/45">
              Progress and site considerations in one compact planning surface.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
              <div className="min-w-0 lg:border-r lg:border-white/[0.06] lg:pr-8">
                <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-white/42">Builder momentum</h3>
                <div className="mt-3 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
                    <span className="text-sm text-white/80">Scope is defined</span>
                    <span className="shrink-0 rounded-full border border-emerald-400/30 bg-emerald-500/[0.14] px-2 py-0.5 text-[10px] font-semibold text-emerald-200/95">
                      Ready
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
                    <span className="text-sm text-white/80">Pricing stance selected</span>
                    <span className="shrink-0 rounded-full border border-amber-400/28 bg-amber-500/[0.12] px-2 py-0.5 text-[10px] font-semibold text-amber-100/90">
                      Waiting
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
                    <span className="text-sm text-white/80">Proposal positioning</span>
                    <span className="shrink-0 rounded-full border border-white/[0.10] bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-white/55">
                      Pending
                    </span>
                  </div>
                </div>
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-white/42">Production notes</h3>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {["Access / dump trailer", "Landscaping protection", "Flashing review", "Ventilation check"].map(
                    (item) => (
                      <div
                        key={item}
                        className="flex min-h-0 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-2.5 py-2"
                      >
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/75 ring-2 ring-emerald-400/20"
                          aria-hidden
                        />
                        <span className="text-xs font-medium leading-snug text-white/85">{item}</span>
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Section F — Next Actions */}
          <section className="rounded-[26px] border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5 lg:col-span-5 lg:self-start">
            <h2 className="text-base font-semibold tracking-tight text-white">Next actions</h2>
            <div className="mt-3 flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (onPreviewProposal) onPreviewProposal();
                }}
                className="group w-full rounded-2xl border border-cyan-400/32 bg-gradient-to-b from-cyan-500/[0.14] to-cyan-600/[0.08] px-4 py-2.5 text-left shadow-[0_6px_22px_-8px_rgba(34,211,238,0.28)] transition duration-200 hover:-translate-y-0.5 hover:border-cyan-400/42 hover:from-cyan-500/[0.18] hover:shadow-[0_10px_28px_-8px_rgba(34,211,238,0.32)]"
              >
                <span className="block text-sm font-semibold tracking-tight text-white">Preview proposal flow</span>
                <span className="mt-0.5 block text-xs leading-snug text-white/58 group-hover:text-white/65">
                  Review exactly what the homeowner will see before delivery.
                </span>
                <span className="mt-1 block text-[11px] text-white/42">Best next step before delivery.</span>
              </button>
              <button
                type="button"
                disabled={!canUseSaveEstimate}
                onClick={() => {
                  if (canUseSaveEstimate) onSaveEstimate?.();
                }}
                className="group w-full rounded-2xl border border-white/[0.10] bg-white/[0.05] px-4 py-2.5 text-left transition duration-200 hover:-translate-y-0.5 hover:border-white/[0.16] hover:bg-white/[0.09] hover:shadow-[0_12px_28px_-10px_rgba(0,0,0,0.35)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45"
              >
                <span className="block text-sm font-semibold text-white/92">
                  {isSavingEstimate ? "Saving..." : "Save estimate"}
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-white/44 group-hover:text-white/52">
                  Create a real estimate snapshot using the current intake, scope, and pricing.
                </span>
                <span className="mt-1 block text-[11px] text-white/42">Best next step after preview.</span>
              </button>
              <button
                type="button"
                disabled={!canUseSendEstimate}
                onClick={() => {
                  if (canUseSendEstimate) onSendEstimate?.();
                }}
                className="group w-full rounded-2xl border border-white/[0.10] bg-white/[0.05] px-4 py-2.5 text-left transition duration-200 hover:-translate-y-0.5 hover:border-white/[0.16] hover:bg-white/[0.09] hover:shadow-[0_12px_28px_-10px_rgba(0,0,0,0.35)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45"
              >
                <span className="block text-sm font-semibold text-white/92">
                  {isSendingEstimate ? "Sending..." : "Send estimate"}
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-white/44 group-hover:text-white/52">
                  Send the real proposal using the existing V1 delivery flow.
                </span>
              </button>
            </div>
          </section>
        </div>

        {/* BOTTOM FOOTER STRIP */}
        <footer className="mt-6 flex flex-col gap-2.5 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-3.5 text-xs text-white/45 sm:mt-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="max-w-prose leading-relaxed">
            Preview, save, and send are live here. Payment actions are not wired yet.
          </span>
          <span className="shrink-0 rounded-full border border-white/[0.10] bg-white/[0.05] px-3 py-1.5 text-[11px] font-medium text-white/55 sm:text-right">
            Live workflow harness
          </span>
        </footer>
      </div>
    </Root>
  );

  return shell;
}
