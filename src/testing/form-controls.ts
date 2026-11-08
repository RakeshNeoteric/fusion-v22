import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';

/**
 * Types a date into an `<app-date-field>`'s box and leaves it, as a user would. DD/MM/YYYY like
 * the screen, or `yyyy-mm-dd`.
 */
export async function typeDate(box: HTMLInputElement | string, text: string): Promise<void> {
  const input = typeof box === 'string' ? document.querySelector<HTMLInputElement>(box) : box;
  if (!input) throw new Error(`no date box ${String(box)}`);
  input.value = text;
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('change'));
  input.dispatchEvent(new Event('blur'));
  await TestBed.inject(ApplicationRef).whenStable();
}
