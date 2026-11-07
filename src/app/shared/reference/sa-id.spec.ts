import { birthDateFromSaId, genderFromSaId, saIdProblem } from './sa-id';

describe('South African ID numbers', () => {
  const today = new Date(2026, 10, 6);

  it('accepts a valid number and reads its date of birth', () => {
    expect(saIdProblem('8001015009087')).toBeNull();
    expect(birthDateFromSaId('8001015009087', today)).toBe('1980-01-01');
    expect(birthDateFromSaId('0501015009084', today)).toBe('2005-01-01');
  });

  it('says what is wrong', () => {
    expect(saIdProblem('')).toBeNull();
    expect(saIdProblem('12345')).toBe('digits13');
    expect(saIdProblem('8013015009087')).toBe('birthDate');
    expect(saIdProblem('8001015009088')).toBe('checksum');
  });

  it('reads the sex from digits 7 to 10 of a valid number', () => {
    expect(genderFromSaId('8001015009087')).toBe('Male');
    expect(genderFromSaId('8001014009088')).toBe('Female');
    expect(genderFromSaId('8001015009088')).toBe('');
    expect(genderFromSaId(null)).toBe('');
  });
});
