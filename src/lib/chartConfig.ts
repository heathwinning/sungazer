import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

// Shared chart defaults
ChartJS.defaults.color = '#cbd5e1';
ChartJS.defaults.borderColor = '#334155';
ChartJS.defaults.font.family = 'system-ui, -apple-system, sans-serif';

export const chartColors = {
  sunrise: '#f59e0b',
  sunset: '#f97316',
  daylight: '#eab308',
  elevation: '#22d3ee',
  azimuth: '#a78bfa',
};
