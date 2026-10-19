import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

describe('authGuard', () => {
  const mockUrlTree = { toString: () => '/login' } as unknown as UrlTree;
  let routerSpy: { createUrlTree: ReturnType<typeof vi.fn> };
  let isAuthenticatedMock: boolean;

  let logoutSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    isAuthenticatedMock = false;
    logoutSpy = vi.fn();
    routerSpy = {
      createUrlTree: vi.fn().mockReturnValue(mockUrlTree),
    };

    const authServiceStub = {
      isAuthenticated: () => isAuthenticatedMock,
      logout: logoutSpy,
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authServiceStub },
        { provide: Router, useValue: routerSpy },
      ],
    });
  });

  it('deve permitir acesso (retornar true) quando o usuário estiver autenticado', () => {
    isAuthenticatedMock = true;

    const result = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));

    expect(result).toBe(true);
    expect(logoutSpy).not.toHaveBeenCalled();
    expect(routerSpy.createUrlTree).not.toHaveBeenCalled();
  });

  it('deve bloquear acesso, deslogar e redirecionar para /login quando o usuário não estiver autenticado ou com token expirado', () => {
    isAuthenticatedMock = false;

    const result = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));

    expect(logoutSpy).toHaveBeenCalled();
    expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/login']);
    expect(result).toBe(mockUrlTree);
  });
});

