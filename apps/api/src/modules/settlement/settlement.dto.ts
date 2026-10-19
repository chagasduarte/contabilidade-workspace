// settlement.dto.ts
// DTOs para a camada de liquidação/efetivação de obrigações pendentes

import { PlannedTransactionEntity } from '../planned-transaction/planned-transaction.entity';
import { LoanInstallmentEntity } from '../loan/loan.entity';
import { TransacaoEntity } from '../transacao/transacao.types';

/**
 * Payload para efetivar uma transação planejada.
 */
export interface SettlePlannedTransactionDto {
  valor_pago?: number;
  data_pagamento?: string | Date;
  idcategoria?: number | null;
  descricao?: string;
}

/**
 * Payload para efetivar uma parcela de empréstimo.
 */
export interface SettleLoanInstallmentDto {
  valor_pago?: number;
  data_pagamento?: string | Date;
  idcategoria?: number | null;
  descricao?: string;
}

/**
 * Resposta de liquidação de transação planejada.
 */
export interface SettlePlannedTransactionResponseDto {
  success: boolean;
  message: string;
  transacao: TransacaoEntity;
  planned_transaction: PlannedTransactionEntity;
}

/**
 * Resposta de liquidação de parcela de empréstimo.
 */
export interface SettleLoanInstallmentResponseDto {
  success: boolean;
  message: string;
  transacao: TransacaoEntity;
  installment: LoanInstallmentEntity;
  loan_paid_off: boolean;
}

