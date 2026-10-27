// forecast.model.ts
// Tipagens e DTOs para o Motor de Projeção de Fluxo de Caixa e Liquidação

export type ForecastEventType = 'RECEITA' | 'DESPESA';
export type ForecastEventOrigin = 'PLANNED' | 'LOAN' | 'CREDIT_CARD';

/**
 * Parâmetros de consulta para o motor de projeção de fluxo de caixa.
 */
export interface ForecastQueryDto {
  months?: number; // Padrão: 3, Mínimo: 1, Máximo: 24
  targetExpenseAmount?: number; // Valor de compra simulada (ex: 2500)
  targetExpenseDate?: string | Date; // Data da compra simulada (ex: 2026-12-15)
}

/**
 * Evento financeiro individual na linha do tempo projetada.
 */
export interface ForecastTimelineEventDto {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  type: ForecastEventType;
  origin: ForecastEventOrigin;
  originId: string;
  /** Preenchidos para PLANNED; `null` para LOAN e CREDIT_CARD. */
  idcategoria?: number | null;
  categoria_nome?: string | null;
}

/**
 * Ponto diário do saldo projetado.
 */
export interface DailyForecastPointDto {
  date: string; // YYYY-MM-DD
  totalIncome: number;
  totalExpense: number;
  projectedBalance: number;
}

/**
 * Resumo consolidado mês a mês.
 */
export interface MonthlyForecastSummaryDto {
  month: string; // YYYY-MM
  initialBalance: number;
  totalIncome: number;
  totalExpense: number;
  finalBalance: number;
  minimumBalance: number; // Menor saldo atingido no mês
}

/**
 * Resultado da simulação de compra/meta financeira (Safe to Spend).
 */
export interface ForecastSimulationResultDto {
  isAffordable: boolean;
  projectedBalanceAtTargetDate: number;
  remainingMarginAfterTarget: number;
  targetAmount: number;
  targetDate: string;
}

/**
 * Resposta completa do motor de projeção.
 */
export interface ForecastResponseDto {
  currentBalance: number;
  finalProjectedBalance: number;
  minimumProjectedBalance: number;
  safeToSpendToday: number;
  simulationResult?: ForecastSimulationResultDto;
  monthlySummaries: MonthlyForecastSummaryDto[];
  events: ForecastTimelineEventDto[];
  dailyPoints?: DailyForecastPointDto[];
}

/**
 * DTO para efetivação / liquidação de transação planejada.
 */
export interface SettlePlannedTransactionDto {
  valor_pago?: number;
  data_pagamento?: string | Date;
  idcategoria?: number | null;
  descricao?: string;
}

/**
 * DTO para efetivação / liquidação de parcela de empréstimo.
 */
export interface SettleLoanInstallmentDto {
  valor_pago?: number;
  data_pagamento?: string | Date;
  idcategoria?: number | null;
  descricao?: string;
}

/**
 * Resposta da liquidação de transação planejada.
 */
export interface SettlePlannedTransactionResponseDto {
  success: boolean;
  message: string;
  transacao: unknown;
  planned_transaction: unknown;
}

/**
 * Resposta da liquidação de parcela de empréstimo.
 */
export interface SettleLoanInstallmentResponseDto {
  success: boolean;
  message: string;
  transacao: unknown;
  installment: unknown;
  loan_paid_off: boolean;
}

