import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { CaseApi, type CaseDetails, type CaseInit } from '@api/cases/case.api';
import { DocumentTypeApi, type DocumentType } from '@api/config/document.api';
import {
  RatingQuestionOptionApi,
  type RatingQuestionOption,
} from '@api/config/rating-question-option.api';
import {
  RatingQuestionTypeApi,
  type RatingQuestionType,
} from '@api/config/rating-question-type.api';
import { TransportOperatorApi, type TransportOperator } from '@api/config/transport-operator.api';
import { VehicleApi, type Vehicle } from '@api/config/vehicle.api';
import { RequestCache } from '@core/http/request-cache';

/**
 * `CaseInit` (clients with their services, service providers, FMS addresses, tabs per service
 * type) changes when one of these is saved.
 */
const CASE_INIT_CHANGED_BY =
  /^(Client|Service|ServiceProvider|Config\/ServiceTypes|Config\/CompanyDetails)(\/|\?|$)/i;

/** A lookup list changes when it is saved on its own configuration screen. */
function savesTo(path: string): RegExp {
  return new RegExp(`^${path.replace('/', '\\/')}(\\/|\\?|$)`, 'i');
}

const CASE_LIST = 'CaseDetails';

/**
 * What the case screens load that rarely changes, loaded once and shared for a few minutes
 * instead of on every case, tab or popup (see `RequestCache`). Saving any of it on its own
 * screen makes the next use load it fresh.
 */
@Injectable({ providedIn: 'root' })
export class CaseLookups {
  private readonly cache = inject(RequestCache);
  private readonly cases = inject(CaseApi);
  private readonly documentTypes = inject(DocumentTypeApi);
  private readonly vehicles = inject(VehicleApi);
  private readonly operators = inject(TransportOperatorApi);
  private readonly ratingTypes = inject(RatingQuestionTypeApi);
  private readonly ratingOptions = inject(RatingQuestionOptionApi);

  /** `GET CaseInit` (570 KB): the Cases list and every case use it. */
  init(): Promise<CaseInit> {
    return this.cache.reuse('CaseInit', () => this.cases.init(), {
      changedBy: CASE_INIT_CHANGED_BY,
    });
  }

  /** Every document type, deleted ones too (they name old links). */
  allDocumentTypes(): Promise<DocumentType[]> {
    return this.lookup('Config/Document', () => this.documentTypes.listIncludingDeleted());
  }

  allVehicles(): Promise<Vehicle[]> {
    return this.lookup('Config/Vehicle', () => this.vehicles.listIncludingDeleted());
  }

  allTransportOperators(): Promise<TransportOperator[]> {
    return this.lookup('Config/TransportOperator', () => this.operators.listIncludingDeleted());
  }

  allRatingTypes(): Promise<RatingQuestionType[]> {
    return this.lookup('Config/RatingQuestionType', () => this.ratingTypes.listIncludingDeleted());
  }

  allRatingOptions(): Promise<RatingQuestionOption[]> {
    return this.lookup('Config/RatingQuestionOption', () =>
      this.ratingOptions.listIncludingDeleted(),
    );
  }

  /** `CaseInit` as last loaded, however old (to show the last Cases list at once), or undefined. */
  lastInit(): CaseInit | undefined {
    return this.cache.latest<CaseInit>('CaseInit');
  }

  /** The Cases list as last loaded (shown at once on coming back), or undefined. */
  lastCaseList(): readonly CaseDetails[] | undefined {
    return this.cache.latest<CaseDetails[]>(CASE_LIST);
  }

  /** `GET CaseDetails`: always loaded fresh (cases change all the time), and kept as the last copy. */
  loadCaseList(): Promise<CaseDetails[]> {
    return this.cache.refresh(CASE_LIST, () => this.cases.list());
  }

  private lookup<T>(path: string, load: () => Observable<T>): Promise<T> {
    return this.cache.reuse(path, load, { changedBy: savesTo(path) });
  }
}
