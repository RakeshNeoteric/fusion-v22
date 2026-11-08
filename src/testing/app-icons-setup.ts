import { TestBed } from '@angular/core/testing';
import { provideAppIcons } from '@core/icons/app-icons';

/**
 * Registers the app's icons for every test, as app.config does for the app, so a component
 * that shows one (e.g. every popup's title, DialogHeader) needs no setup of its own.
 */
beforeEach(() => {
  TestBed.configureTestingModule({ providers: [provideAppIcons()] });
});
