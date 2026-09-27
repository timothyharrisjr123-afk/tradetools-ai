import { requireActiveCompanyPage } from "@/app/lib/access/requireActiveCompanyPage";
import { createClient } from "@/app/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?redirectTo=/admin/customers");
  }
  await requireActiveCompanyPage(supabase, user);

  return (
    <main className="min-h-screen bg-[#070A12] text-white p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">{children}</div>
    </main>
  );
}
