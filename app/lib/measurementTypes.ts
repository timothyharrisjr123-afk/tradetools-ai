/**
 * FieldDive Measurement Record — type contract.
 *
 * MeasurementRecord is the structured roof measurement contract for FieldDive.
 * It is deliberately separate from pricing, proposals, and payment truth.
 *
 * A MeasurementRecord may be created by:
 *   - manual contractor entry
 *   - uploaded/imported measurement report
 *   - external measurement provider integration (EagleView, Hover, etc.)
 *   - aerial or satellite imagery data
 *   - AI analysis of photos or property address
 *
 * AI-generated and provider-generated records should start with:
 *   status = "needs_review" and is_verified = false.
 * Contractor verification upgrades the record to is_verified = true.
 *
 * Pricing must come from: MeasurementRecord → quantity_map → Catalog / Price Book → Template → pricing engine.
 * MeasurementRecord must NOT store final price, margin truth, payment status, or approval truth.
 *
 * Product rule: AI prepares. FieldDive calculates. Contractor confirms.
 */

// ---------------------------------------------------------------------------
// Source
// ---------------------------------------------------------------------------

/**
 * Where the measurement data came from.
 */
export type MeasurementSourceType =
  | "manual"             // Contractor typed/entered all values directly
  | "report_import"      // Uploaded or imported a measurement report file
  | "provider_report"    // Received from an external measurement provider
  | "satellite"          // Derived from satellite imagery
  | "aerial"             // Derived from aerial or drone imagery
  | "photo_ai"           // AI analysis of job/inspection photos
  | "address_ai"         // AI or property-data draft from address only
  | "contractor_verified"// Record was subsequently verified by a contractor
  | "external_import";   // Catch-all for other external import sources

// ---------------------------------------------------------------------------
// Status / lifecycle
// ---------------------------------------------------------------------------

/**
 * Lifecycle state of a MeasurementRecord.
 */
export type MeasurementStatus =
  | "draft"         // Started but not complete; not usable yet
  | "needs_review"  // AI/provider/report result requires contractor review
  | "incomplete"    // Required fields are missing; cannot estimate
  | "measured"      // Measurements exist but contractor has not verified
  | "verified"      // Contractor verified; usable for proposals and ordering
  | "rejected"      // Contractor explicitly rejected this record
  | "stale";        // Source data changed or re-verification is needed

// ---------------------------------------------------------------------------
// Confidence
// ---------------------------------------------------------------------------

/**
 * Categorical confidence level for the overall measurement record.
 */
export type MeasurementConfidenceLabel =
  | "low"
  | "medium"
  | "high"
  | "verified";

/**
 * Per-field confidence scores, keyed by field name.
 * Values are 0.0 (no confidence) to 1.0 (full confidence).
 *
 * Example: { roof_area_sqft: 0.92, predominant_pitch: 0.7 }
 */
export type MeasurementFieldConfidence = {
  [fieldName: string]: number;
};

// ---------------------------------------------------------------------------
// Warnings
// ---------------------------------------------------------------------------

/**
 * A warning or informational note attached to a MeasurementRecord.
 * May reference a specific field or the record as a whole.
 */
export type MeasurementWarning = {
  /** The field name this warning relates to, if applicable. */
  field?: string;
  /** Human-readable message. */
  message: string;
  /** Severity level. Defaults to "warning" if omitted. */
  severity?: "info" | "warning" | "critical";
};

// ---------------------------------------------------------------------------
// Quantity Map
// ---------------------------------------------------------------------------

/**
 * MeasurementQuantityMap — quantities only.
 *
 * This is the bridge between raw roof measurements and the catalog / price book.
 * It translates measured dimensions into named quantities that catalog line items
 * can consume to generate materials lists and labor estimates.
 *
 * IMPORTANT:
 *   - Quantities only. No price, no final price, no margin, no payment status,
 *     no approval status, no proposal send status.
 *   - The pricing engine consumes these quantities together with catalog rules
 *     (unit cost, coverage, waste factor) to produce line-item totals.
 *   - This map is not the estimate. It is the input to the estimate.
 *
 * Future quantity-source mappings (non-exhaustive):
 *   roof_squares / adjusted_roof_squares  → shingles, underlayment, labor
 *   eaves_lf / rakes_lf                  → starter strip, drip edge
 *   ridges_lf / hips_lf                  → ridge cap
 *   valleys_lf                           → valley flashing / ice & water shield
 *   pipe_boots_count / vents_count        → accessory line items
 *   existing_layers_count / debris_tons   → tear-off / disposal line items
 *   pitch / stories / complexity          → labor_multiplier
 */
