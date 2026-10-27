import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AlertController, ToastController } from '@ionic/angular';
import {
  AgrupamentoTipoPlanejamento,
  Categoria,
  ResumoPlanejamento,
} from '@contabilidade/models';
import { HeaderStateService } from '@org/shared-ui-navigation';
import { PlanejamentoPage } from './planejamento.page';
import { PlanejamentoService } from '../../core/services/planejamento.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { CategoriaService } from '../../core/services/categoria.service';

describe('PlanejamentoPage', () => {
  let fixture: ComponentFixture<PlanejamentoPage>;
  let component: PlanejamentoPage;
  let serviceStub: {
    resumo: ReturnType<typeof signal<ResumoPlanejamento | null>>;
    agrupados: ReturnType<typeof signal<AgrupamentoTipoPlanejamento[]>>;
    loading: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    carregarMes: ReturnType<typeof vi.fn>;
    criar: ReturnType<typeof vi.fn>;
    atualizar: ReturnType<typeof vi.fn>;
    remover: ReturnType<typeof vi.fn>;
  };
  let alertRole = 'destructive';

  const resumo: ResumoPlanejamento = {
    mes: 10,
    ano: 2026,
    tipo: 'despesa',
    totais: { planejado: 1500, realizado_pago: 1200, realizado_pendente: 450 },
    categorias: [
      { idcategoria: 1, categoria_nome: 'Mercado', planejado: 1000, realizado_pago: 900, realizado_pendente: 300 },
      { idcategoria: 2, categoria_nome: 'Lazer', planejado: 500, realizado_pago: 300, realizado_pendente: 150 },
      { idcategoria: 3, categoria_nome: 'Saúde', planejado: 0, realizado_pago: 0, realizado_pendente: 0 },
    ],
  };
  const agrupados: AgrupamentoTipoPlanejamento[] = [
    {
      tipo: 'despesa',
      soma: 1500,
      agrupamentoTipo: [
        {
          categoria: 'Mercado',
          categoriaid: 1,
          soma: 1000,
          planejamento: [
            { id: 11, categoria: 'Mercado', subcategoria: null, valor: 1000, tipo: 'despesa', categoriaid: 1, subcategoriaid: null, data: '2026-10-01', userid: 1 },
          ],
        },
      ],
    },
  ];

  beforeEach(async () => {
    alertRole = 'destructive';
    serviceStub = {
      resumo: signal<ResumoPlanejamento | null>(resumo),
      agrupados: signal(agrupados),
      loading: signal(false),
      error: signal<string | null>(null),
      carregarMes: vi.fn().mockReturnValue(of({ resumo, agrupados })),
      criar: vi.fn().mockReturnValue(of({})),
      atualizar: vi.fn().mockReturnValue(of({})),
      remover: vi.fn().mockReturnValue(of(undefined)),
    };
    const overlay = () => ({
      present: vi.fn().mockResolvedValue(undefined),
      onDidDismiss: vi.fn().mockImplementation(() => Promise.resolve({ role: alertRole })),
    });

    await TestBed.configureTestingModule({
      imports: [PlanejamentoPage],
      providers: [
        provideRouter([]),
        HeaderStateService,
        { provide: PlanejamentoService, useValue: serviceStub },
        { provide: DashboardService, useValue: { mes: signal(10), ano: signal(2026) } },
        {
          provide: CategoriaService,
          useValue: {
            categorias: signal<Categoria[]>([{ id: 1, nome: 'Mercado', icone: '', cor: '', tipo: 'despesa' }]),
            listarCategorias: vi.fn().mockReturnValue(of([])),
            listarSubcategorias: vi.fn().mockReturnValue(of([])),
          },
        },
        { provide: AlertController, useValue: { create: vi.fn().mockImplementation(async () => overlay()) } },
        { provide: ToastController, useValue: { create: vi.fn().mockImplementation(async () => overlay()) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PlanejamentoPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('carrega o mês e soma pago + pendente como realizado', () => {
    expect(serviceStub.carregarMes).toHaveBeenCalledWith(10, 2026, 'despesa');
    expect(component.totais().realizado).toBe(1650);
    expect(component.totais().restante).toBe(-150);
  });

  it('classifica as categorias e ordena estouradas primeiro', () => {
    const [primeira, segunda, terceira] = component.linhas();
    expect(primeira.nome).toBe('Mercado');
    expect(primeira.situacao).toBe('estourou');
    expect(segunda.situacao).toBe('atencao');
    expect(terceira.situacao).toBe('sem-orcamento');
    expect(primeira.linhas).toHaveLength(1);
  });

  it('troca o tipo recarregando o resumo daquele tipo', () => {
    component.onTipo(new CustomEvent('ionChange', { detail: { value: 'receita' } }));
    expect(serviceStub.carregarMes).toHaveBeenLastCalledWith(10, 2026, 'receita');
    // resumo carregado ainda é de despesa: não deve ser exibido como receita
    expect(component.linhas()).toHaveLength(0);
  });

  it('atualiza a linha existente em vez de criar (a API somaria o valor)', () => {
    component.abrirNovo(1);
    component.form.patchValue({ valor: 1200 });
    component.salvar();
    expect(serviceStub.atualizar).toHaveBeenCalledWith(11, { valor: 1200 });
    expect(serviceStub.criar).not.toHaveBeenCalled();
  });

  it('cria orçamento novo com a data de referência do mês', () => {
    component.abrirNovo(2);
    component.form.patchValue({ valor: 300 });
    component.salvar();
    expect(serviceStub.criar).toHaveBeenCalledWith({
      categoriaid: 2,
      subcategoriaid: null,
      valor: 300,
      tipo: 'despesa',
      data: '2026-10-01',
    });
  });

  it('exclui somente após confirmação', async () => {
    const linha = agrupados[0].agrupamentoTipo[0].planejamento[0];
    alertRole = 'cancel';
    await component.remover(linha);
    expect(serviceStub.remover).not.toHaveBeenCalled();
    alertRole = 'destructive';
    await component.remover(linha);
    expect(serviceStub.remover).toHaveBeenCalledWith(11);
  });

  it('mostra estado de erro com nova tentativa', () => {
    serviceStub.resumo.set(null);
    serviceStub.agrupados.set([]);
    serviceStub.error.set('Sem conexão com o servidor.');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent).toContain(
      'Sem conexão'
    );
  });
});
