import type {
  CaseDeceasedRecord,
  CasePhaseRecord,
  CaseTransportRecord,
  CaseDetails,
  CaseInit,
  CaseInitService,
  CaseValidationRecord,
} from '@api/cases/case.api';
import type { ClientWithLinks } from '@api/clients/client.api';
import type { CompanyAddress } from '@api/config/company-details.api';
import type { ServiceProvider } from '@api/services/service-provider.api';

export const caseService = (
  id: number,
  name: string,
  code: string,
  extra: Partial<CaseInitService> = {},
): CaseInitService => ({
  ServiceId: id,
  ServiceName: name,
  ServiceTypeCode: code,
  IsVoucherService: false,
  IsActive: true,
  IsDeleted: false,
  ...extra,
});

/** `GET CaseInit`: Zulu Insure (Funeral, Groceries, a deleted and an inactive service), Acme, Gone. */
const companyAddress = (
  type: CompanyAddress['AddressType'],
  extra: Partial<CompanyAddress> = {},
): CompanyAddress => ({
  AddressId: type === 'FMSPhysicalAddress' ? 1 : 2,
  AddressType: type,
  CompanyName: null,
  ContactName: null,
  AddressLine1: null,
  AddressLine2: null,
  City: null,
  State: null,
  PostalCode: null,
  Country: 'ZA',
  PhoneNumber: null,
  Fax: null,
  Email: null,
  CompanyRegNo: null,
  VatNumber: null,
  LogoStoragePath: null,
  IsSameAsPhysicalAddress: false,
  ...extra,
});

/** The company's addresses, as Security / Company Details sets them up. */
export const COMPANY_ADDRESSES: readonly CompanyAddress[] = [
  companyAddress('FMSPhysicalAddress', {
    CompanyName: 'Fusion Funerals',
    AddressLine1: '28 Sloane Street',
    City: 'Bryanston',
    PostalCode: '2021',
    PhoneNumber: '110046131',
    Email: 'info@fusion.co.za',
    CompanyRegNo: '2020/391135/07',
    VatNumber: '4740294220',
  }),
  companyAddress('FMSPostalAddress', {
    AddressLine1: 'P O Box 71516',
    City: 'Bryanston',
    PostalCode: '2021',
  }),
];

export const CASE_INIT: CaseInit = {
  Address: COMPANY_ADDRESSES,
  ClientDto: [
    {
      ClientId: 1,
      ClientName: 'Zulu Insure',
      IsActive: true,
      IsDeleted: false,
      ClientServices: [
        {
          ClientServiceId: 10,
          ServiceId: 5,
          IsDeleted: false,
          ServiceDto: caseService(5, 'Funeral', 'FUN'),
        },
        {
          ClientServiceId: 11,
          ServiceId: 6,
          IsDeleted: false,
          ServiceDto: caseService(6, 'Groceries', 'AVS', { IsVoucherService: true }),
        },
        {
          ClientServiceId: 12,
          ServiceId: 7,
          IsDeleted: true,
          ServiceDto: caseService(7, 'Towing', 'TOW'),
        },
        {
          ClientServiceId: 13,
          ServiceId: 8,
          IsDeleted: false,
          ServiceDto: caseService(8, 'Old', 'OLD', { IsActive: false }),
        },
      ],
    },
    { ClientId: 2, ClientName: 'Acme', IsActive: true, IsDeleted: false, ClientServices: [] },
    { ClientId: 3, ClientName: 'Gone', IsActive: false, IsDeleted: false, ClientServices: [] },
  ],
  ServiceTypeBasedTabs: [
    { ServiceTypeCode: 'FUN', TabNames: 'Caller, deceased-info,phase1,phase2, nonsense, caller' },
  ],
};

export const caseDetails = (extra: Partial<CaseDetails> = {}): CaseDetails => ({
  CaseDetailId: 1,
  CaseStatus: 'Active',
  CaseReferenceNumber: 'REF1',
  CaseNumber: 'C1',
  CaseClientId: 1,
  CaseClientServiceId: 5,
  CaseControllerUserId: 0,
  AgentId: 0,
  CaseOpenedBy: null,
  CaseOpenDate: null,
  CreatedDate: '2026-11-01T00:00:00',
  ContactDetails: null,
  CaseDeceasedInfo: null,
  CaseFinalFuneral: null,
  ...extra,
});

