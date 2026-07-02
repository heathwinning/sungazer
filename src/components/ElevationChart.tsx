import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { ChartLocation } from '../lib/types';
import { labelStepFormatter, buildLineSeries } from '../lib/echartsUtils';

interface Props {
  locations: ChartLocation[];
  mode: 'max' | 'atTime';
  labelStep?: number;
}

export default function ElevationChart({ locations, mode, labelStep = 20 }: Props) {
  const firstData = locations[0]?.data;

  const option = useMemo(() => {
    if (!firstData) return {};
    const labels = firstData.map((d) => d.label);
    const field = mode === 'max' ? 'maxElevation' : 'elevationAtTime';

    return {
      grid: { left: 48, right: 20, top: 40, bottom: 32 },
      legend: { top: 0 },
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
        min: -90,
        max: 90,
        name: 'Degrees',
        axisLabel: { formatter: (v: number) => `${v}°` },
      },
      series: buildLineSeries(locations, field, { fill: true }),
    };
  }, [locations, mode, labelStep, firstData]);

  if (!firstData) return null;

  return <ReactECharts option={option} theme="sungazerDark" style={{ height: 400 }} notMerge />;
}
