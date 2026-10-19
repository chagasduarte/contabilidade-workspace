import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guarda funcional de rotas para proteger endpoints privados.
 * Redireciona usuários não autenticados para a página de login.
 */
export const authGuard: CanActivateFn = (): boolean | UrlTree => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  if (typeof authService.logout === 'function') {
    authService.logout();
  }

  return router.createUrlTree(['/login']);
};

