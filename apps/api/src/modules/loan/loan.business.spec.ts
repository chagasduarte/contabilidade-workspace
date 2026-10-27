import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoanBusiness, LoanValidationError, LoanNotFoundError } from './loan.business';
import { LoanRepository } from './loan.repository';
import { codificarCursor, decodificarCursor, PaginacaoInvalidaError } from '../../common/utils/paginacao';
import { LoanPaymentRepository, ParcelaJaQuitadaError } from './loan-payment.repository';
import { LoanEntity, LoanInstallmentEntity, LoanPaymentEntity } from './loan.entity';

vi.mock('./loan.repository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./loan.repository')>();
  return {
    ...actual,
    LoanRepository: {
      criarComParcelas: vi.fn(),
      buscarPorId: vi.fn(),
      listarPorUsuario: vi.fn(),
      listarPaginaPorUsuario: vi.fn(),
      listarParcelas: vi.fn(),
      buscarParcelaPorId: vi.fn(),
      atualizarStatus: vi.fn(),
    },
  };
});

vi.mock('./loan-payment.repository', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./loan-payment.repository')>()),
  LoanPaymentRepository: {
    registrarPagamento: vi.fn(),
    buscarPorId: vi.fn(),
    listarPagamentosPorEmprestimo: vi.fn(),
    listarPagamentosPorParcela: vi.fn(),
  },
}));

