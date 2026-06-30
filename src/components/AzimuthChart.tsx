import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import type { TooltipItem, ChartDataset } from 'chart.js';
import type { ChartLocation } from '../lib/types';

interface Props {
  locations: ChartLocation[];
  labelStep?: number;
}

export default function AzimuthChart({ locations, labelStep = 20 }: Props) {
  const firstData = locations[0]?.data;

  const chartData = useMemo(() => {
    if (!firstData) return { labels: [], datasets: [] };
    const labels = firstData.map((d) => d.label);

    const datasets: ChartDataset<'line', (number | null)[]>[] = [];

    locations.forEach((loc) => {
      datasets.push({
        label: `${loc.label} — Azimuth`,
        data: loc.data.map((d) => d.azimuthAtTime),
        borderColor: loc.color,
        backgroundColor: loc.color + '20',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      });
    });

    return { labels, datasets };
  }, [locations]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
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
        min: 0,
        max: 360,
        title: { display: true, text: 'Degrees' },
        ticks: {
          callback: (v: string | number) => {
            const n = Number(v);
            if (n === 0 || n === 360) return 'N (0°/360°)';
            if (n === 90) return 'E (90°)';
            if (n === 180) return 'S (180°)';
            if (n === 270) return 'W (270°)';
            return `${n}°`;
          },
        },
        grid: { color: '#1e293b' },
      },
    },
  }), [firstData, labelStep]);

  if (!firstData) return null;

  return (
    <div className="chart-container h-[400px]">
      <Line data={chartData} options={options} />
    </div>
  );
}
