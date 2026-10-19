import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * URLs ou padrões de endpoint públicos que dispensam o cabeçalho Authorization.
 */
const PUBLIC_ENDPOINTS = ['/auth/login', '/auth/register', '/user'];

/**
 * Interceptor funcional HTTP para:
 * 1. Anexar o cabeçalho Authorization: Bearer <token> às requisições autenticadas.
 * 2. Verificar se o token JWT está expirado antes do envio e redirecionar para o login.
 * 3. Capturar respostas HTTP 401/403 (token inválido/expirado) da API e redirecionar para o login.
 */
export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  const isPublicEndpoint = PUBLIC_ENDPOINTS.some((endpoint) =>
    req.url.includes(endpoint)
  );

  if (isPublicEndpoint) {
    return next(req);
  }

  const token = authService.getToken();

  if (authService.isTokenExpired?.(token)) {
    authService.logout?.();
    return throwError(() => new Error('Sessão expirada. Faça login novamente.'));
  }

  const authReq = token
    ? req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
        },
      })
    : req;

  return next(authReq).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        (error.status === 401 || error.status === 403)
      ) {
        authService.logout?.();
      }
      return throwError(() => error);
    })
  );
};


