import {
  ApplicationConfig,
  DEFAULT_CURRENCY_CODE,
  inject,
  LOCALE_ID,
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
import { DashboardService } from './core/services/dashboard.service';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';

// Pipes de data/moeda usam 'pt-BR' em todas as telas, não só nas que registravam localmente.
registerLocaleData(localePt, 'pt-BR');

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes),
    provideHttpClient(withFetch(), withInterceptors([tokenInterceptor])),
    provideIonicAngular(),
    // Telas que usam `currency`/`number`/`date` sem locale explícito formatavam em en-US ("R$2,446.21").
    { provide: LOCALE_ID, useValue: 'pt-BR' },
    { provide: DEFAULT_CURRENCY_CODE, useValue: 'BRL' },
    {
      provide: AUTH_NAVIGATION_HANDLER,
      useFactory: () => {
        const authService = inject(AuthService);
        const dashboardService = inject(DashboardService);
        return {
          logout: () => authService.logout(),
          currentUser: () => authService.currentUser(),
          ensureAccountBalance: () => {
            if (
              authService.isAuthenticated() &&
              dashboardService.resumo() === null &&
              !dashboardService.loading()
            ) {
              dashboardService.carregarResumo().subscribe({ error: () => undefined });
            }
          },
        };
      },
    },
  ],
};

