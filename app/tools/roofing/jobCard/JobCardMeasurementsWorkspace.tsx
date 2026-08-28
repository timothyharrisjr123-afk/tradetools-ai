"use client";

import type { JobCardManualMeasurementFields } from "@/app/lib/jobCardManualMeasurementDraft";
import {
  buildJobCardMeasurementListItem,
  type JobCardMeasurementListItem,
} from "@/app/lib/jobCardMeasurementPresentation";
import type { MeasurementRecord } from "@/app/lib/measurementTypes";
import JobCardMeasurementCapture, {
  JOB_CARD_ADD_MEASUREMENT_LABEL,
} from "@/app/tools/roofing/jobCard/JobCardMeasurementCapture";

type JobCardMeasurementsWorkspaceProps = {
  records: readonly MeasurementRecord[];
  selectedId: string | null;
  loading?: boolean;
  capturing?: boolean;
  captureInitial?: Partial<JobCardManualMeasurementFields> | null;
  saving?: boolean;
  saveError?: string | null;
  selectBusy?: boolean;
  onAddMeasurement: () => void;
  onCancelCapture?: () => void;
  onSaveMeasurement: (fields: JobCardManualMeasurementFields) => void;
  onSelectMeasurement: (measurementId: string) => void;
};

export default function JobCardMeasurementsWorkspace({
  records,
  selectedId,
  loading = false,
  capturing = false,
  captureInitial = null,
  saving = false,
  saveError = null,
  selectBusy = false,
  onAddMeasurement,
  onCancelCapture,
  onSaveMeasurement,
  onSelectMeasurement,
}: JobCardMeasurementsWorkspaceProps) {
  const items: JobCardMeasurementListItem[] = records.map((record) =>
    buildJobCardMeasurementListItem({ record, selectedId })
  );
  const current = items.find((item) => item.selected) ?? null;

  return (
    <div className="space-y-4" data-jobcard-measurements-workspace="true">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {current ? (
            <div data-jobcard-measurement-current="true">
              <p className="text-sm font-semibold text-slate-900">{current.name}</p>
              <p className="mt-0.5 text-sm text-slate-700">{current.quantityLine}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {current.sourceLine} · {current.readinessLabel}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-600" data-jobcard-measurements-empty>
              No measurement yet
            </p>
          )}
        </div>
        {!capturing ? (
          <button
            type="button"
            className="inline-flex min-h-[44px] shrink-0 items-center rounded-md bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800"
            onClick={onAddMeasurement}
            data-jobcard-add-measurement="true"
          >
            {JOB_CARD_ADD_MEASUREMENT_LABEL}
          </button>
        ) : null}
      </div>

      {capturing ? (
        <JobCardMeasurementCapture
          initial={captureInitial}
          saving={saving}
          error={saveError}
          onCancel={onCancelCapture}
          onSave={onSaveMeasurement}
          title={captureInitial ? "Edit measurement" : "Add measurement"}
        />
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading measurements</p>
      ) : items.length > 1 ? (
        <ul className="divide-y divide-slate-100 border-t border-slate-100" data-jobcard-measurement-list>
          {items.map((item) => (
            <li key={item.id} className="py-2.5">
              <button
                type="button"
                className="flex w-full min-h-[44px] items-start justify-between gap-3 text-left"
                onClick={() => onSelectMeasurement(item.id)}
                disabled={selectBusy || item.selected}
                data-jobcard-measurement-option={item.selected ? "current" : "other"}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-900">
                    {item.name}
                    {item.selected ? (
                      <span className="ml-2 text-xs font-semibold text-slate-500">
                        Current
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {item.quantityLine} · {item.sourceLine}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
