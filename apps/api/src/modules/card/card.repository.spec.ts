import { describe, expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
import { CardRepository, mapInvoiceItemEntity } from './card.repository';

vi.mock('../../core/config/database', () => ({ pool: { query: vi.fn() } }));

describe('CardRepository - subcategoria', () => {
  it('persiste e retorna a subcategoria na compra original usada por todas as parcelas', async () => {
    const data = new Date('2026-11-06');
    const query = vi.fn().mockResolvedValue({ rows: [{
      id: 'compra', cartao_id: 'cartao', categoria_id: 1, subcategoria_id: 11,
      descricao: 'Mercado', valor_total: 300, quantidade_parcelas: 3, data_compra: data,
    }] });
    const compra = await CardRepository.criarTransacao({
      cartao_id: 'cartao', categoria_id: 1, subcategoria_id: 11,
      descricao: ' Mercado ', valor_total: 300, quantidade_parcelas: 3, data_compra: data,
    }, { query } as unknown as PoolClient);
    expect(query.mock.calls[0][0]).toContain('subcategoria_id');
    expect(query.mock.calls[0][1]).toEqual(['cartao', 1, 'Mercado', 300, 3, data, 11]);
    expect(compra.subcategoria_id).toBe(11);
  });

  it('retorna o nome da subcategoria nos itens de fatura e mantém compras antigas sem vínculo', () => {
    expect(mapInvoiceItemEntity({ subcategoria_id: '11', subcategoria_nome: 'Mercado' }))
      .toMatchObject({ subcategoria_id: 11, subcategoria_nome: 'Mercado' });
    expect(mapInvoiceItemEntity({})).toMatchObject({ subcategoria_id: null, subcategoria_nome: null });
  });
  it('trava a fatura durante a decisão de alocar novas parcelas', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    await CardRepository.buscarFaturaPorMesAno('cartao', 11, 2026, { query } as unknown as PoolClient);
    expect(query.mock.calls[0][0]).toContain('FOR UPDATE OF ci');
    expect(query.mock.calls[0][1]).toEqual(['cartao', 11, 2026]);
  });

});
