import type { CaseHistoryRecord } from '@api/cases/case.api';
import { historyRows, historyTypes, noteChanges } from './history-rows';

const entry = (
  id: number,
  type: CaseHistoryRecord['NoteType'],
  created: string,
  userId = 7,
): CaseHistoryRecord => ({
  CaseHistoryId: id,
  CaseDetailId: 4,
  NoteType: type,
  Note: `note ${id}`,
  CreatedDate: created,
  CreatedByUserId: userId,
});

const names = (id: number) => (id === 7 ? 'Jane Doe' : null);

describe('historyRows', () => {
  it('lists the newest first (by id when at the same moment), with who wrote each', () => {
    const rows = historyRows(
      [
        entry(1, 'Admin', '2026-11-01T08:00:00'),
        entry(3, 'SMS', '2026-11-02T09:30:00', 9),
        entry(2, null, '2026-11-02T09:30:00'),
      ],
      names,
    );
    expect(rows.map((row) => [row.id, row.user, row.type])).toEqual([
      [3, '', 'SMS'],
      [2, 'Jane Doe', ''],
      [1, 'Jane Doe', 'Admin'],
    ]);
  });

  it('offers the types present, once each', () => {
    const rows = historyRows(
      [
        entry(1, 'SMS', '2026-11-01'),
        entry(2, 'Admin', '2026-11-02'),
        entry(3, 'SMS', '2026-11-03'),
      ],
      names,
    );
    expect(historyTypes(rows)).toEqual(['Admin', 'SMS']);
  });
});

describe('noteChanges', () => {
  it('reads the backend’s change lines, with readable field names', () => {
    const note =
      'CaseControllerUserId: louisa@fms.co.za -> \r\nCaseOpenedBy:  -> dayakar@neo.com\nAgentId: a -> b';
    expect(noteChanges(note)).toEqual([
      { field: 'Case Controller User Id', from: 'louisa@fms.co.za', to: '' },
      { field: 'Case Opened By', from: '', to: 'dayakar@neo.com' },
      { field: 'Agent Id', from: 'a', to: 'b' },
    ]);
  });

  it('keeps a value that has its own arrow or colon in the new value', () => {
    expect(noteChanges('Comments: none -> Called at 10:30 -> then left')).toEqual([
      { field: 'Comments', from: 'none', to: 'Called at 10:30 -> then left' },
    ]);
  });

  it('leaves other notes as they are', () => {
    expect(noteChanges('Family called back')).toBeNull();
    expect(noteChanges('Case Opened')).toBeNull();
    expect(noteChanges('Status: done -> ok\nThen the family called')).toBeNull();
    expect(noteChanges('  ')).toBeNull();
  });
});
