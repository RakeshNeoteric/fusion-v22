import type { CaseAdditionalCostRecord } from '@api/cases/case.api';
import { caseDetails, casePhase } from '../../../../../testing/case.fixtures';
import { activePhases, caseTotals, money, phaseTotal, round2 } from './costing-rules';

const cost = (amount: number, extra: Partial<CaseAdditionalCostRecord> = {}) =>
  ({
    CaseAdditionalCostId: 1,
    Amount: amount,
    IsDeleted: false,
    ...extra,
  }) as CaseAdditionalCostRecord;

describe('costing rules', () => {
  it('totals a phase to the cent', () => {
    expect(
      phaseTotal({ fixedCost: 100, ratePerKm: 12.5, totalKm: 25.5, additionalCost: 0.1 }),
    ).toBe(418.85);
    expect(
      phaseTotal({ fixedCost: null, ratePerKm: null, totalKm: 10, additionalCost: null }),
    ).toBe(0);
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });

  it('lists active phases in order', () => {
    const details = caseDetails({
      CasePhaseDetails: [
        casePhase({ CasePhaseDetailsId: 2, PhaseName: 'phase2' }),
        casePhase({ CasePhaseDetailsId: 1, PhaseName: 'phase1' }),
        casePhase({ CasePhaseDetailsId: 3, PhaseName: 'phase3', IsActive: false }),
      ],
    });
    expect(activePhases(details).map((phase) => phase.CasePhaseDetailsId)).toEqual([1, 2]);
  });

  it('counts authorised phases and additional costs not deleted', () => {
    const details = caseDetails({
      CasePhaseDetails: [
        casePhase({ PhaseName: 'phase1', Cost: 1000, AuthorisedDate: '2026-11-01T00:00:00' }),
        casePhase({
          CasePhaseDetailsId: 61,
          PhaseName: 'phase2',
          RatePerKm: 10,
          TotalKm: 5,
          AuthorisedByUserId: 7,
        }),
        casePhase({ CasePhaseDetailsId: 62, PhaseName: 'phase3', Cost: 999 }),
      ],
      CaseAdditionalCosts: [cost(200.1), cost(0.2), cost(500, { IsDeleted: true })],
    });
    expect(caseTotals(details)).toEqual({
      PhaseTotal: 1050,
      AdditionalCostTotal: 200.3,
      TotalCost: 1250.3,
    });
  });

  it('shows money like v21', () => {
    expect(money(1234.5)).toBe('1,234.50');
    expect(money(null)).toBe('0.00');
  });
});
