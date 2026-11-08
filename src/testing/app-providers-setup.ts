import { TestBed } from '@angular/core/testing';
import { provideAppIcons } from '@core/icons/app-icons';
import { provideAppDates } from '@shared/forms/dates/app-dates';

/**
 * App-wide providers every test gets, as app.config gives them to the app: the icons (every
 * popup's title shows one) and the date setup the date fields need.
 */
beforeEach(() => {
  TestBed.configureTestingModule({ providers: [provideAppIcons(), provideAppDates()] });
});
