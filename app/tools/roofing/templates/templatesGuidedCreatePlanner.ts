/**
 * Template Flow V1 — guided + Template create planner (pure).
 *
 * Maps contractor-facing package model choices into a reusable create plan and
 * a DefaultProposalTemplateDefinition for store materialization.
 * No React, Supabase, or store writes.
 */

import {
  DEFAULT_ROOFING_PROPOSAL_TEMPLATE_DEFINITIONS,
  ROOF_REPLACEMENT_CORE_LINE_ITEMS,
} from "@/app/lib/defaultRoofingProposalTemplates";
import type {
  DefaultProposalTemplateDefinition,
  DefaultProposalTemplateOptionDefinition,
  DefaultProposalTemplateSectionDefinition,
  ProposalTemplateSectionKind,
} from "@/app/lib/proposalTemplateTypes";

export type GuidedPackageModelId = "simple" | "single" | "triple";

export type GuidedCreateStepId = "basics" | "package_model" | "structure" | "confirm";

export const GUIDED_CREATE_STEPS: readonly GuidedCreateStepId[] = [
  "basics",
  "package_model",
  "structure",
  "confirm",
] as const;

export const GUIDED_CREATE_STEP_LABELS: Record<GuidedCreateStepId, string> = {
  basics: "Basics",
  package_model: "Package model",
  structure: "Prepared structure",
  confirm: "Create",
};

export const GUIDED_CREATE_OVERLAY_TITLE = "New proposal template";
export const GUIDED_CREATE_OVERLAY_SUBTITLE =
  "Set up a reusable proposal for your company. You’ll adjust included items and wording after it’s created.";
export const GUIDED_CREATE_STARTING_POINT_LABEL = "Starting point";
export const GUIDED_CREATE_STARTING_POINT_VALUE = "Prepared roofing proposal structure";
export const GUIDED_CREATE_STARTING_POINT_HINT =
  "Includes a roof replacement estimate layout with customer-facing pages you can edit later.";
export const GUIDED_CREATE_PRIMARY_ACTION = "Create template";
export const GUIDED_CREATE_CANCEL_ACTION = "Cancel";
export const GUIDED_CREATE_BACK_ACTION = "Back";
export const GUIDED_CREATE_CONTINUE_ACTION = "Continue";

export type GuidedPackageModelChoice = {
  id: GuidedPackageModelId;
  title: string;
  description: string;
  packageLabels: readonly string[];
  /** True when customer-facing UI should treat this as package choices. */
  presentsPackages: boolean;
};

export const GUIDED_PACKAGE_MODEL_CHOICES: readonly GuidedPackageModelChoice[] = [
  {
    id: "simple",
    title: "Simple estimate",
    description: "One prepared estimate — no package choices for the customer.",
    packageLabels: [],
    presentsPackages: false,
  },
  {
    id: "single",
    title: "Single package",
    description: "One named package the customer can review and accept.",
    packageLabels: ["Standard"],
    presentsPackages: true,
  },
  {
    id: "triple",
    title: "Standard / Enhanced / Premium",
    description: "Three prepared packages so customers can compare options.",
    packageLabels: ["Standard", "Enhanced", "Premium"],
    presentsPackages: true,
  },
] as const;

export type GuidedCreateBasicsInput = {
  name: string;
  description?: string | null;
};

export type GuidedCreatePlanInput = GuidedCreateBasicsInput & {
  packageModel: GuidedPackageModelId;
};

export type GuidedStructureContentArea = {
  label: string;
  detail: string;
};

export type GuidedTemplateCreatePlan = {
  name: string;
  description: string | null;
  packageModel: GuidedPackageModelId;
  packageModelTitle: string;
  /** Customer-facing package labels (empty for simple estimate). */
  packageLabels: string[];
  /** True when the contractor chose a package model that presents packages. */
  presentsPackages: boolean;
  contentAreas: GuidedStructureContentArea[];
  structureNotes: string[];
  /** Graph definition for create helper — never show seed/kind internals in UI. */
  definition: DefaultProposalTemplateDefinition;
};

export type GuidedCreateBasicsValidation = {
  ok: boolean;
  name: string;
  description: string | null;
  error: string | null;
};

const CONTENT_AREA_ORDER: readonly {
  kind: ProposalTemplateSectionKind;
  label: string;
  detail: string;
}[] = [
  {
    kind: "text",
    label: "Project overview",
    detail: "Opening page customers see first",
  },
  {
    kind: "line_items",
    label: "Estimate",
    detail: "Catalog-backed roofing scope and pricing lines",
  },
  {
    kind: "upgrade_group",
    label: "Optional upgrades",
    detail: "Optional add-ons when the package includes them",
  },
  {
    kind: "text",
    label: "Scope notes",
    detail: "Clarifies assumptions and what may need confirmation",
  },
  {
    kind: "warranty",
    label: "Warranty",
    detail: "Customer-facing warranty language",
  },
  {
    kind: "terms",
    label: "Terms",
    detail: "Customer-facing terms language",
  },
];

