// card.repository.ts

import { PoolClient } from 'pg';
import { pool } from '../../core/config/database';
import {
  CreditCardEntity,
  CardInvoiceEntity,
  CardTransactionEntity,
  InvoiceItemEntity,
  InvoiceStatus,
} from './card.entity';
import { CreateCardDto } from './card.dto';

export function mapCreditCardEntity(row: Record<string, unknown>): CreditCardEntity {
  return {
    id: String(row['id']),
    usuario_id: Number(row['usuario_id']),
    nome: String(row['nome'] ?? ''),
    bandeira: row['bandeira'] ? String(row['bandeira']) : null,
    limite_total: Number(row['limite_total'] ?? 0),
    dia_fechamento: Number(row['dia_fechamento'] ?? 1),
    dia_vencimento: Number(row['dia_vencimento'] ?? 10),
    cor_identificacao: String(row['cor_identificacao'] ?? '#6c757d'),
    ativo: Boolean(row['ativo'] ?? true),
    criado_em: row['criado_em'] ? new Date(String(row['criado_em'])) : undefined,
    atualizado_em: row['atualizado_em'] ? new Date(String(row['atualizado_em'])) : undefined,
  };
}

export function mapInvoiceEntity(row: Record<string, unknown>): CardInvoiceEntity {
  return {
    id: String(row['id']),
    cartao_id: String(row['cartao_id']),
    mes_referencia: Number(row['mes_referencia']),
    ano_referencia: Number(row['ano_referencia']),
    data_fechamento:
      row['data_fechamento'] instanceof Date
        ? row['data_fechamento']
        : new Date(String(row['data_fechamento'])),
    data_vencimento:
      row['data_vencimento'] instanceof Date
        ? row['data_vencimento']
        : new Date(String(row['data_vencimento'])),
    status: (row['status'] as InvoiceStatus) ?? 'OPEN',
    data_pagamento: row['data_pagamento'] ? new Date(String(row['data_pagamento'])) : null,
    valor_pago: row['valor_pago'] !== null && row['valor_pago'] !== undefined ? Number(row['valor_pago']) : null,
    total_fatura: row['total_fatura'] !== undefined ? Number(row['total_fatura']) : 0,
    itens_count: row['itens_count'] !== undefined ? Number(row['itens_count']) : 0,
    criado_em: row['criado_em'] ? new Date(String(row['criado_em'])) : undefined,
    atualizado_em: row['atualizado_em'] ? new Date(String(row['atualizado_em'])) : undefined,
  };
}

export function mapTransactionEntity(row: Record<string, unknown>): CardTransactionEntity {
  return {
    id: String(row['id']),
    cartao_id: String(row['cartao_id']),
    categoria_id: row['categoria_id'] !== null && row['categoria_id'] !== undefined ? Number(row['categoria_id']) : null,
    descricao: String(row['descricao'] ?? ''),
    valor_total: Number(row['valor_total'] ?? 0),
    quantidade_parcelas: Number(row['quantidade_parcelas'] ?? 1),
    data_compra:
      row['data_compra'] instanceof Date
        ? row['data_compra']
        : new Date(String(row['data_compra'])),
    criado_em: row['criado_em'] ? new Date(String(row['criado_em'])) : undefined,
  };
}

export function mapInvoiceItemEntity(row: Record<string, unknown>): InvoiceItemEntity {
  return {
    id: String(row['id']),
    fatura_id: String(row['fatura_id']),
    transacao_id: String(row['transacao_id']),
    numero_parcela: Number(row['numero_parcela']),
    valor_parcela: Number(row['valor_parcela']),
    descricao: row['descricao'] ? String(row['descricao']) : undefined,
    data_compra: row['data_compra'] ? new Date(String(row['data_compra'])) : undefined,
    quantidade_parcelas: row['quantidade_parcelas'] !== undefined ? Number(row['quantidade_parcelas']) : undefined,
    categoria_id: row['categoria_id'] !== undefined && row['categoria_id'] !== null ? Number(row['categoria_id']) : null,
    categoria_nome: row['categoria_nome'] ? String(row['categoria_nome']) : undefined,
    categoria_cor: row['categoria_cor'] ? String(row['categoria_cor']) : undefined,
    categoria_icone: row['categoria_icone'] ? String(row['categoria_icone']) : undefined,
    criado_em: row['criado_em'] ? new Date(String(row['criado_em'])) : undefined,
  };
}

