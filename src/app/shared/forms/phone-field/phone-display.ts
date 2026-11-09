import { ChangeDetectionStrategy, Component, effect, input, untracked } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { storedToE164 } from '@shared/reference/phone';
import { PhoneField } from './phone-field';

/**
 * A stored phone number shown read-only like the phone fields: flag, dial code, then the number
 * (v21 showed copied numbers in a disabled ngx-intl-tel-input). For numbers that belong to
 * something else (the phase, the parlour, the caller) and are only shown on this screen.
 * Old numbers stored without a country code are read as South African.
 *
 *     <label for="pc-1-telephone">Telephone Number</label>
 *     <app-phone-display inputId="pc-1-telephone" label="Telephone Number" [value]="stored" />
 */
@Component({
  selector: 'app-phone-display',
  imports: [ReactiveFormsModule, PhoneField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-phone-field [inputId]="inputId()" [label]="label()" [formControl]="control" />`,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
  `,
})
export class PhoneDisplay {
  /** The number box's id, for the field's `<label for>`. */
  readonly inputId = input.required<string>();
  /** Accessible name, e.g. "Telephone Number". */
  readonly label = input.required<string>();
  /** The number as stored (E.164, national, or with spaces); empty shows an empty box. */
  readonly value = input<string | null | undefined>('');

  protected readonly control = new FormControl(
    { value: '', disabled: true },
    { nonNullable: true },
  );

  constructor() {
    effect(() => {
      const number = storedToE164(this.value());
      untracked(() => this.control.setValue(number));
    });
  }
}
