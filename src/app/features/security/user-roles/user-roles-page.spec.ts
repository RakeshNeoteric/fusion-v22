import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import type { Role } from '@api/security/role.api';
import { type AppUser, UserApi } from '@api/security/user.api';
import { type AssignedRole, UserRoleApi } from '@api/security/user-role.api';
import { NotificationService } from '@core/notifications/notification.service';
import { PermissionService } from '@core/permissions/permission.service';
import { permission, role as userRole } from '../../../../testing/app-init.fixtures';
import { UserRolesPage } from './user-roles-page';

const user = (id: number, first: string, overrides: Partial<AppUser> = {}): AppUser => ({
  AspNetUserId: id,
  UserName: `${first}@example.com`,
  UserEmail: `${first}@example.com`,
  Firstname: first,
  Lastname: 'Smith',
  PhoneNumber: null,
  MobileNumber: null,
  EmployeeId: null,
  ProfileImage: null,
  EmailConfirmed: true,
  IsActive: true,
  IsDeleted: false,
  ...overrides,
});

const role = (id: number, name: string): Role => ({
  RoleId: id,
  RoleName: name,
  RoleType: null,
  RoleDescription: null,
  IsDeleted: false,
});

const assigned = (id: number, name: string, linkId: number): AssignedRole => ({
  ...role(id, name),
  UserRoles: [{ UserRolesId: linkId, RoleId: id, AspNetUserId: 1 }],
});

describe('UserRolesPage', () => {
  const userRoles = { rolesOf: vi.fn(), assign: vi.fn(), remove: vi.fn() };
  const notify = { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() };

  let fixture: ComponentFixture<UserRolesPage>;
  let host: HTMLElement;

  async function render(flags: Parameters<typeof permission>[1] = { CanEdit: true }) {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: UserApi,
          useValue: {
            list: () => of([user(1, 'Zoe'), user(2, 'Adam'), user(3, 'Idle', { IsActive: false })]),
          },
        },
        { provide: UserRoleApi, useValue: userRoles },
        { provide: NotificationService, useValue: notify },
      ],
    });
    TestBed.inject(PermissionService).load([userRole('Tester', [permission('USRROLEMAP', flags)])]);
    fixture = TestBed.createComponent(UserRolesPage);
    host = fixture.nativeElement as HTMLElement;
    await settle();
  }

  async function settle(): Promise<void> {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  function items(listTitle: string): HTMLButtonElement[] {
    const box = [...host.querySelectorAll('.ur-box')].find((candidate) =>
      candidate.querySelector('.ur-title')?.textContent?.startsWith(listTitle),
    );
    return [...(box?.querySelectorAll<HTMLButtonElement>('.ur-item') ?? [])];
  }

  function names(listTitle: string): string[] {
    return items(listTitle).map((item) => item.textContent?.trim() ?? '');
  }

  async function pick(listTitle: string, name: string): Promise<void> {
    items(listTitle)
      .find((item) => item.textContent?.trim() === name)
      ?.click();
    await settle();
  }

  async function move(label: string): Promise<void> {
    host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)?.click();
    await settle();
  }

  beforeEach(() => {
    for (const fn of [...Object.values(userRoles), ...Object.values(notify)]) fn.mockReset();
    userRoles.rolesOf.mockReturnValue(
      of({
        assigned: [assigned(10, 'Agent', 100)],
        available: [role(12, 'Manager'), role(11, 'Admin')],
      }),
    );
    userRoles.assign.mockReturnValue(of(null));
    userRoles.remove.mockReturnValue(of(null));
  });

  it('lists active users by name and finds them by search', async () => {
    await render();
    expect(names('User List')).toEqual(['Adam Smith', 'Zoe Smith']);
    const search = host.querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = 'zo';
    search.dispatchEvent(new Event('input'));
    await settle();
    expect(names('User List')).toEqual(['Zoe Smith']);
  });

  it("shows the chosen user's allocated and available roles", async () => {
    await render();
    expect(host.textContent).toContain('Select a user to see their roles.');
    await pick('User List', 'Zoe Smith');
    expect(userRoles.rolesOf).toHaveBeenCalledWith(1);
    expect(names('Allocated Roles')).toEqual(['Agent']);
    expect(names('Available Roles')).toEqual(['Admin', 'Manager']);
  });

  it('allocates the picked roles at once and reloads', async () => {
    await render();
    await pick('User List', 'Zoe Smith');
    await pick('Available Roles', 'Admin');
    await pick('Available Roles', 'Manager');
    await move('Allocate the selected roles');
    expect(userRoles.assign).toHaveBeenCalledWith(1, [11, 12]);
    expect(notify.success).toHaveBeenCalledWith('2 roles assigned.');
    expect(userRoles.rolesOf).toHaveBeenCalledTimes(2);
  });

  it('removes a role by its link, on double-click too', async () => {
    await render();
    await pick('User List', 'Zoe Smith');
    items('Allocated Roles')[0]?.dispatchEvent(new MouseEvent('dblclick'));
    await settle();
    expect(userRoles.remove).toHaveBeenCalledWith([
      { UserRolesId: 100, RoleId: 10, AspNetUserId: 1 },
    ]);
    expect(notify.success).toHaveBeenCalledWith('1 role removed.');
  });

  it('read-only users see the roles but cannot move them', async () => {
    await render({ CanRead: true });
    await pick('User List', 'Zoe Smith');
    expect(host.querySelector('.ur-moves')).toBeNull();
    expect(items('Available Roles').every((item) => item.disabled)).toBe(true);
  });
});
