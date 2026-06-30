import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import type { TooltipItem, ChartDataset } from 'chart.js';
import type { ChartLocation } from '../lib/types';

interface Props {
  locations: ChartLocation[];
  labelStep?: number;
}

function alpha(color: string, a: number): string {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export default function DayLengthChart({ locations, labelStep = 20 }: Props) {
  const firstData = locations[0]?.data;

  const chartData = useMemo(() => {
    if (!firstData) return { labels: [], datasets: [] };
    const labels = firstData.map((d) => d.label);

    const datasets: ChartDataset<'line', (number | null)[]>[] = [];

    // One Day Length line per location
    locations.forEach((loc) => {
      datasets.push({
        label: `${loc.label} — Day Length`,
        data: loc.data.map((d) => d.dayLength),
        borderColor: loc.color,
        backgroundColor: alpha(loc.color, 0.12),
        fill: { target: { value: 8 } },
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
        yAxisID: 'y',
      });
    });

    // Sunrise + Sunset per location (dashed)
    locations.forEach((loc) => {
      datasets.push({
        label: `${loc.label} — Sunrise`,
        data: loc.data.map((d) => d.sunriseHour),
        borderColor: loc.color,
        fill: false,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 1.2,
        borderDash: [4, 4],
        yAxisID: 'yTime',
      });
      datasets.push({
        label: `${loc.label} — Sunset`,
        data: loc.data.map((d) => d.sunsetHour),
        borderColor: loc.color,
        fill: false,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 1.2,
        borderDash: [2, 4],
        yAxisID: 'yTime',
      });
    });

    // Solar Noon — only for first location to avoid clutter
    if (locations.length > 0) {
      datasets.push({
        label: `${locations[0].label} — Solar Noon`,
        data: locations[0].data.map((d) => d.solarNoonHour),
        borderColor: alpha(locations[0].color, 0.5),
        fill: false,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 0.8,
        borderDash: [2, 8],
        yAxisID: 'yTime',
      });
    }

    return { labels, datasets };
  }, [locations]);

  const options = useMemo(() => {
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

    return {
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
              const lbl = ctx.dataset.label || '';
              const y = ctx.parsed.y ?? 0;
              if (lbl.includes('Day Length')) {
                const h = Math.floor(y);
                const m = Math.round((y - h) * 60);
                return `${lbl}: ${h}h ${m}m`;
              }
              const h = Math.floor(y);
              const m = Math.round((y - h) * 60);
              return `${lbl}: ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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
          type: 'linear' as const,
          position: 'left' as const,
          title: { display: true, text: 'Hours' },
          min: 8,
          max: 18,
          ticks: { callback: (v: string | number) => `${Number(v)}h` },
          grid: { color: '#1e293b' },
        },
        yTime: {
          type: 'linear' as const,
          position: 'right' as const,
          title: { display: true, text: 'Time of Day' },
          min: yTimeMin,
          max: yTimeMax,
          ticks: {
            callback: (v: string | number) => {
              const n = Number(v);
              const h = Math.floor(n);
              const m = Math.round((n - h) * 60);
              return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            },
          },
          grid: { drawOnChartArea: false },
        },
      },
    };
  }, [locations, labelStep, firstData]);

  if (!firstData) return null;

  return (
    <div className="chart-container h-[400px]">
      <Line data={chartData} options={options} />
    </div>
  );
}
