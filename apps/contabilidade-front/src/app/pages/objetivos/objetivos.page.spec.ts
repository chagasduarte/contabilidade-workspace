import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { AlertController, ToastController } from '@ionic/angular';
import { Objetivo } from '@contabilidade/models';
import { ObjetivosPage } from './objetivos.page';
import { ObjetivoService } from '../../core/services/objetivo.service';

describe('ObjetivosPage', () => {
  let fixture: ComponentFixture<ObjetivosPage>;
  let component: ObjetivosPage;
  let alert: { role: string; values?: unknown };
  let serviceStub: {
    objetivos: ReturnType<typeof signal<Objetivo[]>>;
    loading: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    listar: ReturnType<typeof vi.fn>;
    criar: ReturnType<typeof vi.fn>;
    atualizar: ReturnType<typeof vi.fn>;
    remover: ReturnType<typeof vi.fn>;
  };

  const base = (o: Partial<Objetivo>): Objetivo => ({
    id: 1,
    usuario_id: 1,
    nome: 'Viagem',
    tipo: 'Viagem',
    valor_objetivo: 10000,
    valor_mensal: 500,
    valor_acumulado: 2000,
    data_final: '2027-10-01',
    progresso_percentual: 20,
    valor_restante: 8000,
    meses_restantes: 12,
    valor_mensal_necessario: 666.67,
    ...o,
  });

  const lista = [
    base({ id: 1 }),
    base({ id: 2, nome: 'Reserva', valor_mensal: 1000, data_final: '2027-01-01' }),
    base({ id: 3, nome: 'Notebook', progresso_percentual: 100, valor_acumulado: 10000, valor_restante: 0 }),
    base({ id: 4, nome: 'Carro', meses_restantes: 0, valor_mensal_necessario: null, data_final: '2026-01-01' }),
  ];

  beforeEach(async () => {
    alert = { role: 'confirm' };
    serviceStub = {
      objetivos: signal<Objetivo[]>(lista),
      loading: signal(false),
      error: signal<string | null>(null),
      listar: vi.fn().mockReturnValue(of(lista)),
      criar: vi.fn().mockReturnValue(of(lista[0])),
      atualizar: vi.fn().mockReturnValue(of(lista[0])),
      remover: vi.fn().mockReturnValue(of(undefined)),
    };
    const overlay = () => ({
      present: vi.fn().mockResolvedValue(undefined),
      onDidDismiss: vi.fn().mockImplementation(() =>
        Promise.resolve({ role: alert.role, data: { values: alert.values } })
      ),
    });

    await TestBed.configureTestingModule({
      imports: [ObjetivosPage],
      providers: [
        { provide: ObjetivoService, useValue: serviceStub },
        { provide: AlertController, useValue: { create: vi.fn().mockImplementation(async () => overlay()) } },
        { provide: ToastController, useValue: { create: vi.fn().mockImplementation(async () => overlay()) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ObjetivosPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('carrega e ordena: pendentes pelo prazo, concluídos por último', () => {
    expect(serviceStub.listar).toHaveBeenCalled();
    expect(component.objetivos().map((o) => o.nome)).toEqual(['Carro', 'Reserva', 'Viagem', 'Notebook']);
  });

  it('classifica a situação de cada objetivo', () => {
    expect(component.situacao(lista[0])).toBe('abaixo');
    expect(component.situacao(lista[1])).toBe('no-ritmo');
    expect(component.situacao(lista[2])).toBe('concluido');
    expect(component.situacao(lista[3])).toBe('vencido');
  });

  it('soma os totais guardados e das metas', () => {
    expect(component.totais().guardado).toBe(16000);
    expect(component.totais().meta).toBe(40000);
  });

  it('guardar soma o aporte ao acumulado (PUT valor_acumulado)', async () => {
    alert.values = { valor: '250.5' };
    await component.guardar(lista[0]);
    expect(serviceStub.atualizar).toHaveBeenCalledWith(1, { valor_acumulado: 2250.5 });
  });

  it('não guarda valor inválido nem cancelado', async () => {
    alert.values = { valor: '0' };
    await component.guardar(lista[0]);
    alert = { role: 'cancel' };
    await component.guardar(lista[0]);
    expect(serviceStub.atualizar).not.toHaveBeenCalled();
  });

  it('cria e edita pelo formulário', () => {
    component.abrirNovo();
    component.form.patchValue({ nome: ' Casa ', tipo: 'Imóvel', valor_objetivo: 50000, data_final: '2030-01-01' });
    component.salvar();
    expect(serviceStub.criar).toHaveBeenCalledWith({
      nome: 'Casa',
      tipo: 'Imóvel',
      valor_objetivo: 50000,
      valor_mensal: 0,
      valor_acumulado: 0,
      data_final: '2030-01-01',
    });

    component.abrirEdicao(lista[0]);
    component.form.patchValue({ valor_mensal: 700 });
    component.salvar();
    expect(serviceStub.atualizar).toHaveBeenCalledWith(1, expect.objectContaining({ valor_mensal: 700 }));
  });

  it('mostra erro da API no formulário', () => {
    serviceStub.criar.mockReturnValue(throwError(() => new Error('data_final inválida.')));
    component.abrirNovo();
    component.form.patchValue({ nome: 'X', tipo: 'Y', valor_objetivo: 1, data_final: '2030-01-01' });
    component.salvar();
    expect(component.erroFormulario()).toBe('data_final inválida.');
    expect(component.modalAberto()).toBe(true);
  });

  it('exclui somente após confirmação', async () => {
    alert = { role: 'cancel' };
    await component.remover(lista[0]);
    expect(serviceStub.remover).not.toHaveBeenCalled();
    alert = { role: 'destructive' };
    await component.remover(lista[0]);
    expect(serviceStub.remover).toHaveBeenCalledWith(1);
  });

  it('estado vazio e de erro', () => {
    serviceStub.objetivos.set([]);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('ainda não tem objetivos');

    serviceStub.error.set('Sem conexão com o servidor.');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent).toContain(
      'Sem conexão'
    );
  });
});
