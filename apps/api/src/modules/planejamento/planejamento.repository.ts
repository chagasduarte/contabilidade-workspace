import { pool } from '../../core/config/database';
import { SOURCE_TYPE_PAGAMENTO_FATURA } from '../card/card.entity';
import {
  PlanejamentoEntity,
  PlanejamentoGravacao,
  ResumoCategoriaPlanejamento,
  TipoPlanejamento,
} from './planejamento.types';

// data como texto (YYYY-MM-DD) para não sofrer conversão de fuso; numéricos convertidos em mapear()
const COLUNAS = `id, categoria, subcategoria, valor, tipo, categoriaid, subcategoriaid,
                 TO_CHAR(data, 'YYYY-MM-DD') AS data, userid`;

function mapear(row: Record<string, unknown>): PlanejamentoEntity {
  return {
    id: Number(row['id']),
    categoria: String(row['categoria']),
    subcategoria: row['subcategoria'] != null ? String(row['subcategoria']) : null,
    valor: Number(row['valor']),
    tipo: String(row['tipo']),
    categoriaid: Number(row['categoriaid']),
    subcategoriaid: row['subcategoriaid'] != null ? Number(row['subcategoriaid']) : null,
    data: String(row['data']),
    userid: Number(row['userid']),
  };
}

/** Faixa [início do mês, início do mês seguinte) como SQL sobre `col`, com os parâmetros de ano/mês. */
function filtroMes(col: string, pAno: number, pMes: number): string {
  return `${col} >= make_date($${pAno}::int, $${pMes}::int, 1)
          AND ${col} < (make_date($${pAno}::int, $${pMes}::int, 1) + interval '1 month')::date`;
}

