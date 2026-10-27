import { pool } from '../../core/config/database';
import { normalizeUserIdToUuid } from '../loan/loan.repository';
import {
  TransacaoEntity,
  CreateTransacaoDto,
  DespesaParceladaItem,
  LinhaTemporalItem,
  PeriodoConsulta,
  TransacaoLoteItem,
  ExtratoCursor,
  ExtratoCartaoCursor,
  ExtratoFiltros,
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

const SEM_FILTROS: ExtratoFiltros = { tipo: null, status: null };

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
    // Mesmas origens e competências do extrato: conta (cartão legado -> pagamento, conta -> data),
    // parcelas de cartão (vencimento da fatura), contas planejadas pendentes (data prevista) e
    // parcelas de empréstimo pendentes (vencimento). Planejadas/parcelas já pagas estão em transacoes.
    const result = await pool.query<Record<keyof ExtratoTotais, string>>(
      `WITH itens AS (
         SELECT CASE WHEN t.tipo = 'entrada' THEN 'entrada' ELSE 'saida' END AS tipo,
                t.valor, t.status = 'pendente' AS pendente
         FROM transacoes t
         WHERE t.userid = $1
           AND ($2::date IS NULL OR (CASE WHEN t.cartaoid IS NOT NULL THEN t.pagamento ELSE t.data END) >= $2::date)
           AND ($3::date IS NULL OR (CASE WHEN t.cartaoid IS NOT NULL THEN t.pagamento ELSE t.data END) <  $3::date)
         UNION ALL
         SELECT 'saida', ii.valor_parcela, ci.status <> 'PAID'
         FROM invoice_items ii
         JOIN card_invoices ci ON ci.id = ii.fatura_id
         JOIN credit_cards cc ON cc.id = ci.cartao_id
         WHERE cc.usuario_id = $1
           AND ($2::date IS NULL OR ci.data_vencimento >= $2::date)
           AND ($3::date IS NULL OR ci.data_vencimento <  $3::date)
         UNION ALL
         SELECT CASE WHEN pt.tipo = 'RECEITA' THEN 'entrada' ELSE 'saida' END, pt.valor, true
         FROM planned_transactions pt
         WHERE pt.userid = $1
           AND pt.status = 'PENDING'
           AND ($2::date IS NULL OR pt.data_prevista >= $2::date)
           AND ($3::date IS NULL OR pt.data_prevista <  $3::date)
         UNION ALL
         SELECT 'saida', li.original_amount, true
         FROM loan_installments li
         JOIN loans l ON l.id = li.loan_id
         WHERE l.user_id IN ($4, $5)
           AND li.status = 'PENDING'
           AND ($2::date IS NULL OR li.due_date >= $2::date)
           AND ($3::date IS NULL OR li.due_date <  $3::date)
       )
       SELECT COALESCE(SUM(valor) FILTER (WHERE tipo = 'entrada'), 0) AS entradas,
              COALESCE(SUM(valor) FILTER (WHERE tipo = 'saida'), 0) AS saidas,
              COUNT(*) FILTER (WHERE pendente) AS pendentes,
              COALESCE(SUM(valor) FILTER (WHERE tipo = 'entrada' AND NOT pendente), 0) AS entradas_pagas,
              COALESCE(SUM(valor) FILTER (WHERE tipo = 'entrada' AND pendente), 0) AS entradas_pendentes,
              COALESCE(SUM(valor) FILTER (WHERE tipo = 'saida' AND NOT pendente), 0) AS saidas_pagas,
              COALESCE(SUM(valor) FILTER (WHERE tipo = 'saida' AND pendente), 0) AS saidas_pendentes
       FROM itens`,
      [userid, inicio, fimExclusivo, normalizeUserIdToUuid(userid), String(userid)]
    );
    const row = result.rows[0];
    const num = (v: string | undefined) => Number(v ?? 0);
    return {
      entradas: num(row?.entradas),
      saidas: num(row?.saidas),
      pendentes: num(row?.pendentes),
      entradas_pagas: num(row?.entradas_pagas),
      entradas_pendentes: num(row?.entradas_pendentes),
      saidas_pagas: num(row?.saidas_pagas),
      saidas_pendentes: num(row?.saidas_pendentes),
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
    limit: number | null,
    filtros: ExtratoFiltros = SEM_FILTROS
  ): Promise<TransacaoEntity[]> {
    const params: unknown[] = [
      userid,
      inicio,
      fimExclusivo,
      cursor?.data ?? null,
      cursor?.id ?? null,
      filtros.tipo,
      filtros.status,
    ];

    let query = `SELECT t.id, t.descricao, t.tipo, t.valor, t.categoria, t.idcategoria, t.idsubcategoria, ${COLUNAS_NOMES},
                        TO_CHAR(t."data"::date, 'YYYY-MM-DD') AS data, t.status, t.cartaoid, t.pagamento,
                        t.source_type, t.source_id
                 FROM transacoes t
                 ${joinNomes('t')}
                 WHERE t.userid = $1
                   AND ($2::date IS NULL OR (CASE WHEN t.cartaoid IS NOT NULL THEN t.pagamento ELSE t.data END) >= $2::date)
                   AND ($3::date IS NULL OR (CASE WHEN t.cartaoid IS NOT NULL THEN t.pagamento ELSE t.data END) <  $3::date)
                   AND ($4::date IS NULL OR (t.data, t.id) < ($4::date, $5::int))
                   AND ($6::text IS NULL OR (CASE WHEN t.tipo = 'entrada' THEN 'entrada' ELSE 'saida' END) = $6::text)
                   AND ($7::text IS NULL OR (CASE WHEN t.status = 'pendente' THEN 'pendente' ELSE 'pago' END) = $7::text)
                 ORDER BY t.data DESC, t.id DESC`;

    if (limit && limit > 0) {
      params.push(limit);
      query += ` LIMIT $${params.length}`;
    }

    const result = await pool.query<TransacaoEntity>(query, params);
    return result.rows;
  },

  /**
   * Parcelas de compras no cartão para o extrato, no formato de TransacaoEntity (somente leitura).
   * Competência = vencimento da fatura (como `pagamento` nos lançamentos de cartão legados);
   * ordenação e cursor por (data da compra, id do invoice_item).
   */
  async extratoCartao(
    userid: number,
    inicio: string | null,
    fimExclusivo: string | null,
    cursor: ExtratoCartaoCursor | null,
    limit: number | null,
    status: ExtratoFiltros['status'] = null
  ): Promise<TransacaoEntity[]> {
    const params: unknown[] = [userid, inicio, fimExclusivo, cursor?.data ?? null, cursor?.chave ?? null, status];

    let query = `SELECT 'cartao:' || ii.id::text AS id,
                        ct.descricao || CASE WHEN ct.quantidade_parcelas > 1
                          THEN ' (' || ii.numero_parcela || '/' || ct.quantidade_parcelas || ')' ELSE '' END AS descricao,
                        'saida' AS tipo,
                        ii.valor_parcela AS valor,
                        ct.categoria_id AS categoria,
                        ct.categoria_id AS idcategoria,
                        NULL::int AS idsubcategoria,
                        cat.nome AS categoria_nome,
                        NULL::text AS subcategoria_nome,
                        TO_CHAR(ct.data_compra, 'YYYY-MM-DD') AS data,
                        CASE WHEN ci.status = 'PAID' THEN 'pago' ELSE 'pendente' END AS status,
                        cc.usuario_id AS userid,
                        NULL::int AS cartaoid,
                        ci.data_vencimento AS pagamento,
                        'CARTAO' AS origem,
                        cc.nome AS origem_rotulo,
                        ci.id::text AS target_id,
                        'CREDIT_CARD_ITEM' AS source_type,
                        cc.id::text AS source_id
                 FROM invoice_items ii
                 JOIN card_invoices ci ON ci.id = ii.fatura_id
                 JOIN credit_cards cc ON cc.id = ci.cartao_id
                 JOIN card_transactions ct ON ct.id = ii.transacao_id
                 LEFT JOIN categoria cat ON cat.id = ct.categoria_id AND (cat.userid = cc.usuario_id OR cat.userid IS NULL)
                 WHERE cc.usuario_id = $1
                   AND ($2::date IS NULL OR ci.data_vencimento >= $2::date)
                   AND ($3::date IS NULL OR ci.data_vencimento <  $3::date)
                   AND ($4::date IS NULL OR (ct.data_compra, ii.id::text COLLATE "C") < ($4::date, $5::text COLLATE "C"))
                   AND ($6::text IS NULL OR (CASE WHEN ci.status = 'PAID' THEN 'pago' ELSE 'pendente' END) = $6::text)
                 ORDER BY ct.data_compra DESC, ii.id::text COLLATE "C" DESC`;

    if (limit && limit > 0) {
      params.push(limit);
      query += ` LIMIT $${params.length}`;
    }

    const result = await pool.query<TransacaoEntity>(query, params);
    return result.rows;
  },
  /**
   * Contas planejadas PENDENTES do período (data prevista) para o extrato, no formato de
   * TransacaoEntity. As já efetivadas não entram: viraram lançamento pago em transacoes.
   */
  async extratoPlanejadas(
    userid: number,
    inicio: string | null,
    fimExclusivo: string | null,
    cursor: ExtratoCartaoCursor | null,
    limit: number | null,
    tipo: ExtratoFiltros['tipo'] = null
  ): Promise<TransacaoEntity[]> {
    const tipoPlanejado = tipo === 'entrada' ? 'RECEITA' : tipo === 'saida' ? 'DESPESA' : null;
    const params: unknown[] = [userid, inicio, fimExclusivo, cursor?.data ?? null, cursor?.chave ?? null, tipoPlanejado];

    let query = `SELECT 'plan:' || pt.id::text AS id,
                        pt.descricao,
                        CASE WHEN pt.tipo = 'RECEITA' THEN 'entrada' ELSE 'saida' END AS tipo,
                        pt.valor,
                        pt.idcategoria AS categoria,
                        pt.idcategoria,
                        NULL::int AS idsubcategoria,
                        cat.nome AS categoria_nome,
                        NULL::text AS subcategoria_nome,
                        TO_CHAR(pt.data_prevista, 'YYYY-MM-DD') AS data,
                        'pendente' AS status,
                        pt.userid,
                        NULL::int AS cartaoid,
                        NULL::date AS pagamento,
                        'PLANEJADO' AS origem,
                        CASE WHEN pt.recorrencia = 'MENSAL' OR pt.parent_recurrence_id IS NOT NULL
                             THEN 'Recorrente' ELSE 'Avulso' END AS origem_rotulo,
                        pt.id::text AS target_id,
                        'PLANNED_TRANSACTION' AS source_type,
                        pt.id::text AS source_id,
                        pt.recorrencia,
                        pt.parent_recurrence_id::text AS parent_recurrence_id,
                        (pt.recorrencia = 'MENSAL' OR pt.parent_recurrence_id IS NOT NULL) AS is_recorrente
                 FROM planned_transactions pt
                 LEFT JOIN categoria cat ON cat.id = pt.idcategoria AND (cat.userid = pt.userid OR cat.userid IS NULL)
                 WHERE pt.userid = $1
                   AND pt.status = 'PENDING'
                   AND ($2::date IS NULL OR pt.data_prevista >= $2::date)
                   AND ($3::date IS NULL OR pt.data_prevista <  $3::date)
                   AND ($4::date IS NULL OR (pt.data_prevista, pt.id::text COLLATE "C") < ($4::date, $5::text COLLATE "C"))
                   AND ($6::text IS NULL OR pt.tipo = $6::text)
                 ORDER BY pt.data_prevista DESC, pt.id::text COLLATE "C" DESC`;

    if (limit && limit > 0) {
      params.push(limit);
      query += ` LIMIT $${params.length}`;
    }

    const result = await pool.query<TransacaoEntity>(query, params);
    return result.rows;
  },

  /**
   * Parcelas de empréstimo PENDENTES do período (vencimento) para o extrato, no formato de
   * TransacaoEntity. As pagas não entram: a liquidação registra a despesa em transacoes.
   */
  async extratoEmprestimos(
    userid: number,
    inicio: string | null,
    fimExclusivo: string | null,
    cursor: ExtratoCartaoCursor | null,
    limit: number | null
  ): Promise<TransacaoEntity[]> {
    const params: unknown[] = [
      normalizeUserIdToUuid(userid),
      String(userid),
      inicio,
      fimExclusivo,
      cursor?.data ?? null,
      cursor?.chave ?? null,
      userid,
    ];

    let query = `SELECT 'loan:' || li.id::text AS id,
                        'Parcela Empréstimo #' || li.installment_number
                          || COALESCE(' - ' || NULLIF(l.institution_name, ''), '') AS descricao,
                        'saida' AS tipo,
                        li.original_amount AS valor,
                        NULL::int AS categoria,
                        NULL::int AS idcategoria,
                        NULL::int AS idsubcategoria,
                        NULL::text AS categoria_nome,
                        NULL::text AS subcategoria_nome,
                        TO_CHAR(li.due_date::date, 'YYYY-MM-DD') AS data,
                        'pendente' AS status,
                        $7::int AS userid,
                        NULL::int AS cartaoid,
                        NULL::date AS pagamento,
                        'EMPRESTIMO' AS origem,
                        l.institution_name AS origem_rotulo,
                        li.id::text AS target_id,
                        'LOAN_INSTALLMENT' AS source_type,
                        l.id::text AS source_id
                 FROM loan_installments li
                 JOIN loans l ON l.id = li.loan_id
                 WHERE l.user_id IN ($1, $2)
                   AND li.status = 'PENDING'
                   AND ($3::date IS NULL OR li.due_date >= $3::date)
                   AND ($4::date IS NULL OR li.due_date <  $4::date)
                   AND ($5::date IS NULL OR (li.due_date::date, li.id::text COLLATE "C") < ($5::date, $6::text COLLATE "C"))
                 ORDER BY li.due_date DESC, li.id::text COLLATE "C" DESC`;

    if (limit && limit > 0) {
      params.push(limit);
      query += ` LIMIT $${params.length}`;
    }

    const result = await pool.query<TransacaoEntity>(query, params);
    return result.rows;
  },
};

