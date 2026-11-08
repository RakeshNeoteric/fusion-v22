import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import {
  CaseApi,
  type CaseAdditionalCostRecord,
  type CaseCauseOfDeathRecord,
  type CaseComplaintRecord,
  type CaseDeceasedRecord,
  type CaseDetails,
  type CaseFinalFuneralRecord,
  type CaseInit,
  type CasePhaseRecord,
  type CaseTransportRecord,
  type CaseValidationRecord,
} from '@api/cases/case.api';
import { ClientApi } from '@api/clients/client.api';
import { DocumentTypeApi } from '@api/config/document.api';
import { RatingQuestionOptionApi } from '@api/config/rating-question-option.api';
import { RatingQuestionTypeApi } from '@api/config/rating-question-type.api';
import { TransportOperatorApi } from '@api/config/transport-operator.api';
import { VehicleApi } from '@api/config/vehicle.api';
import type { DirectoryUser } from '@api/models/app.models';
import { VoucherApi } from '@api/vouchers/voucher.api';
import { provideAppIcons } from '@core/icons/app-icons';
import { NotificationService } from '@core/notifications/notification.service';
import { PermissionService } from '@core/permissions/permission.service';
import { SessionService } from '@core/session/session.service';
import { UserDirectoryService } from '@core/session/user-directory.service';
import { permission, role } from '../../../../../../testing/app-init.fixtures';
import { CASE_INIT, caseDetails, casePhase } from '../../../../../../testing/case.fixtures';
import { CASES_PERMISSION } from '../../../case-setup';
import { CaseDetailsPage } from '../../case-details-page';
import {
  chooseOption,
  dropdownDisabled,
  dropdownText,
} from '../../../../../../testing/form-controls';

const user = (id: number, first: string, last: string, email: string): DirectoryUser => ({
  AspNetUserId: id,
  UserName: null,
  UserEmail: email,
  Firstname: first,
  Lastname: last,
  IsActive: true,
  IsDeleted: false,
});

const INIT: CaseInit = {
  ...CASE_INIT,
  ServiceTypeBasedTabs: [
    { ServiceTypeCode: 'FUN', TabNames: 'caller,policy-details,validation' },
    {
      ServiceTypeCode: 'AVS',
      TabNames: 'caller,validation,deceased-info,cause-of-death,final-funeral,phase1,phase2,phase3',
    },
  ],
};

/** An open case held by Jane (the signed-in user), on Zulu Insure's Funeral service. */

/** What `POST CaseDetails/{id}` echoes for the records the frontend does not send. */
const BACKEND_ECHO_DEFAULTS = {
  ClientDto: null,
  CaseDeceasedInfo: null,
  CaseCauseOfDeath: null,
  CaseFinalFuneral: null,
  CaseValidation: [],
  CaseDocument: [],
  CasePhaseDetails: [],
  CaseAdditionalCosts: [],
  CaseHistory: [],
  Complaint: [],
  CaseVouchers: [],
  CaseRatings: [],
} as const;

export const held = (extra: Partial<CaseDetails> = {}): CaseDetails =>
  caseDetails({
    CaseDetailId: 4,
    CaseStatus: 'Pending',
    CaseOpenedBy: 'jane@example.com',
    CaseNumber: '0000004',
    CaseControllerUserId: 3,
    AgentId: 7,
    PreferredLanguage: 'Zulu',
    ContactDetails: [
      {
        Id: 1,
        FirstName: 'Ann',
        LastName: 'Lee',
        Email: null,
        ContactNumber: '821234567',
        Relationship: 'AUNT',
      },
    ],
    ...extra,
  });

/**
 * Case Details with a fake backend, for testing its tabs through the page as a user would:
 * Jane (user 7, an Agent) has the case open; Carl (3) is a case controller. Call it inside a
 * `describe`: it sets up and tears down each test.
 */
