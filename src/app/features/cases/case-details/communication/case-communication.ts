import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  CaseApi,
  type CaseEmail,
  type CaseHistoryRecord,
  type CaseNoteType,
  type CaseSms,
} from '@api/cases/case.api';
import { SessionService } from '@core/session/session.service';
import { CaseWorkspace } from '../case-workspace';

/**
 * The open case's contact history and messages (v21 Contact History, SMS / Email): notes,
 * SMS and emails, each kept in the case history. Provided by the Case Details page.
 */
// eslint-disable-next-line @angular-eslint/use-injectable-provided-in -- one per open case page
@Injectable()
export class CaseCommunication {
  private readonly api = inject(CaseApi);
  private readonly workspace = inject(CaseWorkspace);
  private readonly session = inject(SessionService);

  /** The history as it is now: others, and the backend, add to it while the case is open. */
  refreshHistory(): Promise<void> {
    return this.workspace.reload('CaseHistory');
  }

  /**
   * Adds a note by this user. v21 posted it to `CaseHistory/{caseId}`, which overwrote
   * whichever history entry had that id.
   */
  async addNote(type: CaseNoteType, text: string): Promise<void> {
    await firstValueFrom(this.api.addHistory(this.note(type, text)));
    await this.refreshHistory();
  }

  async sendSms(sms: CaseSms): Promise<void> {
    await firstValueFrom(this.api.sendSms(this.require(), sms));
    await this.refreshHistory();
  }

  async sendEmail(email: CaseEmail): Promise<void> {
    await firstValueFrom(this.api.sendEmail(this.require(), email));
    await this.refreshHistory();
  }

  /** A new history entry for the open case, by the signed-in user. */
  note(type: CaseNoteType, text: string): CaseHistoryRecord {
    return {
      CaseHistoryId: 0,
      CaseDetailId: this.require().CaseDetailId,
      NoteType: type,
      Note: text,
      CreatedDate: new Date().toISOString(),
      CreatedByUserId: this.session.user()?.id ?? 0,
    };
  }

  private require() {
    const details = this.workspace.details();
    if (!details) throw new Error('No case is open');
    return details;
  }
}
