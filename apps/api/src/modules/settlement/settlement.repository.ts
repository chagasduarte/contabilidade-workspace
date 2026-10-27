// settlement.repository.ts
// Camada de persistência transacional (ACID) para efetivação contábil de obrigações pendentes

import { PoolClient } from 'pg';
import { pool } from '../../core/config/database';
import {
  SettleLoanInstallmentDto,
  SettleLoanInstallmentResponseDto,
  SettlePlannedTransactionDto,
  SettlePlannedTransactionResponseDto,
} from './settlement.dto';
import { mapPlannedTransactionEntity } from '../planned-transaction/planned-transaction.entity';
import { mapInstallmentEntity, normalizeUserIdToUuid } from '../loan/loan.repository';
import { TransacaoEntity } from '../transacao/transacao.types';

export class SettlementValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SettlementValidationError';
  }
}

export class SettlementNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SettlementNotFoundError';
  }
}

export class SettlementConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SettlementConflictError';
  }
}

/**
 * Traduz violação de uq_transacoes_source (migration 003) em conflito: a mesma origem
 * (planned/parcela) já gerou uma transação contábil. Demais erros seguem inalterados.
 */
function mapearErroDuplicidade(error: unknown): unknown {
  const pgErr = error as { code?: string; constraint?: string };
  if (pgErr?.code === '23505' && pgErr.constraint === 'uq_transacoes_source') {
    return new SettlementConflictError('Esta obrigação já foi efetivada anteriormente.');
  }
  return error;
}

function mapTransacaoRow(row: Record<string, unknown>): TransacaoEntity {
  return {
    id: Number(row['id']),
    tipo: String(row['tipo']) as 'entrada' | 'saida' | 'cartao',
    descricao: String(row['descricao'] ?? ''),
    valor: Number(row['valor'] ?? 0),
    categoria: row['categoria'] !== null && row['categoria'] !== undefined ? Number(row['categoria']) : null,
    idcategoria: row['idcategoria'] !== null && row['idcategoria'] !== undefined ? Number(row['idcategoria']) : null,
    idsubcategoria:
      row['idsubcategoria'] !== null && row['idsubcategoria'] !== undefined ? Number(row['idsubcategoria']) : null,
    categoria_nome: row['categoria_nome'] ? String(row['categoria_nome']) : null,
    subcategoria_nome: row['subcategoria_nome'] ? String(row['subcategoria_nome']) : null,
    data: row['data'] instanceof Date ? row['data'] : new Date(String(row['data'])),
    status: (row['status'] as 'pendente' | 'pago') ?? 'pago',
    userid: Number(row['userid']),
    ispaycart: Boolean(row['ispaycart'] ?? false),
    cartaoid: row['cartaoid'] !== null && row['cartaoid'] !== undefined ? Number(row['cartaoid']) : null,
    pagamento: row['pagamento'] ? (row['pagamento'] instanceof Date ? row['pagamento'] : new Date(String(row['pagamento']))) : null,
    source_type: row['source_type'] ? String(row['source_type']) : null,
    source_id: row['source_id'] ? String(row['source_id']) : null,
    criado_em: row['criado_em'] ? new Date(String(row['criado_em'])) : undefined,
    created_at: row['created_at'] ? new Date(String(row['created_at'])) : undefined,
  };
}

