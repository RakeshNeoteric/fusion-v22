import { Injectable } from '@angular/core';
import { ConfigCrudApi, type SoftDeletable } from './config-crud.api';

/** `Config.Branch`. Names must be unique (backend: 422). `Country` is an ISO code, e.g. `ZA`. */
export interface Branch extends SoftDeletable {
  readonly BranchId: number;
  readonly Name: string;
  readonly Province: string;
  readonly Country: string | null;
  readonly IsActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class BranchApi extends ConfigCrudApi<Branch> {
  constructor() {
    super('Config/Branch', 'BranchId');
  }
}