export const CardRepository = {
  /**
   * Cadastra um novo cartão de crédito para o usuário.
   */
  async criarCartao(
    dto: CreateCardDto,
    usuarioId: number,
    client?: PoolClient
  ): Promise<CreditCardEntity> {
    const runner = client ?? pool;
    const query = `
      INSERT INTO credit_cards (
        usuario_id,
        nome,
        bandeira,
        limite_total,
        dia_fechamento,
        dia_vencimento,
        cor_identificacao
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result = await runner.query(query, [
      usuarioId,
      dto.nome.trim(),
      dto.bandeira?.trim() || null,
      dto.limite_total,
      dto.dia_fechamento,
      dto.dia_vencimento,
      dto.cor_identificacao?.trim() || '#6c757d',
    ]);

    // Mantém sincronizado com a tabela legada cartoes para que dropdowns e transações funcionem imediatamente
    try {
      await runner.query(
        `INSERT INTO cartoes (nome, dia_fatura, dia_vencimento, limite, userid)
         SELECT $1, $2, $3, $4, $5
         WHERE NOT EXISTS (
           SELECT 1 FROM cartoes WHERE userid = $5 AND LOWER(TRIM(nome)) = LOWER(TRIM($1))
         )`,
        [dto.nome.trim(), dto.dia_fechamento, dto.dia_vencimento, dto.limite_total, usuarioId]
      );
    } catch {
      // Ignora falha de sincronização secundária
    }

    return mapCreditCardEntity(result.rows[0]);
  },

  /**
   * Lista todos os cartões ativos de um determinado usuário.
   */
  async listarCartoesPorUsuario(
    usuarioId: number,
    client?: PoolClient
  ): Promise<CreditCardEntity[]> {
    const runner = client ?? pool;
    const query = `
      SELECT * FROM credit_cards
      WHERE usuario_id = $1 AND ativo = true
      ORDER BY nome ASC
    `;
    const result = await runner.query(query, [usuarioId]);
    return result.rows.map(mapCreditCardEntity);
  },

  /**
   * Busca um cartão específico por ID e opcionalmente valida a titularidade.
   */
  async buscarCartaoPorId(
    cartaoId: string,
    usuarioId?: number,
    client?: PoolClient
  ): Promise<CreditCardEntity | undefined> {
    const runner = client ?? pool;
    const query = usuarioId
      ? 'SELECT * FROM credit_cards WHERE id = $1 AND usuario_id = $2 LIMIT 1'
      : 'SELECT * FROM credit_cards WHERE id = $1 LIMIT 1';
    const params = usuarioId ? [cartaoId, usuarioId] : [cartaoId];

    const result = await runner.query(query, params);
    if (!result.rows[0]) return undefined;
    return mapCreditCardEntity(result.rows[0]);
  },

  /**
   * Calcula o limite total comprometido (soma dos itens de faturas não quitadas).
   */
  async obterLimiteComprometido(
    cartaoId: string,
    client?: PoolClient
  ): Promise<number> {
    const runner = client ?? pool;
    const query = `
      SELECT COALESCE(SUM(ii.valor_parcela), 0)::numeric AS comprometido
      FROM invoice_items ii
      JOIN card_invoices ci ON ii.fatura_id = ci.id
      WHERE ci.cartao_id = $1 AND ci.status != 'PAID'
    `;
    const result = await runner.query(query, [cartaoId]);
    return Number(result.rows[0]?.comprometido ?? 0);
  },

  /**
   * Busca uma fatura específica pelo mês e ano de referência.
   */
  async buscarFaturaPorMesAno(
    cartaoId: string,
    mes: number,
    ano: number,
    client?: PoolClient
  ): Promise<CardInvoiceEntity | undefined> {
    const runner = client ?? pool;
    const query = `
      SELECT ci.*,
             COALESCE(SUM(ii.valor_parcela), 0)::numeric AS total_fatura,
             COUNT(ii.id)::int AS itens_count
      FROM card_invoices ci
      LEFT JOIN invoice_items ii ON ci.id = ii.fatura_id
      WHERE ci.cartao_id = $1 AND ci.mes_referencia = $2 AND ci.ano_referencia = $3
      GROUP BY ci.id
      LIMIT 1
    `;
    const result = await runner.query(query, [cartaoId, mes, ano]);
    if (!result.rows[0]) return undefined;
    return mapInvoiceEntity(result.rows[0]);
  },

  /**
   * Cria uma fatura para o cartão ou atualiza caso já exista (idempotente).
   */
  async criarFatura(
    dados: {
      cartao_id: string;
      mes_referencia: number;
      ano_referencia: number;
      data_fechamento: Date;
      data_vencimento: Date;
      status?: InvoiceStatus;
    },
    client?: PoolClient
  ): Promise<CardInvoiceEntity> {
    const runner = client ?? pool;
    const query = `
      INSERT INTO card_invoices (
        cartao_id,
        mes_referencia,
        ano_referencia,
        data_fechamento,
        data_vencimento,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT ON CONSTRAINT uq_cartao_mes_ano
      DO UPDATE SET atualizado_em = clock_timestamp()
      RETURNING *
    `;

    const result = await runner.query(query, [
      dados.cartao_id,
      dados.mes_referencia,
      dados.ano_referencia,
      dados.data_fechamento,
      dados.data_vencimento,
      dados.status ?? 'OPEN',
    ]);

    return mapInvoiceEntity(result.rows[0]);
  },

  /**
   * Lista todas as faturas de um cartão ordenadas por ano e mês.
   */
  async listarFaturas(
    cartaoId: string,
    ano?: number,
    client?: PoolClient
  ): Promise<CardInvoiceEntity[]> {
    const runner = client ?? pool;
    const query = ano
      ? `
        SELECT ci.*,
               COALESCE(SUM(ii.valor_parcela), 0)::numeric AS total_fatura,
               COUNT(ii.id)::int AS itens_count
        FROM card_invoices ci
        LEFT JOIN invoice_items ii ON ci.id = ii.fatura_id
        WHERE ci.cartao_id = $1 AND ci.ano_referencia = $2
        GROUP BY ci.id
        ORDER BY ci.ano_referencia ASC, ci.mes_referencia ASC
      `
      : `
        SELECT ci.*,
               COALESCE(SUM(ii.valor_parcela), 0)::numeric AS total_fatura,
               COUNT(ii.id)::int AS itens_count
        FROM card_invoices ci
        LEFT JOIN invoice_items ii ON ci.id = ii.fatura_id
        WHERE ci.cartao_id = $1
        GROUP BY ci.id
        ORDER BY ci.ano_referencia ASC, ci.mes_referencia ASC
      `;
    const params = ano ? [cartaoId, ano] : [cartaoId];
    const result = await runner.query(query, params);
    return result.rows.map(mapInvoiceEntity);
  },

  /**
   * Busca fatura detalhada por ID.
   */
  async buscarFaturaPorId(
    faturaId: string,
    client?: PoolClient
  ): Promise<CardInvoiceEntity | undefined> {
    const runner = client ?? pool;
    const query = `
      SELECT ci.*,
             COALESCE(SUM(ii.valor_parcela), 0)::numeric AS total_fatura,
             COUNT(ii.id)::int AS itens_count
      FROM card_invoices ci
      LEFT JOIN invoice_items ii ON ci.id = ii.fatura_id
      WHERE ci.id = $1
      GROUP BY ci.id
      LIMIT 1
    `;
    const result = await runner.query(query, [faturaId]);
    if (!result.rows[0]) return undefined;
    return mapInvoiceEntity(result.rows[0]);
  },

  /**
   * Atualiza status e quitação de uma fatura.
   */
  async atualizarStatusFatura(
    faturaId: string,
    status: InvoiceStatus,
    dataPagamento?: Date | null,
    valorPago?: number | null,
    client?: PoolClient
  ): Promise<CardInvoiceEntity | undefined> {
    const runner = client ?? pool;
    const query = `
      UPDATE card_invoices
      SET status = $1,
          data_pagamento = $2,
          valor_pago = $3,
          atualizado_em = clock_timestamp()
      WHERE id = $4
      RETURNING *
    `;
    const result = await runner.query(query, [
      status,
      dataPagamento ?? null,
      valorPago ?? null,
      faturaId,
    ]);
    if (!result.rows[0]) return undefined;
    return mapInvoiceEntity(result.rows[0]);
  },

  /**
   * Insere a transação de compra em `card_transactions`.
   */
  async criarTransacao(
    dados: {
      cartao_id: string;
      categoria_id?: number | null;
      descricao: string;
      valor_total: number;
      quantidade_parcelas: number;
      data_compra: Date;
    },
    client: PoolClient
  ): Promise<CardTransactionEntity> {
    const query = `
      INSERT INTO card_transactions (
        cartao_id,
        categoria_id,
        descricao,
        valor_total,
        quantidade_parcelas,
        data_compra
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const result = await client.query(query, [
      dados.cartao_id,
      dados.categoria_id ?? null,
      dados.descricao.trim(),
      dados.valor_total,
      dados.quantidade_parcelas,
      dados.data_compra,
    ]);
    return mapTransactionEntity(result.rows[0]);
  },

  /**
   * Insere em lote as parcelas em `invoice_items`.
   */
  async criarItensFatura(
    itens: {
      fatura_id: string;
      transacao_id: string;
      numero_parcela: number;
      valor_parcela: number;
    }[],
    client: PoolClient
  ): Promise<InvoiceItemEntity[]> {
    if (itens.length === 0) return [];

    const values: unknown[] = [];
    const placeholders: string[] = [];
    let pIdx = 1;

    for (const item of itens) {
      placeholders.push(`($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++})`);
      values.push(
        item.fatura_id,
        item.transacao_id,
        item.numero_parcela,
        item.valor_parcela
      );
    }

    const query = `
      INSERT INTO invoice_items (
        fatura_id,
        transacao_id,
        numero_parcela,
        valor_parcela
      )
      VALUES ${placeholders.join(', ')}
      RETURNING *
    `;

    const result = await client.query(query, values);
    return result.rows.map(mapInvoiceItemEntity);
  },

  /**
   * Lista todos os lançamentos de uma fatura com os dados da transação e categoria vinculada.
   */
  async listarItensPorFatura(
    faturaId: string,
    client?: PoolClient
  ): Promise<InvoiceItemEntity[]> {
    const runner = client ?? pool;
    const query = `
      SELECT ii.id,
             ii.fatura_id,
             ii.transacao_id,
             ii.numero_parcela,
             ii.valor_parcela,
             ii.criado_em,
             ct.descricao,
             ct.data_compra,
             ct.quantidade_parcelas,
             ct.categoria_id,
             c.nome AS categoria_nome,
             c.cor AS categoria_cor,
             c.icone AS categoria_icone
      FROM invoice_items ii
      JOIN card_transactions ct ON ii.transacao_id = ct.id
      LEFT JOIN categoria c ON ct.categoria_id = c.id
      WHERE ii.fatura_id = $1
      ORDER BY ct.data_compra DESC, ii.numero_parcela ASC
    `;
    const result = await runner.query(query, [faturaId]);
    return result.rows.map(mapInvoiceItemEntity);
  },
};

