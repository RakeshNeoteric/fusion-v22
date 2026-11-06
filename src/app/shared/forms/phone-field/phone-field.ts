import { CdkTrapFocus } from '@angular/cdk/a11y';
import { CdkListbox, CdkOption, type ListboxValueChangeEvent } from '@angular/cdk/listbox';
import { CdkConnectedOverlay, CdkOverlayOrigin } from '@angular/cdk/overlay';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  signal,
} from '@angular/core';
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
  readonly name: string;
  readonly dial: string;
}

/** v21 lists South Africa and India first. */
const PREFERRED: readonly string[] = ['ZA', 'IN'];

const DIAL_COUNTRIES: readonly DialCountry[] = (() => {
  const supported = COUNTRIES.filter((country) => isSupportedCountry(country.code)).map(
    (country): DialCountry => {
      const code = country.code as CountryCode;
      return { code, name: country.label, dial: getCountryCallingCode(code) };
    },
  );
  const preferred = PREFERRED.flatMap((code) => supported.filter((c) => c.code === code));
  return [...preferred, ...supported.filter((c) => !PREFERRED.includes(c.code))];
})();

/**
 * Phone number with its country (replaces v21's ngx-intl-tel-input): a flag and dial-code
 * button that opens a searchable country list, then the number. The form value is the
 * number in E.164 (`+27821234567`), as v21 sends it, or '' when empty.
 * A number the user types must be valid for the chosen country; a stored number is kept
 * as it is until the user changes it, so old data never blocks saving other fields.
 * Flags are the flag-icons SVGs (MIT), copied to `/flags` by angular.json.
 */
@Component({
  selector: 'app-phone-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkConnectedOverlay, CdkOverlayOrigin, CdkListbox, CdkOption, CdkTrapFocus],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => PhoneField), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => PhoneField), multi: true },
  ],
  template: `
    <button
      #origin="cdkOverlayOrigin"
      cdkOverlayOrigin
      type="button"
      class="phone-country"
      aria-haspopup="listbox"
      [attr.aria-label]="label() + ' country: ' + selected().name + ' +' + selected().dial"
      [attr.aria-expanded]="open()"
      [attr.data-country]="selected().code"
      [disabled]="disabled()"
      (click)="toggle()"
      (blur)="onTouched()"
    >
      <img class="phone-flag" alt="" width="24" height="18" [src]="flagSrc(selected().code)" />
      <span>+{{ selected().dial }}</span>
      <span class="phone-caret" aria-hidden="true"></span>
    </button>
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

    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="origin"
      [cdkConnectedOverlayOpen]="open()"
      (overlayOutsideClick)="close()"
      (overlayKeydown)="overlayKey($event)"
      (detach)="close()"
    >
      <div class="phone-panel" cdkTrapFocus [cdkTrapFocusAutoCapture]="true">
        <input
          type="search"
          class="phone-search"
          placeholder="Search Country"
          [attr.aria-label]="label() + ' country search'"
          [value]="query()"
          (input)="search($event)"
          (keydown.enter)="pickFirst($event)"
        />
        <ul
          class="phone-options"
          cdkListbox
          [attr.aria-label]="label() + ' country'"
          [cdkListboxValue]="[selected().code]"
          (cdkListboxValueChange)="pick($event)"
        >
          @for (country of filtered(); track country.code) {
            <li class="phone-option" [cdkOption]="country.code" [attr.data-country]="country.code">
              <img
                class="phone-flag"
                alt=""
                width="24"
                height="18"
                loading="lazy"
                [src]="flagSrc(country.code)"
              />
              <span class="phone-option-name">{{ country.name }}</span>
              <span class="phone-option-dial">+{{ country.dial }}</span>
            </li>
          } @empty {
            <li class="phone-none">No country found</li>
          }
        </ul>
      </div>
    </ng-template>
  `,
  styles: `
    /* v21 look: one rounded box, flag and dial code on the left, a divider, then the number. */
    :host {
      display: flex;
      box-sizing: border-box;
      height: 40px;
      border: 1px solid #ccc;
      border-radius: 10px;
      background: #fff;
      transition: border-color 0.3s ease;
    }
    :host:focus-within {
      border-color: #000;
    }
    :host(.ng-invalid.ng-touched) {
      border-color: var(--app-danger);
    }
    :host:has(.phone-number:disabled) {
      background: #f5f5f5;
    }
    .phone-country {
      display: flex;
      flex: none;
      align-items: center;
      gap: 8px;
      padding: 0 10px;
      border: none;
      border-right: 1px solid #ccc;
      border-radius: 10px 0 0 10px;
      background: transparent;
      color: inherit;
      font: inherit;
      font-size: 14px;
      cursor: pointer;
    }
    .phone-country:disabled {
      cursor: default;
    }
    .phone-country:focus-visible {
      outline: 2px solid #000;
      outline-offset: -2px;
    }
    .phone-flag {
      flex: none;
      width: 24px;
      height: 18px;
      object-fit: cover;
      box-shadow: 0 0 1px rgb(0 0 0 / 50%);
    }
    .phone-caret {
      border-top: 4px solid #555;
      border-right: 4px solid transparent;
      border-left: 4px solid transparent;
    }
    /* The box is drawn by :host, so the number input itself has none. */
    :host .phone-number {
      flex: 1 1 auto;
      min-width: 0;
      height: 100%;
      padding: 0 10px;
      border: none;
      border-radius: 0 10px 10px 0;
      background: transparent;
    }

    .phone-panel {
      display: flex;
      flex-direction: column;
      width: 300px;
      max-height: 260px;
      margin-top: 3px;
      border: 1px solid #ccc;
      border-radius: 10px;
      background: #fff;
      box-shadow: 0 4px 10px rgb(0 0 0 / 15%);
      overflow: hidden;
    }
    .phone-search {
      margin: 8px;
      padding: 8px 10px;
      border: 1px solid #ccc;
      border-radius: 8px;
      font: inherit;
      font-size: 14px;
      outline: none;
    }
    .phone-search:focus {
      border-color: #000;
    }
    .phone-options {
      margin: 0;
      padding: 0 0 4px;
      overflow-y: auto;
      list-style: none;
      outline: none;
    }
    .phone-option,
    .phone-none {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      font-size: 14px;
    }
    .phone-option {
      cursor: pointer;
    }
    .phone-option:hover,
    .phone-option.cdk-option-active {
      background: #f2f2f2;
    }
    .phone-option[aria-selected='true'] {
      font-weight: 600;
    }
    .phone-option-name {
      flex: 1 1 auto;
      min-width: 0;
    }
    .phone-option-dial,
    .phone-none {
      color: #777;
    }
  `,
})
export class PhoneField implements ControlValueAccessor, Validator {
  /** Accessible name, e.g. "Telephone". */
  readonly label = input.required<string>();
  /** Id for the number input, so a `<label for>` can point at it. */
  readonly inputId = input<string>();
  readonly defaultCountry = input<CountryCode>('ZA');

