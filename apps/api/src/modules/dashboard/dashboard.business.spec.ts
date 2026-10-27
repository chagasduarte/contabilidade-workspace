import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardBusiness } from './dashboard.business';
import { DashboardRepository } from './dashboard.repository';

vi.mock('./dashboard.repository', () => ({
  DashboardRepository: {
    getSaldoAtual: vi.fn(),
    getTransacoesMes: vi.fn(),
    getPlannedTransactionsMes: vi.fn(),
    getLoanInstallmentsMes: vi.fn(),
    getCardInvoicesMes: vi.fn(),
  },
}));

vi.mock('../planned-transaction/planned-transaction.business', () => ({
  PlannedTransactionBusiness: { ensureRollingWindow: vi.fn().mockResolvedValue(undefined) },
}));

const fatura = (id: string, valor_total: number, valor_restante: number) => ({
  id,
  nome_cartao: 'Nubank',
  mes_referencia: 10,
  ano_referencia: 2026,
  data_vencimento: '2026-10-28',
  valor_total,
  valor_restante,
});

describe('DashboardBusiness.calcularResumoFinanceiro - faturas de cartão', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(DashboardRepository.getSaldoAtual).mockResolvedValue(1000);
    vi.mocked(DashboardRepository.getTransacoesMes).mockResolvedValue([]);
    vi.mocked(DashboardRepository.getPlannedTransactionsMes).mockResolvedValue([]);
    vi.mocked(DashboardRepository.getLoanInstallmentsMes).mockResolvedValue([]);
  });

  it('fatura paga continua no gasto do mês como realizado e sai da lista a pagar', async () => {
    vi.mocked(DashboardRepository.getCardInvoicesMes).mockResolvedValue([
      fatura('paga', 500, 0),
      fatura('aberta', 300, 300),
    ]);

    const res = await DashboardBusiness.calcularResumoFinanceiro(10, 2026, 1);

    expect(res.gastos_mensal).toBe(800);
    expect(res.gastos_cartao).toBe(800);
    expect(res.total_dividas_mes).toBe(300);
    expect(res.gastos_mensal_pendente).toBe(300);
    expect(res.despesas_mes.map((d) => d.id)).toEqual(['card-aberta']);
  });

  it('fatura parcialmente paga: parte paga é realizada e o restante é pendente', async () => {
    vi.mocked(DashboardRepository.getCardInvoicesMes).mockResolvedValue([fatura('parcial', 1000, 400)]);

    const res = await DashboardBusiness.calcularResumoFinanceiro(10, 2026, 1);

    expect(res.gastos_mensal).toBe(1000);
    expect(res.total_dividas_mes).toBe(400);
    expect(res.despesas_mes[0]).toMatchObject({ id: 'card-parcial', valor: 400, origem: 'CARTAO' });
    expect(res.saldo_projetado).toBe(600);
  });
});
