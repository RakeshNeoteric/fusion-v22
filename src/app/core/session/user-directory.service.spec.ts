import { TestBed } from '@angular/core/testing';
import { directoryUser } from '../../../testing/app-init.fixtures';
import { UserDirectoryService, displayNameOf } from './user-directory.service';

describe('displayNameOf (v21 rules)', () => {
  it.each([
    [{ Firstname: ' Jane ', Lastname: 'Doe' }, 'Jane Doe'],
    [{ Firstname: 'Jane' }, 'Jane'],
    [{ UserName: 'jdoe' }, 'jdoe'],
    [{ UserEmail: 'jane@example.com' }, 'jane@example.com'],
    [{ UserEmail: '' }, 'User #3'],
    [{ Firstname: 'Jane', IsActive: false }, 'Jane (Inactive)'],
    [{ Firstname: 'Jane', IsActive: false, IsDeleted: true }, 'Jane (Deleted)'],
  ])('%j → %s', (fields, expected) => {
    expect(displayNameOf(directoryUser({ AspNetUserId: 3, ...fields }))).toBe(expected);
  });
});

describe('UserDirectoryService', () => {
  let directory: UserDirectoryService;
  const active = directoryUser({ AspNetUserId: 1, Firstname: 'Ann' });
  const inactive = directoryUser({ AspNetUserId: 2, Firstname: 'Ben', IsActive: false });
  const deleted = directoryUser({ AspNetUserId: 3, Firstname: 'Cat', IsDeleted: true });

  beforeEach(() => {
    directory = TestBed.inject(UserDirectoryService);
    directory.load([
      { RoleId: 1, RoleName: 'Case Controller', Users: [active, inactive, deleted] },
      { RoleId: 2, RoleName: 'Claims Manager', Users: [active] },
    ]);
  });

  it('lists every user once', () => {
    expect(directory.users().map((user) => user.AspNetUserId)).toEqual([1, 2, 3]);
  });

  it('finds role users ignoring case and spaces', () => {
    expect(directory.usersInRole('casecontroller')).toHaveLength(3);
    expect(directory.usersInRole('CASE  CONTROLLER')).toHaveLength(3);
    expect(directory.usersInRole('Unknown')).toEqual([]);
  });

  it('offers only active users', () => {
    expect(directory.optionsForRole('Case Controller').map((option) => option.label)).toEqual([
      'Ann',
    ]);
  });

  it('keeps the saved user visible even when inactive or deleted', () => {
    expect(directory.optionsForRole('Case Controller', 3).map((option) => option.label)).toEqual([
      'Cat (Deleted)',
      'Ann',
    ]);
    expect(directory.optionsForRole('Case Controller', 1)).toHaveLength(1);
  });

  it('gives display names by id', () => {
    expect(directory.displayName(2)).toBe('Ben (Inactive)');
    expect(directory.displayName(99)).toBeNull();
  });
});
