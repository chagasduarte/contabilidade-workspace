import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { MaisPage } from './mais.page';
import { TransacaoService } from '../../core/services/transacao.service';
import { CategoriaService } from '../../core/services/categoria.service';
import { CartaoService } from '../../core/services/cartao.service';
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

    await TestBed.configureTestingModule({
      imports: [MaisPage],
      providers: [
        provideRouter([]),
        { provide: TransacaoService, useValue: transacaoServiceStub },
        { provide: CategoriaService, useValue: categoriaServiceStub },
        { provide: CartaoService, useValue: cartaoServiceStub },
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
});

