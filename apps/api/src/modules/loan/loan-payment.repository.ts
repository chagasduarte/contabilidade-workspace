import { PoolClient } from 'pg';
import { pool } from '../../core/config/database';
import {
  LoanPaymentEntity,
  LoanInstallmentEntity,
  LoanEntity,
} from './loan.entity';
import { mapLoanEntity, mapInstallmentEntity } from './loan.repository';

export function mapPaymentEntity(row: Record<string, unknown>): LoanPaymentEntity {
  const id = String(row['id']);
  const loanId = String(row['loan_id'] ?? row['emprestimo_id'] ?? '');
  const installmentId = (row['installment_id'] ?? row['parcela_id'])
    ? String(row['installment_id'] ?? row['parcela_id'])
    : null;
  const paymentDate =
    row['payment_date'] instanceof Date
      ? row['payment_date']
      : row['data_pagamento'] instanceof Date
      ? row['data_pagamento']
      : new Date(String(row['payment_date'] ?? row['data_pagamento']));
  const amountPaid = Number(row['amount_paid'] ?? row['valor_pago'] ?? 0);
  const discountAmount = Number(row['discount_amount'] ?? row['valor_desconto'] ?? 0);
  const penaltyInterest = Number(row['penalty_interest'] ?? row['multa_juros'] ?? 0);
  const paymentMethod = String(row['payment_method'] ?? row['metodo_pagamento'] ?? '');
  const createdAt = row['created_at'] || row['criado_em']
    ? new Date(String(row['created_at'] ?? row['criado_em']))
    : undefined;

  return {
    id,
    loan_id: loanId,
    installment_id: installmentId,
    payment_date: paymentDate,
    amount_paid: amountPaid,
    discount_amount: discountAmount,
    penalty_interest: penaltyInterest,
    payment_method: paymentMethod,
    created_at: createdAt,

    // Aliases para compatibilidade
    emprestimo_id: loanId,
    parcela_id: installmentId,
    data_pagamento: paymentDate,
    valor_pago: amountPaid,
    valor_desconto: discountAmount,
    multa_juros: penaltyInterest,
    metodo_pagamento: paymentMethod,
    criado_em: createdAt,
  };
}

/** A parcela já estava PAID ao travar o registro (pagamento concorrente/duplo clique). */
export class ParcelaJaQuitadaError extends Error {
  constructor() {
    super('Esta parcela já foi quitada.');
    this.name = 'ParcelaJaQuitadaError';
  }
}

export interface CreatePaymentInput {
  loan_id: string;
  installment_id?: string | null;
  /** Dono do empréstimo; recebe a despesa paga em `transacoes`. */
  usuario_id: number;
  /** Descrição da despesa registrada em `transacoes`. */
  descricao_despesa: string;
  payment_date?: Date | string;
  amount_paid: number;
  discount_amount?: number;
  penalty_interest?: number;
  payment_method: string;

  // Aliases para compatibilidade
  emprestimo_id?: string;
  parcela_id?: string | null;
  data_pagamento?: Date | string;
  valor_pago?: number;
  valor_desconto?: number;
  multa_juros?: number;
  metodo_pagamento?: string;
}

export interface RegisterPaymentResult {
  payment: LoanPaymentEntity;
  installment?: LoanInstallmentEntity;
  loan?: LoanEntity;
  pagamento: LoanPaymentEntity;
  parcela?: LoanInstallmentEntity;
  emprestimoAtualizado?: LoanEntity;
}

