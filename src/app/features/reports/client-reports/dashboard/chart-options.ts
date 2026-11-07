import type { EChartsOption } from 'echarts';
import { money } from '@shared/reference/money';
import type { ChartSpec, ValueFormat } from './dashboard-model';
import { MONTHS } from './month-series';

/** Text and rules: recessive, so the data stands out. */
const INK = { primary: '#0b0b0b', secondary: '#52514e', muted: '#898781' };
const GRID_LINE = '#e1e0d9';
const AXIS_LINE = '#c3c2b7';
const SURFACE = '#ffffff';
const FONT = 'Poppins, sans-serif';

const formatValue = (format: ValueFormat) => (value: unknown) =>
  format === 'rand' ? `R ${money(Number(value))}` : Number(value).toLocaleString('en-ZA');

/** Long names are cut on the chart; the legend, tooltip and table have them in full. */
const shorten = (name: string) => (name.length > 15 ? `${name.slice(0, 15)}…` : name);

const categoryAxis = (data: readonly string[]) => ({
  type: 'category' as const,
  data: [...data],
  axisLine: { lineStyle: { color: AXIS_LINE } },
  axisTick: { show: false },
  axisLabel: { color: INK.muted },
});

const valueAxis = (format: ValueFormat) => ({
  type: 'value' as const,
  minInterval: format === 'count' ? 1 : 0,
  splitLine: { lineStyle: { color: GRID_LINE } },
  axisLabel: {
    color: INK.muted,
    formatter: (value: number) =>
      format === 'rand' ? `R ${value.toLocaleString('en-ZA')}` : value.toLocaleString('en-ZA'),
  },
});

const tooltip = (trigger: 'axis' | 'item', format: ValueFormat) => ({
  trigger,
  valueFormatter: formatValue(format),
  textStyle: { color: INK.primary, fontFamily: FONT },
});

/** The ECharts options that draw a dashboard chart (v21 `ReportChartFactory`). */
export function chartOptions(spec: ChartSpec): EChartsOption {
  const base: EChartsOption = { textStyle: { fontFamily: FONT, color: INK.secondary } };
  switch (spec.kind) {
    case 'line':
      return {
        ...base,
        tooltip: tooltip('axis', spec.format),
        legend: { top: 0, right: 10, type: 'scroll', textStyle: { color: INK.secondary } },
        grid: { top: 40, left: 16, right: 16, bottom: 8, containLabel: true },
        xAxis: categoryAxis(MONTHS),
        yAxis: valueAxis(spec.format),
        series: spec.series.map((line) => ({
          name: line.name,
          type: 'line',
          smooth: true,
          // Curves between the months, never past them (a count never dips below 0).
          smoothMonotone: 'x',
          data: [...line.values],
          symbolSize: 8,
          color: line.color,
          lineStyle: { width: 2 },
        })),
      };
    case 'bar':
      return {
        ...base,
        tooltip: tooltip('axis', 'count'),
        grid: { top: 24, left: 16, right: 16, bottom: 8, containLabel: true },
        xAxis: categoryAxis(spec.categories),
        yAxis: valueAxis('count'),
        series: [
          {
            name: spec.name,
            type: 'bar',
            data: [...spec.values],
            color: spec.color,
            barMaxWidth: 50,
            itemStyle: { borderRadius: [4, 4, 0, 0] },
            label: { show: true, position: 'top', color: INK.secondary },
          },
        ],
      };
    case 'pie':
      return {
        ...base,
        tooltip: tooltip('item', spec.format),
        legend: { bottom: 0, left: 'center', type: 'scroll', textStyle: { color: INK.secondary } },
        series: [
          {
            type: 'pie',
            radius: ['55%', '75%'],
            center: ['50%', '45%'],
            avoidLabelOverlap: true,
            itemStyle: { borderColor: SURFACE, borderWidth: 2 },
            label: {
              color: INK.secondary,
              formatter: (params: { name: string; value: unknown }) =>
                `${shorten(params.name)}\n${formatValue(spec.format)(params.value)}`,
            },
            data: spec.slices.map((slice) => ({
              name: slice.name,
              value: slice.value,
              itemStyle: { color: slice.color },
            })),
          },
        ],
      };
  }
}
