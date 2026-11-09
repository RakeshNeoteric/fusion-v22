import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  type ApplicationConfig,
  EnvironmentInjector,
  type Provider,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideAppConfig } from '@core/config/app-config';
import { apiUrlInterceptor, authInterceptor, errorInterceptor } from '@core/http/interceptors';
import { provideAppIcons } from '@core/icons/app-icons';
import { PROFILE_EDITOR, type ProfileEditor } from '@core/layout/header/profile-editor';
import { SessionService } from '@core/session/session.service';
import { provideAppDates } from '@shared/forms/dates/app-dates';
import { routes } from './app.routes';
import { provideDialogDefaults } from '@shared/ui/dialog-size';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAppConfig(),
    // Order matters: errorInterceptor is outermost so it also sees URL/token failures.
    provideHttpClient(withInterceptors([errorInterceptor, apiUrlInterceptor, authInterceptor])),
    provideAppIcons(),
    provideAppDates(),
    provideDialogDefaults(),
    // Sign-in and AppInit finish before the first route is chosen, so guards see the real session.
    provideAppInitializer(() => inject(SessionService).start()),
    provideRouter(routes, withComponentInputBinding()),
    provideProfileEditor(),
  ],
};

/** The header's "My Profile": the form and its phone library load on first use. */
function provideProfileEditor(): Provider {
  return {
    provide: PROFILE_EDITOR,
    useFactory: (): ProfileEditor => {
      const injector = inject(EnvironmentInjector);
      return {
        open: async () => {
          const { MyProfile } = await import('@features/security/users/my-profile');
          await injector.get(MyProfile).open();
        },
      };
    },
  };
}
