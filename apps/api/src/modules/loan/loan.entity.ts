// loan.entity.ts

export type LoanStatus = 'ACTIVE' | 'PAID_OFF' | 'DEFAULTED';
export type InstallmentStatus = 'PENDING' | 'PAID' | 'PARTIALLY_PAID';

/**
 * 1. O Contrato de Empréstimo (loans)
 */
export interface LoanEntity {
  id: string;
  user_id: string;
  institution_name: string;
  principal_amount: number;
  monthly_interest_rate: number;
  status: LoanStatus;
  contracted_at: Date;
  created_at?: Date;

  // Aliases para compatibilidade total
  usuario_id: number | string;
  instituicao: string;
  valor_principal: number;
  taxa_juros_mensal: number;
  data_contratacao: Date;
  criado_em?: Date;
}

/**
 * 2. Cronograma de Parcelas Previstas (loan_installments)
 */
export interface LoanInstallmentEntity {
  id: string;
  loan_id: string;
  installment_number: number;
  due_date: Date;
  original_amount: number;
  principal_component: number;
  interest_component: number;
  status: InstallmentStatus;
  created_at?: Date;

  // Aliases para compatibilidade
  emprestimo_id: string;
  numero_parcela: number;
  data_vencimento: Date;
  valor_original: number;
  valor_amortizacao: number;
  valor_juros: number;
  criado_em?: Date;
}

/**
 * 3. Transações de Pagamento e Liquidação (loan_payments)
 */
export interface LoanPaymentEntity {
  id: string;
  loan_id: string;
  installment_id?: string | null;
  payment_date: Date;
  amount_paid: number;
  discount_amount: number;
  penalty_interest: number;
  payment_method: string;
  created_at?: Date;

  // Aliases para compatibilidade
  emprestimo_id: string;
  parcela_id?: string | null;
  data_pagamento: Date;
  valor_pago: number;
  valor_desconto: number;
  multa_juros: number;
  metodo_pagamento: string;
  criado_em?: Date;
}