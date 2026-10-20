import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { AlertController } from '@ionic/angular';
import { MaisPage } from './mais.page';
import { TransacaoService } from '../../core/services/transacao.service';
import { CategoriaService } from '../../core/services/categoria.service';
import { CartaoService } from '../../core/services/cartao.service';
import { AuthService } from '../../core/services/auth.service';
import { Categoria, Cartao } from '@contabilidade/models';

describe('MaisPage', () => {
  let component: MaisPage;
  let fixture: ComponentFixture<MaisPage>;

  let transacaoServiceStub: {
    criarTransacao: ReturnType<typeof vi.fn>;
    criarTransacoesParceladas: ReturnType<typeof vi.fn>;
  };

  let categoriaServiceStub: {
    categorias: ReturnType<typeof signal<Categoria[]>>;
    listarCategorias: ReturnType<typeof vi.fn>;
  };

  let cartaoServiceStub: {
    cartoes: ReturnType<typeof signal<Cartao[]>>;
    listarCartoes: ReturnType<typeof vi.fn>;
  };

  let authServiceStub: {
    currentUser: ReturnType<typeof signal<{ id: number; nome: string; email: string } | null>>;
    logout: ReturnType<typeof vi.fn>;
  };

  let alertCtrlStub: {
    create: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    transacaoServiceStub = {
      criarTransacao: vi.fn().mockReturnValue(of({})),
      criarTransacoesParceladas: vi.fn().mockReturnValue(of([])),
    };

    categoriaServiceStub = {
      categorias: signal([]),
      listarCategorias: vi.fn().mockReturnValue(of([])),
    };

    cartaoServiceStub = {
      cartoes: signal([]),
      listarCartoes: vi.fn().mockReturnValue(of([])),
    };

    authServiceStub = {
      currentUser: signal({ id: 1, nome: 'Ana Lima', email: 'ana@teste.com' }),
      logout: vi.fn(),
    };

    alertCtrlStub = {
      create: vi.fn().mockResolvedValue({
        present: vi.fn().mockResolvedValue(undefined),
      }),
    };

    await TestBed.configureTestingModule({
      imports: [MaisPage],
      providers: [
        provideRouter([]),
        { provide: TransacaoService, useValue: transacaoServiceStub },
        { provide: CategoriaService, useValue: categoriaServiceStub },
        { provide: CartaoService, useValue: cartaoServiceStub },
        { provide: AuthService, useValue: authServiceStub },
        { provide: AlertController, useValue: alertCtrlStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MaisPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and render title and menu items', () => {
    expect(component).toBeTruthy();
    expect(component.menuItems.length).toBeGreaterThan(0);
  });

  it('should toggle transaction modal visibility', () => {
    expect(component.modalNovaTransacaoAberto()).toBe(false);

    component.abrirModalNovaTransacao();
    expect(component.modalNovaTransacaoAberto()).toBe(true);

    component.fecharModalNovaTransacao();
    expect(component.modalNovaTransacaoAberto()).toBe(false);
  });

  it('should display user initials from currentUser', () => {
    expect(component.userInitial()).toBe('A');
  });

  it('should present alert and call authService.logout on confirmation', async () => {
    await component.confirmarLogout();

    expect(alertCtrlStub.create).toHaveBeenCalledWith(
      expect.objectContaining({
        header: 'Sair da Conta',
      })
    );

    const alertConfig = alertCtrlStub.create.mock.calls[0][0];
    const confirmBtn = alertConfig.buttons.find(
      (b: { text: string; role?: string }) => b.text === 'Sair'
    );
    expect(confirmBtn).toBeTruthy();

    confirmBtn.handler();
    expect(authServiceStub.logout).toHaveBeenCalledTimes(1);
  });
});

