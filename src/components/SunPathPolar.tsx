import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
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

function azimuthLabel(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const i = Math.round(((deg % 360) / 45)) % 8;
  return dirs[i];
}

/** Split positions at the 0°/360° azimuth crossing, inserting an interpolated
 *  boundary point so segments share an endpoint at the N tick on the chart.
 *  Returns one segment if no wrap is detected. */
function splitAtWrap(positions: HourlyPosition[]): HourlyPosition[][] {
  if (positions.length < 2) return [positions];

  let wrapIdx = -1;
  for (let i = 1; i < positions.length; i++) {
    if (Math.abs(positions[i].azimuth - positions[i - 1].azimuth) > 180) {
      wrapIdx = i;
      break;
    }
  }
  if (wrapIdx < 0) return [positions];

  const a = positions[wrapIdx - 1];
  const b = positions[wrapIdx];

  // Interpolate elevation & hour at the 0°/360° boundary
  let t: number;
  if (a.azimuth < b.azimuth) {
    // Wrapping upward: a near 360, b near 0
    t = (360 - a.azimuth) / (360 - a.azimuth + b.azimuth);
  } else {
    // Wrapping downward: a near 0, b near 360
    t = a.azimuth / (a.azimuth + 360 - b.azimuth);
  }

  const el = a.elevation + (b.elevation - a.elevation) * t;
  const h = a.hour + (b.hour - a.hour) * t;

  // pt0 (az=0) and pt360 (az=360) map to the same position on the polar chart (N)
  const pt0: HourlyPosition = { hour: h, azimuth: 0, elevation: el };
  const pt360: HourlyPosition = { hour: h, azimuth: 360, elevation: el };

  const seg1 = [...positions.slice(0, wrapIdx), pt0];
  const seg2 = [pt360, ...positions.slice(wrapIdx)];

  return [seg1, seg2];
}

export default function SunPathPolar({ locations, annual }: Props) {
  const option = useMemo(() => {
    const series: object[] = [];

    if (annual) {
      for (const loc of locations) {
        const paths = loc.annualPaths;
        if (!paths) continue;
        for (let i = 0; i < paths.length; i++) {
          const alpha = 0.2 + (0.6 * i) / (paths.length - 1);
          const pts = paths[i].positions.filter((p) => p.elevation > -5);
          if (pts.length < 2) continue;
          for (const seg of splitAtWrap(pts)) {
            if (seg.length < 2) continue;
            series.push({
              name: `${loc.label} — ${paths[i].monthLabel}`,
              type: 'line',
              data: seg.map((p) => [90 - Math.max(0, p.elevation), p.azimuth]),
              coordinateSystem: 'polar',
              lineStyle: { color: loc.color, width: 1, opacity: alpha },
              symbol: 'circle',
              symbolSize: 6,
              itemStyle: { color: 'transparent', borderColor: 'transparent' },
              smooth: 0.2,
            });
          }
        }
      }
    } else {
      for (const loc of locations) {
        const pts = loc.positions.filter((p) => p.elevation > -5);
        if (pts.length < 2) continue;
        for (const seg of splitAtWrap(pts)) {
          if (seg.length < 2) continue;
          series.push({
            name: loc.label,
            type: 'line',
            data: seg.map((p) => [90 - Math.max(0, p.elevation), p.azimuth]),
            coordinateSystem: 'polar',
            lineStyle: { color: loc.color, width: 2 },
            symbol: 'circle',
            symbolSize: 6,
            itemStyle: { color: 'transparent', borderColor: 'transparent' },
            smooth: 0.2,
          });
        }
      }
    }

    return {
      polar: { center: ['50%', '50%'], radius: ['10%', '85%'] },
      angleAxis: {
        type: 'value',
        min: 0,
        max: 360,
        interval: 45,
        startAngle: 90,
        clockwise: true,
        axisLabel: {
          formatter: (v: number) => {
            const m: Record<number, string> = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
            return m[v] ?? `${v}°`;
          },
          fontSize: 11,
        },
        splitLine: { show: true, lineStyle: { color: '#334155', width: 0.5 } },
        axisLine: { show: true, lineStyle: { color: '#64748b' } },
      },
      radiusAxis: {
        type: 'value',
        min: 0,
        max: 90,
        interval: 15,
        axisLabel: { formatter: (v: number) => `${(90 - v).toFixed(0)}°`, fontSize: 10 },
        splitLine: { show: true, lineStyle: { color: '#334155', width: 0.5 } },
      },
      tooltip: {
        trigger: 'item' as const,
        formatter: (params: any) => {
          const r = params.data?.[0];
          const az = params.data?.[1];
          if (az == null || r == null) return '';
          return `${params.seriesName}<br/>Az: ${az.toFixed(1)}° (${azimuthLabel(az)})<br/>El: ${(90 - r).toFixed(1)}°`;
        },
      },
      legend: {
        show: !annual,
        top: 8,
        data: locations.map((l) => l.label),
      },
      series,
    };
  }, [locations, annual]);

  if (locations.length === 0) return null;

  return <ReactECharts option={option} theme="sungazerDark" style={{ height: 450 }} notMerge />;
}
