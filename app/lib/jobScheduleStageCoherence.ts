import type { CanonicalJobStage } from './jobLifecycleTypes';
import type { StoredJobStage } from './jobLifecycleTypes';

export type PlannedScheduleReadStatus = 'loading' | 'ready' | 'error';

export type StageLifecycleClass =
  | 'MODERN_OPERATIONAL'
  | 'LEGACY_READABLE_NONOPERATIONAL'
  | 'INVALID';

export type PlannedScheduleCoherence =
  | 'unknown'
  | 'coherent'
  | 'missing_planned_schedule'
  | 'unexpected_planned_schedule';

const MODERN_OPERATIONAL: ReadonlySet<string> = new Set([
  'intake',
  'proposal',
  'approved',
  'scheduled',
  'production',
  'complete',
]);

const LEGACY_READABLE_NONOPERATIONAL: ReadonlySet<string> = new Set([
  'measurement',
  'estimating',
  'archived',
]);

export function classifyJobStageLifecycle(
  stage: string | null | undefined
): StageLifecycleClass {
  const token = String(stage ?? '')
    .trim()
    .toLowerCase();
  if (MODERN_OPERATIONAL.has(token)) return 'MODERN_OPERATIONAL';
  if (LEGACY_READABLE_NONOPERATIONAL.has(token)) {
    return 'LEGACY_READABLE_NONOPERATIONAL';
  }
  return 'INVALID';
}

/** Trust only SUCCESS reads for schedule-dependent lifecycle decisions. */
export function plannedScheduleReadIsAuthoritative(
  readStatus: PlannedScheduleReadStatus | null | undefined
): boolean {
  return readStatus === 'ready';
}

export function expectedPlannedScheduleCount(
  stage: CanonicalJobStage | StoredJobStage | string
): 0 | 1 | null {
  const token = String(stage ?? '')
    .trim()
    .toLowerCase();
  if (
    token === 'scheduled' ||
    token === 'production' ||
    token === 'complete'
  ) {
    return 1;
  }
  if (
    token === 'intake' ||
    token === 'proposal' ||
    token === 'approved' ||
    token === 'measurement' ||
    token === 'estimating' ||
    token === 'archived'
  ) {
    return 0;
  }
  return null;
}

export function resolvePlannedScheduleCoherence(input: {
  stage: CanonicalJobStage | StoredJobStage | string;
  plannedScheduleCount: number;
  readStatus?: PlannedScheduleReadStatus;
}): PlannedScheduleCoherence {
  if (!plannedScheduleReadIsAuthoritative(input.readStatus ?? 'ready')) {
    return 'unknown';
  }
  const expected = expectedPlannedScheduleCount(input.stage);
  if (expected === null) return 'unknown';
  if (input.plannedScheduleCount === expected) return 'coherent';
  return expected === 1
    ? 'missing_planned_schedule'
    : 'unexpected_planned_schedule';
}

export function plannedScheduleIntegrityLabel(
  coherence: PlannedScheduleCoherence
): string | null {
  if (coherence === 'missing_planned_schedule') {
    return 'Planned schedule missing; lifecycle actions are blocked.';
  }
  if (coherence === 'unexpected_planned_schedule') {
    return 'Unexpected planned schedule; lifecycle actions are blocked.';
  }
  if (coherence === 'unknown') {
    return 'Planned schedule status unavailable; lifecycle actions are blocked.';
  }
  return null;
}

export function boardScheduleLoadBanner(
  readStatus: PlannedScheduleReadStatus
): string | null {
  if (readStatus === 'loading') {
    return 'Loading planned schedules…';
  }
  if (readStatus === 'error') {
    return 'Could not load planned schedules. Schedule actions are blocked until refresh succeeds.';
  }
  return null;
}
