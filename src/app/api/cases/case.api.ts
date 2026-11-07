import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import type { CompanyAddress } from '@api/config/company-details.api';
import type { CaseVoucherRecord } from '@api/vouchers/voucher.api';

/** Backend `CaseStatus`, sent as its name. */
export const CASE_STATUSES = ['New', 'Active', 'Pending', 'Closed', 'Aborted'] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

/** A caller on the case (backend `ContactDetails`, stored as JSON); the first is the main caller. */
export interface CaseContact {
  readonly Id: number;
  readonly FirstName: string | null;
  readonly LastName: string | null;
  readonly Email: string | null;
  readonly ContactNumber: string | null;
  readonly Relationship: string | null;
}

/**
 * Backend `CaseDeceasedInfo`: one per case. Policy Details and Validation edit its names, ID and
 * date of birth; Deceased Info (phase 7c) edits the rest. Saves send the whole record back.
 */
export interface CaseDeceasedRecord {
  readonly CaseDeceasedInfoId: number;
  readonly CaseDetailId: number;
  readonly PolicyNumber: string | null;
  readonly Initials: string | null;
  readonly FirstName: string | null;
  readonly LastName: string | null;
  readonly RelationshipToPolicyHolder: string | null;
  readonly IsIdNumberAvailable: boolean | null;
  readonly IdNumber: string | null;
  readonly PassportNumber: string | null;
  readonly Gender: string | null;
  readonly DeceasedDateOfBirth: string | null;
  readonly DeceasedDateOfDeath: string | null;
  readonly PlaceOfDeath: string | null;
  readonly DeathProvince: string | null;
  readonly BodyLocation: string | null;
  readonly BodyLocationProvince: string | null;
  readonly LocationType: string | null;
  readonly TelephoneNumber: string | null;
  readonly BurialTown: string | null;
  readonly BurialTownProvince: string | null;
  readonly Country: string | null;
}

/** The parts of the deceased's details the case list shows. */
export type CaseDeceasedSummary = Pick<CaseDeceasedRecord, 'Initials' | 'FirstName' | 'LastName'>;

/**
 * Backend `CaseValidation`: the policy holder's details, and one row per validation done
 * (method, by whom, when). Rows without a method only hold the policy holder.
 */
export interface CaseValidationRecord {
  readonly CaseValidationId: number;
  readonly CaseDetailId: number;
  readonly ClientId: number | null;
  readonly PolicyNumber: string | null;
  readonly MembershipNumber: string | null;
  readonly PolicyHolderFirstName: string | null;
  readonly PolicyHolderSurName: string | null;
  readonly IsIDNumberAvbl: boolean | null;
  readonly PolicyHolderIdNumber: string | null;
  readonly PassportNumber: string | null;
  readonly RelationshipToPolicyHolder: string | null;
  /** `DateOnly`, never null: `0001-01-01` means not known. Leave it out to keep that. */
  readonly PolicyHolderDOB?: string;
  readonly ValidationMethod: string | null;
  readonly ValidationOther: string | null;
  readonly IsWebSiteVerification: boolean | null;
  readonly IsMemberCertificate: boolean | null;
  readonly IsTelephonically: boolean | null;
  readonly IsBenefitValid: boolean | null;
  readonly ValidatedOn: string | null;
  readonly DateOfDeath: string | null;
  /** The user's AspNetUserId, as text. */
  readonly ValidatedBy: string | null;
  readonly DeceaseId: string | null;
}

/** What the client's policy system says about the deceased (`FetchPolicyDetails`). */
export interface PolicyMatch {
  readonly FullName: string | null;
  readonly IdNumber: string | null;
  /** `yyyyMMdd` as a number. */
  readonly DateOfBirth: number | null;
  readonly PolicyNo: string | null;
  readonly PolicyStatus: string | null;
  readonly RoleType: string | null;
  readonly RoleStatus: string | null;
  readonly CoverAmount: number | null;
  readonly EligibleForRepat: string | null;
}

/** Search for {@link PolicyMatch}es: by the deceased's ID, and optionally a policy number. */
export interface PolicySearch {
  readonly clientId: number;
  readonly deceasedId: string;
  readonly policyNumber: string | null;
  /** `yyyy-MM-dd` */
  readonly dateOfDeath: string | null;
}

