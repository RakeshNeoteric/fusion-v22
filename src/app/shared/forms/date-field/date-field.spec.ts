import { ApplicationRef, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { typeDate } from '../../../../testing/form-controls';
import { DateField } from './date-field';

@Component({
  imports: [ReactiveFormsModule, DateField],
  template: `
    <label for="birth">Date of Birth</label>
    <app-date-field inputId="birth" max="2026-11-07" [formControl]="control" />
  `,
})
class Host {
  readonly control = new FormControl('2026-01-02', { nonNullable: true });
}

describe('DateField', () => {
  async function render() {
    TestBed.configureTestingModule({
      providers: [{ provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } }],
    });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const box = element.querySelector<HTMLInputElement>('#birth');
    if (!box) throw new Error('no date box');
    return { fixture, control: fixture.componentInstance.control, box, element };
  }

  it('shows the stored date as DD/MM/YYYY, labelled by the field’s label', async () => {
    const { box, element } = await render();
    expect(box.value).toBe('02/01/2026');
    expect(box.placeholder).toBe('DD/MM/YYYY');
    expect(element.querySelector('label')?.getAttribute('for')).toBe(box.id);
  });

  it('keeps yyyy-mm-dd in the form when a date is typed', async () => {
    const { box, control } = await render();
    await typeDate(box, '15/03/2026');
    expect(control.value).toBe('2026-03-15');
    expect(control.valid).toBe(true);
    expect(control.touched).toBe(true);
  });

  it('shows a date the form sets later', async () => {
    const { fixture, box, control } = await render();
    control.setValue('2026-07-04');
    await fixture.whenStable();
    expect(box.value).toBe('04/07/2026');
  });

  it('empties the form value when the box is cleared', async () => {
    const { box, control } = await render();
    await typeDate(box, '');
    expect(control.value).toBe('');
    expect(control.valid).toBe(true);
  });

  it('reports text that is not a date', async () => {
    const { box, control } = await render();
    await typeDate(box, '31/02/2026');
    expect(control.value).toBe('');
    expect(control.hasError('date')).toBe(true);
  });

  it('opens Material’s calendar from its button', async () => {
    const { element } = await render();
    element.querySelector<HTMLButtonElement>('mat-datepicker-toggle button')?.click();
    await TestBed.inject(ApplicationRef).whenStable();
    expect(document.querySelector('mat-calendar')).not.toBeNull();
    document.querySelector<HTMLElement>('.cdk-overlay-backdrop')?.click();
  });

  it('follows the form when disabled', async () => {
    const { fixture, box, control, element } = await render();
    control.disable();
    await fixture.whenStable();
    expect(box.disabled).toBe(true);
    expect(element.querySelector<HTMLButtonElement>('mat-datepicker-toggle button')?.disabled).toBe(
      true,
    );
  });
});
