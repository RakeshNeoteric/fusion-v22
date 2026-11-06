import { InjectionToken, type Provider } from '@angular/core';
import { environment } from '../../../environments/environment';

/** Azure AD (Entra ID) settings for the SPA app registration. */
export interface AzureAdConfig {
  readonly clientId: string;
  readonly authority: string;
  readonly redirectUri: string;
  readonly postLogoutRedirectUri: string;
  /** Scopes requested when calling the Fusion Edge API. */
  readonly apiScopes: readonly string[];
}

/** Runtime configuration. Inject with `inject(APP_CONFIG)`; never import environment files directly. */
export interface AppConfig {
  readonly production: boolean;
  /** Fusion Edge Services base URL, without a trailing slash. */
  readonly apiBaseUrl: string;
  readonly azureAd: AzureAdConfig;
  /** AG Grid Enterprise licence key. `null` = Community edition only. */
  readonly agGridLicenseKey: string | null;
}

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');

export function provideAppConfig(): Provider {
  return { provide: APP_CONFIG, useValue: environment };
}
