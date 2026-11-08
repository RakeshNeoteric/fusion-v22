import { Injectable, computed, signal } from '@angular/core';
import type { DirectoryUser, RoleUsers } from '@api/models/app.models';
import type { SelectOption } from '@shared/forms/select-field/select-option';

/** A user to pick: the id is stored; inactive and deleted users can no longer be picked. */
export interface UserOption extends SelectOption<number> {
  readonly user: DirectoryUser;
}

/** v21 display rule: "First Last", else user name, else email, else "User #id"; status suffix. */
export function displayNameOf(user: DirectoryUser): string {
  const name =
    `${(user.Firstname ?? '').trim()} ${(user.Lastname ?? '').trim()}`.trim() ||
    user.UserName?.trim() ||
    user.UserEmail?.trim() ||
    `User #${user.AspNetUserId}`;
  if (user.IsDeleted) return `${name} (Deleted)`;
  if (user.IsActive === false) return `${name} (Inactive)`;
  return name;
}

export function isSelectable(user: DirectoryUser): boolean {
  return user.IsActive !== false && user.IsDeleted !== true;
}

/** Role names are matched ignoring case and spaces ("Case Controller" = "CaseController"), as in v21. */
function roleKey(roleName: string): string {
  return roleName.replace(/\s/g, '').toLowerCase();
}

/**
 * Users grouped by role, loaded once from AppInit. Used by user pickers
 * (case controllers, claims managers, ...).
 */
@Injectable({ providedIn: 'root' })
export class UserDirectoryService {
  private readonly roles = signal<readonly RoleUsers[]>([]);

  /** Every user once (a user can be in several roles). */
  readonly users = computed(() => {
    const byId = new Map<number, DirectoryUser>();
    for (const role of this.roles()) {
      for (const user of role.Users) {
        if (!byId.has(user.AspNetUserId)) byId.set(user.AspNetUserId, user);
      }
    }
    return [...byId.values()];
  });

  load(roles: readonly RoleUsers[]): void {
    this.roles.set(roles);
  }

  clear(): void {
    this.roles.set([]);
  }

  usersInRole(roleName: string): readonly DirectoryUser[] {
    const key = roleKey(roleName);
    return this.roles().find((role) => roleKey(role.RoleName) === key)?.Users ?? [];
  }

  /**
   * Dropdown options for a role: active users only, plus the currently saved user even if they
   * are now inactive or deleted (shown first, labelled with their status) so existing data stays visible.
   */
  optionsForRole(roleName: string, selectedUserId: number | null = null): UserOption[] {
    return optionsOf(this.usersInRole(roleName), selectedUserId);
  }

  /** Like {@link optionsForRole}, from every user (v21 Service Provider "… By" pickers). */
  options(selectedUserId: number | null = null): UserOption[] {
    return optionsOf(this.users(), selectedUserId);
  }

  displayName(userId: number): string | null {
    const user = this.users().find((candidate) => candidate.AspNetUserId === userId);
    return user ? displayNameOf(user) : null;
  }
}

function optionsOf(users: readonly DirectoryUser[], selectedUserId: number | null): UserOption[] {
  const options = users.filter(isSelectable).map(toOption);
  if (selectedUserId !== null && !options.some((option) => option.value === selectedUserId)) {
    const selected = users.find((user) => user.AspNetUserId === selectedUserId);
    if (selected) options.unshift(toOption(selected));
  }
  return options;
}

function toOption(user: DirectoryUser): UserOption {
  return {
    value: user.AspNetUserId,
    label: displayNameOf(user),
    selectable: isSelectable(user),
    user,
  };
}
