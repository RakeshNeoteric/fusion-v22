import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { CaseApi, type CaseDetails } from '@api/cases/case.api';
import { NotificationService } from '@core/notifications/notification.service';
import { CASE_INIT, caseDetails } from '../../../../testing/case.fixtures';
import { CaseDirectory } from '../case-setup';
import { openNewCase } from './new-case-dialog';

describe('NewCaseDialog', () => {
  const api = { create: vi.fn() };
  const notify = { success: vi.fn(), warning: vi.fn() };
  let result: Promise<CaseDetails | null>;

  beforeEach(async () => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: CaseApi, useValue: api },
        { provide: NotificationService, useValue: notify },
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
      ],
    });
    result = openNewCase(TestBed.inject(MatDialog), new CaseDirectory(CASE_INIT));
    await settle();
  });

  afterEach(() => TestBed.inject(MatDialog).closeAll());

  async function settle(): Promise<void> {
    await TestBed.inject(ApplicationRef).whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await TestBed.inject(ApplicationRef).whenStable();
  }

  function select(id: string): HTMLSelectElement {
    const found = document.querySelector<HTMLSelectElement>(`#${id}`);
    if (!found) throw new Error(`not found: ${id}`);
    return found;
  }

  function options(id: string): string[] {
    return [...select(id).options].map((option) => option.text.trim());
  }

  async function choose(id: string, label: string): Promise<void> {
    const element = select(id);
    element.selectedIndex = [...element.options].findIndex((o) => o.text.trim() === label);
    element.dispatchEvent(new Event('change'));
    await settle();
  }

  async function next(): Promise<void> {
    const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
      (candidate) => candidate.textContent?.trim() === 'Next',
    );
    if (!button) throw new Error('no Next button');
    button.click();
    await settle();
  }

  it("offers active clients, then the chosen client's active services", async () => {
    expect(document.body.textContent).toContain('Create a New Call');
    expect(options('nc-client')).toEqual(['Select Client', 'Acme', 'Zulu Insure']);
    expect(select('nc-service').disabled).toBe(true);
    expect(options('nc-service')).toEqual(['Select a client first']);

    await choose('nc-client', 'Acme');
    expect(select('nc-service').disabled).toBe(true);
    expect(options('nc-service')).toEqual(['No services for this client']);

    await choose('nc-client', 'Zulu Insure');
    expect(select('nc-service').disabled).toBe(false);
    expect(options('nc-service')).toEqual(['Select Service', 'Funeral', 'Groceries']);
  });

  it('asks for both fields before creating', async () => {
    await next();
    expect(notify.warning).toHaveBeenCalledWith('Please fill in all required fields.');
    expect(api.create).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Client Name is required.');
  });

  it('creates the case and closes with it', async () => {
    const created = caseDetails({ CaseDetailId: 12 });
    api.create.mockReturnValue(of(created));
    await choose('nc-client', 'Zulu Insure');
    await choose('nc-service', 'Groceries');
    await next();
    expect(api.create).toHaveBeenCalledWith(1, 6);
    expect(notify.success).toHaveBeenCalledWith('Case created.');
    expect(await result).toBe(created);
  });

  it('stays open when the case could not be created', async () => {
    api.create.mockReturnValue(throwError(() => new Error('no')));
    await choose('nc-client', 'Zulu Insure');
    await choose('nc-service', 'Funeral');
    await next();
    expect(document.querySelector('#nc-client')).not.toBeNull();
  });
});
