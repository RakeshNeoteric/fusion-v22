import { Component } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { type ClaimCentre, ClaimCentreApi } from '@api/config/claim-centre.api';
import { type ClientGroup, ClientGroupApi } from '@api/config/client-group.api';
import { provideAppIcons } from '@core/icons/app-icons';
import { Breadcrumb } from '@core/layout/breadcrumb/breadcrumb';
import { NotificationService } from '@core/notifications/notification.service';
import { PermissionService } from '@core/permissions/permission.service';
import { ConfirmService } from '@shared/ui/confirm-dialog/confirm-dialog';
import { permission, role } from '../../../../testing/app-init.fixtures';
import { ClaimCentresPage } from './claim-centres-page';
import { chooseOption, dropdownOptions, dropdownText } from '../../../../testing/form-controls';

/** The page as the shell shows it: the title bar (with "+ New") above the page. */
@Component({
  imports: [Breadcrumb, ClaimCentresPage],
  template: '<app-breadcrumb /><app-claim-centres-page />',
})
class PageInShell {}

const group = (id: number, overrides: Partial<ClientGroup> = {}): ClientGroup => ({
  ClientGroupId: id,
  Name: `Group ${id}`,
  IsActive: true,
  IsDeleted: false,
  ...overrides,
});

const centre = (id: number, overrides: Partial<ClaimCentre> = {}): ClaimCentre => ({
  ClaimCentreId: id,
  Name: `Centre ${id}`,
  ClientGroupId: 1,
  Province: 'Gauteng',
  Branch: 'Main',
  TownCity: 'Johannesburg',
  Address: '1 Main Road',
  Tel: '+27821234567',
  Fax: '',
  IsActive: true,
  IsDeleted: false,
  ...overrides,
});

