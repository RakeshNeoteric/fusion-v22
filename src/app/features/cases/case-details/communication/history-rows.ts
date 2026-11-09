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

/** One field an AutoLog entry records as changed. */
export interface NoteChange {
  readonly field: string;
  readonly from: string;
  readonly to: string;
}

/** `Field: old -> new`, the line the backend writes per changed field (CompareDifferences). */
const CHANGE_LINE = /^([A-Za-z][\w.]*):\s?(.*?)\s?->\s?(.*)$/;

/** `CaseControllerUserId` → `Case Controller User Id` */
function spacedWords(name: string): string {
  const last = name.split('.').pop() ?? name;
  return last.replace(/([a-z\d])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
}

/**
 * The changes an AutoLog note lists, one per line, for showing as a table; null when the
 * note is not such a list (a typed note, an SMS), which is then shown as it is.
 */
export function noteChanges(note: string): NoteChange[] | null {
  const lines = note
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return null;
  const changes: NoteChange[] = [];
  for (const line of lines) {
    const match = CHANGE_LINE.exec(line);
    if (!match) return null;
    const [, field = '', from = '', to = ''] = match;
    changes.push({ field: spacedWords(field), from: from.trim(), to: to.trim() });
  }
  return changes;
}
