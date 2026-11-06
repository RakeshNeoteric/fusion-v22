import { noteText } from './note-text';

describe('noteText', () => {
  it('keeps the text of the note and drops the markup (v21 NotePlain)', () => {
    expect(noteText('<p>Call the <strong>family</strong> first.</p>')).toBe(
      'Call the family first.',
    );
  });

  it('is empty for no note', () => {
    expect(noteText(null)).toBe('');
    expect(noteText('')).toBe('');
  });

  it('never runs anything in the note', () => {
    const onerror = vi.fn();
    (globalThis as Record<string, unknown>)['noteTextProbe'] = onerror;
    expect(
      noteText('<img src="x" onerror="noteTextProbe()">Hi<script>noteTextProbe()</script>'),
    ).toBe('HinoteTextProbe()');
    expect(onerror).not.toHaveBeenCalled();
  });
});
