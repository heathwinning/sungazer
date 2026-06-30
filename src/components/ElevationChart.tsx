import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import type { TooltipItem, ChartDataset } from 'chart.js';
import type { ChartLocation } from '../lib/types';

interface Props {
  locations: ChartLocation[];
  mode: 'max' | 'atTime';
  labelStep?: number;
}

export default function ElevationChart({ locations, mode, labelStep = 20 }: Props) {
  const firstData = locations[0]?.data;

  const chartData = useMemo(() => {
    if (!firstData) return { labels: [], datasets: [] };
    const labels = firstData.map((d) => d.label);

    const datasets: ChartDataset<'line', (number | null)[]>[] = [];

    locations.forEach((loc) => {
      const field = mode === 'max' ? 'maxElevation' as const : 'elevationAtTime' as const;
      const label = mode === 'max'
        ? `${loc.label} — Max Elevation`
        : `${loc.label} — Elevation`;

      datasets.push({
        label,
        data: loc.data.map((d) => d[field]),
        borderColor: loc.color,
        backgroundColor: loc.color + '20',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      });
    });

    return { labels, datasets };
  }, [locations, mode]);

  const options = useMemo(() => {
    return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: { usePointStyle: true, padding: 12, boxWidth: 8, font: { size: 11 } },
      },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<'line'>) =>
            `${ctx.dataset.label}: ${(ctx.parsed.y ?? 0).toFixed(1)}°`,
        },
      },
    },
    scales: {
      x: {
        ticks: {
          callback: (_val: unknown, idx: number) =>
            idx % labelStep === 0 ? firstData?.[idx]?.label : '',
          maxRotation: 0,
        },
        grid: { color: '#1e293b' },
      },
      y: {
        min: -90,
        max: 90,
        title: { display: true, text: 'Degrees' },
        ticks: { callback: (v: string | number) => `${Number(v)}°` },
        grid: { color: '#1e293b' },
      },
    },
    };
  }, [labelStep, firstData]);

  if (!firstData) return null;

  return (
    <div className="chart-container h-[400px]">
      <Line data={chartData} options={options} />
    </div>
  );
}
