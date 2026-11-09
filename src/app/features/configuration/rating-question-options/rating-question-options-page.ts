import { ChangeDetectionStrategy, Component, Injector, inject } from '@angular/core';
import {
  type RatingQuestionOption,
  RatingQuestionOptionApi,
} from '@api/config/rating-question-option.api';
import { RecordDialogs } from '@shared/forms/record-dialog/record-dialog';
import { EntityGrid } from '@shared/grid/entity-grid/entity-grid';
import type { EntityGridConfig } from '@shared/grid/entity-grid/entity-grid.types';
import { QuestionTypeLookup } from '../rating-question-types/question-type-lookup';
import { RatingQuestionOptionDialog } from './rating-question-option-dialog';

const PERMISSION = 'RQO';

/** v21 Rating Questions / Options: read-only list; options are edited in a popup form. */
@Component({
  selector: 'app-rating-question-options-page',
  imports: [EntityGrid],
  providers: [QuestionTypeLookup],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-entity-grid [config]="config" />`,
})
export class RatingQuestionOptionsPage {
  private readonly questionTypes = inject(QuestionTypeLookup);
  private readonly dialogs = inject(RecordDialogs);
  private readonly injector = inject(Injector);

  protected readonly config: EntityGridConfig<RatingQuestionOption> = {
    entityName: 'Rating Question Option',
    permission: PERMISSION,
    source: inject(RatingQuestionOptionApi),
    loadLookups: () => this.questionTypes.load(),
    describe: (option) => option.QuestionOption,
    editor: (record) =>
      this.dialogs.open(RatingQuestionOptionDialog, record, PERMISSION, this.injector),
    columns: [
      {
        kind: 'select',
        field: 'RatingQuestionTypeId',
        header: 'Rating Question Type',
        options: () => this.questionTypes.options(),
        align: 'center',
        flex: 2,
        minWidth: 220,
      },
      {
        kind: 'text',
        field: 'QuestionOption',
        header: 'Question Option',
        align: 'center',
        minWidth: 160,
      },
      { kind: 'text', field: 'QualifyingPrompt', header: 'Qualifying Prompt', minWidth: 160 },
      {
        kind: 'number',
        field: 'RatingValue',
        header: 'Rating Value',
        align: 'center',
        minWidth: 160,
      },
      { kind: 'toggle', field: 'IsNoteRequired', header: 'Note Required', minWidth: 160 },
      { kind: 'toggle', field: 'IsActive', header: 'Active', minWidth: 150 },
      { kind: 'toggle', field: 'DoRaiseFlag', header: 'Do Raise Flag', minWidth: 160 },
    ],
  };
}
