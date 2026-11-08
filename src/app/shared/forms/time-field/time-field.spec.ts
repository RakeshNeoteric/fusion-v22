import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { typeText } from '../../../../testing/form-controls';
import { TimeField } from './time-field';

@Component({
  imports: [ReactiveFormsModule, TimeField],
  template: `
    <label for="pickup">Pickup Time</label>
    <app-time-field inputId="pickup" [formControl]="control" />
  `,
})
class Host {
  readonly control = new FormControl('09:05', { nonNullable: true });
}

describe('TimeField', () => {
  async function render() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const box = element.querySelector<HTMLInputElement>('#pickup');
    if (!box) throw new Error('no time box');
    return { fixture, control: fixture.componentInstance.control, box, element };
  }

  function listedTimes(): string[] {
    return [...document.querySelectorAll('.mat-timepicker-panel .mat-mdc-option')].map(
      (option) => option.textContent?.trim() ?? '',
    );
  }

  it('shows the stored time on the 24-hour clock, labelled by the field’s label', async () => {
    const { box, element } = await render();
    expect(box.value).toBe('09:05');
    expect(box.placeholder).toBe('HH:MM');
    expect(element.querySelector('label')?.getAttribute('for')).toBe(box.id);
  });

  it('keeps HH:mm in the form when a time is typed, either clock', async () => {
    const { box, control } = await render();
    await typeText(box, '14:30');
    expect(control.value).toBe('14:30');
    await typeText(box, '2:45 pm');
    expect(control.value).toBe('14:45');
    expect(control.valid).toBe(true);
    expect(control.touched).toBe(true);
  });

  it('shows a time the form sets later, and empties with the box', async () => {
    const { fixture, box, control } = await render();
    control.setValue('18:00');
    await fixture.whenStable();
    expect(box.value).toBe('18:00');
    await typeText(box, '');
    expect(control.value).toBe('');
    expect(control.valid).toBe(true);
  });

  it('reports text that is not a time', async () => {
    const { box, control } = await render();
    await typeText(box, 'soon');
    expect(control.value).toBe('');
    expect(control.hasError('time')).toBe(true);
  });

  it('offers the day in quarter hours from its button, and a picked time goes to the form', async () => {
    const { fixture, element, control } = await render();
    element.querySelector<HTMLButtonElement>('mat-timepicker-toggle button')?.click();
    await fixture.whenStable();
    const times = listedTimes();
    expect(times).toHaveLength(96);
    expect(times.slice(0, 3)).toEqual(['00:00', '00:15', '00:30']);

    [...document.querySelectorAll<HTMLElement>('.mat-timepicker-panel .mat-mdc-option')]
      .find((option) => option.textContent?.trim() === '10:30')
      ?.click();
    await fixture.whenStable();
    expect(control.value).toBe('10:30');
  });

  it('is disabled with its form control', async () => {
    const { fixture, box, control } = await render();
    control.disable();
    await fixture.whenStable();
    expect(box.disabled).toBe(true);
  });
});
