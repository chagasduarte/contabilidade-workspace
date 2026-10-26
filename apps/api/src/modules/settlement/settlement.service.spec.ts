// settlement.service.spec.ts
// Testes unitários para a camada de Efetivação / Liquidação com Vitest

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SettlementService,
  SettlementValidationError,
  SettlementNotFoundError,
  SettlementConflictError,
} from './settlement.service';
import { SettlementRepository } from './settlement.repository';
import { CategoriaBusiness } from '../categoria/categoria.business';

vi.mock('../categoria/categoria.business', () => ({
  CategoriaBusiness: {
    categoriaVisivel: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('./settlement.repository', () => ({
  SettlementRepository: {
    settlePlannedTransaction: vi.fn(),
    settleLoanInstallment: vi.fn(),
  },
  SettlementValidationError: class extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = 'SettlementValidationError';
    }
  },
  SettlementNotFoundError: class extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = 'SettlementNotFoundError';
    }
  },
  SettlementConflictError: class extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = 'SettlementConflictError';
    }
  },
}));

describe('SettlementService', () => {
  const validUuid = '123e4567-e89b-12d3-a456-426614174000';
  const mockUserId = 10;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('settlePlannedTransaction', () => {
    it('deve rejeitar idcategoria de categoria não visível ao usuário sem efetivar', async () => {
      vi.mocked(CategoriaBusiness.categoriaVisivel).mockResolvedValueOnce(false);

      await expect(
        SettlementService.settlePlannedTransaction(validUuid, { idcategoria: 77 }, mockUserId)
      ).rejects.toThrow(SettlementValidationError);
      expect(CategoriaBusiness.categoriaVisivel).toHaveBeenCalledWith(77, mockUserId);
      expect(SettlementRepository.settlePlannedTransaction).not.toHaveBeenCalled();
    });

    it('deve rejeitar se o id não for um UUID válido', async () => {
      await expect(
        SettlementService.settlePlannedTransaction('id-invalido', {}, mockUserId)
      ).rejects.toThrow(SettlementValidationError);
      await expect(
        SettlementService.settlePlannedTransaction('id-invalido', {}, mockUserId)
      ).rejects.toThrow('ID da transação planejada deve ser um UUID válido.');
    });

    it('deve rejeitar se userId for inválido', async () => {
      await expect(
        SettlementService.settlePlannedTransaction(validUuid, {}, 0)
      ).rejects.toThrow(SettlementValidationError);
    });

    it('deve rejeitar se valor_pago for menor ou igual a zero', async () => {
      await expect(
        SettlementService.settlePlannedTransaction(validUuid, { valor_pago: -10 }, mockUserId)
      ).rejects.toThrow('O valor pago deve ser um número positivo maior que zero.');

      await expect(
        SettlementService.settlePlannedTransaction(validUuid, { valor_pago: 0 }, mockUserId)
      ).rejects.toThrow('O valor pago deve ser um número positivo maior que zero.');
    });

    it('deve rejeitar se data_pagamento for uma data inválida', async () => {
      await expect(
        SettlementService.settlePlannedTransaction(
          validUuid,
          { data_pagamento: 'data-invalida' },
          mockUserId
        )
      ).rejects.toThrow('A data de pagamento informada é inválida.');
    });

    it('deve efetivar transação planejada com sucesso', async () => {
      const mockResult = {
        success: true,
        message: 'Transação planejada efetivada com sucesso.',
        transacao: {
          id: 101,
          tipo: 'DESPESA' as any,
          descricao: 'Conta de Energia',
          valor: 150.0,
          data: new Date('2026-11-10'),
          status: 'pago' as const,
          userid: mockUserId,
          source_type: 'PLANNED',
          source_id: validUuid,
        },
        planned_transaction: {
          id: validUuid,
          userid: mockUserId,
          descricao: 'Conta de Energia',
          tipo: 'DESPESA' as const,
          valor: 150.0,
          data_prevista: new Date('2026-11-10'),
          recorrencia: 'NONE' as const,
          status: 'SETTLED' as const,
        },
      };

      vi.mocked(SettlementRepository.settlePlannedTransaction).mockResolvedValue(mockResult);

      const dto = { valor_pago: 150.0, data_pagamento: '2026-11-10' };
      const resultado = await SettlementService.settlePlannedTransaction(validUuid, dto, mockUserId);

      expect(SettlementRepository.settlePlannedTransaction).toHaveBeenCalledWith(
        validUuid,
        dto,
        mockUserId
      );
      expect(resultado.success).toBe(true);
      expect(resultado.transacao.source_type).toBe('PLANNED');
      expect(resultado.planned_transaction.status).toBe('SETTLED');
    });

    it('deve propagar SettlementConflictError se status for diferente de PENDING', async () => {
      vi.mocked(SettlementRepository.settlePlannedTransaction).mockRejectedValue(
        new SettlementConflictError("Apenas transações planejadas com status 'PENDING' podem ser efetivadas.")
      );

      await expect(
        SettlementService.settlePlannedTransaction(validUuid, {}, mockUserId)
      ).rejects.toThrow(SettlementConflictError);
    });

    it('deve propagar SettlementNotFoundError se transação não for encontrada', async () => {
      vi.mocked(SettlementRepository.settlePlannedTransaction).mockRejectedValue(
        new SettlementNotFoundError('Transação planejada não encontrada.')
      );

      await expect(
        SettlementService.settlePlannedTransaction(validUuid, {}, mockUserId)
      ).rejects.toThrow(SettlementNotFoundError);
    });
  });

  describe('settleLoanInstallment', () => {
    it('deve rejeitar idcategoria de categoria não visível ao usuário sem liquidar', async () => {
      vi.mocked(CategoriaBusiness.categoriaVisivel).mockResolvedValueOnce(false);

      await expect(
        SettlementService.settleLoanInstallment(validUuid, { idcategoria: 77 }, mockUserId)
      ).rejects.toThrow('Categoria não encontrada.');
      expect(SettlementRepository.settleLoanInstallment).not.toHaveBeenCalled();
    });

    it('deve rejeitar se o installmentId não for um UUID válido', async () => {
      await expect(
        SettlementService.settleLoanInstallment('id-invalido', {}, mockUserId)
      ).rejects.toThrow(SettlementValidationError);
      await expect(
        SettlementService.settleLoanInstallment('id-invalido', {}, mockUserId)
      ).rejects.toThrow('ID da parcela deve ser um UUID válido.');
    });

    it('deve rejeitar se userId for inválido', async () => {
      await expect(
        SettlementService.settleLoanInstallment(validUuid, {}, 0)
      ).rejects.toThrow(SettlementValidationError);
    });

    it('deve rejeitar se valor_pago for menor ou igual a zero', async () => {
      await expect(
        SettlementService.settleLoanInstallment(validUuid, { valor_pago: -50 }, mockUserId)
      ).rejects.toThrow('O valor pago deve ser um número positivo maior que zero.');
    });

    it('deve liquidar parcela de empréstimo com sucesso', async () => {
      const mockResult = {
        success: true,
        message: 'Parcela de empréstimo liquidada com sucesso.',
        transacao: {
          id: 202,
          tipo: 'DESPESA' as any,
          descricao: 'Parcela Empréstimo #1 - Banco Inter',
          valor: 450.0,
          data: new Date('2026-11-15'),
          status: 'pago' as const,
          userid: mockUserId,
          source_type: 'LOAN_INSTALLMENT',
          source_id: validUuid,
        },
        installment: {
          id: validUuid,
          loan_id: 'loan-uuid-123',
          installment_number: 1,
          due_date: new Date('2026-11-15'),
          original_amount: 450.0,
          principal_component: 400.0,
          interest_component: 50.0,
          status: 'PAID' as const,
          emprestimo_id: 'loan-uuid-123',
          numero_parcela: 1,
          data_vencimento: new Date('2026-11-15'),
          valor_original: 450.0,
          valor_amortizacao: 400.0,
          valor_juros: 50.0,
        },
        loan_paid_off: false,
      };

      vi.mocked(SettlementRepository.settleLoanInstallment).mockResolvedValue(mockResult);

      const dto = { valor_pago: 450.0 };
      const resultado = await SettlementService.settleLoanInstallment(validUuid, dto, mockUserId);

      expect(SettlementRepository.settleLoanInstallment).toHaveBeenCalledWith(
        validUuid,
        dto,
        mockUserId
      );
      expect(resultado.success).toBe(true);
      expect(resultado.transacao.source_type).toBe('LOAN_INSTALLMENT');
      expect(resultado.installment.status).toBe('PAID');
    });

    it('deve propagar SettlementConflictError se parcela já foi paga', async () => {
      vi.mocked(SettlementRepository.settleLoanInstallment).mockRejectedValue(
        new SettlementConflictError("Apenas parcelas com status 'PENDING' podem ser liquidadas.")
      );

      await expect(
        SettlementService.settleLoanInstallment(validUuid, {}, mockUserId)
      ).rejects.toThrow(SettlementConflictError);
    });

    it('deve propagar SettlementNotFoundError se parcela não pertencer ao usuário', async () => {
      vi.mocked(SettlementRepository.settleLoanInstallment).mockRejectedValue(
        new SettlementNotFoundError('Parcela de empréstimo não encontrada.')
      );

      await expect(
        SettlementService.settleLoanInstallment(validUuid, {}, mockUserId)
      ).rejects.toThrow(SettlementNotFoundError);
    });
  });
});

