import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import {
  AlertController,
  LoadingController,
  ToastController,
} from '@ionic/angular';
import { LoanDetailsComponent } from './loan-details.component';
import { LoanService } from './loan.service';
import { LoanSummary } from './loan.model';

describe('LoanDetailsComponent', () => {
  let component: LoanDetailsComponent;
  let fixture: ComponentFixture<LoanDetailsComponent>;

  const mockLoan = {
    id: 'loan-123',
    user_id: '00000000-0000-0000-0000-000000000001',
    institution_name: 'Banco Santander',
    principal_amount: 10000,
    monthly_interest_rate: 1.5,
    status: 'ACTIVE' as const,
    contracted_at: '2026-01-10',
    usuario_id: 1,
    instituicao: 'Banco Santander',
    valor_principal: 10000,
    taxa_juros_mensal: 1.5,
    data_contratacao: '2026-01-10',
  };

  const mockParcelas = [
    {
      id: 'p-1',
      loan_id: 'loan-123',
      installment_number: 1,
      due_date: '2026-02-10',
      original_amount: 1000,
      principal_component: 850,
      interest_component: 150,
      status: 'PAID' as const,
      emprestimo_id: 'loan-123',
      numero_parcela: 1,
      data_vencimento: '2026-02-10',
      valor_original: 1000,
      valor_amortizacao: 850,
      valor_juros: 150,
    },
    {
      id: 'p-2',
      loan_id: 'loan-123',
      installment_number: 2,
      due_date: '2026-03-10',
      original_amount: 1000,
      principal_component: 860,
      interest_component: 140,
      status: 'PENDING' as const,
      emprestimo_id: 'loan-123',
      numero_parcela: 2,
      data_vencimento: '2026-03-10',
      valor_original: 1000,
      valor_amortizacao: 860,
      valor_juros: 140,
    },
  ];

  const mockResumo: LoanSummary = {
    loan: mockLoan,
    installments: mockParcelas,
    total_paid: 1000,
    total_discounts: 0,
    remaining_balance: 1000,
    emprestimo: mockLoan,
    parcelas: mockParcelas,
    total_desembolsado: 1000,
    total_descontos: 0,
    saldo_devedor_restante: 1000,
  };

  let loanServiceStub: {
    resumo: ReturnType<typeof signal<LoanSummary | null>>;
    loading: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    obterResumo: ReturnType<typeof vi.fn>;
    registrarPagamento: ReturnType<typeof vi.fn>;
  };

  let alertCtrlStub: {
    create: ReturnType<typeof vi.fn>;
  };

  let toastCtrlStub: {
    create: ReturnType<typeof vi.fn>;
  };

  let loadingCtrlStub: {
    create: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    loanServiceStub = {
      resumo: signal<LoanSummary | null>(mockResumo),
      loading: signal<boolean>(false),
      error: signal<string | null>(null),
      obterResumo: vi.fn().mockReturnValue(of(mockResumo)),
      registrarPagamento: vi.fn().mockReturnValue(of({ sucesso: true })),
    };

    alertCtrlStub = {
      create: vi.fn().mockResolvedValue({
        present: vi.fn().mockResolvedValue(undefined),
      }),
    };

    toastCtrlStub = {
      create: vi.fn().mockResolvedValue({
        present: vi.fn().mockResolvedValue(undefined),
      }),
    };

    loadingCtrlStub = {
      create: vi.fn().mockResolvedValue({
        present: vi.fn().mockResolvedValue(undefined),
        dismiss: vi.fn().mockResolvedValue(true),
      }),
    };

    await TestBed.configureTestingModule({
      imports: [LoanDetailsComponent],
      providers: [
        { provide: LoanService, useValue: loanServiceStub },
        { provide: AlertController, useValue: alertCtrlStub },
        { provide: ToastController, useValue: toastCtrlStub },
        { provide: LoadingController, useValue: loadingCtrlStub },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => (key === 'id' ? 'loan-123' : null),
              },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoanDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve ser criado e carregar os dados do empréstimo da rota', () => {
    expect(component).toBeTruthy();
    expect(loanServiceStub.obterResumo).toHaveBeenCalledWith('loan-123');
    expect(component.resumo()).toEqual(mockResumo);
  });

  it('deve calcular o progresso de quitação corretamente', () => {
    const prog = component.progresso();
    expect(prog.total).toBe(2);
    expect(prog.pagas).toBe(1);
    expect(prog.percentual).toBe(0.5);
    expect(prog.formatado).toBe('50%');
  });

  it('deve disparar alerta de antecipação ao clicar em antecipar parcela pendente', async () => {
    const parcelaPendente = mockResumo.parcelas[1];
    await component.abrirModalAntecipacao(parcelaPendente);

    expect(alertCtrlStub.create).toHaveBeenCalled();
    const alertConfig = alertCtrlStub.create.mock.calls[0][0];
    expect(alertConfig.header).toContain('Parcela #2');
  });

  it('deve processar liquidação com desconto e recarregar dados', async () => {
    const parcelaPendente = mockResumo.parcelas[1];

    await component.processarPagamento(parcelaPendente, {
      desconto: '100',
      metodo_pagamento: 'PIX',
    });

    expect(loadingCtrlStub.create).toHaveBeenCalled();
    expect(loanServiceStub.registrarPagamento).toHaveBeenCalledWith(
      expect.objectContaining({
        loan_id: 'loan-123',
        installment_id: 'p-2',
        amount_paid: 900,
        discount_amount: 100,
        penalty_interest: 0,
        payment_method: 'PIX',
      })
    );
    expect(toastCtrlStub.create).toHaveBeenCalled();
    expect(loanServiceStub.obterResumo).toHaveBeenCalledTimes(2); // init + reload
  });
});

