import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ForecastService } from './forecast.service';
import { API_URL } from './categoria.service';
import { ForecastResponseDto } from '@contabilidade/models';

describe('ForecastService', () => {
  let service: ForecastService;
  let httpMock: HttpTestingController;
  const mockApiUrl = 'http://localhost:3000';

  const mockResponse: ForecastResponseDto = {
    currentBalance: 5000,
    finalProjectedBalance: 7500,
    minimumProjectedBalance: 3200,
    safeToSpendToday: 3200,
    monthlySummaries: [
      {
        month: '2026-10',
        initialBalance: 5000,
        totalIncome: 4000,
        totalExpense: 2000,
        finalBalance: 7000,
        minimumBalance: 4500,
      },
    ],
    events: [
      {
        date: '2026-10-20',
        description: 'Salário Mensal',
        amount: 4000,
        type: 'RECEITA',
        origin: 'PLANNED',
        originId: 'pt-1',
      },
      {
        date: '2026-10-25',
        description: 'Parcela Empréstimo Nubank',
        amount: 800,
        type: 'DESPESA',
        origin: 'LOAN',
        originId: 'inst-1',
      },
    ],
    simulationResult: {
      isAffordable: true,
      projectedBalanceAtTargetDate: 4500,
      remainingMarginAfterTarget: 2000,
      targetAmount: 2500,
      targetDate: '2026-11-15',
    },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ForecastService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: mockApiUrl },
      ],
    });

    service = TestBed.inject(ForecastService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('deve inicializar com sinais em estado padrão', () => {
    expect(service).toBeTruthy();
    expect(service.forecastData()).toBeNull();
    expect(service.loading()).toBe(false);
    expect(service.error()).toBeNull();
  });

  it('deve buscar projeção com parâmetros corretos e atualizar o signal forecastData', () => {
    service
      .getForecast({
        months: 6,
        targetExpenseAmount: 2500,
        targetExpenseDate: '2026-11-15',
      })
      .subscribe((res) => {
        expect(res).toEqual(mockResponse);
      });

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${mockApiUrl}/forecast` &&
        r.params.get('months') === '6' &&
        r.params.get('targetExpenseAmount') === '2500' &&
        r.params.get('targetExpenseDate') === '2026-11-15'
    );
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);

    expect(service.forecastData()).toEqual(mockResponse);
    expect(service.loading()).toBe(false);
  });

  it('deve efetivar transação planejada via POST /planned-transactions/:id/settle', () => {
    const payload = { valor_pago: 500, data_pagamento: '2026-10-20' };

    service.settlePlannedTransaction('pt-1', payload).subscribe((res) => {
      expect(res.success).toBe(true);
    });

    const req = httpMock.expectOne(`${mockApiUrl}/planned-transactions/pt-1/settle`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({
      success: true,
      message: 'Liquidado com sucesso',
      transacao: {},
      planned_transaction: {},
    });
  });

  it('deve efetivar parcela de empréstimo via POST /loans/installments/:id/settle', () => {
    const payload = { valor_pago: 800, data_pagamento: '2026-10-25' };

    service.settleLoanInstallment('inst-1', payload).subscribe((res) => {
      expect(res.success).toBe(true);
    });

    const req = httpMock.expectOne(`${mockApiUrl}/loans/installments/inst-1/settle`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({
      success: true,
      message: 'Parcela liquidada com sucesso',
      transacao: {},
      installment: {},
      loan_paid_off: false,
    });
  });
});

