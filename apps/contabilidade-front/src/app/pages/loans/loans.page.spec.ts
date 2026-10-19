import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { provideRouter, Router } from '@angular/router';
import { LoansPage } from './loans.page';
import { LoanService } from '../../core/services/loan.service';
import { Loan } from '@contabilidade/models';

describe('LoansPage', () => {
  let component: LoansPage;
  let fixture: ComponentFixture<LoansPage>;
  let router: Router;

  const mockEmprestimos: Loan[] = [
    {
      id: 'loan-1',
      user_id: '00000000-0000-0000-0000-000000000001',
      institution_name: 'Nubank',
      principal_amount: 5000,
      monthly_interest_rate: 2.0,
      status: 'ACTIVE',
      contracted_at: '2026-01-01',
      usuario_id: 1,
      instituicao: 'Nubank',
      valor_principal: 5000,
      taxa_juros_mensal: 2.0,
      data_contratacao: '2026-01-01',
    },
    {
      id: 'loan-2',
      user_id: '00000000-0000-0000-0000-000000000001',
      institution_name: 'Banco do Brasil',
      principal_amount: 20000,
      monthly_interest_rate: 1.5,
      status: 'PAID_OFF',
      contracted_at: '2025-05-10',
      usuario_id: 1,
      instituicao: 'Banco do Brasil',
      valor_principal: 20000,
      taxa_juros_mensal: 1.5,
      data_contratacao: '2025-05-10',
    },
  ];

  let loanServiceStub: {
    emprestimos: ReturnType<typeof signal<Loan[]>>;
    loading: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    listarEmprestimos: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    loanServiceStub = {
      emprestimos: signal<Loan[]>(mockEmprestimos),
      loading: signal<boolean>(false),
      error: signal<string | null>(null),
      listarEmprestimos: vi.fn().mockReturnValue(of(mockEmprestimos)),
    };

    await TestBed.configureTestingModule({
      imports: [LoansPage],
      providers: [
        provideRouter([]),
        { provide: LoanService, useValue: loanServiceStub },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate');

    fixture = TestBed.createComponent(LoansPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve ser criado e carregar a lista de empréstimos', () => {
    expect(component).toBeTruthy();
    expect(loanServiceStub.listarEmprestimos).toHaveBeenCalled();
    expect(component.emprestimos()).toHaveLength(2);
  });

  it('deve navegar para a tela de detalhes ao clicar em um empréstimo', () => {
    component.abrirDetalhes(mockEmprestimos[0]);
    expect(router.navigate).toHaveBeenCalledWith(['/emprestimos', 'loan-1']);
  });

  it('deve abrir e fechar o modal de novo empréstimo', () => {
    component.abrirModal();
    expect(component.modalNovoEmprestimoAberto()).toBe(true);

    component.fecharModal();
    expect(component.modalNovoEmprestimoAberto()).toBe(false);
  });
});
