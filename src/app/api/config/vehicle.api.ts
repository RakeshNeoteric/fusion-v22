import { Injectable } from '@angular/core';
import { ConfigCrudApi, type SoftDeletable } from './config-crud.api';

/** `Config.Vehicle`. Registration numbers must be unique (backend: 422). */
export interface Vehicle extends SoftDeletable {
  readonly VehicleId: number;
  readonly RegNumber: string;
  readonly Description: string;
  /** Not shown on the screen; v21 sends an empty string for new vehicles. */
  readonly Phone: string;
  readonly BranchId: number | null;
  readonly IsActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class VehicleApi extends ConfigCrudApi<Vehicle> {
  constructor() {
    super('Config/Vehicle', 'VehicleId');
  }
}
