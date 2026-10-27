// card.service.ts

import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError, finalize } from 'rxjs';
import {
  CreditCard,
  CardInvoice,
  CardTransaction,
  InvoiceItem,
  CreateCardDto,
  CreateTransactionDto,
  PayInvoiceDto,
  CardDetailsResponseDto,
  InvoiceDetailsResponseDto,
} from '@contabilidade/models';
import { environment } from '../../../environments/environment';
import { API_URL } from './categoria.service';
import { mensagemErroHttp } from '../utils/http-error';

@Injectable({
  providedIn: 'root',
})
export class CardService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl =
    inject(API_URL, { optional: true }) ?? environment.apiUrl;

  readonly cartoes = signal<CardDetailsResponseDto[]>([]);
  readonly cartaoSelecionado = signal<CardDetailsResponseDto | null>(null);
  readonly faturaSelecionada = signal<InvoiceDetailsResponseDto | null>(null);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  /**
   * Lista todos os cartões de crédito do usuário com seus limites consolidados.
   */
  listarCartoes(): Observable<CardDetailsResponseDto[]> {
    this.loading.set(true);
    this.error.set(null);

    return this.http.get<CardDetailsResponseDto[]>(`${this.baseUrl}/cards`).pipe(
      tap((cartoes) => {
        this.cartoes.set(cartoes ?? []);
      }),
      catchError((err: unknown) => {
        const msg = mensagemErroHttp(err, 'Erro ao listar cartões de crédito.');
        this.error.set(msg);
        return throwError(() => new Error(msg));
      }),
      finalize(() => {
        this.loading.set(false);
      })
    );
  }

  /**
   * Obtém detalhes de um cartão específico incluindo seus limites e faturas.
   */
  obterCartaoPorId(id: string): Observable<CardDetailsResponseDto> {
    this.loading.set(true);
    this.error.set(null);

    return this.http.get<CardDetailsResponseDto>(`${this.baseUrl}/cards/${id}`).pipe(
      tap((detalhes) => {
        this.cartaoSelecionado.set(detalhes);
      }),
      catchError((err: unknown) => {
        const msg = mensagemErroHttp(err, 'Erro ao obter dados do cartão.');
        this.error.set(msg);
        return throwError(() => new Error(msg));
      }),
      finalize(() => {
        this.loading.set(false);
      })
    );
  }

  /**
   * Cadastra um novo cartão de crédito.
   */
  criarCartao(payload: CreateCardDto): Observable<CreditCard> {
    this.loading.set(true);
    this.error.set(null);

    return this.http.post<CreditCard>(`${this.baseUrl}/cards`, payload).pipe(
      catchError((err: unknown) => {
        const msg = mensagemErroHttp(err, 'Erro ao cadastrar cartão.');
        this.error.set(msg);
        return throwError(() => new Error(msg));
      }),
      finalize(() => {
        this.loading.set(false);
      })
    );
  }

  /**
   * Lista todas as faturas do cartão (com navegação opcional por ano).
   */
  listarFaturas(cartaoId: string, ano?: number): Observable<CardInvoice[]> {
    const url = ano
      ? `${this.baseUrl}/cards/${cartaoId}/faturas?ano=${ano}`
      : `${this.baseUrl}/cards/${cartaoId}/faturas`;

    return this.http.get<CardInvoice[]>(url).pipe(
      catchError((err: unknown) => {
        const msg = mensagemErroHttp(err, 'Erro ao listar faturas do cartão.');
        return throwError(() => new Error(msg));
      })
    );
  }

  /**
   * Retorna os detalhes de uma fatura específica com seus lançamentos (`invoice_items`).
   */
  obterDetalhesFatura(faturaId: string): Observable<InvoiceDetailsResponseDto> {
    this.loading.set(true);
    this.error.set(null);

    return this.http
      .get<InvoiceDetailsResponseDto>(`${this.baseUrl}/cards/faturas/${faturaId}`)
      .pipe(
        tap((faturaDetalhes) => {
          this.faturaSelecionada.set(faturaDetalhes);
        }),
        catchError((err: unknown) => {
          const msg = mensagemErroHttp(err, 'Erro ao carregar detalhes da fatura.');
          this.error.set(msg);
          return throwError(() => new Error(msg));
        }),
        finalize(() => {
          this.loading.set(false);
        })
      );
  }

  /**
   * Lança uma nova compra (à vista ou parcelada) no cartão de crédito.
   */
  lancarTransacao(
    payload: CreateTransactionDto
  ): Observable<{
    transacao: CardTransaction;
    itens: InvoiceItem[];
    cartaoAtualizado: CardDetailsResponseDto;
  }> {
    this.loading.set(true);
    this.error.set(null);

    return this.http
      .post<{
        transacao: CardTransaction;
        itens: InvoiceItem[];
        cartaoAtualizado: CardDetailsResponseDto;
      }>(`${this.baseUrl}/cards/transacoes`, payload)
      .pipe(
        tap((res) => {
          this.cartaoSelecionado.set(res.cartaoAtualizado);
        }),
        catchError((err: unknown) => {
          const msg = mensagemErroHttp(err, 'Erro ao lançar compra no cartão.');
          this.error.set(msg);
          return throwError(() => new Error(msg));
        }),
        finalize(() => {
          this.loading.set(false);
        })
      );
  }

  /**
   * Liquida uma fatura de cartão de crédito.
   */
  pagarFatura(
    faturaId: string,
    payload?: PayInvoiceDto
  ): Observable<{
    fatura: CardInvoice;
    cartaoAtualizado: CardDetailsResponseDto;
  }> {
    this.loading.set(true);
    this.error.set(null);

    return this.http
      .post<{
        fatura: CardInvoice;
        cartaoAtualizado: CardDetailsResponseDto;
      }>(`${this.baseUrl}/cards/faturas/${faturaId}/pagar`, payload ?? {})
      .pipe(
        tap((res) => {
          this.cartaoSelecionado.set(res.cartaoAtualizado);
          if (this.faturaSelecionada()?.fatura.id === faturaId) {
            this.faturaSelecionada.update((prev) =>
              prev ? { ...prev, fatura: res.fatura } : null
            );
          }
        }),
        catchError((err: unknown) => {
          const msg = mensagemErroHttp(err, 'Erro ao pagar fatura.');
          this.error.set(msg);
          return throwError(() => new Error(msg));
        }),
        finalize(() => {
          this.loading.set(false);
        })
      );
  }
}

