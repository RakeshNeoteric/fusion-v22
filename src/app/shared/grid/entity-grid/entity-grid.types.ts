import type { CrudSource } from '@api/config/config-crud.api';

export interface SelectOption {
  readonly value: string | number;
  readonly label: string;
}

interface ColumnBase<T> {
  readonly field: keyof T & string;
  readonly header: string;
  /** Relative width (AG Grid `flex`). Default 1. */
  readonly flex?: number;
  readonly minWidth?: number;
  /** Cell text alignment. Default: start (toggles are always centred). */
  readonly align?: 'start' | 'center';
}

export interface TextColumn<T> extends ColumnBase<T> {
  readonly kind: 'text';
  readonly required?: boolean;
  readonly maxLength?: number;
  readonly pattern?: { readonly regex: RegExp; readonly message: string };
}

export interface NumberColumn<T> extends ColumnBase<T> {
  readonly kind: 'number';
  readonly required?: boolean;
  readonly min?: number;
  readonly max?: number;
}

/** Yes/no switch, e.g. `IsActive`. Changing it marks the row unsaved, like any edit (v21). */
export interface ToggleColumn<T> extends ColumnBase<T> {
  readonly kind: 'toggle';
}

/** A value picked from a list, e.g. `BranchId` shown as the branch name. */
export interface SelectColumn<T> extends ColumnBase<T> {
  readonly kind: 'select';
  readonly required?: boolean;
  /** Read on every render, so it can be a signal that fills in later. */
  readonly options: () => readonly SelectOption[];
}

export type EntityColumn<T> = TextColumn<T> | NumberColumn<T> | ToggleColumn<T> | SelectColumn<T>;

/** Everything EntityGrid needs to know about one kind of record. */
export interface EntityGridConfig<T> {
  /** Singular display name, e.g. "Body Location". */
  readonly entityName: string;
  /** Menu permission code, e.g. `BODY_LOC`: decides add / edit / delete. */
  readonly permission: string;
  readonly source: CrudSource<T>;
  readonly columns: readonly EntityColumn<T>[];
  /** Values for a new row. */
  readonly newEntity: () => T;
  /** How a record is named in messages, e.g. its code. */
  readonly describe: (entity: T) => string;
}
