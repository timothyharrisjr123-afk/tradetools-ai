import type { Metadata } from "next";
import { loadPublicProposalByToken } from "@/app/lib/proposalPublicAccessOrchestrator.server";
import PublicProposalErrorPage from "./PublicProposalErrorPage";
import PublicProposalPage from "./PublicProposalPage";

export const metadata: Metadata = {
  title: "Proposal",
  description: "Review your roofing proposal.",
  robots: {
    index: false,
    follow: false,
  },
};

type PublicProposalRoutePageProps = {
  params: Promise<{ token: string }>;
};

export default async function PublicProposalRoutePage({ params }: PublicProposalRoutePageProps) {
  const { token } = await params;

  const result = await loadPublicProposalByToken(token);

  if (!result.ok) {
    return <PublicProposalErrorPage error={result.error} />;
  }

  // Server-only view envelope stays on the server; only document is rendered.
  return <PublicProposalPage document={result.document} publicAccessToken={token} />;
}
