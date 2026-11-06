import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../../core/config/database';
import { DashboardRepository } from './dashboard.repository';

vi.mock('../../core/config/database', () => ({ pool: { query: vi.fn() } }));

describe('DashboardRepository - competência e pagamentos de cartão', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never);
  });

  it('desconta pagamentos de faturas do saldo, isolando usuário e data', async () => {
    await DashboardRepository.getSaldoAtual(11, 2026, 7);
    const [sql, params] = vi.mocked(pool.query).mock.calls[0];
    expect(params).toEqual([11, 2026, 7]);
    expect(sql).toContain('0) - (');
    expect(sql).toContain('SUM(ci.valor_pago)');
    expect(sql).toContain('cc.usuario_id = $3');
    expect(sql).toContain('ci.data_pagamento <');
    expect(sql).toContain('AND NOT EXISTS');
    expect(sql).toContain("pagamento_fatura.source_type = 'CREDIT_CARD_INVOICE_PAYMENT'");
    expect(sql).toContain('pagamento_fatura.source_id = ci.id::text');
  });

  it('busca cartão legado pelo pagamento e conta corrente pela data', async () => {
    await DashboardRepository.getTransacoesMes(11, 2026, 7);
    const [sql, params] = vi.mocked(pool.query).mock.calls[0];
    expect(params).toEqual([7, 11, 2026]);
    expect(sql).toContain('CASE WHEN t.cartaoid IS NOT NULL THEN t.pagamento ELSE t.data END');
  });

  it('inclui faturas no mês de vencimento e calcula apenas o restante pendente', async () => {
    await DashboardRepository.getCardInvoicesMes(11, 2026, 7);
    const [sql, params] = vi.mocked(pool.query).mock.calls[0];
    expect(params).toEqual([7, 11, 2026]);
    expect(sql).toContain('c.usuario_id = $1');
    expect(sql).toContain('ci.data_vencimento >=');
    expect(sql).toContain('SUM(ii.valor_parcela), 0) - COALESCE(ci.valor_pago, 0)');
    expect(sql).not.toContain('OR ci.mes_referencia');
  });
});
