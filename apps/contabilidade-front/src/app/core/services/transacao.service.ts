import { inject, Injectable, signal } from '@angular/core';
import { mensagemErroHttp } from '../utils/http-error';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap, catchError, throwError, finalize, map } from 'rxjs';
import {
  CreateParceladaDto,
  CreateTransacaoDto,
  ExtratoFiltros,
  ResumoTransacoesEntrada,
  ResumoTransacoesSaida,
  Transacao,
  ExtratoPaginado,
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

  /** Estado da paginação por cursor do extrato (`?paginado=true`). */
  readonly nextCursor = signal<string | null>(null);
  readonly carregandoMais = signal<boolean>(false);
  readonly totaisExtrato = signal<ExtratoPaginado['totais']>(null);

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
            mensagemErroHttp(err, 'Erro ao carregar extrato de lançamentos.')
          );
          return throwError(() => err);
        }),
        finalize(() => {
          this.loading.set(false);
        })
      );
  }

  /**
   * Carrega uma página do extrato (`?paginado=true`). Sem `cursor`, reinicia a lista;
   * com `cursor`, anexa a próxima página ao signal `extrato`.
   * Se a API responder no formato antigo (array), trata como página única.
   */
  carregarExtratoPaginado(
    mes: number,
    ano: number,
    cursor: string | null = null,
    limit = 50,
    filtros?: ExtratoFiltros
  ): Observable<ExtratoPaginado> {
    const proximaPagina = cursor != null;
    if (proximaPagina) {
      this.carregandoMais.set(true);
    } else {
      this.loading.set(true);
      this.nextCursor.set(null);
      this.totaisExtrato.set(null);
    }
    this.error.set(null);

    let params = new HttpParams()
      .set('paginado', 'true')
      .set('limit', String(limit))
      .set('mes', String(mes))
      .set('ano', String(ano));
    if (filtros?.tipo) {
      params = params.set('tipo', filtros.tipo);
    }
    if (filtros?.status) {
      params = params.set('status', filtros.status);
    }
    if (cursor) {
      params = params.set('cursor', cursor);
    }

    return this.http
      .get<ExtratoPaginado | Transacao[]>(`${this.baseUrl}/transacoes/extrato`, { params })
      .pipe(
        map((resp): ExtratoPaginado =>
          Array.isArray(resp) ? { items: resp, next_cursor: null } : resp
        ),
        tap((pagina) => {
          const itens = pagina.items ?? [];
          if (proximaPagina) {
            this.extrato.update((atual) => {
              const ids = new Set(atual.map((t) => t.id));
              return [...atual, ...itens.filter((t) => !ids.has(t.id))];
            });
          } else {
            this.extrato.set(itens);
          }
          this.nextCursor.set(pagina.next_cursor ?? null);
          if (pagina.totais) {
            this.totaisExtrato.set(pagina.totais);
          }
        }),
        catchError((err: Error) => {
          this.error.set(mensagemErroHttp(err, 'Erro ao carregar extrato de lançamentos.'));
          return throwError(() => err);
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
          this.error.set(mensagemErroHttp(err, 'Erro ao criar transação.'));
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
          this.error.set(mensagemErroHttp(err, 'Erro ao criar transações parceladas.'));
          return throwError(() => err);
        }),
        finalize(() => {
          this.loading.set(false);
        })
      );
  }

  /**
   * Atualiza uma transação existente via PUT /transacoes/:id e sincroniza o signal `extrato`.
   */
  atualizarTransacao(
    id: number | string,
    dto: Partial<CreateTransacaoDto>
  ): Observable<Transacao> {
    this.loading.set(true);
    this.error.set(null);

    return this.http
      .put<Transacao>(`${this.baseUrl}/transacoes/${id}`, dto)
      .pipe(
        tap((atualizada) => {
          // A API devolve a linha atualizada: ela é a fonte da verdade (o dto de entrada tem
          // tipos de formulário, ex.: cartaoid string, que não cabem em Transacao)
          if (!atualizada) return;
          this.extrato.update((lista) =>
            lista.map((item) => (item.id === id ? { ...item, ...atualizada } : item))
          );
        }),
        catchError((err: Error) => {
          this.error.set(mensagemErroHttp(err, 'Erro ao atualizar transação.'));
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
          this.error.set(mensagemErroHttp(err, 'Erro ao efetivar transação.'));
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
          this.error.set(mensagemErroHttp(err, 'Erro ao excluir transação.'));
          return throwError(() => err);
        }),
        finalize(() => {
          this.loading.set(false);
        })
      );
  }
}

