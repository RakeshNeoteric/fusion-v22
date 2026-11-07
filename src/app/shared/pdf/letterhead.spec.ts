import type { CompanyAddress } from '@api/config/company-details.api';
import { COMPANY_ADDRESSES } from '../../../testing/case.fixtures';
import { letterhead } from './letterhead';

const [physical, postal] = COMPANY_ADDRESSES as [CompanyAddress, CompanyAddress];

describe('letterhead', () => {
  it('prints the postal then the physical address, with the physical address details', () => {
    expect(letterhead(COMPANY_ADDRESSES)).toEqual({
      addressLines: ['P O Box 71516, Bryanston, 2021', '28 Sloane Street, Bryanston, 2021'],
      regNo: '2020/391135/07',
      vat: '4740294220',
      telephone: '+27 11 004 6131',
      email: 'info@fusion.co.za',
    });
  });

  it('prints one address when the postal address is the physical one', () => {
    const same = { ...physical, IsSameAsPhysicalAddress: true };
    expect(letterhead([same, postal]).addressLines).toEqual(['28 Sloane Street, Bryanston, 2021']);
  });

  it('prints blanks, not made-up details, when the company is not set up', () => {
    expect(letterhead([])).toEqual({
      addressLines: [],
      regNo: '',
      vat: '',
      telephone: '',
      email: '',
    });
  });
});
