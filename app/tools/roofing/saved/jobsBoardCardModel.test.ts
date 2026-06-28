import test from "node:test";
import assert from "node:assert/strict";
import { buildJobsBoardCardModel } from "./jobsBoardUtils";
import type { RoofingEstimate } from "@/app/lib/estimateStore";

test("buildJobsBoardCardModel uses simple snapshot fields", () => {
  const model = buildJobsBoardCardModel(
    { id: "j1", status: "estimate", roofAreaSqFt: 0 } as unknown as RoofingEstimate,
    undefined,
    { columnKey: "estimate" }
  );

  assert.equal(model.tasksLabel, "0/0");
  assert.equal(model.reportStatus.label, "Report Missing");
  assert.equal(model.proposalStatus.label, "Proposal Draft");
  assert.equal(model.assigneeLabel, "Unassigned");
  assert.equal("valueLabel" in model, false);
  assert.equal("nextStepLabel" in model, false);
  assert.equal("headline" in model, false);
});

test("buildJobsBoardCardModel shows task ratio when linked_counts exist", () => {
  const model = buildJobsBoardCardModel(
    {
      id: "j2",
      status: "estimate",
      roofAreaSqFt: 1200,
      linked_counts: { tasks: 2, completed_tasks: 1 },
    } as unknown as RoofingEstimate,
    undefined,
    { columnKey: "estimate" }
  );

  assert.equal(model.tasksLabel, "1/3");
  assert.equal(model.reportStatus.label, "Report Complete");
});
