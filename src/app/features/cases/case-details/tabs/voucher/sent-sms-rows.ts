import type { CaseHistoryRecord } from '@api/cases/case.api';
import { utcMoment } from '@shared/reference/date-time';

/** One SMS sent about the case, as the Sent SMS Info table lists it. */
export interface SentSmsRow {
  readonly id: number;
  readonly message: string;
  /** '' when the backend did not keep it (it keeps the number only for a texted note). */
  readonly mobile: string;
  /** When it was sent, as stored. */
  readonly sentAt: string;
  readonly sentBy: string;
}

/** A texted note: the backend stores it as `+27821234567:the message`. */
const TEXTED_NOTE = /^(\+?\d[\d ]{7,}\d):([\s\S]*)$/;

/**
 * The SMS sent about the case, newest first, from its history: `SMS` entries, and notes the
 * backend texted to a number (it stores those as `number:message`). The backend keeps no other
 * record of an SMS per case: its SMS table has no case, and the voucher SMS it sends on approval
 * are not written to the case history. (v21 showed a made-up sample row instead.)
 */
export function sentSmsRows(
  history: readonly CaseHistoryRecord[],
  userName: (userId: number) => string | null,
): SentSmsRow[] {
  const time = (record: CaseHistoryRecord) => utcMoment(record.CreatedDate)?.getTime() ?? 0;
  const rows: { record: CaseHistoryRecord; mobile: string; message: string }[] = [];
  for (const record of history) {
    const note = record.Note ?? '';
    if (record.NoteType === 'SMS') {
      rows.push({ record, mobile: '', message: note });
    } else if (record.NoteType === 'Note') {
      const texted = TEXTED_NOTE.exec(note);
      if (texted) rows.push({ record, mobile: texted[1] ?? '', message: texted[2] ?? '' });
    }
  }
  return rows
    .sort(
      (a, b) => time(b.record) - time(a.record) || b.record.CaseHistoryId - a.record.CaseHistoryId,
    )
    .map(({ record, mobile, message }) => ({
      id: record.CaseHistoryId,
      message: message.trim(),
      mobile: mobile.replace(/\s/g, ''),
      sentAt: record.CreatedDate,
      sentBy: (record.CreatedByUserId && userName(record.CreatedByUserId)) || '',
    }));
}
