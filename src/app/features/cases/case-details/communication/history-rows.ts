import type { CaseHistoryRecord } from '@api/cases/case.api';
import { utcMoment } from '@shared/reference/date-time';

/** One entry of the case's contact history, as listed. */
export interface HistoryRow {
  readonly id: number;
  readonly createdDate: string;
  readonly user: string;
  readonly type: string;
  readonly note: string;
}

/** v21 Contact History: newest first, each with who wrote it (blank when unknown). */
export function historyRows(
  history: readonly CaseHistoryRecord[],
  userName: (userId: number) => string | null,
): HistoryRow[] {
  const time = (record: CaseHistoryRecord) => utcMoment(record.CreatedDate)?.getTime() ?? 0;
  return [...history]
    .sort((a, b) => time(b) - time(a) || b.CaseHistoryId - a.CaseHistoryId)
    .map((record) => ({
      id: record.CaseHistoryId,
      createdDate: record.CreatedDate,
      user: (record.CreatedByUserId && userName(record.CreatedByUserId)) || '',
      type: record.NoteType ?? '',
      note: record.Note ?? '',
    }));
}

/** The note types in the history, for the filter. */
export function historyTypes(rows: readonly HistoryRow[]): string[] {
  return [...new Set(rows.map((row) => row.type).filter(Boolean))].sort();
}
