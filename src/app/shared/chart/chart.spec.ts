import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { EChartsOption } from 'echarts';
import { Chart } from './chart';
import { CHART_ENGINE, type ChartInstance } from './chart-engine';

@Component({
  imports: [Chart],
  template: `@if (shown()) {
    <app-chart [options]="options()" label="Cases" />
  }`,
})
class Host {
  readonly shown = signal(true);
  readonly options = signal<EChartsOption>({ series: [] });
  readonly chart = viewChild(Chart);
}

describe('Chart', () => {
  const setOption = vi.fn();
  const dispose = vi.fn();
  const instance: ChartInstance = {
    setOption,
    dispose,
    resize: vi.fn(),
    getDataURL: () => 'data:image/png;base64,AAA',
  };

  async function render() {
    setOption.mockReset();
    dispose.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: CHART_ENGINE, useValue: () => Promise.resolve({ init: () => instance }) },
      ],
    });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    await vi.waitFor(() => expect(setOption).toHaveBeenCalled());
    return fixture;
  }

  it('draws the options, and redraws them when they change', async () => {
    const fixture = await render();
    expect(setOption).toHaveBeenLastCalledWith({ series: [] }, true);
    fixture.componentInstance.options.set({ series: [{ type: 'line' }] });
    await fixture.whenStable();
    expect(setOption).toHaveBeenLastCalledWith({ series: [{ type: 'line' }] }, true);
    const canvas = (fixture.nativeElement as HTMLElement).querySelector('[role="img"]');
    expect(canvas?.getAttribute('aria-label')).toBe('Cases');
  });

  it('gives the chart as an image, and lets it go when removed', async () => {
    const fixture = await render();
    expect(fixture.componentInstance.chart()?.image()).toBe('data:image/png;base64,AAA');
    fixture.componentInstance.shown.set(false);
    await fixture.whenStable();
    expect(dispose).toHaveBeenCalled();
  });
});
