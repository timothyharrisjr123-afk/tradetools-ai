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
import {
  buildCatalogByIdMap,
  catalogItemIdsAlreadyInSection,
  defaultItemRoleForSectionKind,
  deriveTemplateCatalogLinkReadiness,
  extractCatalogSeedKey,
  nextTemplateItemSortOrder,
  sectionAcceptsCatalogItems,
} from "@/app/lib/proposalTemplateCatalogLink";
import { deriveProposalTemplateReadiness } from "@/app/lib/proposalTemplateReadiness";
import {
  getProposalTemplateGraph,
  getProposalTemplatesByCompany,
  createProposalTemplateItem,
  createProposalTemplateSection,
  updateProposalTemplate,
  updateProposalTemplateItem,
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
import TemplatesBuilderFootnote from "./TemplatesBuilderFootnote";
import TemplatesCatalogItemPickerModal, {
  type TemplatesCatalogPickerMode,
} from "./TemplatesCatalogItemPickerModal";
import TemplatesCatalogPrerequisite from "./TemplatesCatalogPrerequisite";
import TemplatesLibrarySection from "./TemplatesLibrarySection";
import TemplatesOnboardingZone from "./TemplatesOnboardingZone";
import TemplatesPageAlerts from "./TemplatesPageAlerts";
import TemplatesPageHeader from "./TemplatesPageHeader";
import TemplatesSelectedWorkspace from "./TemplatesSelectedWorkspace";
import TemplatesStarterHeroCard from "./TemplatesStarterHeroCard";
import TemplatesWorkspaceLayout from "./TemplatesWorkspaceLayout";
import { deriveInstallFeedback, findStarterProposalTemplate } from "./templatesSetupUtils";
import {
  buildWorkspaceContentViewModel,
  isTemplateWorkspaceActive,
  resolveDefaultSelectedTemplateId,
} from "./templatesWorkspaceUtils";
import { buildSectionContentSavePatch } from "./templatesContentEditorUtils";
import {
  buildWorkspaceStructureViewModel,
  computeReorderedSectionIds,
  getOrderedSectionIdsForOption,
} from "./templatesStructureEditorUtils";
import {
  buildTemplateCreatesSummary,
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
  const [sectionSaveError, setSectionSaveError] = useState<SectionSaveError | null>(null);
  const [dirtySectionCount, setDirtySectionCount] = useState(0);

  const [structureBusy, setStructureBusy] = useState<StructureSettingsBusy>(null);
  const [structureError, setStructureError] = useState<string | null>(null);
  const [catalogPicker, setCatalogPicker] = useState<CatalogPickerState>(null);
  const [workspaceMode, setWorkspaceMode] = useState<TemplatesWorkspaceMode>("use");
  const [editTab, setEditTab] = useState<TemplatesEditTabId>("packages");
  const [focusSectionId, setFocusSectionId] = useState<string | null>(null);

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
        const templates = await getProposalTemplatesByCompany(companyId);
        setCompanyTemplates(templates);

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
        setWorkspaceMode("use");
        setEditTab("packages");
        setFocusSectionId(null);
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

  const handleSaveSection = useCallback(
    (args: { sectionId: string; optionId: string; draftBody: string }) => {
      void (async () => {
        if (!selectedGraph || !selectedTemplateId || savingSectionId) return;

        const section = selectedGraph.sections.find((row) => row.id === args.sectionId);
        if (!section) {
          setSectionSaveError({
            sectionId: args.sectionId,
            message: "Could not find the section to save.",
          });
          return;
        }

        setSavingSectionId(args.sectionId);
        setSectionSaveError(null);

        try {
          const content = buildSectionContentSavePatch(section.content, args.draftBody);
          const updated = await updateProposalTemplateSection(
            args.sectionId,
            { content },
            {
              companyId,
              templateId: selectedTemplateId,
              optionId: args.optionId,
            }
          );

          if (!updated) {
            setSectionSaveError({
              sectionId: args.sectionId,
              message: "Could not save this section. Try again.",
            });
            return;
          }

          await reloadSelectedGraph(selectedTemplateId);
        } catch (err) {
          console.warn("[TemplatesSetupClient] section save error:", err);
          setSectionSaveError({
            sectionId: args.sectionId,
            message: "Save failed unexpectedly.",
          });
        } finally {
          setSavingSectionId(null);
        }
      })();
    },
    [
      companyId,
      reloadSelectedGraph,
      savingSectionId,
      selectedGraph,
      selectedTemplateId,
    ]
  );

  const handleDirtySectionCountChange = useCallback((count: number) => {
    setDirtySectionCount(count);
  }, []);

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

        const seedKey = extractCatalogSeedKey(catalogItem);

        if (catalogPicker.mode === "add") {
          setStructureBusy({ kind: "add-item", sectionId: catalogPicker.sectionId });
          setStructureError(null);
          try {
            const created = await createProposalTemplateItem(
              {
                template_id: selectedTemplateId,
                option_id: catalogPicker.optionId,
                section_id: catalogPicker.sectionId,
                catalog_item_id: catalogItem.id,
                catalog_seed_key: seedKey,
                item_role: defaultItemRoleForSectionKind(section.kind),
                customer_visibility: "inherit_catalog",
                sort_order: nextTemplateItemSortOrder(sectionItems),
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

        setStructureBusy({ kind: "relink-item", itemId: catalogPicker.templateItemId });
        setStructureError(null);
        try {
          const updated = await updateProposalTemplateItem(
            catalogPicker.templateItemId,
            {
              catalog_item_id: catalogItem.id,
              catalog_seed_key: seedKey,
            },
            {
              companyId,
              templateId: selectedTemplateId,
              optionId: catalogPicker.optionId,
              sectionId: catalogPicker.sectionId,
            }
          );
          if (!updated) {
            setStructureError("Could not change Catalog link. Try again.");
            return;
          }
          setCatalogPicker(null);
          await reloadSelectedGraph(selectedTemplateId);
        } catch (err) {
          console.warn("[TemplatesSetupClient] relink catalog item error:", err);
          setStructureError("Changing Catalog link failed unexpectedly.");
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

  const handleSelectEditTab = useCallback((tab: TemplatesEditTabId) => {
    setEditTab(tab);
    if (tab !== "packages") {
      setFocusSectionId(null);
    }
  }, []);

  const handleEnterEditMode = useCallback((tab: TemplatesEditTabId = "packages") => {
    setWorkspaceMode("edit");
    setEditTab(tab);
    if (tab !== "packages") {
      setFocusSectionId(null);
    }
  }, []);

  const handleBackToSummary = useCallback(() => {
    setWorkspaceMode("use");
    setFocusSectionId(null);
  }, []);

  const handleFixCatalogLinks = useCallback(() => {
    setWorkspaceMode("edit");
    setEditTab("packages");
    const problemId = selectedLinkReadiness.firstProblemItemId;
    if (problemId) {
      const item = selectedGraph?.items.find((row) => row.id === problemId);
      setFocusSectionId(item?.section_id ?? null);
      // Allow Packages edit tab to mount before scrolling / opening relink.
      window.setTimeout(() => {
        const el = document.querySelector(`[data-templates-catalog-link="${problemId}"]`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        handleOpenRelinkCatalogItem(problemId);
      }, 50);
      return;
    }
    setFocusSectionId(null);
    window.setTimeout(() => {
      const firstAdd = document.querySelector("[data-templates-add-from-catalog]");
      firstAdd?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }, [
    handleOpenRelinkCatalogItem,
    selectedGraph?.items,
    selectedLinkReadiness.firstProblemItemId,
  ]);

  const handleAddCatalogItemsCta = useCallback(() => {
    setWorkspaceMode("edit");
    setEditTab("packages");
    setFocusSectionId(null);
    window.setTimeout(() => {
      const firstAdd = document.querySelector("[data-templates-add-from-catalog]");
      firstAdd?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }, []);

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

  return (
    <div className="mx-auto w-full max-w-[92rem] space-y-6">
      <TemplatesPageHeader />

      <TemplatesPageAlerts
        loadError={loadError}
        installMessage={installMessage}
        installError={installError}
      />

      <TemplatesWorkspaceLayout
        main={
          <div className="space-y-5">
            <TemplatesOnboardingZone
              workspaceActive={workspaceActive}
              catalogPrerequisite={catalogPrerequisite}
              starterHero={starterHero}
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
            />

            {workspaceActive && selectedGraph && contentViewModel && structureViewModel ? (
              <TemplatesSelectedWorkspace
                mode={workspaceMode}
                editTab={editTab}
                onSelectEditTab={handleSelectEditTab}
                onEnterEditMode={handleEnterEditMode}
                onBackToSummary={handleBackToSummary}
                graph={selectedGraph}
                proposalReadiness={proposalReadiness}
                linkReadiness={selectedLinkReadiness}
                packageSummaries={packageSummaries}
                createsSummary={createsSummary}
                contentViewModel={contentViewModel}
                structureViewModel={structureViewModel}
                structureBusy={structureBusy}
                structureError={structureError}
                catalogItems={catalogItems}
                focusSectionId={focusSectionId}
                savingSectionId={savingSectionId}
                sectionSaveError={sectionSaveError}
                onFixLinks={handleFixCatalogLinks}
                onAddCatalogItems={handleAddCatalogItemsCta}
                onAddSection={handleAddSection}
                onMoveSection={handleMoveSection}
                onSaveTemplateEstimateSettings={handleSaveTemplateEstimateSettings}
                onSaveOptionEstimateSettings={handleSaveOptionEstimateSettings}
                onAddCatalogItemToSection={handleOpenAddCatalogItem}
                onRelinkTemplateItem={handleOpenRelinkCatalogItem}
                onSaveSection={handleSaveSection}
                onDirtySectionCountChange={handleDirtySectionCountChange}
              />
            ) : null}
          </div>
        }
        aside={null}
      />

      <TemplatesBuilderFootnote />

      <TemplatesCatalogItemPickerModal
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
        onClose={() => {
          if (structureBusy?.kind === "add-item" || structureBusy?.kind === "relink-item") {
            return;
          }
          setCatalogPicker(null);
        }}
        onSelect={handleCatalogPickerSelect}
      />
    </div>
  );
}
