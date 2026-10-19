import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { LoginPage } from './login.page';
import { AuthService } from '../../core/services/auth.service';
import { AuthResponse, Usuario } from '@contabilidade/models';

describe('LoginPage', () => {
  let component: LoginPage;
  let fixture: ComponentFixture<LoginPage>;
  let router: Router;
  let authServiceSpy: {
    login: ReturnType<typeof vi.fn>;
    loading: ReturnType<typeof signal<boolean>>;
  };

  const mockUsuario: Usuario = {
    id: 1,
    nome: 'Usuário Teste',
    email: 'teste@exemplo.com',
  };

  const mockResponse: AuthResponse = {
    token: 'jwt-token-valido',
    usuario: mockUsuario,
  };

  beforeEach(async () => {
    authServiceSpy = {
      login: vi.fn(),
      loading: signal<boolean>(false),
    };

    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceSpy },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockImplementation(() => Promise.resolve(true));

    fixture = TestBed.createComponent(LoginPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve ser criado com formulário inválido inicialmente e exibir recursos financeiros', () => {
    expect(component).toBeTruthy();
    expect(component.loginForm.valid).toBe(false);
    expect(component.errorMessage()).toBeNull();
    expect(component.features.length).toBe(4);
    expect(component.previewMetrics.length).toBe(3);
  });

  it('deve alternar a visibilidade da senha ao acionar togglePasswordVisibility', () => {
    expect(component.showPassword()).toBe(false);

    component.togglePasswordVisibility();
    expect(component.showPassword()).toBe(true);

    component.togglePasswordVisibility();
    expect(component.showPassword()).toBe(false);
  });

  it('deve validar obrigatoriedade de usuário e tamanho mínimo da senha', () => {
    const usernameControl = component.loginForm.controls.username;
    const senhaControl = component.loginForm.controls.senha;

    expect(usernameControl.errors?.['required']).toBe(true);
    expect(senhaControl.errors?.['required']).toBe(true);

    usernameControl.setValue('usuario_teste');
    expect(usernameControl.valid).toBe(true);

    senhaControl.setValue('123');
    expect(senhaControl.errors?.['minlength']).toBeTruthy();

    senhaControl.setValue('1234');
    expect(senhaControl.valid).toBe(true);

    expect(component.loginForm.valid).toBe(true);
  });

  it('não deve chamar authService.login se o formulário for inválido', () => {
    component.onSubmit();

    expect(authServiceSpy.login).not.toHaveBeenCalled();
    expect(component.loginForm.touched).toBe(true);
  });

  it('deve chamar authService.login e navegar para /dashboard em caso de sucesso', () => {
    authServiceSpy.login.mockReturnValue(of(mockResponse));

    component.loginForm.controls.username.setValue('valido@dominio.com');
    component.loginForm.controls.senha.setValue('senha123');

    component.onSubmit();

    expect(authServiceSpy.login).toHaveBeenCalledWith({
      email: 'valido@dominio.com',
      senha: 'senha123',
    });
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(component.errorMessage()).toBeNull();
  });

  it('deve chamar authService.login com nome quando username não contiver @', () => {
    authServiceSpy.login.mockReturnValue(of(mockResponse));

    component.loginForm.controls.username.setValue('usuario_fidelis');
    component.loginForm.controls.senha.setValue('senha123');

    component.onSubmit();

    expect(authServiceSpy.login).toHaveBeenCalledWith({
      nome: 'usuario_fidelis',
      senha: 'senha123',
    });
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('deve exibir mensagem de erro amigável caso o login falhe', () => {
    authServiceSpy.login.mockReturnValue(
      throwError(() => ({
        error: { erro: 'Usuário ou senha incorretos' },
      }))
    );

    component.loginForm.controls.username.setValue('usuario');
    component.loginForm.controls.senha.setValue('senha-errada');

    component.onSubmit();

    expect(authServiceSpy.login).toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.errorMessage()).toBe('Usuário ou senha incorretos');
  });
});