/** The causes of death v21 offers; the text is what is stored. */
export const CAUSES_OF_DEATH = ['COVID-19', 'Natural', 'Unknown', 'Unnatural'] as const;

/**
 * Backend `CaseCauseOfDeath`: one per case. The mortuary and post-mortem fields only apply to an
 * unnatural death.
 */
export interface CaseCauseOfDeathRecord {
  readonly CaseCauseOfDeathId: number;
  readonly CaseDetailId: number;
  readonly CauseOfDeathDescription: string | null;
  readonly BodyNumber: string | null;
  readonly TelephoneNumber: string | null;
  readonly CauseOfDeathNotes: string | null;
  readonly MortuaryState: string | null;
  readonly IsPostMortemDone: boolean | null;
  readonly PostMortemPlace: string | null;
  /** kg, up to 999.99. */
  readonly BodyWeight: number | null;
  /** `DateOnly`: `yyyy-MM-dd`. */
  readonly ReleaseDate: string | null;
  /** `TimeOnly`: `HH:mm` (the backend may echo `HH:mm:ss`). */
  readonly ReleaseTime: string | null;
}

/**
 * Backend `CaseFinalFuneral`: one per case. `FuneralParlour` holds the service provider's
 * **name**; province, manager, addresses, telephone and fax are copied from that provider.
 */
export interface CaseFinalFuneralRecord {
  readonly CaseFinalFuneralId: number;
  readonly CaseDetailId: number;
  readonly FuneralHomeName: string | null;
  readonly FuneralParlour: string | null;
  readonly FuneralProvince: string | null;
  readonly ManagerName: string | null;
  readonly BurialDate: string | null;
  readonly PhysicalAddress: string | null;
  readonly StorageAddress: string | null;
  readonly TelephoneNumber: string | null;
  readonly FaxNumber: string | null;
  readonly MobileNumber: string | null;
  readonly Priority: string | null;
}

/** The parts of the final funeral the case list shows (`GET CaseDetails` includes it all). */
export type CaseFuneralSummary = Pick<CaseFinalFuneralRecord, 'BurialDate'>;

/**
 * Backend `CaseTransportDetails`: the Transport Operator Check List of one phase (one per phase:
 * the database refuses a second). Saved inside its phase.
 */
export interface CaseTransportRecord {
  readonly CaseTransportDetailsId: number;
  readonly CaseDetailId: number;
  readonly CasePhaseDetailsId: number;
  readonly IsMortuaryFeesPaid: boolean | null;
  /** `coffin`, `casket` or `transportCoffin` (v21 values). */
  readonly DeceasedTransportMethod: string | null;
  readonly IsReceivingFuneralHomeAlerted: boolean | null;
  /** `DateOnly`: `yyyy-MM-dd`. */
  readonly RemovalDate: string | null;
  /** `TimeOnly`: `HH:mm:ss`. */
  readonly PickupTime: string | null;
  readonly FromOfficeTelephone: string | null;
  readonly FromTelephone: string | null;
  readonly ToOfficeTelephone: string | null;
  readonly ToTelephone: string | null;
  /** The accompanying family member. */
  readonly Name: string | null;
  readonly Telephone: string | null;
  /** v21 spelling: a short prayer. */
  readonly IsShortPayorRequired: boolean | null;
  readonly IsAdvisedSleepoverRequired: boolean | null;
  readonly IsAdvisedRemovalToFuneralHome: boolean | null;
  readonly SpecialInstructions: string | null;
}

/**
 * Backend `CasePhaseDetails`: one leg of moving the deceased, collected by one service provider
 * and removed to another. Phase Costing (7d-2) edits its cost, authorisation and transport.
 * `PhaseName`, `CollectFrom`, `ManagerName` and `RemoveTo` may not be null. Provider ids are 0
 * when none is chosen.
 */
