export const JOB_CARD_TABS = [
  { id: "overview", label: "Overview" },
  { id: "tasks", label: "Tasks" },
  { id: "calendar", label: "Calendar" },
  { id: "measurements", label: "Measurements" },
  { id: "proposals", label: "Proposals" },
  { id: "material_orders", label: "Material Orders" },
  { id: "work_orders", label: "Work Orders" },
  { id: "invoices", label: "Invoices" },
  { id: "job_costing", label: "Job Costing" },
  { id: "attachments", label: "Attachments" },
  { id: "instant_estimate", label: "Instant Estimate" },
] as const;

export type JobCardTabId = (typeof JOB_CARD_TABS)[number]["id"];
