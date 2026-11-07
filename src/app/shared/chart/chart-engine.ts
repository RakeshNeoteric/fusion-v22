import { InjectionToken } from '@angular/core';
import type { EChartsOption } from 'echarts';

/** A drawn chart: the parts of an ECharts instance the app uses. */
export interface ChartInstance {
  setOption(options: EChartsOption, notMerge: boolean): void;
  resize(): void;
  getDataURL(options: { type: 'png'; pixelRatio: number; backgroundColor: string }): string;
  dispose(): void;
}

export interface ChartEngine {
  init(element: HTMLElement): ChartInstance;
}

/** Loads ECharts on first use: it is large and only the report dashboards need it. */
export const CHART_ENGINE = new InjectionToken<() => Promise<ChartEngine>>('CHART_ENGINE', {
  providedIn: 'root',
  factory: () => () => import('./echarts-engine').then((module) => module.ECHARTS_ENGINE),
});
