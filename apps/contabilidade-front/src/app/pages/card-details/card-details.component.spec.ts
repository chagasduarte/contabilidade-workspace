// card-details.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { CardDetailsComponent } from './card-details.component';
import { CardService } from './card.service';
import { CardDetailsResponseDto, InvoiceDetailsResponseDto } from './card.model';

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

  beforeEach(async () => {
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
});

