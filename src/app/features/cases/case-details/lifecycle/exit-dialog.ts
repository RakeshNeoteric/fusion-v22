import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { RecordDialogFrame } from '@shared/forms/record-dialog/record-dialog';
import { CaseIdentity } from '../case-identity';

/** What the caller answered: the call is complete (close the case) or not (just leave). */
export type ExitChoice = 'complete' | 'incomplete';

/** v21 Exit popup: "Is the call complete?" Yes / No; ✖ stays on the case. */
@Component({
  selector: 'app-exit-dialog',
  imports: [MatDialogModule, RecordDialogFrame, CaseIdentity],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-record-dialog-frame
      title="Exit"
      [icon]="null"
      [isNew]="true"
      [cancelable]="false"
      [savable]="false"
    >
      <app-case-identity idPrefix="ex" />
      <p class="ex-question" id="ex-question">Is the call complete?</p>
      <div rdFooterStart class="ex-choices" role="group" aria-labelledby="ex-question">
        <button type="button" class="app-button" [mat-dialog-close]="complete">Yes</button>
        <button type="button" class="app-button app-button--cancel" [mat-dialog-close]="incomplete">
          No
        </button>
      </div>
    </app-record-dialog-frame>
  `,
  styles: `
    .ex-question {
      margin: 24px 0 8px;
      font-size: 18px;
      font-weight: 600;
      text-align: center;
    }
    .ex-choices {
      display: flex;
      gap: 12px;
      margin-right: auto;
      margin-left: auto;
    }
  `,
})
export class ExitDialog {
  protected readonly complete: ExitChoice = 'complete';
  protected readonly incomplete: ExitChoice = 'incomplete';
}
