import type { SelectOption } from '@shared/grid/entity-grid/entity-grid.types';

/** The parts of a lookup record (branch, client group, question type) that decide how it is offered. */
export interface LookupStatus {
  readonly IsActive: boolean;
  readonly IsDeleted: boolean | null;
}

/** v21 wording: "Gauteng (Inactive)", "Durban (Deleted)". */
export function statusLabel(name: string | null | undefined, status: LookupStatus): string {
  const text = (name ?? '').trim();
  const suffix = status.IsDeleted === true ? '(Deleted)' : status.IsActive ? '' : '(Inactive)';
  return [text, suffix].filter(Boolean).join(' ');
}

/** Only active records can be picked; inactive and deleted ones are still named on old records. */
export function isSelectable(status: LookupStatus): boolean {
  return status.IsActive && status.IsDeleted !== true;
}

/**
 * Choices for a picker: every active record, plus the current value when it is
 * inactive or deleted, so an old record still shows what it points at (v21 popups).
 */
export function pickerOptions<T extends LookupStatus>(
  records: readonly T[],
  current: number | null,
  id: (record: T) => number,
  name: (record: T) => string,
): SelectOption[] {
  return records
    .filter((record) => isSelectable(record) || id(record) === current)
    .map((record) => ({
      value: id(record),
      label: statusLabel(name(record), record),
      selectable: isSelectable(record),
    }));
}
