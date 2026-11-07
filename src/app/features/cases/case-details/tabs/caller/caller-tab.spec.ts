import type { CaseDetails } from '@api/cases/case.api';
import { caseTabHarness, held } from '../testing/case-tab-harness';

describe('Caller tab', () => {
  const {
    api,
    notify,
    show,
    settle,
    element,
    type,
    choose,
    answer,
    openTab,
    selectedTab,
    value,
    disabled,
    text,
  } = caseTabHarness();

  it('shows the case: client, service, language, callers, controller, agent', async () => {
    await show(held({ IsPolicyHolder: false }));
    expect(element<HTMLSelectElement>('#caller-client').selectedOptions[0]?.text).toBe(
      'Zulu Insure',
    );
    expect(element<HTMLSelectElement>('#caller-service').selectedOptions[0]?.text).toBe('Funeral');
    expect(element<HTMLSelectElement>('#caller-language').selectedOptions[0]?.text).toBe('Zulu');
    expect(value('caller-first-0')).toBe('Ann');
    expect(element<HTMLSelectElement>('#caller-controller').selectedOptions[0]?.text).toBe(
      'Carl Ng',
    );
    expect(element<HTMLSelectElement>('#caller-agent').selectedOptions[0]?.text).toBe('Jane Doe');
    expect(value('caller-case-number')).toBe('0000004');
    const no = element('[aria-label="Caller is Policy Holder"] [aria-checked="true"]');
    expect(no.textContent?.trim()).toBe('No');
  });

  it('saves its changes before another tab opens, keeping the rest of the case', async () => {
    await show(held());
    await type('caller-surname-0', 'Lee-Smith');
    await answer('Case Reference Number Given To Caller?', 'Yes');
    await choose('caller-controller', 'Select Case Controller');
    await openTab('Policy Details');

    expect(api.update).toHaveBeenCalledTimes(1);
    const [sent, changes] = api.update.mock.calls[0] as [CaseDetails, Record<string, unknown>];
    expect(sent.CaseStatus).toBe('Pending');
    expect(changes).toMatchObject({
      CaseClientId: 1,
      CaseClientServiceId: 5,
      PreferredLanguage: 'Zulu',
      CaseControllerUserId: 0,
      AgentId: 7,
      CaseReferenceGivenToCaller: true,
      ContactDetails: [
        {
          Id: 1,
          FirstName: 'Ann',
          LastName: 'Lee-Smith',
          ContactNumber: '821234567',
          Email: null,
          Relationship: 'AUNT',
        },
      ],
    });
    expect(changes).not.toHaveProperty('CaseStatus');
    expect(notify.success).toHaveBeenCalledWith('Caller details saved.');
    expect(selectedTab()).toBe('Policy Details');
  });

  it('adds a second caller, at most, with its own id', async () => {
    await show(held());
    const add = element<HTMLButtonElement>('[aria-label="Add a caller"]');
    add.click();
    await settle();
    expect(add.disabled).toBe(true);
    await type('caller-first-1', 'Bob');
    await openTab('Validation');
    const changes = api.update.mock.calls[0]?.[1] as { ContactDetails: { Id: number }[] };
    expect(changes.ContactDetails.map((contact) => contact.Id)).toEqual([1, 2]);
  });

  it('stays on the tab while an email is not valid', async () => {
    await show(held());
    await type('caller-email-0', 'not-an-email');
    await openTab('Policy Details');
    expect(api.update).not.toHaveBeenCalled();
    expect(notify.warning).toHaveBeenCalledWith(
      'Please correct the highlighted fields on the Caller tab.',
    );
    expect(text()).toContain('Enter a valid email address.');
    expect(selectedTab()).toBe('Caller');
  });

  describe('the tabs follow the service (v21)', () => {
    const tabs = () =>
      [...document.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent?.trim());
    const FUNERAL_TABS = ['Caller', 'Policy Details', 'Validation'];
    // Groceries (AVS, a voucher service): its own rule, plus Voucher/SMS.
    const GROCERIES_TABS = [
      'Caller',
      'Deceased Info',
      'Cause Of Death',
      'Final Funeral',
      'Validation',
      'Voucher/SMS',
    ];

    it('as soon as another service is picked, before it is saved', async () => {
      await show(held());
      expect(tabs()).toEqual(FUNERAL_TABS);

      await choose('caller-service', 'Groceries');
      expect(tabs()).toEqual(GROCERIES_TABS);
      expect(api.update).not.toHaveBeenCalled();

      // Back to the saved service: its tabs again.
      await choose('caller-service', 'Funeral');
      expect(tabs()).toEqual(FUNERAL_TABS);
    });

    it("saves the new service when one of its tabs is opened, and keeps that service's tabs", async () => {
      await show(held());
      await choose('caller-service', 'Groceries');
      await openTab('Deceased Info');

      expect(api.update).toHaveBeenCalledTimes(1);
      const [, changes] = api.update.mock.calls[0] as [CaseDetails, Record<string, unknown>];
      expect(changes).toMatchObject({ CaseClientId: 1, CaseClientServiceId: 6 });
      expect(selectedTab()).toBe('Deceased Info');
      expect(tabs()).toEqual(GROCERIES_TABS);
    });

    it('keeps the saved tabs while another client has no service picked yet', async () => {
      await show(held());
      await choose('caller-client', 'Acme');
      expect(tabs()).toEqual(FUNERAL_TABS);
    });
  });

  it('chooses the service again for another client, and needs one', async () => {
    await show(held());
    await choose('caller-client', 'Acme');
    expect(value('caller-service')).not.toBe('5');
    expect(element<HTMLSelectElement>('#caller-service').options[0]?.text.trim()).toBe(
      'No services for this client',
    );
    await openTab('Policy Details');
    expect(api.update).not.toHaveBeenCalled();
    expect(text()).toContain('Service is required.');
  });

  it('shows the case read-only to others', async () => {
    await show(held({ CaseOpenedBy: 'bob@example.com' }));
    expect(disabled('caller-first-0')).toBe(true);
    expect(disabled('caller-client')).toBe(true);
    await openTab('Policy Details');
    expect(api.update).not.toHaveBeenCalled();
    expect(selectedTab()).toBe('Policy Details');
  });

  it('shows the service note', async () => {
    await show(held());
    expect(text()).toContain('Selected Service');
    expect(text()).toContain('Type: FUN');
  });
});
