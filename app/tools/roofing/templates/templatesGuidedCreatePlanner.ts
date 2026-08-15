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

/**
 * Guided create package models.
 * - Primary create choices: single | double | triple | custom
 * - Legacy `simple` remains supported for existing templates/metadata only
 */
export type GuidedPackageModelId =
  | "simple"
  | "single"
  | "double"
  | "triple"
  | "custom";

export type GuidedCreateStepId = "basics" | "package_setup" | "confirm";

export const GUIDED_CREATE_STEPS: readonly GuidedCreateStepId[] = [
  "basics",
  "package_setup",
  "confirm",
] as const;

export const GUIDED_CREATE_STEP_LABELS: Record<GuidedCreateStepId, string> = {
  basics: "Basics",
  package_setup: "Packages",
  confirm: "Review & create",
};

export const GUIDED_CREATE_OVERLAY_TITLE = "New proposal template";
export const GUIDED_CREATE_OVERLAY_SUBTITLE =
  "Set up a reusable proposal for your company. Choose the package setup first, then name packages the way you sell.";
export const GUIDED_CREATE_STARTING_POINT_LABEL = "Starting point";
export const GUIDED_CREATE_STARTING_POINT_VALUE = "Prepared roofing proposal structure";
export const GUIDED_CREATE_STARTING_POINT_HINT =
  "Includes a roof replacement estimate layout with customer-facing pages you can edit later.";
export const GUIDED_CREATE_PACKAGE_SETUP_HINT =
  "Choose how many packages this setup should use. You can rename them next, then adjust after creation.";
export const GUIDED_CREATE_PRIMARY_ACTION = "Create template";
export const GUIDED_CREATE_CANCEL_ACTION = "Cancel";
export const GUIDED_CREATE_BACK_ACTION = "Back";
export const GUIDED_CREATE_CONTINUE_ACTION = "Continue";
export const GUIDED_CREATE_REVIEW_STRUCTURE_LABEL = "Prepared proposal structure";
export const GUIDED_CREATE_REVIEW_PACKET_LABEL = "Customer packet ready";

/** Contractor-editable package identity during guided create. */
export type GuidedPackageDraft = {
  /** Stable key within the create session (source seed package). */
  key: string;
  /** Internal / display name stored on the option. */
  name: string;
  /** Customer-facing label; empty means use name. */
  customerLabel: string;
  description: string;
  isDefault: boolean;
  /** Source starter package used for structure cloning. */
  sourceName: "Standard" | "Enhanced" | "Premium" | "Estimate";
};

export type GuidedPackageModelChoice = {
  id: GuidedPackageModelId;
  title: string;
  description: string;
  packageLabels: readonly string[];
  /** True when customer-facing UI should treat this as package choices. */
  presentsPackages: boolean;
};

/** Primary + Template package-model choices (create-time). */
export const GUIDED_PACKAGE_MODEL_CHOICES: readonly GuidedPackageModelChoice[] = [
  {
    id: "single",
    title: "One package",
    description:
      "Use one package when you do not need the customer to compare options.",
    packageLabels: ["Standard"],
    presentsPackages: true,
  },
  {
    id: "double",
    title: "Two packages",
    description: "Offer a simple choice between two scopes, like Standard and Premium.",
    packageLabels: ["Standard", "Premium"],
    presentsPackages: true,
  },
  {
    id: "triple",
    title: "Three packages",
    description: "Offer a Good / Better / Best comparison.",
    packageLabels: ["Good", "Better", "Best"],
    presentsPackages: true,
  },
  {
    id: "custom",
    title: "Custom package setup",
    description: "Start with a guided setup and adjust packages after creation.",
    packageLabels: ["Standard"],
    presentsPackages: true,
  },
] as const;

/** Legacy simple-estimate model — still materializes existing templates. */
export const GUIDED_PACKAGE_MODEL_SIMPLE_LEGACY: GuidedPackageModelChoice = {
  id: "simple",
  title: "Simple estimate",
  description: "One prepared estimate — no package choices for the customer.",
  packageLabels: [],
  presentsPackages: false,
};

export type GuidedCreateBasicsInput = {
  name: string;
  description?: string | null;
};

export type GuidedCreatePlanInput = GuidedCreateBasicsInput & {
  packageModel: GuidedPackageModelId;
  /** When omitted, starter package labels/descriptions from defaults are used. */
  packageDrafts?: readonly GuidedPackageDraft[];
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
  /** Editable drafts that were applied (empty for simple). */
  packageDrafts: GuidedPackageDraft[];
  defaultPackageLabel: string | null;
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
    label: "Project notes",
    detail: "Assumptions and how changes are handled",
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
  if (id === "simple") return GUIDED_PACKAGE_MODEL_SIMPLE_LEGACY;
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

  if (packageModel === "single" || packageModel === "custom") {
    const standard = findNamedOption(sourceOptions, "Standard");
    return [
      {
        ...standard,
        is_default: true,
        selection_mode: "single",
      },
    ];
  }

  if (packageModel === "double") {
    return (["Standard", "Premium"] as const).map((name, index) => {
      const option = findNamedOption(sourceOptions, name);
      return {
        ...option,
        is_default: index === 0,
        selection_mode: "single" as const,
      };
    });
  }

  // triple — structure from Standard / Enhanced / Premium
  return (["Standard", "Enhanced", "Premium"] as const).map((name, index) => {
    const option = findNamedOption(sourceOptions, name);
    return {
      ...option,
      is_default: index === 0,
      selection_mode: "single" as const,
    };
  });
}

