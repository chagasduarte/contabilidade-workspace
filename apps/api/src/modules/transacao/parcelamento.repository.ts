import { pool } from '../../core/config/database';
import { OrigemParcelamento } from '@contabilidade/models';

export interface ParcelaRegistro {
  id: string;
  descricao: string;
  numero: number;
  quantidade: number;
  valor: string | number;
  vencimento: string;
  status: 'pago' | 'pendente';
}

export const ParcelamentoRepository = {
  async excluir(
    id: string,
    origem: OrigemParcelamento,
    userid: number,
  ): Promise<boolean> {
    if (origem === 'conta') {
      const result = await pool.query(
        'DELETE FROM transacoes WHERE parcela_grupo_id = $1::uuid AND userid = $2 RETURNING id',
        [id, userid],
      );
      return result.rows.length > 0;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const compra = await client.query(
        `
        SELECT ct.id FROM card_transactions ct
        JOIN credit_cards cc ON cc.id = ct.cartao_id
        WHERE ct.id = $1::uuid AND cc.usuario_id = $2
        FOR UPDATE OF ct`,
        [id, userid],
      );
      if (!compra.rows.length) {
        await client.query('ROLLBACK');
        return false;
      }
      // Bloqueia as faturas antes de alterar itens; outras compras não são removidas.
      const faturas = await client.query<{ id: string }>(
        `
        SELECT ci.id FROM card_invoices ci
        JOIN credit_cards cc ON cc.id = ci.cartao_id
        WHERE cc.usuario_id = $2 AND ci.id IN (
          SELECT fatura_id FROM invoice_items WHERE transacao_id = $1::uuid
        ) ORDER BY ci.id FOR UPDATE OF ci`,
        [id, userid],
      );
      const faturaIds = faturas.rows.map((row) => row.id);
      await client.query(
        `
        DELETE FROM transacoes WHERE userid = $2 AND (
          (source_type = 'CREDIT_CARD_TRANSACTION' AND source_id = $1)
          OR (source_type = 'CREDIT_CARD_INVOICE_ITEM' AND source_id IN (
            SELECT id::text FROM invoice_items WHERE transacao_id = $1::uuid
          ))
        )`,
        [id, userid],
      );
      await client.query(
        'DELETE FROM invoice_items WHERE transacao_id = $1::uuid',
        [id],
      );
      await client.query('DELETE FROM card_transactions WHERE id = $1::uuid', [
        id,
      ]);
      // Pagamentos de faturas compartilhadas pertencem à fatura, não a uma única compra.
      await client.query(
        `
        DELETE FROM transacoes WHERE userid = $2
          AND source_type = 'CREDIT_CARD_INVOICE_PAYMENT'
          AND source_id IN (
            SELECT ci.id::text FROM card_invoices ci
            WHERE ci.id = ANY($1::uuid[]) AND NOT EXISTS (
              SELECT 1 FROM invoice_items ii WHERE ii.fatura_id = ci.id
            )
          )`,
        [faturaIds, userid],
      );
      await client.query(
        `
        DELETE FROM card_invoices ci USING credit_cards cc
        WHERE ci.cartao_id = cc.id AND cc.usuario_id = $2 AND ci.id = ANY($1::uuid[])
          AND NOT EXISTS (SELECT 1 FROM invoice_items ii WHERE ii.fatura_id = ci.id)`,
        [faturaIds, userid],
      );
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async listar(
    id: string,
    origem: OrigemParcelamento,
    userid: number,
  ): Promise<ParcelaRegistro[]> {
    const sql =
      origem === 'conta'
        ? `
      SELECT t.id::text, t.descricao, t.parcela_numero AS numero,
        t.parcela_total AS quantidade, t.valor,
        TO_CHAR(COALESCE(t.pagamento, t.data), 'YYYY-MM-DD') AS vencimento, t.status
      FROM transacoes t
      WHERE t.parcela_grupo_id = $1::uuid AND t.userid = $2
      ORDER BY t.parcela_numero`
        : `
      SELECT ii.id::text, ct.descricao, ii.numero_parcela AS numero,
        ct.quantidade_parcelas AS quantidade, ii.valor_parcela AS valor,
        TO_CHAR(ci.data_vencimento, 'YYYY-MM-DD') AS vencimento,
        CASE WHEN ci.status = 'PAID' THEN 'pago' ELSE 'pendente' END AS status
      FROM card_transactions ct
      JOIN credit_cards cc ON cc.id = ct.cartao_id
      JOIN invoice_items ii ON ii.transacao_id = ct.id
      JOIN card_invoices ci ON ci.id = ii.fatura_id AND ci.cartao_id = cc.id
      WHERE ct.id = $1::uuid AND cc.usuario_id = $2
      ORDER BY ii.numero_parcela`;
    const result = await pool.query<ParcelaRegistro>(sql, [id, userid]);
    return result.rows;
  },
};
