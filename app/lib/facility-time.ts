export const FACILITY_TIME_ZONE = "Africa/Lagos";

const dateKeyFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: FACILITY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const timestampFormat = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: FACILITY_TIME_ZONE,
});
const timeFormat = new Intl.DateTimeFormat("en-NG", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: FACILITY_TIME_ZONE,
});
const weekStartFormat = new Intl.DateTimeFormat("en-NG", {
  month: "short",
  day: "numeric",
  timeZone: FACILITY_TIME_ZONE,
});
const weekEndFormat = new Intl.DateTimeFormat("en-NG", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: FACILITY_TIME_ZONE,
});
const calendarDayFormat = new Intl.DateTimeFormat("en-NG", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: FACILITY_TIME_ZONE,
});
const weekdayFormat = new Intl.DateTimeFormat("en-NG", {
  weekday: "short",
  timeZone: FACILITY_TIME_ZONE,
});

export function facilityDateKey(date: Date) {
  const values = Object.fromEntries(
    dateKeyFormat.formatToParts(date).map(({ type, value }) => [type, value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export function facilityDateStart(date: Date) {
  return new Date(`${facilityDateKey(date)}T00:00:00+01:00`);
}

export function formatFacilityTimestamp(date: Date) {
  return timestampFormat.format(date);
}

export function formatFacilityTime(date: Date) {
  return timeFormat.format(date);
}

export function formatFacilityWeekStart(date: Date) {
  return weekStartFormat.format(date);
}

export function formatFacilityWeekEnd(date: Date) {
  return weekEndFormat.format(date);
}

export function formatFacilityCalendarDay(date: Date) {
  return calendarDayFormat.format(date);
}

export function formatFacilityWeekday(date: Date) {
  return weekdayFormat.format(date);
}
