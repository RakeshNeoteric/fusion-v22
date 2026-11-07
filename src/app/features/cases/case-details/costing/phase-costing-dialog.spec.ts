import { of } from 'rxjs';
import type { CaseDetails, CasePhaseRecord } from '@api/cases/case.api';
import type { TransportOperator } from '@api/config/transport-operator.api';
import type { Vehicle } from '@api/config/vehicle.api';
import {
  casePhase,
  clientWithProviders,
  serviceProvider,
} from '../../../../../testing/case.fixtures';
import { caseTabHarness, held } from '../tabs/testing/case-tab-harness';
import { dispatchedMoment, dispatchedParts } from './transport-dialog';

/** Today as the popup stores it. */
function today(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** A Groceries (AVS) case, which has phases, with Phase 1 collected by `providerId`. */
const avs = (phase: Partial<CasePhaseRecord> = {}, extra: Partial<CaseDetails> = {}) =>
  held({
    CaseClientServiceId: 6,
    CasePhaseDetails: [
      casePhase({
        CasePhaseDetailsId: 61,
        CaseDetailId: 4,
        PhaseName: 'phase1',
        CollectServiceProviderId: 1,
        ManagerName: 'Manager 1',
        FirstName: 'Ann',
        ...phase,
      }),
    ],
    ...extra,
  });

describe('Phase Costing', () => {
  const {
    api,
    clients,
    vehicles,
    operators,
    notify,
    show,
    settle,
    element,
    type,
    choose,
    press,
    value,
    disabled,
    text,
  } = caseTabHarness();

  const open = async () => {
    element<HTMLButtonElement>('button[aria-label="Phase Costing"]').click();
    await settle();
    await settle();
  };
  const savedPhase = (call = 0) => api.savePhase.mock.calls[call]?.[0] as CasePhaseRecord;

  beforeEach(() => {
    clients.get.mockReturnValue(
      of(
        clientWithProviders(
          serviceProvider(1, 'AVBOB', { RatePerKm: 12.5 }),
          serviceProvider(2, 'Own Fleet', { IsInternalServiceProvider: true, RatePerKm: 8 }),
        ),
      ),
    );
  });

  it('costs an external phase by rate per km and saves it on Close', async () => {
    await show(avs());
    await open();
    expect(text()).toContain('Phase: 1 – AVBOB');
    expect(value('pc-1-via')).toBe('Groceries');
    expect(disabled('pc-1-fixed')).toBe(true);
    expect(value('pc-1-rate')).toBe('12.5');
    await type('pc-1-km', '10');
    await type('pc-1-additional', '5.25');
    expect(value('pc-1-total')).toBe('130.25');
    expect(value('pc-sub-total')).toBe('0.00');

    await press('Close');
    expect(savedPhase()).toEqual({
      ...avs().CasePhaseDetails?.[0],
      RatePerKm: 12.5,
      TotalKm: 10,
      AdditionalCost: 5.25,
    });
    expect(notify.success).toHaveBeenCalledWith('Phase costing saved.');
    expect(document.querySelector('app-phase-costing-dialog')).toBeNull();
  });

  it('authorises a phase, which then counts and is saved with the case totals', async () => {
    await show(avs({ Cost: 0, TotalKm: 4 }));
    await open();
    await press('Authorise');
    expect(text()).toContain('Authorised Number is required.');
    expect(api.savePhase).not.toHaveBeenCalled();

    await type('pc-1-number', ' AUTH-9 ');
    await press('Authorise');
    expect(savedPhase()).toMatchObject({
      RatePerKm: 12.5,
      TotalKm: 4,
      AuthorisedDate: today(),
      AuthorisedByUserId: 7,
      AuthorisedByNumber: 'AUTH-9',
    });
    // The whole case goes back with the totals (v21 sent part of it, wiping the rest).
    expect(api.update).toHaveBeenCalledWith(
      expect.objectContaining({ CaseOpenedBy: 'jane@example.com' }),
      { PhaseTotal: 50, AdditionalCostTotal: 0, TotalCost: 50 },
    );
    expect(value('pc-sub-total')).toBe('50.00');
    expect(disabled('pc-1-km')).toBe(true);
    expect(text()).toContain('Authorised');
  });

  it('records transport for an internal provider, which gives the distance', async () => {
    vehicles.listIncludingDeleted.mockReturnValue(
      of([
        { VehicleId: 3, RegNumber: 'CA 123', IsActive: true, IsDeleted: false },
        { VehicleId: 4, RegNumber: 'OLD 1', IsActive: false, IsDeleted: false },
      ] as Vehicle[]),
    );
    operators.listIncludingDeleted.mockReturnValue(
      of([
        { TransportOperatorId: 5, Name: 'Sipho', IsActive: true, IsDeleted: false },
      ] as TransportOperator[]),
    );
    await show(avs({ CollectServiceProviderId: 2 }));
    await open();
    expect(disabled('pc-1-fixed')).toBe(false);
    expect(disabled('pc-1-km')).toBe(true);
    expect(value('pc-1-rate')).toBe('8');
    await type('pc-1-fixed', '900');

    await press('Transport');
    expect(
      [...element<HTMLSelectElement>('#tr-vehicle').options].map((o) => o.text.trim()),
    ).toEqual(['Select Vehicle', 'CA 123']);
    await press('Save');
    expect(text()).toContain('Vehicle is required.');
    await choose('tr-vehicle', 'CA 123');
    await choose('tr-operator', 'Sipho');
    await type('tr-date', '2026-11-05');
    await type('tr-time', '10:00');
    await type('tr-km', '20');
    await press('Save');

    expect(savedPhase()).toMatchObject({
      Cost: 900,
      VehicleId: 3,
      TransportOperatorId: 5,
      IsTransportNotified: false,
      VehicleDispatched: dispatchedMoment('2026-11-05', '10:00'),
      TotalKm: 20,
    });
    expect(value('pc-1-km')).toBe('20');
    expect(text()).toContain('Phase: 1 – Own Fleet – CA 123 – Sipho');
  });

  it('only shows the costs of a case someone else has open', async () => {
    await show({ ...avs(), CaseOpenedBy: 'carl@x.com' });
    await open();
    expect(disabled('pc-1-km')).toBe(true);
    expect(disabled('pc-1-number')).toBe(true);
    expect(element<HTMLButtonElement>('.pc-actions button').disabled).toBe(true);
    await press('Close');
    expect(api.savePhase).not.toHaveBeenCalled();
  });

  it('is only offered on services with phases', async () => {
    await show(held());
    expect(document.querySelector('button[aria-label="Phase Costing"]')).toBeNull();
    expect(document.querySelector('button[aria-label="Additional Cost"]')).toBeNull();
  });
});

describe('vehicle dispatch time', () => {
  it('is stored as UTC and shown in local time', () => {
    const stored = dispatchedMoment('2026-11-05', '10:30');
    expect(stored).toMatch(/Z$/);
    expect(dispatchedParts(stored?.replace(/\.\d+Z$/, '') ?? null)).toEqual({
      date: '2026-11-05',
      time: '10:30',
    });
    expect(dispatchedParts(null)).toEqual({ date: '', time: '' });
    expect(dispatchedMoment('', '10:00')).toBeNull();
  });
});
