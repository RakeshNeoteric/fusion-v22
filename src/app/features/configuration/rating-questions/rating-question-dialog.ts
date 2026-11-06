import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { type RatingQuestion, RatingQuestionApi } from '@api/config/rating-question.api';
import { RecordDialog, RecordDialogFrame } from '@shared/forms/record-dialog/record-dialog';
import { requiredText } from '@shared/forms/validators';
import { QuestionTypeLookup } from '../rating-question-types/question-type-lookup';

/** v21 Rating Question popup: the question, its type, and its rank (order asked). */
@Component({
  selector: 'app-rating-question-dialog',
  imports: [ReactiveFormsModule, RecordDialogFrame],
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
            <label for="rq-question">Question <span class="required">*</span></label>
            <textarea id="rq-question" rows="3" formControlName="Question"></textarea>
            @if (showError('Question')) {
              <span class="field-error">Question is required.</span>
            }
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label for="rq-type">Question Type <span class="required">*</span></label>
            <select id="rq-type" formControlName="RatingQuestionTypeId">
              <option [ngValue]="null" disabled>-- Select Question Type --</option>
              @for (type of questionTypes; track type.value) {
                <option [ngValue]="type.value">{{ type.label }}</option>
              }
            </select>
            @if (showError('RatingQuestionTypeId')) {
              <span class="field-error">Question Type is required.</span>
            }
          </div>
          <div class="form-field">
            <label for="rq-rank">Rank <span class="required">*</span></label>
            <input id="rq-rank" type="number" min="0" step="1" formControlName="ListRank" />
            @if (showError('ListRank')) {
              <span class="field-error">
                {{
                  form.controls.ListRank.hasError('required')
                    ? 'Rank is required.'
                    : 'Rank must be a whole number, 0 or more.'
                }}
              </span>
            }
          </div>
        </div>

        <label class="switch-field">
          <span class="switch">
            <input type="checkbox" role="switch" formControlName="IsActive" />
            <span class="slider"></span>
          </span>
          Is Active?
        </label>
      </app-record-dialog-frame>
    </form>
  `,
})
export class RatingQuestionDialog extends RecordDialog<RatingQuestion> {
  protected readonly source = inject(RatingQuestionApi);
  protected readonly entityName = 'Rating Question';

  private readonly record = this.data.record;

  protected readonly title = this.isNew
    ? 'Create Rating Question'
    : this.readOnly
      ? 'View Rating Question'
      : 'Edit Rating Question';

  protected readonly questionTypes = inject(QuestionTypeLookup).choices(
    this.record?.RatingQuestionTypeId ?? null,
  );

  protected readonly form = new FormGroup({
    Question: new FormControl(this.record?.Question ?? '', {
      nonNullable: true,
      validators: requiredText,
    }),
    RatingQuestionTypeId: new FormControl<number | null>(
      this.record?.RatingQuestionTypeId ?? null,
      Validators.required,
    ),
    // v21: digits only.
    ListRank: new FormControl<number | null>(this.record?.ListRank ?? null, [
      Validators.required,
      Validators.pattern(/^\d+$/),
    ]),
    IsActive: new FormControl(this.record?.IsActive ?? true, { nonNullable: true }),
  });

  protected toRecord(): RatingQuestion {
    const value = this.form.getRawValue();
    return {
      RatingQuestionId: this.record?.RatingQuestionId ?? 0,
      RatingQuestionTypeId: value.RatingQuestionTypeId,
      Question: value.Question.trim(),
      ListRank: value.ListRank,
      IsActive: value.IsActive,
      IsDeleted: this.record?.IsDeleted ?? false,
    };
  }
}
