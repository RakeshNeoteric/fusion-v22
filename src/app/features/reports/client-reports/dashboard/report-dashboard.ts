import { ChangeDetectionStrategy, Component, computed, input, viewChildren } from '@angular/core';
import { Chart } from '@shared/chart/chart';
import { chartOptions } from './chart-options';
import type { ClientDashboardView } from './dashboard-model';
import { DashboardTable } from './dashboard-table';

/**
 * v21 client report dashboard: a tile per service with its cases this period, the client's
 * charts, each with its table, and the period's totals.
 */
@Component({
  selector: 'app-report-dashboard',
  imports: [Chart, DashboardTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './report-dashboard.html',
  styleUrl: './report-dashboard.css',
})
export class ReportDashboard {
  readonly view = input.required<ClientDashboardView>();
  readonly clientName = input.required<string>();
  /** `01/10/2026 - 31/10/2026` */
  readonly period = input.required<string>();
  /** The year the monthly charts cover. */
  readonly year = input.required<number>();

  private readonly charts = viewChildren(Chart);

  protected readonly cards = computed(() =>
    this.view().cards.map((card) => ({
      ...card,
      options: chartOptions(card.chart),
      format: card.chart.kind === 'bar' ? ('count' as const) : card.chart.format,
    })),
  );

  /** Each drawn chart as a PNG data URL, by card id (for the Excel export). */
  chartImages(): Map<string, string> {
    const images = new Map<string, string>();
    const cards = this.cards();
    this.charts().forEach((chart, index) => {
      const card = cards[index];
      const image = chart.image();
      if (card && image) images.set(card.id, image);
    });
    return images;
  }
}
