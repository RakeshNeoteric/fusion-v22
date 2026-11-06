import { Injectable } from '@angular/core';
import { ConfigCrudApi, type SoftDeletable } from './config-crud.api';

/**
 * `Config.RatingQuestionOption`: one answer for a question type and the rating it scores.
 * Option names must be unique across all types (backend: 422).
 */
export interface RatingQuestionOption extends SoftDeletable {
  readonly RatingQuestionOptionId: number;
  readonly RatingQuestionTypeId: number | null;
  readonly QuestionOption: string;
  readonly QualifyingPrompt: string;
  /** Whole number 1–10 (the backend stores an int). */
  readonly RatingValue: number | null;
  readonly IsNoteRequired: boolean;
  readonly DoRaiseFlag: boolean;
  readonly IsActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class RatingQuestionOptionApi extends ConfigCrudApi<RatingQuestionOption> {
  constructor() {
    super('Config/RatingQuestionOption', 'RatingQuestionOptionId');
  }
}