export const PlanejamentoRepository = {
  async criar(p: PlanejamentoGravacao, userid: number): Promise<PlanejamentoEntity> {
    const result = await pool.query(
      `INSERT INTO planejamento (categoria, subcategoria, valor, tipo, categoriaid, subcategoriaid, data, userid)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${COLUNAS}`,
      [p.categoria, p.subcategoria, p.valor, p.tipo, p.categoriaid, p.subcategoriaid, p.data, userid]
    );
    return mapear(result.rows[0]);
  },

  /** Regrava os campos editáveis (a data/mês não muda). */
  async atualizar(
    id: number | string,
    p: Omit<PlanejamentoGravacao, 'data'>,
    userid: number
  ): Promise<PlanejamentoEntity | undefined> {
    const result = await pool.query(
      `UPDATE planejamento
         SET categoria = $1, subcategoria = $2, valor = $3, tipo = $4, categoriaid = $5, subcategoriaid = $6
       WHERE id = $7 AND userid = $8
       RETURNING ${COLUNAS}`,
      [p.categoria, p.subcategoria, p.valor, p.tipo, p.categoriaid, p.subcategoriaid, id, userid]
    );
    return result.rows[0] ? mapear(result.rows[0]) : undefined;
  },

  async deletar(id: number | string, userid: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM planejamento WHERE id = $1 AND userid = $2', [id, userid]);
    return (result.rowCount ?? 0) > 0;
  },

  /** Lista do usuário; mês/ano opcionais (faixa de datas para usar idx_planejamento_userid_data). */
  async listar(userid: number, mes?: number | null, ano?: number | null): Promise<PlanejamentoEntity[]> {
    const params: unknown[] = [userid];
    let query = `SELECT ${COLUNAS} FROM planejamento WHERE userid = $1`;
    if (ano && mes) {
      params.push(ano, mes);
      query += ` AND ${filtroMes('data', 2, 3)}`;
    } else if (ano) {
      params.push(ano);
      query += ' AND data >= make_date($2::int, 1, 1) AND data < make_date($2::int + 1, 1, 1)';
    }
    query += ' ORDER BY data DESC, id DESC';
    const result = await pool.query(query, params);
    return result.rows.map(mapear);
  },

  async buscarPorId(id: number | string, userid: number): Promise<PlanejamentoEntity | undefined> {
    const result = await pool.query(
      `SELECT ${COLUNAS} FROM planejamento WHERE id = $1 AND userid = $2 LIMIT 1`,
      [id, userid]
    );
    return result.rows[0] ? mapear(result.rows[0]) : undefined;
  },

  /**
   * Planejamento existente do mesmo mês/tipo/categoria/subcategoria (para somar em vez de duplicar).
   * subcategoriaid NULL casa só com NULL (antes, sem subcategoria, casava com qualquer uma).
   */
  async buscarMesmoGrupo(
    p: PlanejamentoGravacao,
    userid: number
  ): Promise<PlanejamentoEntity | undefined> {
    const [ano, mes] = p.data.split('-').map(Number);
    const result = await pool.query(
      `SELECT ${COLUNAS} FROM planejamento
       WHERE userid = $1 AND ${filtroMes('data', 2, 3)}
         AND tipo = $4 AND categoriaid = $5 AND subcategoriaid IS NOT DISTINCT FROM $6::int
       ORDER BY id LIMIT 1`,
      [userid, ano, mes, p.tipo, p.categoriaid, p.subcategoriaid]
    );
    return result.rows[0] ? mapear(result.rows[0]) : undefined;
  },

  /**
   * Planejado x realizado por categoria no mês, para um tipo (despesa ou receita).
   * Realizado = transacoes do mês por competência (cartão legado -> pagamento, conta -> data; mesma
   * expressão de idx_transacoes_userid_competencia) + parcelas de cartão (invoice_items) das faturas
   * de referência do mês (só despesa). Tipos legados (RECEITA/DESPESA, entrada/saida/cartao) são
   * normalizados. Pagamento de fatura gravado em transacoes é excluído (as parcelas já entram).
   * UNION ALL + GROUP BY (e não FULL JOIN) junta planejado e realizado por categoria.
   */
  async resumoMes(
    userid: number,
    mes: number,
    ano: number,
    tipo: TipoPlanejamento
  ): Promise<ResumoCategoriaPlanejamento[]> {
    const result = await pool.query(
      `WITH valores AS (
         SELECT categoriaid AS idcategoria, valor AS planejado, 0 AS pago, 0 AS pendente
         FROM planejamento
         WHERE userid = $1 AND ${filtroMes('data', 2, 3)}
           AND (CASE WHEN LOWER(tipo) IN ('receita', 'entrada') THEN 'receita' ELSE 'despesa' END) = $4
         UNION ALL
         SELECT t.idcategoria, 0,
                CASE WHEN t.status = 'pago' THEN t.valor ELSE 0 END,
                CASE WHEN t.status = 'pago' THEN 0 ELSE t.valor END
         FROM transacoes t
         WHERE t.userid = $1
           AND t.idcategoria IS NOT NULL
           AND ${filtroMes('(CASE WHEN t.cartaoid IS NOT NULL THEN t.pagamento ELSE t.data END)', 2, 3)}
           AND (CASE WHEN LOWER(t.tipo) IN ('entrada', 'receita') THEN 'receita' ELSE 'despesa' END) = $4
           AND t.source_type IS DISTINCT FROM $5
         UNION ALL
         SELECT ct.categoria_id, 0,
                CASE WHEN ci.status = 'PAID' THEN ii.valor_parcela ELSE 0 END,
                CASE WHEN ci.status = 'PAID' THEN 0 ELSE ii.valor_parcela END
         FROM invoice_items ii
         JOIN card_invoices ci ON ci.id = ii.fatura_id
         JOIN card_transactions ct ON ct.id = ii.transacao_id
         JOIN credit_cards cc ON cc.id = ci.cartao_id
         WHERE $4 = 'despesa'
           AND cc.usuario_id = $1
           AND ci.ano_referencia = $2 AND ci.mes_referencia = $3
           AND ct.categoria_id IS NOT NULL
       )
       SELECT v.idcategoria,
              cn.nome AS categoria_nome,
              SUM(v.planejado) AS planejado,
              SUM(v.pago) AS realizado_pago,
              SUM(v.pendente) AS realizado_pendente
       FROM valores v
       LEFT JOIN categoria cn ON cn.id = v.idcategoria AND (cn.userid = $1 OR cn.userid IS NULL)
       GROUP BY v.idcategoria, cn.nome
       ORDER BY cn.nome NULLS LAST, v.idcategoria`,
      [userid, ano, mes, tipo, SOURCE_TYPE_PAGAMENTO_FATURA]
    );
    return result.rows.map((r) => ({
      idcategoria: Number(r.idcategoria),
      categoria_nome: r.categoria_nome ?? null,
      planejado: Number(r.planejado),
      realizado_pago: Number(r.realizado_pago),
      realizado_pendente: Number(r.realizado_pendente),
    }));
  },
};
