"use client";

import JobCardQuietEmptyState from "@/app/tools/roofing/jobCard/JobCardQuietEmptyState";

export type JobCardActivityItem = {
  label: string;
  note: string;
  when?: string;
  dayKey?: string;
  dayLabel?: string;
  timeLabel?: string;
  actor?: string | null;
  kind?: string;
};

type JobCardActivityPanelProps = {
  items: JobCardActivityItem[];
};

type ActivityDayGroup = {
  dayKey: string;
  dayLabel: string;
  items: JobCardActivityItem[];
};

function groupActivityItems(
  items: JobCardActivityItem[]
): ActivityDayGroup[] | null {
  if (items.length === 0) return [];
  if (!items.some((item) => Boolean(item.dayKey))) return null;
  const groups: ActivityDayGroup[] = [];
  for (const item of items) {
    const dayKey = item.dayKey || "_";
    const dayLabel = item.dayLabel || "";
    const last = groups[groups.length - 1];
    if (last && last.dayKey === dayKey) {
      last.items.push(item);
      continue;
    }
    groups.push({ dayKey, dayLabel, items: [item] });
  }
  return groups;
}

function markerClass(kind: string | undefined): string {
  if (kind === "work_completed") return "bg-slate-700";
  if (kind === "work_started") return "bg-slate-500";
  return "bg-slate-300";
}

function metaLine(item: JobCardActivityItem, grouped: boolean): string | null {
  const parts: string[] = [];
  if (grouped) {
    if (item.timeLabel) parts.push(item.timeLabel);
  } else if (item.when) {
    parts.push(item.when);
  } else if (item.timeLabel) {
    parts.push(item.timeLabel);
  }
  if (item.actor) parts.push(item.actor);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function ActivityRow({
  item,
  grouped,
}: {
  item: JobCardActivityItem;
  grouped: boolean;
}) {
  const meta = metaLine(item, grouped);
  return (
    <li className="relative pb-4 last:pb-1">
      <span
        className={`absolute -left-[1.125rem] top-1.5 h-2 w-2 rounded-full ring-2 ring-white ${markerClass(item.kind)}`}
        aria-hidden
      />
      <p className="text-sm font-medium leading-snug text-slate-800">{item.label}</p>
      {item.note ? (
        <p className="mt-0.5 text-xs leading-snug text-slate-500">{item.note}</p>
      ) : null}
      {meta ? (
        <p className="mt-0.5 text-xs leading-snug text-slate-400">{meta}</p>
      ) : null}
    </li>
  );
}

export default function JobCardActivityPanel({ items }: JobCardActivityPanelProps) {
  const groups = groupActivityItems(items);

  return (
    <aside
      className="flex h-full min-h-0 flex-col border-t border-slate-200/80 bg-slate-50/30 xl:border-l xl:border-t-0"
      data-jobcard-activity
    >
      <div className="shrink-0 border-b border-slate-200/60 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Activity</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200/60">
        {items.length === 0 ? (
          <JobCardQuietEmptyState message="No activity yet" testId="activity" />
        ) : groups ? (
          <div className="space-y-5">
            {groups.map((group) => (
              <section key={group.dayKey} data-activity-day={group.dayKey}>
                {group.dayLabel ? (
                  <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    {group.dayLabel}
                  </h3>
                ) : null}
                <ol className="relative border-l border-slate-200/80 pl-4">
                  {group.items.map((item, index) => (
                    <ActivityRow
                      key={`${item.kind ?? item.label}-${item.when ?? ""}-${index}`}
                      item={item}
                      grouped
                    />
                  ))}
                </ol>
              </section>
            ))}
          </div>
        ) : (
          <ol className="relative border-l border-slate-200/80 pl-4">
            {items.map((item, index) => (
              <ActivityRow
                key={`${item.label}-${item.when ?? ""}-${index}`}
                item={item}
                grouped={false}
              />
            ))}
          </ol>
        )}
      </div>
    </aside>
  );
}
