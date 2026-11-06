import { ChangeDetectionStrategy, Component, inject, viewChild } from '@angular/core';
import {
  type RatingQuestionType,
  RatingQuestionTypeApi,
} from '@api/config/rating-question-type.api';
import { EntityGrid } from '@shared/grid/entity-grid/entity-grid';
import type { EntityGridConfig } from '@shared/grid/entity-grid/entity-grid.types';
import type { HasUnsavedChanges } from '@shared/navigation/unsaved-changes.guard';

@Component({
  selector: 'app-rating-question-types-page',
  imports: [EntityGrid],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-entity-grid [config]="config" />`,
})
export class RatingQuestionTypesPage implements HasUnsavedChanges {
  private readonly grid = viewChild.required<EntityGrid<RatingQuestionType>>(EntityGrid);

  protected readonly config: EntityGridConfig<RatingQuestionType> = {
    entityName: 'Question Type',
    permission: 'RQT',
    source: inject(RatingQuestionTypeApi),
    describe: (type) => type.QuestionType,
    newEntity: () => ({
      RatingQuestionTypeId: 0,
      QuestionType: '',
      IncludeInRatingCalcs: true,
      IsActive: true,
      IsDeleted: false,
    }),
    columns: [
      { kind: 'text', field: 'QuestionType', header: 'Question Type', required: true, flex: 2 },
      { kind: 'toggle', field: 'IsActive', header: 'Active' },
      { kind: 'toggle', field: 'IncludeInRatingCalcs', header: 'Include in Rating Calcs' },
    ],
  };

  hasUnsavedChanges(): boolean {
    return this.grid().hasUnsavedChanges();
  }
}
