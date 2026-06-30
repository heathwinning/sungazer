import { DateTime, IANAZone } from 'luxon';
import tzlookup from 'tz-lookup';

/** Look up the IANA timezone string for given coordinates */
export function lookupTimezone(lat: number, lng: number): string {
  return tzlookup(lat, lng);
}

/** Generate all days of a given year as luxon DateTimes, optionally adjusting for DST */
export function daysOfYear(
  year: number,
  tz: string,
  observeDst: boolean,
): DateTime[] {
  const zone = IANAZone.create(tz);
  const days: DateTime[] = [];
  const start = DateTime.fromObject({ year, month: 1, day: 1 }, { zone });
  for (let i = 0; i < 365; i++) {
    const dt = start.plus({ days: i });
    if (observeDst) {
      days.push(dt);
    } else {
      // Re-interpret the UTC timestamp in UTC, effectively ignoring DST
      days.push(DateTime.fromMillis(dt.toMillis(), { zone: 'utc' }));
    }
  }
  return days;
}

/** Format a DateTime as HH:MM in the given timezone (or UTC if !observeDst) */
export function formatTime(dt: DateTime, observeDst: boolean): string {
  if (observeDst) {
    return dt.toFormat('HH:mm');
  }
  return DateTime.fromMillis(dt.toMillis(), { zone: 'utc' }).toFormat('HH:mm');
}

/** Return the hour-of-day as a decimal (e.g. 14.5 for 14:30) */
export function hourDecimal(dt: DateTime, observeDst: boolean): number {
  if (observeDst) {
    return dt.hour + dt.minute / 60;
  }
  const utc = DateTime.fromMillis(dt.toMillis(), { zone: 'utc' });
  return utc.hour + utc.minute / 60;
}
