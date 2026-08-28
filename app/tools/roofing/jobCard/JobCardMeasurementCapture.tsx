"use client";

import { useEffect, useState } from "react";
import {
  isManualMeasurementEstimateReady,
  type JobCardManualMeasurementFields,
} from "@/app/lib/jobCardManualMeasurementDraft";

export const JOB_CARD_ADD_MEASUREMENT_LABEL = "Add measurement" as const;
export const JOB_CARD_SAVE_MEASUREMENT_LABEL = "Save measurement" as const;

const FIELD_CLASS =
  "mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400";

type JobCardMeasurementCaptureProps = {
  initial?: Partial<JobCardManualMeasurementFields> | null;
  saving?: boolean;
  error?: string | null;
  onCancel?: () => void;
  onSave: (fields: JobCardManualMeasurementFields) => void;
  title?: string;
};

function toFieldState(
  initial?: Partial<JobCardManualMeasurementFields> | null
): JobCardManualMeasurementFields {
  return {
    roof_area_sqft: Number(initial?.roof_area_sqft) > 0 ? Number(initial?.roof_area_sqft) : 0,
    waste_percent:
      initial?.waste_percent != null && Number.isFinite(Number(initial.waste_percent))
        ? Number(initial.waste_percent)
        : 10,
    pitch_label: (initial?.pitch_label ?? "").trim(),
    stories: (initial?.stories ?? "").trim(),
  };
}

export default function JobCardMeasurementCapture({
  initial = null,
  saving = false,
  error = null,
  onCancel,
  onSave,
  title = "Measurement",
}: JobCardMeasurementCaptureProps) {
  const [fields, setFields] = useState<JobCardManualMeasurementFields>(() =>
    toFieldState(initial)
  );

  useEffect(() => {
    setFields(toFieldState(initial));
  }, [initial?.roof_area_sqft, initial?.waste_percent, initial?.pitch_label, initial?.stories]);

  const canSave = isManualMeasurementEstimateReady(fields) && !saving;

  return (
    <form
      className="space-y-3"
      data-jobcard-measurement-capture="true"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSave) return;
        onSave(fields);
      }}
    >
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-sm text-slate-600">
          Roof area (sq ft)
          <input
            className={FIELD_CLASS}
            inputMode="decimal"
            value={fields.roof_area_sqft ? String(fields.roof_area_sqft) : ""}
            onChange={(event) =>
              setFields((prev) => ({
                ...prev,
                roof_area_sqft: Number(event.target.value) || 0,
              }))
            }
            data-jobcard-measurement-area
          />
        </label>
        <label className="block text-sm text-slate-600">
          Waste (%)
          <input
            className={FIELD_CLASS}
            inputMode="decimal"
            value={String(fields.waste_percent)}
            onChange={(event) =>
              setFields((prev) => ({
                ...prev,
                waste_percent: Number(event.target.value),
              }))
            }
            data-jobcard-measurement-waste
          />
        </label>
        <label className="block text-sm text-slate-600">
          Pitch
          <input
            className={FIELD_CLASS}
            placeholder="6/12"
            value={fields.pitch_label}
            onChange={(event) =>
              setFields((prev) => ({ ...prev, pitch_label: event.target.value }))
            }
            data-jobcard-measurement-pitch
          />
        </label>
        <label className="block text-sm text-slate-600">
          Stories
          <input
            className={FIELD_CLASS}
            placeholder="1"
            value={fields.stories}
            onChange={(event) =>
              setFields((prev) => ({ ...prev, stories: event.target.value }))
            }
            data-jobcard-measurement-stories
          />
        </label>
      </div>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-2 pt-1">
        {onCancel ? (
          <button
            type="button"
            className="inline-flex min-h-[44px] items-center rounded-md px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            onClick={onCancel}
            disabled={saving}
            data-jobcard-measurement-capture-cancel
          >
            Cancel
          </button>
        ) : null}
        <button
          type="submit"
          disabled={!canSave}
          className="inline-flex min-h-[44px] items-center rounded-md bg-slate-900 px-3.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          data-jobcard-measurement-save
        >
          {saving ? "Saving…" : JOB_CARD_SAVE_MEASUREMENT_LABEL}
        </button>
      </div>
    </form>
  );
}
