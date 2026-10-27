import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Endpoints públicos (método + caminho exato) que dispensam o cabeçalho Authorization.
 * A comparação é exata para que rotas como `/user/avatar` continuem autenticadas.
 */
const PUBLIC_ENDPOINTS: ReadonlyArray<{ method: string; path: string }> = [
  { method: 'POST', path: '/auth/login' },
  { method: 'POST', path: '/auth/register' },
  { method: 'POST', path: '/user' },
];

function extrairCaminho(url: string): string {
  try {
    return new URL(url, 'http://localhost').pathname.replace(/\/+$/, '');
  } catch {
    return url.split('?')[0].replace(/\/+$/, '');
  }
}

function isPublic(method: string, url: string): boolean {
  const caminho = extrairCaminho(url);
  return PUBLIC_ENDPOINTS.some(
    (e) => e.method === method.toUpperCase() && caminho.endsWith(e.path)
  );
}

/**
 * 401 sempre indica sessão inválida. 403 também é usado pela API para regras de
 * negócio (ex.: categoria padrão do sistema), então só derruba a sessão quando
 * a mensagem se refere ao token.
 */
function isSessaoInvalida(error: HttpErrorResponse): boolean {
  if (error.status === 401) return true;
  if (error.status !== 403) return false;
  const mensagem = String(error.error?.erro ?? error.error?.error ?? '').toLowerCase();
  return mensagem.includes('token');
}

/**
 * Interceptor funcional HTTP para:
 * 1. Anexar o cabeçalho Authorization: Bearer <token> às requisições autenticadas.
 * 2. Verificar se o token JWT está expirado antes do envio e redirecionar para o login.
 * 3. Capturar respostas HTTP 401 (ou 403 de token inválido) da API e redirecionar para o login.
 */
export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  if (isPublic(req.method, req.url)) {
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
      if (error instanceof HttpErrorResponse && isSessaoInvalida(error)) {
        authService.logout?.();
      }
      return throwError(() => error);
    })
  );
};


