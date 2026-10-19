// forecast.service.ts
// Serviço para consulta ao Motor de Projeção de Fluxo de Caixa e Liquidação de Obrigações

import { inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap, catchError, throwError, finalize } from 'rxjs';
import {
  ForecastQueryDto,
  ForecastResponseDto,
  SettlePlannedTransactionDto,
  SettleLoanInstallmentDto,
  SettlePlannedTransactionResponseDto,
  SettleLoanInstallmentResponseDto,
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
export class ForecastService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl =
    inject(API_URL, { optional: true }) ?? environment.apiUrl;

  readonly forecastData = signal<ForecastResponseDto | null>(null);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  /**
   * Consulta a projeção de fluxo de caixa diária e mensal, Safe to Spend e simulação de compra.
   */
  getForecast(query?: ForecastQueryDto): Observable<ForecastResponseDto> {
    this.loading.set(true);
    this.error.set(null);

    let params = new HttpParams();
    if (query?.months) {
      params = params.set('months', query.months.toString());
    }
    if (
      query?.targetExpenseAmount !== undefined &&
      query?.targetExpenseAmount !== null &&
      query.targetExpenseAmount > 0
    ) {
      params = params.set(
        'targetExpenseAmount',
        query.targetExpenseAmount.toString()
      );
    }
    if (query?.targetExpenseDate) {
      const dateStr =
        query.targetExpenseDate instanceof Date
          ? query.targetExpenseDate.toISOString().split('T')[0]
          : String(query.targetExpenseDate).split('T')[0];
      params = params.set('targetExpenseDate', dateStr);
    }

    return this.http
      .get<ForecastResponseDto>(`${this.baseUrl}/forecast`, { params })
      .pipe(
        tap((data) => {
          this.forecastData.set(data);
        }),
        catchError((err: unknown) => {
          const msg = extractErrorMessage(
            err,
            'Erro ao carregar projeção financeira.'
          );
          this.error.set(msg);
          return throwError(() => new Error(msg));
        }),
        finalize(() => {
          this.loading.set(false);
        })
      );
  }

  /**
   * Efetiva / liquida contabilmente uma transação planejada avulsa.
   */
  settlePlannedTransaction(
    id: string,
    dto?: SettlePlannedTransactionDto
  ): Observable<SettlePlannedTransactionResponseDto> {
    return this.http
      .post<SettlePlannedTransactionResponseDto>(
        `${this.baseUrl}/planned-transactions/${encodeURIComponent(id)}/settle`,
        dto ?? {}
      )
      .pipe(
        catchError((err: unknown) => {
          const msg = extractErrorMessage(
            err,
            'Erro ao efetivar transação planejada.'
          );
          return throwError(() => new Error(msg));
        })
      );
  }

  /**
   * Efetiva / liquida contabilmente uma parcela de empréstimo.
   */
  settleLoanInstallment(
    id: string,
    dto?: SettleLoanInstallmentDto
  ): Observable<SettleLoanInstallmentResponseDto> {
    return this.http
      .post<SettleLoanInstallmentResponseDto>(
        `${this.baseUrl}/loans/installments/${encodeURIComponent(id)}/settle`,
        dto ?? {}
      )
      .pipe(
        catchError((err: unknown) => {
          const msg = extractErrorMessage(
            err,
            'Erro ao efetivar parcela de empréstimo.'
          );
          return throwError(() => new Error(msg));
        })
      );
  }
}

