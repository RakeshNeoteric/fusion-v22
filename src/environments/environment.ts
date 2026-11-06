import type { AppConfig } from '../app/core/config/app-config';

/** Production configuration. Client and tenant IDs are public identifiers, not secrets. */
export const environment: AppConfig = {
  production: true,
  apiBaseUrl: 'https://fusionedge.runasp.net',
  azureAd: {
    clientId: '86ab7b9d-d725-4593-ac9e-a1c681f5a537',
    authority: 'https://login.microsoftonline.com/24b85339-4ffd-44c6-93e7-bece888aec07',
    redirectUri: 'https://fusionedge-dev.runasp.net/home',
    postLogoutRedirectUri: 'https://fusionedge-dev.runasp.net/login',
    apiScopes: ['api://86ab7b9d-d725-4593-ac9e-a1c681f5a537/access_as_user'],
  },
  agGridLicenseKey: null,
};
