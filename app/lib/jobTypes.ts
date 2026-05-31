/**
 * FieldDive Job / Job Card — type contract.
 *
 * JobRecord is the central Roofr-style operational record for a roofing job.
 * This file is types only — no database, Supabase, React, or runtime logic.
 *
 * Data spine:
 *   Job / Job Card → Measurement Records → Catalog / Price Book → Templates
 *   → Proposals → downstream operations (material orders, work orders, invoices, job costing).
 *
 * Relationships:
 *   - Estimates and proposals are contractual records attached to a job.
 *   - Measurement Records attach to job_id (estimate_id may exist only during migration).
 *   - Attachments, tasks, calendar events, and production workflows attach to the job.
 *
 * Financial truth:
 *   - Payments and approval tokens belong to proposals/estimates, not the job itself.
 *   - JobFinancialSummary is display-only rollup; it is not payment or approval truth.
 *   - Do not store final_price, paymentHistory, approvalToken, or send/viewed status on JobRecord.
 *
 * Anti-drift:
 *   - JobRecord is not a proposal and is not an estimate.
 *   - A job can eventually have multiple proposals/estimates (revisions, change orders).
 *   - FieldDive must not permanently treat estimates as jobs; this model exists to prevent that.
 *
 * Product rule: Job Card is the hub; measurements and proposals hang off the job.
 */

// ---------------------------------------------------------------------------
// Stage / status / source
// ---------------------------------------------------------------------------

/**
 * Where the job is in the Roofr-style workflow.
 *
 * - intake: customer/property info captured or being captured
 * - measurement: roof data, report, or photo measurement work
 * - estimating: estimate/proposal calculation in progress
 * - proposal: proposal created, sent, or under customer review
 * - approved: customer approved a proposal
 * - production: scheduled, in progress, or production workflow
 * - complete: job finished
 * - archived: hidden or closed out
 */
export type JobStage =
  | "intake"
  | "measurement"
  | "estimating"
  | "proposal"
  | "approved"
  | "production"
  | "complete"
  | "archived";

/**
 * Where the job lead originated.
 */
export type JobSource =
  | "manual"
  | "intake"
  | "referral"
  | "website"
  | "phone"
  | "email"
  | "campaign"
  | "external_import"
  | "unknown";

/**
 * Operational priority. Default concept is "normal".
 */
export type JobPriority = "low" | "normal" | "high" | "urgent";

/**
 * Broad job-card disposition (separate from workflow stage).
 *
 * Stage = where the job is in the workflow.
 * Status = whether the job is active, on hold, won, lost, closed, or archived.
 */
export type JobCardStatus =
  | "active"
  | "on_hold"
  | "won"
  | "lost"
  | "closed"
  | "archived";

// ---------------------------------------------------------------------------
// Address / contact
// ---------------------------------------------------------------------------

export type JobAddress = {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  formatted?: string | null;
};

/**
 * Lightweight customer/contact snapshot for cards and restore displays.
 * The customers table remains the source of customer truth long-term.
 */
export type JobContactSnapshot = {
  customer_id?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
};

// ---------------------------------------------------------------------------
// Linked counts / financial summary / readiness
// ---------------------------------------------------------------------------

/**
 * Lightweight counts for Job Board / dashboard cards during Saved-page migration.
 */
export type JobLinkedCounts = {
  measurements?: number;
  attachments?: number;
  proposals?: number;
  material_orders?: number;
  work_orders?: number;
  invoices?: number;
  tasks?: number;
};

/**
 * Display-only financial rollup for Job Card / Job Board.
 *
 * Financial truth lives on proposals, estimates, and payments — not on the job.
 * Do not use this type for payment transactions, approval tokens, or contract enforcement.
 */
export type JobFinancialSummary = {
  active_proposal_id?: string | null;
  latest_estimate_id?: string | null;
  latest_proposal_id?: string | null;
  latest_total_cents?: number | null;
  projected_cost_cents?: number | null;
  gross_profit_cents?: number | null;
  gross_margin_percent?: number | null;
};

/**
 * Job Card readiness and next-action hints.
 */
export type JobReadiness = {
  customer_complete: boolean;
  property_complete: boolean;
  measurement_ready: boolean;
  proposal_ready: boolean;
  production_ready: boolean;
  missing_items: string[];
  readiness_score?: number | null;
};

// ---------------------------------------------------------------------------
// Main record
// ---------------------------------------------------------------------------

/**
 * Full Job / Job Card record.
 *
 * JobRecord is NOT:
 *   - a proposal (no proposal pages, tiers, or send/approval workflow fields)
 *   - an estimate (no calculation snapshot or pricing drivers)
 *   - payment truth (no paymentHistory, amountPaid, paidAt, approvalToken)
 *
 * A job can have multiple proposals/estimates over time; pointers here are convenience only.
 */
export type JobRecord = {
  // Identifiers
  id: string;
  company_id: string;
  customer_id?: string | null;

  // Basic job / card fields
  job_name?: string | null;
  stage: JobStage;
  status: JobCardStatus;
  source: JobSource;
  priority?: JobPriority | null;

  // Contact / property
  contact?: JobContactSnapshot | null;
  address?: JobAddress | null;

  // Assignment / ownership
  assigned_to?: string | null;
  created_by?: string | null;
  updated_by?: string | null;

  // Notes / summary
  notes?: string | null;
  summary?: string | null;

  // Activity / timestamps
  last_activity_at?: string | null;
  created_at: string;
  updated_at: string;

  // Lifecycle
  archived?: boolean;
  deleted_at?: string | null;

  // Linked record pointers (not embedded child records)
  selected_measurement_id?: string | null;
  active_proposal_id?: string | null;
  latest_estimate_id?: string | null;
  latest_proposal_id?: string | null;

  // Linked counts / summaries
  linked_counts?: JobLinkedCounts | null;
  financial_summary?: JobFinancialSummary | null;
  readiness?: JobReadiness | null;

  // Flexible metadata
  source_metadata?: Record<string, unknown> | null;
  custom_fields?: Record<string, unknown> | null;
};

// ---------------------------------------------------------------------------
// Summary / draft / display / bridge
// ---------------------------------------------------------------------------

/**
 * Lightweight card/list view for future Job Board and Saved-page migration.
 * Does not embed full measurements, proposals, payment history, or approval tokens.
 */
export type JobSummary = {
  id: string;
  company_id: string;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  job_name?: string | null;
  address?: JobAddress | null;
  stage: JobStage;
  status: JobCardStatus;
  source?: JobSource | null;
  priority?: JobPriority | null;
  assigned_to?: string | null;
  selected_measurement_id?: string | null;
  active_proposal_id?: string | null;
  latest_estimate_id?: string | null;
  latest_proposal_id?: string | null;
  latest_total_cents?: number | null;
  linked_counts?: JobLinkedCounts | null;
  readiness?: JobReadiness | null;
  last_activity_at?: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Pre-persistence shape for intake and job-creation forms.
 */
export type JobDraft = Omit<JobRecord, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

/**
 * Consistent stage labels for future UI (avoid hardcoding strings in components).
 */
export type JobStageDisplay = {
  label: string;
  description: string;
  order: number;
};

/**
 * Routing / migration bridge: which child records are active on this job.
 *
 * Used while estimates still exist without job_id and Job Card loads by estimate id.
 * Measurement Records should attach to job_id; estimate_id is transitional only.
 */
export type JobRelationshipSummary = {
  job_id: string;
  selected_measurement_id?: string | null;
  active_proposal_id?: string | null;
  latest_estimate_id?: string | null;
  latest_proposal_id?: string | null;
};
