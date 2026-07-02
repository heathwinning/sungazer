import { useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { CONTINENTS } from '../lib/worldOutlines';
import { getSubsolarPoint } from '../lib/sunCalc';

export interface MapMarker {
  lat: number;
  lng: number;
  label: string;
  color: string;
}

interface Props {
  dayOfYear: number;
  utcHour: number;
  markers?: MapMarker[];
  centerLng?: number;
}

// Three longitudinal copies of map outlines so panning to any longitude
// always shows continent shapes. Fill strips use primary (0°) copy only.
(function initWorldMap() {
  const baseFeatures = CONTINENTS.map((c) => ({
    type: 'Feature' as const,
    properties: { name: c.name },
    geometry: { type: 'Polygon' as const, coordinates: c.polygons },
  }));
  const shift = (f: typeof baseFeatures[number], o: number) => ({
    ...f,
    geometry: { ...f.geometry, coordinates: f.geometry.coordinates.map((r) => r.map(([lon, lat]) => [lon + o, lat])) },
  });
  echarts.registerMap('world', {
    type: 'FeatureCollection',
    features: [...baseFeatures.map((f) => shift(f, -360)), ...baseFeatures, ...baseFeatures.map((f) => shift(f, +360))],
  } as any);
})();

// --------------- helpers ---------------

function solarDeclination(doy: number): number {
  const B = ((doy - 1) * 2 * Math.PI) / 365;
  return (0.006918 - 0.399912 * Math.cos(B) + 0.070257 * Math.sin(B) - 0.006758 * Math.cos(2 * B) + 0.000907 * Math.sin(2 * B) - 0.002697 * Math.cos(3 * B) + 0.00148 * Math.sin(3 * B)) * (180 / Math.PI);
}

function subsolarLng(utcHour: number): number {
  return ((12 - utcHour) * 15 + 540) % 360 - 180;
}

// --------------- strip fill ---------------

/** Build trapezoid strips covering the area where solar elevation > targetElev.
 *  targetElev = 0 for daylight, -6 for civil twilight, -12 nautical, -18 astro.
 *  Strips are clipped to [-180,180] so every vertex is in the registered map range. */
function buildFillStrips(dayOfYear: number, utcHour: number, targetElev: number, step = 1): number[][][] {
  const dec = solarDeclination(dayOfYear);
  const sLng = subsolarLng(utcHour);
  const decRad = (dec * Math.PI) / 180;
  const targetRad = (targetElev * Math.PI) / 180;
  const sinTarget = Math.sin(targetRad);
  const strips: number[][][] = [];

  // Helper: clip interval [sr, ss] (sr < ss, raw) into ≤2 pieces within [-180,180]
  const clip = (sr: number, ss: number): [number, number][] => {
    const out: [number, number][] = [];
    for (let k = -2; k <= 2; k++) {
      const a = sr + 360 * k, b = ss + 360 * k;
      const lo = Math.max(a, -180), hi = Math.min(b, 180);
      if (lo < hi) out.push([lo, hi]);
    }
    return out;
  };

  let prevLat: number | null = null;
  let prevPieces: [number, number][] | null = null;

  for (let lat = -90; lat <= 90; lat += step) {
    const latRad = (lat * Math.PI) / 180;
    const sinLat = Math.sin(latRad);
    const cosLat = Math.cos(latRad);

    // cos(ha) = (sin(target) - sin(lat)*sin(dec)) / (cos(lat)*cos(dec))
    const denom = cosLat * Math.cos(decRad);
    if (denom === 0) { prevLat = prevPieces = null; continue; }
    const rhs = (sinTarget - sinLat * Math.sin(decRad)) / denom;
    const clamped = Math.max(-1, Math.min(1, rhs));

    if (clamped <= -1) {
      // Full coverage at this latitude — entire circle above threshold
      const sr = sLng - 180, ss = sLng + 180;
      const pieces = clip(sr, ss);
      if (prevPieces && prevLat !== null) {
        const usedCurr = new Set<number>();
        for (const pp of prevPieces) {
          let bestJ = -1, bestOverlap = 0;
          for (let j = 0; j < pieces.length; j++) {
            if (usedCurr.has(j)) continue;
            const overlap = Math.min(pp[1], pieces[j][1]) - Math.max(pp[0], pieces[j][0]);
            if (overlap > bestOverlap) { bestOverlap = overlap; bestJ = j; }
          }
          if (bestJ >= 0) {
            usedCurr.add(bestJ);
            strips.push([[pp[0], prevLat], [pieces[bestJ][0], lat], [pieces[bestJ][1], lat], [pp[1], prevLat]]);
          }
        }
      }
      prevLat = lat; prevPieces = pieces;
      continue;
    }

    if (clamped >= 1) {
      // No coverage at this latitude
      prevLat = prevPieces = null;
      continue;
    }

    const delta = (Math.acos(clamped) * 180) / Math.PI;
    const sr = sLng - delta, ss = sLng + delta;
    const pieces = clip(sr, ss);

    if (prevPieces && prevLat !== null) {
      const usedCurr = new Set<number>();
      for (const pp of prevPieces) {
        let bestJ = -1, bestOverlap = 0;
        for (let j = 0; j < pieces.length; j++) {
          if (usedCurr.has(j)) continue;
          const overlap = Math.min(pp[1], pieces[j][1]) - Math.max(pp[0], pieces[j][0]);
          if (overlap > bestOverlap) { bestOverlap = overlap; bestJ = j; }
        }
        if (bestJ >= 0) {
          usedCurr.add(bestJ);
          strips.push([[pp[0], prevLat], [pieces[bestJ][0], lat], [pieces[bestJ][1], lat], [pp[1], prevLat]]);
        }
      }
    }

    prevLat = lat; prevPieces = pieces;
  }

  return strips;
}

// --------------- component ---------------

export default function DaylightMap({ dayOfYear, utcHour, markers, centerLng }: Props) {
  const cLng = centerLng ?? 0;

  // ---- unwrap utcHour so the sun position anchor stays continuous -------
  // utcHour is wrapped to [0,24). When the slider crosses midnight,
  // utcHour snaps from ~23.9 to ~0.1, which breaks the unwrapping anchor.
  // Track a continuous hour value that never wraps — used ONLY for sun calc.
  const prevUtcHourRef = useRef(utcHour);
  const utcHourOffsetRef = useRef(0);
  const prev = prevUtcHourRef.current;
  if (utcHour - prev > 12) {
    utcHourOffsetRef.current -= 24;
  } else if (prev - utcHour > 12) {
    utcHourOffsetRef.current += 24;
  }
  prevUtcHourRef.current = utcHour;
  const continuousUtcHour = utcHour + utcHourOffsetRef.current;

  // ---- sun position (computed here so debug table can display it) ----
  const year = new Date().getFullYear();
  // date uses the wrapped utcHour (suncalc handles it fine)
  const date = new Date(Date.UTC(year, 0, dayOfYear, Math.floor(utcHour), Math.round((utcHour % 1) * 60), 0));
  const sub = getSubsolarPoint(date);
  // Use continuousUtcHour as the unwrapping anchor so it never jumps
  const sunApproxLng = (12 - continuousUtcHour) * 15;
  const sunLng = sub.lng + Math.round((sunApproxLng - sub.lng) / 360) * 360;

  const option = useMemo(() => {
    // ---- compute strips for each elevation threshold ----
    const twilightLevels = [
      { elev: -18, color: 'rgba(251,191,36,0.07)', label: 'astro' },
      { elev: -12, color: 'rgba(251,191,36,0.08)', label: 'nautical' },
      { elev:  -6, color: 'rgba(251,191,36,0.09)', label: 'civil' },
      { elev:   0, color: 'rgba(251,191,36,0.12)', label: 'day' },
    ];

    const layerStrips = twilightLevels.map((lvl) => {
      const s = buildFillStrips(dayOfYear, utcHour, lvl.elev, 2);
      const all: number[][][] = [];
      for (const offset of [-360, 0, 360]) {
        for (const strip of s) {
          all.push(strip.map(([lng, lat]) => [lng + offset, lat]) as any);
        }
      }
      return all;
    });

    const markerData = (markers ?? []).map((m) => ({
      name: m.label,
      value: [m.lng, m.lat],
      itemStyle: { color: m.color },
      label: { show: true, formatter: m.label, position: 'right' as const, color: m.color, fontSize: 10 },
    }));

    return {
      backgroundColor: '#020617',
      tooltip: { show: false },
      geo: {
        map: 'world',
        roam: 'move',
        center: [cLng, 0],
        zoom: 3.0,
        scaleLimit: { min: 1.0, max: 10 },
        itemStyle: { areaColor: 'transparent', borderColor: '#64748b', borderWidth: 0.8 },
        emphasis: { disabled: true },
      },
      series: [
        // ---- twilight / daylight fill layers ----
        ...layerStrips.map((allStrips, li) => ({
          type: 'custom' as const,
          coordinateSystem: 'geo' as const,
          z: 1,
          silent: true,
          data: [0],
          renderItem: ((strips: number[][][], color: string) =>
            (_params: any, api: any) => {
              const children: any[] = [];
              for (const s of strips) {
                const p0 = api.coord([s[0][0], s[0][1]]);
                const p1 = api.coord([s[1][0], s[1][1]]);
                const p2 = api.coord([s[2][0], s[2][1]]);
                const p3 = api.coord([s[3][0], s[3][1]]);
                if (!p0 || !p1 || !p2 || !p3) continue;
                children.push({
                  type: 'polygon',
                  shape: { points: [p0, p1, p2, p3] },
                  style: { fill: color, stroke: color, lineWidth: 0 },
                });
              }
              if (children.length === 0) return null;
              return { type: 'group', children };
            })(allStrips, twilightLevels[li].color),
        })),
        // ---- subsolar point (3 copies so one is always visible) ----
        {
          type: 'scatter' as const,
          coordinateSystem: 'geo' as const,
          z: 4,
          silent: true,
          data: [-360, 0, 360].map((offset) => ({ name: 'Sun', value: [sunLng + offset, sub.lat] })),
          symbolSize: 10,
          symbol: 'circle',
          itemStyle: { color: '#fbbf24', borderColor: '#fbbf24', borderWidth: 0 },
          label: {
            show: true,
            position: 'right' as const,
            color: '#fbbf24',
            fontSize: 10,
            formatter: 'Sun',
            offset: [5, 0],
          },
        },
        // ---- markers ----
        ...(markerData.length > 0 ? [{
          type: 'scatter' as const,
          coordinateSystem: 'geo' as const,
          data: markerData,
          z: 5,
          symbolSize: 8,
          symbol: 'pin' as const,
          silent: true,
        }] : []),
      ],
    };
  }, [dayOfYear, utcHour, markers, cLng]);

  return (
    <div className="w-full">
      <ReactECharts option={option} theme="sungazerDark" style={{ height: 400, width: '100%' }} notMerge />
    </div>
  );
}
