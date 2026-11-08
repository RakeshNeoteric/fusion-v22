import {
  ChangeDetectionStrategy,
  Component,
  computed,
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
import { MatDatepickerModule } from '@angular/material/datepicker';
import { DATE_INPUT_FORMAT, fromIsoDate, toIsoDate } from '../dates/app-dates';

/**
 * A date field with Material's calendar (v21). Typed or picked as DD/MM/YYYY, but the form
 * control keeps the `yyyy-mm-dd` text the forms and backend use ('' for none), so a form does
 * not change when it moves from a native date input to this.
 *
 * `<label for="x">` points at the text box: give the same id as `inputId`. Text that is not a
 * date is reported as the `date` error.
 *
 *     <label for="di-birth">Date of Birth</label>
 *     <app-date-field inputId="di-birth" formControlName="dateOfBirth" [max]="today" />
 */
@Component({
  selector: 'app-date-field',
  imports: [MatDatepickerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DateField), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => DateField), multi: true },
  ],
  host: { class: 'date-field' },
  template: `
    <input
      type="text"
      autocomplete="off"
      [id]="inputId()"
      [placeholder]="placeholder"
      [matDatepicker]="picker"
      [min]="minDate()"
      [max]="maxDate()"
      [value]="date()"
      [disabled]="disabled()"
      (dateChange)="changed($event.value, $event.targetElement)"
      (blur)="onTouched()"
    />
    <mat-datepicker-toggle class="date-field-toggle" [for]="picker" [disabled]="disabled()" />
    <mat-datepicker #picker (closed)="onTouched()" />
  `,
})
export class DateField implements ControlValueAccessor, Validator {
  /** The text box's id, for the field's `<label for>`. */
  readonly inputId = input.required<string>();
  /** Earliest day the calendar offers, `yyyy-mm-dd`. */
  readonly min = input<string | null>(null);
  /** Latest day the calendar offers, `yyyy-mm-dd`. */
  readonly max = input<string | null>(null);

  private readonly adapter = inject<DateAdapter<Date>>(DateAdapter);
  protected readonly placeholder = DATE_INPUT_FORMAT;
  protected readonly date = signal<Date | null>(null);
  protected readonly disabled = signal(false);
  protected readonly minDate = computed(() => fromIsoDate(this.min()));
  protected readonly maxDate = computed(() => fromIsoDate(this.max()));
  /** Something was typed that is not a date. */
  private readonly unreadable = signal(false);

  private onChange: (value: string) => void = () => undefined;
  private onValidatorChange: () => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  writeValue(value: string | null | undefined): void {
    this.date.set(fromIsoDate(value));
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
    return this.unreadable() ? { date: true } : null;
  }

  registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChange = fn;
  }

  protected changed(value: Date | null, box: HTMLElement): void {
    const valid = value !== null && this.adapter.isValid(value);
    const text = box instanceof HTMLInputElement ? box.value.trim() : '';
    this.date.set(valid ? value : null);
    this.unreadable.set(!valid && text !== '');
    this.onChange(valid ? toIsoDate(value) : '');
    this.onValidatorChange();
  }
}
