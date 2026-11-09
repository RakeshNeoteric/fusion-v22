import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FileStorageApi } from '@api/files/file-storage.api';
import { UserApi } from '@api/security/user.api';
import { silentErrors } from '@core/http/http-context';
import { PermissionService } from '@core/permissions/permission.service';
import { SessionService } from './session.service';

/** The Users screen's permission: the backend's `GET Users` needs read access to it. */
const USERS = 'USR';

/**
 * The signed-in user's photo for the header (v21). The photo's path is on the user's record,
 * which only `GET Users` returns, and that needs read access to Users. Without it, or without
 * a photo, `src` stays null and the header shows the initials. Stored files need the user's
 * token, so the photo is fetched and shown through an object URL, freed when replaced.
 */
@Injectable({ providedIn: 'root' })
export class UserPhotoService {
  private readonly session = inject(SessionService);
  private readonly permissions = inject(PermissionService);
  private readonly users = inject(UserApi);
  private readonly files = inject(FileStorageApi);

  private readonly url = signal<string | null>(null);
  /** Only the latest request is shown, if an older one answers later. */
  private request = 0;

  /** An object URL of the photo, or null for none. */
  readonly src = this.url.asReadonly();

  /** Changes on sign-in and sign-out only (a rename keeps the email). */
  private readonly email = computed(() => this.session.user()?.email ?? null);

  constructor() {
    effect(() => {
      const email = this.email();
      untracked(() => void this.loadFor(email));
    });
  }

  /** Shows the photo at this stored path, e.g. one just saved in My Profile; none for empty. */
  async show(path: string | null | undefined): Promise<void> {
    const request = ++this.request;
    if (!path) {
      this.set(null);
      return;
    }
    try {
      const image = await firstValueFrom(this.files.preview(path, silentErrors()));
      if (request === this.request) this.set(URL.createObjectURL(image));
    } catch {
      if (request === this.request) this.set(null);
    }
  }

  private async loadFor(email: string | null): Promise<void> {
    const request = ++this.request;
    if (!email || !this.permissions.canView(USERS)) {
      this.set(null);
      return;
    }
    try {
      const user = await firstValueFrom(this.users.byEmail(email, silentErrors()));
      if (request === this.request) await this.show(user?.ProfileImage);
    } catch {
      if (request === this.request) this.set(null);
    }
  }

  private set(url: string | null): void {
    const previous = this.url();
    if (previous) URL.revokeObjectURL(previous);
    this.url.set(url);
  }
}
