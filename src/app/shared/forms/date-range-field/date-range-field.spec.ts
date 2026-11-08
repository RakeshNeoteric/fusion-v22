import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { typeText } from '../../../../testing/form-controls';
import {
  type DateRange,
  DateRangeField,
  NO_DATE_RANGE,
  periodInOrder,
  periodRequired,
} from './date-range-field';

@Component({
  imports: [ReactiveFormsModule, DateRangeField],
  template: `
    <label for="period">Date Range</label>
    <app-date-range-field inputId="period" [formControl]="control" />
  `,
})
class Host {
  readonly control = new FormControl<DateRange>(
    { from: '2026-10-01', to: '2026-10-31' },
    { nonNullable: true, validators: [periodRequired, periodInOrder] },
  );
}

describe('DateRangeField', () => {
  async function render() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const [first, last] = [...element.querySelectorAll<HTMLInputElement>('input')];
    if (!first || !last) throw new Error('no day boxes');
    return { fixture, control: fixture.componentInstance.control, first, last, element };
  }

  it('shows both days as DD/MM/YYYY, the first box named by the field’s label', async () => {
    const { first, last, element } = await render();
    expect([first.value, last.value]).toEqual(['01/10/2026', '31/10/2026']);
    expect(first.placeholder).toBe('DD/MM/YYYY');
    expect(element.querySelector('label')?.getAttribute('for')).toBe(first.id);
    expect(element.querySelector('mat-datepicker-toggle')).not.toBeNull();
  });

  it('keeps yyyy-mm-dd days in the form when they are typed', async () => {
    const { first, last, control } = await render();
    await typeText(first, '05/10/2026');
    await typeText(last, '20/10/2026');
    expect(control.value).toEqual({ from: '2026-10-05', to: '2026-10-20' });
    expect(control.valid).toBe(true);
    expect(control.touched).toBe(true);
  });

  it('shows a period the form sets later', async () => {
    const { fixture, first, last, control } = await render();
    control.setValue({ from: '2026-01-02', to: '2026-02-03' });
    await fixture.whenStable();
    expect([first.value, last.value]).toEqual(['02/01/2026', '03/02/2026']);
  });

  it('reports text that is not a date, until it is fixed', async () => {
    const { last, control } = await render();
    await typeText(last, 'tomorrow');
    expect(control.value.to).toBe('');
    expect(control.hasError('date')).toBe(true);
    await typeText(last, '30/10/2026');
    expect(control.hasError('date')).toBe(false);
    expect(control.value.to).toBe('2026-10-30');
  });

  it('reports a missing day and a last day before the first', async () => {
    const { first, last, control } = await render();
    await typeText(last, '');
    expect(control.hasError('periodRequired')).toBe(true);
    await typeText(last, '01/09/2026');
    expect(control.hasError('period')).toBe(true);
    await typeText(first, '01/08/2026');
    expect(control.valid).toBe(true);
  });

  it('is disabled with its form control', async () => {
    const { fixture, first, last, element, control } = await render();
    control.disable();
    await fixture.whenStable();
    expect(first.disabled).toBe(true);
    expect(last.disabled).toBe(true);
    expect(element.querySelector('app-date-range-field')?.classList).toContain(
      'date-range-field--disabled',
    );
  });
});

describe('period validators', () => {
  const check = (value: DateRange) => new FormControl(value);

  it('periodRequired needs both days', () => {
    expect(periodRequired(check(NO_DATE_RANGE))).toEqual({ periodRequired: true });
    expect(periodRequired(check({ from: '2026-10-01', to: '' }))).toEqual({
      periodRequired: true,
    });
    expect(periodRequired(check({ from: '2026-10-01', to: '2026-10-01' }))).toBeNull();
  });

  it('periodInOrder allows one day and refuses a last day before the first', () => {
    expect(periodInOrder(check({ from: '2026-10-01', to: '2026-10-01' }))).toBeNull();
    expect(periodInOrder(check({ from: '2026-10-02', to: '2026-10-01' }))).toEqual({
      period: true,
    });
    expect(periodInOrder(check({ from: '', to: '2026-10-01' }))).toBeNull();
  });
});
