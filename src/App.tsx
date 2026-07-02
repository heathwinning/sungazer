import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { DateTime } from 'luxon';
import LocationCard from './components/LocationCard';
import SearchableSelect from './components/SearchableSelect';
import DayLengthChart from './components/DayLengthChart';
import ElevationChart from './components/ElevationChart';
import RiseSetAzimuthChart from './components/RiseSetAzimuthChart';
import ShadowChart from './components/ShadowChart';
import EquationOfTimeChart from './components/EquationOfTimeChart';
import SunPathPolar from './components/SunPathPolar';
import DaylightMap from './components/DaylightMap';
import SEOHead from './components/SEOHead';
import { computeYearlySunData, getHourlyPositions, getElevationAtTime } from './lib/sunCalc';
import { guessLocation } from './lib/geoGuess';
import type { LocationConfig, ChartLocation } from './lib/types';
import './lib/echartsTheme';

type ElevationMode = 'max' | 'atTime';
type ZenithMode = 'smooth' | 'mirror';

const CURRENT_YEAR = new Date().getFullYear();

// Defaults derived from current date/time for first-visit slider values.
function computeCurrentDefaults(mapTz: string) {
  const now = new Date();
  const startOfYear = Date.UTC(now.getUTCFullYear(), 0, 0);
  const doy = Math.floor((now.getTime() - startOfYear) / 86400000);

  let localHour = now.getUTCHours() + now.getUTCMinutes() / 60;
  try {
    const dt = DateTime.now().setZone(mapTz);
    if (dt.isValid) {
      localHour = dt.hour + dt.minute / 60;
    }
  } catch { /* keep UTC fallback */ }

  return {
    doy: Math.max(1, Math.min(365, doy)),
    localHour,
  };
}

const PALETTE = [
  '#f59e0b', '#22d3ee', '#a78bfa', '#f97316',
  '#34d399', '#f472b6', '#60a5fa', '#fb923c',
];

let nextId = 1;
function newId(): string { return `loc-${nextId++}`; }

const STORAGE_KEY = 'sungazer_state';
const GEOGUESSED_KEY = 'sungazer_geoguessed';

interface SavedState {
  locations: LocationConfig[];
  targetHour: number;
  elevationMode: ElevationMode;
  zenithMode: ZenithMode;
  mapTz?: string;
  polarDay?: number;
  mapDay?: number;
  mapLocalHour?: number;
}

function loadState(): SavedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.locations)) {
      const maxId = parsed.locations.reduce((max: number, loc: LocationConfig) => {
        const num = parseInt(loc.id.replace('loc-', ''), 10);
        return isNaN(num) ? max : Math.max(max, num);
      }, 0);
      nextId = maxId + 1;
    }
    return parsed;
  } catch { return null; }
}

function saveState(state: SavedState): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* quota */ }
}

