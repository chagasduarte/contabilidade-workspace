import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { RegisterPage } from './register.page';
import { AuthService } from '../../core/services/auth.service';
import { AuthResponse, Usuario } from '@contabilidade/models';

describe('RegisterPage', () => {
  let component: RegisterPage;
  let fixture: ComponentFixture<RegisterPage>;
  let router: Router;
  let authServiceSpy: {
    register: ReturnType<typeof vi.fn>;
    loading: ReturnType<typeof signal<boolean>>;
  };

  const mockUsuario: Usuario = {
    id: 1,
    nome: 'Novo Usuário',
    email: 'novo@exemplo.com',
  };

  const mockResponse: AuthResponse = {
    token: 'jwt-token-valido',
    usuario: mockUsuario,
    message: 'Usuário cadastrado com sucesso',
  };

  beforeEach(async () => {
    authServiceSpy = {
      register: vi.fn(),
      loading: signal<boolean>(false),
    };

    await TestBed.configureTestingModule({
      imports: [RegisterPage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceSpy },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockImplementation(() => Promise.resolve(true));

    fixture = TestBed.createComponent(RegisterPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve ser criado com formulário inválido inicialmente e benefícios definidos', () => {
    expect(component).toBeTruthy();
    expect(component.registerForm.valid).toBe(false);
    expect(component.errorMessage()).toBeNull();
    expect(component.successMessage()).toBeNull();
    expect(component.benefits.length).toBe(4);
  });

  it('deve alternar a visibilidade de senha e confirmação de senha', () => {
    expect(component.showPassword()).toBe(false);
    component.togglePasswordVisibility();
    expect(component.showPassword()).toBe(true);

    expect(component.showConfirmPassword()).toBe(false);
    component.toggleConfirmPasswordVisibility();
    expect(component.showConfirmPassword()).toBe(true);
  });

  it('deve validar obrigatoriedade de campos e formato de e-mail', () => {
    const nomeCtrl = component.registerForm.controls.nome;
    const emailCtrl = component.registerForm.controls.email;
    const senhaCtrl = component.registerForm.controls.senha;
    const confirmarSenhaCtrl = component.registerForm.controls.confirmarSenha;

    expect(nomeCtrl.errors?.['required']).toBe(true);
    expect(emailCtrl.errors?.['required']).toBe(true);
    expect(senhaCtrl.errors?.['required']).toBe(true);
    expect(confirmarSenhaCtrl.errors?.['required']).toBe(true);

    nomeCtrl.setValue('A');
    expect(nomeCtrl.errors?.['minlength']).toBeTruthy();
    nomeCtrl.setValue('Carlos');
    expect(nomeCtrl.valid).toBe(true);

    emailCtrl.setValue('invalido');
    expect(emailCtrl.errors?.['email']).toBeTruthy();
    emailCtrl.setValue('carlos@exemplo.com');
    expect(emailCtrl.valid).toBe(true);

    senhaCtrl.setValue('123');
    expect(senhaCtrl.errors?.['minlength']).toBeTruthy();
    senhaCtrl.setValue('1234');
    expect(senhaCtrl.valid).toBe(true);
  });

  it('deve acusar erro quando as senhas não coincidirem', () => {
    component.registerForm.controls.nome.setValue('Carlos');
    component.registerForm.controls.email.setValue('carlos@exemplo.com');
    component.registerForm.controls.senha.setValue('senha123');
    component.registerForm.controls.confirmarSenha.setValue('outrasenha');

    component.registerForm.updateValueAndValidity();

    expect(component.registerForm.valid).toBe(false);
    expect(component.registerForm.controls.confirmarSenha.errors?.['passwordMismatch']).toBe(true);

    component.registerForm.controls.confirmarSenha.setValue('senha123');
    component.registerForm.updateValueAndValidity();

    expect(component.registerForm.valid).toBe(true);
  });

  it('não deve disparar authService.register se o formulário for inválido', () => {
    component.onSubmit();
    expect(authServiceSpy.register).not.toHaveBeenCalled();
    expect(component.registerForm.touched).toBe(true);
  });

  it('deve cadastrar com sucesso e redirecionar para /dashboard', fakeAsync(() => {
    authServiceSpy.register.mockReturnValue(of(mockResponse));

    component.registerForm.controls.nome.setValue('Novo Usuário');
    component.registerForm.controls.email.setValue('novo@exemplo.com');
    component.registerForm.controls.senha.setValue('senha1234');
    component.registerForm.controls.confirmarSenha.setValue('senha1234');

    component.onSubmit();

    expect(authServiceSpy.register).toHaveBeenCalledWith({
      nome: 'Novo Usuário',
      email: 'novo@exemplo.com',
      senha: 'senha1234',
    });

    expect(component.successMessage()).toContain('Conta criada com sucesso');

    tick(1000);
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  }));

  it('deve exibir mensagem de erro amigável caso o cadastro falhe (ex: email duplicado)', () => {
    authServiceSpy.register.mockReturnValue(
      throwError(() => ({
        error: { erro: 'Este e-mail já está cadastrado' },
      }))
    );

    component.registerForm.controls.nome.setValue('Novo Usuário');
    component.registerForm.controls.email.setValue('jaexiste@exemplo.com');
    component.registerForm.controls.senha.setValue('senha1234');
    component.registerForm.controls.confirmarSenha.setValue('senha1234');

    component.onSubmit();

    expect(authServiceSpy.register).toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.errorMessage()).toBe('Este e-mail já está cadastrado');
  });
});
