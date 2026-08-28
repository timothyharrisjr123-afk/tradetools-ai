/**
 * R3A0 — Repair starter template packet section bodies to FieldDive-native defaults.
 *
 * Pure plan + store apply. Updates only proposal_template_sections (and optionally
 * option descriptions) when content still exactly matches known pre-R3A0 starter
 * boilerplate. Never touches proposal_pages, proposal_versions, or sent snapshots.
 */

import {
  DEFAULT_PACKET_OVERVIEW_BODY,
  DEFAULT_PACKET_OVERVIEW_TITLE,
  DEFAULT_PACKET_SCOPE_NOTES_BODY,
  DEFAULT_PACKET_SCOPE_NOTES_TITLE,
  DEFAULT_PACKET_TERMS_BODY,
  DEFAULT_PACKET_TERMS_TITLE,
  PRE_COHESION_C_PACKET_TERMS_BODY,
  DEFAULT_PACKET_WARRANTY_BODY,
  DEFAULT_PACKET_WARRANTY_TITLE,
  LEGACY_PACKET_OVERVIEW_BODY,
  LEGACY_PACKET_SCOPE_NOTES_BODY,
  LEGACY_PACKET_TERMS_BODY,
  LEGACY_PACKET_WARRANTY_BODY,
  PRE_V2E5_PACKET_OVERVIEW_BODY,
} from "@/app/lib/proposalCustomerPacketDefaultContent";
import { DEFAULT_ROOF_REPLACEMENT_TEMPLATE_SEED_KEY } from "@/app/lib/defaultRoofingProposalTemplates";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import {
  getProposalTemplateGraph,
  getProposalTemplatesByCompany,
  updateProposalTemplateOption,
  updateProposalTemplateSection,
} from "@/app/lib/proposalTemplateStore";
import type { ProposalTemplateSectionContent } from "@/app/lib/proposalTemplateTypes";

export const PACKET_CONTENT_REPAIR_SENT_SNAPSHOT_GUARD =
  "Packet content repair updates reusable proposal_template_sections only. " +
  "Existing draft and sent proposal_pages are never rewritten.";

type PacketSuffix = ".overview" | ".scope_notes" | ".warranty" | ".terms";

const PACKET_TARGETS: ReadonlyArray<{
  suffix: PacketSuffix;
  matchBodies: readonly string[];
  nextBody: string;
  nextTitle: string;
}> = [
  {
    suffix: ".overview",
    matchBodies: [LEGACY_PACKET_OVERVIEW_BODY, PRE_V2E5_PACKET_OVERVIEW_BODY],
    nextBody: DEFAULT_PACKET_OVERVIEW_BODY,
    nextTitle: DEFAULT_PACKET_OVERVIEW_TITLE,
  },
  {
    suffix: ".scope_notes",
    matchBodies: [LEGACY_PACKET_SCOPE_NOTES_BODY],
    nextBody: DEFAULT_PACKET_SCOPE_NOTES_BODY,
    nextTitle: DEFAULT_PACKET_SCOPE_NOTES_TITLE,
  },
  {
    suffix: ".warranty",
    matchBodies: [LEGACY_PACKET_WARRANTY_BODY],
    nextBody: DEFAULT_PACKET_WARRANTY_BODY,
    nextTitle: DEFAULT_PACKET_WARRANTY_TITLE,
  },
  {
    suffix: ".terms",
    matchBodies: [LEGACY_PACKET_TERMS_BODY, PRE_COHESION_C_PACKET_TERMS_BODY],
    nextBody: DEFAULT_PACKET_TERMS_BODY,
    nextTitle: DEFAULT_PACKET_TERMS_TITLE,
  },
];

const LEGACY_OPTION_DESCRIPTIONS: ReadonlyArray<{ match: string; next: string }> = [
  {
    match:
      "Standard roof replacement package with core materials, labor, disposal, and permit line items.",
    next:
      "Solid, complete roof replacement with quality materials, professional installation, cleanup, and permit handling.",
  },
  {
    match:
      "Enhanced package with upgraded underlayment and ice and water protection included, plus optional additional ventilation.",
    next:
      "Stronger weather protection with upgraded underlayment and ice and water shield included — plus optional extra ventilation if you need it.",
  },
  {
    match:
      "Premium package with premium shingles, enhanced underlayment, and ice and water protection included, plus optional additional ventilation.",
    next:
      "Our highest-protection package with premium shingles, upgraded underlayment, and ice and water shield — plus optional extra ventilation if you need it.",
  },
];

function normalizeBody(body: string | null | undefined): string {
  return String(body ?? "")
    .replace(/\r\n/g, "\n")
    .trim();
}

