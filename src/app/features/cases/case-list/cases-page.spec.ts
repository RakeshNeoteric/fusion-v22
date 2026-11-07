import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatDialog } from '@angular/material/dialog';
import { Router, provideRouter } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import { of } from 'rxjs';
import { CaseApi } from '@api/cases/case.api';
import { PageActions } from '@core/layout/page-actions';
import { CASE_INIT, caseDetails, caseDeceased } from '../../../../testing/case.fixtures';
import { CasesPage } from './cases-page';

describe('CasesPage', () => {
  const api = { list: vi.fn(), init: vi.fn() };
  const dialog = { open: vi.fn() };
  let fixture: ComponentFixture<CasesPage>;

  beforeEach(async () => {
    api.list.mockReturnValue(
      of([
        caseDetails({
          CaseDetailId: 9,
          CaseReferenceNumber: 'FES-0009',
          CaseStatus: 'Closed',
          CaseClientServiceId: 6,
          CaseDeceasedInfo: caseDeceased({ Initials: 'J', FirstName: 'John', LastName: 'Doe' }),
        }),
        caseDetails({
          CaseDetailId: 4,
          CaseReferenceNumber: null,
          CaseClientId: 2,
          CaseClientServiceId: 5,
        }),
      ]),
    );
    api.init.mockReturnValue(of(CASE_INIT));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: CaseApi, useValue: api },
        { provide: MatDialog, useValue: dialog },
        { provide: PageActions, useValue: { show: vi.fn(), hide: vi.fn() } },
      ],
    });
    fixture = TestBed.createComponent(CasesPage);
    await settle();
  });

  /** AG Grid draws new rows on the next animation frame. */
  async function settle(): Promise<void> {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    await fixture.whenStable();
  }

  const host = () => fixture.nativeElement as HTMLElement;
  const groups = () =>
    [...host().querySelectorAll<HTMLButtonElement>('.case-group')].map((g) =>
      g.textContent?.trim(),
    );

  async function openGroup(label: string): Promise<void> {
    const button = [...host().querySelectorAll<HTMLButtonElement>('.case-group')].find(
      (candidate) => candidate.textContent?.trim() === label,
    );
    if (!button) throw new Error(`no group ${label}`);
    button.click();
    await settle();
  }

  it('groups the cases by client, service and status, as v21 does', () => {
    expect(groups()).toEqual(['Zulu Insure (1)', 'Groceries (1)', 'Acme (1)', 'Funeral (1)']);
    expect(host().querySelector('.case-group')?.getAttribute('aria-expanded')).toBe('true');
  });

  it('shows the cases of an open group, and opens a case when its row is clicked', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await openGroup('Groceries (1)');
    await openGroup('Closed (1)');
    const link = host().querySelector<HTMLAnchorElement>('a[href*="case-details"]');
    expect(link?.getAttribute('href')).toBe('/cases/case-details?id=9');
    const row = link?.closest<HTMLElement>('.ag-row');
    const cell = row?.querySelector<HTMLElement>('[col-id="deceased"]');
    expect(cell?.textContent).toContain('John Doe');
    cell?.click();
    await settle();
    expect(navigate).toHaveBeenCalledWith(['/cases/case-details'], { queryParams: { id: 9 } });
  });

  it('lists the cases without groups once every grouping is removed', async () => {
    for (const label of ['Client Name', 'Service Name', 'Case Status Group']) {
      host().querySelector<HTMLButtonElement>(`[aria-label="Stop grouping by ${label}"]`)?.click();
      await settle();
    }
    expect(groups()).toEqual([]);
    expect(host().textContent).toContain('Not grouped');
    expect(host().querySelectorAll('a[href*="case-details"]')).toHaveLength(2);
    expect(host().textContent).toContain('Case #4');
  });

  it('adds a grouping back from the list', async () => {
    host().querySelector<HTMLButtonElement>('[aria-label="Stop grouping by Client Name"]')?.click();
    await settle();
    const add = host().querySelector<HTMLSelectElement>('select[aria-label="Add a grouping"]');
    if (!add) throw new Error('no add');
    add.value = 'client';
    add.dispatchEvent(new Event('change'));
    await settle();
    expect(
      [...host().querySelectorAll('.gb-chip')].map((chip) =>
        chip.textContent?.replace(/[⠿\s]+/g, ' ').trim(),
      ),
    ).toEqual(['Service Name', 'Case Status Group', 'Client Name']);
    expect(groups()[0]).toBe('Groceries (1)');
  });

  it('filters the cases by a column, as v21 does, and the groups follow', async () => {
    const grid = fixture.debugElement.query(By.directive(AgGridAngular))
      .componentInstance as AgGridAngular;
    expect(
      host().querySelector('.ag-header-cell[col-id="deceased"] .ag-header-cell-filter-button'),
    ).not.toBeNull();

    grid.api.setFilterModel({ deceased: { filterType: 'text', type: 'contains', filter: 'JOHN' } });
    await settle();
    expect(groups()).toEqual(['Zulu Insure (1)', 'Groceries (1)']);

    grid.api.setFilterModel({
      deceased: { filterType: 'text', type: 'notContains', filter: 'john' },
    });
    await settle();
    expect(groups()).toEqual(['Acme (1)', 'Funeral (1)']);

    grid.api.setFilterModel(null);
    await settle();
    expect(groups()).toHaveLength(4);
  });

  it('filters dates as they are shown', async () => {
    const grid = fixture.debugElement.query(By.directive(AgGridAngular))
      .componentInstance as AgGridAngular;
    grid.api.setFilterModel({
      openDate: { filterType: 'text', type: 'contains', filter: '/1999' },
    });
    await settle();
    expect(groups()).toEqual([]);
    expect(host().textContent).toContain('No cases found.');
  });

  it('opens a new case once it is created', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    dialog.open.mockReturnValue({ afterClosed: () => of(caseDetails({ CaseDetailId: 12 })) });
    await (fixture.componentInstance as unknown as { newCase(): Promise<void> }).newCase();
    expect(navigate).toHaveBeenCalledWith(['/cases/case-details'], { queryParams: { id: 12 } });
  });
});
