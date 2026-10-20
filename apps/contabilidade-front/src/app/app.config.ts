import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { provideIonicAngular } from '@ionic/angular';
import { AUTH_NAVIGATION_HANDLER } from '@org/shared-ui-navigation';
import { appRoutes } from './app.routes';
import { tokenInterceptor } from './core/interceptors/token.interceptor';
import { AuthService } from './core/services/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes),
    provideHttpClient(withFetch(), withInterceptors([tokenInterceptor])),
    provideIonicAngular(),
    { provide: AUTH_NAVIGATION_HANDLER, useExisting: AuthService },
  ],
};

