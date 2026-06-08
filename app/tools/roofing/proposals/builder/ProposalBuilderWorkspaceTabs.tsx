"use client";

import {
  BUILDER_WORKSPACE_SECTIONS,
  type BuilderWorkspaceSectionId,
} from "@/app/lib/proposalBuilderNavigation";
import {
  BUILDER_WORKSPACE_TAB_ACTIVE,
  BUILDER_WORKSPACE_TAB_IDLE,
  BUILDER_WORKSPACE_TABS,
} from "./proposalBuilderConstants";

type ProposalBuilderWorkspaceTabsProps = {
  activeSection: BuilderWorkspaceSectionId;
  onSelectSection: (section: BuilderWorkspaceSectionId) => void;
};

export default function ProposalBuilderWorkspaceTabs({
  activeSection,
  onSelectSection,
}: ProposalBuilderWorkspaceTabsProps) {
  return (
    <div className={BUILDER_WORKSPACE_TABS}>
      <div className="flex gap-2 overflow-x-auto pb-px" role="tablist" aria-label="Builder workspace">
        {BUILDER_WORKSPACE_SECTIONS.map((section) => {
          const active = section.id === activeSection;
          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelectSection(section.id)}
              className={`shrink-0 border-b-2 px-5 py-3.5 text-sm transition ${
                active ? BUILDER_WORKSPACE_TAB_ACTIVE : BUILDER_WORKSPACE_TAB_IDLE
              }`}
            >
              {section.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
