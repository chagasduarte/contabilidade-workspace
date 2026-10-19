// loan.dto.ts

import { LoanEntity, LoanInstallmentEntity } from "./loan.entity";

export interface CreateLoanDto {
  user_id?: string;
  institution_name: string;
  principal_amount: number;
  monthly_interest_rate: number;
  total_installments?: number;
  installment_amount?: number;
  first_due_date?: string; // formato YYYY-MM-DD

  // Aliases aceitos para compatibilidade
  usuario_id?: number | string;
  instituicao?: string;
  valor_principal?: number;
  taxa_juros_mensal?: number;
  quantidade_parcelas?: number;
  valor_parcela?: number;
  primeiro_vencimento?: string;
}

export interface RegisterPaymentDto {
  loan_id: string;
  installment_id: string;
  amount_paid: number;
  discount_amount?: number;
  penalty_interest?: number;
  payment_method: string;
  payment_date?: string; // YYYY-MM-DD

  // Aliases aceitos para compatibilidade
  emprestimo_id?: string;
  parcela_id?: string;
  valor_pago?: number;
  valor_desconto?: number;
  multa_juros?: number;
  metodo_pagamento?: string;
  data_pagamento?: string;
}

export interface LoanSummaryDto {
  loan: LoanEntity;
  installments: LoanInstallmentEntity[];
  total_paid: number;
  total_discounts: number;
  remaining_balance: number;

  // Aliases aceitos para compatibilidade
  emprestimo: LoanEntity;
  parcelas: LoanInstallmentEntity[];
  total_desembolsado: number;
  total_descontos: number;
  saldo_devedor_restante: number;
}