import type { CaseDetails, CaseInit, CaseInitService } from '@api/cases/case.api';

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
export const CASE_INIT: CaseInit = {
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
