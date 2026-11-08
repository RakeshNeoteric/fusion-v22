import { TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { provideAppIcons } from '@core/icons/app-icons';
import { provideAppDates } from '@shared/forms/dates/app-dates';

/**
 * App-wide providers every test gets, as app.config gives them to the app: the icons (every
 * popup's title shows one) and the date setup the date fields need. Material's animations are
 * off, so lists and popups open and close at once.
 */
beforeEach(() => {
  TestBed.configureTestingModule({
    providers: [
      provideAppIcons(),
      provideAppDates(),
      { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
    ],
  });
});