export type MeasurementQuantityMap = {
  /** Adjusted roof area in squares (100 sq ft each), after waste factor. */
  shingles_squares?: number;
  /** Underlayment coverage in squares. */
  underlayment_squares?: number;
  /** Starter strip linear feet (eaves + rakes). */
  starter_lf?: number;
  /** Drip edge linear feet (eaves + rakes). */
  drip_edge_lf?: number;
  /** Ridge cap linear feet (ridges + hips). */
  ridge_cap_lf?: number;
  /** Valley flashing linear feet. */
  valley_flashing_lf?: number;
  /** Ice & water shield area in square feet. */
  ice_water_sqft?: number;
  /** Wall flashing linear feet. */
  wall_flashing_lf?: number;
  /** Step flashing linear feet. */
  step_flashing_lf?: number;
  /** Number of pipe boot penetrations. */
  pipe_boots?: number;
  /** Number of vent penetrations. */
  vents?: number;
  /** Number of chimney penetrations. */
  chimneys?: number;
  /** Number of skylights. */
  skylights?: number;
  /** Tear-off area in squares. */
  tear_off_squares?: number;
  /** Number of layers being torn off. */
  tear_off_layers?: number;
  /** Estimated debris weight in tons. */
  debris_tons?: number;
  /** Labor area in squares (may differ from shingles if labor is priced separately). */
  labor_squares?: number;
  /**
   * Composite labor multiplier derived from pitch, stories, and complexity.
   * Applied by the pricing engine on top of base labor rate.
   */
  labor_multiplier?: number;
  /** Catch-all for catalog items that need a custom quantity key. */
  custom?: Record<string, number>;
};

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

/**
 * Assessment of how complete and usable a MeasurementRecord is.
 */
export type MeasurementReadiness = {
  /** Names of fields that are required but missing. */
  missing_fields: string[];
  /**
   * Overall completeness score from 0 to 100.
   * 0 = unusable. 100 = fully complete and verified.
   */
  readiness_score: number;
  /**
   * True when the record has enough data to generate a proposal/estimate draft.
   * Requires at minimum: roof_area_sqft (or roof_squares), source_type, status != "rejected".
   */
  estimate_ready: boolean;
  /**
   * True when the record is strong enough for material ordering and production planning.
   * Requires verification and key line measurements (eaves, ridges, valleys, etc.).
   */
  production_ready: boolean;
};

// ---------------------------------------------------------------------------
// MeasurementRecord — main model
// ---------------------------------------------------------------------------

/**
 * The full FieldDive Measurement Record.
 *
 * This is the roof data contract that feeds the proposal/estimate pipeline.
 * One job/estimate may have multiple MeasurementRecords (e.g. provider report +
 * manual override). is_selected indicates the active record for a given job.
 *
 * For the current app, estimate_id is used because no jobs table exists yet.
 * job_id is reserved for future migration when job_cards are introduced.
 */
