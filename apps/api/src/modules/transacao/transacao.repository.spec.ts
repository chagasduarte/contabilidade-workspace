import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../../core/config/database';
import { TransacaoRepository } from './transacao.repository';

vi.mock('../../core/config/database', () => ({
  pool: { connect: vi.fn(), query: vi.fn() },
}));
const item = {
  tipo: 'saida' as const,
  descricao: 'Compra',
  valor: 10,
  data: '2026-11-01',
  source_type: 'INSTALLMENT',
  source_id: 'compra',
};

describe('Persistência do parcelamento', () => {
  const client = { query: vi.fn(), release: vi.fn() };
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(pool.connect).mockResolvedValue(client as never);
    client.query.mockResolvedValue({ rows: [{ ...item, id: 1 }] });
  });
  it('confirma todas as parcelas na mesma transação', async () => {
    await TransacaoRepository.criarParcelamento([item, item], 7);
    expect(client.query.mock.calls[0]).toEqual(['BEGIN']);
    expect(client.query.mock.calls[1][1]).toEqual(
      expect.arrayContaining([7, 'INSTALLMENT', 'compra']),
    );
    expect(client.query.mock.calls[3]).toEqual(['COMMIT']);
    expect(client.release).toHaveBeenCalledOnce();
  });
  it('desfaz a compra inteira quando uma parcela falha', async () => {
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockRejectedValueOnce(new Error('falha'));
    await expect(
      TransacaoRepository.criarParcelamento([item, item], 7),
    ).rejects.toThrow('falha');
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledOnce();
  });
});
