import { CreateBusinessForm } from "@/app/start/CreateBusinessForm";
import { resolveCurrentUserAccess } from "@/app/lib/access/resolveAccess";
import { COMPANY_MEMBERSHIP_ROLE_LABELS } from "@/app/lib/companyMembershipRoles";
import { SignOutButton } from "@/app/components/auth/SignOutButton";
import { createClient } from "@/app/lib/supabase/server";
import { redirect } from "next/navigation";
import FieldDiveLogoMark from "@/app/components/brand/FieldDiveLogoMark";
import {
  APP_PAGE_BG,
  ENTRY_CARD,
  ENTRY_PRIMARY_ACTION,
  ENTRY_SECONDARY_ACTION,
} from "@/app/components/ui/surfaceStyles";

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
    <main className={`min-h-screen ${APP_PAGE_BG} px-4 py-12 text-slate-900 sm:py-16`}>
      <div className="mx-auto flex max-w-md flex-col justify-center">
        <div className={ENTRY_CARD}>
          <div className="flex items-center gap-2.5">
            <FieldDiveLogoMark />
            <p className="text-lg font-bold tracking-tight text-slate-900">FieldDive</p>
          </div>
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-slate-900">{heading}</h1>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{body}</p>

          {access.state === "pending_invitation" ? (
            <ul className="mt-5 divide-y divide-slate-100 border-t border-slate-100">
              {access.invitations.map((invitation) => (
                <li key={invitation.id} className="py-4">
                  <p className="text-sm font-semibold text-slate-900">{invitation.companyLabel}</p>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {roleLabel(invitation.role)}
                    <span className="text-slate-400"> · </span>
                    Expires{" "}
                    {new Date(invitation.expiresAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      timeZone: "UTC",
                    })}
                  </p>
                  <a href={`/join/open/${invitation.id}`} className={`mt-3 ${ENTRY_PRIMARY_ACTION}`}>
                    Review invitation
                  </a>
                </li>
              ))}
            </ul>
          ) : null}

          {access.state === "creator_eligible" ? <CreateBusinessForm acknowledgePendingInvitations={false} /> : null}

          {access.state === "pending_invitation" && access.creatorEligible ? (
            <div className="mt-6 border-t border-slate-100 pt-5">
              <p className="text-sm text-slate-600">
                You can create a new business instead. That does not accept the invitation, and this account can only belong to one company.
              </p>
              <CreateBusinessForm acknowledgePendingInvitations secondary />
            </div>
          ) : null}

          {access.state === "authorization_unavailable" ? (
            <a href="/start" className={`mt-6 ${ENTRY_PRIMARY_ACTION}`}>
              Try again
            </a>
          ) : null}

          <div className="mt-6">
            <SignOutButton className={ENTRY_SECONDARY_ACTION} />
          </div>
        </div>
      </div>
    </main>
  );
}
