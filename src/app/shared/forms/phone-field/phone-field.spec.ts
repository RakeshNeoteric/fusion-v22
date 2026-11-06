import { Component } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { PhoneField } from './phone-field';

@Component({
  imports: [ReactiveFormsModule, PhoneField],
  template: `<app-phone-field label="Telephone" [formControl]="phone" />`,
})
class Host {
  readonly phone = new FormControl('', { nonNullable: true });
}

describe('PhoneField', () => {
  let fixture: ComponentFixture<Host>;
  let phone: FormControl<string>;

  async function render(initial: string): Promise<void> {
    fixture = TestBed.createComponent(Host);
    phone = fixture.componentInstance.phone;
    phone.setValue(initial);
    await fixture.whenStable();
  }

  function numberInput(): HTMLInputElement {
    return (fixture.nativeElement as HTMLElement).querySelector('input[type="tel"]')!;
  }

  function countrySelect(): HTMLSelectElement {
    return (fixture.nativeElement as HTMLElement).querySelector('select')!;
  }

  async function type(text: string): Promise<void> {
    numberInput().value = text;
    numberInput().dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  async function chooseCountry(code: string): Promise<void> {
    countrySelect().value = code;
    countrySelect().dispatchEvent(new Event('change'));
    await fixture.whenStable();
  }

  it('shows a stored number in national form with its country', async () => {
    await render('+919876543210');
    expect(countrySelect().value).toBe('IN');
    expect(numberInput().value.replace(/\D/g, '')).toContain('9876543210');
  });

  it('starts on South Africa, with South Africa and India listed first (v21)', async () => {
    await render('');
    const options = [...countrySelect().options].map((option) => option.value);
    expect(countrySelect().value).toBe('ZA');
    expect(options.slice(0, 2)).toEqual(['ZA', 'IN']);
  });

  it('gives the form E.164, as v21 sends it', async () => {
    await render('');
    await type('082 123 4567');
    expect(phone.value).toBe('+27821234567');
    expect(phone.valid).toBe(true);
  });

  it('uses the chosen country', async () => {
    await render('');
    await chooseCountry('GB');
    await type('020 7946 0958');
    expect(phone.value).toBe('+442079460958');
  });

  it('marks a typed number that is not valid', async () => {
    await render('');
    await type('082 12');
    expect(phone.hasError('phone')).toBe(true);
  });

  it('allows clearing the number', async () => {
    await render('+27821234567');
    await type('');
    expect(phone.value).toBe('');
    expect(phone.valid).toBe(true);
  });

  it('keeps an old stored number that is not valid, without blocking the form', async () => {
    await render('12345');
    expect(numberInput().value).toBe('12345');
    expect(phone.valid).toBe(true);
  });

  it('is disabled with its control', async () => {
    await render('');
    phone.disable();
    await fixture.whenStable();
    expect(numberInput().disabled).toBe(true);
    expect(countrySelect().disabled).toBe(true);
  });
});
