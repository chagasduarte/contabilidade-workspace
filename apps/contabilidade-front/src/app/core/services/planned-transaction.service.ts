// planned-transaction.service.ts

import { inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap, catchError, throwError, finalize, map } from 'rxjs';
import {
  CreatePlannedTransactionDto,
  PlannedTransaction,
  PlannedTransactionFiltros,
  PlannedTransactionPagina,
  SettlePlannedTransactionDto,
  SettlePlannedTransactionResponseDto,
  UpdatePlannedTransactionDto,
} from '@contabilidade/models';
import { environment } from '../../../environments/environment';
import { API_URL } from './categoria.service';
import { mensagemErroHttp } from '../utils/http-error';

@Injectable({
  providedIn: 'root',
})
export class PlannedTransactionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl =
    inject(API_URL, { optional: true }) ?? environment.apiUrl;

  readonly transacoesPlanejadas = signal<PlannedTransaction[]>([]);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  /** Paginação por cursor da listagem (`?paginado=true`). */
  readonly nextCursor = signal<string | null>(null);
  readonly carregandoMais = signal<boolean>(false);

  /**
   * Cria uma nova transação planejada (avulsa ou recorrente mensal).
   */
  criar(dto: CreatePlannedTransactionDto): Observable<PlannedTransaction> {
    this.loading.set(true);
    this.error.set(null);

    return this.http
      .post<PlannedTransaction>(`${this.baseUrl}/planned-transactions`, dto)
      .pipe(
        tap((created) => {
          this.transacoesPlanejadas.update((current) => [created, ...current]);
        }),
        catchError((err: unknown) => {
          const msg = mensagemErroHttp(err, 'Erro ao criar transação planejada.');
          this.error.set(msg);
          return throwError(() => new Error(msg));
        }),
        finalize(() => this.loading.set(false))
      );
  }

  /**
   * Atualiza uma transação planejada (pontual 'SINGLE' ou em massa 'ALL_FUTURE').
   */
  atualizar(
    id: string,
    dto: UpdatePlannedTransactionDto
  ): Observable<PlannedTransaction> {
    this.loading.set(true);
    this.error.set(null);

    return this.http
      .put<PlannedTransaction>(`${this.baseUrl}/planned-transactions/${id}`, dto)
      .pipe(
        tap((updated) => {
          this.transacoesPlanejadas.update((current) =>
            current.map((item) => (item.id === id ? updated : item))
          );
        }),
        catchError((err: unknown) => {
          const msg = mensagemErroHttp(err, 'Erro ao atualizar transação planejada.');
          this.error.set(msg);
          return throwError(() => new Error(msg));
        }),
        finalize(() => this.loading.set(false))
      );
  }

  /**
   * Remove uma transação planejada.
   */
  deletar(id: string): Observable<{ message: string; id: string }> {
    this.loading.set(true);
    this.error.set(null);

    return this.http
      .delete<{ message: string; id: string }>(`${this.baseUrl}/planned-transactions/${id}`)
      .pipe(
        tap(() => {
          this.transacoesPlanejadas.update((current) =>
            current.filter((item) => item.id !== id)
          );
        }),
        catchError((err: unknown) => {
          const msg = mensagemErroHttp(err, 'Erro ao excluir transação planejada.');
          this.error.set(msg);
          return throwError(() => new Error(msg));
        }),
        finalize(() => this.loading.set(false))
      );
  }

  /**
   * Lista transações planejadas.
   */
  listar(filtros?: {
    status?: string;
    tipo?: string;
    dataInicio?: string;
    dataFim?: string;
  }): Observable<PlannedTransaction[]> {
    this.loading.set(true);
    this.error.set(null);

    let params = new HttpParams();
    if (filtros?.status) params = params.set('status', filtros.status);
    if (filtros?.tipo) params = params.set('tipo', filtros.tipo);
    if (filtros?.dataInicio) params = params.set('dataInicio', filtros.dataInicio);
    if (filtros?.dataFim) params = params.set('dataFim', filtros.dataFim);

    return this.http
      .get<PlannedTransaction[]>(`${this.baseUrl}/planned-transactions`, { params })
      .pipe(
        tap((items) => this.transacoesPlanejadas.set(items ?? [])),
        catchError((err: unknown) => {
          const msg = mensagemErroHttp(err, 'Erro ao listar transações planejadas.');
          this.error.set(msg);
          return throwError(() => new Error(msg));
        }),
        finalize(() => this.loading.set(false))
      );
  }

  /**
   * Carrega uma página da listagem. Sem `cursor`, substitui a lista; com `cursor`,
   * anexa a próxima página. Aceita a resposta antiga (array) como página única.
   */
  listarPagina(
    filtros: PlannedTransactionFiltros,
    cursor: string | null = null,
    limit = 50
  ): Observable<PlannedTransactionPagina> {
    const proximaPagina = cursor != null;
    if (proximaPagina) {
      this.carregandoMais.set(true);
    } else {
      this.loading.set(true);
      this.nextCursor.set(null);
    }
    this.error.set(null);

    let params = new HttpParams().set('paginado', 'true').set('limit', String(limit));
    if (filtros.status) params = params.set('status', filtros.status);
    if (filtros.tipo) params = params.set('tipo', filtros.tipo);
    if (filtros.dataInicio) params = params.set('dataInicio', filtros.dataInicio);
    if (filtros.dataFim) params = params.set('dataFim', filtros.dataFim);
    if (cursor) params = params.set('cursor', cursor);

    return this.http
      .get<PlannedTransactionPagina | PlannedTransaction[]>(
        `${this.baseUrl}/planned-transactions`,
        { params }
      )
      .pipe(
        map((resp): PlannedTransactionPagina =>
          Array.isArray(resp) ? { items: resp, next_cursor: null } : resp
        ),
        tap((pagina) => {
          const itens = pagina.items ?? [];
          if (proximaPagina) {
            this.transacoesPlanejadas.update((atual) => {
              const ids = new Set(atual.map((t) => t.id));
              return [...atual, ...itens.filter((t) => !ids.has(t.id))];
            });
          } else {
            this.transacoesPlanejadas.set(itens);
          }
          this.nextCursor.set(pagina.next_cursor ?? null);
        }),
        catchError((err: unknown) => {
          const msg = mensagemErroHttp(err, 'Erro ao listar contas planejadas.');
          this.error.set(msg);
          return throwError(() => new Error(msg));
        }),
        finalize(() => {
          if (proximaPagina) {
            this.carregandoMais.set(false);
          } else {
            this.loading.set(false);
          }
        })
      );
  }

  /**
   * Efetiva a obrigação: gera a transação real e marca como SETTLED.
   * 409 = já efetivada anteriormente.
   */
  efetivar(
    id: string,
    dto: SettlePlannedTransactionDto = {}
  ): Observable<SettlePlannedTransactionResponseDto> {
    return this.http
      .post<SettlePlannedTransactionResponseDto>(
        `${this.baseUrl}/planned-transactions/${encodeURIComponent(id)}/settle`,
        dto
      )
      .pipe(
        tap(() => this.alterarStatusLocal(id, 'SETTLED')),
        catchError((err: unknown) =>
          throwError(() => new Error(mensagemErroHttp(err, 'Erro ao efetivar a conta.')))
        )
      );
  }

  /** Pula apenas esta ocorrência (status SKIPPED). */
  pular(id: string): Observable<PlannedTransaction> {
    return this.http
      .put<PlannedTransaction>(`${this.baseUrl}/planned-transactions/${encodeURIComponent(id)}`, {
        status: 'SKIPPED',
        updateMode: 'SINGLE',
      })
      .pipe(
        tap(() => this.alterarStatusLocal(id, 'SKIPPED')),
        catchError((err: unknown) =>
          throwError(() => new Error(mensagemErroHttp(err, 'Erro ao pular a conta.')))
        )
      );
  }

  /** Cancela a conta (exclusão lógica: status CANCELLED). */
  cancelar(id: string): Observable<unknown> {
    return this.http
      .delete(`${this.baseUrl}/planned-transactions/${encodeURIComponent(id)}`, {
        params: new HttpParams().set('soft', 'true'),
      })
      .pipe(
        tap(() => this.alterarStatusLocal(id, 'CANCELLED')),
        catchError((err: unknown) =>
          throwError(() => new Error(mensagemErroHttp(err, 'Erro ao cancelar a conta.')))
        )
      );
  }

  private alterarStatusLocal(id: string, status: PlannedTransaction['status']): void {
    this.transacoesPlanejadas.update((lista) =>
      lista.map((t) => (t.id === id ? { ...t, status } : t))
    );
  }
}
