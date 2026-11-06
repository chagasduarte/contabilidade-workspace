import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../../core/config/database';
import { CardItemRepository } from './card-item.repository';
vi.mock('../../core/config/database', () => ({ pool: { connect: vi.fn() } }));

const dto = { descricao: 'Mercado', valor_parcela: 500, categoria_id: 1, subcategoria_id: 11 };
describe('Edição de despesa de cartão', () => {
  const client = { query: vi.fn(), release: vi.fn() };
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(pool.connect).mockResolvedValue(client as never);
    client.query.mockResolvedValue({ rows: [] });
  });
  function preparar(status = 'OPEN', valor = '500', pago = '0') {
    client.query.mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'compra', cartao_id: 'cartao' }] })
      .mockResolvedValueOnce({ rows: [{ status, valor_parcela: valor, valor_pago: pago }] });
  }
  it('restringe pelo usuário e retorna not-found sem alterar compras alheias', async () => {
    expect(await CardItemRepository.atualizar('item', 7, dto)).toBe('not-found');
    expect(client.query.mock.calls[1][0]).toContain('cc.usuario_id = $2');
    expect(client.query.mock.calls[1][1]).toEqual(['item', 7]);
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });
  it('altera a parcela e recalcula o total da compra na mesma transação', async () => {
    preparar('OPEN', '600');
    expect(await CardItemRepository.atualizar('item', 7, dto)).toBe('updated');
    expect(client.query.mock.calls[3][1]).toEqual(['item', 500]);
    expect(client.query.mock.calls[4][0]).toContain('SELECT SUM(valor_parcela)');
    expect(client.query.mock.calls[4][1]).toEqual(['compra', 'Mercado', 1, 11]);
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
  });
  it.each([['PAID', '500'], ['OPEN', '100']])('impede mudar o valor com pagamento %s', async (status, pago) => {
    preparar(status, '600', pago);
    expect(await CardItemRepository.atualizar('item', 7, dto)).toBe('paid');
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(client.query.mock.calls.some(([sql]) => String(sql).startsWith('UPDATE'))).toBe(false);
  });
  it('permite corrigir classificação de uma compra paga sem alterar valor', async () => {
    preparar('PAID');
    expect(await CardItemRepository.atualizar('item', 7, dto)).toBe('updated');
  });
  it('rejeita aumento acima do limite disponível', async () => {
    preparar('OPEN', '400');
    client.query.mockResolvedValueOnce({ rows: [{ limite_total: '1000', comprometido: '950' }] });
    expect(await CardItemRepository.atualizar('item', 7, dto)).toBe('limit');
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
  });
  it('desfaz a alteração da parcela se atualizar a compra falhar', async () => {
    preparar('OPEN', '600');
    client.query.mockResolvedValueOnce({ rows: [] }).mockRejectedValueOnce(new Error('falha'));
    await expect(CardItemRepository.atualizar('item', 7, dto)).rejects.toThrow('falha');
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });
});
