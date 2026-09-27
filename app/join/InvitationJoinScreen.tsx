import type { InvitationJoinView } from "@/app/lib/invitations/invitationModel";
import { SwitchAccountButton } from "@/app/join/SwitchAccountButton";

export function InvitationJoinScreen({
  view,
  retryHref,
}: {
  view: InvitationJoinView;
  retryHref: string;
}) {
  return (
    <main className="min-h-screen bg-[#070A12] text-white">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">{view.heading}</h1>
        <p className="mt-3 text-sm leading-6 text-white/70">{view.body}</p>
        {view.companyLabel || view.roleLabel || view.accessSummary || view.expiryLabel || view.inviterLabel ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            {view.companyLabel ? <p className="text-sm font-medium">{view.companyLabel}</p> : null}
            {view.roleLabel ? <p className="mt-1 text-sm text-white/80">{view.roleLabel}</p> : null}
            {view.accessSummary ? <p className="mt-1 text-sm text-white/70">{view.accessSummary}</p> : null}
            {view.expiryLabel ? <p className="mt-1 text-xs text-white/60">{view.expiryLabel}</p> : null}
            {view.inviterLabel ? <p className="mt-1 text-xs text-white/60">{view.inviterLabel}</p> : null}
          </div>
        ) : null}
        {view.showAccept ? (
          <form method="post" action="/api/invitations/accept" className="mt-6">
            {view.acceptToken ? <input type="hidden" name="token" value={view.acceptToken} /> : null}
            {view.acceptInvitationId ? (
              <input type="hidden" name="invitationId" value={view.acceptInvitationId} />
            ) : null}
            <button
              type="submit"
              className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950"
            >
              Accept invitation
            </button>
          </form>
        ) : null}
        {view.continueHref ? (
          <a href={view.continueHref} className="mt-6 inline-block text-sm font-medium text-emerald-300">
            Continue
          </a>
        ) : null}
        {view.signInHref ? (
          <p className="mt-6 text-sm text-white/70">
            <a href={view.signInHref} className="font-medium text-emerald-300">
              Sign in
            </a>
            {view.signUpHref ? (
              <>
                {" "}
                or{" "}
                <a href={view.signUpHref} className="font-medium text-emerald-300">
                  create an account
                </a>
              </>
            ) : null}
          </p>
        ) : null}
        {view.switchAccountHref ? <SwitchAccountButton href={view.switchAccountHref} /> : null}
        {view.heading === "We couldn't verify this invitation" ? (
          <a href={retryHref} className="mt-6 inline-block text-sm font-medium text-emerald-300">
            Try again
          </a>
        ) : null}
      </div>
    </main>
  );
}
