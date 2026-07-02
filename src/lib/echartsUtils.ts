import type { ChartLocation } from './types';

/**
 * Build a label-step formatter for category axes.
 * Shows labels only at `step` intervals, empty string otherwise.
 */
export function labelStepFormatter(labels: string[], step: number) {
  return (_value: string, index: number): string =>
    index % step === 0 ? (labels[index] ?? '') : '';
}

/**
 * Build ECharts line series dataset for a single data field.
 */
export function buildLineSeries(
  locations: ChartLocation[],
  field: keyof ChartLocation['data'][number],
  opts?: {
    suffix?: string;
    fill?: boolean;
    dash?: number[];
    lineWidth?: number;
    yAxisIndex?: number;
    labelPrefix?: string;
    labelSuffix?: string;
  },
) {
  return locations.map((loc) => ({
    name: opts?.labelPrefix
      ? `${loc.label} — ${opts.labelPrefix}`
      : loc.label,
    type: 'line' as const,
    data: loc.data.map((d) => d[field] as number),
    lineStyle: {
      color: loc.color,
      width: opts?.lineWidth ?? 2,
      type: opts?.dash ? 'dashed' as const : 'solid' as const,
    },
    itemStyle: { color: loc.color },
    areaStyle: opts?.fill ? { color: loc.color + '20' } : undefined,
    smooth: 0.3,
    symbol: 'none' as const,
    yAxisIndex: opts?.yAxisIndex ?? 0,
  }));
}
