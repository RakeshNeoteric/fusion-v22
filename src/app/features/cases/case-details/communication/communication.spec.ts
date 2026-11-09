import { of } from 'rxjs';
import type { CaseHistoryRecord } from '@api/cases/case.api';
import type { ClientWithLinks } from '@api/clients/client.api';
import type { DocumentType } from '@api/config/document.api';
import { formatDateTime } from '@shared/reference/date-time';
import { caseTabHarness, held } from '../tabs/testing/case-tab-harness';

const entry = (
  id: number,
  type: CaseHistoryRecord['NoteType'],
  note: string,
  created: string,
  userId: number,
): CaseHistoryRecord => ({
  CaseHistoryId: id,
  CaseDetailId: 4,
  NoteType: type,
  Note: note,
  CreatedDate: created,
  CreatedByUserId: userId,
});

const HISTORY = [
  entry(1, 'Admin', 'Called the family', '2026-11-01T08:00:00', 7),
  entry(2, 'SMS', 'Your case is open\nRef REF1', '2026-11-02T09:30:00', 3),
];

const withEmail = (extra: Parameters<typeof held>[0] = {}) =>
  held({
    ContactDetails: [
      {
        Id: 1,
        FirstName: 'Ann',
        LastName: 'Lee',
        Email: 'ann@x.com',
        ContactNumber: '821234567',
        Relationship: 'AUNT',
      },
    ],
    ...extra,
  });

