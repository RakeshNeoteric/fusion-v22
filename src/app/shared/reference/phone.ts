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

  const parsed = parsePhoneNumberFromString(digits, iso);
  return parsed?.isValid() ? parsed.formatInternational() : `${dial} ${digits}`.trim();
}
