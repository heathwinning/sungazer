import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import type { TooltipItem, ChartDataset } from 'chart.js';
import type { ChartLocation } from '../lib/types';

interface Props {
  locations: ChartLocation[];
  labelStep?: number;
}

/** Difference between solar noon and 12:00 clock time, in minutes. */
export default function EquationOfTimeChart({ locations, labelStep = 20 }: Props) {
  const firstData = locations[0]?.data;

  const chartData = useMemo(() => {
    if (!firstData) return { labels: [], datasets: [] };
    const labels = firstData.map((d) => d.label);
    const datasets: ChartDataset<'line', (number | null)[]>[] = [];

    locations.forEach((loc) => {
      datasets.push({
        label: `${loc.label} — EoT`,
        data: loc.data.map((d) => (d.solarNoonHour - 12) * 60),
        borderColor: loc.color,
        backgroundColor: loc.color + '20',
        fill: false,
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
            const sign = v >= 0 ? '+' : '';
            return `${ctx.dataset.label}: ${sign}${v.toFixed(1)} min`;
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
        title: { display: true, text: 'Minutes from clock noon' },
        ticks: { callback: (v: string | number) => `${Number(v).toFixed(0)}m` },
        grid: { color: '#1e293b' },
      },
    },
  }), [firstData, labelStep]);

  if (!firstData) return null;

  return (
    <div className="chart-container h-[300px]">
      <Line data={chartData} options={options} />
    </div>
  );
}
