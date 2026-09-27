import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { InvitationJoinScreen } from "@/app/join/InvitationJoinScreen";
import { buildInvitationJoinView, parseInvitationOutcome } from "@/app/lib/invitations/invitationModel";
import { previewMyInvitation } from "@/app/lib/invitations/invitationActions.server";
import { buildLoginHrefWithReturn } from "@/app/lib/safeInternalRedirect";
import { createClient } from "@/app/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Invitation",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function JoinOpenPage({
  params,
  searchParams,
}: {
  params: Promise<{ invitationId: string }>;
  searchParams: Promise<{ outcome?: string }>;
}) {
  const { invitationId } = await params;
  const query = await searchParams;
  const returnPath = `/join/open/${invitationId}`;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(buildLoginHrefWithReturn(returnPath));

  const outcome = parseInvitationOutcome(query.outcome);
  const preview = UUID.test(invitationId)
    ? await previewMyInvitation(invitationId)
    : {
        state: "not_found" as const,
        companyLabel: null,
        role: null,
        expiresAt: null,
        inviterDisplayName: null,
        recipientEmail: null,
        hasAdditionalAccess: false,
        packageKeys: [],
        acceptedBySelf: false,
      };
  const view = buildInvitationJoinView({
    preview,
    viewer: {
      signedIn: true,
      email: user.email ?? null,
      emailVerified: Boolean(user.email_confirmed_at),
    },
    outcome,
    token: null,
    invitationId: UUID.test(invitationId) ? invitationId : null,
    returnPath,
  });
  return <InvitationJoinScreen view={view} retryHref={returnPath} />;
}