/** Diverse city pool used for fallback and random new locations. */
const RANDOM_CITY_POOL = [
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

function randomCity(): { lat: number; lng: number; tz: string; label: string } {
  return RANDOM_CITY_POOL[Math.floor(Math.random() * RANDOM_CITY_POOL.length)];
}

function randomFallback(): LocationConfig {
  const c = randomCity();
  return { id: newId(), ...c, observeDst: false, color: PALETTE[0] };
}

const FALLBACK_LOCATIONS: LocationConfig[] = [randomFallback()];

export default function App() {
  const saved = loadState();

  // Compute default day-of-year & local hour from current time, using the
  // initial map timezone so the Daylight Map shows the correct "now".
  const initialMapTz =
    saved?.mapTz ?? (saved?.locations?.[0]?.tz || FALLBACK_LOCATIONS[0]?.tz || 'UTC');
  const currentDefaults = computeCurrentDefaults(initialMapTz);

  const [locations, setLocations] = useState<LocationConfig[]>(
    saved?.locations ?? FALLBACK_LOCATIONS,
  );
  const [targetHour, setTargetHour] = useState(saved?.targetHour ?? currentDefaults.localHour);
  const [elevationMode, setElevationMode] = useState<ElevationMode>(saved?.elevationMode ?? 'max');
  const [zenithMode, setZenithMode] = useState<ZenithMode>(saved?.zenithMode ?? 'smooth');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [polarDay, setPolarDay] = useState(saved?.polarDay ?? currentDefaults.doy);
  const [polarAnnual, setPolarAnnual] = useState(false);
  const [mapDay, setMapDay] = useState(saved?.mapDay ?? currentDefaults.doy);
  const [mapLocalHour, setMapLocalHour] = useState(
    Math.round(saved?.mapLocalHour ?? currentDefaults.localHour),
  );
  const [mapTz, setMapTz] = useState<string>(initialMapTz);
  const mapTzManualRef = useRef(false); // true only when user explicitly picks a TZ this session
  const dstCheckboxRef = useRef<HTMLInputElement>(null);
  const [mapCenterIdx, setMapCenterIdx] = useState(-1); // -1 = default, 0+ = location index
  const [mapObserveDst, setMapObserveDst] = useState(
    saved?.locations?.[0]?.observeDst ?? true,
  );

  // Auto-default mapTz to first location's TZ (unless user manually picked one)
  useEffect(() => {
    if (!mapTzManualRef.current && locations.length > 0) {
      setMapTz(locations[0].tz);
    }
  }, [locations]);

  // Persist settings to localStorage on every change
  useEffect(() => {
    saveState({ locations, targetHour, elevationMode, zenithMode, mapTz, polarDay, mapDay, mapLocalHour });
  }, [locations, targetHour, elevationMode, zenithMode, mapTz, polarDay, mapDay, mapLocalHour]);

  // Geo-guess only on very first visit (no saved data, not already guessed)
  useEffect(() => {
    if (saved || localStorage.getItem(GEOGUESSED_KEY)) return;
    localStorage.setItem(GEOGUESSED_KEY, '1');
    let cancelled = false;
    guessLocation().then((gl) => {
      if (cancelled) return;
      // Replace the fallback location with the guessed one
      setLocations([{
          id: newId(),
          lat: gl.lat,
          lng: gl.lng,
          tz: gl.tz,
          observeDst: false,
          label: gl.label,
          color: PALETTE[0],
        },
      ]);
    });
    return () => { cancelled = true; };
  }, []);

  const updateLocation = useCallback((id: string, patch: Partial<LocationConfig>) => {
    setLocations((prev) => prev.map((loc) =>
      loc.id === id ? { ...loc, ...patch } : loc,
    ));
  }, []);

  const removeLocation = useCallback((id: string) => {
    setLocations((prev) => {
      if (prev.length <= 1) return prev; // keep at least 1
      return prev.filter((loc) => loc.id !== id);
    });
  }, []);

  const addLocation = useCallback(() => {
    setLocations((prev) => {
      const usedColors = new Set(prev.map((l) => l.color));
      const nextColor = PALETTE.find((c) => !usedColors.has(c)) ?? PALETTE[prev.length % PALETTE.length];
      const usedLabels = new Set(prev.map((l) => l.label));
      const available = RANDOM_CITY_POOL.filter((c) => !usedLabels.has(c.label));
      const c = available.length > 0
        ? available[Math.floor(Math.random() * available.length)]
        : randomCity();
      return [
        ...prev,
        {
          id: newId(),
          ...c,
          observeDst: prev[0]?.observeDst ?? false,
          color: nextColor,
        },
      ];
    });
  }, []);

  // DST master toggle — sets all locations, shows indeterminate when mixed
  const allSameDst = useMemo(() => {
    if (locations.length === 0) return true;
    const first = locations[0].observeDst;
    return locations.every((loc) => loc.observeDst === first);
  }, [locations]);

  const globalDstChecked = locations.length > 0 && locations.every((l) => l.observeDst);

  useEffect(() => {
    if (dstCheckboxRef.current) {
      dstCheckboxRef.current.indeterminate = !allSameDst;
    }
  }, [allSameDst]);

  const setAllDst = useCallback((v: boolean) => {
    setLocations((prev) => prev.map((loc) => ({ ...loc, observeDst: v })));
    setMapObserveDst(v);
  }, []);

  const setMyLocation = useCallback((id: string) => {
    guessLocation().then((gl) => {
      setLocations((prev) => prev.map((loc) =>
        loc.id === id
          ? { ...loc, lat: gl.lat, lng: gl.lng, tz: gl.tz, label: gl.label }
          : loc,
      ));
    });
  }, []);

  // Compute base sun data for each location (no target hour — fast)
  const allSunDataBase: ChartLocation[] = useMemo(
    () => locations.map((loc) => ({
      label: loc.label,
      color: loc.color,
      data: computeYearlySunData(CURRENT_YEAR, loc.lat, loc.lng, loc.tz, loc.observeDst, undefined, zenithMode),
    })),
    [locations, zenithMode],
  );

  // Precompute elevation/azimuth for all 48 half-hour slots (0 .. 23.5)
  // so the slider just picks from a lookup table — no suncalc calls on drag.
  const allSunDataCache = useMemo(() => {
    const HOURS = 48;
    return allSunDataBase.map((loc) => {
      const baseLoc = locations.find((l) => l.label === loc.label);
      if (!baseLoc) return loc.data.map(() => new Array<(ReturnType<typeof getElevationAtTime>)>(HOURS));
      return loc.data.map((d) => {
        const row = new Array<ReturnType<typeof getElevationAtTime>>(HOURS);
        for (let h = 0; h < HOURS; h++) {
          row[h] = getElevationAtTime(CURRENT_YEAR, d.dayOfYear, baseLoc.lat, baseLoc.lng, baseLoc.tz, h / 2);
        }
        return row;
      });
    });
  }, [allSunDataBase, locations]);

  // Compute the global minimum elevation across all hours (0–23.5) and all days.
  // Used by the Elevation chart for a fixed lower Y-axis bound that never changes
  // while the user slides the time-of-day slider.
  const globalElevationMin = useMemo(() => {
    let min = Infinity;
    for (const locCache of allSunDataCache) {
      for (const dayRows of locCache) {
        if (!Array.isArray(dayRows)) continue;
        for (const entry of dayRows) {
          if (entry && isFinite(entry.elevation)) {
            min = Math.min(min, entry.elevation);
          }
        }
      }
    }
    return isFinite(min) ? min : -90;
  }, [allSunDataCache]);

  // Pick from precomputed cache — instant
  const allSunData: ChartLocation[] = useMemo(
    () => allSunDataBase.map((loc, li) => ({
      ...loc,
      data: loc.data.map((d, di) => {
        const slot = Math.round(targetHour * 2);
        const cached = allSunDataCache[li]?.[di]?.[slot];
        return { ...d, elevationAtTime: cached?.elevation ?? null, azimuthAtTime: cached?.azimuth ?? null };
      }),
    })),
    [allSunDataBase, allSunDataCache, targetHour],
  );

  // Hourly positions for the polar sun path chart
  const polarLocations = useMemo(() => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return locations.map((loc) => {
      const positions = getHourlyPositions(CURRENT_YEAR, polarDay, loc.lat, loc.lng);
      const annualPaths = polarAnnual
        ? monthNames.map((m, i) => ({
            monthLabel: m,
            positions: getHourlyPositions(CURRENT_YEAR, Math.round(15 + i * 30.4), loc.lat, loc.lng),
          }))
        : undefined;
      return { label: loc.label, color: loc.color, positions, annualPaths };
    });
  }, [locations, polarDay, polarAnnual]);

  const hasElevationData = allSunData.some((loc) =>
    loc.data.some((d) => d.elevationAtTime !== null),
  );

  // Daylight map: timezone list & computed UTC hour from local hour + selected TZ
  const tzOptions = useMemo(() => {
    try { return Intl.supportedValuesOf('timeZone').sort(); }
    catch { return ['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo', 'Australia/Sydney']; }
  }, []);

  const computedUtcHour = useMemo(() => {
    try {
      // Determine the effective fixed offset based on the DST toggle.
      // Using a fixed offset avoids jumps when sliding the day slider across
      // the actual DST boundary (Luxon would auto-apply DST mid-slide).
      const jan1 = DateTime.fromObject({ year: CURRENT_YEAR, month: 1, day: 1 }, { zone: mapTz });
      const jul1 = DateTime.fromObject({ year: CURRENT_YEAR, month: 7, day: 1 }, { zone: mapTz });
      const stdOffsetMin = Math.min(jan1.offset, jul1.offset);
      const dstOffsetMin = Math.max(jan1.offset, jul1.offset);
      const offsetMin = mapObserveDst ? dstOffsetMin : stdOffsetMin;
      const utc = mapLocalHour - offsetMin / 60;
      return ((utc % 24) + 24) % 24;
    } catch {
      return mapLocalHour;
    }
  }, [mapLocalHour, mapTz, mapObserveDst]);

  const mapMarkers = useMemo(
    () => locations.map((loc) => ({ lat: loc.lat, lng: loc.lng, label: loc.label, color: loc.color })),
    [locations],
  );

  const mapCenter = useMemo(() => {
    if (mapCenterIdx < 0 || mapCenterIdx >= locations.length) return { lng: undefined, label: undefined };
    const loc = locations[mapCenterIdx];
    return { lng: loc.lng, label: loc.label };
  }, [mapCenterIdx, locations]);

  const cycleMapCenter = useCallback(() => {
    setMapCenterIdx((prev) => (prev + 1 >= locations.length ? -1 : prev + 1));
  }, [locations.length]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <SEOHead
        description="Interactive solar position and daylight visualization tools. Compare day length, sun elevation, azimuth, shadow length, equation of time, polar sun paths, and a live daylight map for any city on Earth."
        keywords="solar position calculator, daylight hours chart, sun path diagram, sunrise azimuth, solar noon, analemma, golden hour, twilight chart, sun trajectory"
        schema={{
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: 'Sungazer',
          url: 'https://sungazer.app',
          description:
            'Interactive solar position and daylight visualization tools with charts for day length, sun elevation, azimuth, shadow length, equation of time, polar sun paths, and a real-time daylight map.',
          applicationCategory: 'EducationalApplication',
          operatingSystem: 'Web',
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
          },
          author: {
            '@type': 'Organization',
            name: 'Sungazer',
          },
        }}
      />
      {/* Header */}
      <header className="border-b border-slate-800 bg-surface/50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="5" strokeWidth="2" />
                <path strokeLinecap="round" strokeWidth="2"
                  d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-amber-400 tracking-tight">Sungazer</h1>
              <p className="text-xs text-slate-500">Solar position & daylight charts</p>
            </div>
          </div>
          <div className="text-xs text-slate-500">
            {CURRENT_YEAR} &middot; {locations.length} location{locations.length !== 1 ? 's' : ''}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col lg:flex-row gap-6">
        {/* Sidebar — collapsible */}
        <aside className={`space-y-4 transition-all duration-300 overflow-hidden
          ${sidebarOpen
            ? 'lg:w-80 shrink-0 opacity-100'
            : 'w-0 lg:w-0 opacity-0 pointer-events-none'}`}>
          <div className="bg-surface rounded-xl p-5 space-y-4 border border-slate-700/50">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-amber-400 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Locations
              </h2>
              <button
                  onClick={() => setSidebarOpen(false)}
                  className="text-slate-500 hover:text-slate-300 transition-colors p-1"
                  title="Collapse sidebar"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                  </svg>
                </button>
            </div>

            {/* Global DST toggle */}
            <label className="flex items-center gap-3 cursor-pointer select-none border-b border-slate-700/50 pb-3">
              <input
                ref={dstCheckboxRef}
                type="checkbox"
                checked={globalDstChecked}
                onChange={(e) => setAllDst(e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-amber-500"
              />
              <div>
                <span className="text-xs text-slate-300">Observe DST (all)</span>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {allSameDst
                    ? (globalDstChecked
                      ? 'All locations: wall-clock time'
                      : 'All locations: standard time')
                    : 'Locations have mixed DST settings'}
                </p>
              </div>
            </label>

            {locations.map((loc) => (
              <LocationCard
                key={loc.id}
                lat={loc.lat}
                lng={loc.lng}
                tz={loc.tz}
                observeDst={loc.observeDst}
                label={loc.label}
                color={loc.color}
                onLatChange={(v) => updateLocation(loc.id, { lat: v })}
                onLngChange={(v) => updateLocation(loc.id, { lng: v })}
                onTzChange={(v) => updateLocation(loc.id, { tz: v })}
                onObserveDstChange={(v) => updateLocation(loc.id, { observeDst: v })}
                onLabelChange={(v) => updateLocation(loc.id, { label: v })}
                onSetMyLocation={() => setMyLocation(loc.id)}
                onRemove={() => removeLocation(loc.id)}
              />
            ))}

            <button
              onClick={addLocation}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-amber-400 hover:text-amber-300
                         bg-amber-500/5 hover:bg-amber-500/10 rounded-lg px-3 py-2
                         border border-dashed border-slate-600 hover:border-amber-500/30
                         transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Location
            </button>
          </div>
        </aside>

        {/* Floating button to reopen sidebar when collapsed */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="fixed left-3 top-1/2 -translate-y-1/2 z-40
                       bg-surface border border-slate-600 rounded-r-lg p-2
                       text-slate-400 hover:text-amber-300 hover:border-amber-500/40
                       shadow-lg transition-all"
            title="Show sidebar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Charts */}
        <main className="flex-1 space-y-6 min-w-0">
          {/* Chart 1: Day Length */}
          <section className="bg-surface rounded-xl p-5 border border-slate-700/50">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="text-lg font-semibold text-amber-400 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
                </svg>
                Day Length, Sunrise & Sunset
              </h2>
            </div>
            <DayLengthChart locations={allSunData} />
          </section>

          {/* Chart 2: Elevation */}
          <section className="bg-surface rounded-xl p-5 border border-slate-700/50">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="text-lg font-semibold text-cyan-400 flex items-center gap-2 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                Sun Elevation
              </h2>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex rounded bg-slate-800 border border-slate-600 overflow-hidden">
                  <button
                    onClick={() => setElevationMode('max')}
                    className={`text-[10px] px-2 py-0.5 transition-colors ${
                      elevationMode === 'max'
                        ? 'bg-cyan-500/20 text-cyan-300'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >Max</button>
                  <button
                    onClick={() => setElevationMode('atTime')}
                    className={`text-[10px] px-2 py-0.5 transition-colors border-l border-slate-600 ${
                      elevationMode === 'atTime'
                        ? 'bg-cyan-500/20 text-cyan-300'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >At</button>
                </div>
                <span className={`text-xs ${elevationMode === 'max' ? 'text-slate-600' : 'text-slate-400'}`}>
                  {String(Math.floor(targetHour)).padStart(2,'0')}:
                  {String(Math.round((targetHour % 1) * 60)).padStart(2,'0')}
                </span>
                <input
                  type="range"
                  min={0}
                  max={23.5}
                  step={0.5}
                  value={targetHour}
                  disabled={elevationMode === 'max'}
                  onChange={(e) => setTargetHour(Number(e.target.value))}
                  className={`w-20 h-1 accent-cyan-400 cursor-pointer
                    ${elevationMode === 'max' ? 'opacity-30 pointer-events-none' : ''}`}
                />
                <span className="text-slate-600 text-xs">|</span>
                <div className="flex rounded bg-slate-800 border border-slate-600 overflow-hidden">
                  <button
                    onClick={() => setZenithMode('smooth')}
                    className={`text-[10px] px-2 py-0.5 transition-colors ${
                      zenithMode === 'smooth'
                        ? 'bg-cyan-500/20 text-cyan-300'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >Smooth</button>
                  <button
                    onClick={() => setZenithMode('mirror')}
                    className={`text-[10px] px-2 py-0.5 transition-colors border-l border-slate-600 ${
                      zenithMode === 'mirror'
                        ? 'bg-cyan-500/20 text-cyan-300'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >Mirror</button>
                </div>
              </div>
            </div>
            {elevationMode === 'atTime' && !hasElevationData && (
              <p className="text-xs text-amber-400/80 mb-3">
                The sun may be below the horizon at {targetHour}:00 on some days.
              </p>
            )}
            <ElevationChart locations={allSunData} mode={elevationMode} globalMinElevation={globalElevationMin} />
          </section>

          {/* Chart 3: Sunrise & Sunset Azimuth */}
          <section className="bg-surface rounded-xl p-5 border border-slate-700/50">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="text-lg font-semibold text-purple-400 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18V4" />
                </svg>
                Sunrise & Sunset Azimuth
              </h2>
              <span className="text-xs text-slate-500 shrink-0">
                0°=N &middot; 90°=E &middot; 180°=S &middot; 270°=W
              </span>
            </div>
            <RiseSetAzimuthChart locations={allSunData} />
          </section>

          {/* Chart 4: Shadow Length Multiplier */}
          <section className="bg-surface rounded-xl p-5 border border-slate-700/50">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="text-lg font-semibold text-orange-400 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 21l9-15 9 15" />
                  <path strokeLinecap="round" strokeWidth={2} d="M12 6v12" />
                </svg>
                Shadow Length Multiplier
              </h2>
              <span className="text-xs text-slate-500 shrink-0">At solar noon &middot; 1m object → N× shadow</span>
            </div>
            <ShadowChart locations={allSunData} />
          </section>

          {/* Chart 5: Equation of Time */}
          <section className="bg-surface rounded-xl p-5 border border-slate-700/50">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="text-lg font-semibold text-yellow-400 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" strokeWidth="2" />
                  <path strokeLinecap="round" strokeWidth={2} d="M12 6v6l4 2" />
                </svg>
                Equation of Time
              </h2>
              <span className="text-xs text-slate-500 shrink-0">Solar noon − clock noon &middot; ±16 min range</span>
            </div>
            <EquationOfTimeChart locations={allSunData} />
          </section>

          {/* Chart 6: Polar Sun Path */}
          <section className="bg-surface rounded-xl p-5 border border-slate-700/50">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="text-lg font-semibold text-emerald-400 flex items-center gap-2 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" strokeWidth="2" />
                  <circle cx="12" cy="12" r="3" strokeWidth="2" />
                  <path strokeLinecap="round" strokeWidth={2} d="M12 3v3M12 18v3M3 12h3M18 12h3" />
                </svg>
                Sun Path (Polar)
              </h2>
              <div className="flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={polarAnnual}
                    onChange={(e) => setPolarAnnual(e.target.checked)}
                    className="w-3.5 h-3.5 rounded accent-emerald-400 cursor-pointer"
                  />
                  <span className="text-xs text-slate-400">Annual</span>
                </label>
                <span className={`text-xs ${polarAnnual ? 'text-slate-600' : 'text-slate-500'}`}>
                  {(() => {
                    const d = new Date(Date.UTC(CURRENT_YEAR, 0, polarDay));
                    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  })()}
                </span>
                <input
                  type="range"
                  min={1}
                  max={365}
                  value={polarDay}
                  disabled={polarAnnual}
                  onChange={(e) => setPolarDay(Number(e.target.value))}
                  className={`w-28 h-1.5 accent-emerald-400 cursor-pointer
                    ${polarAnnual ? 'opacity-30 pointer-events-none' : ''}`}
                />
              </div>
            </div>
            <SunPathPolar locations={polarLocations} annual={polarAnnual} />
          </section>

          {/* Chart 7: Daylight Map */}
          <section className="bg-surface rounded-xl p-5 border border-slate-700/50">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <h2 className="text-lg font-semibold text-amber-400 flex items-center gap-2 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Daylight Map
              </h2>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500">Day</span>
                  <input type="range" min={1} max={365} value={mapDay}
                    onChange={(e) => setMapDay(Number(e.target.value))}
                    className="w-20 h-1 accent-amber-400 cursor-pointer" />
                  <span className="text-[10px] text-slate-500">Hour</span>
                  <input type="range" min={0} max={23} value={mapLocalHour}
                    onChange={(e) => setMapLocalHour(Number(e.target.value))}
                    className="w-14 h-1 accent-amber-400 cursor-pointer" />
                </div>
                <SearchableSelect
                  value={mapTz}
                  options={tzOptions}
                  onChange={(v) => { mapTzManualRef.current = true; setMapTz(v); }}
                  placeholder="Filter timezone…"
                  className="w-40"
                />
                <label className="flex items-center gap-1 cursor-pointer select-none shrink-0"
                  title="Observe DST for map timezone">
                  <input
                    type="checkbox"
                    checked={mapObserveDst}
                    onChange={(e) => setMapObserveDst(e.target.checked)}
                    className="w-3 h-3 rounded accent-amber-400"
                  />
                  <span className="text-[10px] text-slate-500">DST</span>
                </label>
                {locations.length > 0 && (
                  <button
                    onClick={cycleMapCenter}
                    title={mapCenterIdx < 0 ? 'Center on location' : 'Cycle center'}
                    className="text-[10px] text-slate-400 hover:text-amber-400 transition-colors
                               border border-slate-600 rounded px-2 py-0.5 shrink-0"
                  >
                    {mapCenterIdx < 0 ? 'Center' : mapCenter.label}
                  </button>
                )}
              </div>
            </div>
            <div className="flex justify-end mb-4">
              <span className="text-xs text-slate-500">
                {(() => {
                  const d = new Date(Date.UTC(CURRENT_YEAR, 0, mapDay, computedUtcHour, 0));
                  const hh = String(Math.floor(mapLocalHour)).padStart(2, '0');
                  const mm = String(Math.round((mapLocalHour % 1) * 60)).padStart(2, '0');
                  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) +
                    ' ' + hh + ':' + mm + ' ' +
                    mapTz.replace('_', ' ').replace(/^.*\//, '') +
                    ' (= ' + String(Math.round(computedUtcHour)).padStart(2, '0') + ':00 UTC)';
                })()}
              </span>
            </div>
            <DaylightMap dayOfYear={mapDay} utcHour={computedUtcHour}
              centerLng={mapCenter.lng}
              markers={mapMarkers}
            />
          </section>
        </main>
      </div>
    </div>
  );
}
