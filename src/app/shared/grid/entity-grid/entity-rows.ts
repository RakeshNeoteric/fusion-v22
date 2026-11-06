import type { EditableColumn } from './entity-grid.types';

/**
 * One grid row: the record as edited plus what was last saved (null for a new row).
 * Immutable: every change creates a new row object, which is how the grid knows to redraw it.
 */
export interface GridRow<T extends object> {
  /** Stable grid id: `id:12` for saved rows, `new:3` for rows not saved yet. */
  readonly key: string;
  readonly entity: T;
  readonly original: T | null;
  readonly saving: boolean;
}

export type EditResult<T extends object> =
  { readonly row: GridRow<T> } | { readonly error: string };

let draftSequence = 0;

export function savedRow<T extends object>(entity: T, id: number): GridRow<T> {
  return { key: `id:${id}`, entity, original: entity, saving: false };
}

export function draftRow<T extends object>(entity: T): GridRow<T> {
  draftSequence += 1;
  return { key: `new:${draftSequence}`, entity, original: null, saving: false };
}

export function isNew<T extends object>(row: GridRow<T>): boolean {
  return row.original === null;
}

/** New rows are always unsaved; saved rows when any column value differs (ignoring surrounding spaces). */
export function isDirty<T extends object>(
  row: GridRow<T>,
  columns: readonly EditableColumn<T>[],
): boolean {
  const { original } = row;
  if (original === null) return true;
  return columns.some((column) => !sameValue(row.entity[column.field], original[column.field]));
}

/**
 * Applies one cell edit, or explains why it is refused (the cell then keeps its old value, as in v21).
 */
export function editCell<T extends object>(
  row: GridRow<T>,
  column: EditableColumn<T>,
  input: unknown,
): EditResult<T> {
  const parsed = parseInput(column, input);
  if ('error' in parsed) return parsed;
  return { row: { ...row, entity: { ...row.entity, [column.field]: parsed.value } } };
}

/** The first problem that blocks saving, or null. Checks every column, including untouched ones. */
export function validateRow<T extends object>(
  row: GridRow<T>,
  columns: readonly EditableColumn<T>[],
): string | null {
  for (const column of columns) {
    const value: unknown = row.entity[column.field];
    if (column.kind === 'toggle') continue;
    if ('required' in column && column.required && isEmpty(value)) {
      return `${column.header} is required.`;
    }
    if (column.kind === 'text' && typeof value === 'string' && value.trim()) {
      const problem = textProblem(column, value.trim());
      if (problem) return problem;
    }
  }
  return null;
}

export function isMissingRequired<T extends object>(
  row: GridRow<T>,
  column: EditableColumn<T>,
): boolean {
  return 'required' in column && column.required === true && isEmpty(row.entity[column.field]);
}

/** The record as it should be sent: text trimmed. */
export function toPayload<T extends object>(entity: T, columns: readonly EditableColumn<T>[]): T {
  const result = { ...entity } as Record<string, unknown>;
  for (const column of columns) {
    const value = result[column.field];
    if (column.kind === 'text' && typeof value === 'string') {
      result[column.field] = value.trim();
    }
  }
  return result as T;
}

function parseInput<T>(
  column: EditableColumn<T>,
  input: unknown,
): { readonly value: unknown } | { readonly error: string } {
  switch (column.kind) {
    case 'text': {
      const text =
        typeof input === 'string'
          ? input.trim()
          : input === null || input === undefined
            ? ''
            : String(input);
      if (!text)
        return column.required ? { error: `${column.header} is required.` } : { value: '' };
      const problem = textProblem(column, text);
      return problem ? { error: problem } : { value: text };
    }
    case 'number': {
      if (input === null || input === undefined || input === '') {
        return column.required ? { error: `${column.header} is required.` } : { value: null };
      }
      const value = typeof input === 'number' ? input : Number(input);
      if (!Number.isFinite(value)) return { error: `${column.header} must be a number.` };
      if (column.min !== undefined && value < column.min) {
        return { error: `${column.header} must be at least ${column.min}.` };
      }
      if (column.max !== undefined && value > column.max) {
        return { error: `${column.header} must be at most ${column.max}.` };
      }
      return { value };
    }
    case 'toggle':
      return { value: input === true };
    case 'select': {
      const option = column
        .options()
        .find((candidate) => candidate.value === input && candidate.selectable !== false);
      if (option) return { value: option.value };
      return column.required || (input !== null && input !== undefined)
        ? { error: `Choose a valid ${column.header}.` }
        : { value: null };
    }
  }
}

function textProblem<T>(column: EditableColumn<T> & { kind: 'text' }, text: string): string | null {
  if (column.maxLength !== undefined && text.length > column.maxLength) {
    return `${column.header} must be at most ${column.maxLength} characters.`;
  }
  if (column.pattern && !column.pattern.regex.test(text)) {
    return column.pattern.message;
  }
  return null;
}

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && !value.trim());
}

function sameValue(a: unknown, b: unknown): boolean {
  const normalize = (value: unknown) =>
    typeof value === 'string' ? value.trim() : value === undefined ? null : value;
  return normalize(a) === normalize(b);
}
