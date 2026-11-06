import { pool } from '../../core/config/database';
import { UpdateInvoiceItemDto } from './card.dto';

export const CardItemRepository = {
  async atualizar(id: string, usuarioId: number, dto: UpdateInvoiceItemDto): Promise<'updated' | 'not-found' | 'paid' | 'limit'> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Mesma ordem da exclusão: compra antes da fatura.
      const compra = await client.query<{ id: string; cartao_id: string }>(`
        SELECT ct.id, ct.cartao_id FROM card_transactions ct
        JOIN credit_cards cc ON cc.id = ct.cartao_id
        JOIN invoice_items ii ON ii.transacao_id = ct.id
        WHERE ii.id = $1::uuid AND cc.usuario_id = $2 FOR UPDATE OF ct`, [id, usuarioId]);
      if (!compra.rows.length) {
        await client.query('ROLLBACK');
        return 'not-found';
      }
      const { rows } = await client.query<{ valor_parcela: string; status: string; valor_pago: string }>(`
        SELECT ii.valor_parcela, ci.status, ci.valor_pago
        FROM invoice_items ii JOIN card_invoices ci ON ci.id = ii.fatura_id
        WHERE ii.id = $1::uuid FOR UPDATE OF ci`, [id]);
      const item = rows[0];
      const diferenca = Math.round(dto.valor_parcela * 100) - Math.round(Number(item.valor_parcela) * 100);
      if (diferenca !== 0 && (item.status === 'PAID' || Number(item.valor_pago) > 0)) {
        await client.query('ROLLBACK');
        return 'paid';
      }
      if (diferenca > 0) {
        const limite = await client.query<{ limite_total: string; comprometido: string }>(`
          SELECT cc.limite_total, (SELECT COALESCE(SUM(ii.valor_parcela), 0)
            FROM invoice_items ii JOIN card_invoices ci ON ci.id = ii.fatura_id
            WHERE ci.cartao_id = cc.id AND ci.status <> 'PAID') AS comprometido
          FROM credit_cards cc WHERE cc.id = $1::uuid FOR UPDATE OF cc`, [compra.rows[0].cartao_id]);
        if (diferenca > Math.round((Number(limite.rows[0].limite_total) - Number(limite.rows[0].comprometido)) * 100)) {
          await client.query('ROLLBACK');
          return 'limit';
        }
      }
      await client.query('UPDATE invoice_items SET valor_parcela = $2 WHERE id = $1::uuid', [id, dto.valor_parcela]);
      await client.query(`UPDATE card_transactions SET descricao = $2, categoria_id = $3, subcategoria_id = $4,
          valor_total = (SELECT SUM(valor_parcela) FROM invoice_items WHERE transacao_id = $1::uuid)
        WHERE id = $1::uuid`, [compra.rows[0].id, dto.descricao, dto.categoria_id ?? null, dto.subcategoria_id ?? null]);
      await client.query('COMMIT');
      return 'updated';
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
};
