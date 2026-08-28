/**
 * Composed Job Activity read model.
 *
 * Presentation lives in jobActivityChronology. This file keeps the historical
 * import path for Job Card, tests, and harnesses.
 *
 * Activity tells the job story. Payments, tasks, attachments, measurement
 * edits, customer requests, and signatures stay out of the contractor timeline.
 */

export {
  composeJobActivityItems,
  composeJobActivityChronology,
  JOB_ACTIVITY_FORBIDDEN_EVENT_TYPES,
  JOB_ACTIVITY_VISIBILITY,
  type ComposeJobActivityInput,
  type JobActivityChronologyRow,
  type JobActivityVisibility,
} from "@/app/lib/jobActivityChronology";
