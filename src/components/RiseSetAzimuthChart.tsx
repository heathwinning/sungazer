import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import type { TooltipItem, ChartDataset } from 'chart.js';
import type { ChartLocation } from '../lib/types';

interface Props {
  locations: ChartLocation[];
  labelStep?: number;
}

function alpha(color: string, a: number): string {
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export default function RiseSetAzimuthChart({ locations, labelStep = 20 }: Props) {
  const firstData = locations[0]?.data;

  const chartData = useMemo(() => {
    if (!firstData) return { labels: [], datasets: [] };
    const labels = firstData.map((d) => d.label);

    const datasets: ChartDataset<'line', (number | null)[]>[] = [];

    locations.forEach((loc) => {
      // Sunrise azimuth line (dashed)
      datasets.push({
        label: `${loc.label} — Sunrise`,
        data: loc.data.map((d) => d.sunriseAzimuth),
        borderColor: loc.color,
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 1.5,
        borderDash: [4, 4],
      });
      // Sunset azimuth line (dotted)
      datasets.push({
        label: `${loc.label} — Sunset`,
        data: loc.data.map((d) => d.sunsetAzimuth),
        borderColor: loc.color,
        backgroundColor: alpha(loc.color, 0.1),
        fill: false,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 1.5,
        borderDash: [1, 4],
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
            const dir = azimuthLabel(v);
            return `${ctx.dataset.label}: ${v.toFixed(1)}° (${dir})`;
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
        max: 360,
        title: { display: true, text: 'Degrees from North' },
        ticks: {
          callback: (v: string | number) => {
            const n = Number(v);
            if (n === 0 || n === 360) return 'N (0°)';
            if (n === 45) return 'NE (45°)';
            if (n === 90) return 'E (90°)';
            if (n === 135) return 'SE (135°)';
            if (n === 180) return 'S (180°)';
            if (n === 225) return 'SW (225°)';
            if (n === 270) return 'W (270°)';
            if (n === 315) return 'NW (315°)';
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

function azimuthLabel(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const i = Math.round(((deg % 360) / 22.5)) % 16;
  return dirs[i];
}
