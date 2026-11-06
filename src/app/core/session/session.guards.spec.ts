import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  type CanMatchFn,
  type Route,
  Router,
  UrlSegment,
  type UrlTree,
  provideRouter,
} from '@angular/router';
import { signedInGuard, signedOutGuard } from './session.guards';
import { SessionService } from './session.service';

/** Angular 22 passes the partially matched route snapshot; these guards do not use it. */
const noSnapshot = {} as Parameters<CanMatchFn>[2];

describe('session guards', () => {
  const isReady = signal(false);

  beforeEach(() => {
    isReady.set(false);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: SessionService, useValue: { isReady } }],
    });
  });

  function url(result: unknown): string {
    return TestBed.inject(Router).serializeUrl(result as UrlTree);
  }

  function segments(...paths: string[]): UrlSegment[] {
    return paths.map((path) => new UrlSegment(path, {}));
  }

  describe('signedInGuard', () => {
    const run = (paths: UrlSegment[]) =>
      TestBed.runInInjectionContext(() => signedInGuard({} as Route, paths, noSnapshot));

    it('lets a ready session in', () => {
      isReady.set(true);
      expect(run(segments('client', 'client'))).toBe(true);
    });

    it('sends others to login, remembering where they were going', () => {
      expect(url(run(segments('client', 'client')))).toBe('/login?returnUrl=%2Fclient%2Fclient');
    });

    it('does not add a return URL for the root', () => {
      expect(url(run([]))).toBe('/login');
    });
  });

  describe('signedOutGuard', () => {
    const run = () =>
      TestBed.runInInjectionContext(() => signedOutGuard({} as Route, [], noSnapshot));

    it('shows the login page when not signed in', () => {
      expect(run()).toBe(true);
    });

    it('sends a signed-in user home', () => {
      isReady.set(true);
      expect(url(run())).toBe('/home');
    });
  });
});