  protected readonly countryCode = signal<CountryCode>('ZA');
  protected readonly number = signal('');
  protected readonly disabled = signal(false);
  protected readonly open = signal(false);
  protected readonly query = signal('');

  protected readonly selected = computed(
    () =>
      DIAL_COUNTRIES.find((country) => country.code === this.countryCode()) ?? {
        code: this.countryCode(),
        name: this.countryCode(),
        dial: getCountryCallingCode(this.countryCode()),
      },
  );

  /** Matches the country name, its code (ZA) or its dial code (27 / +27). */
  protected readonly filtered = computed(() => {
    const term = this.query().trim().toLowerCase().replace(/^\+/, '');
    if (!term) return DIAL_COUNTRIES;
    return DIAL_COUNTRIES.filter(
      (country) =>
        country.name.toLowerCase().includes(term) ||
        country.code.toLowerCase() === term ||
        country.dial.startsWith(term),
    );
  });

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
    if (disabled) this.close();
  }

  validate(): ValidationErrors | null {
    return this.valid ? null : { phone: true };
  }

  protected flagSrc(code: string): string {
    return `flags/${code.toLowerCase()}.svg`;
  }

  protected toggle(): void {
    if (this.open()) {
      this.close();
    } else {
      this.query.set('');
      this.open.set(true);
    }
  }

  protected close(): void {
    this.open.set(false);
  }

  protected overlayKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    }
  }

  protected search(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected pickFirst(event: Event): void {
    event.preventDefault();
    const first = this.filtered()[0];
    if (first) this.choose(first.code);
  }

  /** Clicking the chosen country again empties the listbox value; that just closes. */
  protected pick(event: ListboxValueChangeEvent<CountryCode>): void {
    const code = event.value[0];
    if (code) {
      this.choose(code);
    } else {
      this.close();
    }
  }

  private choose(code: CountryCode): void {
    this.close();
    if (code === this.countryCode()) return;
    this.countryCode.set(code);
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