export const LoanPaymentRepository = {
  /**
   * Registra um pagamento/amortização de parcela em transação explícita:
   * 1. Insere o registro em `loan_payments`
   * 2. Atualiza o status da parcela em `loan_installments` para 'PAID'
   * 3. Checa atomicamente se restam parcelas pendentes
   * 4. Se todas estiverem quitadas, atualiza o status de `loans` para 'PAID_OFF'
   * 5. Registra a despesa paga em `transacoes` (source_type LOAN_INSTALLMENT), como a
   *    liquidação por /loans/installments/:id/settle: enquanto pendente a parcela é planejada,
   *    depois de paga passa a ser saída executada
   */
  async registrarPagamento(
    dados: CreatePaymentInput
  ): Promise<RegisterPaymentResult> {
    const client: PoolClient = await pool.connect();

    try {
      await client.query('BEGIN');

      const loanId = dados.loan_id ?? dados.emprestimo_id;
      const installmentId = dados.installment_id ?? dados.parcela_id ?? null;
      const paymentDateRaw = dados.payment_date ?? dados.data_pagamento;
      const dataPagamento = paymentDateRaw ? new Date(paymentDateRaw) : new Date();
      const amountPaid = Number(dados.amount_paid ?? dados.valor_pago);
      const discountAmount = Number(dados.discount_amount ?? dados.valor_desconto ?? 0);
      const penaltyInterest = Number(dados.penalty_interest ?? dados.multa_juros ?? 0);
      const paymentMethod = dados.payment_method ?? dados.metodo_pagamento;

      // 1. Salvar o registro em loan_payments
      const paymentQuery = `
        INSERT INTO loan_payments (
          loan_id,
          installment_id,
          payment_date,
          amount_paid,
          discount_amount,
          penalty_interest,
          payment_method
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

      const paymentResult = await client.query(paymentQuery, [
        loanId,
        installmentId,
        dataPagamento,
        amountPaid,
        discountAmount,
        penaltyInterest,
        paymentMethod,
      ]);

      const pagamento = mapPaymentEntity(paymentResult.rows[0]);

      // 2. Atualizar o status da parcela para 'PAID' se installmentId estiver presente.
      // `status <> 'PAID'` impede pagar duas vezes (e registrar a despesa em dobro).
      let parcela: LoanInstallmentEntity | undefined;
      if (installmentId) {
        const updateInstallmentQuery = `
          UPDATE loan_installments
          SET status = 'PAID'
          WHERE id = $1 AND loan_id = $2 AND status <> 'PAID'
          RETURNING *
        `;
        const installmentResult = await client.query(updateInstallmentQuery, [
          installmentId,
          loanId,
        ]);
        if (!installmentResult.rows[0]) {
          throw new ParcelaJaQuitadaError();
        }
        parcela = mapInstallmentEntity(installmentResult.rows[0]);
      }

      // 3. Checar atomicamente se restam parcelas pendentes
      const checkPendingQuery = `
        SELECT COUNT(*)::int AS pendentes
        FROM loan_installments
        WHERE loan_id = $1 AND status != 'PAID'
      `;
      const checkResult = await client.query(checkPendingQuery, [loanId]);
      const pendentes = Number(checkResult.rows[0]?.pendentes ?? 0);

      // 4. Se todas quitadas, atualizar o status do empréstimo para 'PAID_OFF'
      let emprestimoAtualizado: LoanEntity | undefined;
      if (pendentes === 0) {
        const updateLoanQuery = `
          UPDATE loans
          SET status = 'PAID_OFF'
          WHERE id = $1
          RETURNING *
        `;
        const loanResult = await client.query(updateLoanQuery, [loanId]);
        if (loanResult.rows[0]) {
          emprestimoAtualizado = mapLoanEntity(loanResult.rows[0]);
        }
      }

      // 5. Despesa executada na tabela contábil `transacoes`
      await client.query(
        `INSERT INTO transacoes (descricao, tipo, valor, data, status, userid, source_type, source_id, pagamento)
         VALUES ($1, 'saida', $2, $3, 'pago', $4, 'LOAN_INSTALLMENT', $5, $3)`,
        [dados.descricao_despesa, amountPaid, dataPagamento, dados.usuario_id, installmentId ?? loanId]
      );

      await client.query('COMMIT');

      return {
        payment: pagamento,
        installment: parcela,
        loan: emprestimoAtualizado,
        pagamento,
        parcela,
        emprestimoAtualizado,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Busca um pagamento por ID.
   */
  async buscarPorId(
    id: string,
    client?: PoolClient
  ): Promise<LoanPaymentEntity | undefined> {
    const runner = client ?? pool;
    const result = await runner.query(
      'SELECT * FROM loan_payments WHERE id = $1 LIMIT 1',
      [id]
    );
    if (!result.rows[0]) return undefined;
    return mapPaymentEntity(result.rows[0]);
  },

  /**
   * Lista o histórico de pagamentos de um empréstimo ordenado cronologicamente.
   */
  async listarPagamentosPorEmprestimo(
    loanId: string,
    client?: PoolClient
  ): Promise<LoanPaymentEntity[]> {
    const runner = client ?? pool;
    const result = await runner.query(
      'SELECT * FROM loan_payments WHERE loan_id = $1 ORDER BY payment_date ASC, created_at ASC',
      [loanId]
    );
    return result.rows.map(mapPaymentEntity);
  },

  /**
   * Lista o histórico de pagamentos de uma parcela específica.
   */
  async listarPagamentosPorParcela(
    installmentId: string,
    client?: PoolClient
  ): Promise<LoanPaymentEntity[]> {
    const runner = client ?? pool;
    const result = await runner.query(
      'SELECT * FROM loan_payments WHERE installment_id = $1 ORDER BY payment_date ASC, created_at ASC',
      [installmentId]
    );
    return result.rows.map(mapPaymentEntity);
  },
};
