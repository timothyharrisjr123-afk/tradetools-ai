import type { ReactNode } from "react";
import { BUILDER_STAGE } from "./proposalBuilderConstants";

type ProposalBuilderWorkspaceLayoutProps = {
  /**
   * Top proposal section bar (Cover | Estimate | …).
   * Not a left rail — Job Card tab continuity.
   */
  sectionNav?: ReactNode;
  /** @deprecated Prefer sectionNav as top bar. */
  pageContextStrip?: ReactNode;
  canvas: ReactNode;
  /** Optional right rail — omitted on document-led Estimate path. */
  summaryRail?: ReactNode | null;
};

/**
 * Shared Builder workspace: header/stage width + attached shell.
 * Section bar sits above the canvas (no forced left sidebar).
 */
export default function ProposalBuilderWorkspaceLayout({
  sectionNav,
  pageContextStrip,
  canvas,
  summaryRail = null,
}: ProposalBuilderWorkspaceLayoutProps) {
  const topBar = sectionNav ?? pageContextStrip ?? null;
  const showRail = Boolean(summaryRail);

  return (
    <div
      className={BUILDER_STAGE}
      data-builder-document-led="true"
      data-builder-workspace-attached="true"
      data-builder-workspace-wide="true"
    >
      {showRail ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
          <div
            className="min-w-0 overflow-visible rounded-xl border border-slate-200/70 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.055)]"
            data-builder-workspace-shell
          >
            {topBar}
            <div className="min-w-0" data-builder-document-canvas>
              {canvas}
            </div>
          </div>
          <aside className="min-w-0 xl:sticky xl:top-6 xl:self-start">{summaryRail}</aside>
        </div>
      ) : (
        <div
          className="min-w-0 overflow-visible rounded-xl border border-slate-200/70 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.055)]"
          data-builder-workspace-shell
        >
          {topBar}
          <div className="min-w-0" data-builder-document-canvas>
            {canvas}
          </div>
        </div>
      )}
    </div>
  );
}
