import { Injectable } from '@angular/core';
import { ConfigCrudApi, type SoftDeletable } from './config-crud.api';

/** `Config.ClaimCentre`. Names must be unique (backend: 422). Phones are E.164, e.g. `+27821234567`. */
export interface ClaimCentre extends SoftDeletable {
  readonly ClaimCentreId: number;
  readonly Name: string;
  readonly ClientGroupId: number | null;
  readonly Province: string;
  readonly Branch: string;
  readonly TownCity: string;
  readonly Address: string;
  readonly Tel: string;
  readonly Fax: string;
  readonly IsActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class ClaimCentreApi extends ConfigCrudApi<ClaimCentre> {
  constructor() {
    super('Config/ClaimCentre', 'ClaimCentreId');
  }
}
