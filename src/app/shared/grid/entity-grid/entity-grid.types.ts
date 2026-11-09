import type { Observable } from 'rxjs';
import type { CrudSource } from '@api/config/config-crud.api';
import type { AppIconName } from '@core/icons/app-icons';
import type { SelectOption } from '@shared/forms/select-field/select-option';

export type { SelectOption } from '@shared/forms/select-field/select-option';

interface ColumnLayout {
  readonly header: string;
  /** Relative width (AG Grid `flex`). Default 1. */
  readonly flex?: number;
  readonly minWidth?: number;
  /** Cell text alignment. Default: start (toggles are always centred). */
  readonly align?: 'start' | 'center';
}

interface ColumnBase<T> extends ColumnLayout {
  readonly field: keyof T & string;
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
  /** Text for a stored value that is not in the options. Default: the value itself. */
  readonly missingLabel?: (value: string | number) => string;
}

/** A column the user can change, bound to one field of the record. */
export type EditableColumn<T> = TextColumn<T> | NumberColumn<T> | ToggleColumn<T> | SelectColumn<T>;

/** Read-only text worked out from the record, e.g. the Province of the chosen branch. */
export interface DisplayColumn<T> extends ColumnLayout {
  readonly kind: 'display';
  /** Unique column id, e.g. `'Province'`. */
  readonly id: string;
  readonly value: (entity: T) => string;
}

export type EntityColumn<T> = EditableColumn<T> | DisplayColumn<T>;

export function isEditableColumn<T>(column: EntityColumn<T>): column is EditableColumn<T> {
  return column.kind !== 'display';
}

/** Everything EntityGrid needs to know about one kind of record. */
export interface EntityGridConfig<T> {
  /** Singular display name, e.g. "Body Location". */
  readonly entityName: string;
  /** Menu permission code, e.g. `BODY_LOC`: decides add / edit / delete. */
  readonly permission: string;
  readonly source: CrudSource<T>;
  readonly columns: readonly EntityColumn<T>[];
  /** Values for a new row added in the grid. Not needed when an `editor` form creates records. */
  readonly newEntity?: () => T;
  /** How a record is named in messages, e.g. its code. */
  readonly describe: (entity: T) => string;
  /**
   * Data the columns need (e.g. the branch list), loaded together with the rows,
   * so lookups are ready before rows are shown. A failure fails the whole load.
   */
  readonly loadLookups?: () => Observable<unknown>;
  /**
   * Screen-specific check run after the column checks; returns the problem or null.
   * `others` are the other records as last saved, e.g. for a "must be unique" rule.
   */
  readonly validate?: (entity: T, others: readonly T[]) => string | null;
  /** Last change before sending, e.g. formatting a phone number (v21 Transport Operators). */
  readonly beforeSave?: (entity: T) => T;
  /**
   * Screens edited in a form instead of in the grid (v21 popups): opens the form for a record,
   * or for a new one when `null`, and resolves with the saved record, or null when closed
   * without saving. The form does the saving. Grid cells are then read-only.
   */
  readonly editor?: RecordEditor<T>;
  /**
   * An extra button on each saved row that leads elsewhere, e.g. a role's permissions
   * (v21 Roles: the eye). Shown with the eye icon; `label` is its accessible name.
   */
  readonly rowLink?: RowLink<T>;
  /**
   * More buttons beside "+ New" for users who may create, e.g. v21 Clients'
   * "Clone (Copy) a Client".
   */
  readonly titleActions?: readonly TitleAction[];
  /**
   * v21's right-click menu on the grid, for screens edited in the grid (ignored with `editor`,
   * whose screens keep "+ New"). With `addRow`, Add Row replaces the "+ New" button; Save Row and
   * Delete Row act on the row right-clicked. Each still needs its permission. Copy puts the
   * clicked cell's text on the clipboard; Export downloads the rows shown as a CSV file.
   * Off by default.
   */
  readonly contextMenu?: readonly ContextMenuAction[];
}

/** Items of the grid's right-click menu. */
export type ContextMenuAction = 'addRow' | 'saveRow' | 'deleteRow' | 'copy' | 'export';

export interface TitleAction {
  readonly label: string;
  readonly icon: AppIconName;
  /** Resolves true when it changed the records, so the list is loaded again. */
  readonly run: () => Promise<boolean>;
}

export interface RowLink<T> {
  readonly label: string;
  readonly open: (entity: T) => void;
}

export type RecordEditor<T> = (record: T | null) => Promise<T | null>;
