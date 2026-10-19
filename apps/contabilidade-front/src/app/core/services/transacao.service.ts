import { inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap, catchError, throwError, finalize } from 'rxjs';
import {
  CreateParceladaDto,
  CreateTransacaoDto,
  ResumoTransacoesEntrada,
  ResumoTransacoesSaida,
  Transacao,
} from '@contabilidade/models';
import { API_URL } from './categoria.service';

@Injectable({
  providedIn: 'root',
})
export class TransacaoService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_URL);

  readonly extrato = signal<Transacao[]>([]);
  readonly saidasResumo = signal<ResumoTransacoesSaida | null>(null);
  readonly entradasResumo = signal<ResumoTransacoesEntrada | null>(null);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  /**
   * Busca o extrato de transações por mês e ano na API e atualiza o signal `extrato`.
   */
  carregarExtrato(
    mes?: number,
    ano?: number,
    limit = 0
  ): Observable<Transacao[]> {
    this.loading.set(true);
    this.error.set(null);

    let params = new HttpParams().set('limit', String(limit));
    if (mes != null) {
      params = params.set('mes', String(mes));
    }
    if (ano != null) {
      params = params.set('ano', String(ano));
    }

    return this.http
      .get<Transacao[]>(`${this.baseUrl}/transacoes/extrato`, { params })
      .pipe(
        tap((dados) => {
          this.extrato.set(dados ?? []);
        }),
        catchError((err: Error) => {
          this.error.set(
            err.message || 'Erro ao carregar extrato de lançamentos.'
          );
          return throwError(() => err);
        }),
        finalize(() => {
          this.loading.set(false);
        })
      );
  }

  /**
   * Cria um novo lançamento financeiro e adiciona ao signal `extrato`.
   */
  criarTransacao(dto: CreateTransacaoDto): Observable<Transacao> {
    this.loading.set(true);
    this.error.set(null);

    return this.http
      .post<Transacao>(`${this.baseUrl}/transacoes`, dto)
      .pipe(
        tap((nova) => {
          this.extrato.update((lista) => [nova, ...lista]);
        }),
        catchError((err: Error) => {
          this.error.set(err.message || 'Erro ao criar transação.');
          return throwError(() => err);
        }),
        finalize(() => {
          this.loading.set(false);
        })
      );
  }

  /**
   * Cria despesas parceladas (múltiplas parcelas) e anexa ao signal `extrato`.
   */
  criarTransacoesParceladas(dto: CreateParceladaDto): Observable<Transacao[]> {
    this.loading.set(true);
    this.error.set(null);

    return this.http
      .post<Transacao[]>(`${this.baseUrl}/transacoes/parceladas`, dto)
      .pipe(
        tap((novas) => {
          if (Array.isArray(novas) && novas.length > 0) {
            this.extrato.update((lista) => [...novas, ...lista]);
          }
        }),
        catchError((err: Error) => {
          this.error.set(err.message || 'Erro ao criar transações parceladas.');
          return throwError(() => err);
        }),
        finalize(() => {
          this.loading.set(false);
        })
      );
  }

  /**
   * Efetiva/marca uma transação como paga (`status = 'pago'`) e atualiza o signal localmente.
   */
  marcarComoPago(id: number): Observable<string> {
    this.loading.set(true);
    this.error.set(null);

    return this.http
      .get<string>(`${this.baseUrl}/transacoes/topago/${id}`)
      .pipe(
        tap(() => {
          this.extrato.update((lista) =>
            lista.map((item) =>
              item.id === id ? { ...item, status: 'pago' } : item
            )
          );
        }),
        catchError((err: Error) => {
          this.error.set(err.message || 'Erro ao efetivar transação.');
          return throwError(() => err);
        }),
        finalize(() => {
          this.loading.set(false);
        })
      );
  }

  /**
   * Exclui uma transação pelo ID e atualiza o signal `extrato`.
   */
  excluirTransacao(id: number): Observable<void> {
    this.loading.set(true);
    this.error.set(null);

    return this.http
      .delete<void>(`${this.baseUrl}/transacoes/${id}`)
      .pipe(
        tap(() => {
          this.extrato.update((lista) => lista.filter((item) => item.id !== id));
        }),
        catchError((err: Error) => {
          this.error.set(err.message || 'Erro ao excluir transação.');
          return throwError(() => err);
        }),
        finalize(() => {
          this.loading.set(false);
        })
      );
  }
}

