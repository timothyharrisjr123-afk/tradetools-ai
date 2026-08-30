"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { deriveCatalogReadiness } from "@/app/lib/catalogReadiness";
import { getCatalogItemsByCompany } from "@/app/lib/catalogStore";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import { DEFAULT_ROOFING_CATALOG_DEFINITIONS } from "@/app/lib/defaultRoofingCatalog";
import {
  installDefaultRoofingProposalTemplates,
  type InstallDefaultRoofingProposalTemplatesResult,
} from "@/app/lib/defaultRoofingProposalTemplateInstall";
import { repairCompanyStarterPacketContent } from "@/app/lib/proposalCustomerPacketContentRepair";
import {
  planAddIncludedProduct,
  planQuantityRule,
  planReplaceProduct,
} from "@/app/lib/proposalTemplateCompositionAuthoring";
import {
  buildCatalogByIdMap,
  buildTemplateCatalogLinkView,
  catalogItemIdsAlreadyInSection,
  defaultItemRoleForSectionKind,
  deriveTemplateCatalogLinkReadiness,
  nextTemplateItemSortOrder,
  sectionAcceptsCatalogItems,
} from "@/app/lib/proposalTemplateCatalogLink";
import { deriveProposalTemplateReadiness } from "@/app/lib/proposalTemplateReadiness";
import {
  clearPreferredSetup,
  getPreferredSetupTemplateId,
  setPreferredSetup,
} from "@/app/lib/companyTemplatePreferenceStore";
import {
  archiveProposalTemplate,
  createProposalTemplateItem,
  createProposalTemplateSection,
  deleteProposalTemplateItem,
  getProposalTemplateGraph,
  getProposalTemplatesByCompany,
  restoreProposalTemplate,
  updateProposalTemplate,
  updateProposalTemplateItem,
  updateProposalTemplateOption,
  updateProposalTemplateSection,
  type ProposalTemplateGraph,
} from "@/app/lib/proposalTemplateStore";
import type { ProposalTemplate, ProposalTemplateSectionKind } from "@/app/lib/proposalTemplateTypes";
import type { ProposalPageSettings } from "@/app/lib/proposalPageTypes";
import {
  buildLineItemsSectionEstimateSettingsPatch,
  buildTemplateEstimateSettingsPatch,
} from "@/app/lib/proposalTemplateEstimateSettings";
import {
  planAddSection,
  planReorderSections,
} from "@/app/lib/proposalTemplateStructureMutations";
import TemplatesAddItemSectionChooser from "./TemplatesAddItemSectionChooser";
import { createGuidedProposalTemplate } from "./createGuidedProposalTemplate";
import TemplatesCatalogItemPickerModal, {
  type TemplatesCatalogPickerMode,
} from "./TemplatesCatalogItemPickerModal";
import TemplatesCatalogPrerequisite from "./TemplatesCatalogPrerequisite";
import TemplatesGuidedCreateOverlay from "./TemplatesGuidedCreateOverlay";
import TemplatesLibrarySection from "./TemplatesLibrarySection";
import TemplatesOnboardingZone from "./TemplatesOnboardingZone";
import TemplatesPageAlerts from "./TemplatesPageAlerts";
import TemplatesPageHeader from "./TemplatesPageHeader";
import TemplatesRemoveItemConfirmModal from "./TemplatesRemoveItemConfirmModal";
import TemplatesSelectedWorkspace from "./TemplatesSelectedWorkspace";
import type {
  PackageAuthorshipDraft,
  PackageStructureCreateDraft,
  TemplateIdentityDraft,
} from "./TemplatesSetupAuthorshipEditors";
import {
  copyExistingTemplatePackage,
  createBlankTemplatePackageShell,
  removeTemplatePackage,
  reorderTemplatePackages,
} from "./templatesPackageStructureActions";
import type { PacketWordingSavePlan } from "./templatesSetupPacketWording";
import TemplatesStarterHeroCard from "./TemplatesStarterHeroCard";
import TemplatesWorkspaceLayout from "./TemplatesWorkspaceLayout";
import { deriveInstallFeedback, findStarterProposalTemplate } from "./templatesSetupUtils";
import {
  buildWorkspaceContentViewModel,
  isTemplateWorkspaceActive,
  resolveDefaultSelectedTemplateId,
} from "./templatesWorkspaceUtils";
import {
  buildWorkspaceStructureViewModel,
  computeReorderedSectionIds,
  getOrderedSectionIdsForOption,
} from "./templatesStructureEditorUtils";
import type { GuidedTemplateCreatePlan } from "./templatesGuidedCreatePlanner";
import {
  buildTemplateCreatesSummary,
  defaultSelectedPackageOptionId,
  listCatalogTargetSectionsForOption,
  type CatalogTargetSectionChoice,
  type TemplatesEditTabId,
  type TemplatesWorkspaceMode,
  summarizePackageOptionsForWorkspace,
} from "./templatesWorkspaceFlow";

const CATALOG_STARTER_DEFINITION_COUNT = DEFAULT_ROOFING_CATALOG_DEFINITIONS.length;

type SectionSaveError = {
  sectionId: string;
  message: string;
};

type StructureSettingsBusy =
  | { kind: "add"; optionId: string; sectionKind: ProposalTemplateSectionKind }
  | { kind: "move"; sectionId: string }
  | { kind: "settings-template" }
  | { kind: "settings-option"; optionId: string }
  | { kind: "add-item"; sectionId: string }
  | { kind: "relink-item"; itemId: string }
  | { kind: "remove-item"; itemId: string }
  | null;

type CatalogPickerState =
  | {
      mode: "add";
      optionId: string;
      sectionId: string;
    }
  | {
      mode: "relink";
      templateItemId: string;
      sectionId: string;
      optionId: string;
    }
  | null;

