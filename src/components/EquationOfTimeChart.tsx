import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { ChartLocation } from '../lib/types';
import { labelStepFormatter } from '../lib/echartsUtils';

interface Props {
  locations: ChartLocation[];
  labelStep?: number;
}

/** Difference between solar noon and 12:00 clock time, in minutes. */
export default function EquationOfTimeChart({ locations, labelStep = 20 }: Props) {
  const firstData = locations[0]?.data;

  const option = useMemo(() => {
    if (!firstData) return {};
    const labels = firstData.map((d) => d.label);

    return {
      grid: { left: 56, right: 20, top: 60, bottom: 32 },
      legend: { top: 8 },
      tooltip: {
        trigger: 'axis' as const,
        valueFormatter: (v: number) => {
          if (v == null) return '—';
          const sign = v >= 0 ? '+' : '';
          return `${sign}${v.toFixed(1)} min`;
        },
      },
      xAxis: {
        type: 'category' as const,
        data: labels,
        axisLabel: { formatter: labelStepFormatter(labels, labelStep) },
      },
      yAxis: {
        type: 'value' as const,
        name: 'Minutes from 12:00',
        axisLabel: { formatter: (v: number) => `${v.toFixed(0)}m` },
      },
      series: locations.map((loc) => ({
        name: `${loc.label} — EoT`,
        type: 'line' as const,
        data: loc.data.map((d) => (d.solarNoonHour - 12) * 60),
        lineStyle: { color: loc.color, width: 2 },
        itemStyle: { color: loc.color },
        smooth: 0.3,
        symbol: 'none' as const,
      })),
    };
  }, [locations, labelStep, firstData]);

  if (!firstData) return null;

  return <ReactECharts option={option} theme="sungazerDark" style={{ height: 300 }} notMerge />;
}
