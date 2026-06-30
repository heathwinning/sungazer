import { useRef, useEffect } from 'react';
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
  centerLabel?: string;
}

const W = 720, H = 360, P = 30;

function lonToX(lon: number): number { return P + ((lon + 180) / 360) * (W - 2 * P); }
function latToY(lat: number): number { return P + ((90 - lat) / 180) * (H - 2 * P); }

export default function DaylightMap({ dayOfYear, utcHour, markers, centerLng, centerLabel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Convert absolute longitude to view-relative [-180, 180).
  // When centered, the target longitude maps to 0 and the far-side seam is at ±180.
  const viewLng = (lon: number): number => {
    let v = centerLng != null ? lon - centerLng : lon;
    while (v >= 180) v -= 360;
    while (v < -180) v += 360;
    return v;
  };

  // Convert view-relative longitude back to absolute (for labels etc.)
  const absLng = (vLon: number): number => {
    let a = centerLng != null ? vLon + centerLng : vLon;
    while (a >= 180) a -= 360;
    while (a < -180) a += 360;
    return a;
  };

  const centerKey = centerLng != null ? `${centerLng}:${centerLabel}` : '';

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = W * dpr; c.height = H * dpr;
    c.style.width = W + 'px'; c.style.height = H + 'px';
    ctx.scale(dpr, dpr);

    const year = new Date().getFullYear();
    const date = new Date(Date.UTC(year, 0, dayOfYear, Math.floor(utcHour),
      Math.round((utcHour % 1) * 60), 0));
    const sub = getSubsolarPoint(date);
    const subLon = sub.lng;
    const subLat = sub.lat;
    const dec = (subLat * Math.PI) / 180;  // radians for trig below

    // Fill entire map with opaque night, then punch out day band per row.
    // All longitudes are converted to view-relative [-180, 180) so the
    // "seam" is always at ±180° regardless of centering.
    ctx.fillStyle = '#0a101e';
    ctx.fillRect(P, P, W - 2 * P, H - 2 * P);

    for (let lat = 90; lat >= -90; lat -= 0.5) {
      const latRad = (lat * Math.PI) / 180;
      const cosHA = -Math.tan(latRad) * Math.tan(dec);

      let y1 = latToY(lat + 0.5);
      let rowH = Math.max(0.5, latToY(lat - 0.5) - y1);
      if (y1 < P) { rowH -= P - y1; y1 = P; }
      if (y1 + rowH > H - P) rowH = (H - P) - y1;
      if (rowH <= 0) continue;

      if (cosHA > 1) continue;
      if (cosHA < -1) {
        ctx.fillStyle = '#0e6b9b';
        ctx.fillRect(P, y1, W - 2 * P, rowH);
        continue;
      }

      const ha = Math.acos(cosHA) * (180 / Math.PI);

      // Day band in view-relative longitudes: [viewLng(subLon - ha), viewLng(subLon + ha)]
      let dayA = viewLng(subLon - ha);
      let dayB = viewLng(subLon + ha);

      ctx.fillStyle = '#0e6b9b';

      if (dayA <= dayB) {
        const x = Math.max(P, lonToX(dayA));
        const w = Math.min(W - P, lonToX(dayB)) - x;
        if (w > 0) ctx.fillRect(x, y1, w, rowH);
      } else {
        const x1 = Math.max(P, lonToX(dayA));
        const w1 = (W - P) - x1;
        if (w1 > 0) ctx.fillRect(x1, y1, w1, rowH);
        const w2 = Math.min(W - P, lonToX(dayB)) - P;
        if (w2 > 0) ctx.fillRect(P, y1, w2, rowH);
      }
    }

    // Grid: longitude lines every 30° in view-relative space.
    // Labels show the absolute longitude.
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 0.5;
    for (let vLon = -180; vLon <= 180; vLon += 30) {
      const x = lonToX(vLon);
      ctx.beginPath(); ctx.moveTo(x, P); ctx.lineTo(x, H - P); ctx.stroke();
      const aLon = absLng(vLon);
      const deg = Math.round(Math.abs(aLon));
      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px system-ui'; ctx.textAlign = 'center';
      let label: string;
      if (deg === 180 || deg === 0) label = `${deg}°`;
      else label = `${deg}°${aLon > 0 ? 'E' : 'W'}`;
      ctx.fillText(label, x, H - P + 14);
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const y = latToY(lat);
      ctx.beginPath(); ctx.moveTo(P, y); ctx.lineTo(W - P, y); ctx.stroke();
      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px system-ui'; ctx.textAlign = 'right';
      ctx.fillText(`${Math.abs(lat)}°${lat >= 0 ? 'N' : 'S'}`, P - 4, y + 3);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(P, latToY(0)); ctx.lineTo(W - P, latToY(0)); ctx.stroke();

    // Continent outlines — all points converted to view-relative,
    // antimeridian crossing detection uses view-relative deltas.
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 0.5;
    for (const continent of CONTINENTS) {
      for (const ring of continent.polygons) {
        // --- Fill ---
        ctx.beginPath();
        let first = true;
        for (const [lon, lat] of ring) {
          const x = lonToX(viewLng(lon));
          const y = latToY(lat);
          if (first) { ctx.moveTo(x, y); first = false; }
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();

        // --- Stroke: break at seam crossings ---
        ctx.beginPath();
        first = true;
        for (let i = 0; i < ring.length; i++) {
          const vLon = viewLng(ring[i][0]);
          const lat = ring[i][1];
          const x = lonToX(vLon);
          const y = latToY(lat);
          if (first) { ctx.moveTo(x, y); first = false; continue; }
          const prevVLon = viewLng(ring[i - 1][0]);
          if (Math.abs(vLon - prevVLon) > 180) {
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();
        ctx.stroke();
      }
    }

    // Location markers
    if (markers) {
      for (const m of markers) {
        const mx = lonToX(viewLng(m.lng));
        const my = latToY(m.lat);
        ctx.beginPath();
        ctx.arc(mx, my, 4, 0, Math.PI * 2);
        ctx.fillStyle = m.color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = m.color;
        ctx.font = 'bold 9px system-ui';
        ctx.textAlign = mx > W / 2 ? 'right' : 'left';
        ctx.fillText(m.label, mx + (mx > W / 2 ? -6 : 6), my - 6);
      }
    }

    // Terminator — sweep view-relative longitudes left-to-right.
    // The terminator equation uses absolute longitudes: lat = atan(-cos(lon_abs - subLon) / tan(dec))
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#f59e0b';
    ctx.lineCap = 'round';

    const absDec = Math.abs(dec);
    if (absDec < 0.0001) {
      for (const off of [-90, 90]) {
        const x = lonToX(viewLng(subLon + off));
        ctx.beginPath();
        ctx.moveTo(x, P);
        ctx.lineTo(x, H - P);
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      let first = true;
      for (let vLon = -180; vLon <= 180; vLon += 0.5) {
        const absLon = absLng(vLon);
        const dLonRad = (absLon - subLon) * Math.PI / 180;
        const latRad = Math.atan(-Math.cos(dLonRad) / Math.tan(dec));
        const lat = latRad * 180 / Math.PI;
        const x = lonToX(vLon);
        const y = Math.max(P, Math.min(H - P, latToY(lat)));
        if (first) { ctx.moveTo(x, y); first = false; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Subsolar point
    const sx = lonToX(viewLng(subLon));
    const sy = latToY(subLat);
    ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#fbbf24'; ctx.fill();
    ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2; ctx.stroke();

    // Map border
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(P, P, W - 2 * P, H - 2 * P);

    // Legend
    ctx.fillStyle = '#e2e8f0'; ctx.font = '11px system-ui'; ctx.textAlign = 'left';
    ctx.fillText('☀ Day', P + 6, P + 18);
    ctx.fillStyle = '#64748b'; ctx.fillText('☾ Night', W - P - 55, P + 18);

    // Center label
    if (centerLabel) {
      ctx.fillStyle = '#f59e0b';
      ctx.font = '10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('⟐ ' + centerLabel, W / 2, P + 18);
    }

  }, [dayOfYear, utcHour, markers, centerKey]);

  return (
    <div className="flex justify-center">
      <canvas ref={canvasRef} width={W} height={H} style={{ width: W, height: H }} className="max-w-full" />
    </div>
  );
}
