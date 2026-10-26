import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pool } from '../../core/config/database';
import { SettlementRepository, SettlementConflictError } from './settlement.repository';

vi.mock('../../core/config/database', () => ({
  pool: {
    connect: vi.fn(),
    query: vi.fn(),
  },
}));

const plannedRow = {
  id: '11111111-1111-1111-1111-111111111111',
  userid: 1,
  descricao: 'Salário',
  tipo: 'RECEITA',
  valor: '5000.00',
  data_prevista: '2026-03-05',
  idcategoria: null,
  recorrencia: 'NONE',
  status: 'PENDING',
};

/** Client fake: responde às queries na ordem do fluxo de settlePlannedTransaction. */
function mockClient(insertResult: () => Promise<unknown>) {
  const query = vi.fn(async (sql: string, _params?: unknown[]) => {
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
    if (sql.includes('FOR UPDATE')) return { rows: [plannedRow] };
    if (sql.includes('UPDATE planned_transactions')) return { rows: [{ ...plannedRow, status: 'SETTLED' }] };
    if (sql.includes('INSERT INTO transacoes')) return insertResult();
    return { rows: [] };
  });
  const client = { query, release: vi.fn() };
  vi.mocked(pool.connect).mockResolvedValue(client as never);
  return client;
}

describe('SettlementRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('grava receita efetivada como tipo "entrada" em transacoes', async () => {
    const client = mockClient(async () => ({
      rows: [{ id: 1, tipo: 'entrada', descricao: 'Salário', valor: '5000.00', data: '2026-03-05', status: 'pago', userid: 1 }],
    }));

    const res = await SettlementRepository.settlePlannedTransaction(plannedRow.id, {}, 1);

    const insert = client.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO transacoes'));
    expect(insert?.[1]?.[1]).toBe('entrada');
    expect(res.transacao.tipo).toBe('entrada');

    // Postgres rejeita FOR UPDATE sem OF quando há LEFT JOIN (lado anulável): trava só planned_transactions
    const select = client.query.mock.calls.find(([sql]) => String(sql).includes('FOR UPDATE'));
    expect(String(select?.[0])).toMatch(/FOR UPDATE OF pt\b/);
  });

  it('traduz violação de uq_transacoes_source em conflito (409)', async () => {
    const client = mockClient(async () => {
      throw Object.assign(new Error('duplicate key'), { code: '23505', constraint: 'uq_transacoes_source' });
    });

    await expect(SettlementRepository.settlePlannedTransaction(plannedRow.id, {}, 1)).rejects.toBeInstanceOf(
      SettlementConflictError
    );
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('mantém outros erros de banco inalterados', async () => {
    mockClient(async () => {
      throw Object.assign(new Error('outra unique'), { code: '23505', constraint: 'outra_constraint' });
    });

    await expect(SettlementRepository.settlePlannedTransaction(plannedRow.id, {}, 1)).rejects.toThrow('outra unique');
  });
});
