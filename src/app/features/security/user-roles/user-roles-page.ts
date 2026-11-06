import {
  ChangeDetectionStrategy,
  Component,
  type OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { Role } from '@api/security/role.api';
import { type AppUser, UserApi } from '@api/security/user.api';
import { type AssignedRole, UserRoleApi } from '@api/security/user-role.api';
import { NotificationService } from '@core/notifications/notification.service';
import { PermissionService } from '@core/permissions/permission.service';

type Status = 'idle' | 'loading' | 'ready' | 'failed';

interface UserItem {
  readonly id: number;
  readonly name: string;
}

const byName = (a: { RoleName: string }, b: { RoleName: string }): number =>
  a.RoleName.localeCompare(b.RoleName);

const plural = (count: number): string => `${count} ${count === 1 ? 'role' : 'roles'}`;

/**
 * v21 User Role Mapping: pick an active user, then move roles between "Allocated" and
 * "Available" (select and use the arrows, or double-click). Each move is saved at once,
 * as in v21, and the user's roles are then reloaded from the server.
 */
@Component({
  selector: 'app-user-roles-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-roles-page.html',
  styleUrl: './user-roles-page.css',
})
export class UserRolesPage implements OnInit {
  private readonly usersApi = inject(UserApi);
  private readonly userRoles = inject(UserRoleApi);
  private readonly notifications = inject(NotificationService);

  protected readonly canEdit = inject(PermissionService).canEdit('USRROLEMAP');

  protected readonly usersStatus = signal<Exclude<Status, 'idle'>>('loading');
  private readonly users = signal<readonly UserItem[]>([]);
  protected readonly search = signal('');
  protected readonly filteredUsers = computed(() => {
    const term = this.search().trim().toLowerCase();
    const users = this.users();
    return term ? users.filter((user) => user.name.toLowerCase().includes(term)) : users;
  });

  protected readonly selectedUser = signal<UserItem | null>(null);
  protected readonly rolesStatus = signal<Status>('idle');
  protected readonly saving = signal(false);
  protected readonly assigned = signal<readonly AssignedRole[]>([]);
  protected readonly available = signal<readonly Role[]>([]);
  protected readonly pickedAssigned = signal<ReadonlySet<number>>(new Set());
  protected readonly pickedAvailable = signal<ReadonlySet<number>>(new Set());

  /** Moving roles needs edit permission, a user, their roles loaded, and no save running. */
  protected readonly canMove = computed(
    () => this.canEdit && this.rolesStatus() === 'ready' && !this.saving(),
  );

  ngOnInit(): void {
    void this.loadUsers();
  }

  protected async loadUsers(): Promise<void> {
    this.usersStatus.set('loading');
    try {
      const users = await firstValueFrom(this.usersApi.list());
      this.users.set(
        users
          .filter((user: AppUser) => user.IsActive)
          .map((user) => ({
            id: user.AspNetUserId,
            name: `${user.Firstname ?? ''} ${user.Lastname ?? ''}`.trim() || user.UserEmail,
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      this.usersStatus.set('ready');
    } catch {
      this.usersStatus.set('failed');
    }
  }

  protected setSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected selectUser(user: UserItem): void {
    if (this.selectedUser()?.id === user.id || this.saving()) return;
    this.selectedUser.set(user);
    void this.loadRoles();
  }

  protected async loadRoles(): Promise<void> {
    const user = this.selectedUser();
    if (!user) return;
    this.rolesStatus.set('loading');
    this.pickedAssigned.set(new Set());
    this.pickedAvailable.set(new Set());
    try {
      const { assigned, available } = await firstValueFrom(this.userRoles.rolesOf(user.id));
      // A slower answer for a user who is no longer selected is ignored.
      if (this.selectedUser()?.id !== user.id) return;
      this.assigned.set([...assigned].sort(byName));
      this.available.set([...available].sort(byName));
      this.rolesStatus.set('ready');
    } catch {
      if (this.selectedUser()?.id === user.id) this.rolesStatus.set('failed');
    }
  }

  protected toggleAssigned(roleId: number): void {
    this.pickedAvailable.set(new Set());
    this.pickedAssigned.update((picked) => toggled(picked, roleId));
  }

  protected toggleAvailable(roleId: number): void {
    this.pickedAssigned.set(new Set());
    this.pickedAvailable.update((picked) => toggled(picked, roleId));
  }

  /** `<`: give the user the picked available roles. */
  protected assignPicked(): void {
    void this.assign([...this.pickedAvailable()]);
  }

  /** `<<`: give the user every available role. */
  protected assignAll(): void {
    void this.assign(this.available().map((role) => role.RoleId));
  }

  /** `>`: take the picked roles away from the user. */
  protected removePicked(): void {
    void this.remove([...this.pickedAssigned()]);
  }

  /** `>>`: take every role away from the user. */
  protected removeAll(): void {
    void this.remove(this.assigned().map((role) => role.RoleId));
  }

  protected async assign(roleIds: readonly number[]): Promise<void> {
    const user = this.selectedUser();
    if (!user || !this.canMove() || roleIds.length === 0) return;
    await this.store(
      () => this.userRoles.assign(user.id, roleIds),
      `${plural(roleIds.length)} assigned.`,
    );
  }

  protected async remove(roleIds: readonly number[]): Promise<void> {
    if (!this.selectedUser() || !this.canMove() || roleIds.length === 0) return;
    const ids = new Set(roleIds);
    const links = this.assigned()
      .filter((role) => ids.has(role.RoleId))
      .flatMap((role) => role.UserRoles ?? []);
    if (links.length === 0) {
      this.notifications.error('Could not remove the roles. Reload the page and try again.');
      return;
    }
    await this.store(() => this.userRoles.remove(links), `${plural(roleIds.length)} removed.`);
  }

  private async store(
    request: () => ReturnType<UserRoleApi['remove']>,
    done: string,
  ): Promise<void> {
    this.saving.set(true);
    try {
      await firstValueFrom(request());
      this.notifications.success(done);
    } catch {
      // The interceptor has shown why; the reload below shows what is really stored.
    } finally {
      this.saving.set(false);
    }
    await this.loadRoles();
  }
}

function toggled(set: ReadonlySet<number>, id: number): ReadonlySet<number> {
  const next = new Set(set);
  if (!next.delete(id)) next.add(id);
  return next;
}
