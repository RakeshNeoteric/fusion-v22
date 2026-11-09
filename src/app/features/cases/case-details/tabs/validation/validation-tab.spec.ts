import { of, throwError } from 'rxjs';
import { caseDeceased, caseValidation } from '../../../../../../testing/case.fixtures';
import { caseTabHarness, held } from '../testing/case-tab-harness';

describe('Validation tab', () => {
  const {
    api,
    element,
    notify,
    show,
    settle,
    type,
    choose,
    answer,
    press,
    openTab,
    value,
    disabled,
    text,
  } = caseTabHarness();

  it('records a validation of the policy holder, and lists it', async () => {
    await show(held({ CaseValidation: [caseValidation({ CaseValidationId: 41 })] }));
    await openTab('Validation');
    await press('Validate');
    expect(notify.warning).toHaveBeenCalledWith('Please select a Validation Method.');

    await answer('Validation Method', 'Other');
    await press('Validate');
    expect(notify.warning).toHaveBeenCalledWith('Please specify the other validation method.');

    await type('val-other', 'Funeral parlour call');
    element<HTMLInputElement>('input[role="switch"]').click();
    await settle();
    await press('Validate');

    expect(api.saveValidation.mock.calls[0]?.[0]).toMatchObject({
      CaseValidationId: 41,
      PolicyNumber: 'POL-1',
      ValidationMethod: null,
      ValidationOther: 'Funeral parlour call',
      IsBenefitValid: true,
      ValidatedBy: '7',
    });
    expect(notify.success).toHaveBeenCalledWith('Validation saved successfully.');
    expect(text()).toContain('Other (Funeral parlour call)');
    expect(text()).toContain('Jane Doe');
  });

  it('takes the date of birth from a valid South African ID', async () => {
    await show(held());
    await openTab('Validation');
    await answer('Policy holder: do you have any ID Number?', 'Yes');
    await type('val-holder-id', '8001015009087');
    expect(value('val-holder-birth')).toBe('01/01/1980');
    expect(disabled('val-holder-birth')).toBe(true);
  });

  it('copies the deceased into the policy holder when they are the same person', async () => {
    await show(held());
    await openTab('Validation');
    await type('val-deceased-first', 'Sam');
    await type('val-deceased-id', '8001015009087');
    await choose('val-relationship', 'Self');
    expect(value('val-holder-first')).toBe('Sam');
    expect(value('val-holder-id')).toBe('8001015009087');
    expect(disabled('val-holder-first')).toBe(true);
  });

  it('leaves the deceased to the Deceased Info tab when the case has one', async () => {
    await show(held({ CaseClientServiceId: 6 }));
    await openTab('Validation');
    expect(disabled('val-deceased-first')).toBe(true);
    expect(disabled('val-relationship')).toBe(true);
    expect(disabled('val-deceased-birth')).toBe(true);
    expect(text()).not.toContain('Change these on the Deceased Info tab.');
  });

  it("fills the policy holder from the client's policy system", async () => {
    api.fetchPolicy.mockReturnValue(
      of([
        {
          FullName: 'MARY ANN MOYO',
          IdNumber: '8001015009087',
          DateOfBirth: 19800101,
          PolicyNo: 'FNB-77',
          PolicyStatus: 'IN FORCE',
          RoleType: 'MAIN',
          RoleStatus: 'ACTIVE',
          CoverAmount: 15000,
          EligibleForRepat: 'Y',
        },
      ]),
    );
    await show(
      held({
        CaseDeceasedInfo: caseDeceased({ IdNumber: '7001015009088', CaseDetailId: 4 }),
      }),
    );
    await openTab('Validation');
    await press('Fetch Policy Details');
    expect(value('fp-deceased')).toBe('7001015009088');
    await press('Get Policy Details');
    expect(api.fetchPolicy).toHaveBeenCalledWith(4, {
      clientId: 1,
      deceasedId: '7001015009088',
      policyNumber: null,
      dateOfDeath: null,
    });
    expect(text()).toContain('01/01/1980');
    await press('Select');
    expect(value('val-policy')).toBe('FNB-77');
    expect(value('val-holder-first')).toBe('MARY');
    expect(value('val-holder-surname')).toBe('ANN MOYO');
    expect(value('val-holder-birth')).toBe('01/01/1980');
  });

  it('stays open when the client has no policy system', async () => {
    api.fetchPolicy.mockReturnValue(throwError(() => new Error('404')));
    await show(held());
    await openTab('Validation');
    await press('Fetch Policy Details');
    await type('fp-deceased', 'X1');
    await press('Get Policy Details');
    expect(document.querySelector('#fp-deceased')).not.toBeNull();
  });
});
