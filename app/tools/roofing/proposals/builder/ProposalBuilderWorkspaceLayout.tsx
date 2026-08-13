import type { ReactNode } from "react";
import { BUILDER_STAGE } from "./proposalBuilderConstants";

type ProposalBuilderWorkspaceLayoutProps = {
  /**
   * Document-attached page switcher (Cover | Estimate | …).
   * Not a left rail — Job Card tab continuity.
   */
  sectionNav?: ReactNode;
  canvas: ReactNode;
};

/**
 * Shared Builder workspace: command-bar width + one continuous document surface.
 * Page switcher sits on the document; no dashboard card shell.
 */
export default function ProposalBuilderWorkspaceLayout({
  sectionNav = null,
  canvas,
}: ProposalBuilderWorkspaceLayoutProps) {
  return (
    <div
      className={BUILDER_STAGE}
      data-builder-document-led="true"
      data-builder-workspace-attached="true"
      data-builder-workspace-wide="true"
    >
      <div
        className="min-w-0 overflow-visible border-t border-slate-200/80 bg-white"
        data-builder-workspace-shell
      >
        {sectionNav}
        <div className="min-w-0" data-builder-document-canvas>
          {canvas}
        </div>
      </div>
    </div>
  );
}
