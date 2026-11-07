import { Injectable, computed, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CaseApi, type CaseNoteType, type CaseStatus } from '@api/cases/case.api';
import { RatingQuestionOptionApi } from '@api/config/rating-question-option.api';
import { RatingQuestionTypeApi } from '@api/config/rating-question-type.api';
import { SessionService } from '@core/session/session.service';
import { isFinished } from '../../case-setup';
import { CaseWorkspace } from '../case-workspace';
import { type RatingQuestionRow, ratingQuestions, ratingRecords } from './rating-rules';

/** The backend refused to let go of the case: someone else has it open. */
export class CaseHeldElsewhereError extends Error {
  constructor() {
    super('The case is open for another user.');
  }
}

/**
 * What can happen to the open case as a whole (v21 header): exit, close, abort, re-open and
 * re-assign, and the caller's rating that closing needs. Provided by the Case Details page next
 * to its `CaseWorkspace`; the popups only collect what these need.
 */
// eslint-disable-next-line @angular-eslint/use-injectable-provided-in -- one per open case page
@Injectable()
export class CaseLifecycle {
  private readonly api = inject(CaseApi);
  private readonly workspace = inject(CaseWorkspace);
  private readonly session = inject(SessionService);
  private readonly ratingTypes = inject(RatingQuestionTypeApi);
  private readonly ratingOptions = inject(RatingQuestionOptionApi);

  /** Closed and aborted cases can be re-opened by whoever may change cases (v21). */
  readonly canReopen = computed(() => {
    const details = this.workspace.details();
    return (
      !!details &&
      isFinished(details) &&
      !this.workspace.heldByOther() &&
      !this.workspace.viewOnly()
    );
  });

  /**
   * Lets go of the case with this status (`CaseExit`); Closed and Aborted also stamp who
   * closed it and when. Only the user who has the case open may.
   */
  async exit(status: CaseStatus): Promise<void> {
    const details = this.require();
    const reply = await firstValueFrom(this.api.exit(details.CaseDetailId, status));
    // The backend answers 200 either way; only its text says it did nothing.
    if (/in use/i.test(reply)) throw new CaseHeldElsewhereError();
    // Kept here, not reloaded: loading the case would open it for this user again.
    this.workspace.released(status);
  }

  /** v21 Abort: the reason goes in the history (which aborts the case), then the case is let go. */
  async abort(reason: string): Promise<void> {
    await this.note('CaseAbort', reason);
    try {
      await this.exit('Aborted');
    } catch (error) {
      // The history note has aborted it already: show the case as it now is.
      await this.workspace.reload('CaseStatus', 'CaseOpenedBy');
      throw error;
    }
  }

  /** v21 Re-Open: the reason goes in the history, which makes the case Active again. */
  async reopen(reason: string): Promise<void> {
    await this.note('CaseReopen', reason);
    await this.workspace.reload('CaseStatus');
  }

  /**
   * v21 Re-Assign: the case's controller changes (the whole case is saved: v21 sent part of it,
   * wiping the rest) and the change goes in the history, which makes the case Active.
   */
  async reassign(controllerId: number, note: string): Promise<void> {
    await this.workspace.saveCase({ CaseControllerUserId: controllerId });
    await this.note('CaseReAssign', note);
    await this.workspace.reload('CaseStatus');
  }

  /** The client's rating questions with the caller's answers so far. */
  async ratingQuestions(): Promise<RatingQuestionRow[]> {
    const [client, types, options] = await Promise.all([
      this.workspace.loadClient(),
      firstValueFrom(this.ratingTypes.listIncludingDeleted()),
      firstValueFrom(this.ratingOptions.listIncludingDeleted()),
    ]);
    return ratingQuestions(client, { types, options }, this.require().CaseRatings ?? []);
  }

  /**
   * Saves the caller's answers (`answers` by question link, over what was saved). `close` also
   * closes the case and lets it go (v21 "Close Rating Completed").
   */
  async saveRatings(
    rows: readonly RatingQuestionRow[],
    answers: ReadonlyMap<number, string>,
    close: boolean,
  ): Promise<void> {
    const details = this.require();
    const records = ratingRecords(
      rows,
      answers,
      details.CaseDetailId,
      details.ContactDetails?.[0] ?? null,
    );
    await firstValueFrom(this.api.saveRatings(records, close));
    if (close) await this.exit('Closed');
    else await this.workspace.reload('CaseRatings');
  }

  private async note(type: CaseNoteType, text: string): Promise<void> {
    await firstValueFrom(
      this.api.addHistory({
        CaseHistoryId: 0,
        CaseDetailId: this.require().CaseDetailId,
        NoteType: type,
        Note: text,
        CreatedDate: new Date().toISOString(),
        CreatedByUserId: this.session.user()?.id ?? 0,
      }),
    );
  }

  private require() {
    const details = this.workspace.details();
    if (!details) throw new Error('No case is open');
    return details;
  }
}
