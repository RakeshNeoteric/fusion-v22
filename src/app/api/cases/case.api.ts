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

/** The parts of the deceased's details the case list and header show (more in phase 7c). */
export interface CaseDeceasedSummary {
  readonly Initials: string | null;
  readonly FirstName: string | null;
  readonly LastName: string | null;
}

/** The parts of the final funeral the case list shows (more in phase 7c). */
export interface CaseFuneralSummary {
  readonly BurialDate: string | null;
}

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
  readonly CaseOpenDate: string | null;
  readonly CreatedDate: string;
  readonly CaseClosedDate?: string | null;
  readonly ContactDetails: readonly CaseContact[] | null;
  readonly CaseDeceasedInfo: CaseDeceasedSummary | null;
  readonly CaseFinalFuneral: CaseFuneralSummary | null;
  readonly CasePhaseDetails?: readonly CasePhaseSummary[] | null;
}

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
}
