/**
 * Calendar timezone vs schedule ownership + visible-range generation guard.
 * Timezone failure / not_set must not fabricate an empty schedule world.
 */

export type CalendarViewKind = "month" | "week";

export type CalendarScheduleReadStatus =
  | "idle"
  | "loading"
  | "ready"
  | "error"
  | "blocked";

export type CalendarVisibleRange = {
  view: CalendarViewKind;
  firstVisibleOn: string;
  afterLastVisibleOn: string;
};

export function calendarVisibleRangesEqual(
  a: CalendarVisibleRange,
  b: CalendarVisibleRange
): boolean {
  return (
    a.view === b.view &&
    a.firstVisibleOn === b.firstVisibleOn &&
    a.afterLastVisibleOn === b.afterLastVisibleOn
  );
}

export function shouldApplyCalendarLoadResult(input: {
  currentGeneration: number;
  resultGeneration: number;
  currentRange: CalendarVisibleRange;
  resultRange: CalendarVisibleRange;
}): boolean {
  return (
    input.currentGeneration === input.resultGeneration &&
    calendarVisibleRangesEqual(input.currentRange, input.resultRange)
  );
}

/** Last-known company IANA timezone may be used for range reads after GET error. */
export function timezoneForCalendarRangeRead(input: {
  currentTimezone: string | null | undefined;
  lastKnownTimezone: string | null | undefined;
  timezoneLoadStatus: "loading" | "ready" | "error";
}): string | null {
  const current = String(input.currentTimezone ?? "").trim();
  if (current) return current;
  if (input.timezoneLoadStatus === "error") {
    const last = String(input.lastKnownTimezone ?? "").trim();
    return last || null;
  }
  return null;
}

export function parseCalendarScheduleEventsResult(
  responseOk: boolean,
  json: unknown
): { status: "ready"; events: unknown[] } | { status: "error" } {
  if (!responseOk) return { status: "error" };
  if (!json || typeof json !== "object") return { status: "error" };
  const events = (json as { events?: unknown }).events;
  if (!Array.isArray(events)) return { status: "error" };
  return { status: "ready", events };
}

export function nextEventsAfterTimezoneFailure<T>(previousEvents: T[]): T[] {
  return previousEvents;
}

export function nextEventsAfterScheduleFailure<T>(previousEvents: T[]): T[] {
  return previousEvents;
}

export function calendarScheduleBlockedWithoutTimezone(
  rangeTimezone: string | null
): boolean {
  return !rangeTimezone;
}

export function isFabricatedEmptyScheduleWorld(input: {
  timezoneKind: "loading" | "error" | "not_set" | "saved";
  scheduleStatus: CalendarScheduleReadStatus;
  eventsLength: number;
}): boolean {
  if (input.timezoneKind === "error" || input.timezoneKind === "not_set") {
    return input.scheduleStatus === "ready" && input.eventsLength === 0;
  }
  return false;
}

export function isTrueEmptySchedule(input: {
  timezoneKind: "loading" | "error" | "not_set" | "saved";
  scheduleStatus: CalendarScheduleReadStatus;
  eventsLength: number;
}): boolean {
  return (
    input.timezoneKind === "saved" &&
    input.scheduleStatus === "ready" &&
    input.eventsLength === 0
  );
}
