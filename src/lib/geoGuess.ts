/**
 * Guess the user's approximate location without asking for browser permissions.
 *
 * Strategy:
 * 1. Try free IP geolocation (ipapi.co) — no API key, gives lat/lng/city/tz
 * 2. Fall back to Intl timezone lookup map
 * 3. Fall back to New York
 */

export interface GuessedLocation {
  lat: number;
  lng: number;
  tz: string;
  label: string;
}

/** Major timezone → approximate city coordinates. Covers ~95% of users. */
const TZ_MAP: Record<string, { lat: number; lng: number; label: string }> = {
  // Americas
  'America/New_York':    { lat: 40.71, lng: -74.01, label: 'New York' },
  'America/Chicago':     { lat: 41.88, lng: -87.63, label: 'Chicago' },
  'America/Denver':      { lat: 39.74, lng: -104.99, label: 'Denver' },
  'America/Los_Angeles': { lat: 34.05, lng: -118.24, label: 'Los Angeles' },
  'America/Anchorage':   { lat: 61.22, lng: -149.90, label: 'Anchorage' },
  'America/Toronto':     { lat: 43.65, lng: -79.38, label: 'Toronto' },
  'America/Vancouver':   { lat: 49.28, lng: -123.12, label: 'Vancouver' },
  'America/Mexico_City': { lat: 19.43, lng: -99.13, label: 'Mexico City' },
  'America/Sao_Paulo':   { lat: -23.55, lng: -46.63, label: 'São Paulo' },
  'America/Argentina/Buenos_Aires': { lat: -34.60, lng: -58.38, label: 'Buenos Aires' },
  'America/Bogota':      { lat: 4.71, lng: -74.07, label: 'Bogotá' },
  'America/Lima':        { lat: -12.05, lng: -77.04, label: 'Lima' },
  'America/Santiago':    { lat: -33.45, lng: -70.67, label: 'Santiago' },

  // Europe
  'Europe/London':       { lat: 51.51, lng: -0.13, label: 'London' },
  'Europe/Paris':        { lat: 48.86, lng: 2.35, label: 'Paris' },
  'Europe/Berlin':       { lat: 52.52, lng: 13.40, label: 'Berlin' },
  'Europe/Madrid':       { lat: 40.42, lng: -3.70, label: 'Madrid' },
  'Europe/Rome':         { lat: 41.90, lng: 12.50, label: 'Rome' },
  'Europe/Amsterdam':    { lat: 52.37, lng: 4.90, label: 'Amsterdam' },
  'Europe/Stockholm':    { lat: 59.33, lng: 18.07, label: 'Stockholm' },
  'Europe/Warsaw':       { lat: 52.23, lng: 21.01, label: 'Warsaw' },
  'Europe/Kyiv':         { lat: 50.45, lng: 30.52, label: 'Kyiv' },
  'Europe/Moscow':       { lat: 55.76, lng: 37.62, label: 'Moscow' },
  'Europe/Istanbul':     { lat: 41.01, lng: 28.98, label: 'Istanbul' },
  'Europe/Athens':       { lat: 37.98, lng: 23.73, label: 'Athens' },
  'Europe/Lisbon':       { lat: 38.72, lng: -9.14, label: 'Lisbon' },
  'Europe/Dublin':       { lat: 53.35, lng: -6.26, label: 'Dublin' },
  'Europe/Oslo':         { lat: 59.91, lng: 10.75, label: 'Oslo' },
  'Europe/Helsinki':     { lat: 60.17, lng: 24.94, label: 'Helsinki' },
  'Europe/Copenhagen':   { lat: 55.68, lng: 12.57, label: 'Copenhagen' },
  'Europe/Vienna':       { lat: 48.21, lng: 16.37, label: 'Vienna' },
  'Europe/Prague':       { lat: 50.08, lng: 14.44, label: 'Prague' },
  'Europe/Budapest':     { lat: 47.50, lng: 19.04, label: 'Budapest' },
  'Europe/Bucharest':    { lat: 44.43, lng: 26.10, label: 'Bucharest' },
  'Europe/Zurich':       { lat: 47.38, lng: 8.54, label: 'Zurich' },
  'Europe/Brussels':     { lat: 50.85, lng: 4.35, label: 'Brussels' },

  // Asia-Pacific
  'Asia/Tokyo':          { lat: 35.68, lng: 139.76, label: 'Tokyo' },
  'Asia/Shanghai':       { lat: 31.23, lng: 121.47, label: 'Shanghai' },
  'Asia/Hong_Kong':      { lat: 22.32, lng: 114.17, label: 'Hong Kong' },
  'Asia/Singapore':      { lat: 1.35, lng: 103.82, label: 'Singapore' },
  'Asia/Seoul':          { lat: 37.57, lng: 126.98, label: 'Seoul' },
  'Asia/Kolkata':        { lat: 22.57, lng: 88.36, label: 'Kolkata' },
  'Asia/Dubai':          { lat: 25.20, lng: 55.27, label: 'Dubai' },
  'Asia/Bangkok':        { lat: 13.76, lng: 100.50, label: 'Bangkok' },
  'Asia/Jakarta':        { lat: -6.21, lng: 106.85, label: 'Jakarta' },
  'Asia/Manila':         { lat: 14.60, lng: 120.98, label: 'Manila' },
  'Asia/Taipei':         { lat: 25.03, lng: 121.57, label: 'Taipei' },
  'Asia/Kuala_Lumpur':   { lat: 3.14, lng: 101.69, label: 'Kuala Lumpur' },
  'Asia/Ho_Chi_Minh':    { lat: 10.82, lng: 106.63, label: 'Ho Chi Minh City' },
  'Asia/Tel_Aviv':       { lat: 32.09, lng: 34.78, label: 'Tel Aviv' },
  'Asia/Riyadh':         { lat: 24.71, lng: 46.68, label: 'Riyadh' },
  'Asia/Tehran':         { lat: 35.69, lng: 51.39, label: 'Tehran' },

  // Oceania
  'Australia/Sydney':    { lat: -33.87, lng: 151.21, label: 'Sydney' },
  'Australia/Melbourne': { lat: -37.81, lng: 144.96, label: 'Melbourne' },
  'Australia/Brisbane':  { lat: -27.47, lng: 153.03, label: 'Brisbane' },
  'Australia/Perth':     { lat: -31.95, lng: 115.86, label: 'Perth' },
  'Pacific/Auckland':    { lat: -36.85, lng: 174.76, label: 'Auckland' },

  // Africa
  'Africa/Cairo':        { lat: 30.04, lng: 31.24, label: 'Cairo' },
  'Africa/Johannesburg': { lat: -26.20, lng: 28.05, label: 'Johannesburg' },
  'Africa/Lagos':        { lat: 6.45, lng: 3.40, label: 'Lagos' },
  'Africa/Nairobi':      { lat: -1.29, lng: 36.82, label: 'Nairobi' },
  'Africa/Casablanca':   { lat: 33.57, lng: -7.59, label: 'Casablanca' },
  'Africa/Cape_Town':    { lat: -33.92, lng: 18.42, label: 'Cape Town' },
};

