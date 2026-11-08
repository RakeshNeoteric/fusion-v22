import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  type ElementRef,
  forwardRef,
  inject,
  input,
  model,
  output,
  Renderer2,
  signal,
  viewChild,
} from '@angular/core';
import { type ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatOption } from '@angular/material/core';
import { MatSelect } from '@angular/material/select';
import type { SelectOption } from './select-option';

/** What a dropdown holds: one value, several (`multiple`), or nothing (null). */
export type SelectValue<T> = T | readonly T[] | null;

/** Keys the search box leaves to the list: moving through it, choosing, closing. */
const LIST_KEYS = new Set(['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Enter', 'Escape', 'Tab']);

/**
 * The app's dropdown (v21 look): Angular Material's select, styled like the other fields, with
 * an optional search box for long lists and an optional multiple choice.
 *
 * Works with reactive forms (`formControlName`, `formControl`) or on its own (`[(value)]`), and
 * `changed` tells the screen when the user picks something (after the form has the value).
 * `<label for="x">` names it: give the same id as `inputId`.
 *
 *     <label for="nc-client">Client Name <span class="required">*</span></label>
 *     <app-select inputId="nc-client" formControlName="clientId" placeholder="Select Client"
 *                 [options]="clients" searchable />
 *
 * `placeholder` shows while nothing is chosen. With `allowNone` it is also the first choice in
 * the list, to go back to nothing; `noneValue` is what the form gets then (null, or '' for a
 * text field).
 */
@Component({
  selector: 'app-select',
  imports: [MatSelect, MatOption],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SelectField), multi: true },
  ],
  host: { class: 'select-field' },
  template: `
    <mat-select
      #select
      class="select-field-box"
      panelClass="app-select-panel"
      hideSingleSelectionIndicator
      [id]="inputId()"
      [placeholder]="placeholder()"
      [multiple]="multiple()"
      [disabled]="disabled()"
      [value]="value()"
      [aria-label]="ariaLabel() ?? ''"
      [aria-labelledby]="labelId()"
      (selectionChange)="picked($event.value)"
      (openedChange)="openedChange($event)"
      (blur)="blurred()"
    >
      @if (searchable()) {
        <div class="app-select-search">
          <input
            #search
            type="text"
            autocomplete="off"
            [attr.aria-label]="'Search ' + (ariaLabel() ?? placeholder())"
            [placeholder]="searchPlaceholder()"
            [value]="term()"
            (input)="term.set(search.value)"
            (keydown)="searchKeydown($event)"
          />
        </div>
      }
      @if (allowNone() && !multiple() && !term()) {
        <mat-option class="app-select-none" [value]="null">{{ placeholder() }}</mat-option>
      }
      @for (option of shown(); track option.value) {
        <mat-option [value]="option.value" [disabled]="option.selectable === false">
          {{ option.label }}
        </mat-option>
      }
      @if (term() && !shown().length) {
        <p class="app-select-empty" role="status">No matches</p>
      }
    </mat-select>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    /* v21: like the text fields, 40px high with 10px corners. */
    .select-field-box {
      box-sizing: border-box;
      width: 100%;
      padding: 10px;
      border: 1px solid #ccc;
      border-radius: 10px;
      background: #fff;
      transition: border-color 0.3s ease;
      --mat-select-trigger-text-font: inherit;
      --mat-select-trigger-text-size: 14px;
      --mat-select-trigger-text-line-height: 18px;
      --mat-select-trigger-text-weight: 400;
      --mat-select-trigger-text-tracking: normal;
      --mat-select-enabled-trigger-text-color: inherit;
      --mat-select-disabled-trigger-text-color: #555;
      --mat-select-placeholder-text-color: #757575;
      --mat-select-enabled-arrow-color: #555;
      --mat-select-focused-arrow-color: #000;
      --mat-select-invalid-arrow-color: var(--app-danger);
    }
    .select-field-box:focus,
    .select-field-box[aria-expanded='true'] {
      border-color: #000;
      outline: none;
    }
    :host(.ng-invalid.ng-touched) .select-field-box {
      border-color: var(--app-danger);
    }
    .select-field-box.mat-mdc-select-disabled {
      background: #f5f5f5;
    }
  `,
})
export class SelectField<T> implements ControlValueAccessor {
  /** The dropdown's id, for the field's `<label for>`. */
  readonly inputId = input.required<string>();
  readonly options = input.required<readonly SelectOption<T>[]>();
  /** Shown while nothing is chosen (and as the "nothing" choice with `allowNone`). */
  readonly placeholder = input('Select');
  /** The placeholder is also a choice, which clears the dropdown. */
  readonly allowNone = input(false, { transform: booleanAttribute });
  /** The form's value when nothing is chosen. */
  readonly noneValue = input<T | null>(null);
  /** A search box at the top of the list (long lists: clients, providers, users). */
  readonly searchable = input(false, { transform: booleanAttribute });
  readonly searchPlaceholder = input('Search…');
  /** Several choices; the value is then a list. */
  readonly multiple = input(false, { transform: booleanAttribute });
  /** The name when there is no `<label for>`. */
  readonly ariaLabel = input<string | null>(null);
  /** The chosen value, for use without a form (`[(value)]`). */
  readonly value = model<SelectValue<T>>(null);
  /** The user picked something (the form already has it). */
  readonly changed = output<SelectValue<T>>();

  protected readonly disabled = signal(false);
  protected readonly labelId = signal('');
  protected readonly term = signal('');
  protected readonly shown = computed(() => {
    const term = this.term().trim().toLowerCase();
    const options = this.options();
    return term ? options.filter((option) => option.label.toLowerCase().includes(term)) : options;
  });

  private readonly select = viewChild.required<MatSelect>('select');
  private readonly search = viewChild<ElementRef<HTMLInputElement>>('search');

  private onChange: (value: SelectValue<T>) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    const document = inject(DOCUMENT);
    const renderer = inject(Renderer2);
    const destroyRef = inject(DestroyRef);
    // A <label for> cannot name or focus a non-input, so it is linked here.
    afterNextRender(() => {
      const id = this.inputId();
      const label = document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(id)}"]`);
      if (!label) return;
      label.id ||= `${id}-label`;
      this.labelId.set(label.id);
      const stop = renderer.listen(label, 'click', () => this.select().focus());
      destroyRef.onDestroy(stop);
    });
  }

  writeValue(value: SelectValue<T> | undefined): void {
    this.value.set(value ?? null);
  }

  registerOnChange(fn: (value: SelectValue<T>) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  protected picked(chosen: SelectValue<T> | undefined): void {
    const value = chosen ?? this.noneValue();
    this.value.set(value);
    this.onChange(value);
    this.changed.emit(value);
  }

  protected openedChange(open: boolean): void {
    if (open) {
      this.search()?.nativeElement.focus();
      return;
    }
    this.term.set('');
    this.onTouched();
  }

  protected blurred(): void {
    // Moving into the search box is not leaving the field.
    if (!this.select().panelOpen) this.onTouched();
  }

  /** Typing goes into the box; the arrows, Enter, Escape and Tab still work the list. */
  protected searchKeydown(event: KeyboardEvent): void {
    if (!LIST_KEYS.has(event.key)) event.stopPropagation();
  }
}
