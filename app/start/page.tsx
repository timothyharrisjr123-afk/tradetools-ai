import { CreateBusinessForm } from "@/app/start/CreateBusinessForm";
import { resolveCurrentUserAccess } from "@/app/lib/access/resolveAccess";
import { COMPANY_MEMBERSHIP_ROLE_LABELS } from "@/app/lib/companyMembershipRoles";
import { SignOutButton } from "@/app/components/auth/SignOutButton";
import { createClient } from "@/app/lib/supabase/server";
import { redirect } from "next/navigation";

function roleLabel(role: string): string {
  if (role in COMPANY_MEMBERSHIP_ROLE_LABELS) {
    return COMPANY_MEMBERSHIP_ROLE_LABELS[role as keyof typeof COMPANY_MEMBERSHIP_ROLE_LABELS];
  }
  return "Member";
}

export default async function StartPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/start");

  const access = await resolveCurrentUserAccess(supabase);
  if (access.state === "active") redirect("/tools/roofing/saved");

  let heading = "You don't have access yet";
  let body = "This account isn't a member of a company, and it doesn't have an invitation or permission to create one.";

  if (access.state === "no_access") {
    heading = "You don't have access yet";
    body = "This account isn't a member of a company, and it doesn't have an invitation or permission to create one.";
  } else if (access.state === "disabled") {
    heading = "Your access has been removed";
    body = access.companyLabel
      ? `Your access to ${access.companyLabel} has been removed.`
      : "Your access to this company has been removed.";
  } else if (access.state === "invalid_role") {
    heading = "Your access needs attention";
    body = "This account's access couldn't be recognized. Contact support. Nothing here will change it automatically.";
  } else if (access.state === "pending_invitation") {
    heading = "You have an invitation";
    body = "Choose an invitation to review it. Accepting happens on the next screen, not when this page opens. Creating a business does not accept an invitation.";
  } else if (access.state === "creator_eligible") {
    heading = "Create your business";
    body = "Creating a business makes this account its owner. It does not join an existing company.";
  } else if (access.state === "authorization_unavailable") {
    heading = "We couldn't verify your access";
    body = "This is a temporary problem, not a lack of access. Try again.";
  }

  return (
    <main className="min-h-screen bg-[#070A12] text-white">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
        <p className="mt-3 text-sm leading-6 text-white/70">{body}</p>

        {access.state === "pending_invitation" ? (
          <ul className="mt-6 space-y-3">
            {access.invitations.map((invitation) => (
              <li key={invitation.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-sm font-medium">{invitation.companyLabel}</p>
                <p className="mt-1 text-xs text-white/60">
                  {roleLabel(invitation.role)} · expires {new Date(invitation.expiresAt).toLocaleDateString()}
                </p>
                <a
                  href={`/join/open/${invitation.id}`}
                  className="mt-3 inline-block text-sm font-medium text-emerald-300"
                >
                  Review invitation
                </a>
              </li>
            ))}
          </ul>
        ) : null}

        {access.state === "creator_eligible" ? <CreateBusinessForm acknowledgePendingInvitations={false} /> : null}

        {access.state === "pending_invitation" && access.creatorEligible ? (
          <div className="mt-8 border-t border-white/10 pt-6">
            <p className="text-sm text-white/70">
              You can create a new business instead. That does not accept the invitation, and this account can only belong to one company.
            </p>
            <CreateBusinessForm acknowledgePendingInvitations />
          </div>
        ) : null}

        {access.state === "authorization_unavailable" ? (
          <a href="/start" className="mt-6 inline-block text-sm font-medium text-emerald-300">
            Try again
          </a>
        ) : null}

        <div className="mt-8">
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}
