import { SeriesColors } from './series-colors';

describe('SeriesColors', () => {
  it('keeps a name on its colour, with reserved names first', () => {
    const colors = new SeriesColors(['Actual', 'Budget']);
    const gauteng = colors.of('Gauteng');
    expect(colors.of('Actual')).toBe('#2a78d6');
    expect(colors.of('Budget')).toBe('#eb6834');
    expect(colors.of('Gauteng')).toBe(gauteng);
    expect(gauteng).not.toBe(colors.of('Limpopo'));
  });

  it('gives grey past the eight colours instead of repeating one', () => {
    const colors = new SeriesColors();
    const given = Array.from({ length: 9 }, (_, index) => colors.of(`S${index}`));
    expect(new Set(given.slice(0, 8)).size).toBe(8);
    expect(given[8]).toBe('#898781');
  });
});