export type MeasurementRecord = {
  // -------------------------------------------------------------------------
  // Identifiers
  // -------------------------------------------------------------------------

  id: string;
  company_id: string;
  /**
   * Links to the current estimates table.
   * Used until a dedicated jobs/job_cards table exists.
   */
  estimate_id?: string | null;
  /**
   * Future job/job_card link. Not required until jobs table exists.
   */
  job_id?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;

  // -------------------------------------------------------------------------
  // Status / lifecycle
  // -------------------------------------------------------------------------

  status: MeasurementStatus;
  /**
   * True when this is the active/chosen record for its job or estimate.
   * Only one record per job should have is_selected = true at a time.
   */
  is_selected: boolean;

  // -------------------------------------------------------------------------
  // Source / provenance
  // -------------------------------------------------------------------------

  source_type: MeasurementSourceType;
  /** Name of the external provider if source_type is "provider_report". */
  source_provider?: string | null;
  /** ID of the provider's report, if applicable. */
  source_report_id?: string | null;
  /** ID of the imported file record in attachments, if applicable. */
  source_file_id?: string | null;
  /** URL to the source report or imagery, if available. */
  source_url?: string | null;
  /** When the source data was originally created (provider/satellite timestamp). */
  source_created_at?: string | null;
  /** When this record was imported into FieldDive. */
  imported_at?: string | null;
  /** AI model version or provider API version used to generate this record. */
  model_version?: string | null;
  /** Any additional metadata from the source provider or import process. */
  source_metadata?: Record<string, unknown> | null;

  // -------------------------------------------------------------------------
  // Verification
  // -------------------------------------------------------------------------

  is_verified: boolean;
  /** User ID of the contractor or admin who verified the record. */
  verified_by?: string | null;
  verified_at?: string | null;
  verification_notes?: string | null;

  // -------------------------------------------------------------------------
  // Confidence
  // -------------------------------------------------------------------------

  /** Overall confidence from 0.0 to 1.0. */
  confidence_score?: number | null;
  confidence_label?: MeasurementConfidenceLabel | null;
  /** Per-field confidence scores (0.0–1.0). */
  field_confidence?: MeasurementFieldConfidence | null;

  // -------------------------------------------------------------------------
  // Core roof measurements
  // -------------------------------------------------------------------------

  /** Total measured roof area in square feet. */
  roof_area_sqft?: number | null;
  /** Total roof area in roofing squares (1 SQ = 100 sq ft). */
  roof_squares?: number | null;
  /** Roof squares after applying waste factor. */
  adjusted_roof_squares?: number | null;
  /** Waste percentage applied to roof_squares. */
  waste_percent?: number | null;
  /** Predominant pitch expressed as rise/run (e.g. "6/12"). */
  predominant_pitch?: string | null;
  /** Human-readable pitch label: "walkable", "moderate", "steep", etc. */
  pitch_label?: string | null;
  /**
   * Detailed breakdown of pitch segments for complex multi-pitch roofs.
   * Shape is left flexible for future provider-specific formats.
   */
  pitch_segments?: Array<Record<string, unknown>> | null;
  /** Number of stories / building height category (e.g. "1", "2", "3+"). */
  stories?: string | null;
  /** Roof complexity: "simple", "moderate", "complex". */
  roof_complexity?: string | null;
  /** Roof type: "gable", "hip", "mansard", "flat", etc. */
  roof_type?: string | null;
  /** Number of separate structures on the property included in this measurement. */
  structure_count?: number | null;
  /** Total number of roof facets/planes. */
  roof_facets_count?: number | null;

  // -------------------------------------------------------------------------
  // Line measurements (linear feet)
  // -------------------------------------------------------------------------

  /** Eaves linear feet (bottom horizontal edges). */
  eaves_lf?: number | null;
  /** Rakes linear feet (sloped side edges at gable ends). */
  rakes_lf?: number | null;
  /** Ridges linear feet (horizontal peaks). */
  ridges_lf?: number | null;
  /** Hips linear feet (sloped peaks where planes meet). */
  hips_lf?: number | null;
  /** Valleys linear feet (interior angles where planes meet). */
  valleys_lf?: number | null;
  /** Wall flashing linear feet (vertical wall / roof intersections). */
  wall_flashing_lf?: number | null;
  /** Step flashing linear feet (along walls parallel to slope). */
  step_flashing_lf?: number | null;
  /** Transitions / headwall linear feet. */
  transitions_lf?: number | null;
  /** Parapet wall linear feet. */
  parapet_wall_lf?: number | null;
  /** Drip edge linear feet (typically eaves + rakes). */
  drip_edge_lf?: number | null;
  /** Starter strip linear feet (typically eaves). */
  starter_lf?: number | null;
  /** Ridge cap linear feet (ridges + hips). */
  ridge_cap_lf?: number | null;

  // -------------------------------------------------------------------------
  // Penetrations / accessories (counts)
  // -------------------------------------------------------------------------

  pipe_boots_count?: number | null;
  vents_count?: number | null;
  skylights_count?: number | null;
  chimneys_count?: number | null;
  satellite_dishes_count?: number | null;
  /** Flexible container for any other penetrations not listed above. */
  other_penetrations?: Record<string, unknown> | null;

  // -------------------------------------------------------------------------
  // Tear-off / disposal
  // -------------------------------------------------------------------------

  /** Number of existing roofing layers to be removed. */
  existing_layers_count?: number | null;
  tear_off_required?: boolean | null;
  /** Estimated debris weight in tons based on area and layer count. */
  debris_tons_estimate?: number | null;
  disposal_notes?: string | null;

  // -------------------------------------------------------------------------
  // Report / diagram metadata
  // -------------------------------------------------------------------------

  /** True if a measurement report file is attached to this record. */
  report_attached: boolean;
  /** Status of the report: "pending", "processing", "available", "failed", etc. */
  report_status?: string | null;
  /** True if a roof diagram/sketch is available. */
  diagram_available: boolean;
  /** File ID of the attached report in the attachments store. */
  report_file_id?: string | null;
  /** Report type: "eagleview", "hover", "roofr", "hover_ai", "manual_sketch", etc. */
  report_type?: string | null;
  /** Report source provider name. */
  report_source?: string | null;
  report_last_updated_at?: string | null;

  // -------------------------------------------------------------------------
  // Flexible / provider / AI fields
  // -------------------------------------------------------------------------

  /**
   * Raw unprocessed payload from a provider or AI model.
   * Preserved for audit, debugging, and future remapping.
   */
  raw_measurements?: Record<string, unknown> | null;
  /**
   * Assumptions made during derivation (e.g. default waste, estimated pitch).
   * AI/provider-generated records should document assumptions here.
   */
  assumptions?: Record<string, unknown> | null;
  /** Warnings or informational messages about this record's data quality. */
  warnings?: MeasurementWarning[] | null;
  /** Names of fields that are expected but missing or below acceptable confidence. */
  missing_fields?: string[] | null;
  /**
   * Quantities derived from this record for catalog / price book consumption.
   * See MeasurementQuantityMap for the full contract.
   * Populated after measurements are processed; drives material and labor line items.
   */
  quantity_map?: MeasurementQuantityMap | null;

  // -------------------------------------------------------------------------
  // Readiness
  // -------------------------------------------------------------------------

  /** Completeness score from 0 to 100. */
  measurement_readiness_score?: number | null;
  /**
   * True when this record has enough data to produce a proposal/estimate draft.
   */
  estimate_ready: boolean;
  /**
   * True when this record is complete enough for material ordering and production.
   */
  production_ready: boolean;
};

