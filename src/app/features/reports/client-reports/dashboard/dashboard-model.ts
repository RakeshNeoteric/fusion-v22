/** How a chart's numbers read: case/voucher counts, or Rand amounts. */
export type ValueFormat = 'count' | 'rand';

export interface ChartSeries {
  readonly name: string;
  readonly color: string;
  /** One value a month, January first. */
  readonly values: readonly number[];
}

export interface PieSlice {
  readonly name: string;
  readonly color: string;
  readonly value: number;
}

/** What a dashboard chart draws, independent of the chart library. */
export type ChartSpec =
  | { readonly kind: 'line'; readonly series: readonly ChartSeries[]; readonly format: ValueFormat }
  | {
      readonly kind: 'bar';
      readonly name: string;
      readonly color: string;
      readonly categories: readonly string[];
      readonly values: readonly number[];
    }
  | { readonly kind: 'pie'; readonly slices: readonly PieSlice[]; readonly format: ValueFormat };

export interface MonthTableRow {
  readonly name: string;
  readonly color: string;
  readonly values: readonly number[];
  /** The row's year total (province tables). */
  readonly total?: number;
}

/** A row per series, a column per month. */
export interface MonthTable {
  readonly kind: 'months';
  /** What a row is: 'Service' or 'Province'. */
  readonly rowLabel: string;
  readonly rows: readonly MonthTableRow[];
  /** The "Total (Monthly)" row, and its year total when the rows have one. */
  readonly totals?: { readonly values: readonly number[]; readonly total?: number };
}

/** v21 Nedgroup support services: a block per service with its budget and actual rows. */
export interface BudgetTable {
  readonly kind: 'budget';
  readonly groups: readonly {
    readonly name: string;
    readonly color: string;
    readonly budget: readonly number[];
    readonly actual: readonly number[];
  }[];
}

export interface DashboardCard {
  /** v21's chart id, which the Excel export also uses. */
  readonly id: string;
  readonly title: string;
  /**
   * What the chart covers: the period asked for, or every month of this year (the backend
   * counts the year's cases month by month whatever the period).
   */
  readonly covers: 'period' | 'year';
  readonly chart: ChartSpec;
  readonly table: MonthTable | BudgetTable | null;
}

/** Whether a change is good news (green) or bad (red). */
export type Tone = 'good' | 'bad';

/** A service's cases this period, against the period a month earlier. */
export interface ServiceTile {
  readonly title: string;
  /** Under `icons/services/`. */
  readonly icon: string;
  readonly value: number;
  /** `+25%` */
  readonly change: string;
  readonly tone: Tone;
}

export interface SummaryTile {
  readonly label: string;
  readonly value: string;
  readonly change: string | null;
  readonly tone: Tone;
}

export interface ClientDashboardView {
  readonly tiles: readonly ServiceTile[];
  readonly cards: readonly DashboardCard[];
  readonly summary: readonly SummaryTile[];
}
