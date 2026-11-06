import { Injectable } from '@angular/core';
import { ConfigCrudApi, type SoftDeletable } from './config-crud.api';

/** `Config.ServiceTypes`. Codes must be unique (backend: 422); services refer to the code. */
export interface ServiceType extends SoftDeletable {
  readonly ServiceTypeId: number;
  readonly ServiceTypeCode: string;
  readonly Description: string;
  readonly IsActive: boolean;
  /** Not on this screen; sent back unchanged so a save does not clear it. */
  readonly ClientReportBasedColumns?: string | null;
}

/** The "Added Value" service type: only its services can be voucher services (v21). */
export const ADDED_VALUE_SERVICE_TYPE = 'AVS';

@Injectable({ providedIn: 'root' })
export class ServiceTypeApi extends ConfigCrudApi<ServiceType> {
  constructor() {
    super('Config/ServiceTypes', 'ServiceTypeId');
  }
}
