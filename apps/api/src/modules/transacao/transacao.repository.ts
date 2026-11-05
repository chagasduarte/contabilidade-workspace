import { PoolClient } from 'pg';
import { pool } from '../../core/config/database';
import {
  TransacaoEntity,
  CreateTransacaoDto,
  DespesaParceladaItem,
  LinhaTemporalItem,
} from './transacao.types';

export const TransacaoRepository = {
  async criarParcelamento(parcelas: CreateTransacaoDto[], userid: number): Promise<TransacaoEntity[]> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const criadas: TransacaoEntity[] = [];
      for (const parcela of parcelas) criadas.push(await this.criar(parcela, userid, client));
      await client.query('COMMIT');
      return criadas;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async parcelasDaCompra(id: string, userid: number): Promise<TransacaoEntity[]> {
    const result = await pool.query<TransacaoEntity>(`
      SELECT t.*, TO_CHAR(t.data, 'YYYY-MM-DD') AS data,
        ROW_NUMBER() OVER (ORDER BY t.data, t.id)::int AS numero_parcela,
        COUNT(*) OVER ()::int AS quantidade_parcelas
      FROM transacoes t
      JOIN transacoes origem ON origem.id::text = $1 AND origem.userid = $2
      WHERE t.userid = $2 AND t.source_type = 'INSTALLMENT'
        AND origem.source_type = 'INSTALLMENT' AND t.source_id = origem.source_id
      ORDER BY t.data, t.id`, [id, userid]);
    return result.rows;
  },

  async atualizarCompraCartao(id: string, userid: number, descricao: string, valor: number): Promise<boolean> {
    // Uma única instrução mantém compra e item consistentes; faturas fechadas não são editáveis.
    const result = await pool.query(`
      WITH elegivel AS (
        SELECT ct.id AS compra_id, ii.id AS item_id
        FROM invoice_items ii
        JOIN card_transactions ct ON ct.id = ii.transacao_id
        JOIN credit_cards cc ON cc.id = ct.cartao_id
        JOIN card_invoices ci ON ci.id = ii.fatura_id
        WHERE ii.id::text = $1 AND cc.usuario_id = $2
          AND ct.quantidade_parcelas = 1 AND ci.status = 'OPEN'
        FOR UPDATE OF ci, ct, ii
      ), compra AS (
        UPDATE card_transactions SET descricao = $3, valor_total = $4
        WHERE id IN (SELECT compra_id FROM elegivel) RETURNING id
      )
      UPDATE invoice_items SET valor_parcela = $4
      WHERE id IN (SELECT item_id FROM elegivel) AND transacao_id IN (SELECT id FROM compra)
      RETURNING id`, [id, userid, descricao, valor]);
    return result.rows.length > 0;
  },

  async parcelasCartao(id: string, userid: number): Promise<TransacaoEntity[]> {
    const result = await pool.query<TransacaoEntity>(`
      SELECT ii.id, ct.descricao, 'cartao' AS tipo, ii.valor_parcela AS valor,
        TO_CHAR(ci.data_vencimento, 'YYYY-MM-DD') AS data,
        CASE WHEN ci.status = 'PAID' THEN 'pago' ELSE 'pendente' END AS status,
        cc.usuario_id AS userid, 'CREDIT_CARD_INVOICE_ITEM' AS source_type,
        ii.id::text AS source_id, ii.numero_parcela, ct.quantidade_parcelas,
        c.nome AS categoria
      FROM invoice_items ii
      JOIN card_transactions ct ON ct.id = ii.transacao_id
      JOIN credit_cards cc ON cc.id = ct.cartao_id AND cc.usuario_id = $2
      JOIN card_invoices ci ON ci.id = ii.fatura_id
      LEFT JOIN categoria c ON c.id = ct.categoria_id
      WHERE ct.id = (SELECT transacao_id FROM invoice_items WHERE id::text = $1)
      ORDER BY ii.numero_parcela`, [id, userid]);
    return result.rows;
  },

  async criar(
    transacao: CreateTransacaoDto,
    userid: number,
    client?: PoolClient
  ): Promise<TransacaoEntity> {
    const {
      tipo,
      descricao,
      valor,
      categoria,
      idcategoria,
      data,
      pagamento = null,
      status = 'pendente',
      ispaycart = false,
      cartaoid = null,
      source_type = null,
      source_id = null,
    } = transacao;

    const parsedCategoria =
      categoria !== undefined && categoria !== null && !isNaN(Number(categoria))
        ? Number(categoria)
        : null;

    const parsedIdCategoria =
      idcategoria !== undefined && idcategoria !== null && !isNaN(Number(idcategoria))
        ? Number(idcategoria)
        : null;

    const parsedCartaoId =
      cartaoid !== undefined && cartaoid !== null && Number(cartaoid) > 0
        ? Number(cartaoid)
        : null;

    const result = await (client ?? pool).query<TransacaoEntity>(
      `INSERT INTO transacoes (tipo, descricao, valor, categoria, data, status, userid, ispaycart, cartaoid, idcategoria, pagamento, source_type, source_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        tipo,
        descricao,
        valor,
        parsedCategoria,
        data,
        status,
        userid,
        Boolean(ispaycart),
        parsedCartaoId,
        parsedIdCategoria,
        pagamento,
        source_type,
        source_id,
      ]
    );
    return result.rows[0];
  },

  async buscarPorId(id: number | string, userid?: number): Promise<TransacaoEntity | undefined> {
    const params: unknown[] = [id];
    let query = `SELECT *, TO_CHAR(data, 'YYYY-MM-DD') AS data FROM transacoes WHERE id = $1`;
    if (userid) {
      params.push(userid);
      query += ' AND userid = $2';
    }
    const result = await pool.query<TransacaoEntity>(query, params);
    return result.rows[0];
  },

  async atualizar(
    id: number | string,
    transacao: Partial<CreateTransacaoDto>,
    userid: number
  ): Promise<TransacaoEntity | undefined> {
    const { tipo, descricao, valor, categoria, data, idcategoria, pagamento, status } = transacao;
    const parsedCategoria =
      categoria !== undefined && categoria !== null && !isNaN(Number(categoria))
        ? Number(categoria)
        : null;
    const parsedIdCategoria =
      idcategoria !== undefined && idcategoria !== null && !isNaN(Number(idcategoria))
        ? Number(idcategoria)
        : null;

    const result = await pool.query<TransacaoEntity>(
      `UPDATE transacoes
       SET tipo = COALESCE($1, tipo),
           descricao = COALESCE($2, descricao),
           valor = COALESCE($3, valor),
           categoria = COALESCE($4, categoria),
           data = COALESCE($5, data),
           idcategoria = COALESCE($6, idcategoria),
           pagamento = COALESCE($7, pagamento),
           status = COALESCE($10, status)
       WHERE id = $8 AND userid = $9
       RETURNING *`,
      [tipo, descricao, valor, parsedCategoria, data, parsedIdCategoria, pagamento ?? null, id, userid, status ?? null]
    );
    return result.rows[0];
  },

  async excluir(id: number | string): Promise<boolean> {
    await pool.query('DELETE FROM transacoes WHERE id = $1', [id]);
    return true;
  },

  async listaTransacoes(
    tipo?: string | null,
    status?: string | null,
    inicio?: string | null,
    fim?: string | null,
    userid?: number,
    cardId?: number | string | null
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

    if (inicio && fim) {
      params.push(inicio);
      query += ` AND data::date BETWEEN $${params.length}`;
      params.push(fim);
      query += ` AND $${params.length}`;
    }

    if (cardId) {
      params.push(cardId);
      query += ` AND cartaoid = $${params.length}`;
    } else {
      query += ' AND cartaoid IS NULL';
    }

    query += ' ORDER BY data ASC';

    const result = await pool.query<TransacaoEntity>(query, params);
    return result.rows;
  },

  async somaTransacoes(
    tipo?: string | null,
    status?: string | null,
    mes?: number | string | null,
    ano?: number | string | null,
    userid?: number,
    cardid?: number | string | null
  ): Promise<number> {
    let query = `SELECT SUM(t.valor) AS soma
                 FROM transacoes t
                 WHERE 1=1`;
    const params: unknown[] = [];

    if (userid) {
      params.push(userid);
      query += ` AND t.userid = $${params.length}`;
    }

    if (tipo) {
      params.push(tipo);
      query += ` AND t.tipo = $${params.length}`;
    }

    if (status) {
      params.push(status);
      query += ` AND t.status = $${params.length}`;
    }

    if (mes) {
      params.push(mes);
      query += ` AND extract(month from t.pagamento) = $${params.length}`;
    }

    if (ano) {
      params.push(ano);
      query += ` AND extract(year from t.pagamento) = $${params.length}`;
    }

    if (cardid) {
      params.push(cardid);
      query += ` AND t.cartaoid = $${params.length}`;
    }

    const result = await pool.query<{ soma: string | number | null }>(query, params);
    return Number(result.rows[0]?.soma || 0);
  },

  async listaDespesasParceladas(
    inicio: string,
    fim: string,
    userid: number,
    cardid?: number | string | null
  ): Promise<DespesaParceladaItem[]> {
    const params: unknown[] = [inicio, fim, userid];
    let query = `SELECT
                    descricao, 
                    SUM(valor) AS total_parcelado,
                    SUM(CASE WHEN status = 'pago' THEN valor ELSE 0 END) AS total_pago,
                    SUM(CASE WHEN status = 'pendente' THEN valor ELSE 0 END) AS total_pendente,
                    COUNT(*) AS qtd_parcelas,
                    SUM(CASE WHEN status = 'pago' THEN 1 ELSE 0 END) AS qtd_parcelas_pagas,
                    SUM(
                      CASE 
                        WHEN status = 'pendente'
                          AND pagamento between $1 and $2
                        THEN valor 
                        ELSE 0 
                      END
                    ) AS valor_pendente_mes,
                    CASE 
                      WHEN SUM(
                        CASE 
                          WHEN status = 'pendente'
                            AND pagamento between $1 and $2
                          THEN 1 
                          ELSE 0 
                        END
                      ) > 0 
                      THEN 'pendente'
                      ELSE 'pago'
                    END AS status
                  FROM transacoes
                  WHERE tipo = 'saida'
                    AND descricao ILIKE '%- Parcela'
                    AND descricao in (select descricao from transacoes d where  
                                              pagamento between $1 and $2
                                              AND descricao ILIKE '%- Parcela' 
                                              and tipo = 'saida')
                    AND userid = $3`;

    if (cardid) {
      params.push(cardid);
      query += ` AND cartaoid = $${params.length}`;
    } else {
      query += ' AND cartaoid is null';
    }

    query += ` GROUP BY descricao
               ORDER BY descricao;`;

    const result = await pool.query<DespesaParceladaItem>(query, params);
    return result.rows;
  },

  async agrupamentoTipo(
    status?: string | null,
    inicio?: string | null,
    fim?: string | null,
    userid?: number,
    tipo?: string | null
  ): Promise<Array<{ total_tipo: string; idcategoria: number | null; subcategoria: string }>> {
    const params: unknown[] = [inicio, fim, userid];
    let query = `SELECT 
        sum(valor) as total_tipo, 
        idcategoria, categoria as subcategoria
      FROM public.transacoes t
      where case when cartaoid is not null then pagamento else data end between $1 and $2
        AND userid = $3`;

    if (tipo) {
      params.push(tipo);
      query += ` AND tipo = $${params.length}`;
    }

    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    query += ` group by idcategoria, categoria
               order by idcategoria;`;

    const result = await pool.query<{
      total_tipo: string;
      idcategoria: number | null;
      subcategoria: string;
    }>(query, params);

    return result.rows;
  },

  async listaParceladas(
    inicio: string,
    fim: string,
    userid: number,
    cardId?: number | string | null
  ): Promise<TransacaoEntity[]> {
    const params: unknown[] = [inicio, fim, userid];
    let query = `SELECT id, descricao, tipo, valor, categoria, TO_CHAR(t."data"::date, 'YYYY-MM-DD') AS data, status, ispaycart
              FROM public.transacoes t
              where t.tipo = 'saida'
                and t.status = 'pendente'
                AND t."pagamento"::date BETWEEN $1 AND $2
                and descricao like '%Parcela'
                AND userid = $3 `;

    if (cardId) {
      params.push(cardId);
      query += `and cartaoid = $4 `;
    } else {
      query += 'and ispaycart is false';
    }

    const result = await pool.query<TransacaoEntity>(query, params);
    return result.rows;
  },

  async listaAdicionais(
    inicio: string,
    fim: string,
    userid: number,
    cardId?: number | string | null
  ): Promise<TransacaoEntity[]> {
    const params: unknown[] = [inicio, fim, userid];
    let query = `SELECT id, descricao, tipo, valor, categoria, TO_CHAR(t."data"::date, 'YYYY-MM-DD') AS data, status, ispaycart
              FROM public.transacoes t
              where t.tipo = 'saida'
                and t.status = 'pendente'
                AND t."pagamento"::date BETWEEN $1 AND $2
                and descricao not like '%Parcela'
                AND userid = $3 `;

    if (cardId) {
      params.push(cardId);
      query += `and cartaoid = $4 `;
    } else {
      query += 'and ispaycart is false';
    }

    const result = await pool.query<TransacaoEntity>(query, params);
    return result.rows;
  },

  async uptopago(id: number | string): Promise<boolean> {
    await pool.query("UPDATE transacoes SET status = 'pago' WHERE id = $1", [id]);
    return true;
  },

  async listaDespesa(descricao: string, userid: number): Promise<TransacaoEntity[]> {
    const query = `
      SELECT 
        id, 
        descricao, 
        tipo, 
        valor, 
        categoria, 
        TO_CHAR(t."data"::date, 'YYYY-MM-DD') AS data, 
        status 
      FROM transacoes t 
      WHERE descricao ILIKE '%' || $1 || '%' AND userid = $2
    `;
    const result = await pool.query<TransacaoEntity>(query, [descricao, userid]);
    return result.rows;
  },

  async linhaTemporal(ano: number | string, userid: number): Promise<LinhaTemporalItem[]> {
    const query = `SELECT 
                      COUNT(*) AS total_parcelas, 
                      MAX(pagamento) AS data_fim, 
                      MIN(pagamento) AS data_inicio,
                      descricao 
                  FROM transacoes t 	
                  WHERE EXTRACT(YEAR FROM pagamento) = $1
                    AND t.userid = $2
                    AND t.descricao LIKE '%- Parcela'
                  GROUP BY descricao
                  ORDER BY 
                      EXTRACT(YEAR FROM MIN(pagamento)) ASC,   
                      EXTRACT(MONTH FROM MIN(pagamento)) ASC,  
                      total_parcelas ASC,                 
                      MAX(pagamento) ASC;`;
    const result = await pool.query<LinhaTemporalItem>(query, [ano, userid]);
    return result.rows;
  },

  async buscaPorDia(
    dia: number | string,
    mes: number | string,
    ano: number | string,
    userid: number
  ): Promise<TransacaoEntity[]> {
    const query = `SELECT id, descricao, tipo, valor, categoria, TO_CHAR(t."data"::date, 'YYYY-MM-DD') AS data, status
                    FROM public.transacoes t
                    where t.tipo = 'saida'
                      and t.status = 'pendente'
                      and EXTRACT(DAY FROM pagamento) = $1
                      and EXTRACT(MONTH FROM pagamento) = $2
                      and EXTRACT(YEAR FROM pagamento) = $3
                      and ispaycart = true
                      AND userid = $4`;
    const result = await pool.query<TransacaoEntity>(query, [dia, mes, ano, userid]);
    return result.rows;
  },

  async extrato(
    limit?: number | string | null,
    mes?: number | string | null,
    ano?: number | string | null,
    userid?: number
  ): Promise<TransacaoEntity[]> {
    let query = `SELECT t.*, TO_CHAR(t.data::date, 'YYYY-MM-DD') AS data FROM (
      SELECT id::text, descricao, tipo, valor, categoria::text, data, status,
        cartaoid, pagamento, userid, source_type, source_id, NULL::integer AS quantidade_parcelas
      FROM transacoes
      UNION ALL
      SELECT ii.id::text, ct.descricao || ' (' || ii.numero_parcela || '/' || ct.quantidade_parcelas || ')',
        'cartao', ii.valor_parcela, c.nome, ci.data_vencimento,
        CASE WHEN ci.status = 'PAID' THEN 'pago' ELSE 'pendente' END,
        NULL::integer, ci.data_vencimento, cc.usuario_id,
        'CREDIT_CARD_INVOICE_ITEM', ii.id::text, ct.quantidade_parcelas
      FROM invoice_items ii
      JOIN card_transactions ct ON ct.id = ii.transacao_id
      JOIN credit_cards cc ON cc.id = ct.cartao_id
      JOIN card_invoices ci ON ci.id = ii.fatura_id
      LEFT JOIN categoria c ON c.id = ct.categoria_id
    ) t WHERE 1=1`;
    const params: unknown[] = [];

    if (userid) {
      params.push(userid);
      query += ` AND t.userid = $${params.length}`;
    }

    if (ano) {
      params.push(ano);
      query += ` AND $${params.length} = case when cartaoid is not null then extract(year from pagamento) else extract(year from t.data) end `;
    }

    if (mes) {
      params.push(mes);
      query += ` AND $${params.length} = case when cartaoid is not null then extract(month from pagamento) else extract(month from t.data) end `;
    }

    query += ' order by data desc, id desc';

    if (limit && Number(limit) > 0) {
      params.push(Number(limit));
      query += ` limit $${params.length}`;
    }

    const result = await pool.query<TransacaoEntity>(query, params);
    return result.rows.map(item => ({ ...item, id: /^\d+$/.test(String(item.id)) ? Number(item.id) : item.id }));
  },
};

