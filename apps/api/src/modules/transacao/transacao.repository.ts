import { pool } from '../../core/config/database';
import {
  TransacaoEntity,
  CreateTransacaoDto,
  DespesaParceladaItem,
  LinhaTemporalItem,
} from './transacao.types';

export const TransacaoRepository = {
  async criar(
    transacao: CreateTransacaoDto,
    userid: number
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

    const result = await pool.query<TransacaoEntity>(
      `INSERT INTO transacoes (tipo, descricao, valor, categoria, data, status, userid, ispaycart, cartaoid, idcategoria, pagamento)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
      ]
    );
    return result.rows[0];
  },

  async buscarPorId(id: number | string, userid?: number): Promise<TransacaoEntity | undefined> {
    const params: unknown[] = [id];
    let query = 'SELECT * FROM transacoes WHERE id = $1';
    if (userid) {
      params.push(userid);
      query += ' AND userid = $2';
    }
    const result = await pool.query<TransacaoEntity>(query, params);
    return result.rows[0];
  },

  async atualizar(
    id: number | string,
    transacao: Partial<CreateTransacaoDto>
  ): Promise<TransacaoEntity | undefined> {
    const { tipo, descricao, valor, categoria, data, idcategoria, pagamento } = transacao;
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
           categoria = $4,
           data = COALESCE($5, data),
           idcategoria = COALESCE($6, idcategoria),
           pagamento = COALESCE($7, pagamento)
       WHERE id = $8
       RETURNING *`,
      [tipo, descricao, valor, parsedCategoria, data, parsedIdCategoria, pagamento ?? null, id]
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
    let query = `SELECT id, descricao, tipo, valor, categoria, TO_CHAR(t."data"::date, 'YYYY-MM-DD') AS data, status, cartaoid, pagamento
                FROM transacoes t
                WHERE 1=1`;
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
    return result.rows;
  },
};

