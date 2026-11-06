import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { type Branch, BranchApi } from '@api/config/branch.api';
import { BranchLookup, missingBranchLabel } from './branch-lookup';

const branch = (id: number, overrides: Partial<Branch> = {}): Branch => ({
  BranchId: id,
  Name: `Branch ${id}`,
  Province: 'Gauteng',
  Country: 'ZA',
  IsActive: true,
  IsDeleted: false,
  ...overrides,
});

describe('BranchLookup', () => {
  let lookup: BranchLookup;
  const listIncludingDeleted = vi.fn();

  beforeEach(async () => {
    listIncludingDeleted.mockReturnValue(
      of([
        branch(1),
        branch(2, { IsActive: false }),
        branch(3, { IsDeleted: true }),
        branch(4, { Country: 'BW', Province: 'Kgalagadi' }),
      ]),
    );
    TestBed.configureTestingModule({
      providers: [BranchLookup, { provide: BranchApi, useValue: { listIncludingDeleted } }],
    });
    lookup = TestBed.inject(BranchLookup);
    await firstValueFrom(lookup.load());
  });

  it('offers only active branches, but still names inactive and deleted ones', () => {
    expect(lookup.options()).toEqual([
      { value: 1, label: 'Branch 1', selectable: true },
      { value: 2, label: 'Branch 2 (Inactive)', selectable: false },
      { value: 3, label: 'Branch 3 (Deleted)', selectable: false },
      { value: 4, label: 'Branch 4', selectable: true },
    ]);
  });

  it("gives the branch's province and country name", () => {
    expect(lookup.province(4)).toBe('Kgalagadi');
    expect(lookup.country(4)).toBe('Botswana');
    expect(lookup.province(null)).toBe('');
    expect(lookup.country(99)).toBe('');
  });

  it('names a branch that no longer exists like v21', () => {
    expect(missingBranchLabel(99)).toBe('Branch 99 (Deleted)');
  });
});
