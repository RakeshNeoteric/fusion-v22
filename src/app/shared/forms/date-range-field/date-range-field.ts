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
  type AbstractControl,
  type ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  type ValidationErrors,
  type Validator,
} from '@angular/forms';
import { DateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { DATE_INPUT_FORMAT, fromIsoDate, toIsoDate } from '../dates/app-dates';

/** A period as the forms and backend use it: `yyyy-mm-dd` days ('' for none). */
export interface DateRange {
  readonly from: string;
  readonly to: string;
}

export const NO_DATE_RANGE: DateRange = { from: '', to: '' };

/** Validator: both days are given (`periodRequired` error). */
export function periodRequired(
  control: AbstractControl<DateRange | null>,
): ValidationErrors | null {
  const value = control.value;
  return value?.from && value.to ? null : { periodRequired: true };
}

/** Validator: the first day is not after the last (`period` error). */
export function periodInOrder(control: AbstractControl<DateRange | null>): ValidationErrors | null {
  const value = control.value;
  return value?.from && value.to && value.from > value.to ? { period: true } : null;
}

/**
 * A period in one field (v21 "Date Range"): two DD/MM/YYYY boxes and Material's range calendar.
 * The form control keeps a {@link DateRange}. Text that is not a date is the `date` error.
 *
 *     <label for="cr-period">Date Range</label>
 *     <app-date-range-field inputId="cr-period" formControlName="period" />
 */
@Component({
  selector: 'app-date-range-field',
  imports: [MatDatepickerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DateRangeField), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => DateRangeField), multi: true },
  ],
  host: { class: 'date-range-field', '[class.date-range-field--disabled]': 'disabled()' },
  template: `
    <mat-date-range-input
      class="date-range-boxes"
      [rangePicker]="picker"
      [min]="minDate()"
      [max]="maxDate()"
      [disabled]="disabled()"
    >
      <input
        #start
        matStartDate
        autocomplete="off"
        aria-label="First day"
        [id]="inputId()"
        [placeholder]="placeholder"
        [value]="from()"
        (dateChange)="changed('from', $event.value, start.value)"
        (blur)="onTouched()"
      />
      <input
        #end
        matEndDate
        autocomplete="off"
        aria-label="Last day"
        [placeholder]="placeholder"
        [value]="to()"
        (dateChange)="changed('to', $event.value, end.value)"
        (blur)="onTouched()"
      />
    </mat-date-range-input>
    <mat-datepicker-toggle class="picker-toggle" [for]="picker" [disabled]="disabled()" />
    <mat-date-range-picker #picker (closed)="onTouched()" />
  `,
})
export class DateRangeField implements ControlValueAccessor, Validator {
  /** The first box's id, for the field's `<label for>`. */
  readonly inputId = input.required<string>();
  /** Earliest day the calendar offers, `yyyy-mm-dd`. */
  readonly min = input<string | null>(null);
  /** Latest day the calendar offers, `yyyy-mm-dd`. */
  readonly max = input<string | null>(null);

  private readonly adapter = inject<DateAdapter<Date>>(DateAdapter);
  protected readonly placeholder = DATE_INPUT_FORMAT;
  protected readonly from = signal<Date | null>(null);
  protected readonly to = signal<Date | null>(null);
  protected readonly disabled = signal(false);
  protected readonly minDate = computed(() => fromIsoDate(this.min()));
  protected readonly maxDate = computed(() => fromIsoDate(this.max()));
  /** Boxes holding text that is not a date. */
  private readonly unreadable = signal<ReadonlySet<'from' | 'to'>>(new Set());

  private onChange: (value: DateRange) => void = () => undefined;
  private onValidatorChange: () => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  writeValue(value: DateRange | null | undefined): void {
    this.from.set(fromIsoDate(value?.from));
    this.to.set(fromIsoDate(value?.to));
    this.unreadable.set(new Set());
  }

  registerOnChange(fn: (value: DateRange) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  validate(): ValidationErrors | null {
    return this.unreadable().size ? { date: true } : null;
  }

  registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChange = fn;
  }

  protected changed(end: 'from' | 'to', value: Date | null, text: string): void {
    const valid = value !== null && this.adapter.isValid(value);
    (end === 'from' ? this.from : this.to).set(valid ? value : null);
    const unreadable = new Set(this.unreadable());
    if (!valid && text.trim() !== '') unreadable.add(end);
    else unreadable.delete(end);
    this.unreadable.set(unreadable);
    const from = this.from();
    const to = this.to();
    this.onChange({ from: from ? toIsoDate(from) : '', to: to ? toIsoDate(to) : '' });
    this.onValidatorChange();
  }
}