function guessFromTimezone(): GuessedLocation | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const entry = TZ_MAP[tz];
    if (entry) {
      return { lat: entry.lat, lng: entry.lng, tz, label: entry.label };
    }
    return null;
  } catch {
    return null;
  }
}

/** Diverse cities for random fallback when all geo-guess tiers fail. */
const RANDOM_CITIES: GuessedLocation[] = [
  { lat: 35.68, lng: 139.76, tz: 'Asia/Tokyo', label: 'Tokyo' },
  { lat: -33.87, lng: 151.21, tz: 'Australia/Sydney', label: 'Sydney' },
  { lat: 51.51, lng: -0.13, tz: 'Europe/London', label: 'London' },
  { lat: -23.55, lng: -46.63, tz: 'America/Sao_Paulo', label: 'São Paulo' },
  { lat: 55.76, lng: 37.62, tz: 'Europe/Moscow', label: 'Moscow' },
  { lat: -1.29, lng: 36.82, tz: 'Africa/Nairobi', label: 'Nairobi' },
  { lat: 19.43, lng: -99.13, tz: 'America/Mexico_City', label: 'Mexico City' },
  { lat: 48.86, lng: 2.35, tz: 'Europe/Paris', label: 'Paris' },
  { lat: 22.32, lng: 114.17, tz: 'Asia/Hong_Kong', label: 'Hong Kong' },
  { lat: -26.20, lng: 28.05, tz: 'Africa/Johannesburg', label: 'Johannesburg' },
  { lat: 1.35, lng: 103.82, tz: 'Asia/Singapore', label: 'Singapore' },
  { lat: 59.33, lng: 18.07, tz: 'Europe/Stockholm', label: 'Stockholm' },
];

function randomCity(): GuessedLocation {
  return RANDOM_CITIES[Math.floor(Math.random() * RANDOM_CITIES.length)];
}

async function guessFromIp(): Promise<GuessedLocation | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.latitude && data.longitude && data.timezone) {
      return {
        lat: data.latitude,
        lng: data.longitude,
        tz: data.timezone,
        label: data.city || data.region || data.country_name || 'Unknown',
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function guessLocation(): Promise<GuessedLocation> {
  // 1. Try IP geolocation (most accurate)
  const ipResult = await guessFromIp();
  if (ipResult) return ipResult;

  // 2. Fall back to Intl timezone → city map
  const tzResult = guessFromTimezone();
  if (tzResult) return tzResult;

  // 3. Absolute fallback — pick a random diverse city
  return randomCity();
}
