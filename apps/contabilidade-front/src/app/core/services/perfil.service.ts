import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, finalize, switchMap, tap, throwError } from 'rxjs';
import { AtualizarPerfilDto, PerfilUsuario } from '@contabilidade/models';
import { API_URL } from './categoria.service';
import { AuthService } from './auth.service';
import { mensagemErroHttp } from '../utils/http-error';

/** Perfil do usuário logado (`/user/me`) e foto (`/user/:id/avatar`). */
@Injectable({
  providedIn: 'root',
})
export class PerfilService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_URL);
  private readonly auth = inject(AuthService);

  readonly perfil = signal<PerfilUsuario | null>(null);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  carregar(): Observable<PerfilUsuario> {
    this.loading.set(true);
    this.error.set(null);
    return this.http.get<PerfilUsuario>(`${this.baseUrl}/user/me`).pipe(
      tap((p) => this.aplicar(p)),
      catchError((err: unknown) => {
        this.error.set(mensagemErroHttp(err, 'Erro ao carregar seu perfil.'));
        return throwError(() => err);
      }),
      finalize(() => this.loading.set(false))
    );
  }

  /** 409 = nome ou e-mail já usado por outro usuário. */
  atualizar(dto: AtualizarPerfilDto): Observable<PerfilUsuario> {
    return this.http.put<PerfilUsuario>(`${this.baseUrl}/user/me`, dto).pipe(
      tap((p) => this.aplicar(p)),
      catchError((err: unknown) => {
        const status = (err as { status?: number })?.status;
        const msg =
          status === 409
            ? mensagemErroHttp(err, 'Este nome ou e-mail já está em uso por outra conta.')
            : mensagemErroHttp(err, 'Erro ao salvar seu perfil.');
        return throwError(() => new Error(msg));
      })
    );
  }

  /** Envia a foto (JPEG/PNG/WEBP/GIF até 2 MB) e recarrega o perfil para obter o novo avatarUrl. */
  enviarAvatar(userId: number, foto: Blob): Observable<PerfilUsuario> {
    const form = new FormData();
    form.append('avatar', foto, 'avatar.jpg');
    return this.http.post(`${this.baseUrl}/user/${userId}/avatar`, form).pipe(
      switchMap(() => this.http.get<PerfilUsuario>(`${this.baseUrl}/user/me`)),
      tap((p) => this.aplicar(p)),
      catchError((err: unknown) =>
        throwError(() => new Error(mensagemErroHttp(err, 'Não foi possível enviar a foto.')))
      )
    );
  }

  private aplicar(p: PerfilUsuario): void {
    this.perfil.set(p);
    this.auth.atualizarUsuarioLocal({
      nome: p.nome,
      email: p.email,
      avatar: p.avatar ?? undefined,
      avatarUrl: p.avatarUrl,
    });
  }
}
