import type { CaseComplaintRecord } from '@api/cases/case.api';
import { caseTabHarness, held } from '../testing/case-tab-harness';

const complaint = (extra: Partial<CaseComplaintRecord> = {}): CaseComplaintRecord => ({
  CaseComplaintId: 50,
  CaseDetailId: 4,
  Title: 'Late pickup',
  Type: 'Customer',
  ComplaintDetail: 'Family waited two hours.',
  CreatedDate: '2026-11-02T08:30:00',
  CreatedByUserId: 3,
  ...extra,
});

/** Service 8 has no tab rule, so the case gets v21's default tabs: Caller, Complaints, Documents. */
const onDefaultTabs = held({ CaseClientServiceId: 8 });

describe('Complaints tab', () => {
  const { api, notify, show, openTab, press, type, choose, element, text, settle } =
    caseTabHarness();

  const rowTexts = () =>
    [...document.querySelectorAll('app-complaints-tab tbody tr')].map((row) =>
      [...row.querySelectorAll('td')].map((cell) => cell.textContent?.trim()),
    );

  it('lists the complaints newest first, with who logged them', async () => {
    await show({
      ...onDefaultTabs,
      Complaint: [
        complaint(),
        complaint({ CaseComplaintId: 51, Title: 'Rude driver', CreatedByUserId: 99 }),
      ],
    });
    await openTab('Complaints');

    const rows = rowTexts();
    expect(rows.map((row) => row[2])).toEqual(['Rude driver', 'Late pickup']);
    expect(rows[1]?.slice(1, 5)).toEqual([
      'Carl Ng',
      'Late pickup',
      'Customer',
      'Family waited two hours.',
    ]);
    expect(rows[0]?.[1]).toBe('User #99');
    expect(rows[1]?.[0]).toMatch(/^\d{2}\/11\/2026 \d{2}:\d{2}$/);
  });

  it('logs a new complaint by the signed-in user', async () => {
    await show(onDefaultTabs);
    await openTab('Complaints');
    await press('New Complaint');

    expect(element<HTMLInputElement>('#cp-reference').value).toBe('REF1');
    expect(element<HTMLInputElement>('#cp-number').value).toBe('0000004');

    await press('Create Complaint');
    expect(api.addComplaint).not.toHaveBeenCalled();
    expect(text()).toContain('Title is required.');
    expect(text()).toContain('Complaint type is required.');

    await type('cp-title', '  Wrong coffin  ');
    await choose('cp-type', 'Internal');
    const details = element<HTMLTextAreaElement>('#cp-details');
    details.value = 'Ordered oak.';
    details.dispatchEvent(new Event('input'));
    await press('Create Complaint');

    expect(api.addComplaint).toHaveBeenCalledWith(
      expect.objectContaining({
        CaseComplaintId: 0,
        CaseDetailId: 4,
        Title: 'Wrong coffin',
        Type: 'Internal',
        ComplaintDetail: 'Ordered oak.',
        CreatedByUserId: 7,
      }),
    );
    expect(notify.success).toHaveBeenCalledWith('Complaint saved.');
    await settle();
    expect(document.querySelector('app-complaint-dialog')).toBeNull();
    expect(rowTexts()[0]?.slice(1, 3)).toEqual(['Jane Doe', 'Wrong coffin']);
  });

  it('opens a logged complaint read-only', async () => {
    await show({ ...onDefaultTabs, Complaint: [complaint()] });
    await openTab('Complaints');
    element<HTMLButtonElement>('button[aria-label="View: Late pickup"]').click();
    await settle();

    expect(text()).toContain('View Complaint');
    expect(element<HTMLInputElement>('#cp-title').value).toBe('Late pickup');
    expect(element<HTMLInputElement>('#cp-title').disabled).toBe(true);
    expect(document.querySelector('app-complaint-dialog button[type="submit"]')).toBeNull();
  });

  it('cannot log complaints on a closed case', async () => {
    await show({ ...onDefaultTabs, CaseStatus: 'Closed' });
    await openTab('Complaints');

    expect(element<HTMLButtonElement>('app-complaints-tab .app-button').disabled).toBe(true);
  });
});
