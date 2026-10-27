// settlement.service.ts
// Casos de uso e validações para a camada de Efetivação / Liquidação

import { CategoriaBusiness } from '../categoria/categoria.business';
import {
  SettleLoanInstallmentDto,
  SettleLoanInstallmentResponseDto,
  SettlePlannedTransactionDto,
  SettlePlannedTransactionResponseDto,
} from './settlement.dto';
import {
  SettlementConflictError,
  SettlementNotFoundError,
  SettlementRepository,
  SettlementValidationError,
} from './settlement.repository';
import { PlannedTransactionBusiness } from '../planned-transaction/planned-transaction.business';

function isUuid(val: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

function isValidDate(val: unknown): boolean {
  if (!val) return false;
  if (val instanceof Date) return !isNaN(val.getTime());
  const d = new Date(String(val));
  return !isNaN(d.getTime());
}

/** A categoria informada na efetivação precisa ser visível ao usuário (dele ou global). */
async function validarCategoria(idcategoria: number | null | undefined, userId: number): Promise<void> {
  if (idcategoria === undefined || idcategoria === null) return;
  if (!(await CategoriaBusiness.categoriaVisivel(idcategoria, userId))) {
    throw new SettlementValidationError('Categoria não encontrada.');
  }
}

export const SettlementService = {
  /**
   * Efetiva o pagamento ou recebimento de uma transação planejada.
   */
  async settlePlannedTransaction(
    id: string,
    dto: SettlePlannedTransactionDto,
    userId: number
  ): Promise<SettlePlannedTransactionResponseDto> {
    if (!id || typeof id !== 'string' || !isUuid(id.trim())) {
      throw new SettlementValidationError('ID da transação planejada deve ser um UUID válido.');
    }

    if (!userId || isNaN(Number(userId))) {
      throw new SettlementValidationError('Identificação do usuário (userId) inválida.');
    }

    if (dto.valor_pago !== undefined && dto.valor_pago !== null) {
      const v = Number(dto.valor_pago);
      if (isNaN(v) || v <= 0) {
        throw new SettlementValidationError('O valor pago deve ser um número positivo maior que zero.');
      }
    }

    if (dto.data_pagamento !== undefined && dto.data_pagamento !== null && !isValidDate(dto.data_pagamento)) {
      throw new SettlementValidationError('A data de pagamento informada é inválida.');
    }

    if (dto.idcategoria !== undefined && dto.idcategoria !== null && isNaN(Number(dto.idcategoria))) {
      throw new SettlementValidationError('ID da categoria deve ser um número válido.');
    }
    await validarCategoria(dto.idcategoria, userId);

    const resultado = await SettlementRepository.settlePlannedTransaction(id.trim(), dto, userId);

    // Avança a janela deslizante de recorrências automaticamente
    try {
      await PlannedTransactionBusiness.ensureRollingWindow(userId, 3);
    } catch (err) {
      console.warn('[SettlementService] Erro ao atualizar ensureRollingWindow pós-liquidação:', err);
    }

    return resultado;
  },

  /**
   * Efetiva a liquidação de uma parcela de empréstimo.
   */
  async settleLoanInstallment(
    installmentId: string,
    dto: SettleLoanInstallmentDto,
    userId: number
  ): Promise<SettleLoanInstallmentResponseDto> {
    if (!installmentId || typeof installmentId !== 'string' || !isUuid(installmentId.trim())) {
      throw new SettlementValidationError('ID da parcela deve ser um UUID válido.');
    }

    if (!userId || isNaN(Number(userId))) {
      throw new SettlementValidationError('Identificação do usuário (userId) inválida.');
    }

    if (dto.valor_pago !== undefined && dto.valor_pago !== null) {
      const v = Number(dto.valor_pago);
      if (isNaN(v) || v <= 0) {
        throw new SettlementValidationError('O valor pago deve ser um número positivo maior que zero.');
      }
    }

    if (dto.data_pagamento !== undefined && dto.data_pagamento !== null && !isValidDate(dto.data_pagamento)) {
      throw new SettlementValidationError('A data de pagamento informada é inválida.');
    }

    if (dto.idcategoria !== undefined && dto.idcategoria !== null && isNaN(Number(dto.idcategoria))) {
      throw new SettlementValidationError('ID da categoria deve ser um número válido.');
    }
    await validarCategoria(dto.idcategoria, userId);

    return SettlementRepository.settleLoanInstallment(installmentId.trim(), dto, userId);
  },
};

export { SettlementValidationError, SettlementNotFoundError, SettlementConflictError };

