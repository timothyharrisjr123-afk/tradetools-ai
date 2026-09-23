import Link from "next/link";
import { ensureUserIdentity, getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import { createClient } from "@/app/lib/supabase/server";
import { redirect } from "next/navigation";

/**
 * Phase 3 — /admin/customers write shelf retired.
 * Canonical customer birth: New job packet + Job Card (customerStore).
 * Page remains reachable by bookmark as informational only (no insert/delete).
 */
export default async function CustomersRetiredPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?redirectTo=/admin/customers");
  }
  await ensureUserIdentity(supabase, user);
  const companyId = await getUserCompanyId(supabase, user.id);
  if (!companyId) {
    redirect("/login?redirectTo=/admin/customers");
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-10 text-slate-900">
      <div
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        data-admin-customers-retired
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          FieldDive
        </p>
        <h1 className="mt-2 text-xl font-semibold">Customer admin shelf retired</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Creating or editing customers from this admin page is retired so FieldDive
          keeps one customer identity path. Start customers from{" "}
          <strong>New job</strong> or the Job Card.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/tools/roofing?entry=packet"
            className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
          >
            New job
          </Link>
          <Link
            href="/tools/roofing/saved"
            className="inline-flex rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Jobs Board
          </Link>
        </div>
      </div>
    </main>
  );
}