export const caseDeceased = (extra: Partial<CaseDeceasedRecord> = {}): CaseDeceasedRecord => ({
  CaseDeceasedInfoId: 30,
  CaseDetailId: 1,
  PolicyNumber: null,
  Initials: null,
  FirstName: null,
  LastName: null,
  RelationshipToPolicyHolder: null,
  IsIdNumberAvailable: null,
  IdNumber: null,
  PassportNumber: null,
  Gender: null,
  DeceasedDateOfBirth: null,
  DeceasedDateOfDeath: null,
  PlaceOfDeath: null,
  DeathProvince: null,
  BodyLocation: null,
  BodyLocationProvince: null,
  LocationType: null,
  TelephoneNumber: null,
  BurialTown: null,
  BurialTownProvince: null,
  Country: 'ZA',
  ...extra,
});

export const caseValidation = (
  extra: Partial<CaseValidationRecord> = {},
): CaseValidationRecord => ({
  CaseValidationId: 40,
  CaseDetailId: 1,
  ClientId: 1,
  PolicyNumber: 'POL-1',
  MembershipNumber: null,
  PolicyHolderFirstName: 'Mary',
  PolicyHolderSurName: 'Moyo',
  IsIDNumberAvbl: null,
  PolicyHolderIdNumber: null,
  PassportNumber: null,
  RelationshipToPolicyHolder: null,
  PolicyHolderDOB: '0001-01-01',
  ValidationMethod: null,
  ValidationOther: null,
  IsWebSiteVerification: null,
  IsMemberCertificate: null,
  IsTelephonically: null,
  IsBenefitValid: null,
  ValidatedOn: null,
  DateOfDeath: null,
  ValidatedBy: null,
  DeceaseId: null,
  ...extra,
});

export const casePhase = (extra: Partial<CasePhaseRecord> = {}): CasePhaseRecord => ({
  CasePhaseDetailsId: 60,
  CaseDetailId: 1,
  PhaseName: 'phase1',
  CollectFrom: '',
  CollectServiceProviderId: 0,
  ManagerName: '',
  CollectPhysicalAddress: null,
  CollectStorageAddress: null,
  CollectTelephone: null,
  CollectFaxNumber: null,
  PhaseEndDate: null,
  IsActive: true,
  RemoveTo: '',
  RemoveServiceProviderId: 0,
  FirstName: null,
  SurName: null,
  RemoveToPhysicalAddress: null,
  RemoveToStorageAddress: null,
  RemoveTelephone: null,
  RemoveFaxNumber: null,
  RemoveContactNumber: null,
  UpliftFamily: null,
  Cost: null,
  RatePerKm: null,
  TotalKm: null,
  AdditionalCost: null,
  AdditionalCostNotes: null,
  AuthorisedDate: null,
  AuthorisedByUserId: null,
  AuthorisedByNumber: null,
  VehicleId: null,
  TransportOperatorId: null,
  IsTransportNotified: null,
  VehicleDispatched: null,
  CaseTransportDetails: null,
  ...extra,
});

export const caseTransport = (extra: Partial<CaseTransportRecord> = {}): CaseTransportRecord => ({
  CaseTransportDetailsId: 90,
  CaseDetailId: 1,
  CasePhaseDetailsId: 60,
  IsMortuaryFeesPaid: null,
  DeceasedTransportMethod: null,
  IsReceivingFuneralHomeAlerted: null,
  RemovalDate: null,
  PickupTime: null,
  FromOfficeTelephone: null,
  FromTelephone: null,
  ToOfficeTelephone: null,
  ToTelephone: null,
  Name: null,
  Telephone: null,
  IsShortPayorRequired: null,
  IsAdvisedSleepoverRequired: null,
  IsAdvisedRemovalToFuneralHome: null,
  SpecialInstructions: null,
  ...extra,
});

/** A service provider with one "Combined" contact (manager, telephone and fax). */
export const serviceProvider = (
  id: number,
  name: string,
  extra: Partial<ServiceProvider> = {},
): ServiceProvider =>
  ({
    ServiceProviderId: id,
    Name: name,
    Province: 'Gauteng',
    OfficeAddress: `${id} Main Road`,
    StorageAddress: `${id} Cold Store`,
    IsActive: true,
    IsDeleted: false,
    IsInternalServiceProvider: false,
    RatePerKm: 12.5,
    ContactDetails: [
      {
        Id: 1,
        Type: 'Combined',
        Code: '+27',
        Value: '821234567',
        Mobile: null,
        Name: `Manager ${id}`,
        Fax: '0114567890',
        Email: null,
      },
    ],
    ...extra,
  }) as ServiceProvider;

/** Client 1 with these service providers linked (`GET Client?Id=1`). */
export const clientWithProviders = (...providers: ServiceProvider[]): ClientWithLinks =>
  ({
    ClientId: 1,
    ClientServiceProvider: providers.map((dto, index) => ({
      ClientServiceProviderId: index + 1,
      ClientId: 1,
      ServiceProviderId: dto.ServiceProviderId,
      IsDeleted: false,
      ServiceProviderDto: dto,
    })),
  }) as unknown as ClientWithLinks;
