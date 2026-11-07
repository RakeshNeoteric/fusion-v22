import { displayStoredPhone, e164ToStored, formatInternationalPhone, storedToE164 } from './phone';

describe('formatInternationalPhone (v21 Transport Operator rule)', () => {
  it('writes a valid local number in international format', () => {
    expect(formatInternationalPhone('082 123 4567', 'ZA')).toBe('+27 82 123 4567');
  });

  it('accepts a number that already has the dialling code', () => {
    expect(formatInternationalPhone('+27 82 123 4567', 'ZA')).toBe('+27 82 123 4567');
    expect(formatInternationalPhone('27821234567', 'ZA')).toBe('+27 82 123 4567');
  });

  it('keeps the digits behind the dialling code when the number is not valid', () => {
    expect(formatInternationalPhone('12-3', 'ZA')).toBe('+27 123');
  });

  it('formats for the branch country when v21 knows it', () => {
    expect(formatInternationalPhone('020 7946 0958', 'GB')).toBe('+44 20 7946 0958');
    expect(formatInternationalPhone('98765 43210', 'IN')).toBe('+91 98765 43210');
  });

  it('treats any other or missing country as South Africa, as v21 does', () => {
    expect(formatInternationalPhone('0821234567', 'BW')).toBe('+27 82 123 4567');
    expect(formatInternationalPhone('0821234567', null)).toBe('+27 82 123 4567');
  });

  it('leaves a blank number blank instead of saving a bare dialling code', () => {
    expect(formatInternationalPhone('', 'ZA')).toBe('');
    expect(formatInternationalPhone(null, 'IN')).toBe('');
    expect(formatInternationalPhone(' - ', null)).toBe('');
  });
});

describe('stored phone numbers (v21: national number, read as South African)', () => {
  it('reads v21 numbers and E.164 ones', () => {
    expect(storedToE164('0821234567')).toBe('+27821234567');
    expect(storedToE164('82 123 4567')).toBe('+27821234567');
    expect(storedToE164('+91 98765 43210')).toBe('+919876543210');
    expect(storedToE164(null)).toBe('');
  });

  it('stores South African numbers as v21 did, others with their country', () => {
    expect(e164ToStored('+27821234567')).toBe('821234567');
    expect(e164ToStored('+919876543210')).toBe('+919876543210');
    expect(e164ToStored('')).toBe('');
  });

  it('shows stored numbers in international format', () => {
    expect(displayStoredPhone('821234567')).toBe('+27 82 123 4567');
    expect(displayStoredPhone('')).toBe('');
  });
});
