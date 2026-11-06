import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import {
  type RatingQuestionType,
  RatingQuestionTypeApi,
} from '@api/config/rating-question-type.api';
import { RecordLookup } from '@shared/reference/record-lookup';

/** Question types for screens that pick one (Rating Questions, Options). Provide it on the page. */
// Page-scoped on purpose: each visit loads the current list and frees it on leaving.
// eslint-disable-next-line @angular-eslint/use-injectable-provided-in
@Injectable()
export class QuestionTypeLookup extends RecordLookup<RatingQuestionType> {
  private readonly api = inject(RatingQuestionTypeApi);

  protected fetch(): Observable<RatingQuestionType[]> {
    return this.api.listIncludingDeleted();
  }

  idOf(type: RatingQuestionType): number {
    return type.RatingQuestionTypeId;
  }

  nameOf(type: RatingQuestionType): string {
    return type.QuestionType;
  }
}
