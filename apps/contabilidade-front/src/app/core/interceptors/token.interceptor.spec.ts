import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { tokenInterceptor } from './token.interceptor';
import { AuthService } from '../services/auth.service';

describe('tokenInterceptor', () => {
  let httpClient: HttpClient;
  let httpTesting: HttpTestingController;
  let tokenSignal: ReturnType<typeof signal<string | null>>;

  beforeEach(() => {
    tokenSignal = signal<string | null>(null);

    const authServiceStub = {
      getToken: () => tokenSignal(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([tokenInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authServiceStub },
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('deve incluir o header Authorization quando o token existir', () => {
    tokenSignal.set('jwt-valido-123');

    httpClient.get('/api/categorias').subscribe();

    const req = httpTesting.expectOne('/api/categorias');
    expect(req.request.headers.has('Authorization')).toBe(true);
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-valido-123');
    req.flush([]);
  });

  it('não deve incluir o header Authorization quando o token for nulo', () => {
    tokenSignal.set(null);

    httpClient.get('/api/categorias').subscribe();

    const req = httpTesting.expectOne('/api/categorias');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
  });

  it('não deve incluir o header Authorization para rotas públicas como /auth/login', () => {
    tokenSignal.set('jwt-valido-123');

    httpClient.post('/auth/login', { email: 'teste@email.com', senha: '123' }).subscribe();

    const req = httpTesting.expectOne('/auth/login');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({ token: 'novo-token' });
  });

  it('deve deslogar e abortar requisição protegida quando o token JWT estiver expirado', () => {
    const logoutSpy = vi.fn();
    const isTokenExpiredSpy = vi.fn().mockReturnValue(true);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([tokenInterceptor])),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            getToken: () => 'token-expirado',
            isTokenExpired: isTokenExpiredSpy,
            logout: logoutSpy,
          },
        },
      ],
    });

    const client = TestBed.inject(HttpClient);
    let capturedError: Error | undefined;

    client.get('/api/transacoes').subscribe({
      error: (err) => {
        capturedError = err;
      },
    });

    expect(logoutSpy).toHaveBeenCalled();
    expect(capturedError?.message).toContain('Sessão expirada');
  });

  it('deve chamar logout ao receber erro 401 em rota protegida', () => {
    const logoutSpy = vi.fn();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([tokenInterceptor])),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            getToken: () => 'jwt-valido-123',
            isTokenExpired: () => false,
            logout: logoutSpy,
          },
        },
      ],
    });

    const client = TestBed.inject(HttpClient);
    const ctrl = TestBed.inject(HttpTestingController);

    client.get('/api/transacoes').subscribe({
      error: () => {
        // Ignora erro proposital
      },
    });

    const req = ctrl.expectOne('/api/transacoes');
    req.flush({ erro: 'Não autorizado' }, { status: 401, statusText: 'Unauthorized' });

    expect(logoutSpy).toHaveBeenCalled();
    ctrl.verify();
  });

  it('deve chamar logout ao receber erro 403 em rota protegida (token expirado no servidor)', () => {
    const logoutSpy = vi.fn();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([tokenInterceptor])),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            getToken: () => 'jwt-valido-123',
            isTokenExpired: () => false,
            logout: logoutSpy,
          },
        },
      ],
    });

    const client = TestBed.inject(HttpClient);
    const ctrl = TestBed.inject(HttpTestingController);

    client.get('/api/dashboard/resumo').subscribe({
      error: () => {
        // Ignora erro proposital
      },
    });

    const req = ctrl.expectOne('/api/dashboard/resumo');
    req.flush({ erro: 'Token inválido ou expirado' }, { status: 403, statusText: 'Forbidden' });

    expect(logoutSpy).toHaveBeenCalled();
    ctrl.verify();
  });

  it('não deve chamar logout quando erro 401 ocorrer em rota pública como /auth/login', () => {
    const logoutSpy = vi.fn();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([tokenInterceptor])),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            getToken: () => null,
            isTokenExpired: () => false,
            logout: logoutSpy,
          },
        },
      ],
    });

    const client = TestBed.inject(HttpClient);
    const ctrl = TestBed.inject(HttpTestingController);

    client.post('/auth/login', { email: 'erro@email.com', senha: 'wrong' }).subscribe({
      error: () => {
        // Ignora erro proposital
      },
    });

    const req = ctrl.expectOne('/auth/login');
    req.flush({ erro: 'Credenciais inválidas' }, { status: 401, statusText: 'Unauthorized' });

    expect(logoutSpy).not.toHaveBeenCalled();
    ctrl.verify();
  });
  it('deve enviar Authorization em rotas protegidas de /user (ex.: /user/avatar)', () => {
    tokenSignal.set('jwt-valido-123');

    httpClient.get('/api/user/avatar').subscribe();
    httpClient.post('/api/user/7/avatar', {}).subscribe();

    expect(httpTesting.expectOne('/api/user/avatar').request.headers.get('Authorization')).toBe(
      'Bearer jwt-valido-123'
    );
    expect(httpTesting.expectOne('/api/user/7/avatar').request.headers.has('Authorization')).toBe(
      true
    );
    httpTesting.match(() => true).forEach((r) => r.flush({}));
  });

  it('não deve enviar Authorization no cadastro público POST /user', () => {
    tokenSignal.set('jwt-valido-123');

    httpClient.post('/api/user', {}).subscribe();

    const req = httpTesting.expectOne('/api/user');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('não deve deslogar em 403 de regra de negócio (categoria padrão do sistema)', () => {
    const logoutSpy = vi.fn();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([tokenInterceptor])),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            getToken: () => 'jwt-valido-123',
            isTokenExpired: () => false,
            logout: logoutSpy,
          },
        },
      ],
    });

    const client = TestBed.inject(HttpClient);
    const ctrl = TestBed.inject(HttpTestingController);

    client.delete('/api/categorias/1').subscribe({ error: () => undefined });

    ctrl
      .expectOne('/api/categorias/1')
      .flush(
        { erro: 'Categorias padrão do sistema não podem ser alteradas.' },
        { status: 403, statusText: 'Forbidden' }
      );

    expect(logoutSpy).not.toHaveBeenCalled();
    ctrl.verify();
  });
});

