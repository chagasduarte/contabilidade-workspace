import { inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap, catchError, throwError, finalize, forkJoin } from 'rxjs';
import {
  AgrupamentoCategoria,
  DashboardResumo,
  DashboardDespesaItem,
  ProjecaoMensal,
} from '@contabilidade/models';
import { API_URL } from './categoria.service';

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_URL);

  readonly mes = signal<number>(new Date().getMonth() + 1);
  readonly ano = signal<number>(new Date().getFullYear());
  readonly resumo = signal<DashboardResumo | null>(null);
  readonly despesas = signal<DashboardDespesaItem[]>([]);
  readonly projecao = signal<ProjecaoMensal[]>([]);
  readonly agrupamento = signal<AgrupamentoCategoria[]>([]);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  /**
   * Busca o resumo financeiro mensal na API e atualiza o signal `resumo`.
   */
  carregarResumo(
    mes: number = this.mes(),
    ano: number = this.ano()
  ): Observable<DashboardResumo> {
    this.loading.set(true);
    this.error.set(null);

    const params = new HttpParams()
      .set('mes', String(mes))
      .set('ano', String(ano));

    return this.http
      .get<DashboardResumo>(`${this.baseUrl}/dashboard/resumo`, { params })
      .pipe(
        tap((dados) => {
          this.resumo.set(dados);
          this.despesas.set(dados.despesas_mes ?? []);
        }),
        catchError((err: Error) => {
          this.error.set(err.message || 'Erro ao carregar resumo do dashboard.');
          return throwError(() => err);
        }),
        finalize(() => {
          this.loading.set(false);
        })
      );
  }

  /**
   * Busca a projeção mensal de fluxo de caixa do ano informado e atualiza o signal `projecao`.
   */
  carregarProjecao(ano: number = this.ano()): Observable<ProjecaoMensal[]> {
    this.loading.set(true);
    this.error.set(null);

    const params = new HttpParams().set('ano', String(ano));

    return this.http
      .get<ProjecaoMensal[]>(`${this.baseUrl}/dashboard/projecao`, { params })
      .pipe(
        tap((dados) => {
          this.projecao.set(dados ?? []);
        }),
        catchError((err: Error) => {
          this.error.set(err.message || 'Erro ao carregar projeção anual.');
          return throwError(() => err);
        }),
        finalize(() => {
          this.loading.set(false);
        })
      );
  }

  /**
   * Busca o agrupamento de gastos por categoria no ano e atualiza o signal `agrupamento`.
   */
  carregarAgrupamento(
    ano: number = this.ano()
  ): Observable<AgrupamentoCategoria[]> {
    const params = new HttpParams().set('ano', String(ano));

    return this.http
      .get<AgrupamentoCategoria[]>(`${this.baseUrl}/dashboard/agrupamento`, {
        params,
      })
      .pipe(
        tap((dados) => {
          this.agrupamento.set(dados ?? []);
        }),
        catchError((err: Error) => {
          this.error.set(
            err.message || 'Erro ao carregar agrupamento de categorias.'
          );
          return throwError(() => err);
        })
      );
  }

  /**
   * Atualiza o período selecionado e carrega resumo + projeção em paralelo.
   */
  carregarDashboard(
    mes: number = this.mes(),
    ano: number = this.ano()
  ): Observable<{ resumo: DashboardResumo; projecao: ProjecaoMensal[] }> {
    this.mes.set(mes);
    this.ano.set(ano);
    this.loading.set(true);
    this.error.set(null);

    const resumoParams = new HttpParams()
      .set('mes', String(mes))
      .set('ano', String(ano));
    const projecaoParams = new HttpParams().set('ano', String(ano));

    return forkJoin({
      resumo: this.http.get<DashboardResumo>(
        `${this.baseUrl}/dashboard/resumo`,
        { params: resumoParams }
      ),
      projecao: this.http.get<ProjecaoMensal[]>(
        `${this.baseUrl}/dashboard/projecao`,
        { params: projecaoParams }
      ),
    }).pipe(
      tap(({ resumo, projecao }) => {
        this.resumo.set(resumo);
        this.projecao.set(projecao ?? []);
        this.despesas.set(resumo.despesas_mes ?? []);
      }),
      catchError((err: Error) => {
        this.error.set(err.message || 'Erro ao carregar dados do dashboard.');
        return throwError(() => err);
      }),
      finalize(() => {
        this.loading.set(false);
      })
    );
  }

  /**
   * Efetiva um item de despesa avulsa planejada (planned_transactions).
   */
  efetivarTransacaoPlanejada(id: string, valorPago?: number): Observable<unknown> {
    const payload = valorPago != null ? { valor_pago: valorPago } : {};
    return this.http.post(`${this.baseUrl}/planned-transactions/${id}/settle`, payload);
  }

  /**
   * Efetiva uma parcela de empréstimo (loan_installments).
   */
  efetivarParcelaEmprestimo(id: string, valorPago?: number): Observable<unknown> {
    const payload = valorPago != null ? { valor_pago: valorPago } : {};
    return this.http.post(`${this.baseUrl}/loans/installments/${id}/settle`, payload);
  }

  /**
   * Efetiva / liquida o pagamento de uma fatura de cartão de crédito.
   */
  pagarFaturaCartao(faturaId: string, valorPago?: number): Observable<unknown> {
    const payload = {
      valor_pago: valorPago,
      data_pagamento: new Date().toISOString().substring(0, 10),
    };
    return this.http.post(`${this.baseUrl}/cards/faturas/${faturaId}/pagar`, payload);
  }
}

