import { PoolClient } from 'pg';
import { pool } from '../../core/config/database';
import {
  LoanEntity,
  LoanInstallmentEntity,
  LoanStatus,
  InstallmentStatus,
} from './loan.entity';

/**
 * Ordenação da listagem de empréstimos. COALESCE(created_at, 'infinity') em DESC reproduz o
 * NULLS FIRST padrão do Postgres e permite comparar a tupla no keyset; id desempata.
 */
const ORDEM_LOANS = `contracted_at DESC, COALESCE(created_at, 'infinity'::timestamptz) DESC, id DESC`;

/** Chave keyset de loans: (contracted_at, created_at, id); created_at como texto (microssegundos). */
export interface LoanCursor {
  contracted_at: string;
  created_at: string;
  id: string;
  [k: string]: string;
}

/**
 * Converte qualquer ID de usuário (numérico ou string) em um formato UUID válido para PostgreSQL.
 */
export function normalizeUserIdToUuid(userId: number | string): string {
  const str = String(userId).trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) {
    return str;
  }
  const clean = str.replace(/[^0-9a-f]/gi, '').slice(0, 12);
  const padded = clean.padStart(12, '0');
  return `00000000-0000-0000-0000-${padded}`;
}

export function parseUserIdFromUuid(uuid: string): number {
  const lastPart = uuid.split('-').pop() || '';
  const num = parseInt(lastPart, 10);
  return isNaN(num) ? 0 : num;
}

export function mapLoanEntity(row: Record<string, unknown>): LoanEntity {
  const id = String(row['id']);
  const userId = normalizeUserIdToUuid(String(row['user_id'] ?? row['usuario_id'] ?? ''));
  const institutionName = String(row['institution_name'] ?? row['instituicao'] ?? '');
  const principalAmount = Number(row['principal_amount'] ?? row['valor_principal'] ?? 0);
  const monthlyInterestRate = Number(row['monthly_interest_rate'] ?? row['taxa_juros_mensal'] ?? 0);
  const status = (row['status'] as LoanStatus) ?? 'ACTIVE';
  const contractedAt =
    row['contracted_at'] instanceof Date
      ? row['contracted_at']
      : row['data_contratacao'] instanceof Date
      ? row['data_contratacao']
      : new Date(String(row['contracted_at'] ?? row['data_contratacao']));
  const createdAt = row['created_at'] || row['criado_em']
    ? new Date(String(row['created_at'] ?? row['criado_em']))
    : undefined;

  return {
    id,
    user_id: userId,
    institution_name: institutionName,
    principal_amount: principalAmount,
    monthly_interest_rate: monthlyInterestRate,
    status,
    contracted_at: contractedAt,
    created_at: createdAt,

    // Aliases para compatibilidade
    usuario_id: parseUserIdFromUuid(userId),
    instituicao: institutionName,
    valor_principal: principalAmount,
    taxa_juros_mensal: monthlyInterestRate,
    data_contratacao: contractedAt,
    criado_em: createdAt,
  };
}

export function mapInstallmentEntity(row: Record<string, unknown>): LoanInstallmentEntity {
  const id = String(row['id']);
  const loanId = String(row['loan_id'] ?? row['emprestimo_id'] ?? '');
  const installmentNumber = Number(row['installment_number'] ?? row['numero_parcela'] ?? 0);
  const dueDate =
    row['due_date'] instanceof Date
      ? row['due_date']
      : row['data_vencimento'] instanceof Date
      ? row['data_vencimento']
      : new Date(String(row['due_date'] ?? row['data_vencimento']));
  const originalAmount = Number(row['original_amount'] ?? row['valor_original'] ?? 0);
  const principalComponent = Number(row['principal_component'] ?? row['valor_amortizacao'] ?? 0);
  const interestComponent = Number(row['interest_component'] ?? row['valor_juros'] ?? 0);
  const status = (row['status'] as InstallmentStatus) ?? 'PENDING';
  const createdAt = row['created_at'] || row['criado_em']
    ? new Date(String(row['created_at'] ?? row['criado_em']))
    : undefined;

  return {
    id,
    loan_id: loanId,
    installment_number: installmentNumber,
    due_date: dueDate,
    original_amount: originalAmount,
    principal_component: principalComponent,
    interest_component: interestComponent,
    status,
    created_at: createdAt,

    // Aliases para compatibilidade
    emprestimo_id: loanId,
    numero_parcela: installmentNumber,
    data_vencimento: dueDate,
    valor_original: originalAmount,
    valor_amortizacao: principalComponent,
    valor_juros: interestComponent,
    criado_em: createdAt,
  };
}

