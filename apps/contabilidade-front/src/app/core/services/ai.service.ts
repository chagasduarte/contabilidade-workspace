import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { AiChatRequest, AiErroCodigo, SugestaoTransacao } from '@contabilidade/models';
import { API_URL } from './categoria.service';
import { mensagemErroHttp } from '../utils/http-error';

/** Erro do assistente com o `codigo` da API (a mensagem já é amigável). */
export class AiErro extends Error {
  constructor(
    message: string,
    readonly codigo: AiErroCodigo | null,
    readonly status: number
  ) {
    super(message);
    this.name = 'AiErro';
  }
}

@Injectable({
  providedIn: 'root',
})
export class AiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_URL);

  /** Pede uma sugestão de lançamento a partir de texto e/ou foto. Não grava nada. */
  sugerir(req: AiChatRequest): Observable<SugestaoTransacao> {
    return this.http.post<SugestaoTransacao>(`${this.baseUrl}/ai/chat`, req).pipe(
      catchError((err: unknown) => {
        const http = err instanceof HttpErrorResponse ? err : null;
        const codigo = (http?.error?.codigo as AiErroCodigo | undefined) ?? null;
        const fallback =
          http?.status === 413
            ? 'A foto é grande demais. Tente uma foto mais próxima do recibo.'
            : 'O assistente não conseguiu responder agora. Tente novamente.';
        return throwError(
          () => new AiErro(mensagemErroHttp(err, fallback), codigo, http?.status ?? 0)
        );
      })
    );
  }
}
