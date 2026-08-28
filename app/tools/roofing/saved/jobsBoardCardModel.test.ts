import test from "node:test";
import assert from "node:assert/strict";
import { buildJobsBoardCardModel } from "./jobsBoardUtils";
import type { RoofingEstimate } from "@/app/lib/estimateStore";

test("buildJobsBoardCardModel omits fake tasks and missing reports", () => {
  const model = buildJobsBoardCardModel(
    { id: "j1", status: "estimate", roofAreaSqFt: 0 } as unknown as RoofingEstimate,
    undefined,
    { columnKey: "estimate" }
  );

  assert.equal(model.tasksLabel, "");
  assert.equal(model.reportStatus, null);
  assert.equal(model.proposalStatus.label, "Proposal Draft");
  assert.equal(model.assigneeLabel, "Unassigned");
  assert.equal("valueLabel" in model, false);
  assert.equal("nextStepLabel" in model, false);
  assert.equal("headline" in model, false);
});

test("buildJobsBoardCardModel shows task ratio and measured when real", () => {
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
  assert.equal(model.reportStatus?.label, "Measured");
});