export interface CreateLoanContractInput {
  user_id: string;
  institution_name: string;
  principal_amount: number;
  monthly_interest_rate: number;
  status?: LoanStatus;
  contracted_at?: Date | string;

  // Aliases
  usuario_id?: number | string;
  instituicao?: string;
  valor_principal?: number;
  taxa_juros_mensal?: number;
  data_contratacao?: Date | string;
}

export interface CreateInstallmentInput {
  installment_number: number;
  due_date: Date | string;
  original_amount: number;
  principal_component: number;
  interest_component: number;
  status?: InstallmentStatus;

  // Aliases
  numero_parcela?: number;
  data_vencimento?: Date | string;
  valor_original?: number;
  valor_amortizacao?: number;
  valor_juros?: number;
}

export const LoanRepository = {
  /**
   * Cria o contrato de empréstimo e todas as parcelas geradas em lote dentro de uma transação explícita.
   */
  async criarComParcelas(
    contrato: CreateLoanContractInput,
    parcelas: CreateInstallmentInput[]
  ): Promise<{
    loan: LoanEntity;
    installments: LoanInstallmentEntity[];
    emprestimo: LoanEntity;
    parcelas: LoanInstallmentEntity[];
  }> {
    const client: PoolClient = await pool.connect();

    try {
      await client.query('BEGIN');

      const dataContratacaoRaw = contrato.contracted_at ?? contrato.data_contratacao;
      const dataContratacao = dataContratacaoRaw ? new Date(dataContratacaoRaw) : new Date();
      const statusContrato = contrato.status ?? 'ACTIVE';
      const userId = normalizeUserIdToUuid(contrato.user_id ?? contrato.usuario_id ?? '');
      const institutionName = (contrato.institution_name ?? contrato.instituicao ?? '').trim();
      const principalAmount = Number(contrato.principal_amount ?? contrato.valor_principal);
      const monthlyRate = Number(contrato.monthly_interest_rate ?? contrato.taxa_juros_mensal);

      const loanQuery = `
        INSERT INTO loans (
          user_id,
          institution_name,
          principal_amount,
          monthly_interest_rate,
          status,
          contracted_at
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const loanResult = await client.query(loanQuery, [
        userId,
        institutionName,
        principalAmount,
        monthlyRate,
        statusContrato,
        dataContratacao,
      ]);

      const emprestimo = mapLoanEntity(loanResult.rows[0]);

      let parcelasCriadas: LoanInstallmentEntity[] = [];

      if (parcelas.length > 0) {
        const values: unknown[] = [];
        const placeholders: string[] = [];
        let pIndex = 1;

        for (const p of parcelas) {
          placeholders.push(
            `($${pIndex++}, $${pIndex++}, $${pIndex++}, $${pIndex++}, $${pIndex++}, $${pIndex++}, $${pIndex++})`
          );
          const installmentNum = p.installment_number ?? p.numero_parcela;
          const dueDateRaw = p.due_date ?? p.data_vencimento;
          const dueDate = dueDateRaw instanceof Date ? dueDateRaw : new Date(dueDateRaw!);
          const originalAmt = Number(p.original_amount ?? p.valor_original);
          const principalComp = Number(p.principal_component ?? p.valor_amortizacao);
          const interestComp = Number(p.interest_component ?? p.valor_juros);

          values.push(
            emprestimo.id,
            installmentNum,
            dueDate,
            originalAmt,
            principalComp,
            interestComp,
            p.status ?? 'PENDING'
          );
        }

        const installmentsQuery = `
          INSERT INTO loan_installments (
            loan_id,
            installment_number,
            due_date,
            original_amount,
            principal_component,
            interest_component,
            status
          )
          VALUES ${placeholders.join(', ')}
          RETURNING *
        `;

        const installmentResult = await client.query(installmentsQuery, values);
        parcelasCriadas = installmentResult.rows.map(mapInstallmentEntity);
      }

      await client.query('COMMIT');

      return {
        loan: emprestimo,
        installments: parcelasCriadas,
        emprestimo,
        parcelas: parcelasCriadas,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Busca um empréstimo por ID (com filtro opcional por usuário).
   */
  async buscarPorId(
    id: string,
    userId?: number | string,
    client?: PoolClient
  ): Promise<LoanEntity | undefined> {
    const runner = client ?? pool;
    const userUuid = userId ? normalizeUserIdToUuid(userId) : undefined;
    const query = userUuid
      ? 'SELECT * FROM loans WHERE id = $1 AND user_id = $2 LIMIT 1'
      : 'SELECT * FROM loans WHERE id = $1 LIMIT 1';
    const params = userUuid ? [id, userUuid] : [id];

    const result = await runner.query(query, params);
    if (!result.rows[0]) return undefined;
    return mapLoanEntity(result.rows[0]);
  },

  /**
   * Lista todos os empréstimos de um determinado usuário.
   */
  async listarPorUsuario(userId: number | string): Promise<LoanEntity[]> {
    const userUuid = normalizeUserIdToUuid(userId);
    const result = await pool.query(
      `SELECT * FROM loans WHERE user_id = $1
       ORDER BY ${ORDEM_LOANS}`,
      [userUuid]
    );
    return result.rows.map(mapLoanEntity);
  },

  /**
   * Página da listagem de empréstimos (keyset), com a mesma ordenação de `listarPorUsuario`.
   * Busca limit + 1 linhas para saber se existe próxima página.
   */
  async listarPaginaPorUsuario(
    userId: number | string,
    apos: LoanCursor | null,
    limit: number
  ): Promise<{ items: LoanEntity[]; proxima: LoanCursor | null }> {
    const params: unknown[] = [normalizeUserIdToUuid(userId)];
    let filtroCursor = '';
    if (apos) {
      params.push(apos.contracted_at, apos.created_at, apos.id);
      filtroCursor = `AND (contracted_at, COALESCE(created_at, 'infinity'::timestamptz), id)
                          < ($2::date, $3::timestamptz, $4::uuid)`;
    }
    params.push(limit + 1);

    const result = await pool.query(
      `SELECT *,
              TO_CHAR(contracted_at, 'YYYY-MM-DD') AS cursor_contracted_at,
              COALESCE(created_at, 'infinity'::timestamptz)::text AS cursor_created_at
       FROM loans
       WHERE user_id = $1 ${filtroCursor}
       ORDER BY ${ORDEM_LOANS}
       LIMIT $${params.length}`,
      params
    );

    const temMais = result.rows.length > limit;
    const rows = temMais ? result.rows.slice(0, limit) : result.rows;
    const ultima = rows[rows.length - 1];
    return {
      items: rows.map(mapLoanEntity),
      proxima:
        temMais && ultima
          ? { contracted_at: ultima.cursor_contracted_at, created_at: ultima.cursor_created_at, id: String(ultima.id) }
          : null,
    };
  },

  /**
   * Lista todas as parcelas de um empréstimo ordenadas pelo número da parcela.
   */
  async listarParcelas(
    loanId: string,
    client?: PoolClient
  ): Promise<LoanInstallmentEntity[]> {
    const runner = client ?? pool;
    const result = await runner.query(
      'SELECT * FROM loan_installments WHERE loan_id = $1 ORDER BY installment_number ASC',
      [loanId]
    );
    return result.rows.map(mapInstallmentEntity);
  },

  /**
   * Busca uma parcela específica por ID.
   */
  async buscarParcelaPorId(
    parcelaId: string,
    client?: PoolClient
  ): Promise<LoanInstallmentEntity | undefined> {
    const runner = client ?? pool;
    const result = await runner.query(
      'SELECT * FROM loan_installments WHERE id = $1 LIMIT 1',
      [parcelaId]
    );
    if (!result.rows[0]) return undefined;
    return mapInstallmentEntity(result.rows[0]);
  },

  /**
   * Atualiza o status de um contrato de empréstimo.
   */
  async atualizarStatus(
    id: string,
    status: LoanStatus,
    client?: PoolClient
  ): Promise<LoanEntity | undefined> {
    const runner = client ?? pool;
    const result = await runner.query(
      'UPDATE loans SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    if (!result.rows[0]) return undefined;
    return mapLoanEntity(result.rows[0]);
  },
};
