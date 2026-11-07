import { TestBed } from '@angular/core/testing';
import type { BudgetTable, MonthTable } from './dashboard-model';
import { DashboardTable } from './dashboard-table';

const year = (...values: number[]) => [...values, ...Array(12 - values.length).fill(0)];

function render(table: MonthTable | BudgetTable, format: 'count' | 'rand' = 'count') {
  const fixture = TestBed.createComponent(DashboardTable);
  fixture.componentRef.setInput('table', table);
  fixture.componentRef.setInput('caption', 'Cases');
  fixture.componentRef.setInput('format', format);
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;
  return [...host.querySelectorAll('tr')].map((row) =>
    [...row.querySelectorAll('th, td')].map((cell) => cell.textContent?.trim()),
  );
}

describe('DashboardTable', () => {
  it('a row per series and the monthly totals, with year totals for provinces', () => {
    const rows = render({
      kind: 'months',
      rowLabel: 'Province',
      rows: [{ name: 'Gauteng', color: '#2a78d6', values: year(1, 2), total: 3 }],
      totals: { values: year(1, 2), total: 3 },
    });
    expect(rows[0]).toEqual([
      'Province',
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
      'Total (Yearly)',
    ]);
    expect(rows[1]).toEqual(['Gauteng', '1', '2', ...Array(10).fill('0'), '3']);
    expect(rows[2]?.[0]).toBe('Total (Monthly)');
    expect(rows[2]?.at(-1)).toBe('3');
  });

  it('Rand amounts as Rand', () => {
    const rows = render(
      {
        kind: 'months',
        rowLabel: 'Service',
        rows: [{ name: 'Value', color: '#000', values: year(1250) }],
      },
      'rand',
    );
    expect(rows[1]?.slice(0, 2)).toEqual(['Value', '1,250.00']);
    expect(rows[1]).toHaveLength(13);
  });

  it('budget tables: a block per service with its budget and actual rows', () => {
    const rows = render({
      kind: 'budget',
      groups: [{ name: 'Info', color: '#2a78d6', budget: year(4), actual: year(1) }],
    });
    expect(rows.map((row) => row.slice(0, 2))).toEqual([
      ['Info'],
      ['', 'Jan'],
      ['Budget', '4'],
      ['Actual', '1'],
    ]);
  });
});
