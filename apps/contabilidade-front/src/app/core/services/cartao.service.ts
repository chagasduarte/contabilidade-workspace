import { inject, Injectable, signal } from '@angular/core';
import { mensagemErroHttp } from '../utils/http-error';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError, finalize, switchMap, of, map } from 'rxjs';
import { Cartao } from '@contabilidade/models';
import { API_URL } from './categoria.service';

@Injectable({
  providedIn: 'root',
})
export class CartaoService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_URL);

  readonly cartoes = signal<Cartao[]>([]);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  /**
   * Busca a lista de cartões cadastrados do usuário na API e atualiza o signal `cartoes`.
   * Se a rota legada /cartao retornar vazia, consulta /cards como contingência resiliente.
   */
  listarCartoes(): Observable<Cartao[]> {
    this.loading.set(true);
    this.error.set(null);

    return this.http.get<Cartao[]>(`${this.baseUrl}/cartao`).pipe(
      switchMap((cartoes) => {
        if (cartoes && cartoes.length > 0) {
          return of(cartoes);
        }
        return this.http
          .get<Array<{ cartao?: Partial<Cartao> & { dia_fechamento?: number; limite_total?: number; usuario_id?: number }; id?: number; nome?: string; dia_fechamento?: number; dia_vencimento?: number; limite_total?: number; usuario_id?: number }>>(
            `${this.baseUrl}/cards`
          )
          .pipe(
            map((cardsRes) => {
              return (cardsRes ?? []).map((item) => {
                const c = item.cartao || item;
                return {
                  id: Number(c.id) || c.id,
                  nome: c.nome ?? '',
                  dia_fatura: Number(c.dia_fechamento ?? 1),
                  dia_vencimento: Number(c.dia_vencimento ?? 1),
                  limite: Number(c.limite_total ?? 0),
                  userid: Number(c.usuario_id ?? 0),
                } as Cartao;
              });
            }),
            catchError(() => of([] as Cartao[]))
          );
      }),
      tap((cartoes) => {
        this.cartoes.set(cartoes ?? []);
      }),
      catchError((err: Error) => {
        this.error.set(mensagemErroHttp(err, 'Erro ao carregar cartões.'));
        return throwError(() => err);
      }),
      finalize(() => {
        this.loading.set(false);
      })
    );
  }
}
