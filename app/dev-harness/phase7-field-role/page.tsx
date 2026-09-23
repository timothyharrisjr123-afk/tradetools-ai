"use client";

import JobCardOverviewSummary from "@/app/tools/roofing/jobCard/JobCardOverviewSummary";
import JobCardFieldBrief from "@/app/tools/roofing/jobCard/JobCardFieldBrief";
import JobCardProductionLeadControl from "@/app/tools/roofing/jobCard/JobCardProductionLeadControl";
import { buildFieldBriefViewModel } from "@/app/lib/fieldBriefModel";

/**
 * Dev-only preview of restricted Field-user Overview (no commercial rows).
 * Visual reference for Astra G7 field brief hierarchy — not a second field app.
 */
export default function Phase7FieldRoleHarnessPage() {
  const model = buildFieldBriefViewModel({
    customerName: "Jamie Field",
    customerPhone: "(512) 555-0199",
    addressLine1: "88 Oak Lane",
    addressCity: "Austin",
    addressState: "TX",
    addressZip: "78704",
    scheduleStartsOn: "2026-09-30",
    scheduleTimezone: "America/Chicago",
    scheduleWindowLabel: "Tue Sep 30 · All day",
    productionLeadLabel: "Alex Rivera",
    approvedScopeLabel: "Full tear-off · Architectural shingles",
    measurementSummary: "24.0 SQ",
    accessNotes: "Gate code 4411",
    tasks: [
      {
        id: "t1",
        title: "Stage materials",
        status: "open",
        dueOn: "Sep 30",
        assignedTo: "field-user",
        assigneeLabel: "You",
      },
    ],
    photoCount: 2,
  });

  return (
    <main
      className="mx-auto min-h-screen max-w-lg bg-slate-50/60 px-4 py-6 sm:max-w-2xl sm:px-6"
      data-testid="phase7-field-role-harness"
    >
      <div className="rounded-xl border border-slate-200/80 bg-white px-5 py-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:px-6 sm:py-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
          Overview · Field user
        </p>
        <div className="mt-4">
          <JobCardOverviewSummary
            proposalLabel="hidden"
            measurementLabel="24.0 SQ"
            operationalStateLabel={null}
            paymentStatusLabel={null}
            suppressCommercial
            hideMeasurementRow
            productionLead={null}
            fieldBrief={
              <JobCardFieldBrief
                model={model}
                quietPhotoHint
                leadAction={
                  <JobCardProductionLeadControl
                    jobId="00000000-0000-4000-8000-000000000001"
                    assignedTo="lead-1"
                    crewLabel={null}
                    canAssign={false}
                    members={[
                      {
                        userId: "lead-1",
                        role: "production_lead",
                        preset: "production_lead",
                        displayName: "Alex Rivera",
                        email: null,
                        removedAt: null,
                        openJobLeadCount: 0,
                        openTaskAssigneeCount: 0,
                      },
                    ]}
                    embedInBrief
                    onUpdated={() => {}}
                  />
                }
              />
            }
          />
        </div>
      </div>
    </main>
  );
}
