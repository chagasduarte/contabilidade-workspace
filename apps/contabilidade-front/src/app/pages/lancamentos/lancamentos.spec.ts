import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { provideRouter, Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { Lancamentos } from './lancamentos';
import { TransacaoService } from '../../core/services/transacao.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { CategoriaService } from '../../core/services/categoria.service';
import { CartaoService } from '../../core/services/cartao.service';
import { PlannedTransactionService } from '../../core/services/planned-transaction.service';
import { PlanejamentoService } from '../../core/services/planejamento.service';
import { HeaderStateService } from '@org/shared-ui-navigation';
import {
  Categoria,
  Cartao,
  DashboardDespesaItem,
  ExtratoPaginado,
  ResumoPlanejamento,
  Transacao,
} from '@contabilidade/models';

describe('Lancamentos', () => {
  let component: Lancamentos;
  let fixture: ComponentFixture<Lancamentos>;
  let headerState: HeaderStateService;

  const mockExtrato: Transacao[] = [
    {
      id: 1,
      data: '2026-10-10',
      descricao: 'Projeto identidade visual',
      categoria: 'Serviços',
      tipo: 'entrada',
      valor: 4500,
      status: 'pendente',
    },
    {
      id: 2,
      data: '2026-10-08',
      descricao: 'Aluguel do escritório',
      categoria: 'Moradia',
      tipo: 'saida',
      valor: 2000,
      status: 'pago',
    },
    {
      id: 3,
      data: '2026-10-05',
      descricao: 'Mensalidade Cliente Alfa',
      categoria: 'Serviços',
      tipo: 'entrada',
      valor: 3500,
      status: 'pago',
    },
    {
      id: 4,
      data: '2026-10-03',
      descricao: 'Internet e telefone',
      categoria: 'Escritório',
      tipo: 'saida',
      valor: 289.9,
      status: 'pago',
    },
  ];

  let transacaoServiceStub: {
    extrato: ReturnType<typeof signal<Transacao[]>>;
    loading: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    nextCursor: ReturnType<typeof signal<string | null>>;
    carregandoMais: ReturnType<typeof signal<boolean>>;
    totaisExtrato: ReturnType<typeof signal<ExtratoPaginado['totais']>>;
    carregarExtrato: ReturnType<typeof vi.fn>;
    carregarExtratoPaginado: ReturnType<typeof vi.fn>;
    criarTransacao: ReturnType<typeof vi.fn>;
    criarTransacoesParceladas: ReturnType<typeof vi.fn>;
    marcarComoPago: ReturnType<typeof vi.fn>;
    excluirTransacao: ReturnType<typeof vi.fn>;
  };

  let dashboardServiceStub: {
    mes: ReturnType<typeof signal<number>>;
    ano: ReturnType<typeof signal<number>>;
    despesas: ReturnType<typeof signal<DashboardDespesaItem[]>>;
    carregarResumo: ReturnType<typeof vi.fn>;
    pagarFaturaCartao: ReturnType<typeof vi.fn>;
    efetivarParcelaEmprestimo: ReturnType<typeof vi.fn>;
  };

  let categoriaServiceStub: {
    categorias: ReturnType<typeof signal<Categoria[]>>;
    listarCategorias: ReturnType<typeof vi.fn>;
  };

  let cartaoServiceStub: {
    cartoes: ReturnType<typeof signal<Cartao[]>>;
    listarCartoes: ReturnType<typeof vi.fn>;
  };

  let plannedTransactionServiceStub: {
    efetivar: ReturnType<typeof vi.fn>;
    pular: ReturnType<typeof vi.fn>;
    cancelar: ReturnType<typeof vi.fn>;
  };

  let planejamentoServiceStub: {
    resumo: ReturnType<typeof signal<ResumoPlanejamento | null>>;
    carregarMes: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    transacaoServiceStub = {
      extrato: signal<Transacao[]>(mockExtrato),
      loading: signal(false),
      error: signal<string | null>(null),
      nextCursor: signal<string | null>(null),
      carregandoMais: signal(false),
      totaisExtrato: signal<ExtratoPaginado['totais']>(null),
      carregarExtrato: vi.fn().mockReturnValue(of(mockExtrato)),
      carregarExtratoPaginado: vi
        .fn()
        .mockReturnValue(of({ items: mockExtrato, next_cursor: null })),
      criarTransacao: vi.fn().mockReturnValue(of(mockExtrato[0])),
      criarTransacoesParceladas: vi.fn().mockReturnValue(of([mockExtrato[0]])),
      marcarComoPago: vi.fn().mockReturnValue(of({})),
      excluirTransacao: vi.fn().mockReturnValue(of({})),
    };

    dashboardServiceStub = {
      mes: signal(10),
      ano: signal(2026),
      despesas: signal<DashboardDespesaItem[]>([]),
      carregarResumo: vi.fn().mockReturnValue(of({})),
      pagarFaturaCartao: vi.fn().mockReturnValue(of({})),
      efetivarParcelaEmprestimo: vi.fn().mockReturnValue(of({})),
    };

    categoriaServiceStub = {
      categorias: signal<Categoria[]>([]),
      listarCategorias: vi.fn().mockReturnValue(of([])),
    };

    cartaoServiceStub = {
      cartoes: signal<Cartao[]>([]),
      listarCartoes: vi.fn().mockReturnValue(of([])),
    };

    plannedTransactionServiceStub = {
      efetivar: vi.fn().mockReturnValue(of({ transacao_id: 99, planned_transaction: {} })),
      pular: vi.fn().mockReturnValue(of({})),
      cancelar: vi.fn().mockReturnValue(of({ canceladas: 1 })),
    };

    planejamentoServiceStub = {
      resumo: signal<ResumoPlanejamento | null>(null),
      carregarMes: vi.fn().mockReturnValue(of({})),
    };

    await TestBed.configureTestingModule({
      imports: [Lancamentos],
      providers: [
        provideRouter([]),
        HeaderStateService,
        { provide: TransacaoService, useValue: transacaoServiceStub },
        { provide: DashboardService, useValue: dashboardServiceStub },
        { provide: CategoriaService, useValue: categoriaServiceStub },
        { provide: CartaoService, useValue: cartaoServiceStub },
        { provide: PlannedTransactionService, useValue: plannedTransactionServiceStub },
        { provide: PlanejamentoService, useValue: planejamentoServiceStub },
        { provide: AlertController, useValue: null },
        { provide: ToastController, useValue: null },
      ],
    }).compileComponents();

    headerState = TestBed.inject(HeaderStateService);
    fixture = TestBed.createComponent(Lancamentos);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and fetch transactions from API', () => {
    expect(component).toBeTruthy();
    expect(transacaoServiceStub.carregarExtratoPaginado).toHaveBeenCalledWith(10, 2026);
  });

  it('should show the monthly summary and recent transactions from API', () => {
    const content = fixture.nativeElement as HTMLElement;

    expect(content.textContent).toContain('Entradas no mês');
    expect(content.textContent).toContain('Saídas no mês');
    expect(content.textContent).toContain('Movimentações recentes');
    expect(content.querySelectorAll('.transaction')).toHaveLength(4);
    expect(content.textContent).toContain('Projeto identidade visual');
    expect(component.monthlyIncome()).toBe(8000);
    expect(component.monthlyExpenses()).toBe(2289.9);
    expect(component.pendingCount()).toBe(1);
    expect(component.entradasPagas()).toBe(3500);
    expect(component.entradasPendentes()).toBe(4500);
    expect(component.saidasPagas()).toBe(2289.9);
    expect(component.saidasPendentes()).toBe(0);
  });

  it('should filter transactions based on header search term', () => {
    expect(component.transactions()).toHaveLength(4);

    headerState.setSearchTerm('aluguel');
    fixture.detectChanges();

    const filtered = component.transactions();
    expect(filtered).toHaveLength(1);
    expect(filtered[0].description).toBe('Aluguel do escritório');

    headerState.setSearchTerm('Serviços');
    fixture.detectChanges();
    expect(component.transactions()).toHaveLength(2);

    headerState.clearSearch();
    fixture.detectChanges();
    expect(component.transactions()).toHaveLength(4);
  });

  it('should sync with year changes from headerState', () => {
    headerState.setYear(2027);
    fixture.detectChanges();

    expect(dashboardServiceStub.ano()).toBe(2027);
    expect(transacaoServiceStub.carregarExtratoPaginado).toHaveBeenCalledWith(10, 2027);
  });

  it('should select month directly and reload transactions', () => {
    component.selecionarMes(7);
    expect(dashboardServiceStub.mes()).toBe(7);
    expect(transacaoServiceStub.carregarExtratoPaginado).toHaveBeenCalledWith(7, 2026);
  });

  it('should toggle transaction modal visibility', () => {
    expect(component.modalNovaTransacaoAberto()).toBe(false);

    component.abrirModalNovaTransacao();
    expect(component.modalNovaTransacaoAberto()).toBe(true);

    component.fecharModalNovaTransacao();
    expect(component.modalNovaTransacaoAberto()).toBe(false);
  });

  it('should reload transactions when a transaction is created from modal', () => {
    component.onTransacaoCriada();
    expect(transacaoServiceStub.carregarExtratoPaginado).toHaveBeenCalled();
  });

  it('não deve recalcular os totais do mês ao buscar', () => {
    headerState.setSearchTerm('aluguel');
    fixture.detectChanges();

    expect(component.monthlyIncome()).toBe(8000);
    expect(component.monthlyExpenses()).toBe(2289.9);
  });

  it('deve carregar a próxima página com o next_cursor e concluir o infinite scroll', () => {
    transacaoServiceStub.nextCursor.set('2026-10-01_9');
    const complete = vi.fn();

    component.carregarMais({ target: { complete } } as unknown as Event);

    expect(transacaoServiceStub.carregarExtratoPaginado).toHaveBeenLastCalledWith(
      10,
      2026,
      '2026-10-01_9'
    );
    expect(complete).toHaveBeenCalled();
  });

  it('deve marcar os totais como parciais enquanto houver mais páginas', () => {
    transacaoServiceStub.nextCursor.set('abc');
    fixture.detectChanges();

    expect(component.totaisParciais()).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Totais parciais');

    transacaoServiceStub.totaisExtrato.set({ entradas: 10, saidas: 5, pendentes: 0 });
    fixture.detectChanges();
    expect(component.totaisParciais()).toBe(false);
    expect(component.monthlyIncome()).toBe(10);
  });

  it('não deve pedir nova página sem cursor', () => {
    const chamadas = transacaoServiceStub.carregarExtratoPaginado.mock.calls.length;
    const complete = vi.fn();

    component.carregarMais({ target: { complete } } as unknown as Event);

    expect(transacaoServiceStub.carregarExtratoPaginado.mock.calls.length).toBe(chamadas);
    expect(complete).toHaveBeenCalled();
  });

  it('deve exibir selo de cartão para itens com origem CARTAO e navegar para /cartoes/:source_id ao tocar', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    transacaoServiceStub.extrato.set([
      ...mockExtrato,
      {
        id: 'cartao:item-uuid-1',
        descricao: 'Notebook (2/10)',
        tipo: 'saida',
        valor: 350,
        data: '2026-10-12',
        pagamento: '2026-10-28',
        status: 'pendente',
        origem: 'CARTAO',
        origem_rotulo: 'Nubank',
        target_id: 'fat-uuid-1',
        source_type: 'CREDIT_CARD_ITEM',
        source_id: 'card-uuid-1',
        idcategoria: 5,
        categoria_nome: 'Eletrônicos',
        cartaoid: null,
      },
    ]);
    fixture.detectChanges();

    const cardBadge = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="transaction-card-badge"]'
    );
    expect(cardBadge?.textContent).toContain('Nubank');

    const cardItem = component.transactions().find((t) => t.id === 'cartao:item-uuid-1');
    expect(cardItem).toBeDefined();
    expect(cardItem?.isCard).toBe(true);
    expect(cardItem?.isReadOnly).toBe(true);
    expect(cardItem?.category).toBe('Eletrônicos');

    if (cardItem) {
      component.abrirItemCartao(cardItem);
    }
    expect(navigateSpy).toHaveBeenCalledWith(['/cartoes', 'card-uuid-1']);
  });

  it('deve aplicar filtros de tipo e situação repassando queryParams para carregarExtratoPaginado', () => {
    component.selecionarFiltroTipo('saida');
    expect(component.filtroTipo()).toBe('saida');
    expect(transacaoServiceStub.carregarExtratoPaginado).toHaveBeenLastCalledWith(
      10,
      2026,
      null,
      50,
      { tipo: 'saida' }
    );

    component.selecionarFiltroStatus('pendente');
    expect(component.filtroStatus()).toBe('pendente');
    expect(transacaoServiceStub.carregarExtratoPaginado).toHaveBeenLastCalledWith(
      10,
      2026,
      null,
      50,
      { tipo: 'saida', status: 'pendente' }
    );
  });

  it('deve exibir comparativo Planejado x Executado e faturas de cartão abertas com ação Pagar fatura', async () => {
    planejamentoServiceStub.resumo.set({
      mes: 10,
      ano: 2026,
      categorias: [],
      naoCategorizado: { planejado: 0, executado: 0 },
      totais: { planejado: 5000, executado: 2289.9, saldo: 2710.1, percentual: 45.8 },
    });
    dashboardServiceStub.despesas.set([
      {
        id: 'card-fat-99',
        descricao: 'Fatura 10/2026 - Nubank',
        valor: 950,
        data: '2026-10-25',
        status: 'pendente',
        origem: 'CARTAO',
        origem_rotulo: 'Nubank',
        target_id: 'fat-99',
      },
    ]);
    fixture.detectChanges();

    expect(component.orcamentoPlanejado()).toBe(5000);
    expect(component.percentualOrcamento()).toBeCloseTo(45.798, 2);
    expect(component.faturasCartaoAbertas()).toHaveLength(1);

    const invoiceSection = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="open-invoices-section"]'
    );
    expect(invoiceSection?.textContent).toContain('Fatura 10/2026 - Nubank');

    await component.pagarFatura(component.faturasCartaoAbertas()[0]);
    expect(dashboardServiceStub.pagarFaturaCartao).toHaveBeenCalledWith('fat-99', 950);
  });

  it('deve permitir efetivar, editar, pular e cancelar itens das 4 origens conforme contrato', async () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    transacaoServiceStub.extrato.set([
      {
        id: 10,
        descricao: 'Conta luz avulsa',
        tipo: 'saida',
        valor: 180,
        data: '2026-10-15',
        status: 'pendente',
      },
      {
        id: 11,
        descricao: 'Aluguel já efetivado',
        tipo: 'saida',
        valor: 2000,
        data: '2026-10-05',
        status: 'pago',
        source_type: 'PLANNED_TRANSACTION',
      },
      {
        id: 'plan:uuid-plan-1',
        descricao: 'Condomínio recorrente',
        tipo: 'saida',
        valor: 650,
        data: '2026-10-20',
        status: 'pendente',
        origem: 'PLANEJADO',
        origem_rotulo: 'Recorrente',
        target_id: 'uuid-plan-1',
        source_type: 'PLANNED_TRANSACTION',
        source_id: 'uuid-plan-1',
        recorrencia: 'MENSAL',
        is_recorrente: true,
        idcategoria: 3,
      },
      {
        id: 'loan:uuid-inst-1',
        descricao: 'Parcela Empréstimo #3 - Banco Inter',
        tipo: 'saida',
        valor: 820,
        data: '2026-10-22',
        status: 'pendente',
        origem: 'EMPRESTIMO',
        origem_rotulo: 'Banco Inter',
        target_id: 'uuid-inst-1',
        source_type: 'LOAN_INSTALLMENT',
        source_id: 'uuid-loan-1',
      },
    ]);
    fixture.detectChanges();

    const items = component.transactions();
    expect(items).toHaveLength(4);

    // (a) Lançamento de conta pendente -> marcarComoPago + abrirEdicao + excluirTransacao
    const contaItem = items.find((i) => i.id === 10)!;
    expect(contaItem.origem).toBe('CONTA');
    expect(contaItem.isReadOnly).toBe(false);
    await component.efetivarItem(contaItem);
    expect(transacaoServiceStub.marcarComoPago).toHaveBeenCalledWith(10);
    component.abrirEdicao(contaItem);
    expect(component.itemEmEdicao()?.id).toBe(10);
    await component.excluirOuCancelar(contaItem);
    expect(transacaoServiceStub.excluirTransacao).toHaveBeenCalledWith(10);

    // (a) Efetivação já paga de PLANNED_TRANSACTION -> somente leitura
    const settledItem = items.find((i) => i.id === 11)!;
    expect(settledItem.isReadOnly).toBe(true);

    // (c) Conta planejada pendente -> efetivar + pular + cancelar
    const planItem = items.find((i) => i.id === 'plan:uuid-plan-1')!;
    expect(planItem.origem).toBe('PLANEJADO');
    expect(planItem.isRecorrente).toBe(true);
    await component.efetivarItem(planItem);
    expect(plannedTransactionServiceStub.efetivar).toHaveBeenCalledWith(
      'uuid-plan-1',
      expect.objectContaining({ valor_pago: 650, idcategoria: 3 })
    );
    await component.pularPlanejada(planItem);
    expect(plannedTransactionServiceStub.pular).toHaveBeenCalledWith('uuid-plan-1');
    await component.excluirOuCancelar(planItem);
    expect(plannedTransactionServiceStub.cancelar).toHaveBeenCalledWith('uuid-plan-1');

    // (d) Parcela de empréstimo pendente -> efetivarParcelaEmprestimo + navegar para /emprestimos/:source_id
    const loanItem = items.find((i) => i.id === 'loan:uuid-inst-1')!;
    expect(loanItem.origem).toBe('EMPRESTIMO');
    await component.efetivarItem(loanItem);
    expect(dashboardServiceStub.efetivarParcelaEmprestimo).toHaveBeenCalledWith(
      'uuid-inst-1',
      820
    );
    component.abrirItemCartao(loanItem);
    expect(navigateSpy).toHaveBeenCalledWith(['/emprestimos', 'uuid-loan-1']);
  });
});
