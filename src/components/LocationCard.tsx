import { useState, useEffect, useCallback, useRef } from 'react';
import { lookupTimezone } from '../lib/timezone';
import SearchableSelect from './SearchableSelect';

interface CityResult {
  display: string;
  lat: string;
  lon: string;
}

const COMMON_TZ = Intl.supportedValuesOf('timeZone').sort();
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

interface Props {
  lat: number;
  lng: number;
  tz: string;
  observeDst: boolean;
  label: string;
  color: string;
  onLatChange: (v: number) => void;
  onLngChange: (v: number) => void;
  onTzChange: (v: string) => void;
  onObserveDstChange: (v: boolean) => void;
  onLabelChange: (v: string) => void;
  onSetMyLocation: () => void;
  onRemove: () => void;
}

export default function LocationCard({
  lat, lng, tz, observeDst, label, color,
  onLatChange, onLngChange, onTzChange, onObserveDstChange, onLabelChange, onSetMyLocation, onRemove,
}: Props) {
  const [latInput, setLatInput] = useState(String(lat));
  const [lngInput, setLngInput] = useState(String(lng));

  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState<CityResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const abortRef = useRef<AbortController | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Stable callback ref to avoid triggering the tz-lookup effect on every render
  const onTzChangeRef = useRef(onTzChange);
  onTzChangeRef.current = onTzChange;

  useEffect(() => {
    try {
      const found = lookupTimezone(lat, lng);
      onTzChangeRef.current(found);
    } catch { /* keep current */ }
  }, [lat, lng]);

  useEffect(() => {
    setLatInput(String(lat));
    setLngInput(String(lng));
  }, [lat, lng]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const searchCity = useCallback((query: string) => {
    if (abortRef.current) abortRef.current.abort();
    if (query.trim().length < 2) { setCityResults([]); setShowDropdown(false); return; }
    const controller = new AbortController();
    abortRef.current = controller;
    setIsSearching(true);
    const params = new URLSearchParams({ q: query, format: 'json', limit: '6', addressdetails: '0' });
    fetch(`${NOMINATIM_URL}?${params}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Sungazer/1.0 (solar chart app)' },
    })
      .then((res) => res.json())
      .then((data: Array<{ display_name: string; lat: string; lon: string }>) => {
        setCityResults(data.map((d) => ({ display: d.display_name, lat: d.lat, lon: d.lon })));
        setShowDropdown(data.length > 0);
        setIsSearching(false);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') { setCityResults([]); setShowDropdown(false); }
        setIsSearching(false);
      });
  }, []);

  const handleCityInput = useCallback((value: string) => {
    setCityQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchCity(value), 300);
  }, [searchCity]);

  const selectCity = useCallback((city: CityResult) => {
    onLatChange(parseFloat(city.lat));
    onLngChange(parseFloat(city.lon));
    // Extract a short label: first comma-separated segment of display_name
    const shortName = city.display.split(',')[0].trim();
    onLabelChange(shortName);
    setCityQuery(city.display);
    setShowDropdown(false);
    setCityResults([]);
  }, [onLatChange, onLngChange, onLabelChange]);

  const handleLatBlur = useCallback(() => {
    const v = parseFloat(latInput);
    if (!isNaN(v) && v >= -90 && v <= 90) onLatChange(v);
    else setLatInput(String(lat));
  }, [latInput, lat, onLatChange]);

  const handleLngBlur = useCallback(() => {
    const v = parseFloat(lngInput);
    if (!isNaN(v) && v >= -180 && v <= 180) onLngChange(v);
    else setLngInput(String(lng));
  }, [lngInput, lng, onLngChange]);

  return (
    <div className="bg-surface-alt rounded-lg p-4 space-y-3 border border-slate-600/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span className="text-sm font-medium text-slate-200 truncate">{label}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onSetMyLocation}
            className="text-slate-500 hover:text-amber-400 transition-colors p-0.5"
            title="Set to my location"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button
            onClick={onRemove}
            className="text-slate-500 hover:text-red-400 transition-colors p-0.5"
            title="Remove location"
          >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        </div>
      </div>

      {/* City Search */}
      <div ref={dropdownRef} className="relative">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={cityQuery}
            onChange={(e) => handleCityInput(e.target.value)}
            onFocus={() => { if (cityResults.length > 0) setShowDropdown(true); }}
            placeholder="Search city…"
            className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-7 pr-7 py-1.5 text-xs
                       text-slate-100 placeholder-slate-500
                       focus:outline-none focus:border-amber-500/60 transition-colors"
          />
          {isSearching && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <div className="w-3 h-3 border-2 border-slate-500 border-t-amber-400 rounded-full animate-spin" />
            </div>
          )}
          {!isSearching && cityQuery && (
            <button
              onClick={() => { setCityQuery(''); setCityResults([]); setShowDropdown(false); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {showDropdown && cityResults.length > 0 && (
          <ul className="absolute z-20 mt-1 w-full bg-slate-900 border border-slate-600 rounded-lg
                         shadow-xl max-h-44 overflow-y-auto">
            {cityResults.map((city, i) => (
              <li key={i}>
                <button
                  onClick={() => selectCity(city)}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-slate-200
                             hover:bg-amber-500/10 hover:text-amber-300
                             border-b border-slate-800 last:border-b-0 transition-colors"
                >
                  <span className="line-clamp-2">{city.display}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] text-slate-500 mb-0.5">Latitude</label>
          <input
            type="text"
            value={latInput}
            onChange={(e) => setLatInput(e.target.value)}
            onBlur={handleLatBlur}
            className="w-full bg-slate-900 border border-slate-600 rounded-md px-2 py-1.5 text-xs
                       text-slate-100 focus:outline-none focus:border-amber-500/60 transition-colors"
          />
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 mb-0.5">Longitude</label>
          <input
            type="text"
            value={lngInput}
            onChange={(e) => setLngInput(e.target.value)}
            onBlur={handleLngBlur}
            className="w-full bg-slate-900 border border-slate-600 rounded-md px-2 py-1.5 text-xs
                       text-slate-100 focus:outline-none focus:border-amber-500/60 transition-colors"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <SearchableSelect
          value={tz}
          options={COMMON_TZ}
          onChange={onTzChange}
          placeholder="Filter timezone…"
          className="flex-1 min-w-0"
        />
        <label className="flex items-center gap-1 cursor-pointer select-none shrink-0" title="Toggle DST for this location">
          <input
            type="checkbox"
            checked={observeDst}
            onChange={(e) => onObserveDstChange(e.target.checked)}
            className="w-3 h-3 rounded accent-amber-500"
          />
          <span className="text-[10px] text-slate-500">DST</span>
        </label>
      </div>
    </div>
  );
}
