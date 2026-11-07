import type { CaseAdditionalCostRecord } from '@api/cases/case.api';
import { pdfTexts } from '../../../../../testing/pdf';
import { type AdditionalCostOrder, additionalCostPo } from './additional-cost-po';

const cost = (extra: Partial<CaseAdditionalCostRecord> = {}): CaseAdditionalCostRecord => ({
  CaseAdditionalCostId: 20,
  CaseDetailId: 4,
  ServiceProviderName: 'Florist',
  ServiceProviderAddress: '1 Rose St\nDurban',
  VATNumber: '4001',
  CompanyRegNo: '2019/1/07',
  Email: 'f@x.com',
  Telephone: '+27 82 123 4567',
  Description: 'Flowers',
  Amount: 300,
  IsDeleted: false,
  ...extra,
});

const order = (costs: CaseAdditionalCostRecord[]): AdditionalCostOrder => ({
  logoUrl: 'http://app/images/logo.png',
  letterhead: {
    addressLines: ['P O Box 1, Bryanston, 2021', '28 Sloane Street, Bryanston, 2021'],
    regNo: '2020/391135/07',
    vat: '4740294220',
    telephone: '+27 11 004 6131',
    email: 'info@fusion.co.za',
  },
  reference: 'REF-1',
  caseNumber: 'C-9',
  dateApproved: '2026-11-07',
  clientName: 'Zulu Insure',
  caseController: 'Carl Ng',
  costs,
});

describe('Additional Cost PO document', () => {
  it('prints the company, the case, each cost and the total on A4 in the given font', () => {
    const doc = additionalCostPo(
      order([
        cost(),
        cost({
          CaseAdditionalCostId: 21,
          ServiceProviderName: 'Caterer',
          Description: 'Tea',
          Amount: 1149.95,
        }),
      ]),
      'Poppins',
    );
    const texts = pdfTexts(doc.content);

    expect(doc.pageSize).toBe('A4');
    expect(doc.defaultStyle).toEqual({ font: 'Poppins', fontSize: 10 });
    expect(doc.images).toEqual({ logo: 'http://app/images/logo.png' });
    expect(texts).toEqual(
      expect.arrayContaining([
        'A division of UniQ Benefit Solutions (Pty) Ltd',
        'P O Box 1, Bryanston, 2021',
        '28 Sloane Street, Bryanston, 2021',
        '2020/391135/07',
        '4740294220',
        '+27 11 004 6131',
        'info@fusion.co.za',
        'Additional Cost Purchase Order',
        'REF-1',
        'C-9',
        '2026-11-07',
        'Florist',
        '1 Rose St\nDurban',
        '2019/1/07',
        '4001',
        '+27 82 123 4567',
        'f@x.com',
        'Zulu Insure',
        'Carl Ng',
        'Flowers',
        'R 300.00',
        'Caterer',
        'Tea',
        'R 1,149.95',
        'Total Additional Cost',
        'R 1,449.95',
      ]),
    );
    expect(texts.filter((text) => text === 'SERVICE PROVIDER INFORMATION')).toHaveLength(2);
    // The case box sits beside the first provider only.
    expect(texts.filter((text) => text === 'Client Name')).toHaveLength(1);
    // v21's made-up designation number is not printed.
    expect(texts).not.toContain('GMN23');
  });

  it('prints blanks, not "null", for details a cost does not have', () => {
    const texts = pdfTexts(
      additionalCostPo(
        order([cost({ VATNumber: null as unknown as string, Description: '' })]),
        'Poppins',
      ).content,
    );
    expect(texts.join(' ')).not.toContain('null');
    expect(texts).toContain('-');
  });
});
