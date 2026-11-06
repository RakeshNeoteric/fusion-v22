import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  type ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideAppConfig } from '@core/config/app-config';
import { apiUrlInterceptor, authInterceptor, errorInterceptor } from '@core/http/interceptors';
import { provideAppIcons } from '@core/icons/app-icons';
import { SessionService } from '@core/session/session.service';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAppConfig(),
    // Order matters: errorInterceptor is outermost so it also sees URL/token failures.
    provideHttpClient(withInterceptors([errorInterceptor, apiUrlInterceptor, authInterceptor])),
    provideAppIcons(),
    // Sign-in and AppInit finish before the first route is chosen, so guards see the real session.
    provideAppInitializer(() => inject(SessionService).start()),
    provideRouter(routes, withComponentInputBinding()),
  ],
};
