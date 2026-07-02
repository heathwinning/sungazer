import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { ChartLocation } from '../lib/types';
import { labelStepFormatter } from '../lib/echartsUtils';

interface Props {
  locations: ChartLocation[];
  labelStep?: number;
}

function azimuthLabel(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const i = Math.round(((deg % 360) / 22.5)) % 16;
  return dirs[i];
}

export default function RiseSetAzimuthChart({ locations, labelStep = 20 }: Props) {
  const firstData = locations[0]?.data;

  const option = useMemo(() => {
    if (!firstData) return {};
    const labels = firstData.map((d) => d.label);

    const series = locations.flatMap((loc) => [
      {
        name: `${loc.label} — Sunrise`,
        type: 'line' as const,
        data: loc.data.map((d) => d.sunriseAzimuth),
        lineStyle: { color: loc.color, width: 1.5, type: 'dashed' as const },
        itemStyle: { color: loc.color },
        smooth: 0.3,
        symbol: 'none' as const,
      },
      {
        name: `${loc.label} — Sunset`,
        type: 'line' as const,
        data: loc.data.map((d) => d.sunsetAzimuth),
        lineStyle: { color: loc.color, width: 1.5, type: 'dotted' as const },
        itemStyle: { color: loc.color },
        smooth: 0.3,
        symbol: 'none' as const,
      },
    ]);

    return {
      grid: { left: 48, right: 20, top: 40, bottom: 32 },
      legend: { top: 0 },
      tooltip: {
        trigger: 'axis' as const,
        valueFormatter: (v: number) => {
          if (v == null) return '—';
          return `${v.toFixed(1)}° (${azimuthLabel(v)})`;
        },
      },
      xAxis: {
        type: 'category' as const,
        data: labels,
        axisLabel: { formatter: labelStepFormatter(labels, labelStep) },
      },
      yAxis: {
        type: 'value' as const,
        min: 0,
        max: 360,
        name: 'Degrees from North',
        axisLabel: {
          formatter: (v: number) => {
            if (v === 0 || v === 360) return 'N (0°)';
            if (v === 45) return 'NE (45°)';
            if (v === 90) return 'E (90°)';
            if (v === 135) return 'SE (135°)';
            if (v === 180) return 'S (180°)';
            if (v === 225) return 'SW (225°)';
            if (v === 270) return 'W (270°)';
            if (v === 315) return 'NW (315°)';
            return `${v}°`;
          },
        },
      },
      series,
    };
  }, [locations, labelStep, firstData]);

  if (!firstData) return null;

  return <ReactECharts option={option} theme="sungazerDark" style={{ height: 400 }} notMerge />;
}
