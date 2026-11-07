import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { money } from '@shared/reference/money';
import type { BudgetTable, MonthTable, ValueFormat } from './dashboard-model';
import { MONTHS } from './month-series';

/** The numbers under a dashboard chart, a column per month (v21 `DashboardTableComponent`). */
@Component({
  selector: 'app-dashboard-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-table.html',
  styleUrl: './dashboard-table.css',
})
export class DashboardTable {
  readonly table = input.required<MonthTable | BudgetTable>();
  /** Names the table for screen readers, e.g. the chart's title. */
  readonly caption = input.required<string>();
  readonly format = input<ValueFormat>('count');

  protected readonly months = MONTHS;
  protected readonly monthTable = computed(() => {
    const table = this.table();
    return table.kind === 'months' ? table : null;
  });
  protected readonly budgetTable = computed(() => {
    const table = this.table();
    return table.kind === 'budget' ? table : null;
  });
  /** Whether the rows have a year total column (province tables). */
  protected readonly yearTotals = computed(
    () => this.monthTable()?.rows.some((row) => row.total !== undefined) ?? false,
  );

  protected value(value: number | undefined): string {
    const shown = value ?? 0;
    return this.format() === 'rand' ? money(shown) : shown.toLocaleString('en-ZA');
  }
}