/** Claim Centres end to end: read-only grid, popup form, permissions. */
describe('ClaimCentresPage', () => {
  const api = {
    idOf: (entity: ClaimCentre) => entity.ClaimCentreId,
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
  };
  const groups = { listIncludingDeleted: vi.fn() };
  const notify = { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() };

  let fixture: ComponentFixture<PageInShell>;
  let host: HTMLElement;

  async function render(flags: Parameters<typeof permission>[1] = { CanCreate: true }) {
    TestBed.configureTestingModule({
      providers: [
        provideAppIcons(),
        provideRouter([]),
        // The popup closes at once instead of waiting for an animation jsdom never runs.
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
        { provide: ClaimCentreApi, useValue: api },
        { provide: ClientGroupApi, useValue: groups },
        { provide: NotificationService, useValue: notify },
        { provide: ConfirmService, useValue: { ask: vi.fn() } },
      ],
    });
    TestBed.inject(PermissionService).load([role('Tester', [permission('CLM_CTR', flags)])]);
    fixture = TestBed.createComponent(PageInShell);
    host = fixture.nativeElement as HTMLElement;
    await settle();
  }

  async function settle(): Promise<void> {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  /** The open popup (rendered by MatDialog outside the page), or null. */
  function dialog(): HTMLElement | null {
    return document.querySelector('app-claim-centre-dialog');
  }

  function field<E extends HTMLElement>(id: string): E {
    const element = dialog()?.querySelector<E>(`#${id}`);
    if (!element) throw new Error(`no field #${id}`);
    return element;
  }

  async function fill(id: string, value: string): Promise<void> {
    const input = field<HTMLInputElement | HTMLTextAreaElement>(id);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  }

  async function choose(id: string, label: string): Promise<void> {
    await chooseOption(id, label);
    await settle();
  }

  function dialogButton(text: string): HTMLButtonElement | undefined {
    return [...(dialog()?.querySelectorAll('button') ?? [])].find(
      (button) => button.textContent?.trim() === text,
    );
  }

  async function click(button: HTMLButtonElement | undefined | null): Promise<void> {
    if (!button) throw new Error('button not found');
    button.click();
    await settle();
  }

  function viewButton(rowKey: string): Promise<HTMLButtonElement> {
    return vi.waitFor(() => {
      const button = host.querySelector<HTMLButtonElement>(
        `.ag-row[row-id="${rowKey}"] button[aria-label="View/Edit"]`,
      );
      if (!button) throw new Error('row not rendered yet');
      return button;
    });
  }

  function cellText(rowKey: string, colId: string): Promise<string> {
    return vi.waitFor(() => {
      const cell = host.querySelector(`.ag-row[row-id="${rowKey}"] [col-id="${colId}"]`);
      if (!cell) throw new Error('cell not rendered yet');
      return (cell.textContent ?? '').trim();
    });
  }

  beforeEach(() => {
    for (const fn of [
      api.list,
      api.create,
      api.update,
      api.softDelete,
      groups.listIncludingDeleted,
    ]) {
      fn.mockReset();
    }
    for (const fn of Object.values(notify)) fn.mockReset();
    groups.listIncludingDeleted.mockReturnValue(
      of([group(1), group(2), group(3, { IsActive: false })]),
    );
    api.list.mockReturnValue(of([centre(1), centre(2, { ClientGroupId: 3 })]));
  });

  afterEach(async () => {
    // Close any popup a test left open, so it does not leak into the next test.
    await click(dialogButton('Cancel') ?? null).catch(() => undefined);
  });

  it('lists claim centres newest first with their client group, cells read-only', async () => {
    await render();
    expect(await cellText('id:1', 'ClientGroupId')).toBe('Group 1');
    expect(await cellText('id:2', 'ClientGroupId')).toBe('Group 3 (Inactive)');
    const rowAt = (index: number) =>
      host.querySelector(`.ag-row[row-index="${index}"]`)?.getAttribute('row-id');
    expect([rowAt(0), rowAt(1)]).toEqual(['id:2', 'id:1']);
    expect(host.querySelector('[col-id="save"]')).toBeNull();
    const toggle = host.querySelector<HTMLButtonElement>('.ag-row button[role="switch"]');
    expect(toggle?.disabled).toBe(true);
  });

  it('creates a claim centre in the popup and puts it at the top', async () => {
    api.create.mockImplementation((entity: ClaimCentre) => of({ ...entity, ClaimCentreId: 9 }));
    await render();
    await click(host.querySelector<HTMLButtonElement>('.entity-grid-new'));
    expect(dialog()?.textContent).toContain('Create New Claim Centre');

    // Only active client groups can be picked.
    expect(dropdownText('cc-group')).toBe('-- Select Client Group --');
    expect(await dropdownOptions('cc-group')).toEqual(['Group 1', 'Group 2']);

    await click(dialogButton('Save'));
    expect(notify.warning).toHaveBeenCalledWith('Please fill in all required fields.');
    expect(dialog()?.textContent).toContain('Name is required.');
    expect(api.create).not.toHaveBeenCalled();

    await fill('cc-name', '  Durban North ');
    await choose('cc-group', 'Group 2');
    await choose('cc-province', 'KwaZulu-Natal');
    await fill('cc-tel', '031 123 4567');
    await click(dialogButton('Save'));

    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ClaimCentreId: 0,
        Name: 'Durban North',
        ClientGroupId: 2,
        Province: 'KwaZulu-Natal',
        Tel: '+27311234567',
        Fax: '',
        IsActive: true,
      }),
    );
    expect(notify.success).toHaveBeenCalledWith('Claim Centre saved.');
    expect(dialog()).toBeNull();
    expect(await cellText('id:9', 'Name')).toBe('Durban North');
  });

  it('edits an existing claim centre and keeps its inactive client group', async () => {
    api.update.mockImplementation((entity: ClaimCentre) => of(entity));
    await render();
    await click(await viewButton('id:2'));
    expect(dialog()?.textContent).toContain('Edit Claim Centre');
    expect(field<HTMLInputElement>('cc-name').value).toBe('Centre 2');
    expect(dropdownText('cc-group')).toBe('Group 3 (Inactive)');

    await click(dialogButton('Update'));
    expect(notify.info).toHaveBeenCalledWith('No changes to save.');
    expect(api.update).not.toHaveBeenCalled();

    await fill('cc-town', 'Pretoria');
    await click(dialogButton('Update'));
    expect(api.update).toHaveBeenCalledWith(centre(2, { ClientGroupId: 3, TownCity: 'Pretoria' }));
    expect(await cellText('id:2', 'TownCity')).toBe('Pretoria');
  });

  it('keeps the popup open when the server refuses (e.g. duplicate name)', async () => {
    api.update.mockReturnValue(throwError(() => new Error('422')));
    await render();
    await click(await viewButton('id:1'));
    await fill('cc-name', 'Centre 2');
    await click(dialogButton('Update'));
    expect(dialog()).not.toBeNull();
    expect(dialogButton('Update')?.disabled).toBe(false);
    expect(await cellText('id:1', 'Name')).toBe('Centre 1');
  });

  it('read-only users can open a claim centre but not change it', async () => {
    await render({ CanRead: true });
    expect(host.querySelector('.entity-grid-new')).toBeNull();
    expect(host.querySelector('[col-id="delete"]')).toBeNull();
    await click(await viewButton('id:1'));
    expect(dialog()?.textContent).toContain('View Claim Centre');
    expect(dialogButton('Update')).toBeUndefined();
    // Disabled through the form's fieldset, so check the state rather than the attribute.
    expect(field<HTMLInputElement>('cc-name').matches(':disabled')).toBe(true);
  });

  it('edit-only users can update but not create', async () => {
    await render({ CanEdit: true });
    expect(host.querySelector('.entity-grid-new')).toBeNull();
    await click(await viewButton('id:1'));
    expect(dialogButton('Update')).toBeDefined();
  });
});
