import { pool } from '../../core/config/database';
import { TransacaoEntity } from '../transacao/transacao.types';
import { ProjecaoMensalDto, AgrupamentoCategoriaDto, DashboardDespesaItemDto } from './dashboard.types';
import { normalizeUserIdToUuid } from '../loan/loan.repository';

export interface PlannedItemRow {
  id: string;
  descricao: string;
  tipo: string;
  valor: number;
  data_prevista: string;
  status: string;
  categoria_nome?: string;
  recorrencia?: 'NONE' | 'MENSAL' | 'SEMANAL' | 'ANUAL';
  parent_recurrence_id?: string | null;
}

export interface LoanInstallmentRow {
  id: string;
  installment_number: number;
  valor: number;
  due_date: string;
  status: string;
  institution_name: string;
}

export interface CardInvoiceRow {
  id: string;
  nome_cartao: string;
  mes_referencia: number;
  ano_referencia: number;
  data_vencimento: string;
  valor_restante: number;
}

export const DashboardRepository = {
  /**
   * Saldo atual em conta corrente: apenas transações que já foram liquidadas/pagas.
   */
  async getSaldoAtual(mes: number, ano: number, userid: number): Promise<number> {
    try {
      const query = `
        SELECT
          COALESCE(SUM(
            CASE 
              WHEN LOWER(tipo) IN ('entrada', 'receita') THEN valor
              WHEN LOWER(tipo) IN ('saida', 'despesa', 'cartao') THEN -valor
              ELSE 0
            END
          ), 0)::numeric AS saldo_atual
        FROM transacoes
        WHERE LOWER(status) IN ('pago', 'paid', 'settled')
          AND (
            EXTRACT(YEAR FROM data) < $2
            OR (EXTRACT(YEAR FROM data) = $2 AND EXTRACT(MONTH FROM data) <= $1)
          )
          AND userid = $3;
      `;
      const { rows } = await pool.query<{ saldo_atual: string | number | null }>(query, [mes, ano, userid]);
      return Number(rows[0]?.saldo_atual || 0);
    } catch (err) {
      console.warn('[DashboardRepository] Erro ao obter saldo atual:', err);
      return 0;
    }
  },

  async getSaldoAcumulado(data_fim: string, userid: number): Promise<number> {
    try {
      const query = `
        SELECT COALESCE(SUM(
          CASE 
            WHEN LOWER(tipo) IN ('entrada', 'receita') THEN valor
            WHEN LOWER(tipo) IN ('saida', 'despesa') THEN -valor
            ELSE 0
          END
        ), 0)::numeric AS total
        FROM transacoes
        WHERE userid = $1
          AND pagamento <= $2
      `;
      const total = await pool.query<{ total: string | number | null }>(query, [userid, data_fim]);
      return Number(total.rows[0]?.total || 0);
    } catch (err) {
      console.warn('[DashboardRepository] Erro ao obter saldo acumulado:', err);
      return 0;
    }
  },

  /**
   * Transações da conta corrente do mês especificado (pagas e pendentes).
   */
  async getTransacoesMes(
    mes: number,
    ano: number,
    userid: number
  ): Promise<TransacaoEntity[]> {
    try {
      const query = `
        SELECT 
          t.id, 
          t.descricao, 
          t.tipo, 
          t.valor, 
          COALESCE(c.nome, CAST(t.categoria AS VARCHAR), 'Geral') AS categoria, 
          TO_CHAR(t.data::date, 'YYYY-MM-DD') AS data, 
          t.status, 
          t.cartaoid, 
          t.pagamento,
          t.data_criacao AS criado_em,
          t.data_criacao AS created_at
        FROM transacoes t
        LEFT JOIN categoria c ON c.id = t.idcategoria
        WHERE t.userid = $1
          AND EXTRACT(MONTH FROM t.data) = $2
          AND EXTRACT(YEAR FROM t.data) = $3
        ORDER BY t.data DESC, t.id DESC
      `;
      const { rows } = await pool.query<TransacaoEntity>(query, [userid, mes, ano]);
      return rows;
    } catch (err) {
      console.warn('[DashboardRepository] Erro ao obter transações do mês:', err);
      return [];
    }
  },

  /**
   * Despesas e receitas pendentes da tabela planned_transactions para o mês.
   */
  async getPlannedTransactionsMes(
    mes: number,
    ano: number,
    userid: number
  ): Promise<PlannedItemRow[]> {
    const query = `
      SELECT 
        pt.id,
        COALESCE(pt.descricao, '') AS descricao,
        pt.tipo,
        pt.valor::numeric AS valor,
        TO_CHAR(pt.data_prevista, 'YYYY-MM-DD') AS data_prevista,
        pt.status,
        c.nome AS categoria_nome,
        pt.recorrencia,
        pt.parent_recurrence_id
      FROM planned_transactions pt
      LEFT JOIN categoria c ON c.id = pt.idcategoria
      WHERE pt.userid = $1
        AND pt.status = 'PENDING'
        AND EXTRACT(MONTH FROM pt.data_prevista) = $2
        AND EXTRACT(YEAR FROM pt.data_prevista) = $3
      ORDER BY pt.data_prevista ASC
    `;
    try {
      const { rows } = await pool.query<PlannedItemRow>(query, [userid, mes, ano]);
      return rows.map((r) => ({
        ...r,
        valor: Number(r.valor),
      }));
    } catch (err) {
      console.warn('[DashboardRepository] Aviso ao consultar planned_transactions:', err);
      return [];
    }
  },

  /**
   * Parcelas de empréstimos pendentes para o mês com vencimento (due_date) no período.
   */
  async getLoanInstallmentsMes(
    mes: number,
    ano: number,
    userid: number
  ): Promise<LoanInstallmentRow[]> {
    const userUuid = normalizeUserIdToUuid(userid);
    const query = `
      SELECT 
        li.id,
        li.installment_number,
        li.original_amount::numeric AS valor,
        TO_CHAR(li.due_date::date, 'YYYY-MM-DD') AS due_date,
        li.status,
        l.institution_name
      FROM loan_installments li
      INNER JOIN loans l ON l.id = li.loan_id
      WHERE l.user_id IN ($1, $2)
        AND li.status = 'PENDING'
        AND EXTRACT(MONTH FROM li.due_date) = $3
        AND EXTRACT(YEAR FROM li.due_date) = $4
      ORDER BY li.due_date ASC
    `;
    try {
      const { rows } = await pool.query<LoanInstallmentRow>(query, [userUuid, String(userid), mes, ano]);
      return rows.map((r) => ({
        ...r,
        installment_number: Number(r.installment_number),
        valor: Number(r.valor),
      }));
    } catch (err) {
      console.warn('[DashboardRepository] Aviso ao consultar loan_installments:', err);
      return [];
    }
  },

  /**
   * Faturas de cartão de crédito pendentes com vencimento ou referência no mês.
   */
  async getCardInvoicesMes(
    mes: number,
    ano: number,
    userid: number
  ): Promise<CardInvoiceRow[]> {
    const query = `
      SELECT 
        ci.id,
        c.nome AS nome_cartao,
        ci.mes_referencia,
        ci.ano_referencia,
        TO_CHAR(ci.data_vencimento::date, 'YYYY-MM-DD') AS data_vencimento,
        (COALESCE(SUM(ii.valor_parcela), 0) - COALESCE(ci.valor_pago, 0))::numeric AS valor_restante
      FROM card_invoices ci
      INNER JOIN credit_cards c ON c.id = ci.cartao_id
      LEFT JOIN invoice_items ii ON ii.fatura_id = ci.id
      WHERE c.usuario_id = $1
        AND ci.status != 'PAID'
        AND (
          (EXTRACT(MONTH FROM ci.data_vencimento) = $2 AND EXTRACT(YEAR FROM ci.data_vencimento) = $3)
          OR (ci.mes_referencia = $2 AND ci.ano_referencia = $3)
        )
      GROUP BY ci.id, c.nome, ci.mes_referencia, ci.ano_referencia, ci.data_vencimento, ci.valor_pago
      HAVING (COALESCE(SUM(ii.valor_parcela), 0) - COALESCE(ci.valor_pago, 0)) > 0
      ORDER BY ci.data_vencimento ASC
    `;
    try {
      const { rows } = await pool.query<CardInvoiceRow>(query, [userid, mes, ano]);
      return rows.map((r) => ({
        ...r,
        mes_referencia: Number(r.mes_referencia),
        ano_referencia: Number(r.ano_referencia),
        valor_restante: Number(r.valor_restante),
      }));
    } catch (err) {
      console.warn('[DashboardRepository] Aviso ao consultar card_invoices:', err);
      return [];
    }
  },

  /**
   * Projeção anual unificada do fluxo de caixa mês a mês.
   * Agrega transações pagas e todas as obrigações pendentes (avulsos, empréstimos e faturas).
   */
  async getProjecaoMensal(ano: number | string, userid: number): Promise<ProjecaoMensalDto[]> {
    const anoNum = typeof ano === 'number' ? ano : parseInt(ano, 10);
    const userUuid = normalizeUserIdToUuid(userid);

    const query = `
      WITH transacoes_agregadas AS (
        SELECT 
          EXTRACT(MONTH FROM t.data)::integer AS mes,
          COALESCE(SUM(CASE WHEN LOWER(t.tipo) IN ('entrada', 'receita') THEN t.valor ELSE 0 END), 0)::numeric AS rec_trans,
          COALESCE(SUM(CASE WHEN LOWER(t.tipo) IN ('saida', 'despesa', 'cartao') THEN t.valor ELSE 0 END), 0)::numeric AS desp_trans
        FROM transacoes t
        WHERE t.userid = $1
          AND EXTRACT(YEAR FROM t.data) = $2::integer
        GROUP BY EXTRACT(MONTH FROM t.data)
      ),
      planned_agregadas AS (
        SELECT 
          EXTRACT(MONTH FROM pt.data_prevista)::integer AS mes,
          COALESCE(SUM(CASE WHEN pt.tipo = 'RECEITA' THEN pt.valor ELSE 0 END), 0)::numeric AS rec_plan,
          COALESCE(SUM(CASE WHEN pt.tipo = 'DESPESA' THEN pt.valor ELSE 0 END), 0)::numeric AS desp_plan
        FROM planned_transactions pt
        WHERE pt.userid = $1
          AND pt.status = 'PENDING'
          AND EXTRACT(YEAR FROM pt.data_prevista) = $2::integer
        GROUP BY EXTRACT(MONTH FROM pt.data_prevista)
      ),
      loans_agregadas AS (
        SELECT 
          EXTRACT(MONTH FROM li.due_date)::integer AS mes,
          COALESCE(SUM(li.original_amount), 0)::numeric AS desp_loan
        FROM loan_installments li
        INNER JOIN loans l ON l.id = li.loan_id
        WHERE l.user_id IN ($3, $4)
          AND li.status = 'PENDING'
          AND EXTRACT(YEAR FROM li.due_date) = $2::integer
        GROUP BY EXTRACT(MONTH FROM li.due_date)
      ),
      invoices_agregadas AS (
        SELECT 
          EXTRACT(MONTH FROM ci.data_vencimento)::integer AS mes,
          COALESCE(SUM(ii.valor_parcela) - COALESCE(ci.valor_pago, 0), 0)::numeric AS desp_invoice
        FROM card_invoices ci
        INNER JOIN credit_cards c ON c.id = ci.cartao_id
        LEFT JOIN invoice_items ii ON ii.fatura_id = ci.id
        WHERE c.usuario_id = $1
          AND ci.status != 'PAID'
          AND EXTRACT(YEAR FROM ci.data_vencimento) = $2::integer
        GROUP BY EXTRACT(MONTH FROM ci.data_vencimento), ci.id, ci.valor_pago
      ),
      invoices_por_mes AS (
        SELECT mes, COALESCE(SUM(desp_invoice), 0)::numeric AS desp_card
        FROM invoices_agregadas
        GROUP BY mes
      ),
      meses AS (
        SELECT generate_series(1, 12) AS mes
      )
      SELECT 
        TO_CHAR(MAKE_DATE($2::integer, m.mes::integer, 1), 'YYYY-MM-DD') AS mes_ano,
        $2::integer AS ano,
        m.mes,
        COALESCE(t.rec_trans, 0) + COALESCE(p.rec_plan, 0) AS soma_entrada,
        COALESCE(t.desp_trans, 0) + COALESCE(p.desp_plan, 0) + COALESCE(l.desp_loan, 0) + COALESCE(i.desp_card, 0) AS soma_saida,
        (COALESCE(t.rec_trans, 0) + COALESCE(p.rec_plan, 0)) - 
        (COALESCE(t.desp_trans, 0) + COALESCE(p.desp_plan, 0) + COALESCE(l.desp_loan, 0) + COALESCE(i.desp_card, 0)) AS saldo_mensal
      FROM meses m
      LEFT JOIN transacoes_agregadas t ON t.mes = m.mes
      LEFT JOIN planned_agregadas p ON p.mes = m.mes
      LEFT JOIN loans_agregadas l ON l.mes = m.mes
      LEFT JOIN invoices_por_mes i ON i.mes = m.mes
      ORDER BY m.mes;
    `;

    try {
      const { rows } = await pool.query<{
        mes_ano: string;
        ano: number;
        mes: number;
        soma_entrada: string | number;
        soma_saida: string | number;
        saldo_mensal: string | number;
      }>(query, [userid, anoNum, userUuid, String(userid)]);

      let acumulado = 0;
      return rows.map((r) => {
        const entrada = Number(r.soma_entrada || 0);
        const saida = Number(r.soma_saida || 0);
        const mensal = entrada - saida;
        acumulado += mensal;
        return {
          mes_ano: r.mes_ano,
          ano: Number(r.ano),
          mes: Number(r.mes),
          soma_entrada: entrada,
          soma_saida: saida,
          saldo_mensal: mensal,
          saldo_acumulado: acumulado,
        };
      });
    } catch (err) {
      console.warn('[DashboardRepository] Fallback na projeção mensal agregada:', err);
      // Fallback para a consulta clássica se CTE complexa falhar em ambientes com schemas incompletos
      const fallbackQuery = `
        SELECT
          DATE_TRUNC('month', t.data) AS mes_ano,
          EXTRACT(YEAR FROM t.data)::integer AS ano,
          EXTRACT(MONTH FROM t.data)::integer AS mes,
          SUM(CASE WHEN LOWER(t.tipo) IN ('entrada', 'receita') THEN t.valor ELSE 0 END) AS soma_entrada,
          SUM(CASE WHEN LOWER(t.tipo) IN ('saida', 'despesa', 'cartao') THEN t.valor ELSE 0 END) AS soma_saida,
          SUM(CASE WHEN LOWER(t.tipo) IN ('entrada', 'receita') THEN t.valor ELSE -t.valor END) AS saldo_mensal,
          SUM(SUM(CASE WHEN LOWER(t.tipo) IN ('entrada', 'receita') THEN t.valor ELSE -t.valor END)) OVER (ORDER BY DATE_TRUNC('month', t.data)) AS saldo_acumulado
        FROM transacoes t
        WHERE EXTRACT(YEAR FROM t.data) = $1
          AND t.userid = $2
        GROUP BY DATE_TRUNC('month', t.data), EXTRACT(YEAR FROM t.data), EXTRACT(MONTH FROM t.data)
        ORDER BY mes_ano;
      `;
      const fallbackRes = await pool.query<ProjecaoMensalDto>(fallbackQuery, [anoNum, userid]);
      return fallbackRes.rows;
    }
  },

  async getAgrupamentoCategoria(ano: number | string, userid: number): Promise<AgrupamentoCategoriaDto[]> {
    const query = `
      SELECT
        CAST(categoria AS integer) AS categoria,
        SUM(valor) AS media_mensal
      FROM transacoes
      WHERE EXTRACT(YEAR FROM CASE WHEN cartaoid IS NULL THEN data ELSE pagamento END) = $1
        AND LOWER(tipo) IN ('saida', 'despesa')
        AND userid = $2
      GROUP BY categoria
      ORDER BY categoria;
    `;
    const { rows } = await pool.query<AgrupamentoCategoriaDto>(query, [ano, userid]);
    return rows;
  },

  async getTransacoes(
    tipo?: string | null,
    status?: string | null,
    userid?: number
  ): Promise<TransacaoEntity[]> {
    let query = 'SELECT * FROM transacoes WHERE 1=1';
    const params: unknown[] = [];

    if (userid) {
      params.push(userid);
      query += ` AND userid = $${params.length}`;
    }

    if (tipo) {
      params.push(tipo);
      query += ` AND tipo = $${params.length}`;
    }

    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    query += ' ORDER BY data DESC';
    const { rows } = await pool.query<TransacaoEntity>(query, params);
    return rows;
  },
};
