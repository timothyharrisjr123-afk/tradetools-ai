"use client";

export type JobCardActivityItem = {
  label: string;
  note: string;
  when?: string;
};

type JobCardActivityPanelProps = {
  items: JobCardActivityItem[];
};

export default function JobCardActivityPanel({ items }: JobCardActivityPanelProps) {
  return (
    <aside className="flex h-full min-h-0 flex-col border-t border-slate-200/80 bg-slate-50/30 xl:border-l xl:border-t-0">
      <div className="shrink-0 border-b border-slate-200/60 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Activity</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200/60">
        <ol className="relative space-y-0 border-l border-slate-200/80 pl-4">
          {items.map((item, index) => (
            <li key={`${item.label}-${index}`} className="relative pb-5 last:pb-2">
              <span
                className="absolute -left-[1.125rem] top-1.5 h-2 w-2 rounded-full bg-slate-300 ring-2 ring-white"
                aria-hidden
              />
              {item.when ? (
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{item.when}</p>
              ) : null}
              <p className="mt-0.5 text-sm font-medium text-slate-800">{item.label}</p>
              <p className="mt-0.5 text-xs leading-snug text-slate-500">{item.note}</p>
            </li>
          ))}
        </ol>
      </div>
    </aside>
  );
}
