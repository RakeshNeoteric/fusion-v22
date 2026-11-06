import { ChangeDetectionStrategy, Component, Injector, inject } from '@angular/core';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { type AppUser, UserApi } from '@api/security/user.api';
import { RecordDialogs } from '@shared/forms/record-dialog/record-dialog';
import { EntityGrid } from '@shared/grid/entity-grid/entity-grid';
import type { EntityGridConfig } from '@shared/grid/entity-grid/entity-grid.types';
import { UserDialog } from './user-dialog';

const PERMISSION = 'USR';

/** A stored number (`+27821234567`) as it is written at home (`082 123 4567`). */
function nationalPhone(phone: string | null): string {
  if (!phone) return '';
  const parsed = parsePhoneNumberFromString(phone);
  return parsed ? parsed.formatNational() : phone;
}

/** v21 Users: a read-only list; users are created and edited in a popup form. */
@Component({
  selector: 'app-users-page',
  imports: [EntityGrid],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-entity-grid [config]="config" />`,
})
export class UsersPage {
  private readonly dialogs = inject(RecordDialogs);
  private readonly injector = inject(Injector);

  protected readonly config: EntityGridConfig<AppUser> = {
    entityName: 'User',
    permission: PERMISSION,
    source: inject(UserApi),
    describe: (user) => `${user.Firstname} ${user.Lastname}`.trim() || user.UserEmail,
    editor: (record) => this.dialogs.open(UserDialog, record, PERMISSION, this.injector),
    columns: [
      { kind: 'text', field: 'Firstname', header: 'First Name', minWidth: 160 },
      { kind: 'text', field: 'Lastname', header: 'Last Name', minWidth: 160 },
      { kind: 'text', field: 'UserEmail', header: 'Email', flex: 1.6, minWidth: 260 },
      {
        kind: 'display',
        id: 'MobileNumber',
        header: 'Mobile Number',
        value: (user) => nationalPhone(user.MobileNumber),
        align: 'center',
        minWidth: 170,
      },
      { kind: 'toggle', field: 'IsActive', header: 'Active', minWidth: 120 },
    ],
  };
}
