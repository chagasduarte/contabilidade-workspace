import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService, AUTH_API_URL } from './auth.service';
import { AuthResponse, LoginCredentials, Usuario } from '@contabilidade/models';

describe('AuthService', () => {
  let service: AuthService;
  let httpTesting: HttpTestingController;
  let routerSpy: { navigate: ReturnType<typeof vi.fn> };

  const mockUsuario: Usuario = {
    id: 1,
    nome: 'João Silva',
    email: 'joao@exemplo.com',
    avatar: 'avatar.png',
  };

  const mockAuthResponse: AuthResponse = {
    token: 'jwt-token-12345',
    usuario: mockUsuario,
  };

  beforeEach(() => {
    localStorage.clear();
    routerSpy = {
      navigate: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: routerSpy },
        { provide: AUTH_API_URL, useValue: 'http://localhost:3000' },
      ],
    });

    service = TestBed.inject(AuthService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    localStorage.clear();
  });

  describe('Inicialização', () => {
    it('deve inicializar com estado nulo quando o localStorage estiver vazio', () => {
      expect(service.currentUser()).toBeNull();
      expect(service.token()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
      expect(service.getToken()).toBeNull();
      expect(service.loading()).toBe(false);
    });

    it('deve restaurar token e usuário persistidos no localStorage', () => {
      localStorage.setItem('token', 'stored-token-999');
      localStorage.setItem('usuario', JSON.stringify(mockUsuario));

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          AuthService,
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: Router, useValue: routerSpy },
        ],
      });

      const restoredService = TestBed.inject(AuthService);

      expect(restoredService.token()).toBe('stored-token-999');
      expect(restoredService.currentUser()).toEqual(mockUsuario);
      expect(restoredService.isAuthenticated()).toBe(true);
      expect(restoredService.getToken()).toBe('stored-token-999');
    });

    it('deve tratar json inválido no localStorage limpando os dados sem quebrar', () => {
      localStorage.setItem('token', 'stored-token');
      localStorage.setItem('usuario', 'invalid-json');

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          AuthService,
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: Router, useValue: routerSpy },
        ],
      });

      const fallbackService = TestBed.inject(AuthService);

      expect(fallbackService.token()).toBeNull();
      expect(fallbackService.currentUser()).toBeNull();
      expect(fallbackService.isAuthenticated()).toBe(false);
    });
  });

  describe('login()', () => {
    it('deve atualizar os signals currentUser, token e isAuthenticated e persistir no localStorage', () => {
      const credentials: LoginCredentials = {
        email: 'joao@exemplo.com',
        senha: 'senha123',
      };

      let responseEmitted: AuthResponse | undefined;

      service.login(credentials).subscribe((res) => {
        responseEmitted = res;
      });

      expect(service.loading()).toBe(true);

      const req = httpTesting.expectOne('http://localhost:3000/auth/login');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        nome: 'joao@exemplo.com',
        senha: 'senha123',
        email: 'joao@exemplo.com',
      });

      req.flush(mockAuthResponse);

      expect(responseEmitted).toEqual(mockAuthResponse);
      expect(service.loading()).toBe(false);
      expect(service.token()).toBe(mockAuthResponse.token);
      expect(service.currentUser()).toEqual(mockUsuario);
      expect(service.isAuthenticated()).toBe(true);
      expect(service.getToken()).toBe(mockAuthResponse.token);

      expect(localStorage.getItem('token')).toBe(mockAuthResponse.token);
      expect(localStorage.getItem('usuario')).toBe(JSON.stringify(mockUsuario));
    });

    it('deve desativar o status de loading em caso de erro no login', () => {
      const credentials: LoginCredentials = {
        email: 'joao@exemplo.com',
        senha: 'senha-errada',
      };

      let hasError = false;
      service.login(credentials).subscribe({
        error: () => {
          hasError = true;
        },
      });

      const req = httpTesting.expectOne('http://localhost:3000/auth/login');
      req.flush({ error: 'Credenciais inválidas' }, { status: 401, statusText: 'Unauthorized' });

      expect(hasError).toBe(true);
      expect(service.loading()).toBe(false);
      expect(service.token()).toBeNull();
      expect(service.currentUser()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
    });
  });

  describe('logout()', () => {
    it('deve limpar o localStorage, resetar os signals e redirecionar para /login', () => {
      localStorage.setItem('token', 'token-ativo');
      localStorage.setItem('usuario', JSON.stringify(mockUsuario));
      service.token.set('token-ativo');
      service.currentUser.set(mockUsuario);

      service.logout();

      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('usuario')).toBeNull();
      expect(service.token()).toBeNull();
      expect(service.currentUser()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
      expect(service.loading()).toBe(false);
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
    });
  });

  describe('Validação e Expiração de JWT', () => {
    function createMockJwt(payload: Record<string, unknown>): string {
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const body = btoa(JSON.stringify(payload));
      const signature = 'mock-signature';
      return `${header}.${body}.${signature}`;
    }

    it('deve retornar true para tokens nulos, vazios ou com exp no passado', () => {
      expect(service.isTokenExpired(null)).toBe(true);
      expect(service.isTokenExpired('')).toBe(true);

      const pastExp = Math.floor(Date.now() / 1000) - 3600; // 1 hora atrás
      const expiredToken = createMockJwt({ id: 1, exp: pastExp });
      expect(service.isTokenExpired(expiredToken)).toBe(true);
    });

    it('deve retornar false para token JWT válido com exp no futuro', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600; // daqui a 1 hora
      const validToken = createMockJwt({ id: 1, exp: futureExp });
      expect(service.isTokenExpired(validToken)).toBe(false);
    });

    it('deve considerar isAuthenticated como false quando o token estiver expirado', () => {
      const pastExp = Math.floor(Date.now() / 1000) - 100;
      const expiredToken = createMockJwt({ id: 1, exp: pastExp });

      service.token.set(expiredToken);
      expect(service.isAuthenticated()).toBe(false);
    });

    it('deve deslogar e limpar sessão se o token restaurado do localStorage estiver expirado', () => {
      const pastExp = Math.floor(Date.now() / 1000) - 60;
      const expiredToken = createMockJwt({ id: 1, exp: pastExp });

      localStorage.setItem('token', expiredToken);
      localStorage.setItem('usuario', JSON.stringify(mockUsuario));

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          AuthService,
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: Router, useValue: routerSpy },
        ],
      });

      const newService = TestBed.inject(AuthService);

      expect(newService.token()).toBeNull();
      expect(newService.currentUser()).toBeNull();
      expect(newService.isAuthenticated()).toBe(false);
      expect(localStorage.getItem('token')).toBeNull();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('deve deslogar ao chamar getToken() se o token atual estiver expirado', () => {
      const pastExp = Math.floor(Date.now() / 1000) - 60;
      const expiredToken = createMockJwt({ id: 1, exp: pastExp });

      service.token.set(expiredToken);
      const token = service.getToken();

      expect(token).toBeNull();
      expect(service.token()).toBeNull();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
    });
  });
});

