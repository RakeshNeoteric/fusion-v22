import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  inject,
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
import { DateAdapter } from '@angular/material/core';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { fromTimeText, toTimeText } from '../dates/app-dates';

/**
 * A time field with Material's time list, the partner of DateField. Typed (`14:30`, `2:30 pm`)
 * or picked, but the form control keeps the `HH:mm` text the forms use ('' for none), as a
 * native time input did.
 *
 * `<label for="x">` points at the text box: give the same id as `inputId`. Text that is not a
 * time is reported as the `time` error.
 *
 *     <label for="tr-time">Time</label>
 *     <app-time-field inputId="tr-time" formControlName="time" />
 */
@Component({
  selector: 'app-time-field',
  imports: [MatTimepickerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => TimeField), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => TimeField), multi: true },
  ],
  host: { class: 'time-field' },
  template: `
    <input
      #box
      type="text"
      autocomplete="off"
      placeholder="HH:MM"
      [id]="inputId()"
      [matTimepicker]="picker"
      [matTimepickerOpenOnClick]="false"
      [value]="time()"
      [disabled]="disabled()"
      (valueChange)="changed($event, box.value)"
      (blur)="onTouched()"
    />
    <mat-timepicker-toggle class="picker-toggle" [for]="picker" [disabled]="disabled()" />
    <mat-timepicker
      #picker
      panelClass="app-select-panel"
      [interval]="interval()"
      (closed)="onTouched()"
    />
  `,
})
export class TimeField implements ControlValueAccessor, Validator {
  /** The text box's id, for the field's `<label for>`. */
  readonly inputId = input.required<string>();
  /** Gap between the times in the list, e.g. `15m`, `1h`. */
  readonly interval = input('15m');

  private readonly adapter = inject<DateAdapter<Date>>(DateAdapter);
  protected readonly time = signal<Date | null>(null);
  protected readonly disabled = signal(false);
  /** Something was typed that is not a time. */
  private readonly unreadable = signal(false);

  private onChange: (value: string) => void = () => undefined;
  private onValidatorChange: () => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  writeValue(value: string | null | undefined): void {
    this.time.set(fromTimeText(value));
    this.unreadable.set(false);
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
    return this.unreadable() ? { time: true } : null;
  }

  registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChange = fn;
  }

  protected changed(value: Date | null, text: string): void {
    const valid = value !== null && this.adapter.isValid(value);
    this.time.set(valid ? value : null);
    this.unreadable.set(!valid && text.trim() !== '');
    this.onChange(valid ? toTimeText(value) : '');
    this.onValidatorChange();
  }
}
