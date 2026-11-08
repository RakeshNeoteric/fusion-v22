import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormRecord, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NotificationService } from '@core/notifications/notification.service';
import { RecordDialogFrame } from '@shared/forms/record-dialog/record-dialog';
import { displayStoredPhone } from '@shared/reference/phone';
import { type LinkColumn, LinkCell, LinkTable } from '@shared/ui/link-table/link-table';
import { CaseIdentity } from '../case-identity';
import { CaseWorkspace } from '../case-workspace';
import { CaseHeldElsewhereError, CaseLifecycle } from './case-lifecycle';
import { type RatingQuestionRow, ratingProgress } from './rating-rules';
import { textOptions } from '@shared/forms/select-field/select-option';
import { SelectField } from '@shared/forms/select-field/select-field';

/** What the popup is opened with: the questions when the opener has loaded them already. */
export interface RatingDialogData {
  readonly rows?: readonly RatingQuestionRow[];
}

/** How the popup ended: answers saved, or saved and the case closed. */
export type RatingOutcome = 'saved' | 'closed';

type LoadState = 'loading' | 'ready' | 'failed';

/**
 * v21 Case Rating popup: the main caller's answers to the client's rating questions. Update
 * saves them; "Close Rating Completed" saves them and closes the case once all are answered.
 */
@Component({
  selector: 'app-rating-dialog',
  imports: [ReactiveFormsModule, RecordDialogFrame, CaseIdentity, LinkTable, LinkCell, SelectField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rating-dialog.html',
  styleUrl: './rating-dialog.css',
})
export class RatingDialog {
  private readonly data = inject<RatingDialogData | null>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<RatingDialog, RatingOutcome>>(MatDialogRef);
  private readonly workspace = inject(CaseWorkspace);
  private readonly lifecycle = inject(CaseLifecycle);
  private readonly notifications = inject(NotificationService);

  private readonly caller = computed(() => this.workspace.details()?.ContactDetails?.[0] ?? null);
  protected readonly contactName = computed(() =>
    `${this.caller()?.FirstName ?? ''} ${this.caller()?.LastName ?? ''}`.trim(),
  );
  protected readonly contactPhone = computed(() =>
    displayStoredPhone(this.caller()?.ContactNumber),
  );
  protected readonly readOnly = this.workspace.readOnly;

  protected readonly state = signal<LoadState>('loading');
  protected readonly rows = signal<readonly RatingQuestionRow[]>([]);
  /** Each question's answers as dropdown choices. */
  protected readonly choices = computed(
    () => new Map(this.rows().map((row) => [row.linkId, textOptions(row.options)])),
  );
  protected readonly answers = new FormRecord<FormControl<string>>({});
  private readonly answerValues = toSignal(this.answers.valueChanges, { initialValue: {} });
  protected readonly progress = computed(() => {
    this.answerValues();
    return ratingProgress(this.rows().map((row) => ({ answer: this.answer(row) })));
  });
  protected readonly saving = signal(false);

  protected readonly columns: readonly LinkColumn<RatingQuestionRow>[] = [
    { header: 'Question', text: (row) => row.question },
    { header: 'Type', text: (row) => row.type },
    { header: 'Answer' },
  ];
  protected readonly rowKey = (row: RatingQuestionRow) => row.linkId;
  protected readonly rowName = (row: RatingQuestionRow) => row.question;

  constructor() {
    const preloaded = this.data?.rows;
    if (preloaded) this.show(preloaded);
    else void this.load();
  }

  protected async load(): Promise<void> {
    this.state.set('loading');
    try {
      this.show(await this.lifecycle.ratingQuestions());
    } catch {
      this.state.set('failed');
    }
  }

  protected control(row: RatingQuestionRow): FormControl<string> {
    return this.answers.controls[String(row.linkId)] ?? new FormControl('', { nonNullable: true });
  }

  /** v21 Update: saves the answers given so far (at least one, and something changed). */
  protected async update(): Promise<void> {
    if (this.progress().answered === 0) {
      this.notifications.warning('Please answer at least one rating question.');
      return;
    }
    if (this.answers.pristine) {
      this.notifications.info('No changes to save.');
      return;
    }
    if (await this.save(false)) {
      this.notifications.success('Rating updated.');
      this.ref.close('saved');
    }
  }

  /** v21 "Close Rating Completed": every question answered, then the case is closed. */
  protected async closeCase(): Promise<void> {
    const { answered, total } = this.progress();
    if (answered < total) {
      this.notifications.warning('Please answer all rating questions before closing.');
      return;
    }
    if (await this.save(true)) {
      this.notifications.success('All rating questions completed. Case closed.');
      this.ref.close('closed');
    }
  }

  private async save(close: boolean): Promise<boolean> {
    if (this.readOnly() || this.saving()) return false;
    this.saving.set(true);
    try {
      const answers = new Map(this.rows().map((row) => [row.linkId, this.answer(row)]));
      await this.lifecycle.saveRatings(this.rows(), answers, close);
      return true;
    } catch (error) {
      if (error instanceof CaseHeldElsewhereError) this.notifications.error(error.message);
      // Otherwise the error interceptor has said why.
      this.saving.set(false);
      return false;
    }
  }

  private show(rows: readonly RatingQuestionRow[]): void {
    for (const row of rows) {
      const control = new FormControl(row.answer, { nonNullable: true });
      if (this.readOnly()) control.disable();
      this.answers.setControl(String(row.linkId), control);
    }
    this.rows.set(rows);
    this.state.set('ready');
  }

  private answer(row: RatingQuestionRow): string {
    return this.answers.controls[String(row.linkId)]?.value.trim() ?? '';
  }
}
