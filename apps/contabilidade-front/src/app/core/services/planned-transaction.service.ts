// planned-transaction.service.ts

import { inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap, catchError, throwError, finalize } from 'rxjs';
import {
  CreatePlannedTransactionDto,
  PlannedTransaction,
  UpdatePlannedTransactionDto,
} from '@contabilidade/models';
import { environment } from '../../../environments/environment';
import { API_URL } from './categoria.service';

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object') {
    const errorObj = err as {
      error?: { erro?: string; message?: string; error?: string };
      message?: string;
    };
    if (errorObj.error) {
      if (errorObj.error.erro) return String(errorObj.error.erro);
      if (errorObj.error.message) return String(errorObj.error.message);
      if (errorObj.error.error) return String(errorObj.error.error);
    }
    if (errorObj.message) {
      return String(errorObj.message);
    }
  }
  return fallback;
}

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
          const msg = extractErrorMessage(err, 'Erro ao criar transação planejada.');
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
          const msg = extractErrorMessage(err, 'Erro ao atualizar transação planejada.');
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
          const msg = extractErrorMessage(err, 'Erro ao excluir transação planejada.');
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
          const msg = extractErrorMessage(err, 'Erro ao listar transações planejadas.');
          this.error.set(msg);
          return throwError(() => new Error(msg));
        }),
        finalize(() => this.loading.set(false))
      );
  }
}