const TRIPLE_STARTER_LABELS = ["Good", "Better", "Best"] as const;

/** Starter package drafts for the Package setup step (editable before create). */
export function buildDefaultGuidedPackageDrafts(
  packageModel: GuidedPackageModelId
): GuidedPackageDraft[] {
  if (packageModel === "simple") return [];

  const options = buildOptionsForPackageModel(packageModel);
  return options.map((option, index) => {
    const sourceName =
      option.name === "Enhanced" || option.name === "Premium" || option.name === "Standard"
        ? option.name
        : ("Standard" as const);
    const tripleLabel =
      packageModel === "triple" ? TRIPLE_STARTER_LABELS[index] ?? option.name : null;
    const name = tripleLabel ?? option.name;
    return {
      key: option.seed_key ?? `pkg-${index}`,
      name,
      customerLabel: tripleLabel ?? option.customer_label ?? option.name,
      description: option.description ?? "",
      isDefault: option.is_default === true || index === 0,
      sourceName,
    };
  });
}

export function validateGuidedPackageDrafts(
  packageModel: GuidedPackageModelId,
  drafts: readonly GuidedPackageDraft[]
): { ok: true } | { ok: false; error: string } {
  if (packageModel === "simple") return { ok: true };
  if (drafts.length === 0) {
    return { ok: false, error: "Add at least one package name to continue." };
  }
  for (const draft of drafts) {
    if (!normalizeName(draft.name)) {
      return { ok: false, error: "Every package needs a display name." };
    }
    if (draft.name.length > 80) {
      return { ok: false, error: "Keep package names under 80 characters." };
    }
  }
  if (!drafts.some((draft) => draft.isDefault)) {
    return { ok: false, error: "Choose a default package." };
  }
  return { ok: true };
}

function applyGuidedPackageDrafts(
  options: DefaultProposalTemplateOptionDefinition[],
  drafts: readonly GuidedPackageDraft[]
): DefaultProposalTemplateOptionDefinition[] {
  if (drafts.length === 0) return options;
  return options.map((option, index) => {
    const draft = drafts[index];
    if (!draft) return option;
    const name = normalizeName(draft.name) || option.name;
    const customerLabel = normalizeName(draft.customerLabel) || name;
    const description = normalizeDescription(draft.description) ?? option.description ?? null;
    return {
      ...option,
      name,
      customer_label: customerLabel,
      description,
      is_default: draft.isDefault === true,
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
    if (area.label === "Project notes" && !hasMultipleText && area.kind === "text") {
      // Still include scope notes when text sections exist beyond overview naming —
      // defaults always include overview + scope notes, so always show both labels
      // when text kind is present by checking section names below.
    }
    if (seenLabels.has(area.label)) continue;

    // Prefer showing overview + scope notes from default names when present.
    if (area.label === "Project overview" || area.label === "Project notes") {
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
  packageModel: GuidedPackageModelId;
  presentsPackages: boolean;
  packageLabels: readonly string[];
}): string[] {
  const notes = [
    "Catalog items are linked from your company Catalog where available.",
    "You can add, replace, or remove items after the template is created.",
    "Overview, warranty, and terms wording can be edited after creation.",
  ];
  if (plan.packageModel === "custom") {
    notes.unshift(
      "After creation, use Adjust packages to add, remove, reorder, or set the default."
    );
  }
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
  const baseOptions = buildOptionsForPackageModel(input.packageModel);
  const packageDrafts =
    input.packageDrafts != null
      ? [...input.packageDrafts]
      : buildDefaultGuidedPackageDrafts(input.packageModel);

  if (choice.presentsPackages) {
    const draftCheck = validateGuidedPackageDrafts(input.packageModel, packageDrafts);
    if (!draftCheck.ok) {
      throw new Error(draftCheck.error);
    }
  }

  const options = choice.presentsPackages
    ? applyGuidedPackageDrafts(baseOptions, packageDrafts)
    : baseOptions;

  const packageLabels = choice.presentsPackages
    ? options.map((row) => row.customer_label ?? row.name)
    : [];
  const defaultOption = options.find((row) => row.is_default) ?? options[0] ?? null;
  const defaultPackageLabel = choice.presentsPackages
    ? defaultOption
      ? defaultOption.customer_label ?? defaultOption.name
      : null
    : null;

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
    packageDrafts: choice.presentsPackages ? packageDrafts : [],
    defaultPackageLabel,
    presentsPackages: choice.presentsPackages,
    contentAreas: collectContentAreas(options),
    structureNotes: buildStructureNotes({
      packageModel: input.packageModel,
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
    const prefix =
      plan.packageModel === "custom" ? "Custom setup starts with" : "One package";
    return `${prefix}: ${plan.packageLabels[0]}`;
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
