import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { CaseWorkspace } from './case-workspace';

/**
 * The open case's reference and number, read-only, at the top of the v21 case popups
 * (complaint, exit, abort, re-open, re-assign, rating). Sits inside a popup's form fields.
 */
@Component({
  selector: 'app-case-identity',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'form-row' },
  template: `
    <div class="form-field">
      <label [for]="idPrefix() + '-reference'">Case Reference Number</label>
      <input
        type="text"
        [id]="idPrefix() + '-reference'"
        [value]="details()?.CaseReferenceNumber ?? ''"
        disabled
      />
    </div>
    <div class="form-field">
      <label [for]="idPrefix() + '-number'">Case Number</label>
      <input
        type="text"
        [id]="idPrefix() + '-number'"
        [value]="details()?.CaseNumber ?? ''"
        disabled
      />
    </div>
  `,
})
export class CaseIdentity {
  /** Prefix of the two inputs' ids, unique per popup (e.g. `cp` gives `cp-reference`). */
  readonly idPrefix = input.required<string>();
  protected readonly details = inject(CaseWorkspace).details;
}
