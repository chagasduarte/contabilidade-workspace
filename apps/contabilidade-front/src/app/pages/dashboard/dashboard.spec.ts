import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { Dashboard } from './dashboard';
import { DashboardService } from '../../core/services/dashboard.service';
import { TransacaoService } from '../../core/services/transacao.service';
import { CategoriaService } from '../../core/services/categoria.service';
import { CartaoService } from '../../core/services/cartao.service';
import { PlannedTransactionService } from '../../core/services/planned-transaction.service';
import {
  Cartao,
  Categoria,
  CreateTransacaoDto,
  CreateParceladaDto,
  DashboardDespesaItem,
  DashboardResumo,
  PlannedTransaction,
  ProjecaoMensal,
  Transacao,
} from '@contabilidade/models';

describe('Dashboard', () => {
  let component: Dashboard;
  let fixture: ComponentFixture<Dashboard>;

  const mockResumo: DashboardResumo = {
    saldo_atual: 18000,
    gastos_mensal: 12000,
    receita_mensal: 40000,
    gastos_mensal_pendente: 2000,
    receita_mensal_pendente: 5000,
    saldo_acumulado: 32390,
    saldo_projetado: 32390,
    total_dividas_mes: 2000,
    gastos_cartao: 1500,
    hasSome: true,
  };

  const mockProjecao: ProjecaoMensal[] = [
    {
      mes_ano: '2026-10-01',
      ano: 2026,
      mes: 10,
      soma_entrada: 40000,
      soma_saida: 12000,
      saldo_mensal: 28000,
      saldo_acumulado: 32390,
    },
  ];

  const mockTransacoes: Transacao[] = Array.from({ length: 15 }, (_, i) => ({
    id: i + 1,
    descricao: `Despesa ${i + 1}`,
    tipo: (i % 3 === 0 ? 'entrada' : 'saida') as 'entrada' | 'saida',
    valor: 100 * (i + 1),
    categoria: 'Geral',
    data: '2026-10-10',
    status: (i % 2 === 0 ? 'pago' : 'pendente') as 'pago' | 'pendente',
  }));

  const mockCategorias: Categoria[] = [
    { id: 1, nome: 'Alimentação', idusuario: 1 },
    { id: 2, nome: 'Transporte', idusuario: 1 },
  ];

  let dashboardServiceStub: {
    mes: ReturnType<typeof signal<number>>;
    ano: ReturnType<typeof signal<number>>;
    resumo: ReturnType<typeof signal<DashboardResumo | null>>;
    despesas: ReturnType<typeof signal<DashboardDespesaItem[]>>;
    projecao: ReturnType<typeof signal<ProjecaoMensal[]>>;
    loading: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    carregarDashboard: ReturnType<typeof vi.fn>;
    efetivarTransacaoPlanejada: ReturnType<typeof vi.fn>;
    efetivarParcelaEmprestimo: ReturnType<typeof vi.fn>;
    pagarFaturaCartao: ReturnType<typeof vi.fn>;
  };

  let transacaoServiceStub: {
    extrato: ReturnType<typeof signal<Transacao[]>>;
    loading: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    carregarExtrato: ReturnType<typeof vi.fn>;
    criarTransacao: ReturnType<typeof vi.fn>;
    criarTransacoesParceladas: ReturnType<typeof vi.fn>;
    marcarComoPago: ReturnType<typeof vi.fn>;
    excluirTransacao: ReturnType<typeof vi.fn>;
  };

  let categoriaServiceStub: {
    categorias: ReturnType<typeof signal<Categoria[]>>;
    loading: ReturnType<typeof signal<boolean>>;
    listarCategorias: ReturnType<typeof vi.fn>;
    listarSubcategorias: ReturnType<typeof vi.fn>;
  };

  let cartaoServiceStub: {
    cartoes: ReturnType<typeof signal<Cartao[]>>;
    loading: ReturnType<typeof signal<boolean>>;
    listarCartoes: ReturnType<typeof vi.fn>;
  };

  let plannedTransactionServiceStub: {
    transacoesPlanejadas: ReturnType<typeof signal<PlannedTransaction[]>>;
    loading: ReturnType<typeof signal<boolean>>;
    criar: ReturnType<typeof vi.fn>;
    atualizar: ReturnType<typeof vi.fn>;
    deletar: ReturnType<typeof vi.fn>;
  };

  const mockCartoes: Cartao[] = [
    { id: 1, nome: 'Nubank', dia_fatura: 5, limite: 5000, userid: 1 },
    { id: 2, nome: 'Inter', dia_fatura: 10, limite: 3000, userid: 1 },
  ];

  beforeEach(async () => {
    dashboardServiceStub = {
      mes: signal(10),
      ano: signal(2026),
      resumo: signal<DashboardResumo | null>(mockResumo),
      despesas: signal<DashboardDespesaItem[]>([]),
      projecao: signal<ProjecaoMensal[]>(mockProjecao),
      loading: signal(false),
      error: signal<string | null>(null),
      carregarDashboard: vi.fn().mockReturnValue(
        of({ resumo: mockResumo, projecao: mockProjecao })
      ),
      efetivarTransacaoPlanejada: vi.fn().mockReturnValue(of({ success: true })),
      efetivarParcelaEmprestimo: vi.fn().mockReturnValue(of({ success: true })),
      pagarFaturaCartao: vi.fn().mockReturnValue(of({ success: true })),
    };

    transacaoServiceStub = {
      extrato: signal<Transacao[]>(mockTransacoes),
      loading: signal(false),
      error: signal<string | null>(null),
      carregarExtrato: vi.fn().mockReturnValue(of(mockTransacoes)),
      criarTransacao: vi.fn().mockImplementation((dto: CreateTransacaoDto) =>
        of({
          id: 99,
          ...dto,
          status: dto.status ?? 'pago',
        } as Transacao)
      ),
      criarTransacoesParceladas: vi.fn().mockReturnValue(of(mockTransacoes)),
      marcarComoPago: vi.fn().mockReturnValue(of('ok')),
      excluirTransacao: vi.fn().mockReturnValue(of(void 0)),
    };

    categoriaServiceStub = {
      categorias: signal<Categoria[]>(mockCategorias),
      loading: signal(false),
      listarCategorias: vi.fn().mockReturnValue(of(mockCategorias)),
      listarSubcategorias: vi
        .fn()
        .mockReturnValue(of([{ id: 10, nome: 'Supermercado', idcategoria: 1 }])),
    };

    cartaoServiceStub = {
      cartoes: signal<Cartao[]>(mockCartoes),
      loading: signal(false),
      listarCartoes: vi.fn().mockReturnValue(of(mockCartoes)),
    };

    plannedTransactionServiceStub = {
      transacoesPlanejadas: signal([]),
      loading: signal(false),
      criar: vi.fn().mockReturnValue(of({ id: 'plan-1', descricao: 'Aluguel', valor: 2500 })),
      atualizar: vi.fn().mockReturnValue(of({ id: 'plan-1', descricao: 'Aluguel Novo', valor: 2600 })),
      deletar: vi.fn().mockReturnValue(of({ message: 'ok', id: 'plan-1' })),
    };

    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        provideRouter([]),
        { provide: DashboardService, useValue: dashboardServiceStub },
        { provide: TransacaoService, useValue: transacaoServiceStub },
        { provide: CategoriaService, useValue: categoriaServiceStub },
        { provide: CartaoService, useValue: cartaoServiceStub },
        { provide: PlannedTransactionService, useValue: plannedTransactionServiceStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load dashboard data and transactions from API on init', () => {
    expect(component).toBeTruthy();
    expect(dashboardServiceStub.carregarDashboard).toHaveBeenCalledWith(10, 2026);
    expect(transacaoServiceStub.carregarExtrato).toHaveBeenCalledWith(10, 2026, 0);
    expect(categoriaServiceStub.listarCategorias).toHaveBeenCalled();
    expect(component.receitaTotal()).toBe(40000);
    expect(component.receitaRecebida()).toBe(35000);
    expect(component.despesaTotal()).toBe(12000);
    expect(component.saldoAcumulado()).toBe(32390);
    expect(component.saldoDisponivelMes()).toBe(28000);
  });

  it('deve listar apenas as 10 últimas despesas (filtrando entradas)', () => {
    const despesas = component.ultimasDespesas();
    expect(despesas.length).toBeLessThanOrEqual(10);
    expect(despesas.every((d) => d.tipo === 'saida' || d.tipo === 'cartao')).toBe(true);
  });

  it('deve ordenar as últimas despesas por data de criação de forma decrescente', () => {
    transacaoServiceStub.extrato.set([
      {
        id: 1,
        descricao: 'Mais antiga',
        tipo: 'saida',
        valor: 50,
        categoria: 'Geral',
        data: '2026-10-01',
        status: 'pago',
      },
      {
        id: 2,
        descricao: 'Mais recente',
        tipo: 'saida',
        valor: 150,
        categoria: 'Geral',
        data: '2026-10-15',
        status: 'pago',
      },
      {
        id: 3,
        descricao: 'Intermediária A',
        tipo: 'saida',
        valor: 75,
        categoria: 'Geral',
        data: '2026-10-10',
        status: 'pago',
      },
      {
        id: 4,
        descricao: 'Intermediária B (criada depois)',
        tipo: 'saida',
        valor: 80,
        categoria: 'Geral',
        data: '2026-10-10',
        status: 'pago',
      },
    ]);

    const despesas = component.ultimasDespesas();
    expect(despesas.map((d) => d.id)).toEqual([2, 4, 3, 1]);
  });

  it('deve priorizar criado_em quando disponível', () => {
    transacaoServiceStub.extrato.set([
      {
        id: 10,
        descricao: 'Criada primeiro',
        tipo: 'saida',
        valor: 50,
        categoria: 'Geral',
        data: '2026-10-10',
        criado_em: '2026-10-10T08:00:00Z',
        status: 'pago',
      },
      {
        id: 20,
        descricao: 'Criada depois',
        tipo: 'saida',
        valor: 150,
        categoria: 'Geral',
        data: '2026-10-10',
        criado_em: '2026-10-10T14:00:00Z',
        status: 'pago',
      },
    ]);

    const despesas = component.ultimasDespesas();
    expect(despesas[0].id).toBe(20);
    expect(despesas[1].id).toBe(10);
  });

  it('deve alternar a visibilidade do formulário de nova despesa', () => {
    expect(component.showAddExpense()).toBe(false);
    component.alternarFormularioDespesa();
    expect(component.showAddExpense()).toBe(true);
    component.alternarFormularioDespesa();
    expect(component.showAddExpense()).toBe(false);
  });

  it('deve criar uma nova despesa com sucesso e recarregar os dados do dashboard', () => {
    component.expenseForm.patchValue({
      descricao: 'Supermercado Mensal',
      valor: 450.5,
      data: '2026-10-15',
      idcategoria: 1,
      categoria: 10,
      status: 'pago',
      isCartao: false,
      cartaoid: null,
      isParcelado: false,
    });

    component.salvarNovaDespesa();

    expect(transacaoServiceStub.criarTransacao).toHaveBeenCalledWith({
      tipo: 'saida',
      descricao: 'Supermercado Mensal',
      valor: 450.5,
      data: '2026-10-15',
      idcategoria: 1,
      idsubcategoria: 10,
      status: 'pago',
      ispaycart: false,
      cartaoid: undefined,
    });
    expect(dashboardServiceStub.carregarDashboard).toHaveBeenCalled();
    expect(component.showAddExpense()).toBe(false);
  });

  it('deve criar uma despesa parcelada no cartão e recarregar os dados do dashboard', () => {
    component.expenseForm.patchValue({
      descricao: 'TV 50 polegadas',
      valor: 2400,
      data: '2026-10-15',
      idcategoria: 2,
      categoria: 2,
      isCartao: true,
      cartaoid: 1,
      isParcelado: true,
      qtdParcelas: 4,
      valorParcela: 600,
    });

    component.salvarNovaDespesa();

    expect(transacaoServiceStub.criarTransacoesParceladas).toHaveBeenCalledWith({
      tipo: 'saida',
      descricao: 'TV 50 polegadas',
      valor: 2400,
      idcategoria: 2,
      idsubcategoria: null,
      data: '2026-10-15',
      ispaycart: true,
      cartaoid: 1,
      parcelado: true,
      parcelas: {
        QtdParcelas: 4,
        Valor: 600,
      },
    } as CreateParceladaDto);
    expect(dashboardServiceStub.carregarDashboard).toHaveBeenCalled();
    expect(component.showAddExpense()).toBe(false);
  });

  it('deve permitir marcar despesa como paga e atualizar os dados', () => {
    component.marcarDespesaComoPaga(5);
    expect(transacaoServiceStub.marcarComoPago).toHaveBeenCalledWith(5);
    expect(dashboardServiceStub.carregarDashboard).toHaveBeenCalled();
  });

  it('deve permitir excluir despesa e atualizar os dados', () => {
    component.excluirDespesa(8);
    expect(transacaoServiceStub.excluirTransacao).toHaveBeenCalledWith(8);
    expect(dashboardServiceStub.carregarDashboard).toHaveBeenCalled();
  });

  it('should navigate to previous and next months updating both dashboard and transactions', () => {
    component.mesAnterior();
    expect(dashboardServiceStub.carregarDashboard).toHaveBeenCalledWith(9, 2026);
    expect(transacaoServiceStub.carregarExtrato).toHaveBeenCalledWith(9, 2026, 0);

    component.proximoMes();
    expect(dashboardServiceStub.carregarDashboard).toHaveBeenCalledWith(10, 2026);
    expect(transacaoServiceStub.carregarExtrato).toHaveBeenCalledWith(10, 2026, 0);
  });

  it('should select month directly and reload data', () => {
    component.selecionarMes(5);
    expect(dashboardServiceStub.mes()).toBe(5);
    expect(dashboardServiceStub.carregarDashboard).toHaveBeenCalledWith(5, 2026);
    expect(transacaoServiceStub.carregarExtrato).toHaveBeenCalledWith(5, 2026, 0);
  });

  it('deve calcular corretamente totalPendente e saldoProjetado a partir do resumo do dashboard', () => {
    expect(component.totalPendente()).toBe(2000);
    expect(component.saldoProjetado()).toBe(32390);

    dashboardServiceStub.resumo.set({
      saldo_atual: 10000,
      gastos_mensal: 5000,
      receita_mensal: 15000,
      gastos_mensal_pendente: 1200,
      receita_mensal_pendente: 3000,
      saldo_acumulado: 12000,
      saldo_projetado: 11800,
      total_dividas_mes: 1200,
      gastos_cartao: 800,
      hasSome: true,
    });

    expect(component.totalPendente()).toBe(1200);
    expect(component.saldoProjetado()).toBe(11800);
  });

  it('deve priorizar as despesas unificadas do dashboardService quando disponíveis', () => {
    const mockUnified: DashboardDespesaItem[] = [
      {
        id: 'plan-uuid-1',
        descricao: 'Gasto Previsto A',
        tipo: 'saida',
        valor: 350,
        categoria: 'Avulso',
        data: '2026-10-20',
        status: 'pendente',
        origem: 'AVULSO',
        origem_rotulo: 'Avulso',
        target_id: 'uuid-1',
      },
      {
        id: 'loan-uuid-2',
        descricao: 'Parcela Empréstimo B',
        tipo: 'saida',
        valor: 800,
        categoria: 'Empréstimos',
        data: '2026-10-25',
        status: 'pendente',
        origem: 'EMPRESTIMO',
        origem_rotulo: 'Empréstimo',
        target_id: 'uuid-2',
      },
    ];

    dashboardServiceStub.despesas.set(mockUnified);

    const despesas = component.ultimasDespesas();
    expect(despesas.length).toBe(2);
    expect(despesas[0].descricao).toBe('Gasto Previsto A');
    expect(despesas[0].origem).toBe('AVULSO');
    expect(despesas[1].descricao).toBe('Parcela Empréstimo B');
    expect(despesas[1].origem).toBe('EMPRESTIMO');
  });

  it('deve liquidar item planejado avulso chamando efetivarTransacaoPlanejada', () => {
    const item: DashboardDespesaItem = {
      id: 'plan-123',
      descricao: 'Curso Online',
      tipo: 'saida',
      valor: 200,
      data: '2026-10-18',
      status: 'pendente',
      origem: 'AVULSO',
      origem_rotulo: 'Avulso',
      target_id: '123',
    };

    component.efetivarItem(item);
    expect(dashboardServiceStub.efetivarTransacaoPlanejada).toHaveBeenCalledWith('123');
    expect(dashboardServiceStub.carregarDashboard).toHaveBeenCalled();
  });

  it('deve liquidar parcela de empréstimo chamando efetivarParcelaEmprestimo', () => {
    const item: DashboardDespesaItem = {
      id: 'loan-456',
      descricao: 'Parcela Caixa',
      tipo: 'saida',
      valor: 650,
      data: '2026-10-18',
      status: 'pendente',
      origem: 'EMPRESTIMO',
      origem_rotulo: 'Empréstimo',
      target_id: '456',
    };

    component.efetivarItem(item);
    expect(dashboardServiceStub.efetivarParcelaEmprestimo).toHaveBeenCalledWith('456');
    expect(dashboardServiceStub.carregarDashboard).toHaveBeenCalled();
  });

  it('deve pagar fatura de cartão chamando pagarFaturaCartao', () => {
    const item: DashboardDespesaItem = {
      id: 'card-789',
      descricao: 'Fatura Nubank',
      tipo: 'cartao',
      valor: 1500,
      data: '2026-10-20',
      status: 'pendente',
      origem: 'CARTAO',
      origem_rotulo: 'Cartão',
      target_id: '789',
    };

    component.efetivarItem(item);
    expect(dashboardServiceStub.pagarFaturaCartao).toHaveBeenCalledWith('789');
    expect(dashboardServiceStub.carregarDashboard).toHaveBeenCalled();
  });

  it('deve marcar transação da conta como paga chamando marcarComoPago', () => {
    const item: Transacao = {
      id: 50,
      descricao: 'Conta de Água',
      tipo: 'saida',
      valor: 120,
      data: '2026-10-10',
      status: 'pendente',
      origem: 'CONTA',
      origem_rotulo: 'Conta',
      target_id: '50',
    };

    component.efetivarItem(item);
    expect(transacaoServiceStub.marcarComoPago).toHaveBeenCalledWith(50);
    expect(dashboardServiceStub.carregarDashboard).toHaveBeenCalled();
  });

  it('deve cadastrar despesa mensal recorrente via PlannedTransactionService e recarregar dados', () => {
    component.expenseForm.patchValue({
      descricao: 'Aluguel Apartamento',
      valor: 2500,
      data: '2026-10-10',
      idcategoria: 1,
      recorrencia: 'MENSAL',
      dataLimiteRecorrencia: '2027-10-10',
    });

    component.salvarNovaDespesa();

    expect(plannedTransactionServiceStub.criar).toHaveBeenCalledWith({
      descricao: 'Aluguel Apartamento',
      tipo: 'DESPESA',
      valor: 2500,
      data_prevista: '2026-10-10',
      idcategoria: 1,
      recorrencia: 'MENSAL',
      data_limite_recorrencia: '2027-10-10',
      status: 'PENDING',
    });
    expect(dashboardServiceStub.carregarDashboard).toHaveBeenCalled();
    expect(component.showAddExpense()).toBe(false);
  });

  it('deve abrir modal de edição e preencher formulário com dados do item planejado', () => {
    const item: DashboardDespesaItem = {
      id: 'plan-1',
      descricao: 'Internet Fibra',
      tipo: 'saida',
      valor: 120,
      data: '2026-10-15',
      status: 'pendente',
      origem: 'AVULSO',
      origem_rotulo: 'Avulso',
      target_id: 'plan-1',
      is_recorrente: true,
      recorrencia: 'MENSAL',
    };

    component.abrirEdicao(item);

    expect(component.showEditModal()).toBe(true);
    expect(component.itemParaEdicao()).toEqual(item);
    expect(component.editForm.value).toEqual({
      descricao: 'Internet Fibra',
      valor: 120,
      data: '2026-10-15',
      idcategoria: null,
      updateMode: 'SINGLE',
    });

    component.fecharEdicao();
    expect(component.showEditModal()).toBe(false);
    expect(component.itemParaEdicao()).toBeNull();
  });

  it('deve salvar edição pontual (SINGLE) de item recorrente chamando atualizar com updateMode SINGLE', () => {
    const item: DashboardDespesaItem = {
      id: 'plan-1',
      descricao: 'Internet Fibra',
      tipo: 'saida',
      valor: 120,
      data: '2026-10-15',
      status: 'pendente',
      origem: 'AVULSO',
      target_id: 'plan-1',
      is_recorrente: true,
      recorrencia: 'MENSAL',
    };

    component.abrirEdicao(item);
    component.editForm.patchValue({
      valor: 135,
      updateMode: 'SINGLE',
    });

    component.salvarEdicao();

    expect(plannedTransactionServiceStub.atualizar).toHaveBeenCalledWith('plan-1', {
      descricao: 'Internet Fibra',
      valor: 135,
      data_prevista: '2026-10-15',
      idcategoria: null,
      updateMode: 'SINGLE',
    });
    expect(component.showEditModal()).toBe(false);
    expect(dashboardServiceStub.carregarDashboard).toHaveBeenCalled();
  });

  it('deve salvar edição em massa (ALL_FUTURE) de item recorrente chamando atualizar com updateMode ALL_FUTURE', () => {
    const item: DashboardDespesaItem = {
      id: 'plan-1',
      descricao: 'Aluguel',
      tipo: 'saida',
      valor: 2500,
      data: '2026-10-05',
      status: 'pendente',
      origem: 'AVULSO',
      target_id: 'plan-1',
      is_recorrente: true,
      recorrencia: 'MENSAL',
    };

    component.abrirEdicao(item);
    component.editForm.patchValue({
      valor: 2700,
      updateMode: 'ALL_FUTURE',
    });

    component.salvarEdicao();

    expect(plannedTransactionServiceStub.atualizar).toHaveBeenCalledWith('plan-1', {
      descricao: 'Aluguel',
      valor: 2700,
      data_prevista: '2026-10-05',
      idcategoria: null,
      updateMode: 'ALL_FUTURE',
    });
    expect(component.showEditModal()).toBe(false);
    expect(dashboardServiceStub.carregarDashboard).toHaveBeenCalled();
  });

  it('deve excluir item planejado chamando deletar e recarregando o dashboard', () => {
    component.excluirItemPlanejado('plan-1');

    expect(plannedTransactionServiceStub.deletar).toHaveBeenCalledWith('plan-1');
    expect(dashboardServiceStub.carregarDashboard).toHaveBeenCalled();
  });
});

