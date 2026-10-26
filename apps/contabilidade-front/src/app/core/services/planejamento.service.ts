import { inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, finalize, forkJoin, tap, throwError } from 'rxjs';
import {
  AgrupamentoTipoPlanejamento,
  CreatePlanejamentoDto,
  Planejamento,
  ResumoPlanejamento,
  TipoPlanejamento,
  UpdatePlanejamentoDto,
} from '@contabilidade/models';
import { API_URL } from './categoria.service';
import { mensagemErroHttp } from '../utils/http-error';

/**
 * Orçamento mensal por categoria.
 * `resumo` traz planejado x realizado; `agrupados` traz as linhas editáveis (ids/subcategorias).
 */
@Injectable({
  providedIn: 'root',
})
export class PlanejamentoService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_URL);

  readonly resumo = signal<ResumoPlanejamento | null>(null);
  readonly agrupados = signal<AgrupamentoTipoPlanejamento[]>([]);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  /** Carrega o resumo do tipo e o agrupamento do mês em paralelo. */
  carregarMes(
    mes: number,
    ano: number,
    tipo: TipoPlanejamento
  ): Observable<{ resumo: ResumoPlanejamento; agrupados: AgrupamentoTipoPlanejamento[] }> {
    this.loading.set(true);
    this.error.set(null);
    const params = new HttpParams().set('mes', String(mes)).set('ano', String(ano));

    return forkJoin({
      resumo: this.http.get<ResumoPlanejamento>(`${this.baseUrl}/planejamento/resumo`, {
        params: params.set('tipo', tipo),
      }),
      agrupados: this.http.get<AgrupamentoTipoPlanejamento[]>(
        `${this.baseUrl}/planejamento/agrupados`,
        { params }
      ),
    }).pipe(
      tap(({ resumo, agrupados }) => {
        this.resumo.set(resumo);
        this.agrupados.set(agrupados ?? []);
      }),
      catchError((err: unknown) => {
        this.error.set(mensagemErroHttp(err, 'Erro ao carregar o planejamento do mês.'));
        return throwError(() => err);
      }),
      finalize(() => this.loading.set(false))
    );
  }

  criar(dto: CreatePlanejamentoDto): Observable<Planejamento> {
    return this.http.post<Planejamento>(`${this.baseUrl}/planejamento`, dto).pipe(
      catchError((err: unknown) =>
        throwError(() => new Error(mensagemErroHttp(err, 'Erro ao salvar o planejamento.')))
      )
    );
  }

  atualizar(id: number, dto: UpdatePlanejamentoDto): Observable<Planejamento> {
    return this.http.put<Planejamento>(`${this.baseUrl}/planejamento/${id}`, dto).pipe(
      catchError((err: unknown) =>
        throwError(() => new Error(mensagemErroHttp(err, 'Erro ao atualizar o planejamento.')))
      )
    );
  }

  remover(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/planejamento/${id}`).pipe(
      catchError((err: unknown) =>
        throwError(() => new Error(mensagemErroHttp(err, 'Erro ao excluir o planejamento.')))
      )
    );
  }
}