// ---------------------------------------------------------------------------
// MeasurementSummary — lightweight snapshot copy
// ---------------------------------------------------------------------------

/**
 * Lightweight summary of a MeasurementRecord for use inside estimate snapshots.
 *
 * This allows fast restore and display of the selected measurement without
 * fetching the full MeasurementRecord. It is intentionally a strict subset.
 * Do not add every line measurement here.
 */
export type MeasurementSummary = {
  id: string;
  status: MeasurementStatus;
  source_type: MeasurementSourceType;
  confidence_label?: MeasurementConfidenceLabel | null;
  is_verified: boolean;
  roof_squares?: number | null;
  adjusted_roof_squares?: number | null;
  waste_percent?: number | null;
  /** Human-readable pitch label from the full record. */
  pitch_label?: string | null;
  stories?: string | null;
  estimate_ready: boolean;
  production_ready?: boolean;
};

// ---------------------------------------------------------------------------
// MeasurementRecordDraft — for creation forms / API payloads
// ---------------------------------------------------------------------------

/**
 * Used when constructing a new MeasurementRecord before it is persisted.
 * id, created_at, and updated_at are optional so they can be assigned by the
 * database or storage layer on write.
 */
export type MeasurementRecordDraft = Omit<
  MeasurementRecord,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

// ---------------------------------------------------------------------------
// MeasurementSourceDisplay — UI helper shape
// ---------------------------------------------------------------------------

/**
 * Display metadata for a MeasurementSourceType.
 *
 * Not a function — shape only. Used later to drive UI labels without
 * coupling display logic to the type definitions.
 *
 * Example usage:
 *   const SOURCE_DISPLAY: Record<MeasurementSourceType, MeasurementSourceDisplay> = { ... }
 */
export type MeasurementSourceDisplay = {
  /** Short human-readable label for the source. */
  label: string;
  /** Longer description shown in tooltips or detail views. */
  description: string;
  /**
   * True when records from this source should require contractor verification
   * before being used in proposals or material orders.
   */
  requiresVerification: boolean;
};
