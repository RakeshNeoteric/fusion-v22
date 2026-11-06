import type { AbstractControl, ValidationErrors } from '@angular/forms';

/** Why a South African ID number is not valid, or null when it is (or is empty). */
export type SaIdProblem = 'digits13' | 'birthDate' | 'checksum';

/**
 * Checks a South African ID number (v21): 13 digits, starting with a real date of birth
 * (YYMMDD), ending with a Luhn check digit.
 */
export function saIdProblem(value: string | null | undefined): SaIdProblem | null {
  const id = (value ?? '').trim();
  if (!id) return null;
  if (!/^\d{13}$/.test(id)) return 'digits13';
  if (!birthDateFromSaId(id)) return 'birthDate';
  return luhnValid(id) ? null : 'checksum';
}

/** Form validator: `{ saId: 'digits13' | 'birthDate' | 'checksum' }`. */
export function saIdValidator(control: AbstractControl<string | null>): ValidationErrors | null {
  const problem = saIdProblem(control.value);
  return problem ? { saId: problem } : null;
}

/** The message v21 showed for each problem. */
export const SA_ID_MESSAGES: Readonly<Record<SaIdProblem, string>> = {
  digits13: 'ID must be exactly 13 digits.',
  birthDate: 'Invalid date in ID number.',
  checksum: 'Invalid South African ID checksum.',
};

/**
 * The date of birth in a South African ID number, `yyyy-MM-dd`; '' when it is not one. The
 * century is 20xx unless that would be in the future (v21).
 */
export function birthDateFromSaId(value: string | null | undefined, today = new Date()): string {
  const id = (value ?? '').trim();
  if (!/^\d{13}$/.test(id)) return '';
  const yy = Number(id.slice(0, 2));
  const month = Number(id.slice(2, 4));
  const day = Number(id.slice(4, 6));
  for (const year of [2000 + yy, 1900 + yy]) {
    const date = new Date(year, month - 1, day);
    const real =
      date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
    if (!real) return '';
    if (date <= today) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return '';
}

function luhnValid(id: string): boolean {
  let sum = 0;
  for (let index = 0; index < 13; index++) {
    let digit = Number(id[12 - index]);
    if (index % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}
