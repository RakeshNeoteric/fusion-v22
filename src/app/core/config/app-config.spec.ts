import { TestBed } from '@angular/core/testing';
import { APP_CONFIG, type AppConfig, provideAppConfig } from './app-config';

/*
 * Note: the test build applies the same file replacement as `ng serve`, so the injected
 * config is environment.development.ts. Production values are checked by the production build.
 */
describe('APP_CONFIG', () => {
  let config: AppConfig;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideAppConfig()] });
    config = TestBed.inject(APP_CONFIG);
  });

  it('uses an https API base URL without a trailing slash', () => {
    expect(config.apiBaseUrl).toMatch(/^https:\/\/\S+[^/]$/);
  });

  it('requests at least one API scope', () => {
    expect(config.azureAd.apiScopes.length).toBeGreaterThan(0);
  });

  it('uses https redirect URIs (required by the Azure AD app registration)', () => {
    expect(config.azureAd.redirectUri).toMatch(/^https:\/\//);
    expect(config.azureAd.postLogoutRedirectUri).toMatch(/^https:\/\//);
  });

  it('runs tests against the development configuration', () => {
    expect(config.production).toBe(false);
    expect(config.azureAd.redirectUri).toBe('https://localhost:4200/home');
  });
});
