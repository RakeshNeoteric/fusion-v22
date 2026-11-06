import type { CaseStatus } from '@api/cases/case.api';

/** A case as a row of the case list. */
export interface CaseRow {
  readonly kind: 'case';
  readonly id: number;
  readonly status: CaseStatus;
  readonly reference: string;
  readonly number: string;
  /** ISO, so the column sorts by date. */
  readonly openDate: string;
  readonly caller: string;
  readonly deceased: string;
  readonly client: string;
  readonly service: string;
  readonly funeralDate: string;
}

/** A group heading in the case list: "FNB (202)". */
export interface CaseGroupRow {
  readonly kind: 'group';
  /** Unique: the values of this group and the groups above it. */
  readonly path: string;
  readonly label: string;
  readonly count: number;
  /** 0 for the outer group. */
  readonly level: number;
  readonly expanded: boolean;
}

export type CaseListRow = CaseRow | CaseGroupRow;

/** What the case list can be grouped by (v21: Client Name › Service Name › Case Status Group). */
export const CASE_GROUPINGS = [
  { key: 'client', label: 'Client Name', blank: 'Unknown Client' },
  { key: 'service', label: 'Service Name', blank: 'Unknown Service' },
  { key: 'status', label: 'Case Status Group', blank: 'New' },
] as const;

export type CaseGroupKey = (typeof CASE_GROUPINGS)[number]['key'];

export const DEFAULT_GROUPING: readonly CaseGroupKey[] = ['client', 'service', 'status'];

/** Columns the cases can be sorted by, within their group. */
export type CaseSortKey = Exclude<keyof CaseRow, 'kind' | 'id'>;
export interface CaseSort {
  readonly key: CaseSortKey;
  readonly direction: 'asc' | 'desc';
}

const SEPARATOR = '\u001f';

/**
 * Turns the cases into the rows the list shows: a heading per group, in the order the groups
 * first appear (newest case first), and the cases of expanded groups. As in v21, the outer
 * groups start expanded and the inner ones collapsed; `toggled` holds the groups the user
 * has opened or closed since.
 */
export function groupCases(
  cases: readonly CaseRow[],
  groupBy: readonly CaseGroupKey[],
  toggled: ReadonlySet<string>,
  sort: CaseSort | null = null,
): CaseListRow[] {
  const rows: CaseListRow[] = [];
  addLevel(cases, groupBy, 0, '', toggled, sort, rows);
  return rows;
}

function addLevel(
  cases: readonly CaseRow[],
  groupBy: readonly CaseGroupKey[],
  level: number,
  parentPath: string,
  toggled: ReadonlySet<string>,
  sort: CaseSort | null,
  rows: CaseListRow[],
): void {
  const key = groupBy[level];
  if (!key) {
    // Sorting orders the cases within their group; the groups keep their order (v21).
    rows.push(...(sort ? sortCases(cases, sort) : cases));
    return;
  }
  const blank = CASE_GROUPINGS.find((grouping) => grouping.key === key)?.blank ?? '';
  const groups = new Map<string, CaseRow[]>();
  for (const row of cases) {
    const label = row[key] || blank;
    const members = groups.get(label);
    if (members) members.push(row);
    else groups.set(label, [row]);
  }
  for (const [label, members] of groups) {
    const path = parentPath + SEPARATOR + label;
    const expanded = (level === 0) !== toggled.has(path);
    rows.push({ kind: 'group', path, label, count: members.length, level, expanded });
    if (expanded) addLevel(members, groupBy, level + 1, path, toggled, sort, rows);
  }
}

function sortCases(cases: readonly CaseRow[], { key, direction }: CaseSort): CaseRow[] {
  const sign = direction === 'asc' ? 1 : -1;
  // Empty values go last either way, as AG Grid does.
  return [...cases].sort((a, b) => {
    const left = a[key];
    const right = b[key];
    if (!left || !right) return left ? -1 : right ? 1 : 0;
    return sign * left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
  });
}
