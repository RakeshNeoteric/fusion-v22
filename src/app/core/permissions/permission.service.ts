import { Injectable, signal } from '@angular/core';
import type { UserRole } from '@api/models/app.models';
import {
  type PermissionLevel,
  atLeast,
  buildPermissionLevels,
  normalizeCode,
} from './permission-level';

/**
 * The current user's permissions, keyed by permission code (menu codes such as `CLIENT`, and
 * field codes used by later phases). Unknown codes mean no access.
 */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly levels = signal<ReadonlyMap<string, PermissionLevel>>(new Map());

  load(roles: readonly UserRole[]): void {
    this.levels.set(buildPermissionLevels(roles));
  }

  clear(): void {
    this.levels.set(new Map());
  }

  /** Reactive: reading it inside a template or computed() updates when permissions change. */
  level(code: string): PermissionLevel {
    return this.levels().get(normalizeCode(code)) ?? 'none';
  }

  canView(code: string): boolean {
    return atLeast(this.level(code), 'read');
  }

  canEdit(code: string): boolean {
    return atLeast(this.level(code), 'edit');
  }

  canCreate(code: string): boolean {
    return atLeast(this.level(code), 'create');
  }

  /** v21 ignored the backend's CanDeleted flag: delete is allowed with full (create) access. */
  canDelete(code: string): boolean {
    return this.canCreate(code);
  }

  isReadOnly(code: string): boolean {
    return this.level(code) === 'read';
  }
}
