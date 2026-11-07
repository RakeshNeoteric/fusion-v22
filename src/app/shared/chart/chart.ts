import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  type ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import type { EChartsOption } from 'echarts';
import { CHART_ENGINE, type ChartInstance } from './chart-engine';

/**
 * One ECharts chart, sized by its container and redrawn when its options change. The chart
 * library loads with the first chart shown.
 */
@Component({
  selector: 'app-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #canvas class="chart-canvas" role="img" [attr.aria-label]="label()"></div>`,
  styles: `
    :host {
      display: block;
      height: 320px;
    }
    .chart-canvas {
      width: 100%;
      height: 100%;
    }
  `,
})
export class Chart {
  readonly options = input.required<EChartsOption>();
  /** What the chart shows, for screen readers (the table under it has the numbers). */
  readonly label = input.required<string>();

  private readonly loadEngine = inject(CHART_ENGINE);
  private readonly canvas = viewChild.required<ElementRef<HTMLElement>>('canvas');
  private readonly instance = signal<ChartInstance | null>(null);

  constructor() {
    const destroyRef = inject(DestroyRef);
    let destroyed = false;
    let resizes: ResizeObserver | null = null;
    destroyRef.onDestroy(() => {
      destroyed = true;
      resizes?.disconnect();
      this.instance()?.dispose();
    });

    afterNextRender(async () => {
      try {
        const engine = await this.loadEngine();
        if (destroyed) return;
        const element = this.canvas().nativeElement;
        const chart = engine.init(element);
        if (typeof ResizeObserver !== 'undefined') {
          resizes = new ResizeObserver(() => chart.resize());
          resizes.observe(element);
        }
        this.instance.set(chart);
      } catch (error) {
        console.error('[Chart] The chart could not be drawn', error);
      }
    });

    effect(() => this.instance()?.setOption(this.options(), true));
  }

  /** The chart as a PNG data URL (white background), or null before it is drawn. */
  image(pixelRatio = 2): string | null {
    return (
      this.instance()?.getDataURL({ type: 'png', pixelRatio, backgroundColor: '#ffffff' }) ?? null
    );
  }
}
