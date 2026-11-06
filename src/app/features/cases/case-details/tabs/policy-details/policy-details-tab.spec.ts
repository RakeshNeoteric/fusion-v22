import type { CaseValidationRecord } from '@api/cases/case.api';
import { caseDeceased, caseValidation } from '../../../../../../testing/case.fixtures';
import { caseTabHarness, held } from '../testing/case-tab-harness';

describe('Policy Details tab', () => {
  const { api, show, type, answer, openTab, selectedTab, value, disabled, text } = caseTabHarness();

  it('saves the policy holder on its own row, keeping validations already done', async () => {
    const done = caseValidation({
      CaseValidationId: 40,
      ValidationMethod: 'Telephonically',
      ValidatedOn: '2026-11-01T10:00:00',
      ValidatedBy: '7',
    });
    await show(held({ CaseValidation: [done] }));
    await openTab('Policy Details');
    expect(value('pd-policy')).toBe('POL-1');
    await type('pd-membership', 'M-9');
    await openTab('Validation');

    const record = api.saveValidation.mock.calls[0]?.[0] as CaseValidationRecord;
    expect(record).toMatchObject({
      CaseValidationId: 0,
      PolicyNumber: 'POL-1',
      MembershipNumber: 'M-9',
      PolicyHolderFirstName: 'Mary',
      ValidationMethod: null,
      ValidatedOn: null,
    });
    expect(record).not.toHaveProperty('PolicyHolderDOB');
    expect(api.saveDeceased).not.toHaveBeenCalled();
  });

  it('updates a policy-holder-only row in place', async () => {
    await show(held({ CaseValidation: [caseValidation({ CaseValidationId: 41 })] }));
    await openTab('Policy Details');
    await type('pd-holder-first', 'Marie');
    await openTab('Validation');
    expect(api.saveValidation.mock.calls[0]?.[0]).toMatchObject({
      CaseValidationId: 41,
      PolicyHolderFirstName: 'Marie',
    });
  });

  it('checks ID numbers and passports by the answer to "any ID Number?"', async () => {
    await show(held());
    await openTab('Policy Details');
    await type('pd-policy', 'P1');
    expect(disabled('pd-holder-id')).toBe(true);
    await answer('Policy holder: do you have any ID Number?', 'Yes');
    await type('pd-holder-id', '8001015009088');
    expect(text()).toContain('Invalid South African ID checksum.');
    await openTab('Caller');
    expect(selectedTab()).toBe('Policy Details');

    await answer('Policy holder: do you have any ID Number?', 'No');
    expect(disabled('pd-holder-id')).toBe(true);
    await openTab('Caller');
    expect(text()).toContain('Passport Number is required when there is no ID number.');
    await type('pd-holder-passport', 'A123');
    await openTab('Caller');
    expect(selectedTab()).toBe('Caller');
    expect(api.saveValidation.mock.calls[0]?.[0]).toMatchObject({
      IsIDNumberAvbl: false,
      PolicyHolderIdNumber: null,
      PassportNumber: 'A123',
    });
  });

  it('saves the deceased into their whole record', async () => {
    const deceased = caseDeceased({ CaseDetailId: 4, PlaceOfDeath: 'Home', FirstName: 'Sam' });
    await show(held({ CaseValidation: [caseValidation()], CaseDeceasedInfo: deceased }));
    await openTab('Policy Details');
    await answer('Deceased: do you have any ID Number?', 'Yes');
    await type('pd-deceased-id', '8001015009087');
    await openTab('Caller');
    expect(api.saveDeceased.mock.calls[0]?.[0]).toMatchObject({
      CaseDeceasedInfoId: 30,
      FirstName: 'Sam',
      PlaceOfDeath: 'Home',
      IsIdNumberAvailable: true,
      IdNumber: '8001015009087',
      DeceasedDateOfBirth: '1980-01-01',
    });
  });
});
