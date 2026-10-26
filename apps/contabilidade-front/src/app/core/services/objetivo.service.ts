import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, finalize, tap, throwError } from 'rxjs';
import { CreateObjetivoDto, Objetivo, UpdateObjetivoDto } from '@contabilidade/models';
import { API_URL } from './categoria.service';
import { mensagemErroHttp } from '../utils/http-error';

/** Metas financeiras. O progresso vem calculado pela API. */
@Injectable({
  providedIn: 'root',
})
export class ObjetivoService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_URL);

  readonly objetivos = signal<Objetivo[]>([]);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  listar(): Observable<Objetivo[]> {
    this.loading.set(true);
    this.error.set(null);
    return this.http.get<Objetivo[]>(`${this.baseUrl}/objetivos`).pipe(
      tap((lista) => this.objetivos.set(lista ?? [])),
      catchError((err: unknown) => {
        this.error.set(mensagemErroHttp(err, 'Erro ao carregar seus objetivos.'));
        return throwError(() => err);
      }),
      finalize(() => this.loading.set(false))
    );
  }

  criar(dto: CreateObjetivoDto): Observable<Objetivo> {
    return this.http.post<Objetivo>(`${this.baseUrl}/objetivos`, dto).pipe(
      tap((novo) => this.objetivos.update((lista) => [...lista, novo])),
      catchError((err: unknown) =>
        throwError(() => new Error(mensagemErroHttp(err, 'Erro ao criar o objetivo.')))
      )
    );
  }

  atualizar(id: number, dto: UpdateObjetivoDto): Observable<Objetivo> {
    return this.http.put<Objetivo>(`${this.baseUrl}/objetivos/${id}`, dto).pipe(
      tap((atualizado) =>
        this.objetivos.update((lista) => lista.map((o) => (o.id === id ? atualizado : o)))
      ),
      catchError((err: unknown) =>
        throwError(() => new Error(mensagemErroHttp(err, 'Erro ao atualizar o objetivo.')))
      )
    );
  }

  /**
   * Registra um aporte com soma atômica no banco (não perde aportes feitos em outro aparelho).
   * Para corrigir o total guardado, use `atualizar(id, { valor_acumulado })`.
   */
  aportar(id: number, valor: number): Observable<Objetivo> {
    return this.http.post<Objetivo>(`${this.baseUrl}/objetivos/${id}/aportes`, { valor }).pipe(
      tap((atualizado) =>
        this.objetivos.update((lista) => lista.map((o) => (o.id === id ? atualizado : o)))
      ),
      catchError((err: unknown) =>
        throwError(() => new Error(mensagemErroHttp(err, 'Erro ao registrar o valor guardado.')))
      )
    );
  }

  remover(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/objetivos/${id}`).pipe(
      tap(() => this.objetivos.update((lista) => lista.filter((o) => o.id !== id))),
      catchError((err: unknown) =>
        throwError(() => new Error(mensagemErroHttp(err, 'Erro ao excluir o objetivo.')))
      )
    );
  }
}