describe('LoanBusiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('criarEmprestimo', () => {
    it('deve validar campos obrigatórios ao criar empréstimo', async () => {
      await expect(
        LoanBusiness.criarEmprestimo({
          usuario_id: 0,
          instituicao: '',
          valor_principal: 0,
          taxa_juros_mensal: 0,
          quantidade_parcelas: 0,
          valor_parcela: 0,
          primeiro_vencimento: '',
          institution_name: '',
          principal_amount: 0,
          monthly_interest_rate: 0,
        })
      ).rejects.toThrow(LoanValidationError);
    });

    it('deve gerar cronograma de parcelas separando amortização e juros corretamente', async () => {
      vi.mocked(LoanRepository.criarComParcelas).mockImplementation(
        async (contrato, parcelas) => {
          const emprestimo = {
            id: 'loan-123',
            user_id: contrato.user_id,
            institution_name: contrato.institution_name,
            principal_amount: contrato.principal_amount,
            monthly_interest_rate: contrato.monthly_interest_rate,
            status: 'ACTIVE' as const,
            contracted_at: new Date(),
            usuario_id: 1,
            instituicao: contrato.institution_name,
            valor_principal: contrato.principal_amount,
            taxa_juros_mensal: contrato.monthly_interest_rate,
            data_contratacao: new Date(),
          };
          const parcelasMapeadas = parcelas.map((p, idx) => ({
            id: `inst-${idx + 1}`,
            loan_id: 'loan-123',
            installment_number: p.installment_number,
            due_date: p.due_date instanceof Date ? p.due_date : new Date(p.due_date),
            original_amount: p.original_amount,
            principal_component: p.principal_component,
            interest_component: p.interest_component,
            status: p.status ?? ('PENDING' as const),
            emprestimo_id: 'loan-123',
            numero_parcela: p.installment_number,
            data_vencimento: p.due_date instanceof Date ? p.due_date : new Date(p.due_date),
            valor_original: p.original_amount,
            valor_amortizacao: p.principal_component,
            valor_juros: p.interest_component,
          }));
          return {
            loan: emprestimo,
            installments: parcelasMapeadas,
            emprestimo,
            parcelas: parcelasMapeadas,
          };
        }
      );

      const resultado = await LoanBusiness.criarEmprestimo({
        user_id: '00000000-0000-0000-0000-000000000001',
        institution_name: 'Banco do Brasil',
        principal_amount: 1000,
        monthly_interest_rate: 2.0, // 2% ao mês
        total_installments: 3,
        installment_amount: 350,
        first_due_date: '2026-11-10',
      });

      expect(LoanRepository.criarComParcelas).toHaveBeenCalledTimes(1);
      const callArgs = vi.mocked(LoanRepository.criarComParcelas).mock.calls[0];
      const parcelasGeradas = callArgs[1];

      expect(parcelasGeradas).toHaveLength(3);
      expect(parcelasGeradas[0].installment_number).toBe(1);
      // Mês 1: juros = 1000 * 0.02 = 20, amortização = 350 - 20 = 330
      expect(parcelasGeradas[0].interest_component).toBe(20);
      expect(parcelasGeradas[0].principal_component).toBe(330);
      expect(resultado.emprestimo.id).toBe('loan-123');
      expect(resultado.emprestimo.institution_name).toBe('Banco do Brasil');
      expect(resultado.parcelas).toHaveLength(3);
    });
  });

  describe('listarPaginaPorUsuario', () => {
    const loanUuid = '11111111-2222-3333-4444-555555555555';

    it('decodifica o cursor, repassa ao repositório e codifica a próxima chave', async () => {
      const chave = { contracted_at: '2026-01-10', created_at: '2026-01-10 09:00:00.5+00', id: loanUuid };
      const proxima = { ...chave, contracted_at: '2025-12-01' };
      vi.mocked(LoanRepository.listarPaginaPorUsuario).mockResolvedValue({ items: [], proxima });

      const res = await LoanBusiness.listarPaginaPorUsuario(1, codificarCursor(chave), 20);

      expect(LoanRepository.listarPaginaPorUsuario).toHaveBeenCalledWith(1, chave, 20);
      expect(decodificarCursor(res.next_cursor as string, ['contracted_at', 'created_at', 'id'])).toEqual(proxima);
    });

    it('rejeita cursor inválido sem consultar o banco', async () => {
      await expect(LoanBusiness.listarPaginaPorUsuario(1, 'lixo', 20)).rejects.toThrow(PaginacaoInvalidaError);
      expect(LoanRepository.listarPaginaPorUsuario).not.toHaveBeenCalled();
    });
  });

  describe('registrarPagamento', () => {
    it('deve retornar não encontrado quando o empréstimo pertence a outro usuário', async () => {
      // Repositório filtra por usuário: empréstimo alheio não é retornado
      vi.mocked(LoanRepository.buscarPorId).mockResolvedValue(undefined);

      await expect(
        LoanBusiness.registrarPagamento({
          loan_id: 'loan-1',
          installment_id: 'inst-1',
          amount_paid: 500,
          payment_method: 'PIX',
        }, 2)
      ).rejects.toThrow('Empréstimo não encontrado.');
      expect(LoanRepository.buscarPorId).toHaveBeenCalledWith('loan-1', 2);
      expect(LoanPaymentRepository.registrarPagamento).not.toHaveBeenCalled();
    });

    const mockLoan: LoanEntity = {
      id: 'loan-1',
      user_id: '00000000-0000-0000-0000-000000000001',
      institution_name: 'Nubank',
      principal_amount: 5000,
      monthly_interest_rate: 1.5,
      status: 'ACTIVE',
      contracted_at: new Date('2026-01-01'),
      usuario_id: 1,
      instituicao: 'Nubank',
      valor_principal: 5000,
      taxa_juros_mensal: 1.5,
      data_contratacao: new Date('2026-01-01'),
    };

    const mockParcela: LoanInstallmentEntity = {
      id: 'inst-1',
      loan_id: 'loan-1',
      installment_number: 1,
      due_date: new Date('2026-02-01'),
      original_amount: 500,
      principal_component: 425,
      interest_component: 75,
      status: 'PENDING',
      emprestimo_id: 'loan-1',
      numero_parcela: 1,
      data_vencimento: new Date('2026-02-01'),
      valor_original: 500,
      valor_amortizacao: 425,
      valor_juros: 75,
    };

    it('deve impedir pagamento de parcela já quitada', async () => {
      vi.mocked(LoanRepository.buscarPorId).mockResolvedValue(mockLoan);
      vi.mocked(LoanRepository.buscarParcelaPorId).mockResolvedValue({
        ...mockParcela,
        status: 'PAID',
      });

      await expect(
        LoanBusiness.registrarPagamento({
          loan_id: 'loan-1',
          installment_id: 'inst-1',
          amount_paid: 500,
          payment_method: 'PIX',
        }, 1)
      ).rejects.toThrow('Esta parcela já foi quitada.');
    });

    it('deve rejeitar pagamento quando valor_pago não bate com a integridade financeira', async () => {
      vi.mocked(LoanRepository.buscarPorId).mockResolvedValue(mockLoan);
      vi.mocked(LoanRepository.buscarParcelaPorId).mockResolvedValue(mockParcela);

      // Esperado: 500 - 50 (desconto) = 450. Passando 400 deve falhar.
      await expect(
        LoanBusiness.registrarPagamento({
          loan_id: 'loan-1',
          installment_id: 'inst-1',
          amount_paid: 400,
          discount_amount: 50,
          payment_method: 'PIX',
        }, 1)
      ).rejects.toThrow(/Inconsistência financeira/);
    });

    it('deve registrar com sucesso pagamento antecipado com desconto', async () => {
      vi.mocked(LoanRepository.buscarPorId).mockResolvedValue(mockLoan);
      vi.mocked(LoanRepository.buscarParcelaPorId).mockResolvedValue(mockParcela);

      const mockResultadoPagamento = {
        pagamento: {
          id: 'pay-1',
          loan_id: 'loan-1',
          installment_id: 'inst-1',
          payment_date: new Date('2026-01-20'),
          amount_paid: 450,
          discount_amount: 50,
          penalty_interest: 0,
          payment_method: 'PIX',
          emprestimo_id: 'loan-1',
          parcela_id: 'inst-1',
          data_pagamento: new Date('2026-01-20'),
          valor_pago: 450,
          valor_desconto: 50,
          multa_juros: 0,
          metodo_pagamento: 'PIX',
        } as LoanPaymentEntity,
        parcela: {
          ...mockParcela,
          status: 'PAID' as const,
        },
      };

      vi.mocked(LoanPaymentRepository.registrarPagamento).mockResolvedValue(
        mockResultadoPagamento
      );

      const res = await LoanBusiness.registrarPagamento({
        loan_id: 'loan-1',
        installment_id: 'inst-1',
        amount_paid: 450,
        discount_amount: 50,
        penalty_interest: 0,
        payment_method: 'PIX',
      }, 1);

      expect(LoanPaymentRepository.registrarPagamento).toHaveBeenCalledWith(
        expect.objectContaining({
          loan_id: 'loan-1',
          installment_id: 'inst-1',
          amount_paid: 450,
          discount_amount: 50,
          penalty_interest: 0,
          payment_method: 'PIX',
        })
      );
      expect(LoanRepository.buscarPorId).toHaveBeenCalledWith('loan-1', 1);
      expect(res.pagamento.amount_paid).toBe(450);
      expect(res.parcela?.status).toBe('PAID');
    });

    it('envia dono e descrição da despesa executada que será gravada em transacoes', async () => {
      vi.mocked(LoanRepository.buscarPorId).mockResolvedValue(mockLoan);
      vi.mocked(LoanRepository.buscarParcelaPorId).mockResolvedValue(mockParcela);
      vi.mocked(LoanPaymentRepository.registrarPagamento).mockResolvedValue({} as any);

      await LoanBusiness.registrarPagamento(
        { loan_id: 'loan-1', installment_id: 'inst-1', amount_paid: 500, payment_method: 'PIX' },
        7
      );

      expect(LoanPaymentRepository.registrarPagamento).toHaveBeenCalledWith(
        expect.objectContaining({
          usuario_id: 7,
          descricao_despesa: 'Parcela Empréstimo #1 - Nubank',
        })
      );
    });

    it('pagamento concorrente da mesma parcela vira erro de validação (sem despesa em dobro)', async () => {
      vi.mocked(LoanRepository.buscarPorId).mockResolvedValue(mockLoan);
      vi.mocked(LoanRepository.buscarParcelaPorId).mockResolvedValue(mockParcela);
      vi.mocked(LoanPaymentRepository.registrarPagamento).mockRejectedValue(new ParcelaJaQuitadaError());

      await expect(
        LoanBusiness.registrarPagamento(
          { loan_id: 'loan-1', installment_id: 'inst-1', amount_paid: 500, payment_method: 'PIX' },
          1
        )
      ).rejects.toThrow(LoanValidationError);
    });
  });

  describe('obterResumo', () => {
    it('deve gerar consolidado correto de desembolso, descontos e saldo devedor restante', async () => {
      const mockLoan: LoanEntity = {
        id: 'loan-10',
        user_id: '00000000-0000-0000-0000-000000000001',
        institution_name: 'Caixa',
        principal_amount: 10000,
        monthly_interest_rate: 1.0,
        status: 'ACTIVE',
        contracted_at: new Date('2026-01-01'),
        usuario_id: 1,
        instituicao: 'Caixa',
        valor_principal: 10000,
        taxa_juros_mensal: 1.0,
        data_contratacao: new Date('2026-01-01'),
      };

      const mockParcelas: LoanInstallmentEntity[] = [
        {
          id: 'p-1',
          loan_id: 'loan-10',
          installment_number: 1,
          due_date: new Date('2026-02-01'),
          original_amount: 1000,
          principal_component: 900,
          interest_component: 100,
          status: 'PAID',
          emprestimo_id: 'loan-10',
          numero_parcela: 1,
          data_vencimento: new Date('2026-02-01'),
          valor_original: 1000,
          valor_amortizacao: 900,
          valor_juros: 100,
        },
        {
          id: 'p-2',
          loan_id: 'loan-10',
          installment_number: 2,
          due_date: new Date('2026-03-01'),
          original_amount: 1000,
          principal_component: 910,
          interest_component: 90,
          status: 'PAID',
          emprestimo_id: 'loan-10',
          numero_parcela: 2,
          data_vencimento: new Date('2026-03-01'),
          valor_original: 1000,
          valor_amortizacao: 910,
          valor_juros: 90,
        },
        {
          id: 'p-3',
          loan_id: 'loan-10',
          installment_number: 3,
          due_date: new Date('2026-04-01'),
          original_amount: 1000,
          principal_component: 920,
          interest_component: 80,
          status: 'PENDING',
          emprestimo_id: 'loan-10',
          numero_parcela: 3,
          data_vencimento: new Date('2026-04-01'),
          valor_original: 1000,
          valor_amortizacao: 920,
          valor_juros: 80,
        },
      ];

      const mockPagamentos: LoanPaymentEntity[] = [
        {
          id: 'pay-1',
          loan_id: 'loan-10',
          installment_id: 'p-1',
          payment_date: new Date('2026-02-01'),
          amount_paid: 1000,
          discount_amount: 0,
          penalty_interest: 0,
          payment_method: 'Boleto',
          emprestimo_id: 'loan-10',
          parcela_id: 'p-1',
          data_pagamento: new Date('2026-02-01'),
          valor_pago: 1000,
          valor_desconto: 0,
          multa_juros: 0,
          metodo_pagamento: 'Boleto',
        },
        {
          id: 'pay-2',
          loan_id: 'loan-10',
          installment_id: 'p-2',
          payment_date: new Date('2026-02-15'),
          amount_paid: 920,
          discount_amount: 80, // economia de juros por antecipação
          penalty_interest: 0,
          payment_method: 'PIX',
          emprestimo_id: 'loan-10',
          parcela_id: 'p-2',
          data_pagamento: new Date('2026-02-15'),
          valor_pago: 920,
          valor_desconto: 80,
          multa_juros: 0,
          metodo_pagamento: 'PIX',
        },
      ];

      vi.mocked(LoanRepository.buscarPorId).mockResolvedValue(mockLoan);
      vi.mocked(LoanRepository.listarParcelas).mockResolvedValue(mockParcelas);
      vi.mocked(LoanPaymentRepository.listarPagamentosPorEmprestimo).mockResolvedValue(mockPagamentos);

      const resumo = await LoanBusiness.obterResumo('loan-10', 1);

      expect(resumo.total_paid).toBe(1920); // 1000 + 920
      expect(resumo.total_discounts).toBe(80); // 0 + 80
      expect(resumo.remaining_balance).toBe(1000); // Parcela 3 pendente
      expect(resumo.installments).toHaveLength(3);

      // Compatibilidade
      expect(resumo.total_desembolsado).toBe(1920);
      expect(resumo.total_descontos).toBe(80);
      expect(resumo.saldo_devedor_restante).toBe(1000);
      expect(resumo.parcelas).toHaveLength(3);
    });

    it('deve lançar LoanNotFoundError caso empréstimo não exista', async () => {
      vi.mocked(LoanRepository.buscarPorId).mockResolvedValue(undefined);

      await expect(LoanBusiness.obterResumo('nao-existe', 1)).rejects.toThrow(
        LoanNotFoundError
      );
    });
  });
});
