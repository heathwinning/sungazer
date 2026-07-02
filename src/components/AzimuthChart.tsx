import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { ChartLocation } from '../lib/types';
import { labelStepFormatter, buildLineSeries } from '../lib/echartsUtils';

interface Props {
  locations: ChartLocation[];
  labelStep?: number;
}

export default function AzimuthChart({ locations, labelStep = 20 }: Props) {
  const firstData = locations[0]?.data;

  const option = useMemo(() => {
    if (!firstData) return {};
    const labels = firstData.map((d) => d.label);

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
        min: 0,
        max: 360,
        name: 'Degrees',
        axisLabel: {
          formatter: (v: number) => {
            if (v === 0 || v === 360) return 'N (0°)';
            if (v === 90) return 'E (90°)';
            if (v === 180) return 'S (180°)';
            if (v === 270) return 'W (270°)';
            return `${v}°`;
          },
        },
      },
      series: buildLineSeries(locations, 'azimuthAtTime', { fill: true }),
    };
  }, [locations, labelStep, firstData]);

  if (!firstData) return null;

  return <ReactECharts option={option} theme="sungazerDark" style={{ height: 400 }} notMerge />;
}