export interface CasePhaseRecord {
  readonly CasePhaseDetailsId: number;
  readonly CaseDetailId: number;
  /** `phase1` … `phase4` */
  readonly PhaseName: string;
  readonly CollectFrom: string;
  readonly CollectServiceProviderId: number;
  readonly ManagerName: string;
  readonly CollectPhysicalAddress: string | null;
  readonly CollectStorageAddress: string | null;
  readonly CollectTelephone: string | null;
  readonly CollectFaxNumber: string | null;
  readonly PhaseEndDate: string | null;
  readonly IsActive: boolean;
  readonly RemoveTo: string;
  readonly RemoveServiceProviderId: number;
  readonly FirstName: string | null;
  readonly SurName: string | null;
  readonly RemoveToPhysicalAddress: string | null;
  readonly RemoveToStorageAddress: string | null;
  readonly RemoveTelephone: string | null;
  readonly RemoveFaxNumber: string | null;
  readonly RemoveContactNumber: string | null;
  /** `Yes` / `No` */
  readonly UpliftFamily: string | null;
  readonly Cost: number | null;
  readonly RatePerKm: number | null;
  readonly TotalKm: number | null;
  readonly AdditionalCost: number | null;
  readonly AdditionalCostNotes: string | null;
  readonly AuthorisedDate: string | null;
  readonly AuthorisedByUserId: number | null;
  readonly AuthorisedByNumber: string | null;
  readonly VehicleId: number | null;
  readonly TransportOperatorId: number | null;
  readonly IsTransportNotified: boolean | null;
  readonly VehicleDispatched: string | null;
  readonly CaseTransportDetails?: CaseTransportRecord | null;
}

/**
 * Backend `CaseAdditionalCost`: a cost outside the phases, paid to another provider. Rows are
 * only added; "Delete" saves the row back with `IsDeleted: true`. The text columns may not be
 * null.
 */
export interface CaseAdditionalCostRecord {
  readonly CaseAdditionalCostId: number;
  readonly CaseDetailId: number;
  readonly ServiceProviderName: string;
  readonly ServiceProviderAddress: string;
  readonly VATNumber: string;
  readonly CompanyRegNo: string;
  readonly Email: string;
  /** International format, e.g. `+27 82 123 4567`, as v21 stored it. */
  readonly Telephone: string;
  readonly Description: string;
  /** Rand, up to 99,999,999.99. */
  readonly Amount: number;
  readonly IsDeleted: boolean | null;
}

/** Backend `Complaint`: logged against a case; complaints are added and viewed, not edited. */
export interface CaseComplaintRecord {
  readonly CaseComplaintId: number;
  readonly CaseDetailId: number;
  readonly Title: string | null;
  /** One of {@link COMPLAINT_TYPES}. */
  readonly Type: string | null;
  readonly ComplaintDetail: string | null;
  /** UTC; the backend returns it without a zone. */
  readonly CreatedDate: string;
  /** The `AspNetUserId` of who logged it. */
  readonly CreatedByUserId: number;
}

/** v21 complaint types; the label is what is stored. */
export const COMPLAINT_TYPES = ['Internal', 'Customer', 'Client'] as const;

/**
 * Backend `CaseDocument`: the file uploaded for one of the client's documents
 * (`ClientDocumentId`) on this case. The backend stores the file sent as `Content` and sets
 * `FileStoragePath` to its download URL.
 */
export interface CaseDocumentRecord {
  readonly CaseDocumentId: number;
  readonly CaseDetailId: number;
  readonly ClientDocumentId: number;
  /** Part of the stored file's name. */
  readonly CaseReferenceNumber: string | null;
  readonly FileStoragePath: string | null;
  /** UTC; the backend returns it without a zone. */
  readonly UploadedDate: string | null;
}

/** Backend `CaseHistoryNoteTypes`, sent as its name. */
export const CASE_NOTE_TYPES = [
  'New',
  'Note',
  'Admin',
  'Inbound',
  'Outbound',
  'SMS',
  'Email',
  'AutoLog',
  'CaseOpen',
  'CaseExit',
  'CaseAbort',
  'CaseReopen',
  'CaseReAssign',
  'CaseChanges',
  'CaseClosed',
] as const;
export type CaseNoteType = (typeof CASE_NOTE_TYPES)[number];

/** Notes a user adds by hand (v21 New Note). `Note` would also text the caller (backend). */
export const MANUAL_NOTE_TYPES = [
  'Admin',
  'Inbound',
  'Outbound',
] as const satisfies readonly CaseNoteType[];

/** Backend `CaseOperation`: what `Operation/{id}` does for the case. */
type CaseOperation = 'TransportNotify' | 'SMS' | 'EMail';

