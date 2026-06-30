import { getTimes, getPosition } from 'suncalc';
import { DateTime, IANAZone } from 'luxon';

export interface SubsolarPoint {
  /** Subsolar latitude (declination) in degrees */
  lat: number;
  /** Subsolar longitude in degrees (-180 to 180) */
  lng: number;
}

/**
 * Get the subsolar point at a given UTC date using suncalc.
 * Derives declination and Equation of Time from suncalc's internal
 * Meeus-based calculations via getTimes/getPosition, avoiding manual
 * harmonic approximations.
 */
export function getSubsolarPoint(date: Date): SubsolarPoint {
  // Solar noon at the Prime Meridian (lat=0, lng=0).
  const times = getTimes(date, 0, 0);
  if (!times.solarNoon) {
    // Fallback (should never happen at the equator)
    return { lat: 0, lng: 0 };
  }
  const noon = times.solarNoon;

  // Declination = solar altitude at noon at the equator.
  // At lat=0 on the meridian: altitude = 90° − |declination|.
  const noonPos = getPosition(noon, 0, 0);
  const absDec = 90 - noonPos.altitude;

  // Determine sign from day of year: roughly positive Mar 20 – Sep 22.
  const doy = Math.floor(
    (date.getTime() - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86400000,
  );
  const dec = (doy >= 79 && doy < 266) ? absDec : -absDec;

  // Equation of Time: difference between solar noon and 12:00 UTC (hours).
  const noonUTC =
    noon.getUTCHours() +
    noon.getUTCMinutes() / 60 +
    noon.getUTCSeconds() / 3600;
  const eotHours = noonUTC - 12;

  // Subsolar longitude from UTC hour + EoT.
  const utcHour =
    date.getUTCHours() +
    date.getUTCMinutes() / 60 +
    date.getUTCSeconds() / 3600;
  let subLng = ((utcHour - 12) * 15 + eotHours * 15 + 540) % 360 - 180;

  return { lat: dec, lng: subLng };
}

export interface SunDay {
  /** Day of year (1-365) */
  dayOfYear: number;
  /** Date label (MMM D) */
  label: string;
  /** Sunrise as decimal hour */
  sunriseHour: number;
  /** Sunset as decimal hour */
  sunsetHour: number;
  /** Day length in hours */
  dayLength: number;
  /** Solar noon as decimal hour */
  solarNoonHour: number;
  /** Max elevation (altitude at solar noon) in degrees */
  maxElevation: number;
  /** Elevation at chosen time, in degrees */
  elevationAtTime: number | null;
  /** Azimuth at chosen time, in degrees */
  azimuthAtTime: number | null;
  /** Sunrise azimuth (0=north), in degrees */
  sunriseAzimuth: number;
  /** Sunset azimuth (0=north), in degrees */
  sunsetAzimuth: number;
}

/**
 * Compute sun data for every day of the year at a given location and timezone.
 *
 * @param year        The year to compute for
 * @param lat         Latitude
 * @param lng         Longitude
 * @param tz          IANA timezone string
 * @param observeDst  Whether to respect DST in time-of-day output
 * @param zenithMode  'smooth': extend past 90° for tropical locations;
 *                    'mirror': standard astronomical elevation (0–90°)
 *                    elevation/azimuth at. Interpreted in the given timezone
 *                    (respecting observeDst).
 */
export function computeYearlySunData(
  year: number,
  lat: number,
  lng: number,
  tz: string,
  observeDst: boolean,
  targetHour?: number,
  zenithMode: 'smooth' | 'mirror' = 'smooth',
): SunDay[] {
  const results: SunDay[] = [];
  const zone = IANAZone.create(tz);

  // Determine the standard-time offset (the offset without DST) for this zone.
  // We check both Jan 1 and Jul 1 and take the smaller absolute offset —
  // this works for both northern and southern hemisphere zones.
  const jan1 = DateTime.fromObject({ year, month: 1, day: 1 }, { zone });
  const jul1 = DateTime.fromObject({ year, month: 7, day: 1 }, { zone });
  const standardOffset = Math.min(jan1.offset, jul1.offset);

  /** Given a DateTime in the local zone, return the decimal hour,
   *  optionally stripping the DST offset so the result is in standard time. */
  function toHour(dt: DateTime, stripDst: boolean): number {
    const localHour = dt.hour + dt.minute / 60 + dt.second / 3600;
    if (!stripDst) return localHour;
    // If this moment is in DST, subtract the DST shift so we show standard time
    const dstMinutes = dt.offset - standardOffset;
    return localHour - dstMinutes / 60;
  }

  const start = DateTime.fromObject({ year, month: 1, day: 1 }, { zone });

  // Smooth mode: for locations between the tropics the sun crosses the
  // zenith. Use signed declination math so the elevation curve passes
  // continuously through 90°. Outside the tropics the standard 0–90
  // formula is used regardless of mode (no crossing possible).
  const useSignedElevation = zenithMode === 'smooth' && Math.abs(lat) < 23.5;

  for (let i = 0; i < 365; i++) {
    const localDate = start.plus({ days: i });

    // Get the JS Date at noon local time for suncalc (suncalc uses local
    // time of the system, so we feed it a UTC-based JS Date that corresponds
    // to the desired local date).
    const dateForCalc = new Date(Date.UTC(
      localDate.year,
      localDate.month - 1,
      localDate.day,
      12, 0, 0,
    ));

    const times = getTimes(dateForCalc, lat, lng);

    const sunrise = times.sunrise;
    const sunset = times.sunset;
    const solarNoon = times.solarNoon;

    // Handle polar regions where sun may not rise/set
    if (!sunrise || !sunset || !solarNoon) {
      results.push({
        dayOfYear: i + 1,
        label: localDate.toFormat('MMM d'),
        sunriseHour: 0,
        sunsetHour: 24,
        dayLength: sunrise ? 0 : 24, // polar day/night
        solarNoonHour: 12,
        maxElevation: 0,
        elevationAtTime: null,
        azimuthAtTime: null,
        sunriseAzimuth: 0,
        sunsetAzimuth: 0,
      });
      continue;
    }

    // Convert JS Date back to DateTime in the target zone
    const sunriseDt = DateTime.fromJSDate(sunrise, { zone: 'utc' }).setZone(zone);
    const sunsetDt = DateTime.fromJSDate(sunset, { zone: 'utc' }).setZone(zone);
    const noonDt = DateTime.fromJSDate(solarNoon, { zone: 'utc' }).setZone(zone);

    const dayLengthHours =
      (sunset.getTime() - sunrise.getTime()) / 3600000;

    // Compute max elevation. In smooth mode for tropical latitudes use
    // signed declination: maxElev = 90 − (lat − δ). Single formula, no
    // per-day conditionals — the curve passes continuously through 90°.
    const noonPos = getPosition(solarNoon, lat, lng);

    let maxElev: number;
    if (useSignedElevation) {
      const dayAngle = (2 * Math.PI * (i + 1)) / 365;
      const declination = -23.44 * Math.cos(dayAngle + (2 * Math.PI * 10) / 365);
      maxElev = 90 - (lat - declination);
    } else {
      maxElev = noonPos.altitude;
    }

    // Sample at target hour if provided
    let elevationAtTime: number | null = null;
    let azimuthAtTime: number | null = null;

    if (targetHour !== undefined) {
      const targetDt = localDate.set({
        hour: Math.floor(targetHour),
        minute: Math.round((targetHour % 1) * 60),
      });
      // Convert local time to UTC before creating JS Date for suncalc
      const targetUtc = targetDt.toUTC();
      const targetJs = new Date(Date.UTC(
        targetUtc.year,
        targetUtc.month - 1,
        targetUtc.day,
        targetUtc.hour,
        targetUtc.minute,
        0,
      ));
      const pos = getPosition(targetJs, lat, lng);
      elevationAtTime = pos.altitude;
      azimuthAtTime = pos.azimuth;
    }

    // Compute sunrise/sunset hours for output.
    // When observeDst is false we strip the DST offset so times are in
    // local *standard* time (not UTC), avoiding the pre-midnight wrap.
    const srHour = toHour(sunriseDt, !observeDst);
    const ssHour = toHour(sunsetDt, !observeDst);
    const snHour = toHour(noonDt, !observeDst);

    // Compute sunrise/sunset azimuth.
    // suncalc already uses 0=north convention.
    const srAzimuth = getPosition(sunrise, lat, lng).azimuth;
    const ssAzimuth = getPosition(sunset, lat, lng).azimuth;

    results.push({
      dayOfYear: i + 1,
      label: localDate.toFormat('MMM d'),
      sunriseHour: srHour,
      sunsetHour: ssHour,
      dayLength: dayLengthHours,
      solarNoonHour: snHour,
      maxElevation: maxElev,
      elevationAtTime,
      azimuthAtTime,
      sunriseAzimuth: srAzimuth,
      sunsetAzimuth: ssAzimuth,
    });
  }

  return results;
}

/**
 * Compute the sun's elevation and azimuth at a given target hour for
 * a specific day and location. Uses suncalc for accuracy.
 */
export function getElevationAtTime(
  year: number,
  dayOfYear: number,
  lat: number,
  lng: number,
  tz: string,
  targetHour: number,
): { elevation: number; azimuth: number } | null {
  try {
    const start = DateTime.fromObject({ year, month: 1, day: 1 }, { zone: tz });
    const localDate = start.plus({ days: dayOfYear - 1 });
    const targetDt = localDate.set({
      hour: Math.floor(targetHour),
      minute: Math.round((targetHour % 1) * 60),
    });
    const targetUtc = targetDt.toUTC();
    const targetJs = new Date(Date.UTC(
      targetUtc.year,
      targetUtc.month - 1,
      targetUtc.day,
      targetUtc.hour,
      targetUtc.minute,
      0,
    ));
    const pos = getPosition(targetJs, lat, lng);
    return { elevation: pos.altitude, azimuth: pos.azimuth };
  } catch {
    return null;
  }
}

export interface HourlyPosition {
  hour: number;       // decimal hour (local)
  azimuth: number;    // degrees, 0=north
  elevation: number;  // degrees
}

/**
 * Get the sun's position at 15-minute intervals for a specific day.
 * Samples from sunrise to sunset (found via suncalc) to ensure the
 * full daylight arc is captured regardless of timezone offset.
 */
export function getHourlyPositions(
  year: number,
  dayOfYear: number,
  lat: number,
  lng: number,
): HourlyPosition[] {
  const results: HourlyPosition[] = [];

  // Find sunrise/sunset for this day at UTC noon reference
  const noonRef = new Date(Date.UTC(year, 0, dayOfYear, 12, 0, 0));
  const times = getTimes(noonRef, lat, lng);
  if (!times.sunrise || !times.sunset) {
    // Polar day/night: sample full 24h
    for (let minute = 0; minute < 24 * 60; minute += 15) {
      const t = new Date(Date.UTC(year, 0, dayOfYear, 0, 0, 0, minute * 60000));
      const pos = getPosition(t, lat, lng);
      results.push({
        hour: minute / 60,
        azimuth: pos.azimuth,
        elevation: pos.altitude,
      });
    }
    return results;
  }

  // Sample from sunrise to sunset at 15-min intervals
  const startMs = times.sunrise.getTime();
  const endMs = times.sunset.getTime();
  for (let ms = startMs; ms <= endMs; ms += 15 * 60000) {
    const t = new Date(ms);
    const pos = getPosition(t, lat, lng);
    results.push({
      hour: t.getUTCHours() + t.getUTCMinutes() / 60,
      azimuth: pos.azimuth,
      elevation: pos.altitude,
    });
  }

  return results;
}
