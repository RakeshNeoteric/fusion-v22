import { type CaseFilters, filterCases } from './case-filters';
import type { CaseRow, CaseSortKey } from './case-grouping';

function row(id: number, caller: string, client = 'Acme'): CaseRow {
  return {
    kind: 'case',
    id,
    status: 'Active',
    reference: `FES-${id}`,
    number: '',
    openDate: '',
    caller,
    deceased: '',
    client,
    service: '',
    funeralDate: '',
  };
}

const CASES = [row(1, 'Jane Doe'), row(2, 'John Smith', 'Zulu'), row(3, '', 'Zulu')];
const text = (candidate: CaseRow, key: CaseSortKey) => String(candidate[key]);
const ids = (filters: CaseFilters) => filterCases(CASES, filters, text).map((c) => c.id);

describe('filterCases', () => {
  it('keeps every case without filters', () => {
    expect(filterCases(CASES, {}, text)).toBe(CASES);
  });

  it.each([
    ['contains', 'DOE', [1]],
    ['notContains', 'doe', [2, 3]],
    ['equals', 'john smith', [2]],
    ['notEqual', 'john smith', [1, 3]],
    ['startsWith', 'ja', [1]],
    ['endsWith', 'smith', [2]],
  ] as const)('%s "%s"', (type, filter, expected) => {
    expect(ids({ caller: { filterType: 'text', type, filter } })).toEqual(expected);
  });

  it('ignores a condition with no text', () => {
    expect(ids({ caller: { filterType: 'text', type: 'equals', filter: '  ' } })).toEqual([
      1, 2, 3,
    ]);
  });

  it('joins two conditions with AND or OR', () => {
    const conditions = [
      { filterType: 'text' as const, type: 'contains' as const, filter: 'jane' },
      { filterType: 'text' as const, type: 'contains' as const, filter: 'john' },
    ];
    expect(ids({ caller: { filterType: 'text', operator: 'OR', conditions } })).toEqual([1, 2]);
    expect(ids({ caller: { filterType: 'text', operator: 'AND', conditions } })).toEqual([]);
  });

  it('needs every column filter to pass', () => {
    expect(
      ids({
        client: { filterType: 'text', type: 'equals', filter: 'zulu' },
        caller: { filterType: 'text', type: 'contains', filter: 'o' },
      }),
    ).toEqual([2]);
  });
});
