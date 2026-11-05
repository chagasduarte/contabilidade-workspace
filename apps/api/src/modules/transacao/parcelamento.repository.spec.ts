import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../../core/config/database';
import { ParcelamentoRepository } from './parcelamento.repository';
vi.mock('../../core/config/database', () => ({
  pool: { query: vi.fn(), connect: vi.fn() },
}));
describe('Consulta do parcelamento', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never);
  });
  it('restringe grupo e dono da conta, sem filtrar o mês', async () => {
    await ParcelamentoRepository.listar('grupo', 'conta', 7);
    const [sql, params] = vi.mocked(pool.query).mock.calls[0];
    expect(params).toEqual(['grupo', 7]);
    expect(sql).toContain('t.userid = $2');
    expect(sql).toContain('t.parcela_grupo_id = $1::uuid');
    expect(sql).not.toMatch(/EXTRACT|LIMIT/i);
  });
  it('restringe a compra ao dono do cartão e usa o pagamento da fatura', async () => {
    await ParcelamentoRepository.listar('grupo', 'cartao', 8);
    const [sql, params] = vi.mocked(pool.query).mock.calls[0];
    expect(params).toEqual(['grupo', 8]);
    expect(sql).toContain('cc.usuario_id = $2');
    expect(sql).toContain('ct.id = $1::uuid');
    expect(sql).toContain("ci.status = 'PAID'");
    expect(sql).toContain('ci.cartao_id = cc.id');
  });
});

describe('Exclusão da compra', () => {
  const client = { query: vi.fn(), release: vi.fn() };
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(pool.connect).mockResolvedValue(client as never);
    client.query.mockResolvedValue({ rows: [] });
  });
  it('remove todas as parcelas da conta, sem filtro de mês ou status', async () => {
    vi.mocked(pool.query).mockResolvedValue({
      rows: [{ id: 1 }, { id: 2 }],
    } as never);
    expect(await ParcelamentoRepository.excluir('grupo', 'conta', 7)).toBe(
      true,
    );
    const [sql, params] = vi.mocked(pool.query).mock.calls[0];
    expect(params).toEqual(['grupo', 7]);
    expect(sql).toContain('parcela_grupo_id = $1::uuid AND userid = $2');
    expect(sql).not.toMatch(/status|LIMIT|EXTRACT/i);
    expect(pool.connect).not.toHaveBeenCalled();
  });
  it('retorna inexistente sem remover nada quando a compra não é do usuário', async () => {
    expect(await ParcelamentoRepository.excluir('compra', 'cartao', 99)).toBe(
      false,
    );
    expect(client.query.mock.calls[1][0]).toContain('cc.usuario_id = $2');
    expect(
      client.query.mock.calls.map((call) => call[0]).join(' '),
    ).not.toContain('DELETE');
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledOnce();
  });
  function autorizarCompra() {
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'compra' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'fatura' }] });
  }
  it('remove compra, itens e vínculos na mesma transação, preservando faturas compartilhadas', async () => {
    autorizarCompra();
    expect(await ParcelamentoRepository.excluir('compra', 'cartao', 7)).toBe(
      true,
    );
    const calls = client.query.mock.calls;
    const sql = calls.map((call) => call[0]).join(' ');
    expect(calls[0]).toEqual(['BEGIN']);
    expect(sql).toContain('FOR UPDATE OF ci');
    expect(sql).toContain('DELETE FROM invoice_items');
    expect(sql).toContain('DELETE FROM card_transactions');
    expect(sql).toContain("source_type = 'CREDIT_CARD_TRANSACTION'");
    expect(sql).toContain("source_type = 'CREDIT_CARD_INVOICE_ITEM'");
    expect(sql).toContain("source_type = 'CREDIT_CARD_INVOICE_PAYMENT'");
    expect(sql).toContain('NOT EXISTS');
    expect(calls.at(-2)?.[1]).toEqual([['fatura'], 7]);
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });
  it('desfaz toda a exclusão em caso de erro no meio da operação', async () => {
    autorizarCompra();
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error('falha'));
    await expect(
      ParcelamentoRepository.excluir('compra', 'cartao', 7),
    ).rejects.toThrow('falha');
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(client.query.mock.calls.some((call) => call[0] === 'COMMIT')).toBe(
      false,
    );
    expect(client.release).toHaveBeenCalledOnce();
  });
});