/** An SMS about the case. */
export interface CaseSms {
  /** E.164, e.g. `+27821234567`. */
  readonly receiver: string;
  readonly body: string;
}

/** An email about the case. */
export interface CaseEmail {
  readonly from: string;
  readonly to: readonly string[];
  readonly cc: readonly string[];
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

/**
 * Backend `CaseHistory`: a note in the case's history. Adding some notes also changes the
 * case's status (backend): `CaseAbort` aborts it; `CaseReopen` and `CaseReAssign` make it
 * Active.
 */
export interface CaseHistoryRecord {
  readonly CaseHistoryId: number;
  readonly CaseDetailId: number;
  readonly NoteType: CaseNoteType | null;
  readonly Note: string | null;
  /** UTC; the backend returns it without a zone. */
  readonly CreatedDate: string;
  /** The `AspNetUserId` of who wrote it. */
  readonly CreatedByUserId: number;
}

/** Backend `CaseRating`: the caller's answer to one of the client's rating questions. */
export interface CaseRatingRecord {
  readonly CaseRatingId: number;
  readonly CaseDetailId: number;
  readonly ContactName: string | null;
  readonly ContactNumber: string | null;
  readonly ClientRatingQuestionId: number;
  /** The question as asked, kept with the answer. */
  readonly Question: string | null;
  readonly QuestionAnswer: string | null;
}

/** The parts of a phase the tab strip needs. */
export type CasePhaseSummary = Pick<CasePhaseRecord, 'CasePhaseDetailsId' | 'PhaseName'>;

/**
 * Backend `CaseDetails`: one call to the call centre. `GET CaseDetails/{id}` also returns the
 * case's tabs' data; those fields are typed by the sub-phase that shows them, so a save sends
 * everything back unchanged (the backend replaces the whole row).
 */
export interface CaseDetails {
  readonly CaseDetailId: number;
  readonly CaseStatus: CaseStatus;
  /** Made by the database. */
  readonly CaseReferenceNumber: string | null;
  /** Made by the database. */
  readonly CaseNumber: string | null;
  readonly CaseClientId: number | null;
  /** The service's id (`ServiceId`, not the client service link's). */
  readonly CaseClientServiceId: number;
  readonly CaseControllerUserId: number;
  readonly AgentId: number | null;
  /** Email of whoever has the case open: only they may change it until they exit. */
  readonly CaseOpenedBy: string | null;
  /** Set by the backend when the case is first opened. */
  readonly CaseOpenDate: string | null;
  readonly CreatedDate: string;
  readonly CaseClosedDate?: string | null;
  readonly PreferredLanguage?: string | null;
  /** Yes, No or (null) not asked / not applicable. */
  readonly IsConsentExplained?: boolean | null;
  readonly IsPolicyHolder?: boolean | null;
  readonly CaseReferenceGivenToCaller?: boolean | null;
  readonly ContactDetails: readonly CaseContact[] | null;
  readonly CaseDeceasedInfo: CaseDeceasedRecord | null;
  /** The whole record on `GET CaseDetails/{id}`; the list only uses its burial date. */
  readonly CaseFinalFuneral: CaseFinalFuneralRecord | CaseFuneralSummary | null;
  readonly CaseCauseOfDeath?: CaseCauseOfDeathRecord | null;
  readonly CaseValidation?: readonly CaseValidationRecord[] | null;
  readonly CasePhaseDetails?: readonly CasePhaseRecord[] | null;
  readonly CaseAdditionalCosts?: readonly CaseAdditionalCostRecord[] | null;
  /** The case's complaints (the backend names the list in the singular). */
  readonly Complaint?: readonly CaseComplaintRecord[] | null;
  /** The files uploaded for the client's documents. */
  readonly CaseDocument?: readonly CaseDocumentRecord[] | null;
  /** The case's history, oldest first as stored. */
  readonly CaseHistory?: readonly CaseHistoryRecord[] | null;
  /** The caller's answers to the client's rating questions. */
  readonly CaseRatings?: readonly CaseRatingRecord[] | null;
  /** Vouchers reserved for the case, each with its voucher. */
  readonly CaseVouchers?: readonly CaseVoucherRecord[] | null;
  /** Authorised phases' costs, kept by Phase Costing (decimal(8,2)). */
  readonly PhaseTotal?: number | null;
  /** The additional costs (decimal(8,2)). */
  readonly AdditionalCostTotal?: number | null;
  /** Phases and additional costs (decimal(8,2)). */
  readonly TotalCost?: number | null;
}

/** The case fields a tab changes; everything else is sent back as loaded. */
export type CaseChanges = Partial<
  Pick<
    CaseDetails,
    | 'CaseClientId'
    | 'CaseClientServiceId'
    | 'CaseControllerUserId'
    | 'AgentId'
    | 'PreferredLanguage'
    | 'IsConsentExplained'
    | 'IsPolicyHolder'
    | 'CaseReferenceGivenToCaller'
    | 'ContactDetails'
    | 'PhaseTotal'
    | 'AdditionalCostTotal'
    | 'TotalCost'
  >
>;

/** A service as `CaseInit` lists it under a client. */
export interface CaseInitService {
  readonly ServiceId: number;
  readonly ServiceName: string;
  readonly ServiceTypeCode: string | null;
  readonly IsVoucherService: boolean;
  readonly IsActive: boolean;
  readonly IsDeleted: boolean | null;
}

export interface CaseInitClientService {
  readonly ClientServiceId: number;
  readonly ServiceId: number;
  readonly IsDeleted: boolean | null;
  /** HTML: what the agent should know about this service for this client. */
  readonly Note?: string | null;
  /** The provider this client's vouchers for the service come from; empty when none is set up. */
  readonly VoucherProvider?: string | null;
  readonly ServiceDto: CaseInitService | null;
}

export interface CaseInitClient {
  readonly ClientId: number;
  readonly ClientName: string;
  readonly IsActive: boolean;
  readonly IsDeleted: boolean | null;
  readonly ClientServices: readonly CaseInitClientService[] | null;
}

/** Which case tabs a service type gets: `TabNames` is a comma list, e.g. "caller,deceased-info". */
export interface ServiceTypeTabs {
  readonly ServiceTypeCode: string;
  readonly TabNames: string | null;
}

/** `GET CaseInit`: what the case screens pick from. */
export interface CaseInit {
  /** The company's physical and postal addresses (Security / Company Details). */
  readonly Address: readonly CompanyAddress[] | null;
  readonly ClientDto: readonly CaseInitClient[] | null;
  readonly ServiceTypeBasedTabs: readonly ServiceTypeTabs[] | null;
}

/**
 * `CaseDetails` controller:
 * - `GET CaseDetails` lists every case, with its deceased and funeral
 * - `GET CaseDetails/{id}` returns one case with all its parts, and opens it: the first user
 *   to load it holds it (`CaseOpenedBy`) until they exit; others see it read-only
 * - `POST CaseDetails` creates a case (Active, with the agent and case controller set by the
 *   backend); `POST CaseDetails/{id}` replaces it
 * - `GET CaseExit/{id}?status=` lets go of the case, setting its status (only for its holder)
 * - `GET CaseInit` lists clients with their services, and the tabs per service type
 *
 * `POST CaseValidation[/{id}]`, `POST CaseDeceasedInfo[/{id}]`, `POST CaseCauseOfDeath[/{id}]`,
 * `POST CaseFinalFuneral[/{id}]`, `POST CasePhaseDetails[/{id}]` and `POST CaseAdditionalCost[/{id}]`
 * create or replace a case's
 * records (one deceased, cause of death and final funeral per case, and one transport check
 * list per phase: the database refuses a second). `POST CaseValidation/FetchPolicyDetails/{caseId}`
 * asks the client's policy system (only clients with an integration). Every replace overwrites
 * the whole row, so the record is always sent back complete.
 */
@Injectable({ providedIn: 'root' })
export class CaseApi {
  private readonly http = inject(HttpClient);

