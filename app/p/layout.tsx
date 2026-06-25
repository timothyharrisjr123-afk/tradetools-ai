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
    <div className="min-h-screen bg-slate-100 text-slate-900 antialiased">{children}</div>
  );
}