export function caseTabHarness() {
  const api = {
    open: vi.fn(),
    init: vi.fn(),
    exit: vi.fn(),
    releaseFinished: vi.fn(),
    update: vi.fn(),
    saveValidation: vi.fn(),
    saveDeceased: vi.fn(),
    saveCauseOfDeath: vi.fn(),
    saveFinalFuneral: vi.fn(),
    createPhase: vi.fn(),
    savePhase: vi.fn(),
    saveAdditionalCost: vi.fn(),
    addComplaint: vi.fn(),
    uploadDocument: vi.fn(),
    addHistory: vi.fn(),
    saveRatings: vi.fn(),
    sendSms: vi.fn(),
    sendEmail: vi.fn(),
    fetchPolicy: vi.fn(),
  };
  const clients = { get: vi.fn() };
  const vehicles = { listIncludingDeleted: vi.fn() };
  const operators = { listIncludingDeleted: vi.fn() };
  const documentTypes = { listIncludingDeleted: vi.fn() };
  const vouchers = { available: vi.fn(), request: vi.fn() };
  const ratingTypes = { listIncludingDeleted: vi.fn() };
  const ratingOptions = { listIncludingDeleted: vi.fn() };
  const notify = { success: vi.fn(), warning: vi.fn(), info: vi.fn(), error: vi.fn() };
  let fixture: ComponentFixture<CaseDetailsPage> | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    api.init.mockReturnValue(of(INIT));
    api.exit.mockReturnValue(of('ok'));
    api.releaseFinished.mockImplementation((details: CaseDetails) => of(details));
    // As the backend: the echo is the body it was sent, so the included records it did not get
    // come back as its defaults (single records null, lists empty).
    api.update.mockImplementation((details: CaseDetails, changes: object) =>
      of({ ...details, ...changes, ...BACKEND_ECHO_DEFAULTS }),
    );
    api.saveValidation.mockImplementation((record: CaseValidationRecord) =>
      of({ ...record, CaseValidationId: record.CaseValidationId || 99 }),
    );
    api.saveDeceased.mockImplementation((record: CaseDeceasedRecord) =>
      of({ ...record, CaseDeceasedInfoId: record.CaseDeceasedInfoId || 77 }),
    );
    api.saveCauseOfDeath.mockImplementation((record: CaseCauseOfDeathRecord) =>
      of({ ...record, CaseCauseOfDeathId: record.CaseCauseOfDeathId || 78 }),
    );
    api.saveFinalFuneral.mockImplementation((record: CaseFinalFuneralRecord) =>
      of({ ...record, CaseFinalFuneralId: record.CaseFinalFuneralId || 79 }),
    );
    api.createPhase.mockImplementation((caseId: number, name: string, collectFrom: string) =>
      of(
        casePhase({
          CasePhaseDetailsId: 70,
          CaseDetailId: caseId,
          PhaseName: name,
          CollectFrom: collectFrom,
        }),
      ),
    );
    // The backend echoes the phase with its check list as stored.
    api.savePhase.mockImplementation((record: CasePhaseRecord, transport?: CaseTransportRecord) =>
      of({
        ...record,
        CaseTransportDetails: transport
          ? { ...transport, CaseTransportDetailsId: transport.CaseTransportDetailsId || 91 }
          : (record.CaseTransportDetails ?? null),
      }),
    );
    api.saveAdditionalCost.mockImplementation((record: CaseAdditionalCostRecord) =>
      of({ ...record, CaseAdditionalCostId: record.CaseAdditionalCostId || 95 }),
    );
    api.addComplaint.mockImplementation((record: CaseComplaintRecord) =>
      of({ ...record, CaseComplaintId: 96 }),
    );
    api.uploadDocument.mockReturnValue(of(null));
    api.addHistory.mockImplementation((record: object) => of({ ...record, CaseHistoryId: 97 }));
    api.saveRatings.mockReturnValue(of([]));
    api.sendSms.mockReturnValue(of(null));
    api.sendEmail.mockReturnValue(of(null));
    ratingTypes.listIncludingDeleted.mockReturnValue(of([]));
    ratingOptions.listIncludingDeleted.mockReturnValue(of([]));
    clients.get.mockReturnValue(of(null));
    documentTypes.listIncludingDeleted.mockReturnValue(of([]));
    vouchers.available.mockReturnValue(of([]));
    vouchers.request.mockReturnValue(of({ reserved: [], available: [] }));
    vehicles.listIncludingDeleted.mockReturnValue(of([]));
    operators.listIncludingDeleted.mockReturnValue(of([]));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideAppIcons(),
        { provide: CaseApi, useValue: api },
        { provide: ClientApi, useValue: clients },
        { provide: VehicleApi, useValue: vehicles },
        { provide: TransportOperatorApi, useValue: operators },
        { provide: DocumentTypeApi, useValue: documentTypes },
        { provide: VoucherApi, useValue: vouchers },
        { provide: RatingQuestionTypeApi, useValue: ratingTypes },
        { provide: RatingQuestionOptionApi, useValue: ratingOptions },
        { provide: NotificationService, useValue: notify },
        {
          provide: SessionService,
          useValue: { user: signal({ id: 7, email: 'jane@example.com', displayName: 'Jane' }) },
        },
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
      ],
    });
    grantCases({ CanCreate: true });
    TestBed.inject(UserDirectoryService).load([
      { RoleId: 1, RoleName: 'Agent', Users: [user(7, 'Jane', 'Doe', 'jane@example.com')] },
      { RoleId: 2, RoleName: 'CaseController', Users: [user(3, 'Carl', 'Ng', 'carl@x.com')] },
    ]);
  });

  afterEach(() => TestBed.inject(MatDialog).closeAll());

  /** Jane's access to the Cases screen: full by default. */
  function grantCases(flags: Parameters<typeof permission>[1]): void {
    TestBed.inject(PermissionService).load([role('Agent', [permission(CASES_PERMISSION, flags)])]);
  }

  /** Jane may only view cases. Call before `show`. */
  const allowOnlyViewing = () => grantCases({});

  async function show(details: CaseDetails): Promise<void> {
    api.open.mockReturnValue(of(details));
    fixture = TestBed.createComponent(CaseDetailsPage);
    fixture.componentRef.setInput('id', details.CaseDetailId);
    await settle();
  }

  async function settle(): Promise<void> {
    await fixture?.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture?.whenStable();
  }

  function element<E extends HTMLElement>(selector: string): E {
    const found = document.querySelector<E>(selector);
    if (!found) throw new Error(`not found: ${selector}`);
    return found;
  }

  async function type(id: string, value: string): Promise<void> {
    const input = element<HTMLInputElement>(`#${id}`);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    // As a browser does on leaving a changed field (Material's date fields read it).
    input.dispatchEvent(new Event('change'));
    input.dispatchEvent(new Event('blur'));
    await settle();
  }

  async function choose(id: string, label: string): Promise<void> {
    await chooseOption(id, label);
    await settle();
  }

  async function answer(question: string, label: string): Promise<void> {
    const group = element(`[role="radiogroup"][aria-label="${question}"]`);
    const button = [...group.querySelectorAll<HTMLButtonElement>('button')].find(
      (candidate) => candidate.textContent?.trim() === label,
    );
    if (!button) throw new Error(`no ${label} in ${question}`);
    button.click();
    await settle();
  }

  async function press(text: string): Promise<void> {
    const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
      (candidate) => candidate.textContent?.trim() === text,
    );
    if (!button) throw new Error(`no button ${text}`);
    button.click();
    await settle();
  }

  async function openTab(label: string): Promise<void> {
    const tab = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
      (candidate) => candidate.textContent?.trim() === label,
    );
    if (!tab) throw new Error(`no tab ${label}`);
    tab.click();
    await settle();
  }

  /** An item of the header's View More menu (open the menu first). */
  const menuItem = (label: string) =>
    [...document.querySelectorAll<HTMLButtonElement>('.mat-mdc-menu-item')].find(
      (item) => item.textContent?.trim() === label,
    );

  async function openMenu(): Promise<void> {
    element<HTMLButtonElement>('.cd-actions button[aria-label="View More"]').click();
    await settle();
  }

  /** Picks an item of the header's View More menu. */
  async function fromMenu(label: string): Promise<void> {
    await openMenu();
    const item = menuItem(label);
    if (!item) throw new Error(`no menu item ${label}`);
    item.click();
    await settle();
  }

  const selectedTab = () =>
    document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim();
  /** A box's text, or what a dropdown shows. */
  const value = (id: string) => {
    const found = element<HTMLInputElement>(`#${id}`);
    return found.tagName === 'MAT-SELECT' ? dropdownText(id) : found.value;
  };
  const disabled = (id: string) => {
    const found = element<HTMLInputElement>(`#${id}`);
    return found.tagName === 'MAT-SELECT' ? dropdownDisabled(id) : found.disabled;
  };
  const text = () => document.body.textContent ?? '';

  return {
    api,
    clients,
    vehicles,
    operators,
    documentTypes,
    vouchers,
    ratingTypes,
    ratingOptions,
    notify,
    show,
    allowOnlyViewing,
    settle,
    element,
    type,
    choose,
    answer,
    press,
    openTab,
    openMenu,
    menuItem,
    fromMenu,
    selectedTab,
    value,
    disabled,
    text,
  };
}
