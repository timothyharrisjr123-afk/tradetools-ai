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
      className={`${BUILDER_STAGE} space-y-5`}
      data-builder-document-led="true"
    >
      <div
        className={
          leftNav
            ? showRail
              ? "grid grid-cols-1 gap-6 lg:grid-cols-[11.5rem_minmax(0,1fr)_300px] xl:grid-cols-[12.5rem_minmax(0,1fr)_310px]"
              : "grid grid-cols-1 gap-6 lg:grid-cols-[11.5rem_minmax(0,1fr)] xl:grid-cols-[12.5rem_minmax(0,48rem)] xl:justify-center"
            : showRail
              ? "grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_330px]"
              : "mx-auto w-full max-w-3xl"
        }
      >
        {leftNav ? (
          <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start" data-builder-section-nav-slot>
            {leftNav}
          </aside>
        ) : null}

        <div className="min-w-0" data-builder-document-canvas>
          {canvas}
        </div>

        {showRail ? (
          <aside className="min-w-0 xl:sticky xl:top-6 xl:self-start">{summaryRail}</aside>
        ) : null}
      </div>
    </div>
  );
}
