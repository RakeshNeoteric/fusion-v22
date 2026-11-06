import { Injectable } from '@angular/core';
import { ConfigCrudApi, type SoftDeletable } from './config-crud.api';

/** `Config.RatingQuestion`. Questions must be unique (backend: 422). */
export interface RatingQuestion extends SoftDeletable {
  readonly RatingQuestionId: number;
  readonly RatingQuestionTypeId: number | null;
  readonly Question: string;
  /** Order in which questions are asked. */
  readonly ListRank: number | null;
  readonly IsActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class RatingQuestionApi extends ConfigCrudApi<RatingQuestion> {
  constructor() {
    super('Config/RatingQuestion', 'RatingQuestionId');
  }
}
