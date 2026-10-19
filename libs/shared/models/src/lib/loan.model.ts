export type LoanStatus = 'ACTIVE' | 'PAID_OFF' | 'DEFAULTED';
export type InstallmentStatus = 'PENDING' | 'PAID' | 'PARTIALLY_PAID';

/**
 * 1. O Contrato de Empréstimo (loans)
 */
export interface Loan {
  id: string;
  user_id: string;
  institution_name: string;
  principal_amount: number;
  monthly_interest_rate: number;
  status: LoanStatus;
  contracted_at: Date | string;
  created_at?: Date | string;

  // Aliases para compatibilidade total entre convenções
  usuario_id: number | string;
  instituicao: string;
  valor_principal: number;
  taxa_juros_mensal: number;
  data_contratacao: Date | string;
  criado_em?: Date | string;
}

/**
 * 2. Cronograma de Parcelas Previstas (loan_installments)
 */
export interface LoanInstallment {
  id: string;
  loan_id: string;
  installment_number: number;
  due_date: Date | string;
  original_amount: number;
  principal_component: number;
  interest_component: number;
  status: InstallmentStatus;
  created_at?: Date | string;

  // Aliases para compatibilidade
  emprestimo_id: string;
  numero_parcela: number;
  data_vencimento: Date | string;
  valor_original: number;
  valor_amortizacao: number;
  valor_juros: number;
  criado_em?: Date | string;
}

/**
 * 3. Transações de Pagamento e Liquidação (loan_payments)
 */
export interface LoanPayment {
  id: string;
  loan_id: string;
  installment_id?: string | null;
  payment_date: Date | string;
  amount_paid: number;
  discount_amount: number;
  penalty_interest: number;
  payment_method: string;
  created_at?: Date | string;

  // Aliases para compatibilidade
  emprestimo_id: string;
  parcela_id?: string | null;
  data_pagamento: Date | string;
  valor_pago: number;
  valor_desconto: number;
  multa_juros: number;
  metodo_pagamento: string;
  criado_em?: Date | string;
}

/**
 * Resumo consolidado do empréstimo
 */
export interface LoanSummary {
  loan: Loan;
  installments: LoanInstallment[];
  total_paid: number;
  total_discounts: number;
  remaining_balance: number;

  // Aliases para retrocompatibilidade
  emprestimo: Loan;
  parcelas: LoanInstallment[];
  total_desembolsado: number;
  total_descontos: number;
  saldo_devedor_restante: number;
}

/**
 * Payload para efetivar pagamento / amortização
 */
export interface PaymentPayload {
  loan_id?: string;
  installment_id?: string;
  amount_paid?: number;
  discount_amount?: number;
  penalty_interest?: number;
  payment_method?: string;
  payment_date?: string;

  // Aliases
  emprestimo_id?: string;
  parcela_id?: string;
  valor_pago?: number;
  valor_desconto?: number;
  multa_juros?: number;
  metodo_pagamento?: string;
  data_pagamento?: string;
}

/**
 * Payload para criação de empréstimo e cronograma
 */
export interface CreateLoanPayload {
  user_id?: string;
  institution_name?: string;
  principal_amount?: number;
  monthly_interest_rate?: number;
  total_installments?: number;
  installment_amount?: number;
  first_due_date?: string;

  // Aliases
  usuario_id?: number | string;
  instituicao?: string;
  valor_principal?: number;
  taxa_juros_mensal?: number;
  quantidade_parcelas?: number;
  valor_parcela?: number;
  primeiro_vencimento?: string;
}

// Aliases para compatibilidade total entre convenções de nomenclatura
export type LoanEntity = Loan;
export type LoanInstallmentEntity = LoanInstallment;
export type LoanPaymentEntity = LoanPayment;
export type LoanSummaryDto = LoanSummary;
export type RegisterPaymentDto = PaymentPayload;
export type CreateLoanDto = CreateLoanPayload;
