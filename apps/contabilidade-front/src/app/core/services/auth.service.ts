import { inject, Injectable, InjectionToken, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { AuthResponse, LoginCredentials, RegisterData, Usuario } from '@contabilidade/models';
import { environment } from '../../../environments/environment';

export interface JwtPayload {
  exp?: number;
  iat?: number;
  id?: number;
  nome?: string;
  email?: string;
  [key: string]: unknown;
}

export function decodeJwtPayload(token: string): JwtPayload | null {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  try {
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');

    let jsonString: string;
    if (typeof atob === 'function') {
      jsonString = atob(padded);
    } else if (typeof Buffer !== 'undefined') {
      jsonString = Buffer.from(padded, 'base64').toString('utf-8');
    } else {
      return null;
    }

    try {
      jsonString = decodeURIComponent(
        Array.prototype.map
          .call(jsonString, (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
    } catch {
      // jsonString mantém o valor decodificado base64 se não tiver formato URI
    }

    return JSON.parse(jsonString) as JwtPayload;
  } catch {
    return null;
  }
}

export const AUTH_API_URL = new InjectionToken<string>('AUTH_API_URL', {
  providedIn: 'root',
  factory: () => environment.apiUrl,
});

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly baseUrl = inject(AUTH_API_URL);

  private readonly TOKEN_KEY = 'token';
  private readonly USER_KEY = 'usuario';
  private expirationTimer: ReturnType<typeof setTimeout> | null = null;

  readonly currentUser = signal<Usuario | null>(null);
  readonly token = signal<string | null>(null);
  readonly isAuthenticated = computed(() => {
    const currentToken = this.token();
    return !!currentToken && !this.isTokenExpired(currentToken);
  });
  readonly loading = signal<boolean>(false);

  constructor() {
    this.restoreSession();
  }

  isTokenExpired(tokenToCheck?: string | null): boolean {
    const token = tokenToCheck ?? this.token();
    if (!token) {
      return true;
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      return false;
    }

    const payload = decodeJwtPayload(token);
    if (!payload) {
      return true;
    }

    if (typeof payload.exp === 'number') {
      return payload.exp * 1000 <= Date.now();
    }

    return false;
  }

  private clearExpirationTimer(): void {
    if (this.expirationTimer) {
      clearTimeout(this.expirationTimer);
      this.expirationTimer = null;
    }
  }

  private scheduleExpirationTimer(token: string): void {
    this.clearExpirationTimer();

    const payload = decodeJwtPayload(token);
    if (!payload || typeof payload.exp !== 'number') {
      return;
    }

    const msUntilExpiry = payload.exp * 1000 - Date.now();
    if (msUntilExpiry <= 0) {
      this.logout();
      return;
    }

    const safeDelay = Math.min(msUntilExpiry, 2147483647);
    this.expirationTimer = setTimeout(() => {
      this.logout();
    }, safeDelay);
  }

  private restoreSession(): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      const storedToken = localStorage.getItem(this.TOKEN_KEY);
      const storedUser = localStorage.getItem(this.USER_KEY);

      if (storedToken) {
        if (this.isTokenExpired(storedToken)) {
          this.logout();
          return;
        }
        this.token.set(storedToken);
        this.scheduleExpirationTimer(storedToken);
      }

      if (storedUser) {
        const parsedUser: Usuario = JSON.parse(storedUser);
        this.currentUser.set(parsedUser);
      }
    } catch {
      this.logout();
    }
  }

  login(credentials: LoginCredentials): Observable<AuthResponse> {
    this.loading.set(true);

    const payload = {
      nome: credentials.nome || credentials.email || '',
      senha: credentials.senha,
      ...(credentials.email ? { email: credentials.email } : {}),
    };

    return this.http
      .post<AuthResponse>(`${this.baseUrl}/auth/login`, payload)
      .pipe(
        tap({
          next: (response) => {
            if (typeof window !== 'undefined' && window.localStorage) {
              localStorage.setItem(this.TOKEN_KEY, response.token);
              localStorage.setItem(this.USER_KEY, JSON.stringify(response.usuario));
            }
            this.token.set(response.token);
            this.currentUser.set(response.usuario);
            this.scheduleExpirationTimer(response.token);
            this.loading.set(false);
          },
          error: () => {
            this.loading.set(false);
          },
        })
      );
  }

  register(data: RegisterData): Observable<AuthResponse> {
    this.loading.set(true);

    const payload = {
      nome: data.nome.trim(),
      email: data.email.trim().toLowerCase(),
      senha: data.senha,
    };

    return this.http
      .post<AuthResponse>(`${this.baseUrl}/auth/register`, payload)
      .pipe(
        tap({
          next: (response) => {
            if (response.token && typeof window !== 'undefined' && window.localStorage) {
              localStorage.setItem(this.TOKEN_KEY, response.token);
              localStorage.setItem(this.USER_KEY, JSON.stringify(response.usuario));
              this.token.set(response.token);
              this.currentUser.set(response.usuario);
              this.scheduleExpirationTimer(response.token);
            }
            this.loading.set(false);
          },
          error: () => {
            this.loading.set(false);
          },
        })
      );
  }

  logout(): void {
    this.clearExpirationTimer();
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
    }
    this.token.set(null);
    this.currentUser.set(null);
    this.loading.set(false);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    const current = this.token();
    if (current) {
      if (this.isTokenExpired(current)) {
        this.logout();
        return null;
      }
      return current;
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      const storedToken = localStorage.getItem(this.TOKEN_KEY);
      if (storedToken) {
        if (this.isTokenExpired(storedToken)) {
          this.logout();
          return null;
        }
        this.token.set(storedToken);
        this.scheduleExpirationTimer(storedToken);
        return storedToken;
      }
    }

    return null;
  }
}

