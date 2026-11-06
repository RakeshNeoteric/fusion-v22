import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AppApi, type PermissionMenu } from '@api/app.api';
import type { RolePermission } from '@api/models/app.models';
import { RoleApi, type RolePermissionDraft } from '@api/security/role.api';
import { NotificationService } from '@core/notifications/notification.service';
import { PermissionService } from '@core/permissions/permission.service';
import { permission, role } from '../../../../testing/app-init.fixtures';
import { PermissionsPage } from './permissions-page';

const menus: PermissionMenu[] = [
  { section: 'Configuration', name: 'Branches', code: 'BRANCHES' },
  { section: 'Configuration', name: 'Documents', code: 'DOCUMENTS' },
  { section: 'Cases', name: 'Cases', code: 'CASES' },
];

const stored = (overrides: Partial<RolePermission>): RolePermission => ({
  RolesConfigurationId: 1,
  RoleId: 4,
  Code: 'BRANCHES',
  Type: 'Menu',
  LabelName: 'Branches',
  IsVisible: true,
  CanCreate: false,
  CanRead: false,
  CanEdit: true,
  CanDeleted: false,
  ...overrides,
});

describe('PermissionsPage', () => {
  const roles = { withPermissions: vi.fn(), savePermissions: vi.fn() };
  const notify = { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() };

  let fixture: ComponentFixture<PermissionsPage>;
  let host: HTMLElement;

  async function render(flags: Parameters<typeof permission>[1] = { CanEdit: true }) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
        { provide: AppApi, useValue: { menus: () => of(menus) } },
        { provide: RoleApi, useValue: roles },
        { provide: NotificationService, useValue: notify },
      ],
    });
    TestBed.inject(PermissionService).load([role('Tester', [permission('ROLES', flags)])]);
    fixture = TestBed.createComponent(PermissionsPage);
    fixture.componentRef.setInput('roleId', 4);
    host = fixture.nativeElement as HTMLElement;
    await settle();
  }

  async function settle(): Promise<void> {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  function buttons(selector: string): HTMLButtonElement[] {
    return [...host.querySelectorAll<HTMLButtonElement>(selector)];
  }

  async function click(selector: string, text: string): Promise<void> {
    const button = buttons(selector).find((candidate) =>
      candidate.textContent?.trim().startsWith(text),
    );
    if (!button) throw new Error(`no button "${text}"`);
    button.click();
    await settle();
  }

  /** A Material toggle inside the group labelled `label`, e.g. ("Visible", "No"). */
  async function toggle(label: string, choice: string): Promise<void> {
    const group = [...host.querySelectorAll('mat-button-toggle-group')].find(
      (candidate) =>
        candidate.getAttribute('aria-label') === label ||
        host.querySelector(`#${candidate.getAttribute('aria-labelledby')}`)?.textContent?.trim() ===
          label,
    );
    const button = [...(group?.querySelectorAll('button') ?? [])].find(
      (candidate) => candidate.textContent?.trim() === choice,
    );
    if (!button) throw new Error(`no toggle ${label} / ${choice}`);
    button.click();
    await settle();
  }

  function pressed(label: string): string | undefined {
    const group = [...host.querySelectorAll('mat-button-toggle-group')].find(
      (candidate) =>
        candidate.getAttribute('aria-label') === label ||
        host.querySelector(`#${candidate.getAttribute('aria-labelledby')}`)?.textContent?.trim() ===
          label,
    );
    return [
      ...(group?.querySelectorAll('button[aria-checked="true"]') ?? []),
    ][0]?.textContent?.trim();
  }

  function savedRows(): RolePermissionDraft[] {
    return roles.savePermissions.mock.calls.at(-1)?.[0] as RolePermissionDraft[];
  }

  beforeEach(() => {
    for (const fn of [...Object.values(roles), ...Object.values(notify)]) fn.mockReset();
    roles.withPermissions.mockReturnValue(
      of({
        RoleId: 4,
        RoleName: 'Case Controller',
        RoleType: null,
        RoleDescription: null,
        IsDeleted: false,
        RolesPermissions: [
          stored({}),
          stored({
            RolesConfigurationId: 2,
            Code: 'BR_PHONE',
            Type: 'BRANCHES',
            LabelName: 'Phone',
          }),
        ],
      }),
    );
    roles.savePermissions.mockReturnValue(of(null));
  });

  it("shows the role, sections in name order and the first menu's permissions", async () => {
    await render();
    expect(host.querySelector('.pm-title')?.textContent).toContain('Case Controller');
    expect(
      buttons('nav[aria-labelledby="pm-sections-title"] button').map((b) => b.textContent?.trim()),
    ).toEqual(['Cases', 'Configuration']);
    expect(pressed('Visible')).toContain('No');

    await click('nav[aria-labelledby="pm-sections-title"] button', 'Configuration');
    expect(pressed('Visible')).toContain('Yes');
    expect(pressed('Enable')).toBe('Edit');
    expect(host.querySelector<HTMLInputElement>('input[aria-label="Field 1 code"]')?.value).toBe(
      'BR_PHONE',
    );
  });

  it('keeps changes to several menus and saves them together', async () => {
    await render();
    // Cases: show it with full access.
    await toggle('Visible', 'Yes');
    await toggle('Enable', 'Create');
    // Branches: read only.
    await click('nav[aria-labelledby="pm-sections-title"] button', 'Configuration');
    await toggle('Enable', 'Read');
    expect(host.querySelector('.pm-unsaved')?.textContent).toContain('2 menus');
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(true);

    await click('.pm-actions button', 'Save');
    // In the backend's menu order.
    expect(savedRows()).toEqual([
      expect.objectContaining({
        RolesConfigurationId: 1,
        Code: 'BRANCHES',
        CanRead: true,
        CanEdit: false,
      }),
      expect.objectContaining({ RolesConfigurationId: 2, Code: 'BR_PHONE', CanRead: true }),
      expect.objectContaining({
        RolesConfigurationId: 0,
        Code: 'CASES',
        IsVisible: true,
        CanCreate: true,
      }),
    ]);
    expect(notify.success).toHaveBeenCalledWith('Permissions saved.');
    expect(roles.withPermissions).toHaveBeenCalledTimes(2);
  });

  it('adds a field, cleaning its code, and checks it before saving', async () => {
    await render();
    await click('nav[aria-labelledby="pm-sections-title"] button', 'Configuration');
    host.querySelector<HTMLButtonElement>('.pm-add')?.click();
    await settle();

    const code = host.querySelector<HTMLInputElement>('input[aria-label="Field 2 code"]')!;
    code.value = 'br phone';
    code.dispatchEvent(new Event('input'));
    await settle();
    expect(code.value).toBe('BRPHONE');
    expect(host.textContent).toContain('Use only letters, underscores (_) and slashes (/).');

    await click('.pm-actions button', 'Save');
    expect(notify.warning).toHaveBeenCalledWith('Branches: every field needs a name.');

    const name = host.querySelector<HTMLInputElement>('input[aria-label="Field 2 name"]')!;
    name.value = 'Phone 2';
    name.dispatchEvent(new Event('input'));
    await settle();
    await click('.pm-actions button', 'Save');
    expect(savedRows().at(-1)).toMatchObject({
      RolesConfigurationId: 0,
      Code: 'BRPHONE',
      Type: 'BRANCHES',
      LabelName: 'Phone 2',
      CanEdit: true,
    });
  });

  it('says when there is nothing to save', async () => {
    await render();
    await click('.pm-actions button', 'Save');
    expect(notify.info).toHaveBeenCalledWith('No changes to save.');
    expect(roles.savePermissions).not.toHaveBeenCalled();
  });

  it('read-only users see the permissions but cannot change them', async () => {
    await render({ CanRead: true });
    expect(buttons('.pm-actions button').map((b) => b.textContent?.trim())).toEqual(['Back']);
    expect(host.querySelector('.pm-add')).toBeNull();
    const visible = host.querySelector('mat-button-toggle-group button');
    expect((visible as HTMLButtonElement).disabled).toBe(true);
  });

  it('goes back to Roles', async () => {
    await render();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await click('.pm-actions button', 'Back');
    expect(navigate).toHaveBeenCalledWith(['/roles']);
  });

  it('explains when the role no longer exists', async () => {
    roles.withPermissions.mockReturnValue(of(null));
    await render();
    expect(host.textContent).toContain('This role does not exist.');
  });
});
