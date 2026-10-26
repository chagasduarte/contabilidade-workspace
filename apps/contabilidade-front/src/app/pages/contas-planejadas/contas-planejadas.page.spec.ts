import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AlertController, ActionSheetController, ToastController } from '@ionic/angular';
import { Categoria, PlannedTransaction } from '@contabilidade/models';
import { HeaderStateService } from '@org/shared-ui-navigation';
import { ContasPlanejadasPage, ModoContas } from './contas-planejadas.page';
import { PlannedTransactionService } from '../../core/services/planned-transaction.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { CategoriaService } from '../../core/services/categoria.service';

describe('ContasPlanejadasPage', () => {
  let fixture: ComponentFixture<ContasPlanejadasPage>;
  let component: ContasPlanejadasPage;
  let serviceStub: ReturnType<typeof criarServiceStub>;
  let alertRole: string;
  let alertValues: unknown;

  const itens: PlannedTransaction[] = [
    {
      id: 'a',
      userid: 1,
      descricao: 'Aluguel',
      tipo: 'DESPESA',
      valor: 1500,
      data_prevista: '2026-10-05',
      idcategoria: 1,
      categoria_nome: 'Moradia',
      recorrencia: 'MENSAL',
      status: 'PENDING',
    },
    {
      id: 'b',
      userid: 1,
      descricao: 'Salário',
      tipo: 'RECEITA',
      valor: 5000,
      data_prevista: '2026-10-30',
      idcategoria: null,
      recorrencia: 'NONE',
      status: 'PENDING',
    },
  ];

  function criarServiceStub() {
    return {
      transacoesPlanejadas: signal<PlannedTransaction[]>(itens),
      loading: signal(false),
      error: signal<string | null>(null),
      nextCursor: signal<string | null>(null),
      carregandoMais: signal(false),
      listarPagina: vi.fn().mockReturnValue(of({ items: itens, next_cursor: null })),
      criar: vi.fn().mockReturnValue(of(itens[0])),
      atualizar: vi.fn().mockReturnValue(of(itens[0])),
      efetivar: vi.fn().mockReturnValue(of({ success: true })),
      pular: vi.fn().mockReturnValue(of(itens[0])),
      cancelar: vi.fn().mockReturnValue(of({})),
    };
  }

  async function montar(modo: ModoContas): Promise<void> {
    serviceStub = criarServiceStub();
    alertRole = 'confirm';
    alertValues = undefined;
    const overlay = () => ({
      present: vi.fn().mockResolvedValue(undefined),
      onDidDismiss: vi.fn().mockImplementation(() =>
        Promise.resolve({ role: alertRole, data: { values: alertValues } })
      ),
    });

    await TestBed.configureTestingModule({
      imports: [ContasPlanejadasPage],
      providers: [
        provideRouter([]),
        HeaderStateService,
        { provide: ActivatedRoute, useValue: { snapshot: { data: { modo } } } },
        { provide: PlannedTransactionService, useValue: serviceStub },
        { provide: DashboardService, useValue: { mes: signal(10), ano: signal(2026) } },
        {
          provide: CategoriaService,
          useValue: {
            categorias: signal<Categoria[]>([
              { id: 1, nome: 'Moradia', icone: '', cor: '', tipo: 'despesa' },
              { id: 2, nome: 'Salário', icone: '', cor: '', tipo: 'receita' },
            ]),
            listarCategorias: vi.fn().mockReturnValue(of([])),
          },
        },
        { provide: AlertController, useValue: { create: vi.fn().mockImplementation(async () => overlay()) } },
        { provide: ToastController, useValue: { create: vi.fn().mockImplementation(async () => overlay()) } },
        { provide: ActionSheetController, useValue: { create: vi.fn().mockImplementation(async () => overlay()) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ContasPlanejadasPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('lista o mês com paginação e calcula os totais pendentes', async () => {
    await montar('todas');
    expect(serviceStub.listarPagina).toHaveBeenCalledWith({
      dataInicio: '2026-10-01',
      dataFim: '2026-10-31',
      status: 'PENDING',
    });
    expect(component.totalPagar()).toBe(1500);
    expect(component.totalReceber()).toBe(5000);
    expect(component.saldoPrevisto()).toBe(3500);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.conta')).toHaveLength(2);
  });

  it('a pagar filtra DESPESA PENDING e a receber filtra RECEITA PENDING', async () => {
    await montar('pagar');
    expect(serviceStub.listarPagina).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'DESPESA', status: 'PENDING' })
    );
    TestBed.resetTestingModule();
    await montar('receber');
    expect(serviceStub.listarPagina).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'RECEITA', status: 'PENDING' })
    );
  });

  it('carrega a próxima página com o cursor', async () => {
    await montar('todas');
    serviceStub.nextCursor.set('c1');
    const complete = vi.fn();
    component.carregarMais({ target: { complete } } as unknown as Event);
    expect(serviceStub.listarPagina).toHaveBeenLastCalledWith(expect.any(Object), 'c1');
    expect(complete).toHaveBeenCalled();
  });

  it('cria conta recorrente mensal e recarrega o mês', async () => {
    await montar('todas');
    component.abrirNovo();
    component.form.patchValue({
      descricao: 'Internet',
      valor: 120,
      data_prevista: '2026-10-10',
      recorrencia: 'MENSAL',
    });
    await component.salvar();
    expect(serviceStub.criar).toHaveBeenCalledWith(
      expect.objectContaining({ descricao: 'Internet', tipo: 'DESPESA', recorrencia: 'MENSAL', status: 'PENDING' })
    );
    expect(component.modalAberto()).toBe(false);
  });

  it('edita conta recorrente perguntando o updateMode', async () => {
    await montar('todas');
    component.abrirEdicao(itens[0]);
    component.form.patchValue({ valor: 1600 });
    alertValues = 'ALL_FUTURE';
    await component.salvar();
    expect(serviceStub.atualizar).toHaveBeenCalledWith(
      'a',
      expect.objectContaining({ valor: 1600, updateMode: 'ALL_FUTURE' })
    );
  });

  it('não salva com formulário inválido', async () => {
    await montar('todas');
    component.abrirNovo();
    await component.salvar();
    expect(serviceStub.criar).not.toHaveBeenCalled();
  });

  it('efetiva com o valor informado e remove da lista de pendentes', async () => {
    await montar('todas');
    alertValues = { valor: '1450.5', data: '2026-10-06' };
    await component.efetivar(itens[0]);
    expect(serviceStub.efetivar).toHaveBeenCalledWith('a', {
      valor_pago: 1450.5,
      data_pagamento: '2026-10-06',
      idcategoria: 1,
    });
    expect(component.itens().map((i) => i.id)).toEqual(['b']);
  });

  it('mostra o erro da API (ex.: 409) sem quebrar a tela', async () => {
    await montar('todas');
    serviceStub.efetivar.mockReturnValue(
      throwError(() => new Error('Esta obrigação já foi efetivada anteriormente.'))
    );
    alertValues = { valor: '10', data: '2026-10-06' };
    await component.efetivar(itens[0]);
    expect(component.itens()).toHaveLength(2);
  });

  it('pula e cancela somente após confirmação', async () => {
    await montar('todas');
    alertRole = 'cancel';
    await component.cancelar(itens[0]);
    expect(serviceStub.cancelar).not.toHaveBeenCalled();

    alertRole = 'destructive';
    await component.pular(itens[0]);
    expect(serviceStub.pular).toHaveBeenCalledWith('a');
    await component.cancelar(itens[1]);
    expect(serviceStub.cancelar).toHaveBeenCalledWith('b');
  });

  it('exibe estado de erro com nova tentativa', async () => {
    await montar('todas');
    serviceStub.transacoesPlanejadas.set([]);
    serviceStub.error.set('Sem conexão com o servidor.');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Sem conexão');
  });
});