  /** Newest first (v21). */
  list(): Observable<CaseDetails[]> {
    return this.http
      .get<CaseDetails[]>('CaseDetails')
      .pipe(map((cases) => [...cases].sort((a, b) => b.CaseDetailId - a.CaseDetailId)));
  }

  /** Loads the case and opens it for the current user if nobody has it open. */
  open(id: number): Observable<CaseDetails> {
    return this.http.get<CaseDetails>(`CaseDetails/${id}`);
  }

  create(clientId: number, serviceId: number): Observable<CaseDetails> {
    return this.http.post<CaseDetails>('CaseDetails', {
      CaseClientId: clientId,
      CaseClientServiceId: serviceId,
    });
  }

  /**
   * Lets go of the case, leaving it with `status`. The backend answers with text: whether it
   * let go, or the case is held by someone else.
   */
  exit(id: number, status: CaseStatus): Observable<string> {
    return this.http.get(`CaseExit/${id}`, { params: { status }, responseType: 'text' });
  }

  init(): Observable<CaseInit> {
    return this.http.get<CaseInit>('CaseInit');
  }

  /** Saves the case as loaded with `changes` (the backend replaces every column). */
  update(details: CaseDetails, changes: CaseChanges): Observable<CaseDetails> {
    return this.http.post<CaseDetails>(`CaseDetails/${details.CaseDetailId}`, {
      ...columnsOf(details),
      ...changes,
    });
  }

