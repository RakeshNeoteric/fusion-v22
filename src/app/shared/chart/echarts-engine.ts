import { BarChart, LineChart, PieChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { init, use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import type { ChartEngine, ChartInstance } from './chart-engine';

// Only what the dashboards draw, so the chunk stays small.
use([
  LineChart,
  BarChart,
  PieChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer,
]);

export const ECHARTS_ENGINE: ChartEngine = {
  init: (element) => init(element) as unknown as ChartInstance,
};
