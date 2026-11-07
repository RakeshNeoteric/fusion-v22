import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { NotificationService } from '@core/notifications/notification.service';
import { UserDirectoryService } from '@core/session/user-directory.service';
import { RecordDialogFrame } from '@shared/forms/record-dialog/record-dialog';
import { displayDate, localParts } from '@shared/reference/date-time';
import { CaseIdentity } from '../case-identity';
import { CaseWorkspace } from '../case-workspace';
import { CaseLifecycle } from './case-lifecycle';

/** v21 role whose users can run a case. */
const CONTROLLER_ROLE = 'Case Controller';

/**
 * v21 Re-Assign popup: who runs the case now, and who should. The change is kept in the case
 * history ("Reassigned from … to …"). Closes with `true` once reassigned.
 */
@Component({
  selector: 'app-reassign-dialog',
  imports: [ReactiveFormsModule, RecordDialogFrame, CaseIdentity],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="assign()" novalidate>
      <app-record-dialog-frame
        title="Re-Assign"
        [isNew]="true"
        saveLabel="Assign Case Controller"
        [saving]="saving()"
      >
        <app-case-identity idPrefix="ra" />
        <div class="form-row">
          <div class="form-field">
            <label for="ra-created">Case Created</label>
            <input id="ra-created" type="text" [value]="created" disabled />
          </div>
          <div class="form-field">
            <label for="ra-current">Case Controller</label>
            <input id="ra-current" type="text" [value]="current()" disabled />
          </div>
        </div>
        <div class="form-row">
          <div class="form-field">
            <label for="ra-controller">
              Re-Assign Controller <span class="required">*</span>
            </label>
            <select id="ra-controller" formControlName="controller">
              <option [ngValue]="null" disabled>-- Select --</option>
              @for (option of options(); track option.id) {
                <option [ngValue]="option.id">{{ option.label }}</option>
              }
            </select>
            @if (controller.touched && controller.invalid) {
              <span class="field-error">Select the case controller.</span>
            }
          </div>
        </div>
      </app-record-dialog-frame>
    </form>
  `,
})
export class ReassignDialog {
  private readonly ref = inject<MatDialogRef<ReassignDialog, true>>(MatDialogRef);
  private readonly workspace = inject(CaseWorkspace);
  private readonly lifecycle = inject(CaseLifecycle);
  private readonly users = inject(UserDirectoryService);
  private readonly notifications = inject(NotificationService);

  private readonly currentId = computed(
    () => this.workspace.details()?.CaseControllerUserId || null,
  );
  /** Stored in UTC; shown as the local day (v21 showed the date only). */
  protected readonly created = displayDate(localParts(this.workspace.details()?.CreatedDate).date);
  protected readonly current = computed(() => this.nameOf(this.currentId()));
  protected readonly options = computed(() => this.users.optionsForRole(CONTROLLER_ROLE));
  protected readonly saving = signal(false);
  protected readonly controller = new FormControl<number | null>(null, Validators.required);
  protected readonly form = new FormGroup({ controller: this.controller });

  protected async assign(): Promise<void> {
    const chosen = this.controller.value;
    if (this.saving()) return;
    if (chosen === null) {
      this.controller.markAsTouched();
      this.notifications.warning('Please fill in all required fields.');
      return;
    }
    if (chosen === this.currentId()) {
      this.notifications.info('This case is already assigned to the selected controller.');
      return;
    }
    this.saving.set(true);
    const from = this.current();
    const to = this.nameOf(chosen);
    try {
      await this.lifecycle.reassign(chosen, `Reassigned from "${from}" to "${to}"`);
      this.notifications.success(`Case reassigned to ${to}.`);
      this.ref.close(true);
    } catch {
      // The error interceptor has said why.
      this.saving.set(false);
    }
  }

  private nameOf(userId: number | null): string {
    return (userId && this.users.displayName(userId)) || 'Unassigned';
  }
}
