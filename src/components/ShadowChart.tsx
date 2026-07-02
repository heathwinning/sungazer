import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { ChartLocation } from '../lib/types';
import { labelStepFormatter } from '../lib/echartsUtils';

interface Props {
  locations: ChartLocation[];
  labelStep?: number;
}

/** Shadow length ÷ object height. 1 = shadow equals height, 2 = twice as long. */
export default function ShadowChart({ locations, labelStep = 20 }: Props) {
  const firstData = locations[0]?.data;

  const option = useMemo(() => {
    if (!firstData) return {};
    const labels = firstData.map((d) => d.label);

    return {
      grid: { left: 56, right: 20, top: 40, bottom: 32 },
      legend: { top: 0 },
      tooltip: {
        trigger: 'axis' as const,
        valueFormatter: (v: number) => (v != null ? `${v.toFixed(2)}×` : '—'),
      },
      xAxis: {
        type: 'category' as const,
        data: labels,
        axisLabel: { formatter: labelStepFormatter(labels, labelStep) },
      },
      yAxis: {
        type: 'value' as const,
        min: 0,
        name: 'Shadow ÷ Height',
        axisLabel: { formatter: (v: number) => `${v}×` },
      },
      series: locations.map((loc) => ({
        name: `${loc.label} — Shadow`,
        type: 'line' as const,
        data: loc.data.map((d) => {
          const elevRad = (d.maxElevation * Math.PI) / 180;
          return elevRad > 0.01 ? 1 / Math.tan(elevRad) : 50;
        }),
        lineStyle: { color: loc.color, width: 2 },
        itemStyle: { color: loc.color },
        areaStyle: { color: loc.color + '20' },
        smooth: 0.3,
        symbol: 'none' as const,
      })),
    };
  }, [locations, labelStep, firstData]);

  if (!firstData) return null;

  return <ReactECharts option={option} theme="sungazerDark" style={{ height: 350 }} notMerge />;
}
