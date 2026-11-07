import type { CaseDetails, CasePhaseRecord } from '@api/cases/case.api';
import { type CaseTabKey, PHASES, type PhaseKey, isPhaseKey } from '../../../case-setup';

/** The case's row for the phase tab (the newest, should there be more than one). */
export function phaseRecord(details: CaseDetails, phase: PhaseKey): CasePhaseRecord | null {
  return (details.CasePhaseDetails ?? [])
    .filter((row) => row.PhaseName.trim().toLowerCase() === phase)
    .reduce<CasePhaseRecord | null>(
      (newest, row) =>
        !newest || row.CasePhaseDetailsId > newest.CasePhaseDetailsId ? row : newest,
      null,
    );
}

/**
 * Where the phase collects the deceased from (v21): phase 1 from the body location on Deceased
 * Info, a later phase from where the phase before it removed them to. '' when not known yet.
 */
export function collectFromFor(details: CaseDetails, phase: PhaseKey): string {
  const index = PHASES.indexOf(phase);
  if (index === 0) return details.CaseDeceasedInfo?.BodyLocation?.trim() ?? '';
  const previous = PHASES[index - 1];
  return (previous && phaseRecord(details, previous)?.RemoveToStorageAddress?.trim()) ?? '';
}

/**
 * The phase "+" adds: the first the case does not have, within the number its service type
 * allows; null when it has them all. (v21 counted rows, so a gap gave two phases one name.)
 */
export function nextPhase(details: CaseDetails, allowed: readonly CaseTabKey[]): PhaseKey | null {
  const cap = allowed.filter(isPhaseKey).length;
  return PHASES.slice(0, cap).find((phase) => !phaseRecord(details, phase)) ?? null;
}
