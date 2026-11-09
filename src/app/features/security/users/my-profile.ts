import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { type AppUser, UserApi } from '@api/security/user.api';
import { silentErrors } from '@core/http/http-context';
import type { ProfileEditor } from '@core/layout/header/profile-editor';
import { PermissionService } from '@core/permissions/permission.service';
import { type SessionUser, SessionService } from '@core/session/session.service';
import { UserPhotoService } from '@core/session/user-photo.service';
import { RecordDialogs } from '@shared/forms/record-dialog/record-dialog';
import { UserDialog, type UserDialogData } from './user-dialog';

/** The Users screen's permission. */
const USERS = 'USR';

/**
 * v21 header popup: the signed-in user's own name, phone numbers and photo. The backend has no
 * "my profile" endpoint, so it uses the Users endpoints, which need Users permission:
 * - reading the record needs read access; without it the popup shows the name and email the
 *   session knows, read-only
 * - saving needs create access (`PUT Users`); without it the popup is read-only
 * (v21 offered Save to everyone and failed with 403.)
 */
@Injectable({ providedIn: 'root' })
export class MyProfile implements ProfileEditor {
  private readonly api = inject(UserApi);
  private readonly session = inject(SessionService);
  private readonly permissions = inject(PermissionService);
  private readonly dialogs = inject(RecordDialogs);
  private readonly photo = inject(UserPhotoService);
  private opening = false;

  async open(): Promise<void> {
    const user = this.session.user();
    if (!user || this.opening) return;
    this.opening = true;
    try {
      const stored = await this.load(user.email);
      const data: UserDialogData = {
        record: stored ?? fromSession(user),
        readOnly: !stored || !this.permissions.canCreate(USERS),
        profile: true,
      };
      const saved = await this.dialogs.show<AppUser>(UserDialog, data);
      if (saved) {
        this.session.renamed(saved.Firstname, saved.Lastname);
        // The header shows the new photo at once.
        void this.photo.show(saved.ProfileImage);
      }
    } finally {
      this.opening = false;
    }
  }

  /** Null when the user may not read Users, or is not found: the popup says what it can. */
  private async load(email: string): Promise<AppUser | null> {
    try {
      return await firstValueFrom(this.api.byEmail(email, silentErrors()));
    } catch {
      return null;
    }
  }
}

/** What the session knows, shown read-only when the stored record cannot be read. */
function fromSession(user: SessionUser): AppUser {
  return {
    AspNetUserId: user.id,
    UserName: user.email,
    UserEmail: user.email,
    Firstname: user.firstName,
    Lastname: user.lastName,
    PhoneNumber: null,
    MobileNumber: null,
    EmployeeId: null,
    ProfileImage: null,
    EmailConfirmed: true,
    IsActive: true,
    IsDeleted: null,
  };
}
