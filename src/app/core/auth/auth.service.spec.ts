import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import {
  type AccountInfo,
  type AuthenticationResult,
  type IPublicClientApplication,
  InteractionRequiredAuthError,
} from '@azure/msal-browser';
import { APP_CONFIG, provideAppConfig } from '@core/config/app-config';
import { AuthService } from './auth.service';
import { MSAL_CLIENT } from './msal-client';

function account(username: string, claims?: Record<string, string>): AccountInfo {
  return {
    homeAccountId: `${username}-home`,
    environment: 'login.microsoftonline.com',
    tenantId: 'tenant',
    username,
    localAccountId: `${username}-local`,
    idTokenClaims: claims,
  };
}

/** Stand-in for MSAL's PublicClientApplication: only the methods AuthService uses. */
class FakeMsal {
  active: AccountInfo | null = null;
  cached: AccountInfo[] = [];
  redirectResult: Partial<AuthenticationResult> | null = null;

  initialize = vi.fn(() => Promise.resolve());
  handleRedirectPromise = vi.fn(() => Promise.resolve(this.redirectResult));
  getActiveAccount = vi.fn(() => this.active);
  getAllAccounts = vi.fn(() => this.cached);
  setActiveAccount = vi.fn((value: AccountInfo | null) => {
    this.active = value;
  });
  loginRedirect = vi.fn(() => Promise.resolve());
  logoutRedirect = vi.fn(() => Promise.resolve());
  acquireTokenSilent = vi.fn(() => Promise.resolve({ accessToken: 'api-token' }));
  acquireTokenRedirect = vi.fn(() => Promise.resolve());
}

describe('AuthService', () => {
  let msal: FakeMsal;
  let auth: AuthService;

  beforeEach(() => {
    msal = new FakeMsal();
    TestBed.configureTestingModule({
      providers: [
        provideAppConfig(),
        { provide: MSAL_CLIENT, useValue: msal as unknown as IPublicClientApplication },
      ],
    });
    auth = TestBed.inject(AuthService);
  });

  describe('initialize', () => {
    it('completes the login redirect and returns its state (the return URL)', async () => {
      const jane = account('jane@example.com');
      msal.redirectResult = { account: jane, state: '/client/client' };

      await expect(auth.initialize()).resolves.toBe('/client/client');

      expect(msal.initialize).toHaveBeenCalledBefore(msal.handleRedirectPromise);
      expect(msal.handleRedirectPromise).toHaveBeenCalledWith({ navigateToLoginRequestUrl: false });
      expect(msal.setActiveAccount).toHaveBeenCalledWith(jane);
      expect(auth.account()).toBe(jane);
    });

    it('restores the active account on a normal page load', async () => {
      msal.active = account('jane@example.com');
      await expect(auth.initialize()).resolves.toBeNull();
      expect(auth.account()).toBe(msal.active);
    });

    it('falls back to the first cached account', async () => {
      const cached = account('cached@example.com');
      msal.cached = [cached];
      await auth.initialize();
      expect(auth.account()).toBe(cached);
      expect(msal.setActiveAccount).toHaveBeenCalledWith(cached);
    });

    it('stays signed out when there is no account', async () => {
      await auth.initialize();
      expect(auth.account()).toBeNull();
      expect(auth.email()).toBeNull();
    });
  });

  it('uses the preferred_username claim as the email, falling back to the username', async () => {
    msal.active = account('object-id@tenant', { preferred_username: 'jane@example.com' });
    await auth.initialize();
    expect(auth.email()).toBe('jane@example.com');

    msal.active = account('john@example.com');
    await auth.initialize();
    expect(auth.email()).toBe('john@example.com');
  });

  it('login redirects with the API scopes, the email hint and the return URL', async () => {
    const { apiScopes } = TestBed.inject(APP_CONFIG).azureAd;
    await auth.login(' jane@example.com ', '/cases');
    expect(msal.loginRedirect).toHaveBeenCalledWith({
      scopes: [...apiScopes],
      loginHint: 'jane@example.com',
      state: '/cases',
    });
  });

  it('logout signs the account out and returns to the login page', async () => {
    const jane = account('jane@example.com');
    msal.active = jane;
    await auth.initialize();

    await auth.logout();

    expect(auth.account()).toBeNull();
    expect(msal.logoutRedirect).toHaveBeenCalledWith({
      account: jane,
      postLogoutRedirectUri: TestBed.inject(APP_CONFIG).azureAd.postLogoutRedirectUri,
    });
  });

  describe('getApiToken', () => {
    beforeEach(async () => {
      msal.active = account('jane@example.com');
      await auth.initialize();
    });

    it('returns a silently acquired token for the API scopes', async () => {
      await expect(auth.getApiToken()).resolves.toBe('api-token');
      expect(msal.acquireTokenSilent).toHaveBeenCalledWith({
        account: msal.active,
        scopes: [...TestBed.inject(APP_CONFIG).azureAd.apiScopes],
      });
    });

    it('redirects to Microsoft when interaction is required and never settles', async () => {
      msal.acquireTokenSilent.mockRejectedValue(
        new InteractionRequiredAuthError('interaction_required', 'correlation-id'),
      );
      const pending = Symbol('pending');
      const result = await Promise.race([
        auth.getApiToken(),
        new Promise((resolve) => setTimeout(() => resolve(pending), 20)),
      ]);
      expect(result).toBe(pending);
      expect(msal.acquireTokenRedirect).toHaveBeenCalledOnce();
    });

    it('comes back to the page the user was on, with one redirect for many requests', async () => {
      TestBed.inject(Location).go('/cases/case-details?id=4');
      msal.acquireTokenSilent.mockRejectedValue(
        new InteractionRequiredAuthError('interaction_required', 'correlation-id'),
      );
      void auth.getApiToken();
      void auth.getApiToken();
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(msal.acquireTokenRedirect).toHaveBeenCalledOnce();
      expect(msal.acquireTokenRedirect).toHaveBeenCalledWith(
        expect.objectContaining({ state: '/cases/case-details?id=4' }),
      );
    });

    it('rethrows other token errors', async () => {
      msal.acquireTokenSilent.mockRejectedValue(new Error('network'));
      await expect(auth.getApiToken()).rejects.toThrow('network');
      expect(msal.acquireTokenRedirect).not.toHaveBeenCalled();
    });

    it('fails when nobody is signed in', async () => {
      await auth.logout();
      await expect(auth.getApiToken()).rejects.toThrow('Not signed in.');
    });
  });
});
