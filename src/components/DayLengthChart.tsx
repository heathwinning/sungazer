import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { ChartLocation } from '../lib/types';
import { labelStepFormatter } from '../lib/echartsUtils';

interface Props {
  locations: ChartLocation[];
  labelStep?: number;
}

export default function DayLengthChart({ locations, labelStep = 20 }: Props) {
  const firstData = locations[0]?.data;

  const option = useMemo(() => {
    if (!firstData) return {};
    const labels = firstData.map((d) => d.label);

    // Compute yTime range
    const timeVals: number[] = [];
    locations.forEach((loc) => {
      loc.data.forEach((d) => {
        timeVals.push(d.sunriseHour, d.sunsetHour, d.solarNoonHour);
      });
    });
    const finiteVals = timeVals.filter((v) => isFinite(v));
    const yTimeMin = finiteVals.length > 0
      ? Math.floor(Math.min(0, Math.min(...finiteVals)) - 1)
      : 0;
    const yTimeMax = finiteVals.length > 0
      ? Math.ceil(Math.max(24, Math.max(...finiteVals)) + 1)
      : 24;

    const timeLabel = (v: number) => {
      const h = Math.floor(v);
      const m = Math.round((v - h) * 60);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const series: object[] = [];

    // Day Length per location (left axis)
    locations.forEach((loc) => {
      series.push({
        name: `${loc.label} — Day Length`,
        type: 'line' as const,
        data: loc.data.map((d) => d.dayLength),
        lineStyle: { color: loc.color, width: 2 },
        itemStyle: { color: loc.color },
        areaStyle: { color: loc.color + '1f', origin: 8 },
        smooth: 0.3,
        symbol: 'none' as const,
        yAxisIndex: 0,
      });
    });

    // Sunrise + Sunset per location (right axis, dashed)
    locations.forEach((loc) => {
      series.push({
        name: `${loc.label} — Sunrise`,
        type: 'line' as const,
        data: loc.data.map((d) => d.sunriseHour),
        lineStyle: { color: loc.color, width: 1.2, type: 'dashed' as const },
        itemStyle: { color: loc.color },
        smooth: 0.3,
        symbol: 'none' as const,
        yAxisIndex: 1,
      });
      series.push({
        name: `${loc.label} — Sunset`,
        type: 'line' as const,
        data: loc.data.map((d) => d.sunsetHour),
        lineStyle: { color: loc.color, width: 1.2, type: 'dotted' as const },
        itemStyle: { color: loc.color },
        smooth: 0.3,
        symbol: 'none' as const,
        yAxisIndex: 1,
      });
    });

    // Solar Noon — first location only (right axis)
    if (locations.length > 0) {
      series.push({
        name: `${locations[0].label} — Solar Noon`,
        type: 'line' as const,
        data: locations[0].data.map((d) => d.solarNoonHour),
        lineStyle: { color: locations[0].color + '80', width: 0.8, type: 'dashed' as const },
        itemStyle: { color: locations[0].color + '80' },
        smooth: 0.3,
        symbol: 'none' as const,
        yAxisIndex: 1,
      });
    }

    return {
      grid: { left: 48, right: 56, top: 70, bottom: 32 },
      legend: { top: 8, type: 'scroll' as const },
      tooltip: {
        trigger: 'axis' as const,
        formatter: (params: any) => {
          if (!Array.isArray(params)) return '';
          return params
            .map((p: any) => {
              const v = p.data;
              if (v == null) return `${p.seriesName}: —`;
              const name = p.seriesName || '';
              if (name.includes('Day Length')) {
                const h = Math.floor(v);
                const m = Math.round((v - h) * 60);
                return `${name}: ${h}h ${m}m`;
              }
              return `${name}: ${timeLabel(v)}`;
            })
            .join('<br/>');
        },
      },
      xAxis: {
        type: 'category' as const,
        data: labels,
        axisLabel: { formatter: labelStepFormatter(labels, labelStep) },
      },
      yAxis: [{
        type: 'value' as const,
        min: 8,
        max: 18,
        name: 'Hours',
        axisLabel: { formatter: (v: number) => `${v}h` },
      }, {
        type: 'value' as const,
        min: yTimeMin,
        max: yTimeMax,
        name: 'Time of Day',
        axisLabel: { formatter: timeLabel },
      }],
      series,
    };
  }, [locations, labelStep, firstData]);

  if (!firstData) return null;

  return <ReactECharts option={option} theme="sungazerDark" style={{ height: 400 }} notMerge />;
}
