/**
 * Shared ECharts dark theme — imported as a side-effect in App.tsx.
 * Provides consistent styling across all chart types (line, polar, geo).
 */
import * as echarts from 'echarts';

// Register dark theme
echarts.registerTheme('sungazerDark', {
  color: [
    '#f59e0b', '#22d3ee', '#a78bfa', '#f97316',
    '#34d399', '#f472b6', '#60a5fa', '#fb923c',
  ],
  backgroundColor: '#020617',
  textStyle: {
    color: '#94a3b8',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  title: {
    textStyle: { color: '#cbd5e1', fontWeight: 'normal', fontSize: 13 },
  },
  legend: {
    textStyle: { color: '#94a3b8', fontSize: 11 },
    pageTextStyle: { color: '#94a3b8' },
  },
  tooltip: {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderColor: '#475569',
    borderWidth: 1,
    padding: [8, 12],
    textStyle: { color: '#e2e8f0', fontSize: 12 },
    axisPointer: {
      lineStyle: { color: '#475569' },
      crossStyle: { color: '#475569' },
    },
  },
  categoryAxis: {
    axisLine: { lineStyle: { color: '#334155' } },
    axisTick: { lineStyle: { color: '#334155' } },
    axisLabel: { color: '#64748b', fontSize: 10 },
    splitLine: { lineStyle: { color: '#1e293b' } },
  },
  valueAxis: {
    axisLine: { lineStyle: { color: '#334155' } },
    axisTick: { lineStyle: { color: '#334155' } },
    axisLabel: { color: '#64748b', fontSize: 10 },
    splitLine: { lineStyle: { color: '#1e293b' } },
  },
  angleAxis: {
    axisLine: { lineStyle: { color: '#334155' } },
    axisLabel: { color: '#64748b', fontSize: 10 },
    splitLine: { lineStyle: { color: '#1e293b' } },
  },
  radiusAxis: {
    axisLine: { lineStyle: { color: '#334155' } },
    axisLabel: { color: '#64748b', fontSize: 10 },
    splitLine: { lineStyle: { color: '#1e293b' } },
  },
  geo: {
    itemStyle: {
      areaColor: '#0f172a',
      borderColor: '#334155',
    },
    label: { color: '#94a3b8' },
  },
});
