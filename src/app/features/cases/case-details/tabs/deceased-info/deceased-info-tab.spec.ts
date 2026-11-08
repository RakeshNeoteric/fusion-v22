import type { CaseDeceasedRecord } from '@api/cases/case.api';
import { caseDeceased } from '../../../../../../testing/case.fixtures';
import { caseTabHarness, held } from '../testing/case-tab-harness';

/** A case on the Groceries (AVS) service, which has the Deceased Info tab. */
const avs = (deceased: CaseDeceasedRecord | null = null) =>
  held({ CaseClientServiceId: 6, CaseDeceasedInfo: deceased });

describe('Deceased Info tab', () => {
  const { api, notify, show, type, choose, answer, openTab, selectedTab, value, disabled, text } =
    caseTabHarness();

  const saved = () => api.saveDeceased.mock.calls[0]?.[0] as CaseDeceasedRecord;

  it('opens the fields the saved answers allow, and shows the age at death', async () => {
    await show(
      avs(
        caseDeceased({
          CaseDetailId: 4,
          PolicyNumber: 'POL-1',
          IsIdNumberAvailable: true,
          IdNumber: '8001015009087',
          Gender: 'Male',
          DeceasedDateOfBirth: '1980-01-01T00:00:00',
          DeceasedDateOfDeath: '2026-10-30T00:00:00',
        }),
      ),
    );
    await openTab('Deceased Info');
    expect(value('di-id')).toBe('8001015009087');
    expect(disabled('di-id')).toBe(false);
    expect(disabled('di-passport')).toBe(false);
    expect(disabled('di-birth')).toBe(true);
    expect(value('di-age')).toBe('46');
    expect(value('di-relationship')).toContain('OTHER');
  });

  it('takes the date of birth and sex from the ID number and saves the whole record', async () => {
    await show(avs(caseDeceased({ CaseDetailId: 4, PolicyNumber: 'POL-1', BurialTown: 'Durban' })));
    await openTab('Deceased Info');
    expect(disabled('di-id')).toBe(true);
    await answer('Deceased: do you have any ID number?', 'Yes');
    await type('di-id', '8001014009088');
    expect(value('di-birth')).toBe('01/01/1980');
    await type('di-death', '2026-01-01');
    expect(value('di-age')).toBe('46');
    await type('di-place', 'Home');
    await openTab('Caller');

    expect(selectedTab()).toBe('Caller');
    expect(saved()).toMatchObject({
      CaseDeceasedInfoId: 30,
      PolicyNumber: 'POL-1',
      IsIdNumberAvailable: true,
      IdNumber: '8001014009088',
      Gender: 'Female',
      DeceasedDateOfBirth: '1980-01-01',
      DeceasedDateOfDeath: '2026-01-01',
      PlaceOfDeath: 'Home',
      BurialTown: 'Durban',
      Country: 'ZA',
    });
    expect(notify.success).toHaveBeenCalledWith('Deceased details saved.');
  });

  it('needs a passport without an ID, and a death after the birth', async () => {
    await show(avs(caseDeceased({ CaseDetailId: 4, PolicyNumber: 'POL-1' })));
    await openTab('Deceased Info');
    await answer('Deceased: do you have any ID number?', 'No');
    expect(disabled('di-birth')).toBe(false);
    await answer('Gender', 'Male');
    await type('di-birth', '1990-05-05');
    await type('di-death', '1990-05-04');
    expect(text()).toContain('Date of Death cannot be before Date of Birth.');
    await openTab('Caller');

    expect(selectedTab()).toBe('Deceased Info');
    expect(text()).toContain('Passport Number is required when there is no ID number.');
    expect(notify.warning).toHaveBeenCalledWith(
      'Please correct the highlighted fields on the Deceased Info tab.',
    );
    expect(api.saveDeceased).not.toHaveBeenCalled();

    await type('di-passport', 'A123');
    await type('di-death', '2026-01-02');
    await openTab('Caller');
    expect(saved()).toMatchObject({
      IsIdNumberAvailable: false,
      IdNumber: null,
      PassportNumber: 'A123',
      Gender: 'Male',
      DeceasedDateOfBirth: '1990-05-05',
    });
  });

  it('has provinces only in South Africa', async () => {
    await show(avs(caseDeceased({ CaseDetailId: 4, PolicyNumber: 'P', DeathProvince: 'Gauteng' })));
    await openTab('Deceased Info');
    expect(value('di-death-province')).toContain('Gauteng');
    await choose('di-country', 'Zimbabwe');
    expect(disabled('di-death-province')).toBe(true);
    await openTab('Caller');
    expect(saved()).toMatchObject({ Country: 'ZW', DeathProvince: null });
  });

  it('makes a new record with the policy number, and none when nothing is entered', async () => {
    await show(avs());
    await openTab('Deceased Info');
    await openTab('Caller');
    expect(api.saveDeceased).not.toHaveBeenCalled();

    await openTab('Deceased Info');
    await type('di-first', 'Sam');
    await openTab('Caller');
    expect(selectedTab()).toBe('Deceased Info');
    await type('di-policy', 'POL-9');
    await openTab('Caller');
    expect(saved()).toMatchObject({
      CaseDeceasedInfoId: 0,
      CaseDetailId: 4,
      PolicyNumber: 'POL-9',
      FirstName: 'Sam',
      RelationshipToPolicyHolder: 'OTHER',
    });
  });

  it('only shows a case someone else has open', async () => {
    await show({ ...avs(caseDeceased({ CaseDetailId: 4 })), CaseOpenedBy: 'carl@x.com' });
    await openTab('Deceased Info');
    expect(disabled('di-first')).toBe(true);
    expect(disabled('di-country')).toBe(true);
    await openTab('Caller');
    expect(api.saveDeceased).not.toHaveBeenCalled();
  });
});
