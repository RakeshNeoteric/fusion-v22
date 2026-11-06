import { InjectionToken, inject } from '@angular/core';
import {
  BrowserCacheLocation,
  type IPublicClientApplication,
  PublicClientApplication,
} from '@azure/msal-browser';
import { APP_CONFIG } from '@core/config/app-config';

/**
 * The MSAL client. Only AuthService uses it; tests replace it with a fake.
 * localStorage keeps the sign-in across tabs and browser restarts (same as v21).
 */
export const MSAL_CLIENT = new InjectionToken<IPublicClientApplication>('MSAL_CLIENT', {
  providedIn: 'root',
  factory: () => {
    const { azureAd } = inject(APP_CONFIG);
    return new PublicClientApplication({
      auth: {
        clientId: azureAd.clientId,
        authority: azureAd.authority,
        redirectUri: azureAd.redirectUri,
        postLogoutRedirectUri: azureAd.postLogoutRedirectUri,
      },
      cache: { cacheLocation: BrowserCacheLocation.LocalStorage },
    });
  },
});
