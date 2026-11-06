import { Injectable } from '@angular/core';
import { ConfigCrudApi, type SoftDeletable } from './config-crud.api';

/** Backend `VoucherProvider` enum, sent as its name. */
export const VOUCHER_PROVIDERS = ['Grocery_Shoprite', 'Airtime_MTN', 'Airtime_Vodacom'] as const;
export type VoucherProvider = (typeof VOUCHER_PROVIDERS)[number];

/** `Service` (not under `Config/`). Names must be unique (backend: 422). */
export interface Service extends SoftDeletable {
  readonly ServiceId: number;
  readonly ServiceName: string;
  readonly ServiceTypeCode: string;
  /** Rich text (HTML from the editor). */
  readonly Note: string;
  /** The note as plain text, kept for places that cannot show HTML. */
  readonly NotePlain: string;
  readonly VoucherProvider: VoucherProvider | null;
  readonly EnforceMobileNumber: boolean;
  readonly SendRefSMSEnabled: boolean;
  readonly IsVoucherService: boolean;
  readonly IsActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class ServiceApi extends ConfigCrudApi<Service> {
  constructor() {
    super('Service', 'ServiceId');
  }
}
