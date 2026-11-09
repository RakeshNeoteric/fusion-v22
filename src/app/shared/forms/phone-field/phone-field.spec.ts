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

  function countryButton(): HTMLButtonElement {
    return (fixture.nativeElement as HTMLElement).querySelector('button.phone-country')!;
  }

  /** The open country list (CDK overlay, outside the component). */
  function listedCountries(): string[] {
    return [...document.querySelectorAll('.phone-option')].map(
      (option) => option.getAttribute('data-country') ?? '',
    );
  }

  async function openList(): Promise<void> {
    countryButton().click();
    await fixture.whenStable();
  }

  async function search(text: string): Promise<void> {
    const box = document.querySelector<HTMLInputElement>('.phone-search')!;
    box.value = text;
    box.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  async function type(text: string): Promise<void> {
    numberInput().value = text;
    numberInput().dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  async function chooseCountry(code: string): Promise<void> {
    await openList();
    document.querySelector<HTMLElement>(`.phone-option[data-country="${code}"]`)!.click();
    await fixture.whenStable();
  }

  afterEach(() => {
    // Close a list a test left open, so it does not leak into the next test.
    document
      .querySelector('.phone-search')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });

  it('shows a stored number in national form with its country', async () => {
    await render('+919876543210');
    expect(countryButton().dataset['country']).toBe('IN');
    expect(countryButton().textContent).toContain('+91');
    expect(numberInput().value.replace(/\D/g, '')).toContain('9876543210');
  });

  it('starts on South Africa, showing its flag and +27', async () => {
    await render('');
    expect(countryButton().textContent).toContain('+27');
    expect(countryButton().querySelector('img')?.getAttribute('src')).toBe('flags/za.svg');
  });

  it('shows an example number for the chosen country after its dial code (v21)', async () => {
    await render('');
    expect(numberInput().placeholder).toBe('71 123 4567');
    await chooseCountry('IN');
    expect(numberInput().placeholder).toMatch(/^\d[\d ]+\d$/);
    expect(numberInput().placeholder).not.toContain('+');
  });

  it('lists South Africa and India first, each with its flag (v21)', async () => {
    await render('');
    await openList();
    expect(listedCountries().slice(0, 2)).toEqual(['ZA', 'IN']);
    expect(
      document.querySelector('.phone-option[data-country="IN"] img')?.getAttribute('src'),
    ).toBe('flags/in.svg');
  });

  it('finds a country by name or dial code', async () => {
    await render('');
    await openList();
    await search('botsw');
    expect(listedCountries()).toEqual(['BW']);
    await search('+44');
    expect(listedCountries()).toContain('GB');
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
    expect(countryButton().textContent).toContain('+44');
    expect(listedCountries()).toEqual([]);
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
    expect(countryButton().disabled).toBe(true);
  });
});