function normalizeName(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function normalizeDescription(value: string | null | undefined): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function validateGuidedCreateBasics(
  input: GuidedCreateBasicsInput
): GuidedCreateBasicsValidation {
  const name = normalizeName(input.name);
  const description = normalizeDescription(input.description);
  if (!name) {
    return {
      ok: false,
      name: "",
      description,
      error: "Enter a template name to continue.",
    };
  }
  if (name.length > 120) {
    return {
      ok: false,
      name,
      description,
      error: "Keep the template name under 120 characters.",
    };
  }
  return { ok: true, name, description, error: null };
}

export function getGuidedPackageModelChoice(
  id: GuidedPackageModelId
): GuidedPackageModelChoice {
  const found = GUIDED_PACKAGE_MODEL_CHOICES.find((row) => row.id === id);
  if (!found) {
    throw new Error(`Unknown guided package model: ${id}`);
  }
  return found;
}

function cloneOption(
  option: DefaultProposalTemplateOptionDefinition
): DefaultProposalTemplateOptionDefinition {
  return {
    ...option,
    sections: (option.sections ?? []).map((section) => ({
      ...section,
      items: section.items ? section.items.map((item) => ({ ...item })) : undefined,
      content: section.content ? { ...section.content } : undefined,
      metadata: section.metadata ? { ...section.metadata } : undefined,
    })),
    metadata: option.metadata ? { ...option.metadata } : undefined,
  };
}

function roofReplacementBaseDefinition(): DefaultProposalTemplateDefinition {
  const base = DEFAULT_ROOFING_PROPOSAL_TEMPLATE_DEFINITIONS[0];
  if (!base) {
    throw new Error("Roofing proposal template defaults are not available.");
  }
  return base;
}

function findNamedOption(
  options: readonly DefaultProposalTemplateOptionDefinition[],
  name: string
): DefaultProposalTemplateOptionDefinition {
  const found = options.find((row) => row.name === name);
  if (!found) {
    throw new Error(`Roofing default package "${name}" is not available.`);
  }
  return cloneOption(found);
}

/**
 * Simple estimate still needs one graph container option (sections require it).
 * That detail stays internal — contractor copy presents “no packages.”
 */
function buildSimpleEstimateOption(
  standard: DefaultProposalTemplateOptionDefinition
): DefaultProposalTemplateOptionDefinition {
  const sections: DefaultProposalTemplateSectionDefinition[] = (standard.sections ?? []).map(
    (section) => {
      if (section.kind === "upgrade_group") {
        return {
          ...section,
          items: undefined,
        };
      }
      if (section.kind === "line_items") {
        return {
          ...section,
          items: ROOF_REPLACEMENT_CORE_LINE_ITEMS.map((item) => ({ ...item })),
        };
      }
      return { ...section };
    }
  );

  return {
    name: "Estimate",
    seed_key: "proposal.guided.simple.estimate",
    customer_label: "Estimate",
    description: "Prepared roofing estimate without customer package choices.",
    selection_mode: "included",
    is_default: true,
    visible_to_customer: true,
    sort_order: 10,
    sections,
  };
}

function buildOptionsForPackageModel(
  packageModel: GuidedPackageModelId
): DefaultProposalTemplateOptionDefinition[] {
  const base = roofReplacementBaseDefinition();
  const sourceOptions = base.options ?? [];

  if (packageModel === "simple") {
    return [buildSimpleEstimateOption(findNamedOption(sourceOptions, "Standard"))];
  }

  if (packageModel === "single") {
    const standard = findNamedOption(sourceOptions, "Standard");
    return [
      {
        ...standard,
        is_default: true,
        selection_mode: "single",
      },
    ];
  }

  return ["Standard", "Enhanced", "Premium"].map((name, index) => {
    const option = findNamedOption(sourceOptions, name);
    return {
      ...option,
      is_default: index === 0,
      selection_mode: "single",
    };
  });
}

function collectContentAreas(
  options: readonly DefaultProposalTemplateOptionDefinition[]
): GuidedStructureContentArea[] {
  const kindsPresent = new Set<ProposalTemplateSectionKind>();
  let hasUpgradeItems = false;
  let hasMultipleText = false;
  let textCount = 0;

  for (const option of options) {
    for (const section of option.sections ?? []) {
      kindsPresent.add(section.kind);
      if (section.kind === "text") textCount += 1;
      if (section.kind === "upgrade_group" && (section.items?.length ?? 0) > 0) {
        hasUpgradeItems = true;
      }
    }
  }
  hasMultipleText = textCount > options.length;

  const areas: GuidedStructureContentArea[] = [];
  const seenLabels = new Set<string>();

  for (const area of CONTENT_AREA_ORDER) {
    if (!kindsPresent.has(area.kind)) continue;
    if (area.kind === "upgrade_group" && !hasUpgradeItems) continue;
    if (area.label === "Scope notes" && !hasMultipleText && area.kind === "text") {
      // Still include scope notes when text sections exist beyond overview naming —
      // defaults always include overview + scope notes, so always show both labels
      // when text kind is present by checking section names below.
    }
    if (seenLabels.has(area.label)) continue;

    // Prefer showing overview + scope notes from default names when present.
    if (area.label === "Project overview" || area.label === "Scope notes") {
      const hasNamed = options.some((option) =>
        (option.sections ?? []).some(
          (section) =>
            section.kind === "text" &&
            (section.name === area.label || section.customer_title === area.label)
        )
      );
      if (!hasNamed) continue;
    }

    seenLabels.add(area.label);
    areas.push({ label: area.label, detail: area.detail });
  }

  return areas;
}

function buildStructureNotes(plan: {
  presentsPackages: boolean;
  packageLabels: readonly string[];
}): string[] {
  const notes = [
    "Catalog items are linked from your company Catalog where available.",
    "You can add, replace, or remove items after the template is created.",
    "Overview, warranty, and terms wording can be edited after creation.",
  ];
  if (!plan.presentsPackages) {
    notes.unshift("Customers see one estimate — not a package comparison.");
  } else if (plan.packageLabels.length === 1) {
    notes.unshift(`Customers see the ${plan.packageLabels[0]} package.`);
  } else if (plan.packageLabels.length > 1) {
    notes.unshift(
      `Customers can compare ${plan.packageLabels.join(", ")}.`
    );
  }
  return notes;
}

/**
 * Build a durable create plan from contractor choices.
 * Throws only for programmer errors (missing roofing defaults).
 */
export function buildGuidedTemplateCreatePlan(
  input: GuidedCreatePlanInput
): GuidedTemplateCreatePlan {
  const basics = validateGuidedCreateBasics(input);
  if (!basics.ok) {
    throw new Error(basics.error ?? "Template basics are incomplete.");
  }

  const choice = getGuidedPackageModelChoice(input.packageModel);
  const options = buildOptionsForPackageModel(input.packageModel);
  const packageLabels = choice.presentsPackages ? [...choice.packageLabels] : [];

  // Template metadata omits company-level seed_key so guided creates never
  // collide with the idempotent starter install unique index.
  const definition: DefaultProposalTemplateDefinition = {
    name: basics.name,
    description:
      basics.description ??
      "Reusable roofing proposal setup created from prepared FieldDive defaults.",
    status: "active",
    sort_order: 20,
    metadata: {
      // Placeholder required by DefaultProposalTemplateDefinition; create helper
      // strips empty seed_key before insert.
      seed_key: "",
      guided_create: true,
      package_model: input.packageModel,
    },
    options,
  };

  return {
    name: basics.name,
    description: basics.description,
    packageModel: input.packageModel,
    packageModelTitle: choice.title,
    packageLabels,
    presentsPackages: choice.presentsPackages,
    contentAreas: collectContentAreas(options),
    structureNotes: buildStructureNotes({
      presentsPackages: choice.presentsPackages,
      packageLabels,
    }),
    definition,
  };
}

/** User-facing package summary line for the prepared-structure step. */
export function formatGuidedPackageSummary(plan: GuidedTemplateCreatePlan): string {
  if (!plan.presentsPackages || plan.packageLabels.length === 0) {
    return "Simple estimate — no package choices";
  }
  if (plan.packageLabels.length === 1) {
    return `Single package: ${plan.packageLabels[0]}`;
  }
  return `Packages: ${plan.packageLabels.join(" · ")}`;
}

export function nextGuidedCreateStep(
  step: GuidedCreateStepId
): GuidedCreateStepId | null {
  const index = GUIDED_CREATE_STEPS.indexOf(step);
  if (index < 0 || index >= GUIDED_CREATE_STEPS.length - 1) return null;
  return GUIDED_CREATE_STEPS[index + 1] ?? null;
}

export function prevGuidedCreateStep(
  step: GuidedCreateStepId
): GuidedCreateStepId | null {
  const index = GUIDED_CREATE_STEPS.indexOf(step);
  if (index <= 0) return null;
  return GUIDED_CREATE_STEPS[index - 1] ?? null;
}

/** Guard: user-facing plan copy must stay contractor-facing. */
export function guidedPlanCopyExposesInternalLanguage(text: string): boolean {
  return /option row|section kind|seed[_ ]key|template item|join|sort_order|catalog_seed/i.test(
    text
  );
}
