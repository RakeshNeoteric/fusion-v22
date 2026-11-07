import type { CaseDetails, CasePhaseRecord } from '@api/cases/case.api';
import { PHASES } from '../../case-setup';
import { phaseRecord } from '../tabs/phase/phase-rules';

/** Money and distances to the cent, as the database keeps them (v21 showed raw floats). */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** What one phase costs (v21): fixed cost + rate per km × km + additional cost. */
export interface PhaseCost {
  readonly fixedCost: number | null;
  readonly ratePerKm: number | null;
  readonly totalKm: number | null;
  readonly additionalCost: number | null;
}

export function phaseTotal(cost: PhaseCost): number {
  const { fixedCost, ratePerKm, totalKm, additionalCost } = cost;
  return round2((fixedCost ?? 0) + (ratePerKm ?? 0) * (totalKm ?? 0) + (additionalCost ?? 0));
}

export function savedPhaseCost(phase: CasePhaseRecord): PhaseCost {
  return {
    fixedCost: phase.Cost,
    ratePerKm: phase.RatePerKm,
    totalKm: phase.TotalKm,
    additionalCost: phase.AdditionalCost,
  };
}

/** Only authorised phases count towards the case's costs (v21). */
export function isAuthorised(phase: CasePhaseRecord): boolean {
  return !!phase.AuthorisedDate || !!phase.AuthorisedByUserId;
}

/** The case's active phases, Phase 1 first. */
export function activePhases(details: CaseDetails): CasePhaseRecord[] {
  return PHASES.map((key) => phaseRecord(details, key)).filter(
    (phase): phase is CasePhaseRecord => !!phase && phase.IsActive,
  );
}

export interface CaseTotals {
  readonly PhaseTotal: number;
  readonly AdditionalCostTotal: number;
  readonly TotalCost: number;
}

/** The case's costs: authorised phases as saved, and the additional costs not deleted. */
export function caseTotals(details: CaseDetails): CaseTotals {
  const phases = round2(
    activePhases(details)
      .filter(isAuthorised)
      .reduce((sum, phase) => sum + phaseTotal(savedPhaseCost(phase)), 0),
  );
  const additional = round2(
    (details.CaseAdditionalCosts ?? [])
      .filter((cost) => cost.IsDeleted !== true)
      .reduce((sum, cost) => sum + (Number(cost.Amount) || 0), 0),
  );
  return {
    PhaseTotal: phases,
    AdditionalCostTotal: additional,
    TotalCost: round2(phases + additional),
  };
}

/** `1234.5` → `1,234.50` (v21 grid format). */
export function money(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
