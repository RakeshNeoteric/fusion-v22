import type { AbstractControl, ValidationErrors } from '@angular/forms';

/** Like `Validators.required`, but spaces alone do not count (v21 trims before saving). */
export function requiredText(control: AbstractControl<unknown>): ValidationErrors | null {
  const value = control.value;
  if (value === null || value === undefined) return { required: true };
  return typeof value === 'string' && !value.trim() ? { required: true } : null;
}

/** v21 email rule (its "southAfricaEmail" validator): name@domain.tld. */
export const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
