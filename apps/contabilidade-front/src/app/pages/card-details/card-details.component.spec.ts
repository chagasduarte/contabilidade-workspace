// card-details.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { CardDetailsComponent } from './card-details.component';
import { CardService } from './card.service';
import { CardDetailsResponseDto, CardInvoice, InvoiceDetailsResponseDto } from './card.model';
import { CategoriaService } from '../../core/services/categoria.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { HeaderStateService } from '@org/shared-ui-navigation';
import { Categoria } from '@contabilidade/models';

describe('CardDetailsComponent', () => {
  let component: CardDetailsComponent;
  let fixture: ComponentFixture<CardDetailsComponent>;

  const mockCartaoDetalhes: CardDetailsResponseDto = {
    cartao: {
      id: 'card-1',
      usuario_id: 1,
      nome: 'Nubank Platinum',
      bandeira: 'Mastercard',
      limite_total: 5000,
      dia_fechamento: 20,
      dia_vencimento: 28,
      cor_identificacao: '#820AD1',
      ativo: true,
    },
    limite_total: 5000,
    limite_comprometido: 1000,
    limite_disponivel: 4000,
    faturas: [
      {
        id: 'fat-1',
        cartao_id: 'card-1',
        mes_referencia: 10,
        ano_referencia: 2026,
        data_fechamento: '2026-10-20',
        data_vencimento: '2026-10-28',
        status: 'OPEN',
        total_fatura: 1000,
      },
    ],
  };

  const mockFatura: CardInvoice = mockCartaoDetalhes.faturas?.[0] ?? {
    id: 'fat-1',
    cartao_id: 'card-1',
    mes_referencia: 10,
    ano_referencia: 2026,
    data_fechamento: '2026-10-20',
    data_vencimento: '2026-10-28',
    status: 'OPEN',
    total_fatura: 1000,
  };

  const mockFaturaDetalhes: InvoiceDetailsResponseDto = {
    fatura: mockFatura,
    cartao: mockCartaoDetalhes.cartao,
    itens: [
      {
        id: 'it-1',
        fatura_id: 'fat-1',
        transacao_id: 'tx-1',
        numero_parcela: 1,
        valor_parcela: 500,
        descricao: 'Smartphone',
        quantidade_parcelas: 2,
        data_compra: '2026-10-10',
      },
      {
        id: 'it-2',
        fatura_id: 'fat-1',
        transacao_id: 'tx-2',
        numero_parcela: 1,
        valor_parcela: 500,
        descricao: 'Supermercado',
        quantidade_parcelas: 1,
        data_compra: '2026-10-12',
      },
    ],
    valor_total: 1000,
  };

  let cardServiceStub: {
    cartaoSelecionado: ReturnType<typeof signal<CardDetailsResponseDto | null>>;
    faturaSelecionada: ReturnType<typeof signal<InvoiceDetailsResponseDto | null>>;
    loading: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    obterCartaoPorId: ReturnType<typeof vi.fn>;
    obterDetalhesFatura: ReturnType<typeof vi.fn>;
    lancarTransacao: ReturnType<typeof vi.fn>;
    pagarFatura: ReturnType<typeof vi.fn>;
  };

  let categoriaServiceStub: {
    categorias: ReturnType<typeof signal<Categoria[]>>;
    listarCategorias: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    categoriaServiceStub = {
      categorias: signal<Categoria[]>([
        { id: 1, nome: 'Alimentação', icone: 'restaurant-outline', cor: '#ef4444', tipo: 'despesa' },
        { id: 2, nome: 'Salário', icone: 'cash-outline', cor: '#22c55e', tipo: 'receita' },
      ]),
      listarCategorias: vi.fn().mockReturnValue(of([])),
    };

    cardServiceStub = {
      cartaoSelecionado: signal<CardDetailsResponseDto | null>(mockCartaoDetalhes),
      faturaSelecionada: signal<InvoiceDetailsResponseDto | null>(mockFaturaDetalhes),
      loading: signal<boolean>(false),
      error: signal<string | null>(null),
      obterCartaoPorId: vi.fn().mockReturnValue(of(mockCartaoDetalhes)),
      obterDetalhesFatura: vi.fn().mockReturnValue(of(mockFaturaDetalhes)),
      lancarTransacao: vi.fn().mockReturnValue(of({ transacao: {}, itens: [], cartaoAtualizado: mockCartaoDetalhes })),
      pagarFatura: vi.fn().mockReturnValue(of({ fatura: {}, cartaoAtualizado: mockCartaoDetalhes })),
    };

    const alertControllerStub = {
      create: vi.fn().mockResolvedValue({
        present: vi.fn().mockResolvedValue(undefined),
      }),
    };

    const toastControllerStub = {
      create: vi.fn().mockResolvedValue({
        present: vi.fn().mockResolvedValue(undefined),
      }),
    };

    const loadingControllerStub = {
      create: vi.fn().mockResolvedValue({
        present: vi.fn().mockResolvedValue(undefined),
        dismiss: vi.fn().mockResolvedValue(true),
      }),
    };

    await TestBed.configureTestingModule({
      imports: [CardDetailsComponent],
      providers: [
        provideRouter([]),
        { provide: CardService, useValue: cardServiceStub },
        { provide: CategoriaService, useValue: categoriaServiceStub },
        { provide: DashboardService, useValue: { mes: signal(10), ano: signal(2026) } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: vi.fn().mockReturnValue('card-1'),
              },
            },
          },
        },
        { provide: AlertController, useValue: alertControllerStub },
        { provide: ToastController, useValue: toastControllerStub },
        { provide: LoadingController, useValue: loadingControllerStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CardDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve ser criado e carregar os dados do cartão', () => {
    expect(component).toBeTruthy();
    expect(cardServiceStub.obterCartaoPorId).toHaveBeenCalledWith('card-1');
    expect(component.cartaoDetalhes()?.cartao.nome).toBe('Nubank Platinum');
  });

  it('mostra a fatura que vence no mês selecionado e carrega seus itens', () => {
    expect(component.tituloFaturaAtiva()).toBe('Outubro 2026');
    expect(component.faturaAtiva()?.id).toBe('fat-1');
    expect(cardServiceStub.obterDetalhesFatura).toHaveBeenCalledWith('fat-1');
    expect(component.detalhesFaturaAtiva()?.itens.length).toBe(2);
  });

  it('navega para meses sem fatura (setas sempre ativas) e não mostra itens de outra fatura', () => {
    const header = TestBed.inject(HeaderStateService);

    component.navegarMes(1);

    expect(component.tituloFaturaAtiva()).toBe('Novembro 2026');
    expect(component.faturaAtiva()).toBeNull();
    expect(component.detalhesFaturaAtiva()).toBeNull();
    expect(header.selectedMonth()).toBe(11);

    component.navegarMes(-1);
    expect(component.faturaAtiva()?.id).toBe('fat-1');
  });

  it('vira o ano ao navegar de janeiro para trás e de dezembro para frente', () => {
    component.mes.set(1);
    component.navegarMes(-1);
    expect([component.mes(), component.ano()]).toEqual([12, 2025]);

    component.navegarMes(1);
    expect([component.mes(), component.ano()]).toEqual([1, 2026]);
  });

  it('acompanha o mês escolhido no seletor do cabeçalho', () => {
    const header = TestBed.inject(HeaderStateService);

    header.setMonth(12);
    fixture.detectChanges();

    expect(component.mes()).toBe(12);
    expect(component.tituloFaturaAtiva()).toBe('Dezembro 2026');
  });

  it('deve calcular o percentual de limite consumido corretamente', () => {
    // 1000 comprometido de 5000 total = 20% (0.2)
    expect(component.percentualLimite()).toBe(0.2);
  });

  it('deve calcular o melhor dia de compra como o dia seguinte ao fechamento', () => {
    // Fechamento 20 -> melhor dia 21
    expect(component.melhorDiaCompra()).toBe(21);
  });

  it('deve alternar a visibilidade do modal de nova compra', () => {
    expect(component.modalNovaCompraAberto()).toBe(false);
    component.abrirModalNovaCompra();
    expect(component.modalNovaCompraAberto()).toBe(true);
    component.fecharModalNovaCompra();
    expect(component.modalNovaCompraAberto()).toBe(false);
  });

  it('deve listar apenas categorias de despesa e enviar categoria_id ao salvar compra', async () => {
    expect(component.categoriasDespesa().map((c) => c.nome)).toEqual(['Alimentação']);

    component.abrirModalNovaCompra();
    component.compraForm.patchValue({
      descricao: 'Mercado',
      valor_total: 150,
      quantidade_parcelas: 1,
      data_compra: '2026-10-15',
      categoria_id: 1,
    });

    await component.salvarNovaCompra();

    expect(cardServiceStub.lancarTransacao).toHaveBeenCalledWith(
      expect.objectContaining({
        cartao_id: 'card-1',
        descricao: 'Mercado',
        valor_total: 150,
        quantidade_parcelas: 1,
        data_compra: '2026-10-15',
        categoria_id: 1,
      })
    );
  });
});

