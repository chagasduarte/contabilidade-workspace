import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { Lancamentos } from './lancamentos';
import { TransacaoService } from '../../core/services/transacao.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { CategoriaService } from '../../core/services/categoria.service';
import { CartaoService } from '../../core/services/cartao.service';
import { HeaderStateService } from '@org/shared-ui-navigation';
import { Categoria, Cartao, ExtratoPaginado, Transacao } from '@contabilidade/models';

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
  };

  let dashboardServiceStub: {
    mes: ReturnType<typeof signal<number>>;
    ano: ReturnType<typeof signal<number>>;
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
    };

    dashboardServiceStub = {
      mes: signal(10),
      ano: signal(2026),
    };

    categoriaServiceStub = {
      categorias: signal<Categoria[]>([]),
      listarCategorias: vi.fn().mockReturnValue(of([])),
    };

    cartaoServiceStub = {
      cartoes: signal<Cartao[]>([]),
      listarCartoes: vi.fn().mockReturnValue(of([])),
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
});
