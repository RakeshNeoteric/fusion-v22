import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import type { GridApi } from 'ag-grid-community';
import { of } from 'rxjs';
import { provideAppIcons } from '@core/icons/app-icons';
import { Breadcrumb } from '@core/layout/breadcrumb/breadcrumb';
import { NotificationService } from '@core/notifications/notification.service';
import { PermissionService } from '@core/permissions/permission.service';
import { ConfirmService } from '@shared/ui/confirm-dialog/confirm-dialog';
import { permission, role } from '../../../../testing/app-init.fixtures';
import { ICON_COLUMN_WIDTH } from '../grid-setup';
import { EntityGrid } from './entity-grid';
import type { EntityGridConfig } from './entity-grid.types';
import type { GridRow } from './entity-rows';

interface Thing {
  readonly ThingId: number;
  readonly Name: string;
  readonly Rank: number;
  readonly IsActive: boolean;
  readonly IsDeleted: boolean;
}

@Component({
  imports: [Breadcrumb, EntityGrid],
  template: '<app-breadcrumb /><app-entity-grid [config]="config()" />',
})
class Screen {
  readonly config = input.required<EntityGridConfig<Thing>>();
}

/** RESPONSIVE.md: how the shared grid sizes its columns on every screen. */
describe('EntityGrid column sizing (responsive)', () => {
  let grid: GridApi<GridRow<Thing>>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideAppIcons(),
        provideRouter([]),
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
        { provide: NotificationService, useValue: { error: vi.fn(), warning: vi.fn() } },
        { provide: ConfirmService, useValue: { ask: vi.fn() } },
      ],
    });
    TestBed.inject(PermissionService).load([
      role('Tester', [permission('THING', { CanEdit: true, CanDeleted: true })]),
    ]);
    const fixture = TestBed.createComponent(Screen);
    fixture.componentRef.setInput('config', {
      entityName: 'Thing',
      permission: 'THING',
      source: {
        idOf: (thing: Thing) => thing.ThingId,
        list: () => of([]),
        create: vi.fn(),
        update: vi.fn(),
        softDelete: vi.fn(),
      },
      describe: (thing) => thing.Name,
      columns: [
        { kind: 'text', field: 'Name', header: 'Name', minWidth: 200, pinned: 'left' },
        { kind: 'number', field: 'Rank', header: 'Rank', minWidth: 250 },
        { kind: 'toggle', field: 'IsActive', header: 'Active', minWidth: 250 },
      ],
    } satisfies EntityGridConfig<Thing>);
    await fixture.whenStable();
    const agGrid = fixture.debugElement.query(By.directive(AgGridAngular))
      .componentInstance as AgGridAngular<GridRow<Thing>>;
    grid = await vi.waitFor(() => {
      const ready = agGrid.api;
      if (!ready || ready.isDestroyed()) throw new Error('grid not ready');
      return ready;
    });
  });

  const def = (colId: string) => grid.getColumn(colId)?.getColDef();

  it('caps the minimum of yes/no and number columns, so tables scroll later on a laptop', () => {
    expect(def('Rank')?.minWidth).toBe(120);
    expect(def('IsActive')?.minWidth).toBe(120);
    // A text column keeps what the screen asked for.
    expect(def('Name')?.minWidth).toBe(200);
  });

  it('keeps a pinned column in view while a wide table scrolls', () => {
    expect(grid.getColumn('Name')?.getPinned()).toBe('left');
  });

  it('gives icon columns room for one icon only', () => {
    expect(def('save')?.width).toBe(ICON_COLUMN_WIDTH);
    expect(def('delete')?.width).toBe(ICON_COLUMN_WIDTH);
    expect(ICON_COLUMN_WIDTH).toBe(80);
  });

  it('wraps a long column title instead of cutting it off', () => {
    const defaults = grid.getGridOption('defaultColDef');
    expect(defaults?.wrapHeaderText).toBe(true);
    expect(defaults?.autoHeaderHeight).toBe(true);
  });
});
