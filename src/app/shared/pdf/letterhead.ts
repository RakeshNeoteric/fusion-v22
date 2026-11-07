import type { CompanyAddress } from '@api/config/company-details.api';
import { displayStoredPhone } from '@shared/reference/phone';

/** The company's details at the top of its documents (Security / Company Details). */
export interface Letterhead {
  /** Postal address, then physical (one when they are the same). */
  readonly addressLines: readonly string[];
  readonly regNo: string;
  readonly vat: string;
  readonly telephone: string;
  readonly email: string;
}

function addressLine(address: CompanyAddress | undefined): string {
  if (!address) return '';
  return [address.AddressLine1, address.AddressLine2, address.City, address.PostalCode]
    .map((part) => part?.trim() ?? '')
    .filter(Boolean)
    .join(', ');
}

/**
 * The letterhead from the company's addresses: the physical address carries the company's own
 * details. v21 printed made-up details when none were set up, and read only the physical
 * address (twice); these show what is set up.
 */
export function letterhead(addresses: readonly CompanyAddress[]): Letterhead {
  const physical = addresses.find((address) => address.AddressType === 'FMSPhysicalAddress');
  const postal = physical?.IsSameAsPhysicalAddress
    ? undefined
    : addresses.find((address) => address.AddressType === 'FMSPostalAddress');
  const lines = [addressLine(postal), addressLine(physical)].filter(Boolean);
  return {
    addressLines: [...new Set(lines)],
    regNo: physical?.CompanyRegNo?.trim() ?? '',
    vat: physical?.VatNumber?.trim() ?? '',
    telephone: displayStoredPhone(physical?.PhoneNumber),
    email: physical?.Email?.trim() ?? '',
  };
}
