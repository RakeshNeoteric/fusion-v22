import { type CaseRow, groupCases } from './case-grouping';

const row = (
  id: number,
  client: string,
  service: string,
  extra: Partial<CaseRow> = {},
): CaseRow => ({
  kind: 'case',
  id,
  status: 'Active',
  reference: `R${id}`,
  number: `${id}`,
  openDate: '',
  caller: '',
  deceased: '',
  client,
  service,
  funeralDate: '',
  ...extra,
});

const CASES = [
  row(5, 'FNB', 'Funeral', { status: 'Closed' }),
  row(4, 'NED', 'Airtime'),
  row(3, 'FNB', 'Funeral'),
  row(2, 'FNB', 'Grocery'),
  row(1, '', 'Funeral'),
];

const describeRows = (rows: ReturnType<typeof groupCases>) =>
  rows.map((r) =>
    r.kind === 'group' ? `${'  '.repeat(r.level)}${r.label} (${r.count})` : `#${r.id}`,
  );

describe('groupCases', () => {
  it('groups like v21: client groups open, the rest closed, in the order they first appear', () => {
    expect(describeRows(groupCases(CASES, ['client', 'service', 'status'], new Set()))).toEqual([
      'FNB (3)',
      '  Funeral (2)',
      '  Grocery (1)',
      'NED (1)',
      '  Airtime (1)',
      'Unknown Client (1)',
      '  Funeral (1)',
    ]);
  });

  it('opens and closes the groups the user toggled', () => {
    const rows = groupCases(CASES, ['client', 'service', 'status'], new Set());
    const funeral = rows[1];
    const ned = rows[3];
    if (funeral?.kind !== 'group' || ned?.kind !== 'group') throw new Error('expected groups');
    const toggled = new Set([funeral.path, ned.path]);
    expect(describeRows(groupCases(CASES, ['client', 'service', 'status'], toggled))).toEqual([
      'FNB (3)',
      '  Funeral (2)',
      '    Closed (1)',
      '    Active (1)',
      '  Grocery (1)',
      'NED (1)',
      'Unknown Client (1)',
      '  Funeral (1)',
    ]);
  });

  it('keeps groups apart when a name repeats under another parent', () => {
    const rows = groupCases(CASES, ['client', 'service'], new Set());
    const paths = rows.flatMap((r) => (r.kind === 'group' ? [r.path] : []));
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('lists the cases, sorted within their groups', () => {
    expect(describeRows(groupCases(CASES, [], new Set()))).toEqual(['#5', '#4', '#3', '#2', '#1']);
    expect(
      describeRows(
        groupCases(CASES, ['client'], new Set(), { key: 'reference', direction: 'asc' }),
      ),
    ).toEqual(['FNB (3)', '#2', '#3', '#5', 'NED (1)', '#4', 'Unknown Client (1)', '#1']);
    expect(
      describeRows(groupCases(CASES, [], new Set(), { key: 'client', direction: 'desc' })),
    ).toEqual(['#4', '#5', '#3', '#2', '#1']);
  });
});