export const SettlementRepository = {
  /**
   * Efetiva atomicamente uma transação planejada (planned_transactions -> transacoes).
   * 1. Trava o registro com FOR UPDATE para evitar concorrência.
   * 2. Valida pertencimento ao usuário e status 'PENDING'.
   * 3. Atualiza status para 'SETTLED'.
   * 4. Registra a operação contábil real na tabela `transacoes`.
   */
  async settlePlannedTransaction(
    id: string,
    dto: SettlePlannedTransactionDto,
    userId: number
  ): Promise<SettlePlannedTransactionResponseDto> {
    const client: PoolClient = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Busca a transação planejada com bloqueio exclusivo
      const selectQuery = `
        SELECT pt.*, c.nome AS categoria_nome, c.icone AS categoria_icone
        FROM planned_transactions pt
        LEFT JOIN categoria c ON c.id = pt.idcategoria AND (c.userid = pt.userid OR c.userid IS NULL)
        WHERE pt.id = $1 AND pt.userid = $2
        FOR UPDATE OF pt
      `;
      const selectResult = await client.query(selectQuery, [id, userId]);

      if (selectResult.rows.length === 0) {
        throw new SettlementNotFoundError('Transação planejada não encontrada.');
      }

      const plannedRow = selectResult.rows[0];

      // 2. Valida status 'PENDING'
      if (plannedRow.status !== 'PENDING') {
        throw new SettlementConflictError(
          `Apenas transações planejadas com status 'PENDING' podem ser efetivadas. Status atual: '${plannedRow.status}'.`
        );
      }

      // 3. Atualiza planned_transactions para SETTLED
      const updateQuery = `
        UPDATE planned_transactions
        SET status = 'SETTLED', updated_at = clock_timestamp()
        WHERE id = $1 AND userid = $2
        RETURNING *
      `;
      const updateResult = await client.query(updateQuery, [id, userId]);
      const updatedPlannedRow = updateResult.rows[0];
      updatedPlannedRow.categoria_nome = plannedRow.categoria_nome;
      updatedPlannedRow.categoria_icone = plannedRow.categoria_icone;

      // 4. Determina valores para inserção na tabela transacoes
      const valorFinal =
        dto.valor_pago !== undefined && dto.valor_pago !== null
          ? Number(dto.valor_pago)
          : Number(plannedRow.valor);

      const dataFinal = dto.data_pagamento
        ? new Date(dto.data_pagamento)
        : new Date();

      const idCategoriaFinal =
        dto.idcategoria !== undefined && dto.idcategoria !== null
          ? Number(dto.idcategoria)
          : plannedRow.idcategoria !== null
          ? Number(plannedRow.idcategoria)
          : null;

      const descricaoFinal = dto.descricao?.trim() || plannedRow.descricao;
      // transacoes usa o vocabulário entrada/saida (GET /transacoes e /entradas filtram por ele)
      const tipoFinal = plannedRow.tipo === 'RECEITA' ? 'entrada' : 'saida';

      // categoria (legado) e idsubcategoria ficam NULL: a efetivação não tem subcategoria e não
      // repete o id da categoria na coluna legada (ver PROPOSTAS_SQL.md / backfill da fase 3)
      const insertTransacaoQuery = `
        WITH r AS (
          INSERT INTO transacoes (
            descricao,
            tipo,
            valor,
            data,
            status,
            userid,
            idcategoria,
            categoria,
            source_type,
            source_id,
            pagamento,
            idsubcategoria
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NULL)
          RETURNING *
        )
        SELECT r.*, cn.nome AS categoria_nome, NULL::varchar AS subcategoria_nome
        FROM r
        LEFT JOIN categoria cn ON cn.id = r.idcategoria AND (cn.userid = r.userid OR cn.userid IS NULL)
      `;

      const transacaoResult = await client.query(insertTransacaoQuery, [
        descricaoFinal,
        tipoFinal,
        valorFinal,
        dataFinal,
        'pago',
        userId,
        idCategoriaFinal,
        null,
        'PLANNED',
        String(id),
        dataFinal,
      ]);

      await client.query('COMMIT');

      return {
        success: true,
        message: 'Transação planejada efetivada com sucesso.',
        transacao: mapTransacaoRow(transacaoResult.rows[0]),
        planned_transaction: mapPlannedTransactionEntity(updatedPlannedRow),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw mapearErroDuplicidade(error);
    } finally {
      client.release();
    }
  },

  /**
   * Efetiva atomicamente uma parcela de empréstimo (loan_installments -> transacoes).
   * 1. Trava o registro da parcela com FOR UPDATE.
   * 2. Valida pertencimento ao usuário via contrato do empréstimo e status 'PENDING'.
   * 3. Atualiza o status da parcela para 'PAID'.
   * 4. Registra auditoria em loan_payments.
   * 5. Se todas as parcelas forem pagas, marca o contrato como 'PAID_OFF'.
   * 6. Registra a despesa na tabela contábil real `transacoes`.
   */
  async settleLoanInstallment(
    installmentId: string,
    dto: SettleLoanInstallmentDto,
    userId: number
  ): Promise<SettleLoanInstallmentResponseDto> {
    const client: PoolClient = await pool.connect();

    try {
      await client.query('BEGIN');

      const userUuid = normalizeUserIdToUuid(userId);

      // 1. Busca parcela vinculada ao empréstimo com bloqueio exclusivo
      const selectQuery = `
        SELECT 
          li.*,
          l.user_id,
          l.institution_name,
          l.id AS loan_id
        FROM loan_installments li
        INNER JOIN loans l ON l.id = li.loan_id
        WHERE li.id = $1
        FOR UPDATE OF li
      `;
      const selectResult = await client.query(selectQuery, [installmentId]);

      if (selectResult.rows.length === 0) {
        throw new SettlementNotFoundError('Parcela de empréstimo não encontrada.');
      }

      const row = selectResult.rows[0];

      // 2. Valida se pertence ao usuário autenticado (suporta UUID normalizado ou id direto)
      const loanUserId = String(row.user_id).trim();
      const belongsToUser =
        loanUserId === userUuid ||
        loanUserId === String(userId) ||
        loanUserId.endsWith(String(userId).padStart(12, '0'));

      if (!belongsToUser) {
        throw new SettlementNotFoundError('Parcela de empréstimo não encontrada.');
      }

      // 3. Valida se a parcela está 'PENDING'
      if (row.status !== 'PENDING') {
        throw new SettlementConflictError(
          `Apenas parcelas com status 'PENDING' podem ser liquidadas. Status atual: '${row.status}'.`
        );
      }

      // 4. Atualiza a parcela para 'PAID'
      const updateInstallmentQuery = `
        UPDATE loan_installments
        SET status = 'PAID'
        WHERE id = $1
        RETURNING *
      `;
      const updateResult = await client.query(updateInstallmentQuery, [installmentId]);
      const updatedInstallment = mapInstallmentEntity(updateResult.rows[0]);

      // 5. Determina valores da operação
      const valorFinal =
        dto.valor_pago !== undefined && dto.valor_pago !== null
          ? Number(dto.valor_pago)
          : Number(row.original_amount);

      const dataFinal = dto.data_pagamento
        ? new Date(dto.data_pagamento)
        : new Date();

      const idCategoriaFinal =
        dto.idcategoria !== undefined && dto.idcategoria !== null
          ? Number(dto.idcategoria)
          : null;

      const defaultDescricao = `Parcela Empréstimo #${row.installment_number}${
        row.institution_name ? ` - ${row.institution_name}` : ''
      }`;
      const descricaoFinal = dto.descricao?.trim() || defaultDescricao;

      // 6. Registra auditoria em loan_payments
      try {
        await client.query(
          `INSERT INTO loan_payments (
            loan_id,
            installment_id,
            payment_date,
            amount_paid,
            discount_amount,
            penalty_interest,
            payment_method
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [row.loan_id, installmentId, dataFinal, valorFinal, 0, 0, 'LIQUIDACAO_DIRETA']
        );
      } catch (payErr) {
        console.warn('[SettlementRepository] Aviso ao registrar em loan_payments:', payErr);
      }

      // 7. Checa se todas as parcelas do empréstimo foram quitadas
      const checkPendingQuery = `
        SELECT COUNT(*)::int AS pendentes
        FROM loan_installments
        WHERE loan_id = $1 AND status != 'PAID'
      `;
      const checkResult = await client.query(checkPendingQuery, [row.loan_id]);
      const pendentes = Number(checkResult.rows[0]?.pendentes ?? 0);
      const loanPaidOff = pendentes === 0;

      if (loanPaidOff) {
        await client.query('UPDATE loans SET status = $1 WHERE id = $2', [
          'PAID_OFF',
          row.loan_id,
        ]);
      }

      // 8. Registra a despesa na tabela contábil real transacoes
      // categoria (legado) e idsubcategoria ficam NULL: a efetivação não tem subcategoria e não
      // repete o id da categoria na coluna legada (ver PROPOSTAS_SQL.md / backfill da fase 3)
      const insertTransacaoQuery = `
        WITH r AS (
          INSERT INTO transacoes (
            descricao,
            tipo,
            valor,
            data,
            status,
            userid,
            idcategoria,
            categoria,
            source_type,
            source_id,
            pagamento,
            idsubcategoria
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NULL)
          RETURNING *
        )
        SELECT r.*, cn.nome AS categoria_nome, NULL::varchar AS subcategoria_nome
        FROM r
        LEFT JOIN categoria cn ON cn.id = r.idcategoria AND (cn.userid = r.userid OR cn.userid IS NULL)
      `;

      const transacaoResult = await client.query(insertTransacaoQuery, [
        descricaoFinal,
        'saida',
        valorFinal,
        dataFinal,
        'pago',
        userId,
        idCategoriaFinal,
        null,
        'LOAN_INSTALLMENT',
        String(installmentId),
        dataFinal,
      ]);

      await client.query('COMMIT');

      return {
        success: true,
        message: 'Parcela de empréstimo liquidada com sucesso.',
        transacao: mapTransacaoRow(transacaoResult.rows[0]),
        installment: updatedInstallment,
        loan_paid_off: loanPaidOff,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw mapearErroDuplicidade(error);
    } finally {
      client.release();
    }
  },
};

