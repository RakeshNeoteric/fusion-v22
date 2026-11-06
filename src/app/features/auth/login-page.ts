import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '@core/auth/auth.service';
import { NotificationService } from '@core/notifications/notification.service';
import { SessionService, isSafeReturnUrl } from '@core/session/session.service';

@Component({
  selector: 'app-login-page',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
})
export class LoginPage {
  /** `?returnUrl=` set by signedInGuard: where to go after signing in. */
  readonly returnUrl = input<string>();

  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionService);
  private readonly notifications = inject(NotificationService);
  private readonly document = inject(DOCUMENT);

  protected readonly email = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.email],
  });
  /** The group is what makes `(ngSubmit)` fire and shows errors after a submit attempt. */
  protected readonly form = new FormGroup({ email: this.email });
  protected readonly redirecting = signal(false);

  /** Why the last sign-in did not get the user in, if it didn't. */
  protected readonly problem = computed(() => {
    const state = this.session.state();
    return state.status === 'denied' || state.status === 'error' ? state : null;
  });
  protected readonly signedInAs = this.auth.email;

  protected async signIn(): Promise<void> {
    if (this.email.invalid) {
      this.email.markAsTouched();
      return;
    }
    this.redirecting.set(true);
    try {
      const returnUrl = this.returnUrl();
      await this.auth.login(this.email.value, isSafeReturnUrl(returnUrl) ? returnUrl : null);
    } catch (error: unknown) {
      console.error('[Login] Could not start Microsoft sign-in', error);
      this.notifications.error('Could not open Microsoft sign-in. Please try again.');
      this.redirecting.set(false);
    }
  }

  protected async signOut(): Promise<void> {
    this.redirecting.set(true);
    await this.session.signOut();
  }

  protected retry(): void {
    this.document.location.reload();
  }
}