  /**
   * Lets go of a closed or aborted case without changing it: the case is saved as loaded with
   * nobody holding it. (`CaseExit` with its status would stamp a new closed date and closer.)
   */
  releaseFinished(details: CaseDetails): Observable<CaseDetails> {
    return this.http.post<CaseDetails>(`CaseDetails/${details.CaseDetailId}`, {
      ...columnsOf(details),
      CaseOpenedBy: null,
    });
  }

  saveValidation(record: CaseValidationRecord): Observable<CaseValidationRecord> {
    const id = record.CaseValidationId;
    return this.http.post<CaseValidationRecord>(
      id ? `CaseValidation/${id}` : 'CaseValidation',
      columnsOf(record),
    );
  }

  saveDeceased(record: CaseDeceasedRecord): Observable<CaseDeceasedRecord> {
    const id = record.CaseDeceasedInfoId;
    return this.http.post<CaseDeceasedRecord>(
      id ? `CaseDeceasedInfo/${id}` : 'CaseDeceasedInfo',
      columnsOf(record),
    );
  }

  saveCauseOfDeath(record: CaseCauseOfDeathRecord): Observable<CaseCauseOfDeathRecord> {
    const id = record.CaseCauseOfDeathId;
    return this.http.post<CaseCauseOfDeathRecord>(
      id ? `CaseCauseOfDeath/${id}` : 'CaseCauseOfDeath',
      columnsOf(record),
    );
  }

  saveFinalFuneral(record: CaseFinalFuneralRecord): Observable<CaseFinalFuneralRecord> {
    const id = record.CaseFinalFuneralId;
    return this.http.post<CaseFinalFuneralRecord>(
      id ? `CaseFinalFuneral/${id}` : 'CaseFinalFuneral',
      columnsOf(record),
    );
  }

  /**
   * Adds a phase. The backend needs its text columns not null; the rest is filled on its tab.
   */
  createPhase(caseId: number, phaseName: string, collectFrom: string): Observable<CasePhaseRecord> {
    return this.http.post<CasePhaseRecord>('CasePhaseDetails', {
      CaseDetailId: caseId,
      PhaseName: phaseName,
      IsActive: true,
      CollectFrom: collectFrom,
      CollectServiceProviderId: 0,
      ManagerName: '',
      RemoveTo: '',
      RemoveServiceProviderId: 0,
    });
  }

  /**
   * Replaces the phase's columns. With `transport`, its check list is saved too (made when it
   * has no id); without, the check list is left as it is.
   */
  savePhase(record: CasePhaseRecord, transport?: CaseTransportRecord): Observable<CasePhaseRecord> {
    return this.http.post<CasePhaseRecord>(`CasePhaseDetails/${record.CasePhaseDetailsId}`, {
      ...columnsOf(record),
      ...(transport ? { CaseTransportDetails: transport } : {}),
    });
  }

  /** Adds the cost, or (with its id) saves it back whole, e.g. deleted. */
  saveAdditionalCost(record: CaseAdditionalCostRecord): Observable<CaseAdditionalCostRecord> {
    const id = record.CaseAdditionalCostId;
    return this.http.post<CaseAdditionalCostRecord>(
      id ? `CaseAdditionalCost/${id}` : 'CaseAdditionalCost',
      columnsOf(record),
    );
  }

  /** Logs a complaint (`POST Complaint`); the backend echoes it with its id. */
  addComplaint(record: CaseComplaintRecord): Observable<CaseComplaintRecord> {
    return this.http.post<CaseComplaintRecord>('Complaint', columnsOf(record));
  }

