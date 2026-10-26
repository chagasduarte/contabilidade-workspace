import { inject, Injectable, InjectionToken, signal } from '@angular/core';
import { mensagemErroHttp } from '../utils/http-error';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, tap, catchError, throwError, finalize } from 'rxjs';
import {
  Categoria,
  CreateCategoriaDto,
  UpdateCategoriaDto,
  Subcategoria,
  CreateSubcategoriaDto,
  UpdateSubcategoriaDto,
} from '@contabilidade/models';
import { environment } from '../../../environments/environment';

export const API_URL = new InjectionToken<string>('API_URL', {
  providedIn: 'root',
  factory: () => environment.apiUrl,
});

@Injectable({
  providedIn: 'root',
})
export class CategoriaService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_URL);

  readonly categorias = signal<Categoria[]>([]);
  readonly subcategorias = signal<Subcategoria[]>([]);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  /**
   * Busca a lista de todas as categorias na API e atualiza o signal `categorias`.
   */
  listarCategorias(): Observable<Categoria[]> {
    this.loading.set(true);
    this.error.set(null);

    return this.http.get<Categoria[]>(`${this.baseUrl}/categorias`).pipe(
      tap((data) => {
        this.categorias.set(data);
      }),
      catchError((err: HttpErrorResponse) => {
        this.error.set(mensagemErroHttp(err, 'Erro ao carregar categorias.'));
        return throwError(() => err);
      }),
      finalize(() => {
        this.loading.set(false);
      })
    );
  }

  /**
   * Envia uma nova categoria para criação e anexa ao signal de categorias localmente.
   */
  criarCategoria(dto: CreateCategoriaDto): Observable<Categoria> {
    this.loading.set(true);
    this.error.set(null);

    return this.http.post<Categoria>(`${this.baseUrl}/categorias`, dto).pipe(
      tap((novaCategoria) => {
        this.categorias.update((lista) => [...lista, novaCategoria]);
      }),
      catchError((err: HttpErrorResponse) => {
        this.error.set(mensagemErroHttp(err, 'Erro ao criar categoria.'));
        return throwError(() => err);
      }),
      finalize(() => {
        this.loading.set(false);
      })
    );
  }

  /**
   * Atualiza uma categoria existente via PUT e atualiza o estado local.
   */
  atualizarCategoria(
    id: number | string,
    dto: UpdateCategoriaDto
  ): Observable<Categoria> {
    this.loading.set(true);
    this.error.set(null);

    const numericId = Number(id);

    return this.http
      .put<Categoria>(`${this.baseUrl}/categorias/${id}`, dto)
      .pipe(
        tap((categoriaAtualizada) => {
          this.categorias.update((lista) =>
            lista.map((cat) =>
              cat.id === numericId
                ? { ...cat, ...dto, ...(categoriaAtualizada || {}) }
                : cat
            )
          );
        }),
        catchError((err: HttpErrorResponse) => {
          this.error.set(mensagemErroHttp(err, 'Erro ao atualizar categoria.'));
          return throwError(() => err);
        }),
        finalize(() => {
          this.loading.set(false);
        })
      );
  }

  /**
   * Remove uma categoria por ID e remove do signal de categorias localmente.
   */
  removerCategoria(id: number | string): Observable<void> {
    this.loading.set(true);
    this.error.set(null);

    const numericId = Number(id);

    return this.http.delete<void>(`${this.baseUrl}/categorias/${id}`).pipe(
      tap(() => {
        this.categorias.update((lista) =>
          lista.filter((cat) => cat.id !== numericId)
        );
        this.subcategorias.update((subs) =>
          subs.filter((sub) => sub.idcategoria !== numericId)
        );
      }),
      catchError((err: HttpErrorResponse) => {
        this.error.set(mensagemErroHttp(err, 'Erro ao remover categoria.'));
        return throwError(() => err);
      }),
      finalize(() => {
        this.loading.set(false);
      })
    );
  }

  /**
   * Busca subcategorias vinculadas à categoria informada e atualiza o signal `subcategorias`.
   */
  listarSubcategorias(categoriaId: number | string): Observable<Subcategoria[]> {
    this.loading.set(true);
    this.error.set(null);

    return this.http
      .get<Subcategoria[]>(`${this.baseUrl}/subcategorias/categoria/${categoriaId}`)
      .pipe(
        tap((data) => {
          this.subcategorias.set(data);
        }),
        catchError((err: HttpErrorResponse) => {
          this.error.set(mensagemErroHttp(err, 'Erro ao carregar subcategorias.'));
          return throwError(() => err);
        }),
        finalize(() => {
          this.loading.set(false);
        })
      );
  }

  /**
   * Cria uma nova subcategoria e a anexa ao signal de subcategorias localmente.
   */
  criarSubcategoria(dto: CreateSubcategoriaDto): Observable<Subcategoria> {
    this.loading.set(true);
    this.error.set(null);

    return this.http
      .post<Subcategoria>(`${this.baseUrl}/subcategorias`, dto)
      .pipe(
        tap((novaSub) => {
          this.subcategorias.update((lista) => [...lista, novaSub]);
        }),
        catchError((err: HttpErrorResponse) => {
          this.error.set(mensagemErroHttp(err, 'Erro ao criar subcategoria.'));
          return throwError(() => err);
        }),
        finalize(() => {
          this.loading.set(false);
        })
      );
  }

  /**
   * Atualiza uma subcategoria existente via PUT e reflete a alteração no signal local.
   */
  atualizarSubcategoria(
    id: number | string,
    dto: UpdateSubcategoriaDto
  ): Observable<Subcategoria> {
    this.loading.set(true);
    this.error.set(null);

    const numericId = Number(id);

    return this.http
      .put<Subcategoria>(`${this.baseUrl}/subcategorias/${id}`, dto)
      .pipe(
        tap((subAtualizada) => {
          this.subcategorias.update((lista) =>
            lista.map((sub) =>
              sub.id === numericId
                ? { ...sub, ...dto, ...(subAtualizada || {}) }
                : sub
            )
          );
        }),
        catchError((err: HttpErrorResponse) => {
          this.error.set(mensagemErroHttp(err, 'Erro ao atualizar subcategoria.'));
          return throwError(() => err);
        }),
        finalize(() => {
          this.loading.set(false);
        })
      );
  }

  /**
   * Remove uma subcategoria por ID e remove do signal de subcategorias localmente.
   */
  removerSubcategoria(id: number | string): Observable<void> {
    this.loading.set(true);
    this.error.set(null);

    const numericId = Number(id);

    return this.http.delete<void>(`${this.baseUrl}/subcategorias/${id}`).pipe(
      tap(() => {
        this.subcategorias.update((lista) =>
          lista.filter((sub) => sub.id !== numericId)
        );
      }),
      catchError((err: HttpErrorResponse) => {
        this.error.set(mensagemErroHttp(err, 'Erro ao remover subcategoria.'));
        return throwError(() => err);
      }),
      finalize(() => {
        this.loading.set(false);
      })
    );
  }
}

