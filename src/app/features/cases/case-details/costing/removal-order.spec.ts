import type { CaseCauseOfDeathRecord, CaseFinalFuneralRecord } from '@api/cases/case.api';
import {
  caseDeceased,
  caseDetails,
  casePhase,
  caseTransport,
  clientWithProviders,
  serviceProvider,
} from '../../../../../testing/case.fixtures';
import { clientProviders } from '../client-providers';
import { type RemovalOrderSources, removalDocument, removalOrder } from './removal-order';

const [provider] = clientProviders(
  clientWithProviders(
    serviceProvider(5, 'Pyramid', {
      VATNumber: ' 4001 ',
      CompanyRegNo: '2015/1/07',
      DesignationNumber: 'GMN23',
      OfficeAddress: '7 North Rd',
      ContactDetails: [
        {
          Id: 1,
          Type: 'Combined',
          Code: '+27',
          Value: '821234567',
          Mobile: null,
          Name: 'Manager',
          Fax: null,
          Email: 'ops@pyramid.co.za',
          Comments: null,
        },
      ],
    }),
  ),
);
const internal = { ...provider!, isInternal: true };

const sources = (extra: Partial<RemovalOrderSources> = {}): RemovalOrderSources => ({
  document: 'external',
  details: caseDetails({
    CaseReferenceNumber: 'REF-9',
    CaseNumber: 'C-9',
    CaseDeceasedInfo: caseDeceased({
      FirstName: 'Thabo',
      LastName: 'Mokoena',
      IdNumber: '8001015009087',
      Gender: 'Male',
      DeceasedDateOfBirth: '1980-06-15T00:00:00',
      DeceasedDateOfDeath: '2026-06-14T00:00:00',
      BurialTown: 'Soweto',
    }),
    CaseCauseOfDeath: {
      CauseOfDeathDescription: 'Natural',
      BodyNumber: 'B-7',
    } as CaseCauseOfDeathRecord,
    CaseFinalFuneral: { BurialDate: '2026-06-20T00:00:00' } as CaseFinalFuneralRecord,
  }),
  phase: casePhase({
    PhaseName: 'phase2',
    CollectFrom: 'Baragwanath Hospital',
    RemoveTo: 'AVBOB',
    RemoveToStorageAddress: '12 Cold Store Lane',
    UpliftFamily: 'Yes',
    FirstName: 'Lerato',
    SurName: 'Mokoena',
    TotalKm: 42.5,
    Cost: 100,
    RatePerKm: 12.5,
    AdditionalCost: 250,
    AuthorisedDate: '2026-06-16',
    CaseTransportDetails: caseTransport({
      RemovalDate: '2026-06-17',
      PickupTime: '09:30:00',
      Name: 'Someone Else',
      SpecialInstructions: ' Call first ',
    }),
  }),
  provider,
  logoUrl: 'logo.png',
  letterhead: { addressLines: [], regNo: '', vat: '', telephone: '', email: '' },
  clientName: 'Zulu Insure',
  caseController: 'Carl Ng',
  authorisedBy: 'Jane Doe',
  operator: 'Sipho',
  vehicle: 'GP 1',
  ...extra,
});

describe('removal orders', () => {
  it('sends internal providers the internal order, and others the order or the instructions', () => {
    expect(removalDocument(internal, false)).toBe('internal');
    expect(removalDocument(provider, false)).toBe('external');
    expect(removalDocument(undefined, false)).toBe('external');
    expect(removalDocument(provider, true)).toBe('instructions');
  });

  it('prints the phase, the provider, the deceased and the removal', () => {
    const order = removalOrder(sources());
    expect(order).toMatchObject({
      phase: 'Phase 2',
      reference: 'REF-9',
      caseNumber: 'C-9',
      authorisedBy: 'Jane Doe',
      dateApproved: '16 June 2026',
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
        // As the Transport Operator Check List has them (v21's order swapped them).
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
      // 100 + 12.5 × 42.5 = 631.25
      billing: { transport: 631.25, additional: 250, total: 881.25 },
    });
  });

  it('falls back to what else the case knows, and leaves the rest blank', () => {
    const base = sources();
    const order = removalOrder(
      sources({
        provider: undefined,
        details: caseDetails({
          CaseReferenceNumber: null,
          CaseDeceasedInfo: caseDeceased({
            Initials: 'T',
            LastName: 'Mokoena',
            PassportNumber: 'P123',
          }),
        }),
        phase: {
          ...base.phase,
          RemoveToStorageAddress: null,
          UpliftFamily: null,
          FirstName: null,
          SurName: null,
          Cost: null,
          RatePerKm: null,
          TotalKm: null,
          AdditionalCost: null,
          CollectTelephone: '0821112222',
        },
      }),
    );
    expect(order.reference).toBe('');
    expect(order.provider).toEqual({
      heading: '',
      companyRegNo: '',
      vatNumber: '',
      designationNumber: '',
      telephone: '+27 82 111 2222',
      email: '',
    });
    expect(order.deceased).toMatchObject({ name: 'T Mokoena', id: 'P123', age: '' });
    expect(order.removal).toMatchObject({
      to: 'AVBOB',
      upliftRelatives: '',
      relativeNames: 'Someone Else',
      distance: '',
      burialDate: '',
    });
    expect(order.billing).toEqual({ transport: 0, additional: 0, total: 0 });
  });
});