function extractSeedKey(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const raw = metadata.seed_key;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function mergeSectionContent(
  existing: ProposalTemplateSectionContent | null | undefined,
  nextBody: string,
  nextTitle: string
): ProposalTemplateSectionContent {
  return {
    title: nextTitle,
    body_markdown: nextBody,
    layout_hint: existing?.layout_hint ?? null,
    asset_ref: existing?.asset_ref ?? null,
  };
}

export type DefaultPacketSectionRepairItem = {
  sectionId: string;
  optionId: string;
  templateId: string;
  seedKey: string;
  suffix: PacketSuffix;
  fromBodyPreview: string;
  toTitle: string;
};

export type DefaultPacketOptionDescriptionRepairItem = {
  optionId: string;
  templateId: string;
  fromDescription: string;
  toDescription: string;
};

export type DefaultPacketContentRepairPlan = {
  sentSnapshotsMustNotBeMutated: true;
  sentSnapshotGuardrail: typeof PACKET_CONTENT_REPAIR_SENT_SNAPSHOT_GUARD;
  templateId: string;
  templateSeedKey: string;
  sectionRepairs: DefaultPacketSectionRepairItem[];
  optionDescriptionRepairs: DefaultPacketOptionDescriptionRepairItem[];
};

export function buildDefaultPacketContentRepairPlan(
  graph: ProposalTemplateGraph
): DefaultPacketContentRepairPlan | null {
  const templateSeedKey = extractSeedKey(graph.template.metadata ?? null);
  if (templateSeedKey !== DEFAULT_ROOF_REPLACEMENT_TEMPLATE_SEED_KEY) {
    return null;
  }

  const sectionRepairs: DefaultPacketSectionRepairItem[] = [];
  for (const section of graph.sections) {
    const seedKey = extractSeedKey(section.metadata ?? null);
    if (!seedKey) continue;
    const target = PACKET_TARGETS.find((row) => seedKey.endsWith(row.suffix));
    if (!target) continue;
    const currentBody = normalizeBody(section.content?.body_markdown);
    const matchesKnownBody = target.matchBodies.some(
      (body) => currentBody === normalizeBody(body)
    );
    const matchesSmokeNotes =
      target.suffix === ".scope_notes" && /^R3A SMOKE TEST/i.test(currentBody);
    if (!matchesKnownBody && !matchesSmokeNotes) continue;
    sectionRepairs.push({
      sectionId: section.id,
      optionId: section.option_id,
      templateId: graph.template.id,
      seedKey,
      suffix: target.suffix,
      fromBodyPreview: currentBody.slice(0, 80),
      toTitle: target.nextTitle,
    });
  }

  const optionDescriptionRepairs: DefaultPacketOptionDescriptionRepairItem[] = [];
  for (const option of graph.options) {
    const current = normalizeBody(option.description);
    const match = LEGACY_OPTION_DESCRIPTIONS.find(
      (row) => normalizeBody(row.match) === current
    );
    if (!match) continue;
    optionDescriptionRepairs.push({
      optionId: option.id,
      templateId: graph.template.id,
      fromDescription: current,
      toDescription: match.next,
    });
  }

  if (sectionRepairs.length === 0 && optionDescriptionRepairs.length === 0) {
    return {
      sentSnapshotsMustNotBeMutated: true,
      sentSnapshotGuardrail: PACKET_CONTENT_REPAIR_SENT_SNAPSHOT_GUARD,
      templateId: graph.template.id,
      templateSeedKey,
      sectionRepairs: [],
      optionDescriptionRepairs: [],
    };
  }

  return {
    sentSnapshotsMustNotBeMutated: true,
    sentSnapshotGuardrail: PACKET_CONTENT_REPAIR_SENT_SNAPSHOT_GUARD,
    templateId: graph.template.id,
    templateSeedKey,
    sectionRepairs,
    optionDescriptionRepairs,
  };
}

export type ApplyDefaultPacketContentRepairResult = {
  ok: boolean;
  templateId: string | null;
  sectionsUpdated: number;
  optionsUpdated: number;
  skipped: boolean;
  errors: string[];
};

/**
 * Apply R3A0 packet content to the company starter template when bodies still
 * match known legacy starter boilerplate. Insert-only install cannot refresh them.
 */
export async function repairCompanyStarterPacketContent(
  companyId: string
): Promise<ApplyDefaultPacketContentRepairResult> {
  const cid = String(companyId || "").trim();
  const empty: ApplyDefaultPacketContentRepairResult = {
    ok: true,
    templateId: null,
    sectionsUpdated: 0,
    optionsUpdated: 0,
    skipped: true,
    errors: [],
  };
  if (!cid) return empty;

  const templates = await getProposalTemplatesByCompany(cid);
  const starter = templates.find(
    (row) => extractSeedKey(row.metadata ?? null) === DEFAULT_ROOF_REPLACEMENT_TEMPLATE_SEED_KEY
  );
  if (!starter?.id) return empty;

  const graph = await getProposalTemplateGraph(starter.id, { companyId: cid });
  if (!graph) {
    return {
      ...empty,
      ok: false,
      skipped: false,
      errors: ["Could not load starter template graph for packet repair."],
    };
  }

  const plan = buildDefaultPacketContentRepairPlan(graph);
  if (!plan || (plan.sectionRepairs.length === 0 && plan.optionDescriptionRepairs.length === 0)) {
    return { ...empty, templateId: starter.id, skipped: true };
  }

  const errors: string[] = [];
  let sectionsUpdated = 0;
  let optionsUpdated = 0;

  for (const item of plan.sectionRepairs) {
    const target = PACKET_TARGETS.find((row) => row.suffix === item.suffix);
    if (!target) continue;
    const section = graph.sections.find((row) => row.id === item.sectionId);
    const updated = await updateProposalTemplateSection(
      item.sectionId,
      {
        name: target.nextTitle,
        customer_title: target.nextTitle,
        content: mergeSectionContent(section?.content, target.nextBody, target.nextTitle),
      },
      { companyId: cid, templateId: item.templateId, optionId: item.optionId }
    );
    if (!updated) {
      errors.push(`Failed to update section ${item.seedKey}`);
      continue;
    }
    sectionsUpdated += 1;
  }

  for (const item of plan.optionDescriptionRepairs) {
    const updated = await updateProposalTemplateOption(
      item.optionId,
      { description: item.toDescription },
      { companyId: cid, templateId: item.templateId }
    );
    if (!updated) {
      errors.push(`Failed to update option description ${item.optionId}`);
      continue;
    }
    optionsUpdated += 1;
  }

  return {
    ok: errors.length === 0,
    templateId: starter.id,
    sectionsUpdated,
    optionsUpdated,
    skipped: false,
    errors,
  };
}
