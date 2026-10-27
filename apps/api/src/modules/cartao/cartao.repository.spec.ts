import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pool } from '../../core/config/database';
import { CartaoRepository } from './cartao.repository';

vi.mock('../../core/config/database', () => ({
  pool: { query: vi.fn() },
}));

const sqls = () => vi.mocked(pool.query).mock.calls.map(([sql]) => String(sql));

describe('CartaoRepository.listar (GET /cartao)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('é somente leitura: não sincroniza credit_cards -> cartoes no caminho de leitura', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{ id: 10, nome: 'Nubank', dia_fatura: 8, dia_vencimento: 8, limite: '1000', userid: 7 }],
    } as never);

    const cartoes = await CartaoRepository.listar(7);

    expect(cartoes).toHaveLength(1);
    expect(sqls()).toHaveLength(1);
    expect(sqls().every((q) => /^\s*SELECT/i.test(q))).toBe(true);
    expect(sqls().some((q) => /INSERT|UPDATE|DELETE/i.test(q))).toBe(false);
    expect(vi.mocked(pool.query).mock.calls[0][1]).toEqual([7]);
  });

  it('sem cartões legados, lê credit_cards do usuário (também só SELECT)', async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({
        rows: [{ id: 'uuid-1', nome: 'Inter', dia_fatura: 5, dia_vencimento: 12, limite: '2500.00', userid: 7 }],
      } as never);

    const cartoes = await CartaoRepository.listar(7);

    expect(cartoes).toEqual([
      { id: 'uuid-1', nome: 'Inter', dia_fatura: 5, dia_vencimento: 12, limite: 2500, userid: 7 },
    ]);
    expect(sqls().some((q) => /INSERT|UPDATE|DELETE/i.test(q))).toBe(false);
  });
});
