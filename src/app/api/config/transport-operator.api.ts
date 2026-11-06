import { Injectable } from '@angular/core';
import { ConfigCrudApi, type SoftDeletable } from './config-crud.api';

/** `Config.TransportOperator`. Names must be unique (backend: 422). */
export interface TransportOperator extends SoftDeletable {
  readonly TransportOperatorId: number;
  readonly Name: string;
  readonly Phone: string;
  readonly BranchId: number | null;
  readonly IsActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class TransportOperatorApi extends ConfigCrudApi<TransportOperator> {
  constructor() {
    super('Config/TransportOperator', 'TransportOperatorId');
  }
}
