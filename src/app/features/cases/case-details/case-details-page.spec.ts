import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CaseApi, type CaseDetails } from '@api/cases/case.api';
import type { DirectoryUser } from '@api/models/app.models';
import { provideAppIcons } from '@core/icons/app-icons';
import { SessionService } from '@core/session/session.service';
import { UserDirectoryService } from '@core/session/user-directory.service';
import { CASE_INIT, caseDetails } from '../../../../testing/case.fixtures';
import { CaseDetailsPage } from './case-details-page';

const bob: DirectoryUser = {
  AspNetUserId: 3,
  UserName: 'bob',
  UserEmail: 'Bob@Example.com',
  Firstname: 'Bob',
  Lastname: 'Smith',
  IsActive: true,
  IsDeleted: false,
};

describe('CaseDetailsPage', () => {
  const api = { open: vi.fn(), init: vi.fn(), exit: vi.fn(), update: vi.fn() };
  let fixture: ComponentFixture<CaseDetailsPage>;

  beforeEach(() => {
    vi.clearAllMocks();
    api.init.mockReturnValue(of(CASE_INIT));
    api.exit.mockReturnValue(of('ok'));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideAppIcons(),
        { provide: CaseApi, useValue: api },
        {
          provide: SessionService,
          useValue: { user: signal({ id: 7, email: 'jane@example.com', displayName: 'Jane' }) },
        },
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
      ],
    });
    TestBed.inject(UserDirectoryService).load([{ RoleId: 1, RoleName: 'Agent', Users: [bob] }]);
  });

  async function show(
    details: CaseDetails | Error,
    id = details instanceof Error ? 4 : details.CaseDetailId,
  ): Promise<void> {
    api.open.mockReturnValue(details instanceof Error ? throwError(() => details) : of(details));
    fixture = TestBed.createComponent(CaseDetailsPage);
    fixture.componentRef.setInput('id', id);
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const tabs = () =>
    [...(fixture.nativeElement as HTMLElement).querySelectorAll('[role="tab"]')].map((tab) =>
      tab.textContent?.trim(),
    );

  it('shows the header and the tabs the service type allows, opening the case for this user', async () => {
    await show(
      caseDetails({
        CaseDetailId: 4,
        CaseReferenceNumber: 'FES-0004',
        CaseOpenedBy: 'jane@example.com',
        ContactDetails: [
          {
            Id: 1,
            FirstName: 'Ann',
            LastName: 'Lee',
            Email: null,
            ContactNumber: null,
            Relationship: null,
          },
        ],
        CasePhaseDetails: [{ CasePhaseDetailsId: 1, PhaseName: 'phase1' }],
      }),
    );
    expect(api.open).toHaveBeenCalledWith(4);
    expect(text()).toContain('Case Reference Number: FES-0004 (Active)');
    expect(text()).not.toContain('Already opened by');
    expect(tabs()).toEqual(['Caller', 'Deceased Info', 'Phase 1']);
  });

  it('says who has the case open, and does not let go of it for them', async () => {
    await show(caseDetails({ CaseDetailId: 4, CaseOpenedBy: 'bob@example.com' }));
    expect(text()).toContain('— Already opened by Bob Smith');
    fixture.destroy();
    expect(api.exit).not.toHaveBeenCalled();
  });

  it('goes back to the list on Exit, saving nothing unchanged, and lets go of the case', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await show(
      caseDetails({ CaseDetailId: 4, CaseStatus: 'Pending', CaseOpenedBy: 'JANE@example.com' }),
    );
    const exit = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'button[aria-label="Exit"]',
    );
    exit?.click();
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith(['/cases']);
    expect(api.update).not.toHaveBeenCalled();
    fixture.destroy();
    expect(api.exit).toHaveBeenCalledTimes(1);
    expect(api.exit).toHaveBeenCalledWith(4, 'Pending');
  });

  it('lets go of the case when the page is left another way', async () => {
    await show(caseDetails({ CaseDetailId: 4, CaseOpenedBy: 'jane@example.com' }));
    fixture.destroy();
    expect(api.exit).toHaveBeenCalledWith(4, 'Active');
  });

  it('says when the case could not be loaded', async () => {
    await show(new Error('gone'));
    expect(text()).toContain('Failed to load the case details.');
  });
});
