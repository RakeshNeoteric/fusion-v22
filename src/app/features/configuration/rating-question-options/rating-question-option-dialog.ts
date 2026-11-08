import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  type AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  type ValidationErrors,
  Validators,
} from '@angular/forms';
import {
  type RatingQuestionOption,
  RatingQuestionOptionApi,
} from '@api/config/rating-question-option.api';
import { RecordDialog, RecordDialogFrame } from '@shared/forms/record-dialog/record-dialog';
import { QuestionTypeLookup } from '../rating-question-types/question-type-lookup';
import { optionsFromTypeName } from './question-option-choices';
import { textOptions } from '@shared/forms/select-field/select-option';
import { SelectField } from '@shared/forms/select-field/select-field';

/**
 * v21 Rating Question Option popup. The answer is picked from the chosen question type's
 * answers (from its name, e.g. "Yes/No"); changing the type picks its first answer.
 */
@Component({
  selector: 'app-rating-question-option-dialog',
  imports: [ReactiveFormsModule, RecordDialogFrame, SelectField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <app-record-dialog-frame
        [title]="title"
        [isNew]="isNew"
        [readOnly]="readOnly"
        [saving]="saving()"
      >
        <div class="form-row">
          <div class="form-field">
            <label for="rqo-type">Question Type <span class="required">*</span></label>
            <app-select
              inputId="rqo-type"
              formControlName="RatingQuestionTypeId"
              placeholder="Select Question Type"
              [options]="questionTypes"
            />
            @if (showError('RatingQuestionTypeId')) {
              <span class="field-error">Question Type is required.</span>
            }
          </div>
          <div class="form-field">
            <label for="rqo-option">Question Option <span class="required">*</span></label>
            <app-select
              inputId="rqo-option"
              formControlName="QuestionOption"
              placeholder="Select Option"
              [options]="optionChoiceOptions()"
            />
            @if (form.controls.QuestionOption.hasError('noOptions') && selectedType() !== null) {
              <span class="field-error">This question type has no options configured.</span>
            } @else if (showError('QuestionOption')) {
              <span class="field-error">Please choose a valid option from the list.</span>
            }
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label for="rqo-prompt">Qualifying Prompt</label>
            <textarea
              id="rqo-prompt"
              rows="2"
              formControlName="QualifyingPrompt"
              placeholder="Optional prompt shown alongside this option"
            ></textarea>
          </div>
          <div class="form-field">
            <label for="rqo-rating">Rating Value <span class="required">*</span></label>
            <input
              id="rqo-rating"
              type="text"
              inputmode="numeric"
              placeholder="1–10"
              formControlName="RatingValue"
            />
            @if (showError('RatingValue')) {
              <span class="field-error">
                {{
                  form.controls.RatingValue.hasError('required')
                    ? 'Rating value is required.'
                    : 'Rating must be a whole number between 1 and 10.'
                }}
              </span>
            }
          </div>
        </div>

        <div class="switch-row">
          <label class="switch-field">
            <span class="switch">
              <input type="checkbox" role="switch" formControlName="IsActive" />
              <span class="slider"></span>
            </span>
            Is Active?
          </label>
          <label class="switch-field">
            <span class="switch">
              <input type="checkbox" role="switch" formControlName="IsNoteRequired" />
              <span class="slider"></span>
            </span>
            Note Required?
          </label>
          <label class="switch-field">
            <span class="switch">
              <input type="checkbox" role="switch" formControlName="DoRaiseFlag" />
              <span class="slider"></span>
            </span>
            Raise Flag?
          </label>
        </div>
      </app-record-dialog-frame>
    </form>
  `,
})
export class RatingQuestionOptionDialog extends RecordDialog<RatingQuestionOption> {
  protected readonly source = inject(RatingQuestionOptionApi);
  protected readonly entityName = 'Rating Question Option';

  private readonly record = this.data.record;
  private readonly lookup = inject(QuestionTypeLookup);

  protected readonly title = this.isNew
    ? 'Create Rating Question Option'
    : this.readOnly
      ? 'View Rating Question Option'
      : 'Edit Rating Question Option';

  protected readonly questionTypes = this.lookup.choices(this.record?.RatingQuestionTypeId ?? null);
  protected readonly selectedType = signal(this.record?.RatingQuestionTypeId ?? null);

  /** The chosen type's answers; an older saved answer stays available so it is not lost. */
  protected readonly optionChoices = computed(() => {
    const typeId = this.selectedType();
    const type = this.lookup.find(typeId);
    const choices = optionsFromTypeName(type ? this.lookup.nameOf(type) : null);
    const saved = this.record?.QuestionOption;
    if (saved && typeId === this.record?.RatingQuestionTypeId && !choices.includes(saved)) {
      choices.push(saved);
    }
    return choices;
  });
  protected readonly optionChoiceOptions = computed(() => textOptions(this.optionChoices()));

  protected readonly form = new FormGroup({
    RatingQuestionTypeId: new FormControl<number | null>(
      this.record?.RatingQuestionTypeId ?? null,
      Validators.required,
    ),
    QuestionOption: new FormControl(this.record?.QuestionOption ?? '', {
      nonNullable: true,
      validators: (control) => this.isChoice(control),
    }),
    QualifyingPrompt: new FormControl(this.record?.QualifyingPrompt ?? '', { nonNullable: true }),
    RatingValue: new FormControl<string>(
      this.record?.RatingValue === null || this.record?.RatingValue === undefined
        ? ''
        : String(this.record.RatingValue),
      {
        nonNullable: true,
        validators: [Validators.required, Validators.pattern(/^\s*\d+\s*$/), ratingRange],
      },
    ),
    IsActive: new FormControl(this.record?.IsActive ?? true, { nonNullable: true }),
    IsNoteRequired: new FormControl(this.record?.IsNoteRequired ?? false, { nonNullable: true }),
    DoRaiseFlag: new FormControl(this.record?.DoRaiseFlag ?? false, { nonNullable: true }),
  });

  constructor() {
    super();
    const { RatingQuestionTypeId: type, QuestionOption: option } = this.form.controls;
    type.valueChanges.pipe(takeUntilDestroyed()).subscribe((typeId) => {
      this.selectedType.set(typeId);
      const choices = this.optionChoices();
      // v21: keep the answer if the new type has it, otherwise take the type's first answer.
      option.setValue(choices.includes(option.value) ? option.value : (choices[0] ?? ''));
    });
  }

  protected toRecord(): RatingQuestionOption {
    const value = this.form.getRawValue();
    return {
      // Keeps any field this form does not show.
      ...(this.record ?? { IsDeleted: false }),
      RatingQuestionOptionId: this.record?.RatingQuestionOptionId ?? 0,
      RatingQuestionTypeId: value.RatingQuestionTypeId,
      QuestionOption: value.QuestionOption.trim(),
      QualifyingPrompt: value.QualifyingPrompt.trim(),
      RatingValue: Number(value.RatingValue),
      IsNoteRequired: value.IsNoteRequired,
      DoRaiseFlag: value.DoRaiseFlag,
      IsActive: value.IsActive,
    };
  }

  private isChoice(control: AbstractControl<string>): ValidationErrors | null {
    const choices = this.optionChoices();
    if (choices.length === 0) return { noOptions: true };
    return choices.includes(control.value) ? null : { notAChoice: true };
  }
}

/** v21: 1 to 10. */
function ratingRange(control: AbstractControl<string>): ValidationErrors | null {
  const value = Number(control.value);
  if (!control.value.trim() || Number.isNaN(value)) return null;
  return value >= 1 && value <= 10 ? null : { range: true };
}
