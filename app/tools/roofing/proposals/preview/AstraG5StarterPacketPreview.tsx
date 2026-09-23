"use client";

import { useMemo, useState } from "react";
import {
  ASTRA_G5_TEMPLATE_PREVIEW_HINT,
  ASTRA_G5_TEMPLATE_PREVIEW_TITLE,
} from "@/app/lib/astraG5Activation";
import {
  buildAstraG5StarterPacketPreviewModel,
  type AstraG5StarterCompanyBrandingInput,
  type AstraG5StarterPacketPreviewModel,
} from "@/app/lib/astraG5StarterPacketPreview";
import ProposalCustomerPreviewEstimateTable from "@/app/tools/roofing/proposals/preview/ProposalCustomerPreviewEstimateTable";
import ProposalCustomerPreviewPackageStrip from "@/app/tools/roofing/proposals/preview/ProposalCustomerPreviewPackageStrip";
import ProposalCustomerPreviewPacket from "@/app/tools/roofing/proposals/preview/ProposalCustomerPreviewPacket";
import ProposalCustomerPreviewPacketCover from "@/app/tools/roofing/proposals/preview/ProposalCustomerPreviewPacketCover";
import ProposalCustomerPreviewPacketSection from "@/app/tools/roofing/proposals/preview/ProposalCustomerPreviewPacketSection";

export type AstraG5StarterPacketPreviewProps = {
  branding?: AstraG5StarterCompanyBrandingInput | null;
  /**
   * `document` — full starter proposal language (usual-roof).
   * `compact` — Prepare first-use: cover + package, expand for full document.
   */
  density?: "document" | "compact";
  className?: string;
};

function OtherPackagesLine({
  model,
}: {
  model: AstraG5StarterPacketPreviewModel;
}) {
  const others = model.packageOptions.filter(
    (option) => option.label !== model.selectedPackageLabel
  );
  if (others.length === 0) return null;
  return (
    <p
      className="mt-3 text-[13px] leading-relaxed text-slate-500"
      data-astra-g5-starter-other-packages
    >
      Also available:{" "}
      {others.map((option, index) => (
        <span key={option.label}>
          {index > 0 ? " · " : null}
          <span className="font-medium text-slate-700">{option.label}</span>
        </span>
      ))}
    </p>
  );
}

function StarterPacketDocument({
  model,
}: {
  model: AstraG5StarterPacketPreviewModel;
}) {
  return (
    <ProposalCustomerPreviewPacket>
      <div data-astra-g5-starter-packet-document>
        <ProposalCustomerPreviewPacketCover
          viewModel={model.cover}
          accentColor={model.accentColor}
          selectedPackageLabel={model.selectedPackageLabel}
        />
        <ProposalCustomerPreviewPackageStrip
          packageHero={model.packageHero}
          totals={model.totals}
          accentColor={model.accentColor}
        />
        <OtherPackagesLine model={model} />
        <ProposalCustomerPreviewEstimateTable
          sections={model.estimateSections}
          totals={model.totals}
        />
        {model.detailSections.map((section) => (
          <ProposalCustomerPreviewPacketSection
            key={section.title}
            title={section.title}
            body={section.body}
          />
        ))}
      </div>
    </ProposalCustomerPreviewPacket>
  );
}

/**
 * Customer-facing starter proposal preview using Customer Preview leaf components.
 * Not a second renderer — same packet visual language as real Customer Preview.
 */
export default function AstraG5StarterPacketPreview({
  branding = null,
  density = "document",
  className = "",
}: AstraG5StarterPacketPreviewProps) {
  const model = useMemo(
    () => buildAstraG5StarterPacketPreviewModel(branding),
    [branding]
  );
  const [expanded, setExpanded] = useState(density === "document");

  if (!model) return null;

  const showFull = density === "document" || expanded;

  return (
    <section
      className={className}
      data-astra-g5-starter-packet-preview
      data-astra-g5-starter-density={density}
      data-astra-g5-starter-expanded={showFull ? "true" : "false"}
      aria-labelledby="astra-g5-starter-preview-heading"
    >
      <div className="mb-3">
        <h2
          id="astra-g5-starter-preview-heading"
          className="text-sm font-semibold text-slate-900"
        >
          {ASTRA_G5_TEMPLATE_PREVIEW_TITLE}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          {ASTRA_G5_TEMPLATE_PREVIEW_HINT}
        </p>
      </div>

      <div
        className="overflow-hidden bg-white text-slate-900"
        data-astra-g5-starter-packet-surface
      >
        {showFull ? (
          <div className="px-1 sm:px-2">
            <StarterPacketDocument model={model} />
          </div>
        ) : (
          <div className="px-1 sm:px-2" data-astra-g5-starter-compact-body>
            <ProposalCustomerPreviewPacketCover
              viewModel={model.cover}
              accentColor={model.accentColor}
              selectedPackageLabel={model.selectedPackageLabel}
            />
            <ProposalCustomerPreviewPackageStrip
              packageHero={{
                label: model.packageHero.label,
                description: model.packageHero.description,
                bullets: model.packageHero.bullets.slice(0, 4),
              }}
              totals={model.totals}
              accentColor={model.accentColor}
            />
            <OtherPackagesLine model={model} />
          </div>
        )}
      </div>

      {density === "compact" ? (
        <div className="mt-3">
          <button
            type="button"
            className="inline-flex min-h-[44px] items-center justify-center rounded-md px-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
            data-astra-g5-starter-preview-toggle
            aria-expanded={showFull}
            onClick={() => setExpanded((value) => !value)}
          >
            {showFull ? "Show less" : "Open full starter proposal preview"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
