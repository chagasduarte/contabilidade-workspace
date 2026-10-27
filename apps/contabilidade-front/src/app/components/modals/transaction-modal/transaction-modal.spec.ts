import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { TransactionModal } from './transaction-modal';
import { TransacaoService } from '../../../core/services/transacao.service';
import { CategoriaService } from '../../../core/services/categoria.service';
import { CartaoService } from '../../../core/services/cartao.service';
import { PlannedTransactionService } from '../../../core/services/planned-transaction.service';
import {
  Cartao,
  Categoria,
  CreateParceladaDto,
  CreateTransacaoDto,
  PlannedTransaction,
  Transacao,
} from '@contabilidade/models';

describe('TransactionModal', () => {
  let component: TransactionModal;
  let fixture: ComponentFixture<TransactionModal>;

  const mockCategorias: Categoria[] = [
    { id: 1, nome: 'Alimentação', idusuario: 1 },
    { id: 2, nome: 'Serviços', idusuario: 1 },
  ];

  const mockCartoes: Cartao[] = [
    { id: 10, nome: 'Nubank', dia_fatura: 5, limite: 4000, userid: 1 },
    { id: 20, nome: 'Inter', dia_fatura: 12, limite: 2500, userid: 1 },
  ];

  let transacaoServiceStub: {
    criarTransacao: ReturnType<typeof vi.fn>;
    criarTransacoesParceladas: ReturnType<typeof vi.fn>;
    atualizarTransacao: ReturnType<typeof vi.fn>;
  };

  let plannedTransactionServiceStub: {
    criar: ReturnType<typeof vi.fn>;
    atualizar: ReturnType<typeof vi.fn>;
  };

  let categoriaServiceStub: {
    categorias: ReturnType<typeof signal<Categoria[]>>;
    listarCategorias: ReturnType<typeof vi.fn>;
    listarSubcategorias: ReturnType<typeof vi.fn>;
  };

  let cartaoServiceStub: {
    cartoes: ReturnType<typeof signal<Cartao[]>>;
    listarCartoes: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    transacaoServiceStub = {
      criarTransacao: vi.fn().mockReturnValue(
        of({
          id: 1,
          descricao: 'Mercado',
          tipo: 'saida',
          valor: 150,
          data: '2026-10-15',
          status: 'pago',
        } as Transacao)
      ),
      criarTransacoesParceladas: vi.fn().mockReturnValue(
        of([
          {
            id: 101,
            descricao: 'Notebook - Parcela',
            tipo: 'saida',
            valor: 1000,
            data: '2026-10-15',
            status: 'pendente',
          } as Transacao,
          {
            id: 102,
            descricao: 'Notebook - Parcela',
            tipo: 'saida',
            valor: 1000,
            data: '2026-11-15',
            status: 'pendente',
          } as Transacao,
        ])
      ),
      atualizarTransacao: vi.fn().mockReturnValue(
        of({
          id: 1,
          descricao: 'Mercado editado',
          tipo: 'saida',
          valor: 180,
          data: '2026-10-15',
          status: 'pago',
        } as Transacao)
      ),
    };

    plannedTransactionServiceStub = {
      criar: vi.fn().mockReturnValue(
        of({
          id: 'plan-1',
          userid: 1,
          descricao: 'Aluguel',
          tipo: 'DESPESA',
          valor: 1500,
          data_prevista: '2026-10-05',
          recorrencia: 'MENSAL',
          status: 'PENDING',
        } as PlannedTransaction)
      ),
      atualizar: vi.fn().mockReturnValue(
        of({
          id: 'plan-1',
          userid: 1,
          descricao: 'Aluguel reajustado',
          tipo: 'DESPESA',
          valor: 1600,
          data_prevista: '2026-10-05',
          recorrencia: 'MENSAL',
          status: 'PENDING',
        } as PlannedTransaction)
      ),
    };

    categoriaServiceStub = {
      categorias: signal<Categoria[]>(mockCategorias),
      listarCategorias: vi.fn().mockReturnValue(of(mockCategorias)),
      listarSubcategorias: vi
        .fn()
        .mockReturnValue(of([{ id: 10, nome: 'Supermercado', idcategoria: 1 }])),
    };

    cartaoServiceStub = {
      cartoes: signal<Cartao[]>(mockCartoes),
      listarCartoes: vi.fn().mockReturnValue(of(mockCartoes)),
    };

    await TestBed.configureTestingModule({
      imports: [TransactionModal],
      providers: [
        { provide: TransacaoService, useValue: transacaoServiceStub },
        { provide: CategoriaService, useValue: categoriaServiceStub },
        { provide: CartaoService, useValue: cartaoServiceStub },
        { provide: PlannedTransactionService, useValue: plannedTransactionServiceStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TransactionModal);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
  });

  it('should create and initialize default form values', () => {
    expect(component).toBeTruthy();
    expect(component.form.get('tipo')?.value).toBe('saida');
    expect(component.form.get('status')?.value).toBe('pago');
  });

  it('should toggle between saida and entrada', () => {
    component.setTipo('entrada');
    expect(component.tipoAtual()).toBe('entrada');
    expect(component.form.get('tipo')?.value).toBe('entrada');
    expect(component.form.get('isCartao')?.value).toBe(false);
    expect(component.form.get('isParcelado')?.value).toBe(false);

    component.setTipo('saida');
    expect(component.tipoAtual()).toBe('saida');
    expect(component.form.get('tipo')?.value).toBe('saida');
  });

  it('should keep entrada when service signals update asynchronously', () => {
    component.setTipo('entrada');
    expect(component.tipoAtual()).toBe('entrada');
    expect(component.form.get('tipo')?.value).toBe('entrada');

    // Simula emissão/atualização de signals de categorias ou cartões
    categoriaServiceStub.categorias.set([
      ...mockCategorias,
      { id: 99, nome: 'Investimentos', idusuario: 1 },
    ]);
    cartaoServiceStub.cartoes.set([
      ...mockCartoes,
      { id: 30, nome: 'C6', dia_fatura: 20, limite: 5000, userid: 1 },
    ]);
    fixture.detectChanges();

    // Deve permanecer como entrada sem resetar para despesa
    expect(component.tipoAtual()).toBe('entrada');
    expect(component.form.get('tipo')?.value).toBe('entrada');
  });

  it('should save a regular transaction', () => {
    component.form.patchValue({
      tipo: 'saida',
      descricao: 'Restaurante',
      valor: 85.5,
      data: '2026-10-15',
      idcategoria: 1,
      categoria: 10,
      status: 'pago',
      isCartao: false,
      isParcelado: false,
    });

    let created: unknown = null;
    component.transactionCreated.subscribe((res) => {
      created = res;
    });

    component.salvar();

    expect(transacaoServiceStub.criarTransacao).toHaveBeenCalledWith({
      tipo: 'saida',
      descricao: 'Restaurante',
      valor: 85.5,
      idcategoria: 1,
      idsubcategoria: 10,
      data: '2026-10-15',
      status: 'pago',
      ispaycart: false,
      cartaoid: undefined,
    } as CreateTransacaoDto);
    expect(created).toBeTruthy();
  });

  it('should save an installment transaction with credit card', () => {
    component.form.patchValue({
      tipo: 'saida',
      descricao: 'Notebook Novo',
      valor: 2000,
      data: '2026-10-15',
      idcategoria: 2,
      categoria: 2,
      isCartao: true,
      cartaoid: 10,
      isParcelado: true,
      qtdParcelas: 2,
      valorParcela: 1000,
    });

    let created: unknown = null;
    component.transactionCreated.subscribe((res) => {
      created = res;
    });

    component.salvar();

    expect(transacaoServiceStub.criarTransacoesParceladas).toHaveBeenCalledWith({
      tipo: 'saida',
      descricao: 'Notebook Novo',
      valor: 2000,
      idcategoria: 2,
      idsubcategoria: null,
      data: '2026-10-15',
      ispaycart: true,
      cartaoid: 10,
      parcelado: true,
      parcelas: {
        QtdParcelas: 2,
        Valor: 1000,
      },
    } as CreateParceladaDto);
    expect(created).toBeTruthy();
  });

  it('should auto-calculate installment value when valor and qtdParcelas change', () => {
    component.form.patchValue({
      isParcelado: true,
      valor: 600,
      qtdParcelas: 3,
    });

    expect(component.form.get('valorParcela')?.value).toBe(200);
  });

  it('should emit closeModal when fechar is called', () => {
    let closed = false;
    component.closeModal.subscribe(() => {
      closed = true;
    });

    component.fechar();
    expect(closed).toBe(true);
  });

  it('should close on escape key', () => {
    let closed = false;
    component.closeModal.subscribe(() => {
      closed = true;
    });

    component.onEscape();
    expect(closed).toBe(true);
  });

  it('deve chamar PlannedTransactionService.criar quando recorrencia for MENSAL', () => {
    component.form.patchValue({
      tipo: 'saida',
      descricao: 'Aluguel',
      valor: 1500,
      data: '2026-10-05',
      idcategoria: 1,
      recorrencia: 'MENSAL',
      dataLimiteRecorrencia: '2027-10-05',
    });

    component.salvar();

    expect(plannedTransactionServiceStub.criar).toHaveBeenCalledWith({
      descricao: 'Aluguel',
      tipo: 'DESPESA',
      valor: 1500,
      data_prevista: '2026-10-05',
      idcategoria: 1,
      recorrencia: 'MENSAL',
      data_limite_recorrencia: '2027-10-05',
      status: 'PENDING',
    });
    expect(transacaoServiceStub.criarTransacao).not.toHaveBeenCalled();
  });

  it('deve atualizar transação de conta (a) e conta planejada recorrente (c) com escopo ALL_FUTURE', () => {
    fixture.componentRef.setInput('isOpen', false);
    fixture.detectChanges();

    fixture.componentRef.setInput('editingItem', {
      id: 42,
      descricao: 'Energia',
      tipo: 'saida',
      valor: 210,
      data: '2026-10-12',
      status: 'pendente',
      idcategoria: 1,
    } as Transacao);
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();

    component.form.patchValue({ valor: 230 });
    component.salvar();

    expect(transacaoServiceStub.atualizarTransacao).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ descricao: 'Energia', valor: 230 })
    );

    // Agora testa edição de item (c) PLANEJADO recorrente
    fixture.componentRef.setInput('isOpen', false);
    fixture.detectChanges();

    fixture.componentRef.setInput('editingItem', {
      id: 'plan:uuid-123',
      target_id: 'uuid-123',
      source_type: 'PLANNED_TRANSACTION',
      origem: 'PLANEJADO',
      descricao: 'Aluguel',
      tipo: 'saida',
      valor: 1500,
      data: '2026-10-05',
      status: 'pendente',
      idcategoria: 1,
      recorrencia: 'MENSAL',
      is_recorrente: true,
    } as Transacao);
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();

    component.form.patchValue({ valor: 1600, updateMode: 'ALL_FUTURE' });
    component.salvar();

    expect(plannedTransactionServiceStub.atualizar).toHaveBeenCalledWith(
      'uuid-123',
      expect.objectContaining({
        descricao: 'Aluguel',
        tipo: 'DESPESA',
        valor: 1600,
        updateMode: 'ALL_FUTURE',
      })
    );
  });
});

