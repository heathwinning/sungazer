import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { ChartLocation } from '../lib/types';
import { labelStepFormatter, buildLineSeries } from '../lib/echartsUtils';

interface Props {
  locations: ChartLocation[];
  mode: 'max' | 'atTime';
  labelStep?: number;
  /** Precomputed minimum elevation across all hours (0–23.5) and all days.
   *  Used as the fixed lower Y-axis bound so the axis never moves while the
   *  user slides the time-of-day slider. */
  globalMinElevation?: number;
}

export default function ElevationChart({ locations, mode, labelStep = 20, globalMinElevation }: Props) {
  const firstData = locations[0]?.data;

  const option = useMemo(() => {
    if (!firstData) return {};
    const labels = firstData.map((d) => d.label);
    const field = mode === 'max' ? 'maxElevation' : 'elevationAtTime';

    // Upper bound: from maxElevation so the axis stays fixed regardless of the
    // time-of-day slider. Smooth-mode values at tropical latitudes can exceed 90°.
    let yMax = -90;
    for (const loc of locations) {
      for (const d of loc.data) {
        const peak = d.maxElevation;
        if (isFinite(peak) && peak > yMax) yMax = peak;
      }
    }
    if (yMax < 0) yMax = 90;

    // Lower bound: use the precomputed global minimum across all hours/days.
    // This is fixed and never changes while the user slides the time slider.
    const rawMin = globalMinElevation ?? -90;
    const pad = 5;
    const yMin = Math.floor(rawMin - pad);
    yMax = Math.ceil(yMax + pad);

    return {
      grid: { left: 48, right: 20, top: 60, bottom: 32 },
      legend: { top: 8 },
      tooltip: {
        trigger: 'axis' as const,
        valueFormatter: (v: number) => (v != null ? `${v.toFixed(1)}°` : '—'),
      },
      xAxis: {
        type: 'category' as const,
        data: labels,
        axisLabel: { formatter: labelStepFormatter(labels, labelStep) },
      },
      yAxis: {
        type: 'value' as const,
        min: yMin,
        max: yMax,
        name: 'Degrees',
        axisLabel: { formatter: (v: number) => `${v}°` },
      },
      series: buildLineSeries(locations, field, { fill: true }),
    };
  }, [locations, mode, labelStep, firstData]);

  if (!firstData) return null;

  return <ReactECharts option={option} theme="sungazerDark" style={{ height: 400 }} notMerge />;
}
