import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { AppApi } from '@api/app.api';
import { type Role, RoleApi } from './role.api';
import { type AppUser, UserApi } from './user.api';
import { UserRoleApi } from './user-role.api';

const role = (id: number, overrides: Partial<Role> = {}): Role => ({
  RoleId: id,
  RoleType: 'Agent',
  RoleName: `Role ${id}`,
  RoleDescription: 'Desc',
  IsDeleted: false,
  ...overrides,
});

/** Request shapes the backend expects (it cannot be changed from here). */
describe('security APIs', () => {
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  describe('RoleApi', () => {
    it('lists roles without the deleted ones', async () => {
      const result = firstValueFrom(TestBed.inject(RoleApi).list());
      backend
        .expectOne({ method: 'GET', url: 'Permission/GetRoles' })
        .flush([role(1), role(2, { IsDeleted: true })]);
      expect((await result).map((r) => r.RoleId)).toEqual([1]);
    });

    it("saves only the role's own fields", async () => {
      const withExtras = { ...role(3), RolesPermissions: [], UserRoles: [] } as Role;
      const result = firstValueFrom(TestBed.inject(RoleApi).update(withExtras));
      const request = backend.expectOne({ method: 'POST', url: 'Permission/Roles' });
      expect(request.request.body).toEqual(role(3));
      request.flush(role(3));
      await result;
    });

    it('creates with id 0 and deletes by flag, clearing the type (v21)', async () => {
      const api = TestBed.inject(RoleApi);
      const created = firstValueFrom(api.create(role(8)));
      backend.expectOne('Permission/Roles').flush(role(9));
      await created;
      const deleted = firstValueFrom(api.softDelete(role(9)));
      const request = backend.expectOne('Permission/Roles');
      expect(request.request.body).toEqual(role(9, { RoleType: null, IsDeleted: true }));
      request.flush(null);
      await deleted;
    });

    it("loads one role's permissions", async () => {
      const result = firstValueFrom(TestBed.inject(RoleApi).withPermissions(4));
      backend
        .expectOne({ method: 'GET', url: 'Permission/RolesPermissions?RoleId=4' })
        .flush([{ ...role(4), RolesPermissions: [] }]);
      expect((await result)?.RoleId).toBe(4);
    });
  });

  describe('UserRoleApi', () => {
    it("splits a user's roles, leaving out deleted ones", async () => {
      const result = firstValueFrom(TestBed.inject(UserRoleApi).rolesOf(5));
      backend.expectOne('Permission/GetRoles?UserId=5').flush({
        AssignedRoles: [
          { ...role(1), UserRoles: [{ UserRolesId: 7, RoleId: 1, AspNetUserId: 5 }] },
        ],
        AvailableRoles: [role(2), role(3, { IsDeleted: true })],
      });
      const { assigned, available } = await result;
      expect(assigned.map((r) => r.RoleId)).toEqual([1]);
      expect(available.map((r) => r.RoleId)).toEqual([2]);
    });

    it('adds and removes links with the Operation the backend expects', async () => {
      const api = TestBed.inject(UserRoleApi);
      const added = firstValueFrom(api.assign(5, [2]));
      const include = backend.expectOne('Permission/UserRoles?Operation=Include');
      expect(include.request.body).toEqual([{ UserRolesId: 0, RoleId: 2, AspNetUserId: 5 }]);
      include.flush(null);
      await added;

      const link = { UserRolesId: 7, RoleId: 1, AspNetUserId: 5 };
      const removed = firstValueFrom(api.remove([link]));
      const remove = backend.expectOne('Permission/UserRoles?Operation=Remove');
      expect(remove.request.body).toEqual([link]);
      remove.flush(null);
      await removed;
    });
  });

  describe('UserApi', () => {
    it('updates and deletes with PUT Users, without an id in the URL', async () => {
      const api = TestBed.inject(UserApi);
      const user = { AspNetUserId: 3, UserEmail: 'a@b.co', IsDeleted: false } as AppUser;
      const deleted = firstValueFrom(api.softDelete(user));
      const request = backend.expectOne({ method: 'PUT', url: 'Users' });
      expect(request.request.body).toEqual({ ...user, IsDeleted: true });
      request.flush(null);
      await deleted;
    });
  });

  describe('AppApi.menus', () => {
    it('flattens the menus by section', async () => {
      const result = firstValueFrom(TestBed.inject(AppApi).menus());
      backend.expectOne('App/GetMenus').flush({
        Configuration: [{ Menu: 'Branches', Code: 'BRANCHES' }],
        Security: [{ Menu: 'Roles', Code: 'ROLES' }],
      });
      expect(await result).toEqual([
        { section: 'Configuration', name: 'Branches', code: 'BRANCHES' },
        { section: 'Security', name: 'Roles', code: 'ROLES' },
      ]);
    });
  });
});
