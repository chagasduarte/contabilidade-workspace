import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { DashboardService } from './dashboard.service';
import { API_URL } from './categoria.service';
import { DashboardResumo, ProjecaoMensal } from '@contabilidade/models';

describe('DashboardService', () => {
  let service: DashboardService;
  let httpMock: HttpTestingController;
  const mockApiUrl = 'http://localhost:3000';

  const mockResumo: DashboardResumo = {
    saldo_atual: 18500,
    gastos_mensal: 12000,
    receita_mensal: 40000,
    gastos_mensal_pendente: 3000,
    receita_mensal_pendente: 5000,
    saldo_acumulado: 32390,
    gastos_cartao: 2500,
    hasSome: true,
  };

  const mockProjecao: ProjecaoMensal[] = [
    {
      mes_ano: '2026-01-01',
      ano: 2026,
      mes: 1,
      soma_entrada: 22000,
      soma_saida: 11000,
      saldo_mensal: 11000,
      saldo_acumulado: 11000,
    },
    {
      mes_ano: '2026-02-01',
      ano: 2026,
      mes: 2,
      soma_entrada: 24000,
      soma_saida: 13000,
      saldo_mensal: 11000,
      saldo_acumulado: 22000,
    },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        DashboardService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: mockApiUrl },
      ],
    });

    service = TestBed.inject(DashboardService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('deve ser criado com estado inicial limpo', () => {
    expect(service).toBeTruthy();
    expect(service.resumo()).toBeNull();
    expect(service.projecao()).toEqual([]);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBeNull();
  });

  it('deve carregar o resumo financeiro e atualizar o signal resumo', () => {
    service.carregarResumo(10, 2026).subscribe((resumo) => {
      expect(resumo).toEqual(mockResumo);
    });

    expect(service.loading()).toBe(true);

    const req = httpMock.expectOne(
      `${mockApiUrl}/dashboard/resumo?mes=10&ano=2026`
    );
    expect(req.request.method).toBe('GET');
    req.flush(mockResumo);

    expect(service.resumo()).toEqual(mockResumo);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBeNull();
  });

  it('deve carregar a projeção anual e atualizar o signal projecao', () => {
    service.carregarProjecao(2026).subscribe((projecao) => {
      expect(projecao).toEqual(mockProjecao);
    });

    const req = httpMock.expectOne(
      `${mockApiUrl}/dashboard/projecao?ano=2026`
    );
    expect(req.request.method).toBe('GET');
    req.flush(mockProjecao);

    expect(service.projecao()).toEqual(mockProjecao);
    expect(service.loading()).toBe(false);
  });

  it('deve carregar resumo e projeção simultaneamente via carregarDashboard', () => {
    service.carregarDashboard(10, 2026).subscribe((res) => {
      expect(res.resumo).toEqual(mockResumo);
      expect(res.projecao).toEqual(mockProjecao);
    });

    const reqResumo = httpMock.expectOne(
      `${mockApiUrl}/dashboard/resumo?mes=10&ano=2026`
    );
    const reqProjecao = httpMock.expectOne(
      `${mockApiUrl}/dashboard/projecao?ano=2026`
    );

    reqResumo.flush(mockResumo);
    reqProjecao.flush(mockProjecao);

    expect(service.resumo()).toEqual(mockResumo);
    expect(service.projecao()).toEqual(mockProjecao);
    expect(service.loading()).toBe(false);
  });

  it('deve registrar mensagem de erro caso a requisição falhe', () => {
    service.carregarResumo(10, 2026).subscribe({
      error: () => {
        // erro tratado
      },
    });

    const req = httpMock.expectOne(
      `${mockApiUrl}/dashboard/resumo?mes=10&ano=2026`
    );
    req.error(new ProgressEvent('Network error'));

    expect(service.error()).toBeTruthy();
    expect(service.loading()).toBe(false);
  });
});

