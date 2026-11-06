import { parsePhoneNumberFromString } from 'libphonenumber-js';
import type { ProviderContact } from '@api/services/service-provider.api';
import { e164ToStored, storedToE164 } from '@shared/reference/phone';

/** One contact row as the popup edits it; phone numbers are E.164 (`+27821234567`). */
export interface ContactRow {
  readonly telephone: string;
  readonly name: string;
  readonly fax: string;
  readonly email: string;
  readonly comments: string;
}

/** v21 writes every row as one "Combined" contact. */
const COMBINED = 'Combined';
const SOUTH_AFRICA = '+27';

/** Stored dial code and national number → E.164; '' when there is no number. */
function joinPhone(code: string | null | undefined, national: string | null | undefined): string {
  const digits = (national ?? '').replace(/\D+/g, '').replace(/^0+/, '');
  if (!digits) return '';
  const dial = (code ?? '').trim() || SOUTH_AFRICA;
  return `${dial.startsWith('+') ? dial : `+${dial}`}${digits}`;
}

export function toContactRow(contact: ProviderContact): ContactRow {
  return {
    telephone: joinPhone(contact.Code, contact.Value),
    name: contact.Name ?? '',
    fax: storedToE164(contact.Fax),
    email: contact.Email ?? '',
    comments: contact.Comments ?? '',
  };
}

/**
 * The backend needs `Type`, `Code` and `Value` (non-empty), so a row needs a telephone
 * number; the popup makes it required.
 */
export function toContact(row: ContactRow): ProviderContact {
  const phone = parsePhoneNumberFromString(row.telephone);
  return {
    Id: 0,
    Type: COMBINED,
    Code: phone ? `+${phone.countryCallingCode}` : '',
    Value: phone?.nationalNumber ?? '',
    Mobile: phone?.formatInternational() ?? '',
    Name: row.name.trim(),
    Fax: e164ToStored(row.fax),
    Email: row.email.trim(),
    Comments: row.comments.trim(),
  };
}
