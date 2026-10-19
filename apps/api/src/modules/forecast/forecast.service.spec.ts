// forecast.service.spec.ts
// Testes unitários para o Motor de Projeção de Fluxo de Caixa (ForecastService) com Vitest

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ForecastService,
  roundCurrency,
  expandPlannedTransactionOccurrences,
  formatDateIso,
} from './forecast.service';
import { ForecastRepository } from './forecast.repository';
import { PlannedTransactionEntity } from '../planned-transaction/planned-transaction.entity';

vi.mock('./forecast.repository', () => ({
  ForecastRepository: {
    getCurrentBalance: vi.fn(),
    getPendingPlannedTransactions: vi.fn(),
    getPendingLoanInstallments: vi.fn(),
    getPendingCardInvoices: vi.fn(),
  },
}));

describe('ForecastService', () => {
  const mockUserId = 12;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Funções Utilitárias', () => {
    it('roundCurrency deve arredondar com precisão de 2 casas decimais', () => {
      expect(roundCurrency(10.555)).toBe(10.56);
      expect(roundCurrency(10.554)).toBe(10.55);
      expect(roundCurrency(0.1 + 0.2)).toBe(0.3);
    });

    it('formatDateIso deve formatar Date e string adequadamente', () => {
      const d = new Date(Date.UTC(2026, 9, 20));
      expect(formatDateIso(d)).toBe('2026-10-20');
      expect(formatDateIso('2026-11-15T18:00:00Z')).toBe('2026-11-15');
    });

    it('expandPlannedTransactionOccurrences deve expandir transações sem recorrência', () => {
      const pt: PlannedTransactionEntity = {
        id: 'uuid-1',
        userid: mockUserId,
        descricao: 'Venda de Item',
        tipo: 'RECEITA',
        valor: 300,
        data_prevista: new Date('2026-11-05T00:00:00Z'),
        recorrencia: 'NONE',
        status: 'PENDING',
      };

      const events = expandPlannedTransactionOccurrences(pt, '2026-10-01', '2026-12-31');
      expect(events).toHaveLength(1);
      expect(events[0].date).toBe('2026-11-05');
      expect(events[0].amount).toBe(300);
      expect(events[0].type).toBe('RECEITA');
    });

    it('expandPlannedTransactionOccurrences deve expandir recorrência mensal respeitando limite', () => {
      const pt: PlannedTransactionEntity = {
        id: 'uuid-2',
        userid: mockUserId,
        descricao: 'Assinatura Software',
        tipo: 'DESPESA',
        valor: 50,
        data_prevista: new Date('2026-10-10T00:00:00Z'),
        recorrencia: 'MENSAL',
        data_limite_recorrencia: new Date('2026-12-15T00:00:00Z'),
        status: 'PENDING',
      };

      // Intervalo: 2026-10-01 até 2027-01-31
      const events = expandPlannedTransactionOccurrences(pt, '2026-10-01', '2027-01-31');
      // Deve gerar Outubro, Novembro e Dezembro (pois data_limite é 15/12/2026)
      expect(events).toHaveLength(3);
      expect(events.map((e) => e.date)).toEqual(['2026-10-10', '2026-11-10', '2026-12-10']);
    });
  });

  describe('getForecast', () => {
    it('deve calcular corretamente projeção, saldo seguro e resumos com múltiplas fontes', async () => {
      // Saldo base atual: R$ 2.000,00
      vi.mocked(ForecastRepository.getCurrentBalance).mockResolvedValue(2000.0);

      // Transações planejadas:
      // Salário no dia 2026-11-05: +R$ 5.000,00
      // Aluguel no dia 2026-11-10: -R$ 1.500,00
      const mockPlanned: PlannedTransactionEntity[] = [
        {
          id: 'pt-1',
          userid: mockUserId,
          descricao: 'Salário',
          tipo: 'RECEITA',
          valor: 5000.0,
          data_prevista: new Date('2026-11-05T00:00:00Z'),
          recorrencia: 'NONE',
          status: 'PENDING',
        },
        {
          id: 'pt-2',
          userid: mockUserId,
          descricao: 'Aluguel',
          tipo: 'DESPESA',
          valor: 1500.0,
          data_prevista: new Date('2026-11-10T00:00:00Z'),
          recorrencia: 'NONE',
          status: 'PENDING',
        },
      ];
      vi.mocked(ForecastRepository.getPendingPlannedTransactions).mockResolvedValue(mockPlanned);

      // Empréstimo no dia 2026-11-15: -R$ 800,00
      vi.mocked(ForecastRepository.getPendingLoanInstallments).mockResolvedValue([
        {
          id: 'loan-inst-1',
          installment_number: 1,
          original_amount: 800.0,
          due_date: new Date('2026-11-15T00:00:00Z'),
          institution_name: 'Banco do Brasil',
        },
      ]);

      // Fatura de Cartão no dia 2026-11-20: -R$ 700,00
      vi.mocked(ForecastRepository.getPendingCardInvoices).mockResolvedValue([
        {
          id: 'card-inv-1',
          nome_cartao: 'Nubank',
          mes_referencia: 11,
          ano_referencia: 2026,
          data_vencimento: new Date('2026-11-20T00:00:00Z'),
          valor_restante: 700.0,
        },
      ]);

      const result = await ForecastService.getForecast(mockUserId, { months: 3 });

      expect(result.currentBalance).toBe(2000.0);
      // Evolução de saldo:
      // Início: 2000
      // 2026-11-05 (+5000) -> 7000
      // 2026-11-10 (-1500) -> 5500
      // 2026-11-15 (-800)  -> 4700
      // 2026-11-20 (-700)  -> 4000
      expect(result.finalProjectedBalance).toBe(4000.0);
      expect(result.minimumProjectedBalance).toBe(2000.0);
      expect(result.safeToSpendToday).toBe(2000.0);
      expect(result.events).toHaveLength(4);
      expect(result.monthlySummaries.length).toBeGreaterThanOrEqual(1);
    });

    it('deve simular compra viável (isAffordable = true) quando o saldo não negativar', async () => {
      vi.mocked(ForecastRepository.getCurrentBalance).mockResolvedValue(5000.0);
      vi.mocked(ForecastRepository.getPendingPlannedTransactions).mockResolvedValue([]);
      vi.mocked(ForecastRepository.getPendingLoanInstallments).mockResolvedValue([]);
      vi.mocked(ForecastRepository.getPendingCardInvoices).mockResolvedValue([]);

      const result = await ForecastService.getForecast(mockUserId, {
        months: 3,
        targetExpenseAmount: 2500.0,
        targetExpenseDate: '2026-12-01',
      });

      expect(result.simulationResult).toBeDefined();
      expect(result.simulationResult?.isAffordable).toBe(true);
      expect(result.simulationResult?.targetAmount).toBe(2500.0);
      expect(result.simulationResult?.remainingMarginAfterTarget).toBe(2500.0); // 5000 - 2500
    });

    it('deve simular compra inviável (isAffordable = false) se o saldo futuro for insuficiente', async () => {
      // Saldo inicial 1000
      vi.mocked(ForecastRepository.getCurrentBalance).mockResolvedValue(1000.0);
      vi.mocked(ForecastRepository.getPendingPlannedTransactions).mockResolvedValue([]);
      vi.mocked(ForecastRepository.getPendingLoanInstallments).mockResolvedValue([]);
      vi.mocked(ForecastRepository.getPendingCardInvoices).mockResolvedValue([]);

      // Tenta simular compra de 2500
      const result = await ForecastService.getForecast(mockUserId, {
        months: 3,
        targetExpenseAmount: 2500.0,
        targetExpenseDate: '2026-12-01',
      });

      expect(result.simulationResult).toBeDefined();
      expect(result.simulationResult?.isAffordable).toBe(false);
      expect(result.simulationResult?.remainingMarginAfterTarget).toBe(-1500.0); // 1000 - 2500 = -1500
    });

    it('safeToSpendToday deve ser 0 se em algum momento a projeção for negativa', async () => {
      // Saldo inicial 500
      vi.mocked(ForecastRepository.getCurrentBalance).mockResolvedValue(500.0);
      // Obrigação de 1000 no futuro
      vi.mocked(ForecastRepository.getPendingPlannedTransactions).mockResolvedValue([
        {
          id: 'pt-def',
          userid: mockUserId,
          descricao: 'IPVA',
          tipo: 'DESPESA',
          valor: 1000.0,
          data_prevista: new Date('2026-11-15T00:00:00Z'),
          recorrencia: 'NONE',
          status: 'PENDING',
        },
      ]);
      vi.mocked(ForecastRepository.getPendingLoanInstallments).mockResolvedValue([]);
      vi.mocked(ForecastRepository.getPendingCardInvoices).mockResolvedValue([]);

      const result = await ForecastService.getForecast(mockUserId, { months: 3 });

      // Saldo mínimo é -500 (500 - 1000)
      expect(result.minimumProjectedBalance).toBe(-500.0);
      expect(result.safeToSpendToday).toBe(0);
    });

    it('deve rejeitar se userId for inválido', async () => {
      await expect(ForecastService.getForecast(0, {})).rejects.toThrow(
        'Identificação do usuário (userId) inválida.'
      );
    });
  });
});

