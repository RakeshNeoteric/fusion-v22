import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import type { CrudSource, SoftDeletable } from '@api/config/config-crud.api';

/**
 * .NET `DateTime.MinValue`: what the backend stores for a date that was never set
 * (its date fields cannot be null), and what is sent for "no date".
 */
export const NO_DATE = '0001-01-01T00:00:00';

/** One row of a provider's contact details (backend `ObjectDetails`, stored as JSON). */
export interface ProviderContact {
  readonly Id: number;
  /** v21 writes "Combined": one row holds telephone, fax and email. */
  readonly Type: string;
  /** The telephone's dial code, e.g. `+27`. */
  readonly Code: string;
  /** The telephone's national number without its leading 0, e.g. `821234567`. */
  readonly Value: string;
  /** The telephone in international format, e.g. `+27 82 123 4567`. */
  readonly Mobile: string | null;
  readonly Name: string | null;
  readonly Fax: string | null;
  readonly Email: string | null;
  readonly Comments: string | null;
}

/** Backend `ServiceProvider`. User fields hold an `AspNetUserId`, 0 when nobody. */
export interface ServiceProvider extends SoftDeletable {
  readonly ServiceProviderId: number;
  readonly Name: string;
  readonly VATNumber: string;
  readonly CompanyRegNo: string;
  readonly Branch: string;
  readonly OfficeAddress: string;
  readonly StorageAddress: string;
  readonly TownCity: string;
  readonly Province: string;
  readonly ServiceTypeCode: string;
  readonly DesignationNumber: string;
  readonly RatePerKm: number;
  readonly AuthorisedBy: number;
  readonly RateAuthorisedOn: string;
  readonly IsActive: boolean;
  /** "Date Opened" */
  readonly ActiveOn: string;
  /** "Opened By" */
  readonly ActiveBy: number;
  readonly IsVerified: boolean;
  readonly VerifiedOn: string;
  readonly VerifiedBy: number;
  readonly IsAccredited: boolean;
  readonly AccreditedOn: string;
  readonly AccreditedBy: number;
  readonly IsInternalServiceProvider: boolean | null;
  /** BEE: Black Economic Empowerment. */
  readonly BeeStatus: boolean | null;
  readonly BeeExpiryDate: string | null;
  readonly BeeCertificateStoragePath: string | null;
  readonly ContactDetails: readonly ProviderContact[] | null;
}

/**
 * `ServiceProvider` controller:
 * - `GET ServiceProvider` returns every provider, deleted ones included
 * - `POST ServiceProvider` creates, `POST ServiceProvider/{id}` replaces the whole row;
 *   soft delete is the latter with `IsDeleted: true` (v21 used PUT, which the backend lacks)
 * - names must be unique (422)
 */
@Injectable({ providedIn: 'root' })
export class ServiceProviderApi implements CrudSource<ServiceProvider> {
  private readonly http = inject(HttpClient);

  idOf(provider: ServiceProvider): number {
    return provider.ServiceProviderId;
  }

  /** Not deleted, newest first (v21). */
  list(): Observable<ServiceProvider[]> {
    return this.listIncludingDeleted().pipe(
      map((providers) =>
        providers
          .filter((provider) => provider.IsDeleted !== true)
          .sort((a, b) => b.ServiceProviderId - a.ServiceProviderId),
      ),
    );
  }

  /** For naming providers that were deleted later (a client's linked providers). */
  listIncludingDeleted(): Observable<ServiceProvider[]> {
    return this.http.get<ServiceProvider[]>('ServiceProvider');
  }

  create(provider: ServiceProvider): Observable<ServiceProvider> {
    return this.http.post<ServiceProvider>('ServiceProvider', {
      ...provider,
      ServiceProviderId: 0,
      IsDeleted: false,
    });
  }

  update(provider: ServiceProvider): Observable<ServiceProvider> {
    return this.http.post<ServiceProvider>(
      `ServiceProvider/${provider.ServiceProviderId}`,
      provider,
    );
  }

  softDelete(provider: ServiceProvider): Observable<ServiceProvider> {
    return this.http.post<ServiceProvider>(`ServiceProvider/${provider.ServiceProviderId}`, {
      ...provider,
      IsDeleted: true,
    });
  }
}
