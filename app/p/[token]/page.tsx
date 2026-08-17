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
  searchParams?: Promise<{ payment?: string }>;
};

export default async function PublicProposalRoutePage({
  params,
  searchParams,
}: PublicProposalRoutePageProps) {
  const { token } = await params;
  const query = searchParams ? await searchParams : {};
  const paymentHint =
    query.payment === "pending" || query.payment === "cancelled"
      ? query.payment
      : null;

  const result = await loadPublicProposalByToken(token);

  if (!result.ok) {
    return <PublicProposalErrorPage error={result.error} />;
  }

  return (
    <PublicProposalPage
      document={result.document}
      publicAccessToken={token}
      paymentReturnHint={paymentHint}
    />
  );
}
