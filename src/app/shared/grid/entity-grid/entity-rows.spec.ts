import type { EntityColumn } from './entity-grid.types';
import {
  type GridRow,
  draftRow,
  editCell,
  isDirty,
  isMissingRequired,
  isNew,
  savedRow,
  toPayload,
  validateRow,
} from './entity-rows';

interface Vehicle {
  readonly VehicleId: number;
  readonly RegNumber: string;
  readonly Seats: number | null;
  readonly BranchId: number | null;
  readonly IsActive: boolean;
}

const REG: EntityColumn<Vehicle> = {
  kind: 'text',
  field: 'RegNumber',
  header: 'Reg Number',
  required: true,
  maxLength: 8,
  pattern: { regex: /^[A-Z0-9 ]+$/, message: 'Reg Number: capitals and numbers only.' },
};
const SEATS: EntityColumn<Vehicle> = {
  kind: 'number',
  field: 'Seats',
  header: 'Seats',
  min: 1,
  max: 9,
};
const BRANCH: EntityColumn<Vehicle> = {
  kind: 'select',
  field: 'BranchId',
  header: 'Branch',
  required: true,
  options: () => [
    { value: 1, label: 'Durban' },
    { value: 2, label: 'Cape Town' },
  ],
};
const ACTIVE: EntityColumn<Vehicle> = { kind: 'toggle', field: 'IsActive', header: 'Active' };
const COLUMNS = [REG, SEATS, BRANCH, ACTIVE];

const vehicle: Vehicle = {
  VehicleId: 5,
  RegNumber: 'ND 123',
  Seats: 4,
  BranchId: 1,
  IsActive: true,
};

function edit(
  row: GridRow<Vehicle>,
  column: EntityColumn<Vehicle>,
  value: unknown,
): GridRow<Vehicle> {
  const result = editCell(row, column, value);
  if ('error' in result) throw new Error(result.error);
  return result.row;
}

function editError(column: EntityColumn<Vehicle>, value: unknown): string {
  const result = editCell(savedRow(vehicle, 5), column, value);
  return 'error' in result ? result.error : 'accepted';
}

describe('grid rows', () => {
  it('keys saved rows by id and new rows uniquely', () => {
    expect(savedRow(vehicle, 5).key).toBe('id:5');
    const first = draftRow(vehicle);
    const second = draftRow(vehicle);
    expect(first.key).toMatch(/^new:/);
    expect(first.key).not.toBe(second.key);
    expect(isNew(first)).toBe(true);
    expect(isNew(savedRow(vehicle, 5))).toBe(false);
  });

  describe('isDirty', () => {
    it('is false for an untouched saved row and true for a new row', () => {
      expect(isDirty(savedRow(vehicle, 5), COLUMNS)).toBe(false);
      expect(isDirty(draftRow(vehicle), COLUMNS)).toBe(true);
    });

    it('is true after a change and false again after changing it back', () => {
      const changed = edit(savedRow(vehicle, 5), ACTIVE, false);
      expect(isDirty(changed, COLUMNS)).toBe(true);
      expect(isDirty(edit(changed, ACTIVE, true), COLUMNS)).toBe(false);
    });

    it('ignores surrounding spaces', () => {
      const original = { ...vehicle, RegNumber: 'ND 123 ' };
      expect(isDirty(edit(savedRow(original, 5), REG, ' ND 123'), COLUMNS)).toBe(false);
    });
  });

  describe('editCell', () => {
    it('trims text and never changes the original row', () => {
      const row = savedRow(vehicle, 5);
      const changed = edit(row, REG, '  CA 999  ');
      expect(changed.entity.RegNumber).toBe('CA 999');
      expect(row.entity.RegNumber).toBe('ND 123');
      expect(changed.original).toBe(row.original);
    });

    it.each<[string, EntityColumn<Vehicle>, unknown, string]>([
      ['an empty required text', REG, '   ', 'Reg Number is required.'],
      ['text that breaks the pattern', REG, 'nd 1', 'Reg Number: capitals and numbers only.'],
      ['text that is too long', REG, 'ABCDEFGHI', 'Reg Number must be at most 8 characters.'],
      ['a non-number', SEATS, 'abc', 'Seats must be a number.'],
      ['a number below the minimum', SEATS, 0, 'Seats must be at least 1.'],
      ['a number above the maximum', SEATS, '10', 'Seats must be at most 9.'],
      ['an unknown option', BRANCH, 99, 'Choose a valid Branch.'],
    ])('refuses %s', (_case, column, value, message) => {
      expect(editError(column, value)).toBe(message);
    });

    it('accepts numbers typed as text and clears an optional number', () => {
      expect(edit(savedRow(vehicle, 5), SEATS, '7').entity.Seats).toBe(7);
      expect(edit(savedRow(vehicle, 5), SEATS, '').entity.Seats).toBeNull();
    });

    it('stores the option value for a select', () => {
      expect(edit(savedRow(vehicle, 5), BRANCH, 2).entity.BranchId).toBe(2);
    });
  });

  describe('validateRow', () => {
    it('passes a complete row', () => {
      expect(validateRow(savedRow(vehicle, 5), COLUMNS)).toBeNull();
    });

    it('reports the first missing required value, including untouched cells of a new row', () => {
      const blank = draftRow<Vehicle>({ ...vehicle, RegNumber: '', BranchId: null });
      expect(validateRow(blank, COLUMNS)).toBe('Reg Number is required.');
      expect(isMissingRequired(blank, REG)).toBe(true);
      expect(isMissingRequired(blank, SEATS)).toBe(false);
    });

    it('checks the text rules of values that came from the server', () => {
      const legacy = savedRow({ ...vehicle, RegNumber: 'old-val' }, 5);
      expect(validateRow(legacy, COLUMNS)).toBe('Reg Number: capitals and numbers only.');
    });
  });

  it('trims text fields in the payload and keeps the other fields', () => {
    expect(toPayload({ ...vehicle, RegNumber: ' ND 1 ' }, COLUMNS)).toEqual({
      ...vehicle,
      RegNumber: 'ND 1',
    });
  });
});
