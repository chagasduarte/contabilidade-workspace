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
