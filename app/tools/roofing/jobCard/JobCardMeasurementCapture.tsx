"use client";

import { useEffect, useState } from "react";
import {
  emptyJobCardManualMeasurementFields,
  isManualMeasurementStarterQuantityInputComplete,
  TRUSTED_MEASUREMENT_REPORT_SOURCES,
  type JobCardManualMeasurementFields,
} from "@/app/lib/jobCardManualMeasurementDraft";

export const JOB_CARD_ADD_MEASUREMENT_LABEL = "Add measurement" as const;
export const JOB_CARD_SAVE_MEASUREMENT_LABEL = "Save measurement" as const;

export const JOB_CARD_MEASUREMENT_REPORT_GROUP_TITLE = "From the report" as const;
export const JOB_CARD_MEASUREMENT_REPORT_GROUP_HINT =
  "Enter the roof numbers from the report you already trust." as const;
export const JOB_CARD_MEASUREMENT_SCOPE_GROUP_TITLE = "This job" as const;
export const JOB_CARD_MEASUREMENT_SCOPE_GROUP_HINT =
  "Counts and conditions for this roof — not copied from the report unless you already counted them." as const;

const FIELD_CLASS =
  "mt-1 min-h-[44px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30";

type JobCardMeasurementCaptureProps = {
  initial?: Partial<JobCardManualMeasurementFields> | null;
  saving?: boolean;
  error?: string | null;
  onCancel?: () => void;
  onSave: (fields: JobCardManualMeasurementFields) => void;
  title?: string;
  /** Prepare-context hint — trusted report numbers, not module setup. */
  hint?: string | null;
};

function mergeFields(
  initial?: Partial<JobCardManualMeasurementFields> | null
): JobCardManualMeasurementFields {
  const base = emptyJobCardManualMeasurementFields();
  if (!initial) return base;
  return {
    ...base,
    ...initial,
    roof_area_sqft:
      Number(initial.roof_area_sqft) > 0 ? Number(initial.roof_area_sqft) : 0,
    waste_percent:
      initial.waste_percent != null && Number.isFinite(Number(initial.waste_percent))
        ? Number(initial.waste_percent)
        : Number.NaN,
    pitch_label: (initial.pitch_label ?? "").trim(),
    stories: (initial.stories ?? "").trim(),
    report_source: (initial.report_source ?? "").trim(),
    tear_off_required:
      initial.tear_off_required === true || initial.tear_off_required === false
        ? initial.tear_off_required
        : null,
  };
}

function numberInputValue(value: number | undefined): string {
  return value != null && Number.isFinite(value) ? String(value) : "";
}

function parseEnteredNumber(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === "") return Number.NaN;
  return Number(trimmed);
}

