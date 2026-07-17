import type { ReactNode } from "react";

type TemplatesWorkspaceLayoutProps = {
  main: ReactNode;
  aside?: ReactNode | null;
};

export default function TemplatesWorkspaceLayout({
  main,
  aside = null,
}: TemplatesWorkspaceLayoutProps) {
  if (!aside) {
    return <div className="min-w-0 space-y-5">{main}</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_17rem] xl:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-5">{main}</div>
      <aside className="min-w-0 space-y-4 lg:sticky lg:top-6 lg:self-start">{aside}</aside>
    </div>
  );
}
