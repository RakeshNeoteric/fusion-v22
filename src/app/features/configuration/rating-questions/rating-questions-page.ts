import { ChangeDetectionStrategy, Component, Injector, inject } from '@angular/core';
import { type RatingQuestion, RatingQuestionApi } from '@api/config/rating-question.api';
import { RecordDialogs } from '@shared/forms/record-dialog/record-dialog';
import { EntityGrid } from '@shared/grid/entity-grid/entity-grid';
import type { EntityGridConfig } from '@shared/grid/entity-grid/entity-grid.types';
import { QuestionTypeLookup } from '../rating-question-types/question-type-lookup';
import { RatingQuestionDialog } from './rating-question-dialog';

const PERMISSION = 'RQL';

/** v21 Rating Questions / List: read-only list; questions are edited in a popup form. */
@Component({
  selector: 'app-rating-questions-page',
  imports: [EntityGrid],
  providers: [QuestionTypeLookup],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-entity-grid [config]="config" />`,
})
export class RatingQuestionsPage {
  private readonly questionTypes = inject(QuestionTypeLookup);
  private readonly dialogs = inject(RecordDialogs);
  private readonly injector = inject(Injector);

  protected readonly config: EntityGridConfig<RatingQuestion> = {
    entityName: 'Rating Question',
    permission: PERMISSION,
    source: inject(RatingQuestionApi),
    loadLookups: () => this.questionTypes.load(),
    describe: (question) => question.Question,
    editor: (record) => this.dialogs.open(RatingQuestionDialog, record, PERMISSION, this.injector),
    columns: [
      { kind: 'text', field: 'Question', header: 'Question', flex: 2, minWidth: 350 },
      {
        kind: 'select',
        field: 'RatingQuestionTypeId',
        header: 'Rating Question Type',
        options: () => this.questionTypes.options(),
        minWidth: 280,
      },
      { kind: 'number', field: 'ListRank', header: 'Rank', align: 'center', minWidth: 250 },
      { kind: 'toggle', field: 'IsActive', header: 'Active', minWidth: 250 },
    ],
  };
}
