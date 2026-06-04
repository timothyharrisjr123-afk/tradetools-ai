import type { ReactNode } from "react";

type ProposalBuilderWorkspaceLayoutProps = {
  sectionNav: ReactNode;
  canvas: ReactNode;
  summaryRail: ReactNode;
};

export default function ProposalBuilderWorkspaceLayout({
  sectionNav,
  canvas,
  summaryRail,
}: ProposalBuilderWorkspaceLayoutProps) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[12rem_minmax(0,1fr)_17rem]">
      <nav className="min-w-0 space-y-1 xl:sticky xl:top-6 xl:self-start" aria-label="Proposal sections">
        {sectionNav}
      </nav>
      <div className="min-w-0">{canvas}</div>
      <aside className="min-w-0 space-y-4 xl:sticky xl:top-6 xl:self-start">{summaryRail}</aside>
    </div>
  );
}
