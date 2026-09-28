import type { InvitationJoinView } from "@/app/lib/invitations/invitationModel";
import { SwitchAccountButton } from "@/app/join/SwitchAccountButton";
import FieldDiveLogoMark from "@/app/components/brand/FieldDiveLogoMark";
import {
  APP_PAGE_BG,
  ENTRY_CARD,
  ENTRY_PRIMARY_ACTION,
  ENTRY_SECONDARY_ACTION,
} from "@/app/components/ui/surfaceStyles";

export function InvitationJoinScreen({
  view,
  retryHref,
}: {
  view: InvitationJoinView;
  retryHref: string;
}) {
  const details = view.companyLabel || view.roleLabel || view.accessSummary || view.expiryLabel || view.inviterLabel;
  return (
    <main className={`min-h-screen ${APP_PAGE_BG} px-4 py-12 text-slate-900 sm:py-16`}>
      <div className="mx-auto flex max-w-md flex-col justify-center">
        <div className={ENTRY_CARD}>
          <div className="flex items-center gap-2.5">
            <FieldDiveLogoMark />
            <p className="text-lg font-bold tracking-tight text-slate-900">FieldDive</p>
          </div>
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-slate-900">{view.heading}</h1>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{view.body}</p>
          {details ? (
            <div className="mt-5 space-y-1 border-t border-slate-100 pt-4" data-join-invitation-details>
              {view.companyLabel ? (
                <p className="text-sm font-semibold text-slate-900">{view.companyLabel}</p>
              ) : null}
              {view.roleLabel ? <p className="text-sm text-slate-700">{view.roleLabel}</p> : null}
              {view.accessSummary ? <p className="text-sm text-slate-600">{view.accessSummary}</p> : null}
              {view.expiryLabel || view.inviterLabel ? (
                <p className="text-xs text-slate-500">
                  {[view.inviterLabel, view.expiryLabel].filter(Boolean).join(" · ")}
                </p>
              ) : null}
            </div>
          ) : null}
          {view.showAccept ? (
            <form method="post" action="/api/invitations/accept" className="mt-6">
              {view.acceptToken ? <input type="hidden" name="token" value={view.acceptToken} /> : null}
              {view.acceptInvitationId ? (
                <input type="hidden" name="invitationId" value={view.acceptInvitationId} />
              ) : null}
              <button type="submit" className={ENTRY_PRIMARY_ACTION}>
                Accept invitation
              </button>
            </form>
          ) : null}
          {view.continueHref ? (
            <a href={view.continueHref} className={`mt-6 ${ENTRY_PRIMARY_ACTION}`}>
              Continue
            </a>
          ) : null}
          {view.signInHref ? (
            <div className="mt-6 space-y-3">
              <a href={view.signInHref} className={ENTRY_PRIMARY_ACTION}>
                Sign in
              </a>
              {view.signUpHref ? (
                <p className="text-center text-sm text-slate-600">
                  New to FieldDive?{" "}
                  <a href={view.signUpHref} className="font-medium text-blue-700 hover:text-blue-800">
                    Create an account
                  </a>
                </p>
              ) : null}
            </div>
          ) : null}
          {view.switchAccountHref ? <SwitchAccountButton href={view.switchAccountHref} /> : null}
          {view.heading === "We couldn't verify this invitation" ? (
            <a href={retryHref} className={`mt-6 ${ENTRY_SECONDARY_ACTION}`}>
              Try again
            </a>
          ) : null}
        </div>
      </div>
    </main>
  );
}
