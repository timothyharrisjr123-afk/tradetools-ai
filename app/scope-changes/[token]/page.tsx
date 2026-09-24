import type { Metadata } from "next";
import PublicScopeChangeReviewClient from "./PublicScopeChangeReviewClient";

export const metadata: Metadata = {
  title: "Scope change",
  description: "Review and approve a scope change to your agreement.",
  robots: {
    index: false,
    follow: false,
  },
};

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function PublicScopeChangePage({ params }: PageProps) {
  const { token } = await params;
  return <PublicScopeChangeReviewClient token={token} />;
}
