import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../../core/config/database';
import { ParcelamentoRepository } from './parcelamento.repository';
vi.mock('../../core/config/database', () => ({ pool: { query: vi.fn() } }));
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
