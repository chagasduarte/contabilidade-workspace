import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RelatoriosPage, SEM_CATEGORIA } from './relatorios.page';
import { TransacaoService } from '../../core/services/transacao.service';
import { CategoriaService } from '../../core/services/categoria.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { of } from 'rxjs';

describe('RelatoriosPage', () => {
  let component: RelatoriosPage;
  let fixture: ComponentFixture<RelatoriosPage>;

  const extrato = [
    {
      id: 1,
      descricao: 'Supermercado ABC',
      tipo: 'saida',
      valor: 600,
      idcategoria: 1,
      categoria_nome: 'Alimentação',
      subcategoria_nome: 'Mercado',
      data: '2026-10-15',
      status: 'pago',
    },
    {
      id: 2,
      descricao: 'Posto de Gasolina',
      tipo: 'saida',
      valor: 500,
      idcategoria: 2,
      categoria_nome: 'Transporte',
      subcategoria_nome: 'Combustível',
      data: '2026-10-18',
      status: 'pendente',
    },
    {
      id: 3,
      descricao: 'Padaria',
      tipo: 'saida',
      valor: 50,
      idcategoria: null,
      data: '2026-10-18',
      status: 'pago',
    },
    {
      id: 4,
      descricao: 'Salário',
      tipo: 'entrada',
      valor: 5000,
      idcategoria: 3,
      categoria_nome: 'Salário',
      data: '2026-10-05',
      status: 'pago',
    },
  ];

  const transacaoServiceMock = {
    carregarExtrato: vi.fn().mockReturnValue(of(extrato)),
  };

  const categoriaServiceMock = {
    categorias: signal([
      { id: 1, nome: 'Alimentação', icone: 'restaurant-outline', cor: '#ff0000' },
      { id: 2, nome: 'Transporte', icone: 'car-outline', cor: '' },
    ]),
    listarCategorias: vi.fn().mockReturnValue(of([])),
  };

  const dashboardServiceMock = { mes: signal(10), ano: signal(2026) };

  beforeEach(async () => {
    transacaoServiceMock.carregarExtrato.mockClear();

    await TestBed.configureTestingModule({
      imports: [RelatoriosPage],
      providers: [
        { provide: TransacaoService, useValue: transacaoServiceMock },
        { provide: CategoriaService, useValue: categoriaServiceMock },
        { provide: DashboardService, useValue: dashboardServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RelatoriosPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve criar a página e abrir no mês selecionado no app', () => {
    expect(component).toBeTruthy();
    expect(transacaoServiceMock.carregarExtrato).toHaveBeenCalledWith(10, 2026, 0);
  });

  it('deve agrupar despesas por categoria a partir do extrato', () => {
    const cats = component.dadosCategorias();
    expect(cats.map((c) => c.categoria_nome)).toEqual(['Alimentação', 'Transporte', 'Sem categoria']);
    expect(cats[0].total).toBe(600);
    expect(cats[0].cor).toBe('#ff0000');
    expect(cats[2].chave).toBe(SEM_CATEGORIA);
  });

  it('deve calcular total, pendente e maior lançamento', () => {
    expect(component.totalGeral()).toBe(1150);
    expect(component.totalPendente()).toBe(500);
    expect(component.maiorCategoria()?.categoria_nome).toBe('Alimentação');
    expect(component.maiorTransacao()?.descricao).toBe('Supermercado ABC');
  });

  it('deve alternar para receitas sem nova requisição', () => {
    component.onTipo(new CustomEvent('ionChange', { detail: { value: 'entrada' } }));
    expect(component.totalGeral()).toBe(5000);
    expect(transacaoServiceMock.carregarExtrato).toHaveBeenCalledTimes(1);
  });

  it('deve filtrar pela categoria selecionada, inclusive "Sem categoria"', () => {
    component.alternarCategoria(2);
    expect(component.categoriaSelecionada()?.categoria_nome).toBe('Transporte');
    expect(component.transacoesFiltradas().map((t) => t.id)).toEqual([2]);

    component.alternarCategoria(SEM_CATEGORIA);
    expect(component.transacoesFiltradas().map((t) => t.id)).toEqual([3]);

    component.alternarCategoria(SEM_CATEGORIA);
    expect(component.categoriaSelecionada()).toBeNull();
  });

  it('deve preencher todos os dias do mês na evolução', () => {
    const evolucao = component.evolucao();
    expect(evolucao.labels.length).toBe(31);
    expect(evolucao.valores[17]).toBe(550);
  });

  it('deve buscar o ano inteiro no modo anual e agrupar por mês', () => {
    component.selecionarPeriodo('ano');
    expect(transacaoServiceMock.carregarExtrato).toHaveBeenLastCalledWith(undefined, 2026, 0);
    expect(component.evolucao().labels.length).toBe(12);
  });

  it('deve recusar período customizado com início após o fim', () => {
    component.selecionarPeriodo('customizado');
    component.inicioRascunho.set('2026-10-20');
    component.fimRascunho.set('2026-10-01');
    expect(component.rascunhoValido()).toBe(false);
  });
});
