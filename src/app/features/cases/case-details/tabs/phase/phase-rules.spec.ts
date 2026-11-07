import type { CasePhaseRecord } from '@api/cases/case.api';
import { caseDeceased, caseDetails, casePhase } from '../../../../../../testing/case.fixtures';
import { collectFromFor, nextPhase, phaseRecord } from './phase-rules';

describe('phase rules', () => {
  const phases = (...rows: CasePhaseRecord[]) => caseDetails({ CasePhaseDetails: rows });

  it('finds the newest row of a phase, whatever the case of its name', () => {
    const details = phases(
      casePhase({ CasePhaseDetailsId: 1, PhaseName: 'Phase1' }),
      casePhase({ CasePhaseDetailsId: 5, PhaseName: 'phase1' }),
    );
    expect(phaseRecord(details, 'phase1')?.CasePhaseDetailsId).toBe(5);
    expect(phaseRecord(details, 'phase2')).toBeNull();
  });

  it('collects phase 1 from the body location, later phases from where the last one went', () => {
    const details = caseDetails({
      CaseDeceasedInfo: caseDeceased({ BodyLocation: ' Ward 5 ' }),
      CasePhaseDetails: [casePhase({ PhaseName: 'phase1', RemoveToStorageAddress: '1 Cold St' })],
    });
    expect(collectFromFor(details, 'phase1')).toBe('Ward 5');
    expect(collectFromFor(details, 'phase2')).toBe('1 Cold St');
    expect(collectFromFor(details, 'phase3')).toBe('');
  });

  it('adds the first missing phase the service type allows', () => {
    const allowed = ['caller', 'phase1', 'phase2', 'phase3'] as const;
    expect(nextPhase(phases(), allowed)).toBe('phase1');
    expect(
      nextPhase(
        phases(casePhase({ PhaseName: 'phase1' }), casePhase({ PhaseName: 'phase3' })),
        allowed,
      ),
    ).toBe('phase2');
    expect(
      nextPhase(
        phases(
          casePhase({ PhaseName: 'phase1' }),
          casePhase({ PhaseName: 'phase2' }),
          casePhase({ PhaseName: 'phase3' }),
        ),
        allowed,
      ),
    ).toBeNull();
    expect(nextPhase(phases(), ['caller'])).toBeNull();
  });
});
