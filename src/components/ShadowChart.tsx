import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import type { TooltipItem, ChartDataset } from 'chart.js';
import type { ChartLocation } from '../lib/types';

interface Props {
  locations: ChartLocation[];
  labelStep?: number;
}

/** Shadow length ÷ object height. 1 = shadow equals height, 2 = twice as long. */
export default function ShadowChart({ locations, labelStep = 20 }: Props) {
  const firstData = locations[0]?.data;

  const chartData = useMemo(() => {
    if (!firstData) return { labels: [], datasets: [] };
    const labels = firstData.map((d) => d.label);
    const datasets: ChartDataset<'line', (number | null)[]>[] = [];

    locations.forEach((loc) => {
      datasets.push({
        label: `${loc.label} — Shadow Multiplier`,
        data: loc.data.map((d) => {
          const elevRad = (d.maxElevation * Math.PI) / 180;
          return elevRad > 0.01 ? 1 / Math.tan(elevRad) : 50; // cap for near-zero elevation
        }),
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
          label: (ctx: TooltipItem<'line'>) => {
            const v = ctx.parsed.y ?? 0;
            return `${ctx.dataset.label}: ${v.toFixed(2)}× height`;
          },
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
        title: { display: true, text: 'Shadow ÷ Height' },
        ticks: { callback: (v: string | number) => `${Number(v)}×` },
        grid: { color: '#1e293b' },
      },
    },
  }), [firstData, labelStep]);

  if (!firstData) return null;

  return (
    <div className="chart-container h-[350px]">
      <Line data={chartData} options={options} />
    </div>
  );
}
