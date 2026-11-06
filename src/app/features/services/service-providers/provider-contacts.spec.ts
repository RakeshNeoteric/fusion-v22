import type { ProviderContact } from '@api/services/service-provider.api';
import { toContact, toContactRow } from './provider-contacts';

const stored: ProviderContact = {
  Id: 0,
  Type: 'Combined',
  Code: '+27',
  Value: '821234567',
  Mobile: '+27 82 123 4567',
  Name: 'Jane',
  Fax: '0115551234',
  Email: 'jane@example.com',
  Comments: 'Office hours',
};

describe('provider contacts', () => {
  it('reads v21 rows: telephone from code and number, fax as South African', () => {
    expect(toContactRow(stored)).toEqual({
      telephone: '+27821234567',
      name: 'Jane',
      fax: '+27115551234',
      email: 'jane@example.com',
      comments: 'Office hours',
    });
  });

  it('writes rows the way v21 stores them', () => {
    expect(toContact(toContactRow(stored))).toEqual({ ...stored, Fax: '115551234' });
  });

  it('keeps the country of a fax outside South Africa', () => {
    const row = { ...toContactRow(stored), telephone: '+919876543210', fax: '+912212345678' };
    const contact = toContact(row);
    expect(contact).toMatchObject({ Code: '+91', Value: '9876543210', Fax: '+912212345678' });
    expect(toContactRow(contact).fax).toBe('+912212345678');
  });
});
