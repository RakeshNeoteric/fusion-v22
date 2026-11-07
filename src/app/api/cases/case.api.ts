import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';

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

/** A phase on the case; its tab shows when the service type allows it (more in phase 7d). */
export interface CasePhaseSummary {
  readonly CasePhaseDetailsId: number;
  /** `phase1` … `phase4` */
  readonly PhaseName: string | null;
}

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
  readonly CasePhaseDetails?: readonly CasePhaseSummary[] | null;
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
 * `POST CaseValidation[/{id}]`, `POST CaseDeceasedInfo[/{id}]`, `POST CaseCauseOfDeath[/{id}]`
 * and `POST CaseFinalFuneral[/{id}]` create or replace a case's records (one deceased, cause of
 * death and final funeral per case: the database refuses a second); `POST CaseValidation/FetchPolicyDetails/{caseId}` asks the
 * client's policy system (only clients with an integration). Every replace overwrites the whole
 * row, so the record is always sent back complete.
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

  fetchPolicy(caseId: number, search: PolicySearch): Observable<PolicyMatch[]> {
    return this.http.post<PolicyMatch[]>(`CaseValidation/FetchPolicyDetails/${caseId}`, {
      CaseDetailId: caseId,
      ClientId: search.clientId,
      DeceaseId: search.deceasedId,
      PolicyNumber: search.policyNumber,
      DateOfDeath: search.dateOfDeath,
    });
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
