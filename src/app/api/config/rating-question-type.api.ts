import { Injectable } from '@angular/core';
import { ConfigCrudApi, type SoftDeletable } from './config-crud.api';

/** `Config.RatingQuestionType`. Question types must be unique (backend: 422). */
export interface RatingQuestionType extends SoftDeletable {
  readonly RatingQuestionTypeId: number;
  readonly QuestionType: string;
  readonly IncludeInRatingCalcs: boolean;
  readonly IsActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class RatingQuestionTypeApi extends ConfigCrudApi<RatingQuestionType> {
  constructor() {
    super('Config/RatingQuestionType', 'RatingQuestionTypeId');
  }
}
