import type { ReactNode } from "react";
import { BUILDER_STAGE } from "./proposalBuilderConstants";

type ProposalBuilderWorkspaceLayoutProps = {
  pageContextStrip?: ReactNode;
  canvas: ReactNode;
  summaryRail: ReactNode;
};

export default function ProposalBuilderWorkspaceLayout({
  pageContextStrip,
  canvas,
  summaryRail,
}: ProposalBuilderWorkspaceLayoutProps) {
  return (
    <div className={`${BUILDER_STAGE} space-y-5`}>
      {pageContextStrip ? <div className="min-w-0 w-full">{pageContextStrip}</div> : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_330px] 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">{canvas}</div>
        <aside className="min-w-0 xl:sticky xl:top-6 xl:self-start">{summaryRail}</aside>
      </div>
    </div>
  );
}
