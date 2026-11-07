import { ageAtDeath } from './age-at-death';

describe('ageAtDeath', () => {
  it('counts whole years, waiting for the birthday', () => {
    expect(ageAtDeath('1980-06-15', '2026-06-14')).toBe(45);
    expect(ageAtDeath('1980-06-15', '2026-06-15')).toBe(46);
    expect(ageAtDeath('1980-06-15', '1980-06-15')).toBe(0);
  });

  it('has no age without both dates, or when death is before birth', () => {
    expect(ageAtDeath('', '2026-01-01')).toBeNull();
    expect(ageAtDeath('1980-01-01', '')).toBeNull();
    expect(ageAtDeath('1980-01-02', '1980-01-01')).toBeNull();
  });
});
