import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';

/**
 * Types into a text box (an `<app-date-field>`'s, `<app-time-field>`'s, …) and leaves it, as a
 * user would: input, change, then blur.
 */
export async function typeText(box: HTMLInputElement | string, text: string): Promise<void> {
  const input = typeof box === 'string' ? document.querySelector<HTMLInputElement>(box) : box;
  if (!input) throw new Error(`no box ${String(box)}`);
  input.value = text;
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('change'));
  input.dispatchEvent(new Event('blur'));
  await TestBed.inject(ApplicationRef).whenStable();
}

/** Types a date (DD/MM/YYYY like the screen, or `yyyy-mm-dd`) into an `<app-date-field>`. */
export const typeDate = typeText;

/** An `<app-select>` by its `inputId`. */
function dropdown(id: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
  if (found?.tagName !== 'MAT-SELECT') throw new Error(`no dropdown #${id}`);
  return found;
}

async function settle(): Promise<void> {
  await TestBed.inject(ApplicationRef).whenStable();
}

/** The choices in an `<app-select>`'s open list. */
function openOptions(id: string): HTMLElement[] {
  return [
    ...document.querySelectorAll<HTMLElement>(`#${CSS.escape(`${id}-panel`)} .mat-mdc-option`),
  ];
}

/** Opens an `<app-select>`'s list, as a click on it does. */
export async function openDropdown(id: string): Promise<void> {
  dropdown(id).querySelector<HTMLElement>('.mat-mdc-select-trigger')?.click();
  await settle();
}

/** Closes an open list without choosing, as a click outside it does. */
export async function closeDropdown(): Promise<void> {
  // A dropdown's backdrop is transparent, unlike the popups' (which a click would close).
  const backdrops = document.querySelectorAll<HTMLElement>('.cdk-overlay-transparent-backdrop');
  backdrops[backdrops.length - 1]?.click();
  await settle();
}

/** Picks a choice in an `<app-select>` by its text, as a user would. */
export async function chooseOption(id: string, label: string): Promise<void> {
  await openDropdown(id);
  const option = openOptions(id).find((candidate) => candidate.textContent?.trim() === label);
  if (!option) {
    const offered = openOptions(id).map((candidate) => candidate.textContent?.trim());
    await closeDropdown();
    throw new Error(`#${id} has no "${label}" (offers ${offered.join(', ')})`);
  }
  option.click();
  await settle();
}

/** The texts an `<app-select>` offers (the "nothing" choice included, with `allowNone`). */
export async function dropdownOptions(id: string): Promise<string[]> {
  await openDropdown(id);
  const labels = openOptions(id).map((option) => option.textContent?.trim() ?? '');
  await closeDropdown();
  return labels;
}

/** What an `<app-select>` shows: the chosen choice, or its placeholder. */
export function dropdownText(id: string): string {
  return dropdown(id).querySelector('.mat-mdc-select-value')?.textContent?.trim() ?? '';
}

export function dropdownDisabled(id: string): boolean {
  return dropdown(id).getAttribute('aria-disabled') === 'true';
}
