/**
 * R3A — Setup-owned customer packet wording editor (pure).
 *
 * Edits reusable proposal_template_sections that feed new draft proposal_pages.
 * Draft create copies only the spine (default) option’s packet sections.
 * Saves update the spine row and mirror matching packet slots on sibling options
 * so package switches stay consistent.
 *
 * Never touches proposal_pages, sent snapshots, or pricing truth.
 */

import { resolveSpineOptionId } from "@/app/lib/proposalSnapshotBuilder";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import { mergeSectionBodyMarkdown } from "@/app/lib/proposalTemplateContentEditing";
import type {
  ProposalTemplateOption,
  ProposalTemplateSection,
  ProposalTemplateSectionContent,
} from "@/app/lib/proposalTemplateTypes";

export type PacketWordingSlotId =
  | "overview"
  | "project_notes"
  | "warranty"
  | "terms";

export const PACKET_WORDING_SLOT_ORDER: readonly PacketWordingSlotId[] = [
  "overview",
  "project_notes",
  "warranty",
  "terms",
] as const;

export const PACKET_WORDING_SLOT_LABELS: Record<PacketWordingSlotId, string> = {
  overview: "Project overview",
  project_notes: "Project notes",
  warranty: "Warranty and protection",
  terms: "Terms / next steps",
};

export const TEMPLATES_PACKET_EDIT_ACTION = "Edit customer wording" as const;
export const TEMPLATES_PACKET_SAVE_ACTION = "Save changes" as const;
export const TEMPLATES_PACKET_CANCEL_ACTION = "Cancel" as const;
export const TEMPLATES_PACKET_EDITOR_HEADING = "Customer wording" as const;
export const TEMPLATES_PACKET_EDITOR_HINT =
  "This wording appears on new proposals. Existing drafts keep their copied text." as const;

export type PacketWordingSlotView = {
  slotId: PacketWordingSlotId;
  label: string;
  /** Spine section used for display and as the create-copy source. */
  spineSectionId: string;
  spineOptionId: string;
  body: string;
  /** All option sections that share this packet slot (spine + siblings). */
  mirrorSectionIds: readonly string[];
};

export type PacketWordingEditorViewModel = {
  spineOptionId: string | null;
  slots: readonly PacketWordingSlotView[];
};

export type PacketWordingDraftMap = Partial<Record<PacketWordingSlotId, string>>;

export type PacketWordingSaveItem = {
  sectionId: string;
  optionId: string;
  content: ProposalTemplateSectionContent;
  slotId: PacketWordingSlotId;
};

export type PacketWordingSavePlan = {
  items: readonly PacketWordingSaveItem[];
  /** True when every draft equals current spine body (nothing to write). */
  isNoop: boolean;
};

function sectionTitleBlob(section: ProposalTemplateSection): string {
  return `${section.customer_title ?? ""} ${section.name ?? ""} ${section.content?.title ?? ""}`.toLowerCase();
}

/**
 * Map a template section to a customer packet wording slot, or null if not editable here.
 */
export function resolvePacketWordingSlotId(
  section: ProposalTemplateSection
): PacketWordingSlotId | null {
  if (section.kind === "warranty") return "warranty";
  if (section.kind === "terms") return "terms";
  if (section.kind === "text") {
    const title = sectionTitleBlob(section);
    if (title.includes("overview")) return "overview";
    if (
      title.includes("project notes") ||
      title.includes("scope notes") ||
      (title.includes("notes") && !title.includes("overview"))
    ) {
      return "project_notes";
    }
  }
  return null;
}

function readSectionBody(section: ProposalTemplateSection): string {
  return String(section.content?.body_markdown ?? "");
}

/**
 * Build the setup-owned packet wording view from the reusable template graph.
 * Display bodies come from the spine option (what new drafts copy).
 */
export function buildPacketWordingEditorViewModel(
  graph: Pick<ProposalTemplateGraph, "options" | "sections">,
  spineOptionIdOverride?: string | null
): PacketWordingEditorViewModel {
  const spineOptionId =
    (spineOptionIdOverride ?? "").trim() ||
    resolveSpineOptionId(graph.options as readonly ProposalTemplateOption[]);

  if (!spineOptionId) {
    return { spineOptionId: null, slots: [] };
  }

  const bySlot = new Map<PacketWordingSlotId, ProposalTemplateSection[]>();
  for (const section of graph.sections) {
    const slotId = resolvePacketWordingSlotId(section);
    if (!slotId) continue;
    const list = bySlot.get(slotId) ?? [];
    list.push(section);
    bySlot.set(slotId, list);
  }

  const slots: PacketWordingSlotView[] = [];
  for (const slotId of PACKET_WORDING_SLOT_ORDER) {
    const sections = bySlot.get(slotId) ?? [];
    if (sections.length === 0) continue;
    const spineSection =
      sections.find((section) => section.option_id === spineOptionId) ?? sections[0]!;
    slots.push({
      slotId,
      label: PACKET_WORDING_SLOT_LABELS[slotId],
      spineSectionId: spineSection.id,
      spineOptionId: spineSection.option_id,
      body: readSectionBody(spineSection),
      mirrorSectionIds: sections.map((section) => section.id),
    });
  }

  return { spineOptionId, slots };
}

/**
 * Plan saves for dirty slots. Updates every mirrored option section for each slot
 * so spine create-copy and sibling package wording stay aligned.
 */
export function buildPacketWordingSavePlan(
  graph: Pick<ProposalTemplateGraph, "options" | "sections">,
  drafts: PacketWordingDraftMap,
  spineOptionIdOverride?: string | null
): PacketWordingSavePlan {
  const view = buildPacketWordingEditorViewModel(graph, spineOptionIdOverride);
  const sectionById = new Map(graph.sections.map((section) => [section.id, section]));
  const items: PacketWordingSaveItem[] = [];

  for (const slot of view.slots) {
    if (!Object.prototype.hasOwnProperty.call(drafts, slot.slotId)) continue;
    const nextBody = drafts[slot.slotId] ?? "";
    const current = slot.body;
    if (normalizeBody(nextBody) === normalizeBody(current)) continue;

    for (const sectionId of slot.mirrorSectionIds) {
      const section = sectionById.get(sectionId);
      if (!section) continue;
      items.push({
        sectionId: section.id,
        optionId: section.option_id,
        slotId: slot.slotId,
        content: mergeSectionBodyMarkdown(section.content, nextBody),
      });
    }
  }

  return { items, isNoop: items.length === 0 };
}

function normalizeBody(body: string): string {
  return body.replace(/\r\n/g, "\n").trim();
}

/** Preview snippet for read mode — readable example copy, not raw tokens. */
export function packetWordingPreview(body: string, maxLength = 140): string {
  const readable = body
    .replace(/\{\{selected_package_name\}\}\s+package/gi, "selected package")
    .replace(/\{\{selected_package_name\}\}/g, "selected package")
    .replace(/\{\{company_name\}\}/g, "Your company")
    .replace(/\{\{[a-z][a-z0-9_]*\}\}/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!readable) return "";
  if (readable.length <= maxLength) return readable;
  return `${readable.slice(0, maxLength - 1).trimEnd()}…`;
}

export function packetWordingUiHasForbiddenTerms(source: string): boolean {
  return /\b(body_markdown|content_json|page_type|section_id|proposal_template_sections|schema)\b/i.test(
    source
  );
}
