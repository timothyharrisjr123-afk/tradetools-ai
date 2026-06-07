import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  measurementRecordToInsertRow,
  measurementRecordToUpdateRow,
  rowToMeasurementRecord,
  type MeasurementRecordDraft,
} from "./measurementStore";

const COMPANY_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const JOB_ID = "11111111-1111-4111-8111-111111111111";
const MEASUREMENT_ID = "22222222-2222-4222-8222-222222222222";

function fullManualDraft(): MeasurementRecordDraft {
  return {
    company_id: COMPANY_ID,
    job_id: JOB_ID,
    status: "draft",
    source_type: "manual",
    roof_area_sqft: 2400,
    roof_squares: 24,
    adjusted_roof_squares: 26.4,
    waste_percent: 10,
    eaves_lf: 120,
    rakes_lf: 80,
    quantity_map: { starter_lf: 200, ridge_cap_lf: 45 },
    source_metadata: { source: "job_card" },
    assumptions: { note: "manual entry" },
  };
}

describe("measurementStore draft/row mapping", () => {
  test("full measurement create maps required measurement fields", () => {
    const row = measurementRecordToInsertRow(fullManualDraft());
    assert.equal(row.company_id, COMPANY_ID);
    assert.equal(row.job_id, JOB_ID);
    assert.equal(row.roof_area_sqft, 2400);
    assert.equal(row.eaves_lf, 120);
    assert.equal(row.rakes_lf, 80);
    assert.deepEqual(row.quantity_map, { starter_lf: 200, ridge_cap_lf: 45 });
    assert.equal(row.status, "draft");
    assert.equal(row.source_type, "manual");
    assert.equal(row.is_selected, false);
  });

  test("partial update with only roof_area_sqft does not include unrelated fields as null", () => {
    const row = measurementRecordToUpdateRow({ roof_area_sqft: 2500 });
    assert.equal(row.roof_area_sqft, 2500);
    assert.equal("eaves_lf" in row, false);
    assert.equal("rakes_lf" in row, false);
    assert.equal("quantity_map" in row, false);
    assert.equal("job_id" in row, false);
    assert.equal("company_id" in row, false);
    assert.equal("source_metadata" in row, false);
  });

  test("partial update with only quantity_map does not include unrelated fields as null", () => {
    const nextMap = { starter_lf: 210, ridge_cap_lf: 50 };
    const row = measurementRecordToUpdateRow({ quantity_map: nextMap });
    assert.deepEqual(row.quantity_map, nextMap);
    assert.equal("roof_area_sqft" in row, false);
    assert.equal("eaves_lf" in row, false);
    assert.equal("job_id" in row, false);
  });

  test("partial update does not null job_id/company_id when omitted", () => {
    const row = measurementRecordToUpdateRow({ waste_percent: 12 });
    assert.equal(row.waste_percent, 12);
    assert.equal("job_id" in row, false);
    assert.equal("company_id" in row, false);
  });

  test("explicit null on patch clears a field when intended", () => {
    const row = measurementRecordToUpdateRow({ eaves_lf: null });
    assert.equal(row.eaves_lf, null);
    assert.equal("rakes_lf" in row, false);
  });

  test("row mapper preserves quantity_map and proposal-relevant fields", () => {
    const record = rowToMeasurementRecord({
      id: MEASUREMENT_ID,
      company_id: COMPANY_ID,
      job_id: JOB_ID,
      created_at: "2026-06-07T12:00:00.000Z",
      updated_at: "2026-06-07T12:00:00.000Z",
      status: "draft",
      is_selected: true,
      source_type: "manual",
      is_verified: false,
      report_attached: false,
      diagram_available: false,
      estimate_ready: true,
      production_ready: false,
      roof_area_sqft: 2400,
      adjusted_roof_squares: 26.4,
      eaves_lf: 120,
      ridges_lf: 40,
      quantity_map: { starter_lf: 200 },
      source_metadata: { provider: "manual" },
    });

    assert.equal(record.roof_area_sqft, 2400);
    assert.equal(record.eaves_lf, 120);
    assert.equal(record.ridges_lf, 40);
    assert.deepEqual(record.quantity_map, { starter_lf: 200 });
    assert.equal(record.estimate_ready, true);
  });

  test("selected measurement update row only includes intended selected fields", () => {
    const row = measurementRecordToUpdateRow({
      is_selected: true,
      updated_at: "2026-06-07T12:00:00.000Z",
    });
    assert.equal(row.is_selected, true);
    assert.equal(row.updated_at, "2026-06-07T12:00:00.000Z");
    assert.equal("roof_area_sqft" in row, false);
    assert.equal("quantity_map" in row, false);
    assert.equal("job_id" in row, false);
  });
});