export default function TemplatesSetupClient({ companyId }: { companyId: string }) {
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [companyTemplates, setCompanyTemplates] = useState<ProposalTemplate[]>([]);
  const [starterGraph, setStarterGraph] = useState<ProposalTemplateGraph | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedGraph, setSelectedGraph] = useState<ProposalTemplateGraph | null>(null);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [graphLoading, setGraphLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  const [installing, setInstalling] = useState(false);
  const [installResult, setInstallResult] =
    useState<InstallDefaultRoofingProposalTemplatesResult | null>(null);
  const [installMessage, setInstallMessage] = useState<string | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);

  const [savingSectionId, setSavingSectionId] = useState<string | null>(null);
  const [, setSectionSaveError] = useState<SectionSaveError | null>(null);
  const [dirtySectionCount] = useState(0);

  const [structureBusy, setStructureBusy] = useState<StructureSettingsBusy>(null);
  const [structureError, setStructureError] = useState<string | null>(null);
  const [catalogPicker, setCatalogPicker] = useState<CatalogPickerState>(null);
  const [workspaceMode, setWorkspaceMode] = useState<TemplatesWorkspaceMode>("review");
  const [editTab, setEditTab] = useState<TemplatesEditTabId>("packages");
  const [selectedPackageOptionId, setSelectedPackageOptionId] = useState<string | null>(null);
  const [focusSectionId, setFocusSectionId] = useState<string | null>(null);
  const [addSectionChoices, setAddSectionChoices] = useState<CatalogTargetSectionChoice[] | null>(
    null
  );
  const [removeConfirmItemId, setRemoveConfirmItemId] = useState<string | null>(null);
  const [guidedCreateOpen, setGuidedCreateOpen] = useState(false);
  const [guidedCreating, setGuidedCreating] = useState(false);
  const [guidedCreateError, setGuidedCreateError] = useState<string | null>(null);

  // R2A — template library lifecycle (archive/restore). Separate from R1
  // package-option removed_at soft-remove; never touches package options,
  // sections, items, or proposal history.
  const [lifecycleBusyTemplateId, setLifecycleBusyTemplateId] = useState<string | null>(null);
  const [lifecycleError, setLifecycleError] = useState<string | null>(null);

  // R2B — preferred setup for roofing proposal creation (not package-option default).
  const [preferredTemplateId, setPreferredTemplateId] = useState<string | null>(null);
  const [preferenceBusy, setPreferenceBusy] = useState(false);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      // Load all items so inactive/missing links can be detected; picker filters to active.
      const rows = await getCatalogItemsByCompany(companyId);
      setCatalogItems(rows);
    } catch (err) {
      console.warn("[TemplatesSetupClient] catalog fetch error:", err);
      setCatalogError("Could not load catalog items.");
      setCatalogItems([]);
    } finally {
      setCatalogLoading(false);
    }
  }, [companyId]);

  const loadTemplateGraph = useCallback(
    async (templateId: string, starterGraphCache: ProposalTemplateGraph | null) => {
      if (starterGraphCache?.template.id === templateId) {
        return starterGraphCache;
      }
      return getProposalTemplateGraph(templateId, { companyId });
    },
    [companyId]
  );

  const loadTemplates = useCallback(
    async (preserveSelectionId?: string | null) => {
      setTemplatesLoading(true);
      setTemplatesError(null);
      try {
        // Refresh reusable starter packet bodies when they still match known
        // pre-R3A0 boilerplate. Never mutates proposal_pages / sent snapshots.
        await repairCompanyStarterPacketContent(companyId);

        const [templates, preferredId] = await Promise.all([
          getProposalTemplatesByCompany(companyId),
          getPreferredSetupTemplateId(companyId),
        ]);
        setCompanyTemplates(templates);
        setPreferredTemplateId(preferredId);

        const starter = findStarterProposalTemplate(templates);
        let nextStarterGraph: ProposalTemplateGraph | null = null;
        if (starter?.id) {
          nextStarterGraph = await getProposalTemplateGraph(starter.id, { companyId });
        }
        setStarterGraph(nextStarterGraph);

        const nextSelectedId =
          preserveSelectionId && templates.some((row) => row.id === preserveSelectionId)
            ? preserveSelectionId
            : resolveDefaultSelectedTemplateId(templates);
        setSelectedTemplateId(nextSelectedId);

        if (nextSelectedId) {
          const graph = await loadTemplateGraph(nextSelectedId, nextStarterGraph);
          setSelectedGraph(graph);
        } else {
          setSelectedGraph(null);
        }
      } catch (err) {
        console.warn("[TemplatesSetupClient] template fetch error:", err);
        setTemplatesError("Could not load proposal templates.");
        setCompanyTemplates([]);
        setStarterGraph(null);
        setSelectedTemplateId(null);
        setSelectedGraph(null);
        setPreferredTemplateId(null);
      } finally {
        setTemplatesLoading(false);
      }
    },
    [companyId, loadTemplateGraph]
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await loadCatalog();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [loadCatalog]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await loadTemplates();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [loadTemplates]);

  const handleArchiveTemplate = useCallback(
    async (templateId: string) => {
      if (!companyId) return;
      setLifecycleBusyTemplateId(templateId);
      setLifecycleError(null);
      try {
        const updated = await archiveProposalTemplate(templateId, { companyId });
        if (!updated) {
          setLifecycleError("Could not archive this setup. Try again.");
          return;
        }
        await loadTemplates(selectedTemplateId ?? undefined);
      } catch (err) {
        console.warn("[TemplatesSetupClient] archive template error:", err);
        setLifecycleError("Could not archive this setup. Try again.");
      } finally {
        setLifecycleBusyTemplateId(null);
      }
    },
    [companyId, loadTemplates, selectedTemplateId]
  );

  const handleRestoreTemplate = useCallback(
    async (templateId: string) => {
      if (!companyId) return;
      setLifecycleBusyTemplateId(templateId);
      setLifecycleError(null);
      try {
        const updated = await restoreProposalTemplate(templateId, { companyId });
        if (!updated) {
          setLifecycleError("Could not restore this setup. Try again.");
          return;
        }
        await loadTemplates(selectedTemplateId ?? undefined);
      } catch (err) {
        console.warn("[TemplatesSetupClient] restore template error:", err);
        setLifecycleError("Could not restore this setup. Try again.");
      } finally {
        setLifecycleBusyTemplateId(null);
      }
    },
    [companyId, loadTemplates, selectedTemplateId]
  );

  const handleMakePreferred = useCallback(
    async (templateId: string) => {
      if (!companyId) return;
      setPreferenceBusy(true);
      setPreferenceError(null);
      try {
        const updated = await setPreferredSetup(companyId, templateId);
        if (!updated) {
          setPreferenceError("Could not mark this as the preferred setup. Try again.");
          return;
        }
        setPreferredTemplateId(updated.template_id);
      } catch (err) {
        console.warn("[TemplatesSetupClient] make preferred error:", err);
        setPreferenceError("Could not mark this as the preferred setup. Try again.");
      } finally {
        setPreferenceBusy(false);
      }
    },
    [companyId]
  );

  const handleClearPreferred = useCallback(async () => {
    if (!companyId) return;
    setPreferenceBusy(true);
    setPreferenceError(null);
    try {
      const cleared = await clearPreferredSetup(companyId);
      if (!cleared) {
        setPreferenceError("Could not clear the preferred setup. Try again.");
        return;
      }
      setPreferredTemplateId(null);
    } catch (err) {
      console.warn("[TemplatesSetupClient] clear preferred error:", err);
      setPreferenceError("Could not clear the preferred setup. Try again.");
    } finally {
      setPreferenceBusy(false);
    }
  }, [companyId]);

  const handleSelectTemplate = useCallback(
    (templateId: string) => {
      if (dirtySectionCount > 0 && templateId !== selectedTemplateId) {
        return;
      }

      void (async () => {
        if (templateId === selectedTemplateId) return;

        setGraphLoading(true);
        setTemplatesError(null);
        setSelectedTemplateId(templateId);
        setWorkspaceMode("review");
        setEditTab("packages");
        setSelectedPackageOptionId(null);
        setFocusSectionId(null);
        setRemoveConfirmItemId(null);
        setAddSectionChoices(null);
        try {
          const graph = await loadTemplateGraph(templateId, starterGraph);
          setSelectedGraph(graph);
        } catch (err) {
          console.warn("[TemplatesSetupClient] template graph fetch error:", err);
          setTemplatesError("Could not load the selected template.");
          setSelectedGraph(null);
        } finally {
          setGraphLoading(false);
        }
      })();
    },
    [dirtySectionCount, loadTemplateGraph, selectedTemplateId, starterGraph]
  );

  const reloadSelectedGraph = useCallback(
    async (templateId: string) => {
      const freshGraph = await getProposalTemplateGraph(templateId, { companyId });
      setSelectedGraph(freshGraph);
      setStarterGraph((currentStarterGraph) =>
        currentStarterGraph?.template.id === templateId ? freshGraph : currentStarterGraph
      );
      return freshGraph;
    },
    [companyId]
  );

  /** R3A — save setup-owned packet wording to template sections (mirrors siblings). */
  const handleSavePacketWording = useCallback(
    async (plan: PacketWordingSavePlan): Promise<boolean> => {
      if (!selectedTemplateId || plan.isNoop) return true;
      if (savingSectionId) return false;

      setSavingSectionId("packet-wording");
      setSectionSaveError(null);

      try {
        for (const item of plan.items) {
          const updated = await updateProposalTemplateSection(
            item.sectionId,
            { content: item.content },
            {
              companyId,
              templateId: selectedTemplateId,
              optionId: item.optionId,
            }
          );
          if (!updated) {
            setSectionSaveError({
              sectionId: item.sectionId,
              message: "Could not save customer wording. Try again.",
            });
            return false;
          }
        }
        await reloadSelectedGraph(selectedTemplateId);
        return true;
      } catch (err) {
        console.warn("[TemplatesSetupClient] packet wording save error:", err);
        setSectionSaveError({
          sectionId: plan.items[0]?.sectionId ?? "packet-wording",
          message: "Could not save customer wording. Try again.",
        });
        return false;
      } finally {
        setSavingSectionId(null);
      }
    },
    [companyId, reloadSelectedGraph, savingSectionId, selectedTemplateId]
  );

  const handleAddSection = useCallback(
    (optionId: string, kind: ProposalTemplateSectionKind) => {
      void (async () => {
        if (!selectedGraph || !selectedTemplateId || structureBusy || savingSectionId) return;

        const plan = planAddSection({ graph: selectedGraph, optionId, kind });
        if (plan.status === "blocked") {
          setStructureError(plan.reason);
          return;
        }

        setStructureBusy({ kind: "add", optionId, sectionKind: kind });
        setStructureError(null);

        try {
          const created = await createProposalTemplateSection(plan.draft, {
            companyId,
            templateId: selectedTemplateId,
            optionId,
          });

          if (!created) {
            setStructureError("Could not add this section. Try again.");
            return;
          }

          await reloadSelectedGraph(selectedTemplateId);
        } catch (err) {
          console.warn("[TemplatesSetupClient] add section error:", err);
          setStructureError("Add section failed unexpectedly.");
        } finally {
          setStructureBusy(null);
        }
      })();
    },
    [
      companyId,
      reloadSelectedGraph,
      savingSectionId,
      selectedGraph,
      selectedTemplateId,
      structureBusy,
    ]
  );

  const handleMoveSection = useCallback(
    (optionId: string, sectionId: string, direction: "up" | "down") => {
      void (async () => {
        if (!selectedGraph || !selectedTemplateId || structureBusy || savingSectionId) {
          return;
        }

        const viewModel = buildWorkspaceStructureViewModel(selectedGraph);
        if (!viewModel) return;

        const orderedIds = getOrderedSectionIdsForOption(viewModel, optionId);
        const nextOrder = computeReorderedSectionIds(orderedIds, sectionId, direction);
        if (!nextOrder) return;

        const plan = planReorderSections({
          graph: selectedGraph,
          optionId,
          orderedSectionIds: nextOrder,
        });

        if (plan.status === "blocked") {
          setStructureError(plan.reason);
          return;
        }

        setStructureBusy({ kind: "move", sectionId });
        setStructureError(null);

        try {
          const results = await Promise.all(
            plan.patches.map((patch) =>
              updateProposalTemplateSection(
                patch.sectionId,
                { sort_order: patch.sort_order },
                {
                  companyId,
                  templateId: selectedTemplateId,
                  optionId,
                }
              )
            )
          );

          if (results.some((row) => !row)) {
            setStructureError("Could not reorder sections. Try again.");
            return;
          }

          await reloadSelectedGraph(selectedTemplateId);
        } catch (err) {
          console.warn("[TemplatesSetupClient] reorder section error:", err);
          setStructureError("Reorder failed unexpectedly.");
        } finally {
          setStructureBusy(null);
        }
      })();
    },
    [
      companyId,
      reloadSelectedGraph,
      savingSectionId,
      selectedGraph,
      selectedTemplateId,
      structureBusy,
    ]
  );

  const handleSaveTemplateEstimateSettings = useCallback(
    (patch: Partial<ProposalPageSettings>) => {
      void (async () => {
        if (!selectedGraph || !selectedTemplateId || structureBusy || savingSectionId) return;

        setStructureBusy({ kind: "settings-template" });
        setStructureError(null);

        try {
          const metadata = buildTemplateEstimateSettingsPatch(selectedGraph.template, patch);
          const updated = await updateProposalTemplate(
            selectedTemplateId,
            { metadata },
            { companyId }
          );

          if (!updated) {
            setStructureError("Could not save template estimate settings. Try again.");
            return;
          }

          await reloadSelectedGraph(selectedTemplateId);
        } catch (err) {
          console.warn("[TemplatesSetupClient] template settings save error:", err);
          setStructureError("Settings save failed unexpectedly.");
        } finally {
          setStructureBusy(null);
        }
      })();
    },
    [
      companyId,
      reloadSelectedGraph,
      savingSectionId,
      selectedGraph,
      selectedTemplateId,
      structureBusy,
    ]
  );

  const handleSaveOptionEstimateSettings = useCallback(
    (optionId: string, patch: Partial<ProposalPageSettings>) => {
      void (async () => {
        if (!selectedGraph || !selectedTemplateId || structureBusy || savingSectionId) return;

        const lineItemsSection = selectedGraph.sections.find(
          (section) => section.option_id === optionId && section.kind === "line_items"
        );

        if (!lineItemsSection) {
          setStructureError("No estimate section found for this package option.");
          return;
        }

        const metadata = buildLineItemsSectionEstimateSettingsPatch(lineItemsSection, patch);
        if (!metadata) {
          setStructureError("Could not build estimate settings for this option.");
          return;
        }

        setStructureBusy({ kind: "settings-option", optionId });
        setStructureError(null);

        try {
          const updated = await updateProposalTemplateSection(
            lineItemsSection.id,
            { metadata },
            {
              companyId,
              templateId: selectedTemplateId,
              optionId,
            }
          );

          if (!updated) {
            setStructureError("Could not save option estimate settings. Try again.");
            return;
          }

          await reloadSelectedGraph(selectedTemplateId);
        } catch (err) {
          console.warn("[TemplatesSetupClient] option settings save error:", err);
          setStructureError("Settings save failed unexpectedly.");
        } finally {
          setStructureBusy(null);
        }
      })();
    },
    [
      companyId,
      reloadSelectedGraph,
      savingSectionId,
      selectedGraph,
      selectedTemplateId,
      structureBusy,
    ]
  );

  const handleOpenAddCatalogItem = useCallback(
    (optionId: string, sectionId: string) => {
      if (!selectedGraph || structureBusy || savingSectionId) return;
      const section = selectedGraph.sections.find((row) => row.id === sectionId);
      if (!section || !sectionAcceptsCatalogItems(section.kind)) {
        setStructureError("Catalog items can only be added to line items or upgrade sections.");
        return;
      }
      setStructureError(null);
      setCatalogPicker({ mode: "add", optionId, sectionId });
    },
    [savingSectionId, selectedGraph, structureBusy]
  );

  const handleOpenRelinkCatalogItem = useCallback(
    (templateItemId: string) => {
      if (!selectedGraph || structureBusy || savingSectionId) return;
      const item = selectedGraph.items.find((row) => row.id === templateItemId);
      if (!item) {
        setStructureError("Template item not found.");
        return;
      }
      setStructureError(null);
      setCatalogPicker({
        mode: "relink",
        templateItemId: item.id,
        sectionId: item.section_id,
        optionId: item.option_id,
      });
    },
    [savingSectionId, selectedGraph, structureBusy]
  );

  const handleCatalogPickerSelect = useCallback(
    (catalogItem: CatalogItem) => {
      void (async () => {
        if (!selectedGraph || !selectedTemplateId || !catalogPicker) return;
        if (!catalogItem.active) {
          setStructureError("Only active Catalog items can be linked to a template.");
          return;
        }

        const sectionItems = selectedGraph.items.filter(
          (row) => row.section_id === catalogPicker.sectionId
        );
        const alreadyLinked = catalogItemIdsAlreadyInSection(sectionItems);
        if (catalogPicker.mode === "add" && alreadyLinked.has(catalogItem.id)) {
          setStructureError("That Catalog item is already linked in this section.");
          return;
        }
        if (
          catalogPicker.mode === "relink" &&
          alreadyLinked.has(catalogItem.id) &&
          selectedGraph.items.find((row) => row.id === catalogPicker.templateItemId)
            ?.catalog_item_id !== catalogItem.id
        ) {
          setStructureError("That Catalog item is already linked in this section.");
          return;
        }

        const section = selectedGraph.sections.find((row) => row.id === catalogPicker.sectionId);
        if (!section) {
          setStructureError("Template section not found.");
          return;
        }

        if (catalogPicker.mode === "add") {
          setStructureBusy({ kind: "add-item", sectionId: catalogPicker.sectionId });
          setStructureError(null);
          try {
            const planned = planAddIncludedProduct({
              catalogItem,
              optionId: catalogPicker.optionId,
              sectionId: catalogPicker.sectionId,
              itemRole: defaultItemRoleForSectionKind(section.kind),
              existingItems: selectedGraph.items,
              sortOrder: nextTemplateItemSortOrder(sectionItems),
            });
            const created = await createProposalTemplateItem(
              {
                template_id: selectedTemplateId,
                ...planned,
              },
              {
                companyId,
                templateId: selectedTemplateId,
                optionId: catalogPicker.optionId,
                sectionId: catalogPicker.sectionId,
              }
            );
            if (!created) {
              setStructureError("Could not add Catalog item to this template. Try again.");
              return;
            }
            setCatalogPicker(null);
            await reloadSelectedGraph(selectedTemplateId);
          } catch (err) {
            console.warn("[TemplatesSetupClient] add catalog item error:", err);
            setStructureError("Adding Catalog item failed unexpectedly.");
          } finally {
            setStructureBusy(null);
          }
          return;
        }

        const existingItem = selectedGraph.items.find(
          (row) => row.id === catalogPicker.templateItemId
        );
        if (!existingItem) {
          setStructureError("Template item not found.");
          return;
        }
        const planned = planReplaceProduct({
          existingItem,
          catalogItem,
        });

        setStructureBusy({ kind: "relink-item", itemId: catalogPicker.templateItemId });
        setStructureError(null);
        try {
          const updated = await updateProposalTemplateItem(
            catalogPicker.templateItemId,
            planned.patch,
            {
              companyId,
              templateId: selectedTemplateId,
              optionId: catalogPicker.optionId,
              sectionId: catalogPicker.sectionId,
            }
          );
          if (!updated) {
            setStructureError("Could not replace Catalog item. Try again.");
            return;
          }
          setCatalogPicker(null);
          await reloadSelectedGraph(selectedTemplateId);
        } catch (err) {
          console.warn("[TemplatesSetupClient] relink catalog item error:", err);
          setStructureError("Replacing Catalog item failed unexpectedly.");
        } finally {
          setStructureBusy(null);
        }
      })();
    },
    [
      catalogPicker,
      companyId,
      reloadSelectedGraph,
      selectedGraph,
      selectedTemplateId,
    ]
  );

  const handleSaveItemQuantity = useCallback(
    (templateItemId: string, mode: "inherit_catalog" | "fixed", fixedQuantity?: number | null) => {
      void (async () => {
        if (!selectedGraph || !selectedTemplateId) return;
        const item = selectedGraph.items.find((row) => row.id === templateItemId);
        if (!item) return;
        setStructureBusy({ kind: "relink-item", itemId: templateItemId });
        setStructureError(null);
        try {
          const updated = await updateProposalTemplateItem(
            templateItemId,
            { quantity_rule: planQuantityRule({ mode, fixedQuantity }) },
            {
              companyId,
              templateId: selectedTemplateId,
              optionId: item.option_id,
              sectionId: item.section_id,
            }
          );
          if (!updated) {
            setStructureError("Could not update quantity. Try again.");
            return;
          }
          await reloadSelectedGraph(selectedTemplateId);
        } catch (err) {
          console.warn("[TemplatesSetupClient] quantity update error:", err);
          setStructureError("Updating quantity failed unexpectedly.");
        } finally {
          setStructureBusy(null);
        }
      })();
    },
    [companyId, reloadSelectedGraph, selectedGraph, selectedTemplateId]
  );

  const activeItems = useMemo(() => catalogItems.filter((item) => item.active), [catalogItems]);

  const catalogReadiness = useMemo(
    () => deriveCatalogReadiness(activeItems, CATALOG_STARTER_DEFINITION_COUNT),
    [activeItems]
  );

  const catalogReady = catalogReadiness.state === "ready_for_templates";
  const starterInstalled = starterGraph != null;
  const loading = catalogLoading || templatesLoading;
  const loadError = catalogError ?? templatesError;
  const workspaceActive = isTemplateWorkspaceActive(companyTemplates, selectedGraph);
  const contentViewModel = useMemo(
    () => buildWorkspaceContentViewModel(selectedGraph),
    [selectedGraph]
  );
  const structureViewModel = useMemo(
    () => buildWorkspaceStructureViewModel(selectedGraph),
    [selectedGraph]
  );

  const proposalReadiness = useMemo(
    () =>
      deriveProposalTemplateReadiness({
        catalogReadiness,
        activeCatalogItems: activeItems,
        starterGraph,
        templateCount: companyTemplates.length,
        activeTemplateCount: starterGraph?.template.active ? 1 : starterGraph ? 1 : 0,
        lastInstallMissingCatalogSeedKeys: installResult?.missingCatalogSeedKeys,
      }),
    [
      catalogReadiness,
      activeItems,
      starterGraph,
      companyTemplates.length,
      installResult?.missingCatalogSeedKeys,
    ]
  );

  const selectedLinkReadiness = useMemo(() => {
    const catalogById = buildCatalogByIdMap(catalogItems);
    return deriveTemplateCatalogLinkReadiness(selectedGraph?.items ?? [], catalogById);
  }, [catalogItems, selectedGraph?.items]);

  const packageSummaries = useMemo(() => {
    if (!selectedGraph || !structureViewModel) return [];
    return summarizePackageOptionsForWorkspace(
      selectedGraph,
      structureViewModel,
      catalogItems
    );
  }, [selectedGraph, structureViewModel, catalogItems]);

  const createsSummary = useMemo(() => {
    if (!selectedGraph) {
      return {
        packageLabels: [] as string[],
        linkedCatalogCount: 0,
        issueCount: 0,
        availableUpgradeCount: 0,
        customerFacingAreas: [] as string[],
        customerDisplayLine: "",
        editableProseCount: 0,
      };
    }
    return buildTemplateCreatesSummary({
      graph: selectedGraph,
      packageSummaries,
      editableProseCount: contentViewModel?.totalEditableSectionCount ?? 0,
    });
  }, [selectedGraph, packageSummaries, contentViewModel?.totalEditableSectionCount]);

  useEffect(() => {
    if (packageSummaries.length === 0) {
      setSelectedPackageOptionId(null);
      return;
    }
    setSelectedPackageOptionId((current) => {
      if (current && packageSummaries.some((row) => row.optionId === current)) {
        return current;
      }
      return defaultSelectedPackageOptionId(packageSummaries);
    });
  }, [packageSummaries]);

  const handleSelectEditTab = useCallback((tab: TemplatesEditTabId) => {
    setEditTab(tab);
    if (tab !== "packages") {
      setFocusSectionId(null);
    }
  }, []);

  const handleOpenAdvanced = useCallback((tab: TemplatesEditTabId = "packages") => {
    setWorkspaceMode("advanced");
    setEditTab(tab);
    if (tab !== "packages") {
      setFocusSectionId(null);
    }
  }, []);

  const handleBackToReview = useCallback(() => {
    setWorkspaceMode("review");
    setFocusSectionId(null);
  }, []);

  const handleSelectPackage = useCallback((optionId: string) => {
    setSelectedPackageOptionId(optionId);
  }, []);

  const openQuoteAddForKind = useCallback(
    (preferredKind: "line_items" | "upgrade_group") => {
      if (!selectedGraph || !selectedPackageOptionId || structureBusy || savingSectionId) return;
      const choices = listCatalogTargetSectionsForOption(
        selectedGraph,
        selectedPackageOptionId,
        preferredKind
      );
      if (choices.length === 0) {
        setStructureError(
          preferredKind === "upgrade_group"
            ? "This package has no available-upgrades section yet."
            : "This package has no included-work section that accepts Catalog items yet."
        );
        return;
      }
      if (choices.length === 1) {
        handleOpenAddCatalogItem(choices[0].optionId, choices[0].sectionId);
        return;
      }
      setAddSectionChoices(choices);
    },
    [
      handleOpenAddCatalogItem,
      savingSectionId,
      selectedGraph,
      selectedPackageOptionId,
      structureBusy,
    ]
  );

  const handleQuoteAddItem = useCallback(() => {
    openQuoteAddForKind("line_items");
  }, [openQuoteAddForKind]);

  const handleQuoteAddUpgradeItem = useCallback(() => {
    openQuoteAddForKind("upgrade_group");
  }, [openQuoteAddForKind]);

  const handleChooseAddSection = useCallback(
    (sectionId: string) => {
      const choice = addSectionChoices?.find((row) => row.sectionId === sectionId);
      setAddSectionChoices(null);
      if (!choice) return;
      handleOpenAddCatalogItem(choice.optionId, choice.sectionId);
    },
    [addSectionChoices, handleOpenAddCatalogItem]
  );

  const handleRequestRemoveItem = useCallback((templateItemId: string) => {
    setRemoveConfirmItemId(templateItemId);
  }, []);

  const handleConfirmRemoveItem = useCallback(() => {
    void (async () => {
      if (!selectedGraph || !selectedTemplateId || !removeConfirmItemId) return;
      if (structureBusy || savingSectionId) return;

      const item = selectedGraph.items.find((row) => row.id === removeConfirmItemId);
      if (!item) {
        setStructureError("Template item not found.");
        setRemoveConfirmItemId(null);
        return;
      }

      setStructureBusy({ kind: "remove-item", itemId: item.id });
      setStructureError(null);
      try {
        const removed = await deleteProposalTemplateItem(item.id, {
          companyId,
          templateId: selectedTemplateId,
          optionId: item.option_id,
          sectionId: item.section_id,
        });
        if (!removed) {
          setStructureError("Could not remove this item from the template. Try again.");
          return;
        }
        setRemoveConfirmItemId(null);
        await reloadSelectedGraph(selectedTemplateId);
      } catch (err) {
        console.warn("[TemplatesSetupClient] remove template item error:", err);
        setStructureError("Removing the template item failed unexpectedly.");
      } finally {
        setStructureBusy(null);
      }
    })();
  }, [
    companyId,
    reloadSelectedGraph,
    removeConfirmItemId,
    savingSectionId,
    selectedGraph,
    selectedTemplateId,
    structureBusy,
  ]);

  const handleSaveTemplateIdentity = useCallback(
    async (draft: TemplateIdentityDraft) => {
      if (!companyId || !selectedTemplateId || structureBusy || savingSectionId) return;
      setStructureBusy({ kind: "settings-template" });
      setStructureError(null);
      try {
        const updated = await updateProposalTemplate(
          selectedTemplateId,
          {
            name: draft.name,
            description: draft.description.trim() ? draft.description.trim() : null,
          },
          { companyId }
        );
        if (!updated) {
          setStructureError("Could not save template name and purpose.");
          return;
        }
        setCompanyTemplates((current) =>
          current.map((row) => (row.id === updated.id ? updated : row))
        );
        await reloadSelectedGraph(selectedTemplateId);
      } catch (err) {
        setStructureError(
          err instanceof Error ? err.message : "Could not save template name and purpose."
        );
      } finally {
        setStructureBusy(null);
      }
    },
    [companyId, reloadSelectedGraph, savingSectionId, selectedTemplateId, structureBusy]
  );

  const handleSavePackageAuthorship = useCallback(
    async (drafts: readonly PackageAuthorshipDraft[]) => {
      if (
        !companyId ||
        !selectedTemplateId ||
        !selectedGraph ||
        structureBusy ||
        savingSectionId
      ) {
        return;
      }
      setStructureBusy({ kind: "settings-template" });
      setStructureError(null);
      const scope = { companyId, templateId: selectedTemplateId };
      try {
        // Clear defaults first so unique one-default-per-template index stays valid.
        for (const option of selectedGraph.options) {
          if (option.is_default) {
            const cleared = await updateProposalTemplateOption(
              option.id,
              { is_default: false },
              scope
            );
            if (!cleared) {
              setStructureError("Could not update default package.");
              return;
            }
          }
        }

        for (const draft of drafts) {
          const name = draft.name.trim();
          const customerLabel = draft.customerLabel.trim() || name;
          const description = draft.description.trim() ? draft.description.trim() : null;
          const updated = await updateProposalTemplateOption(
            draft.optionId,
            {
              name,
              customer_label: customerLabel,
              description,
              is_default: draft.isDefault,
            },
            scope
          );
          if (!updated) {
            setStructureError("Could not save package details.");
            return;
          }
        }
        await reloadSelectedGraph(selectedTemplateId);
      } catch (err) {
        setStructureError(
          err instanceof Error ? err.message : "Could not save package details."
        );
      } finally {
        setStructureBusy(null);
      }
    },
    [
      companyId,
      reloadSelectedGraph,
      savingSectionId,
      selectedGraph,
      selectedTemplateId,
      structureBusy,
    ]
  );

  const handleCopyPackage = useCallback(
    async (input: {
      sourceOptionId: string;
      draft: PackageStructureCreateDraft;
    }): Promise<boolean> => {
      if (!companyId || !selectedTemplateId || !selectedGraph || structureBusy || savingSectionId) {
        return false;
      }
      setStructureBusy({ kind: "settings-template" });
      setStructureError(null);
      try {
        const result = await copyExistingTemplatePackage({
          companyId,
          templateId: selectedTemplateId,
          graph: selectedGraph,
          sourceOptionId: input.sourceOptionId,
          draft: input.draft,
        });
        if (!result.ok) {
          setStructureError(result.error);
          return false;
        }
        await reloadSelectedGraph(selectedTemplateId);
        setSelectedPackageOptionId(result.optionId);
        return true;
      } catch (err) {
        setStructureError(
          err instanceof Error ? err.message : "Could not copy package."
        );
        return false;
      } finally {
        setStructureBusy(null);
      }
    },
    [
      companyId,
      reloadSelectedGraph,
      savingSectionId,
      selectedGraph,
      selectedTemplateId,
      structureBusy,
    ]
  );

  const handleCreateBlankPackage = useCallback(
    async (draft: PackageStructureCreateDraft): Promise<boolean> => {
      if (!companyId || !selectedTemplateId || !selectedGraph || structureBusy || savingSectionId) {
        return false;
      }
      setStructureBusy({ kind: "settings-template" });
      setStructureError(null);
      try {
        const result = await createBlankTemplatePackageShell({
          companyId,
          templateId: selectedTemplateId,
          graph: selectedGraph,
          draft,
        });
        if (!result.ok) {
          setStructureError(result.error);
          return false;
        }
        await reloadSelectedGraph(selectedTemplateId);
        setSelectedPackageOptionId(result.optionId);
        return true;
      } catch (err) {
        setStructureError(
          err instanceof Error ? err.message : "Could not create package shell."
        );
        return false;
      } finally {
        setStructureBusy(null);
      }
    },
    [
      companyId,
      reloadSelectedGraph,
      savingSectionId,
      selectedGraph,
      selectedTemplateId,
      structureBusy,
    ]
  );

  const handleReorderPackage = useCallback(
    async (optionId: string, direction: "up" | "down"): Promise<boolean> => {
      if (!companyId || !selectedTemplateId || !selectedGraph || structureBusy || savingSectionId) {
        return false;
      }
      setStructureBusy({ kind: "settings-template" });
      setStructureError(null);
      try {
        const result = await reorderTemplatePackages({
          companyId,
          templateId: selectedTemplateId,
          graph: selectedGraph,
          optionId,
          direction,
        });
        if (!result.ok) {
          setStructureError(result.error);
          return false;
        }
        await reloadSelectedGraph(selectedTemplateId);
        return true;
      } catch (err) {
        setStructureError(
          err instanceof Error ? err.message : "Could not reorder packages."
        );
        return false;
      } finally {
        setStructureBusy(null);
      }
    },
    [
      companyId,
      reloadSelectedGraph,
      savingSectionId,
      selectedGraph,
      selectedTemplateId,
      structureBusy,
    ]
  );

  const handleRemovePackage = useCallback(
    async (input: {
      removeOptionId: string;
      replacementDefaultOptionId?: string | null;
    }): Promise<boolean> => {
      if (!companyId || !selectedTemplateId || !selectedGraph || structureBusy || savingSectionId) {
        return false;
      }
      setStructureBusy({ kind: "settings-template" });
      setStructureError(null);
      try {
        const result = await removeTemplatePackage({
          companyId,
          templateId: selectedTemplateId,
          graph: selectedGraph,
          removeOptionId: input.removeOptionId,
          replacementDefaultOptionId: input.replacementDefaultOptionId,
        });
        if (!result.ok) {
          setStructureError(result.error);
          return false;
        }
        await reloadSelectedGraph(selectedTemplateId);
        setSelectedPackageOptionId((current) => {
          if (current === input.removeOptionId) return result.optionId;
          return current;
        });
        return true;
      } catch (err) {
        setStructureError(
          err instanceof Error ? err.message : "Could not remove package."
        );
        return false;
      } finally {
        setStructureBusy(null);
      }
    },
    [
      companyId,
      reloadSelectedGraph,
      savingSectionId,
      selectedGraph,
      selectedTemplateId,
      structureBusy,
    ]
  );

  const handleFixIssues = useCallback(() => {
    const problemId = selectedLinkReadiness.firstProblemItemId;
    if (problemId) {
      const item = selectedGraph?.items.find((row) => row.id === problemId);
      if (item) {
        setSelectedPackageOptionId(item.option_id);
        setWorkspaceMode("review");
        window.setTimeout(() => {
          const el = document.querySelector(`[data-templates-catalog-link="${problemId}"]`);
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
          handleOpenRelinkCatalogItem(problemId);
        }, 50);
        return;
      }
    }
    setWorkspaceMode("review");
    window.setTimeout(() => {
      document.querySelector("[data-templates-add-item]")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 50);
  }, [
    handleOpenRelinkCatalogItem,
    selectedGraph?.items,
    selectedLinkReadiness.firstProblemItemId,
  ]);

  const removeConfirmItemName = useMemo(() => {
    if (!removeConfirmItemId || !selectedGraph) return "This item";
    const item = selectedGraph.items.find((row) => row.id === removeConfirmItemId);
    if (!item) return "This item";
    const catalogById = buildCatalogByIdMap(catalogItems);
    return buildTemplateCatalogLinkView(item, catalogById).displayName;
  }, [catalogItems, removeConfirmItemId, selectedGraph]);

  const handleOpenGuidedCreate = useCallback(() => {
    if (dirtySectionCount > 0) return;
    setGuidedCreateError(null);
    setGuidedCreateOpen(true);
  }, [dirtySectionCount]);

  const handleCloseGuidedCreate = useCallback(() => {
    if (guidedCreating) return;
    setGuidedCreateOpen(false);
    setGuidedCreateError(null);
  }, [guidedCreating]);

  const handleGuidedCreate = useCallback(
    (plan: GuidedTemplateCreatePlan) => {
      void (async () => {
        if (guidedCreating) return;
        setGuidedCreating(true);
        setGuidedCreateError(null);
        try {
          const result = await createGuidedProposalTemplate({
            companyId,
            plan,
          });
          if (!result.ok || !result.templateId) {
            setGuidedCreateError(
              result.errors[0] ?? "Could not create the template. Try again."
            );
            return;
          }

          setGuidedCreateOpen(false);
          setWorkspaceMode("review");
          setEditTab("packages");
          setSelectedPackageOptionId(null);
          setFocusSectionId(null);
          setRemoveConfirmItemId(null);
          setAddSectionChoices(null);

          await loadTemplates(result.templateId);
          setSelectedTemplateId(result.templateId);
          if (result.graph) {
            setSelectedGraph(result.graph);
          } else {
            const graph = await getProposalTemplateGraph(result.templateId, { companyId });
            setSelectedGraph(graph);
          }
        } catch (err) {
          console.warn("[TemplatesSetupClient] guided create error:", err);
          setGuidedCreateError("Could not create the template. Try again.");
        } finally {
          setGuidedCreating(false);
        }
      })();
    },
    [companyId, guidedCreating, loadTemplates]
  );

  const handleInstallStarter = useCallback(() => {
    void (async () => {
      if (catalogLoading || templatesLoading || installing || !catalogReady) return;

      setInstalling(true);
      setInstallError(null);
      setInstallMessage(null);
      setInstallResult(null);

      try {
        const result = await installDefaultRoofingProposalTemplates(companyId);
        if (!result) {
          setInstallError("Install failed: invalid company context.");
          return;
        }

        setInstallResult(result);
        const feedback = deriveInstallFeedback(result);
        setInstallMessage(feedback.message);
        setInstallError(feedback.error);

        await Promise.all([loadCatalog(), loadTemplates(selectedTemplateId)]);
      } catch (err) {
        console.warn("[TemplatesSetupClient] install error:", err);
        setInstallError("Install failed unexpectedly.");
      } finally {
        setInstalling(false);
      }
    })();
  }, [
    catalogLoading,
    templatesLoading,
    installing,
    catalogReady,
    companyId,
    loadCatalog,
    loadTemplates,
    selectedTemplateId,
  ]);

  const installDisabled =
    !catalogReady || installing || catalogLoading || templatesLoading;
  const installDisabledTitle = !catalogReady
    ? "Complete catalog setup first"
    : installing
      ? "Installing…"
      : undefined;
  const installButtonLabel = installing
    ? "Installing…"
    : starterInstalled
      ? "Recheck starter template"
      : "Install starter template";

  const starterHero = (
    <TemplatesStarterHeroCard
      loading={loading}
      catalogReady={catalogReady}
      catalogReadiness={catalogReadiness}
      proposalReadiness={proposalReadiness}
      starterInstalled={starterInstalled}
      installButtonLabel={installButtonLabel}
      installDisabled={installDisabled}
      installDisabledTitle={installDisabledTitle}
      onInstallStarter={handleInstallStarter}
      installResult={installResult}
      compact={workspaceActive}
    />
  );

  const catalogPrerequisite = (
    <TemplatesCatalogPrerequisite
      loading={catalogLoading}
      error={catalogError}
      readiness={catalogReadiness}
      catalogReady={catalogReady}
    />
  );

  const addTemplateDisabled = dirtySectionCount > 0 || guidedCreating || installing;
  const addTemplateDisabledTitle =
    dirtySectionCount > 0
      ? "Save or revert unsaved content changes before creating a template."
      : guidedCreating
        ? "Creating template…"
        : installing
          ? "Starter install in progress…"
          : undefined;

  return (
    <div className="mx-auto w-full max-w-[92rem] space-y-4">
      <TemplatesPageHeader
        onAddTemplate={handleOpenGuidedCreate}
        addTemplateDisabled={addTemplateDisabled}
        addTemplateDisabledTitle={addTemplateDisabledTitle}
      />

      <TemplatesPageAlerts
        loadError={loadError}
        installMessage={installMessage}
        installError={installError}
      />

      <TemplatesWorkspaceLayout
        main={
          <div className="space-y-3">
            <TemplatesOnboardingZone
              workspaceActive={workspaceActive}
              setupComplete={
                catalogReady && starterInstalled && !catalogLoading && !templatesLoading
              }
              catalogPrerequisite={catalogPrerequisite}
              starterHero={starterHero}
              recheckLabel={installButtonLabel}
              recheckDisabled={installDisabled}
              recheckDisabledTitle={installDisabledTitle}
              onRecheck={handleInstallStarter}
            />

            <TemplatesLibrarySection
              loading={templatesLoading || installing || graphLoading}
              templates={companyTemplates}
              selectedTemplateId={selectedTemplateId}
              selectedGraph={selectedGraph}
              catalogReady={catalogReady}
              proposalReadiness={proposalReadiness}
              onSelectTemplate={handleSelectTemplate}
              templateSwitchDisabled={dirtySectionCount > 0}
              templateSwitchDisabledReason="Save or revert unsaved content changes before switching templates."
              onArchiveTemplate={handleArchiveTemplate}
              onRestoreTemplate={handleRestoreTemplate}
              lifecycleBusyTemplateId={lifecycleBusyTemplateId}
              lifecycleError={lifecycleError}
              preferredTemplateId={preferredTemplateId}
              onMakePreferred={handleMakePreferred}
              preferenceBusy={preferenceBusy}
              preferenceError={preferenceError}
            />

            {workspaceActive && selectedGraph && contentViewModel && structureViewModel ? (
              <TemplatesSelectedWorkspace
                mode={workspaceMode}
                editTab={editTab}
                onSelectEditTab={handleSelectEditTab}
                onOpenAdvanced={handleOpenAdvanced}
                onBackToReview={handleBackToReview}
                graph={selectedGraph}
                proposalReadiness={proposalReadiness}
                linkReadiness={selectedLinkReadiness}
                packageSummaries={packageSummaries}
                createsSummary={createsSummary}
                structureViewModel={structureViewModel}
                structureBusy={structureBusy}
                structureError={structureError}
                catalogItems={catalogItems}
                selectedPackageOptionId={selectedPackageOptionId}
                onSelectPackage={handleSelectPackage}
                focusSectionId={focusSectionId}
                savingSectionId={savingSectionId}
                onAddItem={handleQuoteAddItem}
                onAddUpgradeItem={handleQuoteAddUpgradeItem}
                onReplaceItem={handleOpenRelinkCatalogItem}
                onRemoveItem={handleRequestRemoveItem}
                onSaveItemQuantity={handleSaveItemQuantity}
                onFixIssues={handleFixIssues}
                onSaveIdentity={handleSaveTemplateIdentity}
                onSavePacketWording={handleSavePacketWording}
                onSavePackages={handleSavePackageAuthorship}
                onCopyPackage={handleCopyPackage}
                onCreateBlankPackage={handleCreateBlankPackage}
                onReorderPackage={handleReorderPackage}
                onRemovePackage={handleRemovePackage}
                onAddSection={handleAddSection}
                onMoveSection={handleMoveSection}
                onSaveTemplateEstimateSettings={handleSaveTemplateEstimateSettings}
                onSaveOptionEstimateSettings={handleSaveOptionEstimateSettings}
                onAddCatalogItemToSection={handleOpenAddCatalogItem}
                onRelinkTemplateItem={handleOpenRelinkCatalogItem}
                isPreferred={
                  preferredTemplateId != null &&
                  selectedTemplateId != null &&
                  preferredTemplateId === selectedTemplateId
                }
                onMakePreferred={
                  selectedTemplateId
                    ? () => handleMakePreferred(selectedTemplateId)
                    : undefined
                }
                onClearPreferred={
                  preferredTemplateId != null &&
                  selectedTemplateId != null &&
                  preferredTemplateId === selectedTemplateId
                    ? handleClearPreferred
                    : undefined
                }
                preferenceBusy={preferenceBusy}
              />
            ) : null}
          </div>
        }
        aside={null}
      />

      <TemplatesCatalogItemPickerModal
        key={
          catalogPicker
            ? `${catalogPicker.mode}:${catalogPicker.sectionId}:${
                catalogPicker.mode === "relink" ? catalogPicker.templateItemId : "add"
              }`
            : "closed"
        }
        open={catalogPicker != null}
        mode={(catalogPicker?.mode ?? "add") as TemplatesCatalogPickerMode}
        catalogItems={catalogItems}
        excludeCatalogItemIds={
          catalogPicker
            ? (() => {
                const ids = catalogItemIdsAlreadyInSection(
                  (selectedGraph?.items ?? []).filter(
                    (row) => row.section_id === catalogPicker.sectionId
                  )
                );
                if (catalogPicker.mode === "relink") {
                  const current = selectedGraph?.items.find(
                    (row) => row.id === catalogPicker.templateItemId
                  );
                  const currentCatalogId = (current?.catalog_item_id ?? "").trim();
                  if (currentCatalogId) ids.delete(currentCatalogId);
                }
                return ids;
              })()
            : undefined
        }
        busy={
          structureBusy?.kind === "add-item" || structureBusy?.kind === "relink-item"
        }
        preferredCompositionRole={
          catalogPicker?.mode === "relink"
            ? selectedGraph?.items.find((row) => row.id === catalogPicker.templateItemId)
                ?.composition_role ?? null
            : null
        }
        onClose={() => {
          if (structureBusy?.kind === "add-item" || structureBusy?.kind === "relink-item") {
            return;
          }
          setCatalogPicker(null);
        }}
        onSelect={handleCatalogPickerSelect}
      />

      <TemplatesAddItemSectionChooser
        open={addSectionChoices != null}
        choices={addSectionChoices ?? []}
        onCancel={() => setAddSectionChoices(null)}
        onChoose={handleChooseAddSection}
      />

      <TemplatesRemoveItemConfirmModal
        open={removeConfirmItemId != null}
        itemName={removeConfirmItemName}
        busy={structureBusy?.kind === "remove-item"}
        onCancel={() => {
          if (structureBusy?.kind === "remove-item") return;
          setRemoveConfirmItemId(null);
        }}
        onConfirm={handleConfirmRemoveItem}
      />

      <TemplatesGuidedCreateOverlay
        open={guidedCreateOpen}
        creating={guidedCreating}
        createError={guidedCreateError}
        onClose={handleCloseGuidedCreate}
        onCreate={handleGuidedCreate}
      />
    </div>
  );
}
