import {
  ChangeDetectionStrategy,
  Component,
  type OnInit,
  computed,
  inject,
  input,
  numberAttribute,
  signal,
} from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { Router } from '@angular/router';
import { firstValueFrom, forkJoin } from 'rxjs';
import { AppApi } from '@api/app.api';
import { RoleApi } from '@api/security/role.api';
import { NotificationService } from '@core/notifications/notification.service';
import { PermissionService } from '@core/permissions/permission.service';
import type { HasUnsavedChanges } from '@shared/navigation/unsaved-changes.guard';
import {
  type AccessLevel,
  type MenuDraft,
  type Section,
  addField,
  cleanFieldCode,
  findProblem,
  groupSections,
  isMenuChanged,
  menuDraft,
  removeNewField,
  setFieldCode,
  setFieldLevel,
  setFieldName,
  setFieldVisible,
  setMenuLevel,
  setMenuVisible,
  toRows,
} from './permission-matrix';

type Status = 'loading' | 'ready' | 'failed' | 'missing';

/**
 * v21 Permissions for one role (opened from Roles): sections, their menus, and for the chosen
 * menu whether the role sees it, what it may do, and its field-level permissions.
 * Changes to any number of menus are kept until Save, which stores them all; leaving with
 * unsaved changes asks first. (v21 saved silently whenever another menu was picked.)
 */
@Component({
  selector: 'app-permissions-page',
  imports: [MatButtonToggleModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './permissions-page.html',
  styleUrl: './permissions-page.css',
  host: { '(window:beforeunload)': 'warnBeforeUnload($event)' },
})
export class PermissionsPage implements OnInit, HasUnsavedChanges {
  /** From the route, `permissions/:roleId`. */
  readonly roleId = input.required({ transform: numberAttribute });

  private readonly appApi = inject(AppApi);
  private readonly roles = inject(RoleApi);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);

  /** Saving permissions is part of maintaining roles. */
  protected readonly canEdit = inject(PermissionService).canEdit('ROLES');

  protected readonly status = signal<Status>('loading');
  protected readonly saving = signal(false);
  protected readonly roleName = signal('');
  protected readonly sections = signal<readonly Section[]>([]);
  private readonly saved = signal<ReadonlyMap<string, MenuDraft>>(new Map());
  protected readonly drafts = signal<ReadonlyMap<string, MenuDraft>>(new Map());
  protected readonly selectedCode = signal<string | null>(null);
  /** Why characters typed into a field code were dropped, by field. */
  protected readonly codeMessages = signal<ReadonlyMap<string, string>>(new Map());

  protected readonly selected = computed(() => {
    const code = this.selectedCode();
    return code === null ? null : (this.drafts().get(code) ?? null);
  });

  protected readonly selectedSection = computed(() => {
    const code = this.selectedCode();
    return this.sections().find((section) => section.menus.some((menu) => menu.code === code));
  });

  protected readonly changed = computed(() => {
    const saved = this.saved();
    return [...this.drafts().values()].filter((menu) => {
      const before = saved.get(menu.code);
      return !before || isMenuChanged(this.roleId(), menu, before);
    });
  });

  protected readonly changedCodes = computed(
    () => new Set(this.changed().map((menu) => menu.code)),
  );

  ngOnInit(): void {
    void this.load();
  }

  hasUnsavedChanges(): boolean {
    return this.changed().length > 0;
  }

  protected async load(): Promise<void> {
    this.status.set('loading');
    try {
      const [menus, role] = await firstValueFrom(
        forkJoin([this.appApi.menus(), this.roles.withPermissions(this.roleId())]),
      );
      if (!role) {
        this.status.set('missing');
        return;
      }
      const sections = groupSections(menus);
      const drafts = new Map(
        menus.map((menu) => [menu.code, menuDraft(menu, role.RolesPermissions ?? [])]),
      );
      this.roleName.set(role.RoleName);
      this.sections.set(sections);
      this.saved.set(drafts);
      this.drafts.set(drafts);
      this.codeMessages.set(new Map());
      // Keep the menu that was open (after a save); otherwise the first one.
      const keep = this.selectedCode();
      if (keep === null || !drafts.has(keep)) {
        this.selectedCode.set(sections[0]?.menus[0]?.code ?? null);
      }
      this.status.set('ready');
    } catch {
      // The error interceptor has already told the user why.
      this.status.set('failed');
    }
  }

  protected selectSection(section: Section): void {
    this.selectedCode.set(section.menus[0]?.code ?? null);
  }

  protected selectMenu(code: string): void {
    this.selectedCode.set(code);
  }

  protected setMenuVisible(visible: boolean): void {
    this.change((menu) => setMenuVisible(menu, visible));
  }

  protected setMenuLevel(level: AccessLevel): void {
    this.change((menu) => setMenuLevel(menu, level));
  }

  protected setFieldVisible(key: string, visible: boolean): void {
    this.change((menu) => setFieldVisible(menu, key, visible));
  }

  protected setFieldLevel(key: string, level: AccessLevel): void {
    this.change((menu) => setFieldLevel(menu, key, level));
  }

  protected setFieldName(key: string, event: Event): void {
    const name = (event.target as HTMLInputElement).value;
    this.change((menu) => setFieldName(menu, key, name));
  }

  protected setFieldCode(key: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const { code, rejected } = cleanFieldCode(input.value);
    // Show the cleaned code at once, even when the stored value did not change.
    input.value = code;
    this.codeMessages.update((messages) => {
      const next = new Map(messages);
      if (rejected) {
        next.set(key, 'Use only letters, underscores (_) and slashes (/).');
      } else {
        next.delete(key);
      }
      return next;
    });
    this.change((menu) => setFieldCode(menu, key, code));
  }

  protected addField(): void {
    this.change(addField);
  }

  protected removeField(key: string): void {
    this.change((menu) => removeNewField(menu, key));
  }

  protected async save(): Promise<void> {
    if (!this.canEdit || this.saving()) return;
    const changed = this.changed();
    if (changed.length === 0) {
      this.notifications.info('No changes to save.');
      return;
    }
    const problem = findProblem([...this.drafts().values()], changed, this.saved());
    if (problem) {
      this.notifications.warning(problem);
      return;
    }
    this.saving.set(true);
    try {
      const rows = changed.flatMap((menu) => toRows(this.roleId(), menu));
      await firstValueFrom(this.roles.savePermissions(rows));
      this.notifications.success('Permissions saved.');
      await this.load();
    } catch {
      // Kept as typed, so nothing is lost; the interceptor has shown why.
    } finally {
      this.saving.set(false);
    }
  }

  protected back(): void {
    void this.router.navigate(['/roles']);
  }

  protected warnBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) event.preventDefault();
  }

  /** Changes the open menu, if the user may. */
  private change(update: (menu: MenuDraft) => MenuDraft): void {
    const menu = this.selected();
    if (!menu || !this.canEdit || this.saving()) return;
    this.drafts.update((drafts) => new Map(drafts).set(menu.code, update(menu)));
  }
}
