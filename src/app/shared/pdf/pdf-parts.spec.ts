import { TEXT_SIZE, estimateLines } from './pdf-parts';

/** The width that holds `characters` characters of panel text. */
const width = (characters: number) => characters * 0.52 * TEXT_SIZE;

describe('estimateLines', () => {
  it('wraps at spaces, keeping words whole', () => {
    expect(estimateLines('', width(10))).toBe(1);
    expect(estimateLines('one two', width(10))).toBe(1);
    expect(estimateLines('one two three', width(10))).toBe(2);
  });

  it('counts line breaks and breaks words longer than a line', () => {
    expect(estimateLines('one\ntwo', width(10))).toBe(2);
    expect(estimateLines('abcdefghijklmnopqrstuvwxy', width(10))).toBe(3);
  });
});
