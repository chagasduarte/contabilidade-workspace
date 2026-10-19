import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FluxoCaixaChart } from './fluxo-caixa-chart';
import { ProjecaoMensal } from '@contabilidade/models';

describe('FluxoCaixaChart', () => {
  let component: FluxoCaixaChart;
  let fixture: ComponentFixture<FluxoCaixaChart>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FluxoCaixaChart],
    }).compileComponents();

    fixture = TestBed.createComponent(FluxoCaixaChart);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('deve mapear ProjecaoMensal[] para as 12 posições de entradas, saídas e progressão', () => {
    const mockProjecao: ProjecaoMensal[] = [
      {
        mes_ano: '2026-01-01',
        ano: 2026,
        mes: 1,
        soma_entrada: 15000,
        soma_saida: 8000,
        saldo_mensal: 7000,
        saldo_acumulado: 7000,
      },
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

    fixture.componentRef.setInput('projecao', mockProjecao);
    fixture.detectChanges();

    const series = component.chartSeries();
    expect(series.entradas[0]).toBe(15000);
    expect(series.saidas[0]).toBe(8000);
    expect(series.progressao[0]).toBe(7000);
    expect(series.entradas[9]).toBe(40000);
    expect(series.saidas[9]).toBe(12000);
    expect(series.progressao[9]).toBe(32390);
  });
});
