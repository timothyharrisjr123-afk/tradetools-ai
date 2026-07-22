/**
 * R18C4B — Public proposal route layout.
 *
 * Light document-style surface; no FieldDive app shell.
 */

export default function PublicProposalRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#e8eef5] text-slate-900 antialiased">
      {children}
    </div>
  );
}
