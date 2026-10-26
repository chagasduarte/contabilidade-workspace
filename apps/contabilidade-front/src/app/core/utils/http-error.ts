import { HttpErrorResponse } from '@angular/common/http';

/**
 * Converte um erro HTTP em mensagem amigável para exibir na tela.
 * Prioriza a mensagem enviada pela API (`erro`/`error`) e nunca expõe
 * o texto técnico do Angular ("Http failure response for ...").
 */
export function mensagemErroHttp(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) {
      return 'Sem conexão com o servidor. Verifique sua internet e tente novamente.';
    }
    const api = err.error?.erro ?? err.error?.error ?? err.error?.message;
    if (typeof api === 'string' && api.trim()) {
      return api;
    }
    if (err.status >= 500) {
      return 'O servidor encontrou um problema. Tente novamente em instantes.';
    }
    return fallback;
  }
  if (err instanceof Error && err.message && !err.message.startsWith('Http failure')) {
    return err.message;
  }
  // Objetos no formato { error: { erro } } repassados por services/testes.
  const corpo = (err as { error?: { erro?: unknown; error?: unknown } } | null)?.error;
  const api = corpo?.erro ?? corpo?.error;
  if (typeof api === 'string' && api.trim()) {
    return api;
  }
  return fallback;
}
