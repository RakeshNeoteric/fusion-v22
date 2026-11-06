import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

export type CompanyAddressType = 'FMSPhysicalAddress' | 'FMSPostalAddress';

/**
 * Backend `Address` for the company: the physical address carries the company's own details
 * (name, phone, VAT, logo); the postal address only its address lines.
 */
export interface CompanyAddress {
  readonly AddressId: number;
  readonly AddressType: CompanyAddressType;
  readonly CompanyName: string | null;
  readonly ContactName: string | null;
  readonly AddressLine1: string | null;
  readonly AddressLine2: string | null;
  readonly City: string | null;
  readonly State: string | null;
  readonly PostalCode: string | null;
  readonly Country: string | null;
  readonly PhoneNumber: string | null;
  readonly Fax: string | null;
  readonly Email: string | null;
  readonly CompanyRegNo: string | null;
  readonly VatNumber: string | null;
  readonly LogoStoragePath: string | null;
  readonly IsSameAsPhysicalAddress: boolean;
}

/**
 * `Config/CompanyDetails`: GET returns both addresses; POST saves a list of them, updating
 * those with an `AddressId` and creating the others.
 */
@Injectable({ providedIn: 'root' })
export class CompanyDetailsApi {
  private readonly http = inject(HttpClient);

  get(): Observable<CompanyAddress[]> {
    return this.http.get<CompanyAddress[]>('Config/CompanyDetails');
  }

  save(addresses: readonly CompanyAddress[]): Observable<unknown> {
    return this.http.post('Config/CompanyDetails', addresses);
  }
}
