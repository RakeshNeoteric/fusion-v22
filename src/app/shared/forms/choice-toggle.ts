import { ChangeDetectionStrategy, Component, forwardRef, input, signal } from '@angular/core';
import { type ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface Choice<T> {
  readonly value: T;
  readonly label: string;
}

/** Yes / No, as v21 stored them. */
export const YES_NO: readonly Choice<boolean>[] = [
  { value: true, label: 'Yes' },
  { value: false, label: 'No' },
];

/** Yes / No / NA; NA is stored as null, the same as not answered (v21). */
export const YES_NO_NA: readonly Choice<boolean | null>[] = [
  ...YES_NO,
  { value: null, label: 'NA' },
];

/**
 * v21 toggle buttons for one choice (Yes / No, validation methods, …), as a radio group. The
 * chosen button is ticked: green for Yes, red for No, teal otherwise.
 */
@Component({
  selector: 'app-choice-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => ChoiceToggle), multi: true },
  ],
  template: `
    <div class="ct" role="radiogroup" [attr.aria-label]="label()">
      @for (choice of choices(); track $index) {
        <button
          type="button"
          role="radio"
          class="ct-choice"
          [attr.aria-checked]="isChosen(choice)"
          [attr.data-tone]="tone(choice)"
          [tabIndex]="isChosen(choice) || ($first && !hasChoice()) ? 0 : -1"
          [disabled]="disabled()"
          (click)="pick(choice)"
          (keydown)="move($event, $index)"
          (blur)="touched()"
        >
          @if (isChosen(choice)) {
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />
            </svg>
          }
          {{ choice.label }}
        </button>
      }
    </div>
  `,
  styles: `
    :host {
      display: inline-block;
    }
    .ct {
      display: inline-flex;
      flex-wrap: wrap;
      overflow: hidden;
      border: 1px solid #555;
      border-radius: 24px;
    }
    .ct-choice {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 40px;
      padding: 0 20px;
      border: none;
      border-right: 1px solid #ccc;
      background: #fff;
      color: #212121;
      font: inherit;
      cursor: pointer;
    }
    .ct-choice:last-child {
      border-right: none;
    }
    .ct-choice:hover:not(:disabled) {
      background: #f1f1f1;
    }
    .ct-choice:focus-visible {
      outline: 2px solid var(--app-navy);
      outline-offset: -4px;
    }
    .ct-choice:disabled {
      cursor: default;
    }
    .ct-choice[aria-checked='true'] {
      background: var(--app-teal);
      color: #fff;
    }
    .ct-choice[aria-checked='true'][data-tone='yes'] {
      background: #2e7d32;
    }
    .ct-choice[aria-checked='true'][data-tone='no'] {
      background: #d0453a;
    }
    .ct-choice:disabled:not([aria-checked='true']) {
      color: #757575;
    }
    svg {
      width: 18px;
      height: 18px;
      fill: currentcolor;
    }
  `,
})
export class ChoiceToggle<T> implements ControlValueAccessor {
  readonly choices = input.required<readonly Choice<T>[]>();
  /** Accessible name: the question. */
  readonly label = input.required<string>();

  private readonly value = signal<T | undefined>(undefined);
  protected readonly disabled = signal(false);
  private onChange: (value: T) => void = () => undefined;
  protected touched: () => void = () => undefined;

  protected hasChoice(): boolean {
    return this.choices().some((choice) => this.isChosen(choice));
  }

  protected isChosen(choice: Choice<T>): boolean {
    return this.value() === choice.value;
  }

  protected tone(choice: Choice<T>): string {
    if (choice.value === true) return 'yes';
    if (choice.value === false) return 'no';
    return 'other';
  }

  protected pick(choice: Choice<T>): void {
    if (this.disabled()) return;
    this.value.set(choice.value);
    this.onChange(choice.value);
  }

  /** Arrow keys choose the next or previous option (WAI-ARIA radio group). */
  protected move(event: KeyboardEvent, index: number): void {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const count = this.choices().length;
    const next = (index + step + count) % count;
    const choice = this.choices()[next];
    if (!choice) return;
    this.pick(choice);
    const buttons = (event.currentTarget as HTMLElement).parentElement?.children;
    (buttons?.[next] as HTMLElement | undefined)?.focus();
  }

  writeValue(value: T): void {
    this.value.set(value);
  }

  registerOnChange(fn: (value: T) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.touched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }
}
