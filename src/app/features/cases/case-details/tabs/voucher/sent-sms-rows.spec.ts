import type { CaseHistoryRecord } from '@api/cases/case.api';
import { sentSmsRows } from './sent-sms-rows';

const entry = (
  id: number,
  type: CaseHistoryRecord['NoteType'],
  note: string,
  date = '2026-11-01T10:00:00',
): CaseHistoryRecord => ({
  CaseHistoryId: id,
  CaseDetailId: 4,
  NoteType: type,
  Note: note,
  CreatedDate: date,
  CreatedByUserId: 7,
});

const names = (id: number) => (id === 7 ? 'Jane Doe' : null);

describe('sentSmsRows', () => {
  it('lists SMS entries and texted notes, newest first, with who sent them', () => {
    const rows = sentSmsRows(
      [
        entry(1, 'SMS', 'Your voucher is ready.', '2026-11-01T09:00:00'),
        entry(2, 'Note', '+27821234567:We will call you back.', '2026-11-02T09:00:00'),
        entry(3, 'Admin', 'Not an SMS'),
      ],
      names,
    );
    expect(rows).toEqual([
      {
        id: 2,
        message: 'We will call you back.',
        mobile: '+27821234567',
        sentAt: '2026-11-02T09:00:00',
        sentBy: 'Jane Doe',
      },
      {
        id: 1,
        message: 'Your voucher is ready.',
        mobile: '',
        sentAt: '2026-11-01T09:00:00',
        sentBy: 'Jane Doe',
      },
    ]);
  });

  it('leaves out notes that were not texted to a number', () => {
    expect(sentSmsRows([entry(1, 'Note', 'Called the family: no answer.')], names)).toEqual([]);
  });

  it('keeps a message that has colons in it', () => {
    const [row] = sentSmsRows([entry(1, 'Note', '0821234567:Time: 10:00')], names);
    expect(row?.mobile).toBe('0821234567');
    expect(row?.message).toBe('Time: 10:00');
  });
});
