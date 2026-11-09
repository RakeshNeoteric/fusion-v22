import { of } from 'rxjs';
import type { CaseDetails, CasePhaseRecord } from '@api/cases/case.api';
import {
  caseDeceased,
  casePhase,
  caseTransport,
  clientWithProviders,
  serviceProvider,
} from '../../../../../../testing/case.fixtures';
import { caseTabHarness, held } from '../testing/case-tab-harness';

/** A case on the Groceries (AVS) service, which allows three phases. */
const avs = (extra: Partial<CaseDetails> = {}) =>
  held({
    CaseClientServiceId: 6,
    CaseDeceasedInfo: caseDeceased({ CaseDetailId: 4, BodyLocation: 'Ward 5' }),
    ...extra,
  });

/** Phase 1 with Phase Costing's values, which the tab must keep. */
const phase1 = (extra: Partial<CasePhaseRecord> = {}) =>
  casePhase({
    CasePhaseDetailsId: 61,
    CaseDetailId: 4,
    PhaseName: 'phase1',
    Cost: 1500,
    AuthorisedDate: '2026-11-01T00:00:00',
    VehicleDispatched: '2026-11-02T10:00:00',
    ...extra,
  });

describe('Phase tabs', () => {
  const {
    api,
    clients,
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
    press,
  } = caseTabHarness();

  const savedPhase = (call = 0) => api.savePhase.mock.calls[call]?.[0] as CasePhaseRecord;
  const addButton = () => element<HTMLButtonElement>('button[aria-label="Add Phase"]');
  const leave = async () => {
    element('app-phase-tab').dispatchEvent(new Event('pointerleave'));
    await settle();
  };

  beforeEach(() => {
    clients.get.mockReturnValue(
      of(clientWithProviders(serviceProvider(1, 'AVBOB'), serviceProvider(2, 'Doves'))),
    );
  });

  it('copies the chosen providers and saves the whole phase, keeping its costing', async () => {
    await show(avs({ CasePhaseDetails: [phase1()] }));
    await openTab('Phase 1');
    expect(value('ph-collect-from')).toBe('Ward 5');

    await choose('ph-collect-provider', 'AVBOB');
    expect(value('ph-manager')).toBe('Manager 1');
    expect(value('ph-collect-storage')).toBe('1 Cold Store');
    await choose('ph-remove-provider', 'Doves');
    // The provider's number, with its flag and dial code; it can be changed.
    expect(value('ph-remove-telephone')).toBe('082 123 4567');
    expect(disabled('ph-remove-telephone')).toBe(false);
    expect(
      element<HTMLElement>('#ph-remove-telephone')
        .closest('app-phone-field')
        ?.querySelector('.phone-country')?.textContent,
    ).toContain('+27');
    element<HTMLInputElement>('input[formcontrolname="upliftFamily"]').click();
    await type('ph-first', 'Ann');
    await type('ph-remove-telephone', '083 555 1234');
    await openTab('Caller');

    expect(selectedTab()).toBe('Caller');
    expect(savedPhase()).toEqual({
      ...phase1(),
      CollectFrom: 'Ward 5',
      CollectServiceProviderId: 1,
      ManagerName: 'Manager 1',
      CollectPhysicalAddress: '1 Main Road',
      CollectStorageAddress: '1 Cold Store',
      CollectTelephone: '+27821234567',
      CollectFaxNumber: '+27114567890',
      RemoveServiceProviderId: 2,
      RemoveToPhysicalAddress: '2 Main Road',
      RemoveToStorageAddress: '2 Cold Store',
      RemoveTelephone: '+27835551234',
      RemoveFaxNumber: '+27114567890',
      UpliftFamily: 'Yes',
      FirstName: 'Ann',
      SurName: null,
      RemoveContactNumber: null,
    });
    expect(notify.success).toHaveBeenCalledWith('Phase 1 saved.');
  });

  it('saves quietly when the mouse leaves the tab, and only what changed and is valid', async () => {
    await show(avs({ CasePhaseDetails: [phase1()] }));
    await openTab('Phase 1');
    await leave();
    expect(api.savePhase).not.toHaveBeenCalled();

    await type('ph-contact', '12');
    await leave();
    expect(api.savePhase).not.toHaveBeenCalled();
    await openTab('Caller');
    expect(selectedTab()).toBe('Phase 1');
    expect(notify.warning).toHaveBeenCalledWith(
      'Please correct the highlighted fields on the Phase 1 tab.',
    );

    await type('ph-contact', '831234567');
    await type('ph-surname', 'Lee');
    await leave();
    expect(savedPhase()).toMatchObject({ SurName: 'Lee', RemoveContactNumber: '+27831234567' });
    expect(notify.success).not.toHaveBeenCalled();
    await openTab('Caller');
    expect(api.savePhase).toHaveBeenCalledTimes(1);
  });

  it('records that the transport operator was notified', async () => {
    await show(avs({ CasePhaseDetails: [phase1()] }));
    await openTab('Phase 1');
    await press('Notify');
    expect(savedPhase()).toEqual({
      ...phase1(),
      CollectFrom: 'Ward 5',
      UpliftFamily: 'No',
      IsTransportNotified: true,
    });
    expect(element<HTMLButtonElement>('.ph-action button').textContent?.trim()).toBe('Notified');
    expect(element<HTMLButtonElement>('.ph-action button').disabled).toBe(true);
  });

  it('adds the next phase once the open one has its provider', async () => {
    await show(avs());
    expect(addButton().disabled).toBe(false);
    await press('+');
    expect(api.createPhase).toHaveBeenCalledWith(4, 'phase1', 'Ward 5');
    expect(selectedTab()).toBe('Phase 1');

    expect(addButton().disabled).toBe(true);
    await choose('ph-collect-provider', 'AVBOB');
    await choose('ph-remove-provider', 'Doves');
    expect(addButton().disabled).toBe(false);
    api.createPhase.mockReturnValueOnce(
      of(casePhase({ CasePhaseDetailsId: 71, CaseDetailId: 4, PhaseName: 'phase2' })),
    );
    await press('+');
    expect(savedPhase()).toMatchObject({ CasePhaseDetailsId: 70, RemoveServiceProviderId: 2 });
    expect(api.createPhase).toHaveBeenLastCalledWith(4, 'phase2', '2 Cold Store');
    expect(selectedTab()).toBe('Phase 2');
    expect(value('ph-collect-from')).toBe('2 Cold Store');
  });

  it('saves the Transport Operator Check List with its phase', async () => {
    await show(
      avs({
        CasePhaseDetails: [
          phase1({ CollectTelephone: '+27821234567', FirstName: 'Ann', SurName: 'Lee' }),
        ],
      }),
    );
    await openTab('Phase 1');
    await press('Transport Operator CheckList');
    expect(value('tc-family-name')).toBe('Ann Lee');
    await answer('Have the mortuary fees been paid?', 'Yes');
    await answer('The deceased will be transported in', 'Casket');
    await type('tc-pickup', '09:30');
    await press('Save');

    const [phase, transport] = api.savePhase.mock.calls[0] ?? [];
    expect(phase).toMatchObject({ CasePhaseDetailsId: 61, Cost: 1500 });
    expect(transport).toMatchObject({
      CaseTransportDetailsId: 0,
      CaseDetailId: 4,
      CasePhaseDetailsId: 61,
      IsMortuaryFeesPaid: true,
      DeceasedTransportMethod: 'casket',
      PickupTime: '09:30:00',
      FromOfficeTelephone: '+27821234567',
      Name: 'Ann Lee',
    });
    expect(text()).not.toContain('Transport Operator Check List');
  });

  it('only shows a case someone else has open', async () => {
    await show({
      ...avs({ CasePhaseDetails: [phase1({ CaseTransportDetails: caseTransport() })] }),
      CaseOpenedBy: 'carl@x.com',
    });
    await openTab('Phase 1');
    expect(disabled('ph-collect-provider')).toBe(true);
    expect(addButton().disabled).toBe(true);
    await press('Transport Operator CheckList');
    expect(disabled('tc-family-name')).toBe(true);
    expect(
      [...document.querySelectorAll('button')].some((b) => b.textContent?.trim() === 'Save'),
    ).toBe(false);
  });
});
