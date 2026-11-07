import { Location } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { type AccountInfo, InteractionRequiredAuthError } from '@azure/msal-browser';
import { APP_CONFIG } from '@core/config/app-config';
import { MSAL_CLIENT } from './msal-client';

/**
 * Microsoft (Azure AD) sign-in. Knows nothing about Fusion users or permissions;
 * that is SessionService's job.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly msal = inject(MSAL_CLIENT);
  private readonly azureAd = inject(APP_CONFIG).azureAd;
  private readonly location = inject(Location);
  /** A sign-in redirect has started; the page is being left. */
  private redirecting = false;

  private readonly currentAccount = signal<AccountInfo | null>(null);

  /** The signed-in Microsoft account, or null. */
  readonly account = this.currentAccount.asReadonly();

  /** The account's email (`preferred_username` claim, falling back to the MSAL username). */
  readonly email = computed(() => {
    const account = this.currentAccount();
    if (!account) return null;
    const claim = account.idTokenClaims?.['preferred_username'];
    return typeof claim === 'string' && claim ? claim : account.username;
  });

  /**
   * Must run once before anything else: completes a pending login redirect and restores the
   * cached account. Resolves to the `state` passed to {@link login} (the return URL), if this
   * page load is the redirect back from Microsoft.
   */
  async initialize(): Promise<string | null> {
    await this.msal.initialize();
    const result = await this.msal.handleRedirectPromise({ navigateToLoginRequestUrl: false });
    const account =
      result?.account ?? this.msal.getActiveAccount() ?? this.msal.getAllAccounts()[0] ?? null;
    this.msal.setActiveAccount(account);
    this.currentAccount.set(account);
    return result?.state ?? null;
  }

  /** Leaves the app for the Microsoft sign-in page. */
  login(email: string, returnUrl: string | null = null): Promise<void> {
    return this.msal.loginRedirect({
      scopes: [...this.azureAd.apiScopes],
      loginHint: email.trim() || undefined,
      state: returnUrl ?? undefined,
    });
  }

  /** Signs out of Microsoft and returns to the login page. */
  logout(): Promise<void> {
    const account = this.currentAccount();
    this.currentAccount.set(null);
    return this.msal.logoutRedirect({
      account: account ?? undefined,
      postLogoutRedirectUri: this.azureAd.postLogoutRedirectUri,
    });
  }

  /**
   * An access token for the Fusion Edge API. If Microsoft needs the user to interact again
   * (expired session, new consent), this redirects to sign-in and the promise never settles,
   * because the page is being left. The user comes back to the page they were on. Requests
   * that need a token while the redirect starts wait too: a second redirect would fail
   * (`interaction_in_progress`) and show an error just as the page leaves.
   */
  async getApiToken(): Promise<string> {
    const account = this.currentAccount();
    if (!account) {
      throw new Error('Not signed in.');
    }
    const request = { account, scopes: [...this.azureAd.apiScopes] };
    try {
      const result = await this.msal.acquireTokenSilent(request);
      return result.accessToken;
    } catch (error: unknown) {
      if (error instanceof InteractionRequiredAuthError) {
        if (!this.redirecting) {
          this.redirecting = true;
          await this.msal.acquireTokenRedirect({ ...request, state: this.currentUrl() });
        }
        return new Promise<never>(() => undefined);
      }
      throw error;
    }
  }

  /** Where the user is, e.g. `/cases/case-details?id=4`: SessionService returns there. */
  private currentUrl(): string {
    const path = this.location.path(true);
    return path.startsWith('/') ? path : `/${path}`;
  }
}