  /**
   * Uploads the file for one of the client's documents, as form data: a new row (id 0) or a
   * replacement, which sends the stored file's URL so the backend deletes that file. The
   * backend's reply only has the new file's URL for a new row, so reload the case to see it.
   */
  uploadDocument(record: CaseDocumentRecord, file: File): Observable<unknown> {
    const form = new FormData();
    const id = record.CaseDocumentId;
    if (id > 0) form.append('CaseDocumentId', String(id));
    form.append('CaseDetailId', String(record.CaseDetailId));
    form.append('ClientDocumentId', String(record.ClientDocumentId));
    form.append('CaseReferenceNumber', record.CaseReferenceNumber ?? '');
    if (record.FileStoragePath) form.append('FileStoragePath', record.FileStoragePath);
    if (record.UploadedDate) form.append('UploadedDate', record.UploadedDate);
    form.append('Content', file, file.name);
    return this.http.post(id > 0 ? `CaseDocument/${id}` : 'CaseDocument', form);
  }

  /** Adds a note to the case's history (some notes change the case's status: see the type). */
  addHistory(record: CaseHistoryRecord): Observable<CaseHistoryRecord> {
    return this.http.post<CaseHistoryRecord>('CaseHistory', columnsOf(record));
  }

  /**
   * Saves the caller's answers (new ones have id 0). `closeCase` also closes the case; v21 sent
   * Active otherwise, which reopened a pending case on every save.
   */
  saveRatings(records: readonly CaseRatingRecord[], closeCase: boolean): Observable<unknown> {
    return this.http.post(
      'CaseRating',
      records.map((record) => columnsOf(record)),
      closeCase ? { params: { caseStatus: 'Closed' } } : {},
    );
  }

  /** Sends an SMS about the case (backend `Operation`, SMS: logged as an `SMS` history note). */
  sendSms(details: CaseDetails, sms: CaseSms): Observable<unknown> {
    return this.operation(details, 'SMS', { SMS: { Receiver: sms.receiver, Body: sms.body } });
  }

  /**
   * Sends an email about the case (backend `Operation`, EMail: logged as an `Email` history
   * note). The backend sends from its own address and copies the signed-in user; it does not
   * attach files (`AttachmentUris` is ignored), so none are sent.
   */
  sendEmail(details: CaseDetails, email: CaseEmail): Observable<unknown> {
    return this.operation(details, 'EMail', {
      EmailLogger: {
        // The backend stores the email under this key and does not make one up.
        Guid: crypto.randomUUID(),
        // Required by the backend, which replaces it with its own sender.
        FromEmail: email.from,
        ToEmails: email.to,
        CCEmails: email.cc,
        Subject: email.subject,
        PlainText: email.text,
        HtmlContent: email.html,
        FMSReferenceKey: details.CaseReferenceNumber ?? String(details.CaseDetailId),
      },
    });
  }

  fetchPolicy(caseId: number, search: PolicySearch): Observable<PolicyMatch[]> {
    return this.http.post<PolicyMatch[]>(`CaseValidation/FetchPolicyDetails/${caseId}`, {
      CaseDetailId: caseId,
      ClientId: search.clientId,
      DeceaseId: search.deceasedId,
      PolicyNumber: search.policyNumber,
      DateOfDeath: search.dateOfDeath,
    });
  }

  private operation(
    details: CaseDetails,
    operation: CaseOperation,
    payload: object,
  ): Observable<unknown> {
    return this.http.post(
      `Operation/${details.CaseDetailId}`,
      {
        CaseDetailId: details.CaseDetailId,
        CaseStatus: details.CaseStatus,
        CaseReferenceNumber: details.CaseReferenceNumber,
        CaseNumber: details.CaseNumber,
        ...payload,
      },
      { params: { Operation: operation } },
    );
  }
}

/**
 * The record's own columns: what the backend copies onto the row. Included records (the case's
 * deceased, validations, …) are left out; `ContactDetails` is a column stored as JSON.
 */
function columnsOf<T extends object>(record: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(record).filter(
      ([key, value]) => key === 'ContactDetails' || value === null || typeof value !== 'object',
    ),
  ) as Partial<T>;
}
