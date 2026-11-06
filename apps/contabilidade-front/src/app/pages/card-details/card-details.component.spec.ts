// card-details.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { CardDetailsComponent } from './card-details.component';
import { ParcelamentoService } from '../../core/services/parcelamento.service';
import { CardService } from './card.service';
import { CardDetailsResponseDto, CardInvoice, InvoiceDetailsResponseDto } from './card.model';
import { CategoriaService } from '../../core/services/categoria.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { HeaderStateService } from '@org/shared-ui-navigation';
import { Categoria, Subcategoria } from '@contabilidade/models';

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
    atualizarItem: ReturnType<typeof vi.fn>;
    corrigirDatasFatura: ReturnType<typeof vi.fn>;
  };

  let categoriaServiceStub: {
    categorias: ReturnType<typeof signal<Categoria[]>>;
    listarCategorias: ReturnType<typeof vi.fn>;
    listarSubcategorias: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    categoriaServiceStub = {
      categorias: signal<Categoria[]>([
        { id: 1, nome: 'Alimentação', icone: 'restaurant-outline', cor: '#ef4444', tipo: 'despesa' },
        { id: 2, nome: 'Salário', icone: 'cash-outline', cor: '#22c55e', tipo: 'receita' },
      ]),
      listarCategorias: vi.fn().mockReturnValue(of([])),
      listarSubcategorias: vi.fn().mockReturnValue(of([])),
    };

    cardServiceStub = {
      cartaoSelecionado: signal<CardDetailsResponseDto | null>(mockCartaoDetalhes),
      faturaSelecionada: signal<InvoiceDetailsResponseDto | null>(mockFaturaDetalhes),
      loading: signal<boolean>(false),
      error: signal<string | null>(null),
      obterCartaoPorId: vi.fn().mockReturnValue(of(mockCartaoDetalhes)),
      obterDetalhesFatura: vi.fn().mockReturnValue(of(mockFaturaDetalhes)),
      lancarTransacao: vi.fn().mockReturnValue(of({ transacao: {}, itens: [], cartaoAtualizado: mockCartaoDetalhes })),
      corrigirDatasFatura: vi.fn(),
      atualizarItem: vi.fn().mockReturnValue(of(undefined)),
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
        { provide: ParcelamentoService, useValue: { excluir: vi.fn().mockReturnValue(of(undefined)) } },
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

  it('permite escolher o mês diretamente via selecionarMes (MonthSelector)', () => {
    const header = TestBed.inject(HeaderStateService);

    component.selecionarMes(11);
    fixture.detectChanges();

    expect(component.mes()).toBe(11);
    expect(header.selectedMonth()).toBe(11);
    expect(component.tituloFaturaAtiva()).toBe('Novembro 2026');
  });

  it('deve calcular o percentual de limite consumido corretamente', () => {
    // 1000 comprometido de 5000 total = 20% (0.2)
    expect(component.percentualLimite()).toBe(0.2);
  });

  it('considera o fechamento como início do próximo ciclo de compras', () => {
    // Fechamento 20 -> compras do dia 20 já entram no próximo ciclo
    expect(component.melhorDiaCompra()).toBe(20);
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
  it('carrega subcategorias da categoria e envia a selecionada na compra parcelada', async () => {
    categoriaServiceStub.listarSubcategorias.mockReturnValue(of([
      { id: 11, idcategoria: 1, nome: 'Mercado' },
    ]));
    component.abrirModalNovaCompra();
    component.compraForm.patchValue({
      descricao: 'Mercado', valor_total: 150, quantidade_parcelas: 3,
      data_compra: '2026-10-15', categoria_id: 1,
    });
    component.compraForm.patchValue({ subcategoria_id: 11 });
    fixture.detectChanges();
    expect(categoriaServiceStub.listarSubcategorias).toHaveBeenCalledWith(1);
    expect((fixture.nativeElement as HTMLElement).querySelector('#compra-subcategoria')?.textContent).toContain('Mercado');
    await component.salvarNovaCompra();
    expect(cardServiceStub.lancarTransacao).toHaveBeenCalledWith(expect.objectContaining({
      categoria_id: 1, subcategoria_id: 11, quantidade_parcelas: 3,
    }));
  });

  it('limpa subcategoria ao trocar categoria e descarta respostas antigas', () => {
    const antiga = new Subject<Subcategoria[]>();
    categoriaServiceStub.listarSubcategorias.mockReturnValueOnce(antiga).mockReturnValueOnce(of([
      { id: 21, idcategoria: 3, nome: 'Táxi' },
    ]));
    component.compraForm.patchValue({ categoria_id: 1, subcategoria_id: 11 });
    component.compraForm.patchValue({ categoria_id: 3 });
    antiga.next([{ id: 11, idcategoria: 1, nome: 'Mercado' }]);
    expect(component.compraForm.get('subcategoria_id')?.value).toBeNull();
    expect(component.subcategoriasCompra().map(sub => sub.id)).toEqual([21]);
    component.compraForm.patchValue({ categoria_id: null });
    expect(component.subcategoriasCompra()).toEqual([]);
    expect(component.compraForm.get('subcategoria_id')?.disabled).toBe(true);
  });

  it('informa falha no carregamento de subcategorias e permite tentar outra categoria', () => {
    categoriaServiceStub.listarSubcategorias.mockReturnValueOnce(throwError(() => new Error('offline')));
    component.compraForm.patchValue({ categoria_id: 1 });
    expect(component.erroSubcategorias()).toContain('Não foi possível');
    expect(component.compraForm.get('subcategoria_id')?.disabled).toBe(true);
    component.compraForm.patchValue({ categoria_id: 3 });
    expect(component.erroSubcategorias()).toBeNull();
  });

  it('edita a parcela sem criar nova compra, preservando categoria e subcategoria', async () => {
    categoriaServiceStub.listarSubcategorias.mockReturnValue(of([{ id: 11, idcategoria: 1, nome: 'Mercado' }]));
    component.editarDespesa({ ...mockFaturaDetalhes.itens[0], categoria_id: 1, subcategoria_id: 11 });
    expect(component.compraForm.get('subcategoria_id')?.value).toBe(11);
    expect(component.compraForm.get('quantidade_parcelas')?.disabled).toBe(true);
    component.compraForm.patchValue({ descricao: 'Compra corrigida', valor_total: 550 });
    await component.salvarNovaCompra();
    expect(cardServiceStub.atualizarItem).toHaveBeenCalledWith('it-1', {
      descricao: 'Compra corrigida', valor_parcela: 550, categoria_id: 1, subcategoria_id: 11,
    });
    expect(cardServiceStub.lancarTransacao).not.toHaveBeenCalled();
    expect(component.modalNovaCompraAberto()).toBe(false);
    expect(component.salvandoCompra()).toBe(false);
  });

  it('mantém o modal aberto se a edição falhar', async () => {
    cardServiceStub.atualizarItem.mockReturnValue(throwError(() => new Error('Falha ao salvar')));
    component.editarDespesa(mockFaturaDetalhes.itens[0]);
    await component.salvarNovaCompra();
    expect(component.modalNovaCompraAberto()).toBe(true);
    expect(component.salvandoCompra()).toBe(false);
  });

  it('não exclui ao cancelar a confirmação', async () => {
    vi.mocked(TestBed.inject(AlertController).create).mockResolvedValue({
      present: vi.fn(), onDidDismiss: vi.fn().mockResolvedValue({ role: 'cancel' }),
    } as never);
    await component.removerDespesa(mockFaturaDetalhes.itens[0]);
    expect(TestBed.inject(ParcelamentoService).excluir).not.toHaveBeenCalled();
    expect(component.removendoCompra()).toBeNull();
  });

  it('confirma exclusão da compra inteira incluindo parcelas pagas e recarrega os dados', async () => {
    vi.mocked(TestBed.inject(AlertController).create).mockResolvedValue({
      present: vi.fn(), onDidDismiss: vi.fn().mockResolvedValue({ role: 'confirm' }),
    } as never);
    await component.removerDespesa(mockFaturaDetalhes.itens[0]);
    expect(TestBed.inject(AlertController).create).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('inclusive as já pagas'),
    }));
    expect(TestBed.inject(ParcelamentoService).excluir).toHaveBeenCalledWith('cartao', 'tx-1');
    expect(cardServiceStub.obterCartaoPorId).toHaveBeenCalledTimes(2);
  });

  it('impede envios duplicados enquanto a edição está em andamento', async () => {
    const resposta = new Subject<void>();
    cardServiceStub.atualizarItem.mockReturnValue(resposta);
    component.editarDespesa(mockFaturaDetalhes.itens[0]);
    const primeira = component.salvarNovaCompra();
    await Promise.resolve();
    await Promise.resolve();
    await component.salvarNovaCompra();
    resposta.next(); resposta.complete();
    await primeira;
    expect(cardServiceStub.atualizarItem).toHaveBeenCalledTimes(1);
  });

  it('abre o mês de vencimento da primeira parcela após registrar a compra', async () => {
    const dezembro = { ...mockFatura, id: 'fat-dezembro', mes_referencia: 12, data_vencimento: '2026-12-28' };
    cardServiceStub.lancarTransacao.mockReturnValue(of({
      transacao: {}, itens: [{ fatura_id: dezembro.id }],
      cartaoAtualizado: { ...mockCartaoDetalhes, faturas: [mockFatura, dezembro] },
    }));
    component.abrirModalNovaCompra();
    component.compraForm.patchValue({ descricao: 'Compra de hoje', valor_total: 100, quantidade_parcelas: 1, data_compra: '2026-11-06' });
    await component.salvarNovaCompra();
    expect(component.mes()).toBe(12);
    expect(component.ano()).toBe(2026);
  });

  it('não repete em novembro a fatura de referência novembro que só vence em dezembro', () => {
    const dezembro = { ...mockFatura, id: 'dezembro', mes_referencia: 11,
      data_vencimento: '2026-12-10', status: 'OPEN' as const };
    component.faturas.set([dezembro]);
    component.selecionarMes(11);
    expect(component.faturaAtiva()).toBeNull();
    expect(component.detalhesFaturaAtiva()).toBeNull();
    component.selecionarMes(12);
    expect(component.faturaAtiva()?.id).toBe('dezembro');
    expect(component.faturaAtiva()?.status).toBe('OPEN');
  });

  it('Inter com fechamento 1 e vencimento 7 separa novembro pago de dezembro aberto', () => {
    const novembro = { ...mockFatura, id: 'novembro', mes_referencia: 11, data_fechamento: '2026-11-01', data_vencimento: '2026-11-07', status: 'PAID' as const };
    const dezembro = { ...mockFatura, id: 'dezembro', mes_referencia: 12, data_fechamento: '2026-12-01', data_vencimento: '2026-12-07', status: 'OPEN' as const };
    const item = mockFaturaDetalhes.itens[0];
    const detalhesNovembro = { ...mockFaturaDetalhes, cartao: { ...mockCartaoDetalhes.cartao, nome: 'Inter', dia_fechamento: 1, dia_vencimento: 7 }, fatura: novembro, itens: [
      { ...item, id: 'parcela-novembro', fatura_id: 'novembro', transacao_id: 'parcelada', descricao: 'Compra antiga', numero_parcela: 1 },
    ] };
    const detalhesDezembro = { ...mockFaturaDetalhes, cartao: { ...mockCartaoDetalhes.cartao, nome: 'Inter', dia_fechamento: 1, dia_vencimento: 7 }, fatura: dezembro, itens: [
      { ...item, id: 'parcela-dezembro', fatura_id: 'dezembro', transacao_id: 'parcelada', descricao: 'Compra antiga', numero_parcela: 2 },
      { ...item, id: 'compra-novembro', fatura_id: 'dezembro', transacao_id: 'nova', descricao: 'Compra de 01/11', data_compra: '2026-11-01', numero_parcela: 1, quantidade_parcelas: 1 },
    ] };
    cardServiceStub.obterDetalhesFatura.mockImplementation((id: string) => of(id === 'novembro' ? detalhesNovembro : detalhesDezembro));
    component.faturas.set([novembro, dezembro]);
    component.selecionarMes(11);
    expect(component.faturaAtiva()?.status).toBe('PAID');
    expect(component.detalhesFaturaAtiva()?.itens.map(i => i.id)).toEqual(['parcela-novembro']);
    component.selecionarMes(12);
    fixture.detectChanges();
    expect(component.faturaAtiva()?.status).toBe('OPEN');
    expect(component.detalhesFaturaAtiva()?.itens.map(i => [i.id, i.numero_parcela])).toEqual([
      ['parcela-dezembro', 2], ['compra-novembro', 1],
    ]);
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Fatura Liquidada em');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Parcela 2 de 2');
  });

  it('descarta respostas atrasadas ao trocar de novembro para dezembro', () => {
    const novembro = { ...mockFatura, id: 'novembro', data_vencimento: '2026-11-10' };
    const dezembro = { ...mockFatura, id: 'dezembro', data_vencimento: '2026-12-10', status: 'OPEN' as const };
    const antiga = new Subject<InvoiceDetailsResponseDto>();
    const atual = { ...mockFaturaDetalhes, fatura: dezembro };
    cardServiceStub.obterDetalhesFatura.mockImplementation((id: string) => id === 'novembro' ? antiga : of(atual));
    component.faturas.set([novembro, dezembro]);
    component.selecionarMes(11);
    component.selecionarMes(12);
    antiga.next({ ...mockFaturaDetalhes, fatura: novembro });
    expect(component.detalhesFaturaAtiva()?.fatura.id).toBe('dezembro');
    expect(cardServiceStub.faturaSelecionada()?.fatura.id).toBe('dezembro');
  });

  it('corrige as datas legadas da fatura paga de novembro sem reabrir nem deslocar dezembro', async () => {
    const legada: CardInvoice = { ...mockFatura, id: 'nov-paga', mes_referencia: 11, ano_referencia: 2026,
      data_fechamento: '2026-11-30T00:00:00.000Z', data_vencimento: '2026-12-07T00:00:00.000Z',
      status: 'PAID', valor_pago: 2202.35, data_pagamento: '2026-11-06T00:00:00.000Z' };
    const dezembro: CardInvoice = { ...mockFatura, id: 'dez-aberta', mes_referencia: 12,
      data_fechamento: '2026-12-01', data_vencimento: '2026-12-07', status: 'OPEN' };
    const corrigida = { ...legada, data_fechamento: '2026-11-01', data_vencimento: '2026-11-07' };
    cardServiceStub.cartaoSelecionado.set({ ...mockCartaoDetalhes,
      cartao: { ...mockCartaoDetalhes.cartao, nome: 'Inter', dia_fechamento: 1, dia_vencimento: 7 } });
    component.faturas.set([legada, dezembro]);
    component.selecionarMes(12);
    expect(component.datasDivergentes().map(f => f.fatura.id)).toEqual(['nov-paga']);
    cardServiceStub.corrigirDatasFatura.mockReturnValue(of(corrigida));
    cardServiceStub.obterDetalhesFatura.mockReturnValue(of({ ...mockFaturaDetalhes, fatura: corrigida }));
    vi.mocked(TestBed.inject(AlertController).create).mockResolvedValue({
      present: vi.fn(), onDidDismiss: vi.fn().mockResolvedValue({ role: 'confirm' }),
    } as never);
    await component.corrigirDatasFatura(legada);
    expect(cardServiceStub.corrigirDatasFatura).toHaveBeenCalledWith('nov-paga');
    expect(component.mes()).toBe(11);
    expect(component.faturaAtiva()).toMatchObject({ id: 'nov-paga', status: 'PAID', valor_pago: 2202.35 });
    expect(component.datasDivergentes()).toEqual([]);
    component.selecionarMes(12);
    expect(component.faturaAtiva()).toMatchObject({ id: 'dez-aberta', status: 'OPEN' });
  });

  it('não altera as datas quando a revisão é cancelada', async () => {
    vi.mocked(TestBed.inject(AlertController).create).mockResolvedValue({
      present: vi.fn(), onDidDismiss: vi.fn().mockResolvedValue({ role: 'cancel' }),
    } as never);
    await component.corrigirDatasFatura(mockFatura);
    expect(cardServiceStub.corrigirDatasFatura).not.toHaveBeenCalled();
    expect(component.corrigindoDatas()).toBe(false);
  });

  it('mostra o dia civil 7 mesmo quando a API retorna meia-noite UTC', () => {
    const fatura = { ...mockFatura, data_fechamento: '2026-10-01T00:00:00.000Z', data_vencimento: '2026-10-07T00:00:00.000Z' };
    component.faturas.set([fatura]);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('07/10/2026');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('01/10/2026');
  });

});

