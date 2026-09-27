import type { Metadata } from "next";
import { InvitationJoinScreen } from "@/app/join/InvitationJoinScreen";
import { buildInvitationJoinView, parseInvitationOutcome } from "@/app/lib/invitations/invitationModel";
import { previewInvitationToken } from "@/app/lib/invitations/invitationActions.server";
import { decodeInvitationToken } from "@/app/lib/invitations/invitationToken";
import { createClient } from "@/app/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Invitation",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default async function JoinTokenPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ outcome?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const outcome = parseInvitationOutcome(query.outcome);
  const preview = await previewInvitationToken(token);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const returnPath = `/join/${token}`;
  const view = buildInvitationJoinView({
    preview,
    viewer: {
      signedIn: Boolean(user),
      email: user?.email ?? null,
      emailVerified: Boolean(user?.email_confirmed_at),
    },
    outcome,
    token: decodeInvitationToken(token) ? token : null,
    invitationId: null,
    returnPath,
  });
  return <InvitationJoinScreen view={view} retryHref={returnPath} />;
}
