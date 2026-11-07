import { chartOptions } from './chart-options';

type Formatter = (params: { name: string; value: unknown }) => string;

describe('chartOptions', () => {
  it('line: a series per line, across the months, in its colour', () => {
    const options = chartOptions({
      kind: 'line',
      format: 'count',
      series: [{ name: 'Funeral', color: '#2a78d6', values: [1, 2] }],
    });
    expect(options.xAxis).toMatchObject({ data: expect.arrayContaining(['Jan', 'Dec']) });
    expect(options.series).toEqual([
      expect.objectContaining({ name: 'Funeral', type: 'line', data: [1, 2], color: '#2a78d6' }),
    ]);
  });

  it('bar: one bar per category, labelled', () => {
    const options = chartOptions({
      kind: 'bar',
      name: 'Cases',
      color: '#2a78d6',
      categories: ['Active'],
      values: [3],
    });
    expect(options.xAxis).toMatchObject({ data: ['Active'] });
    expect(options.series).toEqual([
      expect.objectContaining({
        type: 'bar',
        data: [3],
        label: expect.objectContaining({ show: true }),
      }),
    ]);
  });

  it('pie: a slice per name, Rand amounts labelled as Rand', () => {
    const options = chartOptions({
      kind: 'pie',
      format: 'rand',
      slices: [{ name: 'Grocery Value YTD long name', color: '#1baf7a', value: 750 }],
    });
    const [pie] = options.series as [{ data: unknown; label: { formatter: Formatter } }];
    expect(pie.data).toEqual([
      { name: 'Grocery Value YTD long name', value: 750, itemStyle: { color: '#1baf7a' } },
    ]);
    expect(pie.label.formatter({ name: 'Grocery Value YTD long name', value: 750 })).toBe(
      'Grocery Value Y…\nR 750.00',
    );
  });
});
