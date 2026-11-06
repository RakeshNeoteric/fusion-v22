import { ChangeDetectionStrategy, Component, forwardRef, input, signal } from '@angular/core';
import {
  type ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  type ValidationErrors,
  type Validator,
} from '@angular/forms';
import {
  type CountryCode,
  getCountryCallingCode,
  isSupportedCountry,
  parsePhoneNumberFromString,
} from 'libphonenumber-js';
import { COUNTRIES } from '@shared/reference/countries';

interface DialCountry {
  readonly code: CountryCode;
  readonly label: string;
}

/** v21 lists South Africa and India first. */
const PREFERRED: readonly string[] = ['ZA', 'IN'];

const DIAL_COUNTRIES: readonly DialCountry[] = (() => {
  const supported = COUNTRIES.filter((country) => isSupportedCountry(country.code)).map(
    (country) => {
      const code = country.code as CountryCode;
      return { code, label: `+${getCountryCallingCode(code)} ${country.label}` };
    },
  );
  const preferred = PREFERRED.flatMap((code) => supported.filter((c) => c.code === code));
  return [...preferred, ...supported.filter((c) => !PREFERRED.includes(c.code))];
})();

/**
 * Phone number with its country (replaces v21's ngx-intl-tel-input). The form value is the
 * number in E.164 (`+27821234567`), as v21 sends it, or '' when empty.
 * A number the user types must be valid for the chosen country; a stored number is kept
 * as it is until the user changes it, so old data never blocks saving other fields.
 */
@Component({
  selector: 'app-phone-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => PhoneField), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => PhoneField), multi: true },
  ],
  template: `
    <select
      class="phone-country"
      [attr.aria-label]="label() + ' country code'"
      [disabled]="disabled()"
      (change)="changeCountry($event)"
      (blur)="onTouched()"
    >
      @for (country of countries; track country.code) {
        <option [value]="country.code" [selected]="country.code === countryCode()">
          {{ country.label }}
        </option>
      }
    </select>
    <input
      type="tel"
      class="phone-number"
      autocomplete="tel-national"
      [id]="inputId()"
      [attr.aria-label]="label()"
      [value]="number()"
      [disabled]="disabled()"
      (input)="changeNumber($event)"
      (blur)="onTouched()"
    />
  `,
  styles: `
    :host {
      display: flex;
      gap: 8px;
    }
    .phone-country {
      flex: 0 0 120px;
    }
    .phone-number {
      flex: 1 1 auto;
      min-width: 0;
    }
  `,
})
export class PhoneField implements ControlValueAccessor, Validator {
  /** Accessible name, e.g. "Telephone". */
  readonly label = input.required<string>();
  /** Id for the number input, so a `<label for>` can point at it. */
  readonly inputId = input<string>();
  readonly defaultCountry = input<CountryCode>('ZA');

  protected readonly countries = DIAL_COUNTRIES;
  protected readonly countryCode = signal<CountryCode>('ZA');
  protected readonly number = signal('');
  protected readonly disabled = signal(false);

  private valid = true;
  private onChange: (value: string) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  writeValue(value: unknown): void {
    const raw = typeof value === 'string' ? value.trim() : '';
    const parsed = raw ? parsePhoneNumberFromString(raw, this.defaultCountry()) : undefined;
    this.countryCode.set(parsed?.country ?? this.defaultCountry());
    this.number.set(parsed?.isValid() ? parsed.formatNational() : raw);
    this.valid = true;
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  validate(): ValidationErrors | null {
    return this.valid ? null : { phone: true };
  }

  protected changeCountry(event: Event): void {
    this.countryCode.set((event.target as HTMLSelectElement).value as CountryCode);
    this.emit();
  }

  protected changeNumber(event: Event): void {
    this.number.set((event.target as HTMLInputElement).value);
    this.emit();
  }

  private emit(): void {
    const text = this.number().trim();
    if (!text) {
      this.valid = true;
      this.onChange('');
      return;
    }
    const parsed = parsePhoneNumberFromString(text, this.countryCode());
    this.valid = parsed?.isValid() === true;
    this.onChange(parsed && this.valid ? parsed.number : text);
  }
}
