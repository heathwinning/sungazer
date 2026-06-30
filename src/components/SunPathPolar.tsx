import { useRef, useEffect, useState, useCallback } from 'react';
import type { HourlyPosition } from '../lib/sunCalc';

export interface PolarLocation {
  label: string;
  color: string;
  positions: HourlyPosition[];
  annualPaths?: { monthLabel: string; positions: HourlyPosition[] }[];
}

interface Props {
  locations: PolarLocation[];
  annual?: boolean;
}

const S = 400, CX = S / 2, MR = CX - 30;

function toXY(e: number, a: number): [number, number] {
  const r = ((90 - e) / 90) * MR;
  const rad = ((a - 90) * Math.PI) / 180;
  return [CX + r * Math.cos(rad), CX + r * Math.sin(rad)];
}

function drawPath(ctx: CanvasRenderingContext2D, pts: HourlyPosition[], color: string, alpha: number, lw: number) {
  if (pts.length < 2) return;

  // Unwrap azimuth so the path doesn't jump across 0°/360°
  const unwrapped: { elevation: number; azimuth: number }[] = [];
  let prevAz = pts[0].azimuth;
  for (let i = 0; i < pts.length; i++) {
    let az = pts[i].azimuth;
    while (az - prevAz > 180) az -= 360;
    while (az - prevAz < -180) az += 360;
    unwrapped.push({ elevation: pts[i].elevation, azimuth: az });
    prevAz = az;
  }

  ctx.beginPath();
  ctx.strokeStyle = hexToRgba(color, alpha);
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (let i = 0; i < unwrapped.length; i++) {
    const [x, y] = toXY(unwrapped[i].elevation, unwrapped[i].azimuth);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function hexToRgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function azimuthLabel(deg: number): string {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(((deg % 360) / 22.5)) % 16];
}

export default function SunPathPolar({ locations, annual }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = S * dpr; c.height = S * dpr;
    ctx.scale(dpr, dpr);

    // bg
    ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, S, S);

    // elevation rings
    for (let e = 15; e <= 75; e += 15) {
      const r = ((90 - e) / 90) * MR;
      ctx.beginPath(); ctx.arc(CX, CX, r, 0, Math.PI * 2);
      ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 0.5; ctx.stroke();
      ctx.fillStyle = '#475569'; ctx.font = '10px system-ui';
      ctx.textAlign = 'right'; ctx.fillText(`${e}°`, CX - r - 2, CX + 4);
    }

    // azimuth lines + labels
    for (const [az, label] of [[0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'], [180, 'S'], [225, 'SW'], [270, 'W'], [315, 'NW']] as [number, string][]) {
      const rad = ((az - 90) * Math.PI) / 180;
      ctx.beginPath(); ctx.moveTo(CX, CX);
      ctx.lineTo(CX + MR * Math.cos(rad), CX + MR * Math.sin(rad));
      ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 0.5; ctx.stroke();
      const lx = CX + (MR + 16) * Math.cos(rad);
      const ly = CX + (MR + 16) * Math.sin(rad);
      ctx.fillStyle = '#64748b'; ctx.font = 'bold 11px system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, lx, ly);
    }

    // sun paths
    for (const loc of locations) {
      if (annual && loc.annualPaths) {
        // Draw each month's path with increasing opacity (Jan -> Dec)
        const paths = loc.annualPaths;
        for (let i = 0; i < paths.length; i++) {
          const alpha = 0.2 + (0.6 * i) / (paths.length - 1);
          const lw = 1;
          drawPath(ctx, paths[i].positions, loc.color, alpha, lw);
        }
        // Label solstice months
        for (const idx of [0, Math.floor(paths.length / 2), paths.length - 1]) {
          const p = paths[idx];
          if (p.positions.length < 2) continue;
          const mid = p.positions[Math.floor(p.positions.length / 2)];
          const [mx, my] = toXY(mid.elevation, mid.azimuth);
          ctx.fillStyle = hexToRgba(loc.color, 0.9);
          ctx.font = '9px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText(p.monthLabel, mx, my - 6);
        }
      } else {
        // Single day
        drawPath(ctx, loc.positions, loc.color, 1, 2);
        // noon dot
        if (loc.positions.length > 0) {
          const noon = loc.positions.reduce((a, b) =>
            Math.abs(b.hour - 12) < Math.abs(a.hour - 12) ? b : a);
          const [nx, ny] = toXY(noon.elevation, noon.azimuth);
          ctx.beginPath(); ctx.arc(nx, ny, 4, 0, Math.PI * 2);
          ctx.fillStyle = loc.color; ctx.fill();
        }
        // rise/set dots
        if (loc.positions.length >= 2) {
          for (const idx of [0, loc.positions.length - 1]) {
            const p = loc.positions[idx];
            const [px, py] = toXY(Math.max(0, p.elevation), p.azimuth);
            ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2);
            ctx.fillStyle = loc.color; ctx.fill();
          }
        }
      }
    }

    // legend
    let ly = 18;
    for (const loc of locations) {
      ctx.fillStyle = loc.color; ctx.fillRect(10, ly, 10, 10);
      ctx.fillStyle = '#94a3b8'; ctx.font = '11px system-ui';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(loc.label, 24, ly);
      ly += 16;
    }

    // Store drawn point data for hover lookup (only in single-day mode)
    if (!annual) {
      const allPts: { x: number; y: number; elevation: number; azimuth: number; label: string; color: string }[] = [];
      for (const loc of locations) {
        for (const p of loc.positions) {
          const [px, py] = toXY(p.elevation, p.azimuth);
          allPts.push({ x: px, y: py, elevation: p.elevation, azimuth: p.azimuth, label: loc.label, color: loc.color });
        }
      }
      (canvasRef.current as any).__hoverPts = allPts;
    } else if (canvasRef.current) {
      (canvasRef.current as any).__hoverPts = [];
    }
  }, [locations, annual]);

  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string; color: string } | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (annual) { setTooltip(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    // Canvas display size should match internal S×S coords.
    // If CSS scaling changes the display, adjust proportionally.
    const scaleX = S / rect.width;
    const scaleY = S / rect.height;
    const cx = sx * scaleX;
    const cy = sy * scaleY;

    const pts: { x: number; y: number; elevation: number; azimuth: number; label: string; color: string }[] =
      (canvasRef.current as any)?.__hoverPts || [];
    let best: typeof pts[0] | null = null;
    let bestDist = 20;
    for (const p of pts) {
      const dx = p.x - cx, dy = p.y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestDist) { bestDist = d; best = p; }
    }
    if (best) {
      const dir = azimuthLabel(best.azimuth);
      setTooltip({ x: e.clientX, y: e.clientY,
        text: `${best.label} — ${best.elevation.toFixed(1)}° at ${best.azimuth.toFixed(0)}° (${dir})`,
        color: best.color });
    } else {
      setTooltip(null);
    }
  }, [annual]);

  return (
    <div className="flex justify-center relative">
      <canvas ref={canvasRef} width={S} height={S} style={{ width: S, height: S }}
        onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)} />
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none px-2 py-1 rounded text-xs bg-slate-900 border border-slate-600 shadow-lg whitespace-nowrap"
          style={{ left: tooltip.x + 12, top: tooltip.y - 20, color: tooltip.color }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
