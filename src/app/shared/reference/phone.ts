import { type CountryCode, parsePhoneNumberFromString } from 'libphonenumber-js';

interface Dialling {
  readonly iso: CountryCode;
  readonly dial: string;
}

const SOUTH_AFRICA: Dialling = { iso: 'ZA', dial: '+27' };

/**
 * Countries v21 meant to format phone numbers for; any other country is formatted as
 * South African, as in v21. (v21 looked these up by label, so the US and UK never
 * matched and fell back to +27; here they are matched by ISO code.)
 */
const DIALLING: Readonly<Record<string, Dialling>> = {
  ZA: SOUTH_AFRICA,
  IN: { iso: 'IN', dial: '+91' },
  US: { iso: 'US', dial: '+1' },
  CA: { iso: 'CA', dial: '+1' },
  GB: { iso: 'GB', dial: '+44' },
};

/**
 * v21 Transport Operator phone rule: keep the digits, drop a leading dialling code,
 * then write it in international format (`+27 82 123 4567`) when it is a valid number,
 * otherwise as `+27 <digits>`.
 */
export function formatInternationalPhone(
  phone: string | null | undefined,
  countryCode: string | null | undefined,
): string {
  const { iso, dial } = (countryCode && DIALLING[countryCode]) || SOUTH_AFRICA;
  let digits = (phone ?? '').replace(/\D+/g, '');
  const dialDigits = dial.slice(1);
  if (digits.startsWith(dialDigits)) digits = digits.slice(dialDigits.length);
  // No number at all stays empty (v21 saved a bare "+27").
  if (!digits) return '';

  const parsed = parsePhoneNumberFromString(digits, iso);
  return parsed?.isValid() ? parsed.formatInternational() : `${dial} ${digits}`.trim();
}

/**
 * v21 stored client and fax numbers as the national number only (`821234567`), read as South
 * African. Numbers elsewhere are stored in E.164 (`+919876543210`) so their country is kept.
 * Returns E.164 for the phone field, '' when empty.
 */
export function storedToE164(stored: string | null | undefined): string {
  const value = (stored ?? '').trim();
  if (!value) return '';
  if (value.startsWith('+')) return value.replace(/[^\d+]/g, '');
  const digits = value.replace(/\D+/g, '').replace(/^0+/, '');
  return digits ? `+27${digits}` : '';
}

/** The reverse of {@link storedToE164}. */
export function e164ToStored(e164: string | null | undefined): string {
  const phone = e164 ? parsePhoneNumberFromString(e164) : undefined;
  if (!phone) return (e164 ?? '').trim();
  return phone.countryCallingCode === '27' ? phone.nationalNumber : phone.number;
}

/** A stored number for showing, e.g. `+27 82 123 4567`; as stored when it does not parse. */
export function displayStoredPhone(stored: string | null | undefined): string {
  const e164 = storedToE164(stored);
  const phone = e164 ? parsePhoneNumberFromString(e164) : undefined;
  return phone ? phone.formatInternational() : (stored ?? '').trim();
}
