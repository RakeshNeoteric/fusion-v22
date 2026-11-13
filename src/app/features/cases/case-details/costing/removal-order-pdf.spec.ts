import { pdfTexts } from '../../../../../testing/pdf';
import type { RemovalDocument, RemovalOrder } from './removal-order';
import { removalOrderPdf } from './removal-order-pdf';

const order = (document: RemovalDocument): RemovalOrder => ({
  document,
  logoUrl: 'http://app/images/logo.png',
  letterhead: {
    addressLines: ['28 Sloane Street, Bryanston, 2021'],
    regNo: '2020/391135/07',
    vat: '4740294220',
    telephone: '+27 11 004 6131',
    email: 'info@fusion.co.za',
  },
  phase: 'Phase 1',
  reference: 'REF-9',
  caseNumber: 'C-9',
  authorisedBy: 'Jane Doe',
  dateApproved: '16 June 2026',
  clientName: 'Zulu Insure',
  caseController: 'Carl Ng',
  operator: 'Sipho',
  vehicle: 'GP 1',
  provider: {
    heading: 'Pyramid - 7 North Rd',
    companyRegNo: '2015/1/07',
    vatNumber: '4001',
    designationNumber: 'GMN23',
    telephone: '+27 82 123 4567',
    email: 'ops@pyramid.co.za',
  },
  deceased: {
    name: 'Thabo Mokoena',
    gender: 'Male',
    id: '8001015009087',
    dateOfDeath: '14 June 2026',
    bodyNumber: 'B-7',
    age: '45',
    causeOfDeath: 'Natural',
  },
  removal: {
    from: 'Baragwanath Hospital',
    to: '12 Cold Store Lane',
    date: '17 June 2026',
    upliftRelatives: 'Yes',
    pickUpTime: '09:30',
    relativeNames: 'Lerato Mokoena',
    distance: '42.5 km',
    burialDate: '20 June 2026',
    burialTown: 'Soweto',
    specialInstructions: 'Call first',
  },
  billing: { transport: 631.25, additional: 250, total: 881.25 },
});

const COMMON = [
  'Reference Number',
  'REF-9',
  'C-9',
  'Jane Doe',
  '16 June 2026',
  '2020/391135/07',
  'DECEASED INFORMATION',
  'Thabo Mokoena',
  '8001015009087',
  '45',
  'Natural',
  'Baragwanath Hospital',
  '12 Cold Store Lane',
  '09:30',
  'Lerato Mokoena',
  '42.5 km',
  'Soweto',
  'Call first',
];

describe('removal order documents', () => {
  it('internal: the driver and vehicle, then the mileage and signatures', () => {
    const doc = removalOrderPdf(order('internal'), 'Poppins');
    const texts = pdfTexts(doc.content);
    expect(doc.pageSize).toBe('A4');
    expect(doc.images).toEqual({ logo: 'http://app/images/logo.png' });
    expect(texts).toEqual(
      expect.arrayContaining([
        ...COMMON,
        'Removal Order',
        'TRANSPORTER INFORMATION',
        'Sipho',
        'GP 1',
        'Zulu Insure',
        'Carl Ng',
        'DRIVER NOTES',
        'Mileage at Pick Up :',
        'COLLECTED FROM',
        'DELIVERED TO',
      ]),
    );
    expect(texts).not.toContain('BILLING DETAILS');
    expect(texts).not.toContain('SERVICE PROVIDER INFORMATION');
  });

  it('external: the provider, then what the phase costs', () => {
    const texts = pdfTexts(removalOrderPdf(order('external'), 'Poppins').content);
    expect(texts).toEqual(
      expect.arrayContaining([
        ...COMMON,
        'Removal Order',
        'SERVICE PROVIDER INFORMATION',
        'Pyramid - 7 North Rd',
        '2015/1/07',
        'GMN23',
        'ops@pyramid.co.za',
        'SERVICE PROVIDER NOTES',
        'BILLING DETAILS',
        'R 631.25',
        'R 250.00',
        'R 881.25',
      ]),
    );
    expect(texts).not.toContain('TRANSPORTER INFORMATION');
    expect(texts).not.toContain('COLLECTED FROM');
  });

  it('external: no empty lines leaving gaps in the provider and client boxes', () => {
    const base = order('external');
    const doc = removalOrderPdf(
      { ...base, provider: { ...base.provider, heading: '' } },
      'Poppins',
    );
    const json = JSON.stringify(doc.content);
    // No blank provider heading above Company Reg No.
    expect(json).not.toContain('{"text":"","style":"valueBold"');
    // No spacer line between Client Name and Case Controller.
    expect(json).not.toContain('{"text":"","margin":[0,6,0,0]}');
    expect(pdfTexts(doc.content)).toEqual(
      expect.arrayContaining(['Company Reg No', 'Client Name', 'Case Controller']),
    );
  });

  it('instructions: the external order without its billing', () => {
    const texts = pdfTexts(removalOrderPdf(order('instructions'), 'Poppins').content);
    expect(texts).toEqual(
      expect.arrayContaining([...COMMON, 'Removal Instruction', 'SERVICE PROVIDER INFORMATION']),
    );
    expect(texts).not.toContain('Removal Order');
    expect(texts).not.toContain('BILLING DETAILS');
  });
});
