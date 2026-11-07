import type { ICombinedSimpleModel, TextFilterModel } from 'ag-grid-community';
import type { CaseRow, CaseSortKey } from './case-grouping';

/** One column's filter as the grid's text filter reports it: one condition, or two joined. */
export type CaseColumnFilter = TextFilterModel | ICombinedSimpleModel<TextFilterModel>;

/** The grid's filter model: column id → its filter. */
export type CaseFilters = Partial<Record<CaseSortKey, CaseColumnFilter>>;

/**
 * The text filter options the case list offers (v21's text filter, without Blank / Not blank:
 * the grid tests those itself, which would hide the group headings).
 */
export const CASE_FILTER_OPTIONS = [
  'contains',
  'notContains',
  'equals',
  'notEqual',
  'startsWith',
  'endsWith',
] as const;

/**
 * The cases that pass every column's filter, compared as shown (`text`), ignoring case.
 * The page filters the cases before grouping them, so the group counts follow the filters and
 * groups left empty disappear.
 */
export function filterCases(
  cases: readonly CaseRow[],
  filters: CaseFilters,
  text: (row: CaseRow, key: CaseSortKey) => string,
): readonly CaseRow[] {
  const active = Object.entries(filters).filter(
    (entry): entry is [CaseSortKey, CaseColumnFilter] => !!entry[1],
  );
  if (!active.length) return cases;
  return cases.filter((row) =>
    active.every(([key, filter]) => passes(text(row, key).toLowerCase(), filter)),
  );
}

function passes(value: string, filter: CaseColumnFilter): boolean {
  if ('conditions' in filter) {
    const results = filter.conditions.map((condition) => matches(value, condition));
    return filter.operator === 'OR' ? results.some(Boolean) : results.every(Boolean);
  }
  return matches(value, filter);
}

function matches(value: string, condition: TextFilterModel): boolean {
  const wanted = (condition.filter ?? '').trim().toLowerCase();
  if (!wanted) return true;
  switch (condition.type) {
    case 'notContains':
      return !value.includes(wanted);
    case 'equals':
      return value === wanted;
    case 'notEqual':
      return value !== wanted;
    case 'startsWith':
      return value.startsWith(wanted);
    case 'endsWith':
      return value.endsWith(wanted);
    default:
      return value.includes(wanted);
  }
}
