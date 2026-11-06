import type { AppConfig } from '../app/core/config/app-config';

/** Local development (`ng serve`, https://localhost:4200) against the hosted dev API. */
export const environment: AppConfig = {
  production: false,
  apiBaseUrl: 'https://fusionedge.runasp.net',
  azureAd: {
    clientId: '86ab7b9d-d725-4593-ac9e-a1c681f5a537',
    authority: 'https://login.microsoftonline.com/24b85339-4ffd-44c6-93e7-bece888aec07',
    redirectUri: 'https://localhost:4200/home',
    postLogoutRedirectUri: 'https://localhost:4200/login',
    apiScopes: ['api://86ab7b9d-d725-4593-ac9e-a1c681f5a537/access_as_user'],
  },
  agGridLicenseKey: null,
};
