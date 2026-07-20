import type { ReactNode } from "react";
import { BUILDER_STAGE } from "./proposalBuilderConstants";

type ProposalBuilderWorkspaceLayoutProps = {
  /** Left document section list (Cover / Estimate / Terms …). */
  sectionNav?: ReactNode;
  /** @deprecated Block 4B — horizontal strip replaced by sectionNav. */
  pageContextStrip?: ReactNode;
  canvas: ReactNode;
  /** Optional right rail — omitted on document-led Estimate path. */
  summaryRail?: ReactNode | null;
};

/**
 * Block 4C — section rail + estimate canvas share one attached workspace shell
 * so the editor does not float as a narrow island with dead gutters.
 */
export default function ProposalBuilderWorkspaceLayout({
  sectionNav,
  pageContextStrip,
  canvas,
  summaryRail = null,
}: ProposalBuilderWorkspaceLayoutProps) {
  const leftNav = sectionNav ?? pageContextStrip ?? null;
  const showRail = Boolean(summaryRail);

  return (
    <div
      className={`${BUILDER_STAGE}`}
      data-builder-document-led="true"
      data-builder-workspace-attached="true"
    >
      {leftNav ? (
        <div
          className={
            showRail
              ? "grid grid-cols-1 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)] lg:grid-cols-[10.75rem_minmax(0,1fr)_280px]"
              : "grid grid-cols-1 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)] lg:grid-cols-[10.75rem_minmax(0,1fr)]"
          }
          data-builder-workspace-shell
        >
          <aside
            className="min-w-0 border-b border-slate-200/80 bg-slate-50/50 lg:border-b-0 lg:border-r lg:border-slate-200/80"
            data-builder-section-nav-slot
          >
            {leftNav}
          </aside>

          <div className="min-w-0" data-builder-document-canvas>
            {canvas}
          </div>

          {showRail ? (
            <aside className="min-w-0 border-t border-slate-200/80 lg:border-l lg:border-t-0">
              {summaryRail}
            </aside>
          ) : null}
        </div>
      ) : showRail ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="min-w-0" data-builder-document-canvas>
            {canvas}
          </div>
          <aside className="min-w-0 xl:sticky xl:top-6 xl:self-start">{summaryRail}</aside>
        </div>
      ) : (
        <div className="min-w-0" data-builder-document-canvas>
          {canvas}
        </div>
      )}
    </div>
  );
}
