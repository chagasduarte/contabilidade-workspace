import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { LoanModal } from './loan-modal';
import { LoanService } from '../../../core/services/loan.service';
import { Loan } from '@contabilidade/models';

describe('LoanModal', () => {
  let component: LoanModal;
  let fixture: ComponentFixture<LoanModal>;

  const mockLoanCreated: Loan = {
    id: 'new-loan-1',
    user_id: '00000000-0000-0000-0000-000000000001',
    institution_name: 'Banco do Brasil',
    principal_amount: 12000,
    monthly_interest_rate: 2.0,
    status: 'ACTIVE',
    contracted_at: '2026-10-15',
    usuario_id: 1,
    instituicao: 'Banco do Brasil',
    valor_principal: 12000,
    taxa_juros_mensal: 2.0,
    data_contratacao: '2026-10-15',
  };

  let loanServiceStub: {
    criarEmprestimo: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    loanServiceStub = {
      criarEmprestimo: vi.fn().mockReturnValue(
        of({
          emprestimo: mockLoanCreated,
          parcelas: [],
        })
      ),
    };

    await TestBed.configureTestingModule({
      imports: [LoanModal],
      providers: [{ provide: LoanService, useValue: loanServiceStub }],
    }).compileComponents();

    fixture = TestBed.createComponent(LoanModal);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
  });

  it('deve ser criado e inicializar o formulário', () => {
    expect(component).toBeTruthy();
    expect(component.form.get('taxa_juros_mensal')?.value).toBe(1.5);
    expect(component.form.get('quantidade_parcelas')?.value).toBe(12);
  });

  it('deve calcular e sugerir a parcela automaticamente quando valor principal é informado', () => {
    component.form.patchValue({
      valor_principal: 10000,
      taxa_juros_mensal: 2.0,
      quantidade_parcelas: 10,
    });

    const parcela = component.form.get('valor_parcela')?.value;
    expect(parcela).toBeGreaterThan(1000); // 10000 / 10 + juros
  });

  it('deve chamar loanService.criarEmprestimo e emitir loanCreated ao salvar', () => {
    component.form.patchValue({
      instituicao: 'Banco do Brasil',
      valor_principal: 12000,
      taxa_juros_mensal: 2.0,
      quantidade_parcelas: 12,
      valor_parcela: 1134.72,
      primeiro_vencimento: '2026-11-15',
    });

    let criado: Loan | null = null;
    component.loanCreated.subscribe((res) => {
      criado = res;
    });

    component.salvar();

    expect(loanServiceStub.criarEmprestimo).toHaveBeenCalledWith(
      expect.objectContaining({
        institution_name: 'Banco do Brasil',
        principal_amount: 12000,
        monthly_interest_rate: 2.0,
        total_installments: 12,
        installment_amount: 1134.72,
        first_due_date: '2026-11-15',
      })
    );
    expect(criado).toEqual(mockLoanCreated);
  });

  it('deve emitir closeModal ao fechar', () => {
    let fechou = false;
    component.closeModal.subscribe(() => {
      fechou = true;
    });

    component.fechar();
    expect(fechou).toBe(true);
  });
});

