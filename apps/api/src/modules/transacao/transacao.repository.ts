import { pool } from '../../core/config/database';
import {
  TransacaoEntity,
  CreateTransacaoDto,
  DespesaParceladaItem,
  LinhaTemporalItem,
  PeriodoConsulta,
  TransacaoLoteItem,
  ExtratoCursor,
  AgrupamentoTipoItem,
  ExtratoTotais,
} from './transacao.types';

/**
 * Nomes de categoria/subcategoria para as respostas (sempre presentes, null quando não houver).
 * A visibilidade usa o dono da própria linha: ids legados que apontem para categoria/subcategoria
 * de outro usuário não vazam o nome.
 */
function joinNomes(alias: string): string {
  return `LEFT JOIN categoria cn ON cn.id = ${alias}.idcategoria AND (cn.userid = ${alias}.userid OR cn.userid IS NULL)
          LEFT JOIN subcategoria sn ON sn.id = ${alias}.idsubcategoria AND (sn.userid = ${alias}.userid OR sn.userid IS NULL)`;
}
const COLUNAS_NOMES = 'cn.nome AS categoria_nome, sn.nome AS subcategoria_nome';

/** Converte a lista de períodos (conta + cartões) nos arrays usados com unnest(). */
function periodosParaArrays(periodos: PeriodoConsulta[]): [Array<number | null>, string[], string[]] {
  return [
    periodos.map((p) => p.cartaoid),
    periodos.map((p) => p.inicio),
    periodos.map((p) => p.fim),
  ];
}

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
      idsubcategoria = null,
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
      `WITH r AS (
         INSERT INTO transacoes (tipo, descricao, valor, categoria, data, status, userid, ispaycart, cartaoid, idcategoria, pagamento, idsubcategoria)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *
       )
       SELECT r.*, ${COLUNAS_NOMES} FROM r ${joinNomes('r')}`,
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
        idsubcategoria !== null && idsubcategoria !== '' ? Number(idsubcategoria) : null,
      ]
    );
    return result.rows[0];
  },

  /**
   * Insere várias transações num único statement (atômico), já com o grupo de parcelamento
   * (parcela_grupo_id/numero/total, migration 004). A ordem do RETURNING não é garantida,
   * por isso o resultado é ordenado por data e id.
   */
  async criarEmLote(rows: TransacaoLoteItem[], userid: number): Promise<TransacaoEntity[]> {
    if (rows.length === 0) return [];

    const toNum = (v: unknown): number | null =>
      v !== undefined && v !== null && v !== '' && !isNaN(Number(v)) ? Number(v) : null;
    const toDate = (v: string | Date | null | undefined): string | null => {
      if (!v) return null;
      if (v instanceof Date) {
        const mm = String(v.getMonth() + 1).padStart(2, '0');
        const dd = String(v.getDate()).padStart(2, '0');
        return `${v.getFullYear()}-${mm}-${dd}`;
      }
      return String(v).split('T')[0];
    };

    const result = await pool.query<TransacaoEntity>(
      `WITH r AS (
         INSERT INTO transacoes (tipo, descricao, valor, categoria, idcategoria, data, pagamento, status,
                                 userid, ispaycart, cartaoid, parcela_grupo_id, parcela_numero, parcela_total, idsubcategoria)
         SELECT x.tipo, x.descricao, x.valor, x.categoria, x.idcategoria, x.data, x.pagamento, x.status,
                $9, x.ispaycart, x.cartaoid, x.parcela_grupo_id, x.parcela_numero, x.parcela_total, x.idsubcategoria
         FROM unnest($1::varchar[], $2::varchar[], $3::numeric[], $4::int[], $5::int[], $6::date[], $7::date[],
                     $8::varchar[], $10::bool[], $11::int[], $12::uuid[], $13::int[], $14::int[], $15::int[])
              AS x(tipo, descricao, valor, categoria, idcategoria, data, pagamento, status, ispaycart, cartaoid,
                   parcela_grupo_id, parcela_numero, parcela_total, idsubcategoria)
         RETURNING *
       )
       SELECT r.*, ${COLUNAS_NOMES} FROM r ${joinNomes('r')}`,
      [
        rows.map((r) => r.tipo),
        rows.map((r) => r.descricao),
        rows.map((r) => r.valor),
        rows.map((r) => toNum(r.categoria)),
        rows.map((r) => toNum(r.idcategoria)),
        rows.map((r) => toDate(r.data)),
        rows.map((r) => toDate(r.pagamento)),
        rows.map((r) => r.status ?? 'pendente'),
        userid,
        rows.map((r) => Boolean(r.ispaycart)),
        rows.map((r) => (toNum(r.cartaoid) && Number(r.cartaoid) > 0 ? Number(r.cartaoid) : null)),
        rows.map((r) => r.parcela_grupo_id ?? null),
        rows.map((r) => r.parcela_numero ?? null),
        rows.map((r) => r.parcela_total ?? null),
        rows.map((r) => toNum(r.idsubcategoria)),
      ]
    );

    return result.rows.sort((a, b) => {
      const da = new Date(a.data).getTime();
      const db = new Date(b.data).getTime();
      return da !== db ? da - db : Number(a.id) - Number(b.id);
    });
  },

  async buscarPorId(id: number | string, userid?: number): Promise<TransacaoEntity | undefined> {
    const params: unknown[] = [id];
    let query = `SELECT t.*, ${COLUNAS_NOMES} FROM transacoes t ${joinNomes('t')} WHERE t.id = $1`;
    if (userid) {
      params.push(userid);
      query += ' AND t.userid = $2';
    }
    const result = await pool.query<TransacaoEntity>(query, params);
    return result.rows[0];
  },

  async atualizar(
    id: number | string,
    transacao: Partial<CreateTransacaoDto>,
    userid: number,
    subcategoria: { alterar: boolean; valor: number | null } = { alterar: false, valor: null }
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
      `WITH r AS (
         UPDATE transacoes
         SET tipo = COALESCE($1, tipo),
             descricao = COALESCE($2, descricao),
             valor = COALESCE($3, valor),
             categoria = $4,
             data = COALESCE($5, data),
             idcategoria = COALESCE($6, idcategoria),
             pagamento = COALESCE($7, pagamento),
             idsubcategoria = CASE WHEN $10::boolean THEN $11::int ELSE idsubcategoria END
         WHERE id = $8 AND userid = $9
         RETURNING *
       )
       SELECT r.*, ${COLUNAS_NOMES} FROM r ${joinNomes('r')}`,
      [
        tipo,
        descricao,
        valor,
        parsedCategoria,
        data,
        parsedIdCategoria,
        pagamento ?? null,
        id,
        userid,
        subcategoria.alterar,
        subcategoria.valor,
      ]
    );
    return result.rows[0];
  },

  async excluir(id: number | string, userid: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM transacoes WHERE id = $1 AND userid = $2', [id, userid]);
    return (result.rowCount ?? 0) > 0;
  },

  async listaTransacoes(
    tipo?: string | null,
    status?: string | null,
    inicio?: string | null,
    fim?: string | null,
    userid?: number,
    cardId?: number | string | null
  ): Promise<TransacaoEntity[]> {
    let query = `SELECT t.*, ${COLUNAS_NOMES} FROM transacoes t ${joinNomes('t')} WHERE 1=1`;
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

    if (inicio && fim) {
      params.push(inicio);
      query += ` AND t.data::date BETWEEN $${params.length}`;
      params.push(fim);
      query += ` AND $${params.length}`;
    }

    if (cardId) {
      params.push(cardId);
      query += ` AND t.cartaoid = $${params.length}`;
    } else {
      query += ' AND t.cartaoid IS NULL';
    }

    query += ' ORDER BY t.data ASC';

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

    // Faixa de datas em vez de EXTRACT para usar idx_transacoes_userid_pagamento
    if (ano) {
      params.push(Number(ano));
      const pAno = params.length;
      if (mes) {
        params.push(Number(mes));
        const pMes = params.length;
        query += ` AND t.pagamento >= make_date($${pAno}::int, $${pMes}::int, 1)
                   AND t.pagamento < (make_date($${pAno}::int, $${pMes}::int, 1) + interval '1 month')::date`;
      } else {
        query += ` AND t.pagamento >= make_date($${pAno}::int, 1, 1)
                   AND t.pagamento < make_date($${pAno}::int + 1, 1, 1)`;
      }
    } else if (mes) {
      params.push(mes);
      query += ` AND extract(month from t.pagamento) = $${params.length}`;
    }

    if (cardid) {
      params.push(cardid);
      query += ` AND t.cartaoid = $${params.length}`;
    }

    const result = await pool.query<{ soma: string | number | null }>(query, params);
    return Number(result.rows[0]?.soma || 0);
  },

  /**
   * Resumo de despesas parceladas da conta e de todos os cartões numa única query.
   * Cada período (cartaoid NULL = conta corrente) traz sua própria janela de vencimento.
   * O predicado LIKE '%- Parcela' precisa ser idêntico ao do índice parcial idx_transacoes_parcela.
   */
  async listaDespesasParceladas(
    userid: number,
    periodos: PeriodoConsulta[]
  ): Promise<DespesaParceladaItem[]> {
    if (periodos.length === 0) return [];

    const query = `
      WITH periodo AS (
        SELECT * FROM unnest($2::int[], $3::date[], $4::date[]) AS p(cartaoid, inicio, fim)
      )
      SELECT t.descricao,
             SUM(t.valor) AS total_parcelado,
             SUM(CASE WHEN t.status = 'pago' THEN t.valor ELSE 0 END) AS total_pago,
             SUM(CASE WHEN t.status = 'pendente' THEN t.valor ELSE 0 END) AS total_pendente,
             COUNT(*) AS qtd_parcelas,
             SUM(CASE WHEN t.status = 'pago' THEN 1 ELSE 0 END) AS qtd_parcelas_pagas,
             SUM(CASE WHEN t.status = 'pendente' AND t.pagamento BETWEEN p.inicio AND p.fim
                      THEN t.valor ELSE 0 END) AS valor_pendente_mes,
             CASE WHEN bool_or(t.status = 'pendente' AND t.pagamento BETWEEN p.inicio AND p.fim)
                  THEN 'pendente' ELSE 'pago' END AS status
      FROM periodo p
      JOIN transacoes t
        ON t.userid = $1
       AND t.tipo = 'saida'
       AND t.descricao LIKE '%- Parcela'
       AND t.cartaoid IS NOT DISTINCT FROM p.cartaoid
      GROUP BY p.cartaoid, t.descricao
      HAVING bool_or(t.pagamento BETWEEN p.inicio AND p.fim)
      ORDER BY p.cartaoid NULLS FIRST, t.descricao`;

    const result = await pool.query<DespesaParceladaItem>(query, [userid, ...periodosParaArrays(periodos)]);
    return result.rows;
  },

  async agrupamentoTipo(
    status?: string | null,
    inicio?: string | null,
    fim?: string | null,
    userid?: number,
    tipo?: string | null
  ): Promise<AgrupamentoTipoItem[]> {
    const params: unknown[] = [inicio, fim, userid];
    // Agrupa pela coluna legada `categoria` (subcategoria ou a própria categoria), como antes.
    // Os nomes são aditivos: subcategoria só quando o valor legado é uma subcategoria da categoria.
    let query = `SELECT 
        sum(t.valor) as total_tipo, 
        t.idcategoria, t.categoria as subcategoria,
        sn.id AS idsubcategoria,
        cn.nome AS categoria_nome,
        sn.nome AS subcategoria_nome
      FROM public.transacoes t
      LEFT JOIN categoria cn ON cn.id = t.idcategoria AND (cn.userid = t.userid OR cn.userid IS NULL)
      LEFT JOIN subcategoria sn ON sn.id = t.categoria
                               AND t.categoria IS DISTINCT FROM t.idcategoria
                               AND sn.idcategoria = t.idcategoria
                               AND (sn.userid = t.userid OR sn.userid IS NULL)
      where case when t.cartaoid is not null then t.pagamento else t.data end between $1 and $2
        AND t.userid = $3`;

    if (tipo) {
      params.push(tipo);
      query += ` AND t.tipo = $${params.length}`;
    }

    if (status) {
      params.push(status);
      query += ` AND t.status = $${params.length}`;
    }

    query += ` group by t.idcategoria, t.categoria, sn.id, cn.nome, sn.nome
               order by t.idcategoria;`;

    const result = await pool.query<AgrupamentoTipoItem>(query, params);

    return result.rows;
  },

  /**
   * GET /transacoes: pendentes (parceladas/adicionais) e pagos da conta e de cada cartão
   * numa única query. Retorna as linhas com a coluna `grupo` para separação em JS.
   */
  async listarMes(
    userid: number,
    periodos: PeriodoConsulta[]
  ): Promise<Array<TransacaoEntity & { grupo: 'pagos' | 'parceladas' | 'adicionais' }>> {
    if (periodos.length === 0) return [];

    const query = `
      WITH periodo AS (
        SELECT * FROM unnest($2::int[], $3::date[], $4::date[]) AS p(cartaoid, inicio, fim)
      )
      SELECT CASE WHEN t.status = 'pago' THEN 'pagos'
                  WHEN t.descricao LIKE '%Parcela' THEN 'parceladas'
                  ELSE 'adicionais' END AS grupo,
             t.id, t.descricao, t.tipo, t.valor, t.categoria, t.idcategoria, t.idsubcategoria, ${COLUNAS_NOMES},
             TO_CHAR(t.data::date, 'YYYY-MM-DD') AS data, t.status, t.ispaycart, t.cartaoid, t.pagamento
      FROM periodo p
      JOIN transacoes t
        ON t.userid = $1
       AND t.tipo = 'saida'
       AND (
            (t.status = 'pendente'
             AND t.pagamento BETWEEN p.inicio AND p.fim
             AND (CASE WHEN p.cartaoid IS NULL THEN t.ispaycart IS FALSE ELSE t.cartaoid = p.cartaoid END))
         OR (t.status = 'pago'
             AND t.data::date BETWEEN p.inicio AND p.fim
             AND t.cartaoid IS NOT DISTINCT FROM p.cartaoid)
       )
      ${joinNomes('t')}
      ORDER BY grupo, t.data, t.id`;

    const result = await pool.query<TransacaoEntity & { grupo: 'pagos' | 'parceladas' | 'adicionais' }>(
      query,
      [userid, ...periodosParaArrays(periodos)]
    );
    return result.rows;
  },

  async uptopago(id: number | string, userid: number): Promise<boolean> {
    const result = await pool.query(
      "UPDATE transacoes SET status = 'pago' WHERE id = $1 AND userid = $2",
      [id, userid]
    );
    return (result.rowCount ?? 0) > 0;
  },

  async listaDespesa(descricao: string, userid: number): Promise<TransacaoEntity[]> {
    const query = `
      SELECT 
        t.id, 
        t.descricao, 
        t.tipo, 
        t.valor, 
        t.categoria, 
        t.idcategoria,
        t.idsubcategoria,
        ${COLUNAS_NOMES},
        TO_CHAR(t."data"::date, 'YYYY-MM-DD') AS data, 
        t.status 
      FROM transacoes t 
      ${joinNomes('t')}
      WHERE t.descricao ILIKE '%' || $1 || '%' AND t.userid = $2
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
                  WHERE t.pagamento >= make_date($1::int, 1, 1)
                    AND t.pagamento < make_date($1::int + 1, 1, 1)
                    AND t.userid = $2
                    AND t.descricao LIKE '%- Parcela'
                  GROUP BY descricao
                  ORDER BY 
                      EXTRACT(YEAR FROM MIN(pagamento)) ASC,   
                      EXTRACT(MONTH FROM MIN(pagamento)) ASC,  
                      total_parcelas ASC,                 
                      MAX(pagamento) ASC;`;
    const result = await pool.query<LinhaTemporalItem>(query, [Number(ano), userid]);
    return result.rows;
  },

  async buscaPorDia(
    dia: number | string,
    mes: number | string,
    ano: number | string,
    userid: number
  ): Promise<TransacaoEntity[]> {
    const query = `SELECT t.id, t.descricao, t.tipo, t.valor, t.categoria, t.idcategoria, t.idsubcategoria, ${COLUNAS_NOMES},
                           TO_CHAR(t."data"::date, 'YYYY-MM-DD') AS data, t.status
                    FROM public.transacoes t
                    ${joinNomes('t')}
                    where t.tipo = 'saida'
                      and t.status = 'pendente'
                      and t.pagamento = make_date($3::int, $2::int, $1::int)
                      and t.ispaycart = true
                      AND t.userid = $4`;
    const result = await pool.query<TransacaoEntity>(query, [Number(dia), Number(mes), Number(ano), userid]);
    return result.rows;
  },

  /**
   * Totais do extrato no período inteiro (mesmo filtro de competência de `extrato`, sem cursor).
   */
  async extratoTotais(
    userid: number,
    inicio: string | null,
    fimExclusivo: string | null
  ): Promise<ExtratoTotais> {
    const result = await pool.query<{ entradas: string; saidas: string; pendentes: string }>(
      `SELECT COALESCE(SUM(t.valor) FILTER (WHERE t.tipo = 'entrada'), 0) AS entradas,
              COALESCE(SUM(t.valor) FILTER (WHERE t.tipo <> 'entrada'), 0) AS saidas,
              COUNT(*) FILTER (WHERE t.status = 'pendente') AS pendentes
       FROM transacoes t
       WHERE t.userid = $1
         AND ($2::date IS NULL OR (CASE WHEN t.cartaoid IS NOT NULL THEN t.pagamento ELSE t.data END) >= $2::date)
         AND ($3::date IS NULL OR (CASE WHEN t.cartaoid IS NOT NULL THEN t.pagamento ELSE t.data END) <  $3::date)`,
      [userid, inicio, fimExclusivo]
    );
    const row = result.rows[0];
    return {
      entradas: Number(row?.entradas ?? 0),
      saidas: Number(row?.saidas ?? 0),
      pendentes: Number(row?.pendentes ?? 0),
    };
  },

  /**
   * Extrato por competência (cartão -> pagamento, conta -> data) com paginação keyset.
   * A expressão CASE precisa ser idêntica à de idx_transacoes_userid_competencia.
   * `inicio`/`fimExclusivo` são opcionais; `cursor` = última (data, id) da página anterior.
   */
  async extrato(
    userid: number,
    inicio: string | null,
    fimExclusivo: string | null,
    cursor: ExtratoCursor | null,
    limit: number | null
  ): Promise<TransacaoEntity[]> {
    const params: unknown[] = [
      userid,
      inicio,
      fimExclusivo,
      cursor?.data ?? null,
      cursor?.id ?? null,
    ];

    let query = `SELECT t.id, t.descricao, t.tipo, t.valor, t.categoria, t.idcategoria, t.idsubcategoria, ${COLUNAS_NOMES},
                        TO_CHAR(t."data"::date, 'YYYY-MM-DD') AS data, t.status, t.cartaoid, t.pagamento
                 FROM transacoes t
                 ${joinNomes('t')}
                 WHERE t.userid = $1
                   AND ($2::date IS NULL OR (CASE WHEN t.cartaoid IS NOT NULL THEN t.pagamento ELSE t.data END) >= $2::date)
                   AND ($3::date IS NULL OR (CASE WHEN t.cartaoid IS NOT NULL THEN t.pagamento ELSE t.data END) <  $3::date)
                   AND ($4::date IS NULL OR (t.data, t.id) < ($4::date, $5::int))
                 ORDER BY t.data DESC, t.id DESC`;

    if (limit && limit > 0) {
      params.push(limit);
      query += ` LIMIT $${params.length}`;
    }

    const result = await pool.query<TransacaoEntity>(query, params);
    return result.rows;
  },
};