describe('Contact History and SMS / Email', () => {
  const h = caseTabHarness();
  const {
    api,
    notify,
    show,
    settle,
    fromMenu,
    openMenu,
    menuItem,
    choose,
    type,
    element,
    text,
    value,
  } = h;

  /** Clicks a button inside a popup (the tabs have buttons of their own). */
  async function pressIn(popup: string, label: string): Promise<void> {
    const button = [...document.querySelectorAll<HTMLButtonElement>(`${popup} button`)].find(
      (candidate) => candidate.textContent?.trim() === label,
    );
    if (!button) throw new Error(`no ${label} in ${popup}`);
    button.click();
    await settle();
  }

  const historyCells = () =>
    [...document.querySelectorAll('app-contact-history-dialog tbody tr')].map((row) =>
      [...row.querySelectorAll('td')].slice(0, 4).map((cell) => cell.textContent?.trim()),
    );

  describe('Contact History', () => {
    it('lists the history fresh from the backend, newest first, with who wrote each', async () => {
      await show(held({ CaseHistory: [] }));
      const opened = api.open.mock.calls.length;
      api.open.mockReturnValue(of(held({ CaseHistory: HISTORY })));
      await fromMenu('Contact History');

      expect(api.open.mock.calls.length).toBe(opened + 1);
      expect(historyCells()).toEqual([
        [formatDateTime('2026-11-02T09:30:00'), 'Carl Ng', 'Your case is open\nRef REF1', 'SMS'],
        [formatDateTime('2026-11-01T08:00:00'), 'Jane Doe', 'Called the family', 'Admin'],
      ]);
    });

    it('notices when reloading gave the case to this user, so leaving lets go of it', async () => {
      await show(held({ CaseOpenedBy: 'bob@example.com', CaseHistory: [] }));
      expect(text()).toContain('Already opened by');
      // Bob has left meanwhile: loading the case now gives it to Jane (backend).
      api.open.mockReturnValue(of(held({ CaseHistory: HISTORY })));
      await fromMenu('Contact History');
      expect(text()).not.toContain('Already opened by');
    });

    it('filters by type and shows an entry in full', async () => {
      await show(held({ CaseHistory: HISTORY }));
      await fromMenu('Contact History');

      await choose('ch-type', 'Admin');
      expect(historyCells().map((row) => row[3])).toEqual(['Admin']);
      await choose('ch-type', 'All');
      expect(historyCells()).toHaveLength(2);

      element<HTMLButtonElement>(
        `app-contact-history-dialog button[aria-label^="View: SMS"]`,
      ).click();
      await settle();
      // v21: a panel at the right of the screen, on top of the history, so always in view.
      const panel = document.querySelector('app-contact-log-dialog');
      expect(panel?.closest('.app-side-panel')).not.toBeNull();
      expect(panel?.textContent).toContain('Contact Log Details');
      expect(panel?.textContent).toContain('Carl Ng');
      expect(panel?.querySelector('.cl-note')?.textContent).toBe('Your case is open\nRef REF1');
      panel?.querySelector<HTMLButtonElement>('button[aria-label="Close details"]')?.click();
      await settle();
      expect(document.querySelector('app-contact-log-dialog')).toBeNull();
    });

    it('adds a note: a type and at least 3 characters', async () => {
      const details = held({ CaseHistory: HISTORY });
      await show(details);
      await fromMenu('Contact History');
      await pressIn('app-contact-history-dialog', 'New Note');

      expect(text()).toContain('New Note');
      await pressIn('app-note-dialog', 'Add Note');
      expect(notify.warning).toHaveBeenCalledWith('Please fill in all required fields.');

      await choose('nt-type', 'Inbound');
      await type('nt-text', '  ok  ');
      await pressIn('app-note-dialog', 'Add Note');
      expect(text()).toContain('Please enter at least 3 characters.');
      expect(api.addHistory).not.toHaveBeenCalled();

      const added = entry(3, 'Inbound', 'Family called back', '2026-11-03T10:00:00', 7);
      api.open.mockReturnValue(of({ ...details, CaseHistory: [...HISTORY, added] }));
      await type('nt-text', ' Family called back ');
      await pressIn('app-note-dialog', 'Add Note');

      expect(api.addHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          CaseHistoryId: 0,
          CaseDetailId: 4,
          NoteType: 'Inbound',
          Note: 'Family called back',
          CreatedByUserId: 7,
        }),
      );
      expect(notify.success).toHaveBeenCalledWith('Note added.');
      expect(historyCells()[0]?.[2]).toBe('Family called back');
    });

    it('can only be read on a closed case', async () => {
      await show(held({ CaseStatus: 'Closed', CaseHistory: HISTORY }));
      await openMenu();
      expect(menuItem('SMS / Email')?.disabled).toBe(true);
      menuItem('Contact History')?.click();
      await settle();

      expect(historyCells()).toHaveLength(2);
      const newNote = [
        ...document.querySelectorAll<HTMLButtonElement>('app-contact-history-dialog button'),
      ].find((button) => button.textContent?.trim() === 'New Note');
      expect(newNote?.disabled).toBe(true);
    });
  });

  describe('SMS / Email', () => {
    it("texts the main caller's number, and the SMS joins the history", async () => {
      await show(held());
      await fromMenu('SMS / Email');
      expect(element<HTMLInputElement>('input[value="sms"]').checked).toBe(true);

      await pressIn('app-message-dialog', 'Send');
      expect(text()).toContain('SMS text is required.');
      expect(api.sendSms).not.toHaveBeenCalled();

      const reloads = api.open.mock.calls.length;
      await type('ms-sms-text', ' Your case is open ');
      await pressIn('app-message-dialog', 'Send');

      expect(api.sendSms).toHaveBeenCalledWith(expect.objectContaining({ CaseDetailId: 4 }), {
        receiver: '+27821234567',
        body: 'Your case is open',
      });
      expect(notify.success).toHaveBeenCalledWith('SMS sent.');
      expect(api.open.mock.calls.length).toBe(reloads + 1);
      expect(document.querySelector('app-message-dialog')).toBeNull();
    });

    it('saves the open tab first, so a number just typed on Caller is texted', async () => {
      await show(held());
      await type('caller-phone-0', '831112222');
      await fromMenu('SMS / Email');

      expect(api.update).toHaveBeenCalledTimes(1);
      await type('ms-sms-text', 'Hi');
      await pressIn('app-message-dialog', 'Send');
      expect(api.sendSms).toHaveBeenCalledWith(expect.anything(), {
        receiver: '+27831112222',
        body: 'Hi',
      });
    });

    it('stays open when the SMS service refuses the number', async () => {
      const { throwError } = await import('rxjs');
      api.sendSms.mockReturnValue(throwError(() => new Error('Invalid Phone Number')));
      await show(held());
      await fromMenu('SMS / Email');
      await type('ms-sms-text', 'Hi');
      await pressIn('app-message-dialog', 'Send');

      expect(notify.success).not.toHaveBeenCalled();
      expect(document.querySelector('app-message-dialog')).not.toBeNull();
    });

    it('emails the callers, checking every address', async () => {
      await show(withEmail());
      await fromMenu('SMS / Email');
      element<HTMLInputElement>('input[value="email"]').click();
      await settle();

      expect(value('ms-to')).toBe('ann@x.com');
      await type('ms-cc', 'nope');
      await type('ms-subject', 'Update');
      await type('ms-email-text', 'Hello <Ann>\nThanks');
      await pressIn('app-message-dialog', 'Send');
      expect(text()).toContain('Not an email address: nope');
      expect(api.sendEmail).not.toHaveBeenCalled();

      await type('ms-cc', 'boss@x.com');
      await pressIn('app-message-dialog', 'Send');

      expect(api.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ CaseDetailId: 4 }), {
        from: 'jane@example.com',
        to: ['ann@x.com'],
        cc: ['boss@x.com'],
        subject: 'Update',
        text: 'Hello <Ann>\nThanks',
        html: 'Hello &#60;Ann&#62;<br>Thanks',
      });
      expect(notify.success).toHaveBeenCalledWith('Email sent.');
    });

    it("emails the client's documents from the Documents tab, naming them", async () => {
      h.clients.get.mockReturnValue(
        of({
          ClientId: 1,
          ClientDocument: [
            {
              ClientDocumentId: 20,
              ClientId: 1,
              DocumentId: 1,
              Note: null,
              DocumentStoragePath: null,
              ListRank: 0,
              IsDeleted: false,
            },
            {
              ClientDocumentId: 21,
              ClientId: 1,
              DocumentId: 2,
              Note: null,
              DocumentStoragePath: null,
              ListRank: 0,
              IsDeleted: false,
            },
          ],
        } as unknown as ClientWithLinks),
      );
      h.documentTypes.listIncludingDeleted.mockReturnValue(
        of([
          { DocumentId: 1, Description: 'Claim Form', IsActive: true, IsDeleted: false },
          { DocumentId: 2, Description: 'Death Certificate', IsActive: true, IsDeleted: false },
        ] as DocumentType[]),
      );
      // Service 8 has no tab rule: v21's default tabs (Caller, Complaints, Documents).
      await show(withEmail({ CaseClientServiceId: 8 }));
      await h.openTab('Documents');
      element<HTMLButtonElement>('app-documents-tab button[aria-label="Email"]').click();
      await h.settle();

      expect(element<HTMLInputElement>('input[value="email"]').checked).toBe(true);
      expect(value('ms-subject')).toBe(`Case documents – ${held().CaseReferenceNumber}`);
      expect(value('ms-email-text')).toBe(
        'Documents for this case:\n- Claim Form\n- Death Certificate',
      );
      expect(text()).toContain('Files cannot be attached yet');
    });
  });

  describe('Case Stages and Vehicle Tracker', () => {
    it('drop down under the header as v21 cards, together or alone', async () => {
      await show(held());
      const toggle = (label: string) =>
        element<HTMLButtonElement>(`.cd-actions button[aria-label="${label}"]`);
      const panel = (id: string) => document.querySelector<HTMLDetailsElement>(`#${id}`);

      toggle('Case Stages').click();
      await settle();
      expect(toggle('Case Stages').getAttribute('aria-expanded')).toBe('true');
      const stages = [...document.querySelectorAll('.cd-stages li')].map((step) => [
        step.querySelector('.cd-stage-number')?.textContent?.trim(),
        step.querySelector('.cd-stage-label')?.textContent?.trim(),
      ]);
      expect(stages).toEqual([
        ['1', 'Case Initiation'],
        ['2', 'Evaluation'],
        ['3', 'Ongoing'],
        ['4', 'On Hold'],
        ['5', 'Resolution'],
      ]);
      expect(document.querySelector('.cd-stage-current')?.textContent).toContain('Case Initiation');
      expect(panel('cd-panel-stages')?.open).toBe(true);

      // v21: both can be open at once.
      toggle('Vehicle Tracker').click();
      await settle();
      expect(panel('cd-panel-stages')).not.toBeNull();
      expect(panel('cd-panel-tracker')?.querySelector('img')?.getAttribute('src')).toBe(
        '/icons/case/vehicle-tracker-map.jpg',
      );

      toggle('Vehicle Tracker').click();
      toggle('Case Stages').click();
      await settle();
      expect(document.querySelector('.cd-panel-drop')).toBeNull();
    });
  });
});
