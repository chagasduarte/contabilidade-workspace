import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { LoanService } from './loan.service';
import { API_URL } from './categoria.service';
import { LoanSummary, PaymentPayload } from '@contabilidade/models';

describe('LoanService', () => {
  let service: LoanService;
  let httpMock: HttpTestingController;
  const mockApiUrl = 'http://localhost:3000';

  const mockLoan = {
    id: 'loan-1',
    user_id: '00000000-0000-0000-0000-000000000001',
    institution_name: 'Nubank',
    principal_amount: 5000,
    monthly_interest_rate: 2.0,
    status: 'ACTIVE' as const,
    contracted_at: '2026-01-01',
    usuario_id: 1,
    instituicao: 'Nubank',
    valor_principal: 5000,
    taxa_juros_mensal: 2.0,
    data_contratacao: '2026-01-01',
  };

  const mockParcelas = [
    {
      id: 'p-1',
      loan_id: 'loan-1',
      installment_number: 1,
      due_date: '2026-02-01',
      original_amount: 500,
      principal_component: 400,
      interest_component: 100,
      status: 'PENDING' as const,
      emprestimo_id: 'loan-1',
      numero_parcela: 1,
      data_vencimento: '2026-02-01',
      valor_original: 500,
      valor_amortizacao: 400,
      valor_juros: 100,
    },
  ];

  const mockResumo: LoanSummary = {
    loan: mockLoan,
    installments: mockParcelas,
    total_paid: 0,
    total_discounts: 0,
    remaining_balance: 500,
    emprestimo: mockLoan,
    parcelas: mockParcelas,
    total_desembolsado: 0,
    total_descontos: 0,
    saldo_devedor_restante: 500,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        LoanService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: mockApiUrl },
      ],
    });

    service = TestBed.inject(LoanService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('deve inicializar com sinais em estado padrão', () => {
    expect(service).toBeTruthy();
    expect(service.resumo()).toBeNull();
    expect(service.loading()).toBe(false);
    expect(service.error()).toBeNull();
  });

  it('deve buscar resumo do empréstimo e atualizar o signal resumo', () => {
    service.obterResumo('loan-1').subscribe((res) => {
      expect(res).toEqual(mockResumo);
    });

    const req = httpMock.expectOne(`${mockApiUrl}/loans/loan-1/resumo`);
    expect(req.request.method).toBe('GET');
    req.flush(mockResumo);

    expect(service.resumo()).toEqual(mockResumo);
    expect(service.loading()).toBe(false);
  });

  it('deve registrar pagamento com sucesso via POST /loans/pagamentos', () => {
    const payload: PaymentPayload = {
      loan_id: 'loan-1',
      installment_id: 'p-1',
      amount_paid: 450,
      discount_amount: 50,
      payment_method: 'PIX',
    };

    service.registrarPagamento(payload).subscribe((res) => {
      expect(res).toEqual({ sucesso: true });
    });

    const req = httpMock.expectOne(`${mockApiUrl}/loans/pagamentos`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ sucesso: true });

    expect(service.loading()).toBe(false);
  });
});
