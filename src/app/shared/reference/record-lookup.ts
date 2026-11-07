import { computed, signal } from '@angular/core';
import { type Observable, tap } from 'rxjs';
import type { SelectOption } from '@shared/grid/entity-grid/entity-grid.types';
import { isSelectable, type LookupStatus, pickerOptions, statusLabel } from './lookup-label';

/**
 * A list a screen picks from (branches, client groups, question types), loaded with the
 * screen's rows and shared with its form. Subclass it as a page-provided `@Injectable()`.
 * v21 rules: only active records can be picked; old records still name an inactive or
 * deleted choice as "Name (Inactive)" / "Name (Deleted)".
 */
/** `K` is the key other records store: usually a numeric id, sometimes a code (service types). */
export abstract class RecordLookup<T extends LookupStatus, K extends string | number = number> {
  private readonly records = signal<readonly T[]>([]);
  private readonly byId = computed(
    () => new Map(this.records().map((record) => [this.idOf(record), record])),
  );

  /** Every record, for showing names in the grid; only active ones are selectable. */
  readonly options = computed<readonly SelectOption[]>(() =>
    this.records().map((record) => ({
      value: this.idOf(record),
      label: statusLabel(this.nameOf(record), record),
      selectable: isSelectable(record),
    })),
  );

  /** All records, including deleted ones, so old references can still be named. */
  protected abstract fetch(): Observable<T[]>;
  abstract idOf(record: T): K;
  abstract nameOf(record: T): string;

  load(): Observable<T[]> {
    return this.fetch().pipe(tap((records) => this.records.set(this.unique(records))));
  }

  /**
   * One record per key. A code can be reused once its old record is deleted (service types),
   * so the live record wins over an inactive one, and an inactive one over a deleted one.
   */
  private unique(records: readonly T[]): readonly T[] {
    const kept = new Map<K, T>();
    for (const record of records) {
      const id = this.idOf(record);
      const other = kept.get(id);
      if (!other || standing(record) > standing(other)) kept.set(id, record);
    }
    return [...kept.values()];
  }

  find(id: K | null): T | undefined {
    return id === null ? undefined : this.byId().get(id);
  }

  /** The name to show for an id, with its status; '' when unknown. */
  label(id: K | null): string {
    const record = this.find(id);
    return record ? statusLabel(this.nameOf(record), record) : '';
  }

  /** Choices for a form: the active records, plus the current one if it is no longer active. */
  choices(current: K | null): SelectOption[] {
    return pickerOptions(
      this.records(),
      current,
      (record) => this.idOf(record),
      (record) => this.nameOf(record),
    );
  }
}

/** Active beats inactive beats deleted. */
function standing(status: LookupStatus): number {
  return status.IsDeleted === true ? 0 : status.IsActive ? 2 : 1;
}
