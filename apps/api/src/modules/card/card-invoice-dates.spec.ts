import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../../core/config/database';
import { CardBusiness, InvoiceNotFoundError } from './card.business';
import { CardRepository } from './card.repository';
vi.mock('../../core/config/database', () => ({ pool: { connect: vi.fn() } }));
vi.mock('./card.repository', () => ({ CardRepository: { atualizarDatasFatura: vi.fn(), buscarFaturaPorId: vi.fn() } }));
const id = '12345678-1234-1234-1234-123456789012';
const raw = { id, cartao_id: 'inter', mes_referencia: 11, ano_referencia: 2026,
  dia_fechamento: 1, dia_vencimento: 7, data_fechamento: new Date('2026-11-30'),
  data_vencimento: new Date('2026-12-07'), status: 'PAID' as const,
  valor_pago: 2202.35, data_pagamento: new Date('2026-11-06') };
describe('Correção de datas gravadas na fatura', () => {
  const client = { query: vi.fn(), release: vi.fn() };
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(pool.connect).mockResolvedValue(client as never);
    client.query.mockResolvedValue({ rows: [] });
  });
  it('restaura novembro pelo ciclo 1/7 e preserva o pagamento de 2202,35', async () => {
    client.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [raw] });
    const corrigida = { ...raw, data_fechamento: new Date('2026-11-01'), data_vencimento: new Date('2026-11-07') };
    vi.mocked(CardRepository.buscarFaturaPorId).mockResolvedValue(corrigida);
    const result = await CardBusiness.corrigirDatasFatura(id, 7);
    const args = vi.mocked(CardRepository.atualizarDatasFatura).mock.calls[0];
    expect(args[0]).toBe(id);
    expect(args[1].toISOString().substring(0, 10)).toBe('2026-11-01');
    expect(args[2].toISOString().substring(0, 10)).toBe('2026-11-07');
    expect(args[3]).toBe(client);
    expect(result).toMatchObject({ status: 'PAID', valor_pago: 2202.35, data_pagamento: raw.data_pagamento });
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
  });
  it('não permite corrigir fatura de outro usuário ou inexistente', async () => {
    await expect(CardBusiness.corrigirDatasFatura(id, 99)).rejects.toThrow(InvoiceNotFoundError);
    expect(client.query.mock.calls[1][0]).toContain('cc.usuario_id = $2');
    expect(client.query.mock.calls[1][1]).toEqual([id, 99]);
    expect(CardRepository.atualizarDatasFatura).not.toHaveBeenCalled();
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
  });
  it('desfaz tudo se a atualização falhar', async () => {
    client.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [raw] });
    vi.mocked(CardRepository.atualizarDatasFatura).mockRejectedValue(new Error('falha'));
    await expect(CardBusiness.corrigirDatasFatura(id, 7)).rejects.toThrow('falha');
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });
});
