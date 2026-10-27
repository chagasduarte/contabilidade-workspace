// forecast.repository.ts
// Camada de acesso a dados otimizada para o Motor de Projeção de Fluxo de Caixa

import { PoolClient } from 'pg';
import { pool } from '../../core/config/database';
import { normalizeUserIdToUuid } from '../loan/loan.repository';
import {
  mapPlannedTransactionEntity,
  PlannedTransactionEntity,
} from '../planned-transaction/planned-transaction.entity';

export interface PendingLoanInstallmentRow {
  id: string;
  installment_number: number;
  original_amount: number;
  due_date: Date;
  institution_name: string;
}

export interface PendingCardInvoiceRow {
  id: string;
  nome_cartao: string;
  mes_referencia: number;
  ano_referencia: number;
  data_vencimento: Date;
  valor_restante: number;
}

export const ForecastRepository = {
  /**
   * Calcula o saldo base consolidado atual a partir de transações pagas.
   */
  async getCurrentBalance(userId: number, client?: PoolClient): Promise<number> {
    const runner = client ?? pool;
    const query = `
      SELECT
        COALESCE(SUM(
          CASE 
            WHEN LOWER(tipo) IN ('entrada', 'receita') THEN valor
            WHEN LOWER(tipo) IN ('saida', 'despesa', 'cartao') THEN -valor
            ELSE 0
          END
        ), 0)::numeric AS current_balance
      FROM transacoes
      WHERE userid = $1 AND LOWER(status) IN ('pago', 'paid', 'settled')
    `;

    const result = await runner.query(query, [userId]);
    return Number(result.rows[0]?.current_balance ?? 0);
  },

  /**
   * Busca transações planejadas pendentes para o usuário.
   * Inclui todas as pendentes que possam ter ocorrências até a data final informada.
   */
  async getPendingPlannedTransactions(
    userId: number,
    dataFim: string,
    client?: PoolClient
  ): Promise<PlannedTransactionEntity[]> {
    const runner = client ?? pool;
    const query = `
      SELECT pt.*, c.nome AS categoria_nome, c.icone AS categoria_icone
      FROM planned_transactions pt
      LEFT JOIN categoria c ON c.id = pt.idcategoria AND (c.userid = pt.userid OR c.userid IS NULL)
      WHERE pt.userid = $1 
        AND pt.status = 'PENDING'
        AND (pt.data_prevista <= $2::date OR pt.recorrencia != 'NONE')
      ORDER BY pt.data_prevista ASC
    `;

    try {
      const result = await runner.query(query, [userId, dataFim]);
      return result.rows.map(mapPlannedTransactionEntity);
    } catch (err) {
      console.warn('[ForecastRepository] Aviso ao buscar planned_transactions:', err);
      return [];
    }
  },

  /**
   * Busca parcelas de empréstimo pendentes com vencimento no horizonte de projeção.
   */
  async getPendingLoanInstallments(
    userId: number,
    dataInicio: string,
    dataFim: string,
    client?: PoolClient
  ): Promise<PendingLoanInstallmentRow[]> {
    const runner = client ?? pool;
    const userUuid = normalizeUserIdToUuid(userId);

    const query = `
      SELECT 
        li.id,
        li.installment_number,
        li.original_amount,
        li.due_date,
        l.institution_name
      FROM loan_installments li
      INNER JOIN loans l ON l.id = li.loan_id
      -- loans.user_id é VARCHAR: comparar com ::uuid gerava erro e o forecast nunca trazia empréstimos
      WHERE l.user_id IN ($1, $2)
        AND li.status = 'PENDING'
        AND li.due_date >= $3::date
        AND li.due_date <= $4::date
      ORDER BY li.due_date ASC
    `;

    try {
      const result = await runner.query(query, [userUuid, String(userId), dataInicio, dataFim]);
      return result.rows.map((r) => ({
        id: String(r.id),
        installment_number: Number(r.installment_number),
        original_amount: Number(r.original_amount),
        due_date: r.due_date instanceof Date ? r.due_date : new Date(String(r.due_date)),
        institution_name: String(r.institution_name ?? ''),
      }));
    } catch (err) {
      console.warn('[ForecastRepository] Aviso ao buscar loan_installments:', err);
      return [];
    }
  },

  /**
   * Busca faturas de cartão de crédito pendentes/abertas com vencimento no horizonte projetado.
   */
  async getPendingCardInvoices(
    userId: number,
    dataInicio: string,
    dataFim: string,
    client?: PoolClient
  ): Promise<PendingCardInvoiceRow[]> {
    const runner = client ?? pool;
    const query = `
      SELECT 
        ci.id,
        c.nome AS nome_cartao,
        ci.mes_referencia,
        ci.ano_referencia,
        ci.data_vencimento,
        (COALESCE(SUM(ii.valor_parcela), 0) - COALESCE(ci.valor_pago, 0))::numeric AS valor_restante
      FROM card_invoices ci
      INNER JOIN credit_cards c ON c.id = ci.cartao_id
      LEFT JOIN invoice_items ii ON ii.fatura_id = ci.id
      WHERE c.usuario_id = $1
        AND ci.status != 'PAID'
        AND ci.data_vencimento >= $2::date
        AND ci.data_vencimento <= $3::date
      GROUP BY ci.id, c.nome, ci.mes_referencia, ci.ano_referencia, ci.data_vencimento, ci.valor_pago
      HAVING (COALESCE(SUM(ii.valor_parcela), 0) - COALESCE(ci.valor_pago, 0)) > 0
      ORDER BY ci.data_vencimento ASC
    `;

    try {
      const result = await runner.query(query, [userId, dataInicio, dataFim]);
      return result.rows.map((r) => ({
        id: String(r.id),
        nome_cartao: String(r.nome_cartao),
        mes_referencia: Number(r.mes_referencia),
        ano_referencia: Number(r.ano_referencia),
        data_vencimento: r.data_vencimento instanceof Date ? r.data_vencimento : new Date(String(r.data_vencimento)),
        valor_restante: Number(r.valor_restante),
      }));
    } catch (err) {
      console.warn('[ForecastRepository] Aviso ao buscar card_invoices:', err);
      return [];
    }
  },
};