export default function JobCardMeasurementCapture({
  initial = null,
  saving = false,
  error = null,
  onCancel,
  onSave,
  title = "Measurement",
  hint = null,
}: JobCardMeasurementCaptureProps) {
  const [fields, setFields] = useState<JobCardManualMeasurementFields>(() =>
    mergeFields(initial)
  );

  useEffect(() => {
    setFields(mergeFields(initial));
  }, [
    initial?.roof_area_sqft,
    initial?.waste_percent,
    initial?.pitch_label,
    initial?.stories,
    initial?.report_source,
    initial?.eaves_lf,
    initial?.rakes_lf,
    initial?.ridges_lf,
    initial?.hips_lf,
    initial?.valleys_lf,
    initial?.step_flashing_lf,
    initial?.pipe_boots_count,
    initial?.vents_count,
    initial?.tear_off_required,
    initial?.debris_tons_estimate,
  ]);

  const canSave = isManualMeasurementStarterQuantityInputComplete(fields) && !saving;
  const reportHint = hint ?? JOB_CARD_MEASUREMENT_REPORT_GROUP_HINT;

  return (
    <form
      className="space-y-4"
      data-jobcard-measurement-capture="true"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSave) return;
        onSave(fields);
      }}
    >
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>

      <div data-jobcard-measurement-report-group="true">
        <h4 className="text-sm font-semibold text-slate-900">
          {JOB_CARD_MEASUREMENT_REPORT_GROUP_TITLE}
        </h4>
        <p
          className="mt-1 text-sm leading-relaxed text-slate-600"
          data-jobcard-measurement-hint
        >
          {reportHint}
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              aria-label="Roof area in square feet"
            />
          </label>
          <label className="block text-sm text-slate-600">
            Waste (%)
            <input
              className={FIELD_CLASS}
              inputMode="decimal"
              value={numberInputValue(fields.waste_percent)}
              placeholder="—"
              onChange={(event) =>
                setFields((prev) => ({
                  ...prev,
                  waste_percent: parseEnteredNumber(event.target.value),
                }))
              }
              data-jobcard-measurement-waste
              aria-label="Waste percent"
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
              aria-label="Pitch"
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
              aria-label="Stories"
            />
          </label>
          <label className="block text-sm text-slate-600">
            Eaves (lf)
            <input
              className={FIELD_CLASS}
              inputMode="decimal"
              value={numberInputValue(fields.eaves_lf)}
              placeholder="—"
              onChange={(event) =>
                setFields((prev) => ({
                  ...prev,
                  eaves_lf: parseEnteredNumber(event.target.value),
                }))
              }
              data-jobcard-measurement-eaves
              aria-label="Eaves linear feet"
            />
          </label>
          <label className="block text-sm text-slate-600">
            Rakes (lf)
            <input
              className={FIELD_CLASS}
              inputMode="decimal"
              value={numberInputValue(fields.rakes_lf)}
              placeholder="—"
              onChange={(event) =>
                setFields((prev) => ({
                  ...prev,
                  rakes_lf: parseEnteredNumber(event.target.value),
                }))
              }
              data-jobcard-measurement-rakes
              aria-label="Rakes linear feet"
            />
          </label>
          <label className="block text-sm text-slate-600">
            Ridges (lf)
            <input
              className={FIELD_CLASS}
              inputMode="decimal"
              value={numberInputValue(fields.ridges_lf)}
              placeholder="—"
              onChange={(event) =>
                setFields((prev) => ({
                  ...prev,
                  ridges_lf: parseEnteredNumber(event.target.value),
                }))
              }
              data-jobcard-measurement-ridges
              aria-label="Ridges linear feet"
            />
          </label>
          <label className="block text-sm text-slate-600">
            Hips{" "}
            <span className="font-normal text-slate-400">lf · optional</span>
            <input
              className={FIELD_CLASS}
              inputMode="decimal"
              value={numberInputValue(fields.hips_lf)}
              placeholder="—"
              onChange={(event) =>
                setFields((prev) => ({
                  ...prev,
                  hips_lf: parseEnteredNumber(event.target.value),
                }))
              }
              data-jobcard-measurement-hips
              aria-label="Hips linear feet optional"
            />
          </label>
          <label className="block text-sm text-slate-600">
            Valleys (lf)
            <input
              className={FIELD_CLASS}
              inputMode="decimal"
              value={numberInputValue(fields.valleys_lf)}
              placeholder="—"
              onChange={(event) =>
                setFields((prev) => ({
                  ...prev,
                  valleys_lf: parseEnteredNumber(event.target.value),
                }))
              }
              data-jobcard-measurement-valleys
              aria-label="Valleys linear feet"
            />
          </label>
          <label className="block text-sm text-slate-600">
            Step flashing (lf)
            <input
              className={FIELD_CLASS}
              inputMode="decimal"
              value={numberInputValue(fields.step_flashing_lf)}
              placeholder="—"
              onChange={(event) =>
                setFields((prev) => ({
                  ...prev,
                  step_flashing_lf: parseEnteredNumber(event.target.value),
                }))
              }
              data-jobcard-measurement-step-flashing
              aria-label="Step flashing linear feet"
            />
          </label>
        </div>
        <label className="mt-3 block text-sm text-slate-600">
          Report source{" "}
          <span className="font-normal text-slate-400">(optional)</span>
          <select
            className={FIELD_CLASS}
            value={fields.report_source ?? ""}
            onChange={(event) =>
              setFields((prev) => ({ ...prev, report_source: event.target.value }))
            }
            data-jobcard-measurement-report-source
            aria-label="Report source optional"
          >
            <option value="">—</option>
            {TRUSTED_MEASUREMENT_REPORT_SOURCES.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div data-jobcard-measurement-scope-group="true">
        <h4 className="text-sm font-semibold text-slate-900">
          {JOB_CARD_MEASUREMENT_SCOPE_GROUP_TITLE}
        </h4>
        <p
          className="mt-1 text-sm leading-relaxed text-slate-600"
          data-jobcard-measurement-scope-hint
        >
          {JOB_CARD_MEASUREMENT_SCOPE_GROUP_HINT}
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm text-slate-600">
            Pipe boots
            <input
              className={FIELD_CLASS}
              inputMode="numeric"
              value={numberInputValue(fields.pipe_boots_count)}
              placeholder="—"
              onChange={(event) =>
                setFields((prev) => ({
                  ...prev,
                  pipe_boots_count: parseEnteredNumber(event.target.value),
                }))
              }
              data-jobcard-measurement-pipe-boots
              aria-label="Pipe boots count"
            />
          </label>
          <label className="block text-sm text-slate-600">
            Roof vents
            <input
              className={FIELD_CLASS}
              inputMode="numeric"
              value={numberInputValue(fields.vents_count)}
              placeholder="—"
              onChange={(event) =>
                setFields((prev) => ({
                  ...prev,
                  vents_count: parseEnteredNumber(event.target.value),
                }))
              }
              data-jobcard-measurement-vents
              aria-label="Roof vents count"
            />
          </label>
          <label className="block text-sm text-slate-600">
            Tear-off
            <select
              className={FIELD_CLASS}
              value={
                fields.tear_off_required === true
                  ? "yes"
                  : fields.tear_off_required === false
                    ? "no"
                    : ""
              }
              onChange={(event) => {
                const raw = event.target.value;
                setFields((prev) => ({
                  ...prev,
                  tear_off_required:
                    raw === "yes" ? true : raw === "no" ? false : null,
                }));
              }}
              data-jobcard-measurement-tear-off
              aria-label="Tear-off required"
            >
              <option value="">—</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <label className="block text-sm text-slate-600">
            Disposal (tons)
            <input
              className={FIELD_CLASS}
              inputMode="decimal"
              value={numberInputValue(fields.debris_tons_estimate)}
              placeholder="—"
              onChange={(event) =>
                setFields((prev) => ({
                  ...prev,
                  debris_tons_estimate: parseEnteredNumber(event.target.value),
                }))
              }
              data-jobcard-measurement-disposal
              aria-label="Disposal tons"
            />
          </label>
        </div>
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
          className="inline-flex min-h-[44px] items-center rounded-md bg-blue-600 px-3.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          data-jobcard-measurement-save
        >
          {saving ? "Saving…" : JOB_CARD_SAVE_MEASUREMENT_LABEL}
        </button>
      </div>
    </form>
  );
}
