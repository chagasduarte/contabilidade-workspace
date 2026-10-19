// forecast.service.ts
// Núcleo de Inteligência Financeira: Motor de Projeção de Fluxo de Caixa (Cash Flow Forecasting Engine)

import {
  DailyForecastPointDto,
  ForecastQueryDto,
  ForecastResponseDto,
  ForecastSimulationResultDto,
  ForecastTimelineEventDto,
  MonthlyForecastSummaryDto,
} from './forecast.dto';
import { ForecastRepository } from './forecast.repository';
import { PlannedTransactionEntity } from '../planned-transaction/planned-transaction.entity';

export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatDateIso(date: Date | string): string {
  if (typeof date === 'string') {
    return date.split('T')[0];
  }
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateUtc(dateStr: string | Date): Date {
  if (dateStr instanceof Date) return dateStr;
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

/**
 * Expande ocorrências de transações planejadas (recorrentes ou pontuais)
 * dentro da janela de projeção definida por startDateStr e endDateStr.
 */
export function expandPlannedTransactionOccurrences(
  pt: PlannedTransactionEntity,
  startDateStr: string,
  endDateStr: string
): ForecastTimelineEventDto[] {
  const events: ForecastTimelineEventDto[] = [];
  const start = parseDateUtc(startDateStr);
  const end = parseDateUtc(endDateStr);

  const ptDateStr = formatDateIso(pt.data_prevista);
  const ptDate = parseDateUtc(ptDateStr);

  if (pt.recorrencia === 'NONE') {
    if (ptDateStr >= startDateStr && ptDateStr <= endDateStr) {
      events.push({
        date: ptDateStr,
        description: pt.descricao,
        amount: roundCurrency(Number(pt.valor)),
        type: pt.tipo,
        origin: 'PLANNED',
        originId: pt.id,
      });
    }
    return events;
  }

  const limitDate = pt.data_limite_recorrencia
    ? parseDateUtc(formatDateIso(pt.data_limite_recorrencia))
    : null;

  const curr = new Date(ptDate.getTime());
  const originalDay = ptDate.getUTCDate();

  // Avança até o horizonte final ou limite de recorrência
  while (curr <= end && (!limitDate || curr <= limitDate)) {
    const currStr = formatDateIso(curr);
    if (currStr >= startDateStr && currStr <= endDateStr) {
      events.push({
        date: currStr,
        description: pt.descricao,
        amount: roundCurrency(Number(pt.valor)),
        type: pt.tipo,
        origin: 'PLANNED',
        originId: pt.id,
      });
    }

    if (pt.recorrencia === 'SEMANAL') {
      curr.setUTCDate(curr.getUTCDate() + 7);
    } else if (pt.recorrencia === 'MENSAL') {
      const nextMonth = curr.getUTCMonth() + 1;
      curr.setUTCMonth(nextMonth, originalDay);
    } else if (pt.recorrencia === 'ANUAL') {
      curr.setUTCFullYear(curr.getUTCFullYear() + 1);
    } else {
      break;
    }
  }

  return events;
}

export const ForecastService = {
  /**
   * Executa a projeção completa de fluxo de caixa para o usuário.
   */
  async getForecast(
    userId: number,
    query: ForecastQueryDto
  ): Promise<ForecastResponseDto> {
    if (!userId || isNaN(Number(userId))) {
      throw new Error('Identificação do usuário (userId) inválida.');
    }

    // 1. Normalização do horizonte (meses)
    let months = Number(query.months ?? 3);
    if (isNaN(months) || months < 1) months = 3;
    if (months > 24) months = 24;

    const today = new Date();
    const todayStr = formatDateIso(today);

    // Data limite inicial baseada nos meses solicitados
    const maxDate = new Date(today.getTime());
    maxDate.setUTCMonth(maxDate.getUTCMonth() + months);

    // Se houver simulação com data posterior, estende a janela até ela
    if (query.targetExpenseDate) {
      const targetDate = parseDateUtc(query.targetExpenseDate);
      if (targetDate > maxDate) {
        maxDate.setTime(targetDate.getTime());
      }
    }

    const dataFimStr = formatDateIso(maxDate);

    // 2. Obter saldo base atual consolidado
    const currentBalanceRaw = await ForecastRepository.getCurrentBalance(userId);
    const currentBalance = roundCurrency(currentBalanceRaw);

    // 3. Buscar eventos futuros de todas as fontes
    const [plannedTxList, loanInstallments, cardInvoices] = await Promise.all([
      ForecastRepository.getPendingPlannedTransactions(userId, dataFimStr),
      ForecastRepository.getPendingLoanInstallments(userId, todayStr, dataFimStr),
      ForecastRepository.getPendingCardInvoices(userId, todayStr, dataFimStr),
    ]);

    const allEvents: ForecastTimelineEventDto[] = [];

    // A) Transações planejadas (expandindo recorrências)
    for (const pt of plannedTxList) {
      const expanded = expandPlannedTransactionOccurrences(pt, todayStr, dataFimStr);
      allEvents.push(...expanded);
    }

    // B) Parcelas de empréstimos (sempre DESPESA)
    for (const li of loanInstallments) {
      const dateStr = formatDateIso(li.due_date);
      allEvents.push({
        date: dateStr,
        description: `Parcela Empréstimo #${li.installment_number}${
          li.institution_name ? ` - ${li.institution_name}` : ''
        }`,
        amount: roundCurrency(li.original_amount),
        type: 'DESPESA',
        origin: 'LOAN',
        originId: li.id,
      });
    }

    // C) Faturas de cartão de crédito pendentes (sempre DESPESA)
    for (const ci of cardInvoices) {
      const dateStr = formatDateIso(ci.data_vencimento);
      allEvents.push({
        date: dateStr,
        description: `Fatura ${ci.nome_cartao} (${ci.mes_referencia}/${ci.ano_referencia})`,
        amount: roundCurrency(ci.valor_restante),
        type: 'DESPESA',
        origin: 'CREDIT_CARD',
        originId: ci.id,
      });
    }

    // 4. Ordenação cronológica estrita (receitas antes de despesas no mesmo dia)
    allEvents.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      if (a.type !== b.type) {
        return a.type === 'RECEITA' ? -1 : 1;
      }
      return 0;
    });

    // 5. Agrupamento diário e evolução do saldo
    const eventsByDay = new Map<string, ForecastTimelineEventDto[]>();
    for (const ev of allEvents) {
      const list = eventsByDay.get(ev.date) || [];
      list.push(ev);
      eventsByDay.set(ev.date, list);
    }

    let runningBalance = currentBalance;
    let minimumProjectedBalance = runningBalance;
    const dailyPoints: DailyForecastPointDto[] = [];

    // Ponto inicial de hoje
    dailyPoints.push({
      date: todayStr,
      totalIncome: 0,
      totalExpense: 0,
      projectedBalance: runningBalance,
    });

    // Iteração dia a dia de hoje até dataFim
    const dateIter = parseDateUtc(todayStr);
    const dateLimit = parseDateUtc(dataFimStr);

    while (dateIter <= dateLimit) {
      const dateKey = formatDateIso(dateIter);
      const dayEvents = eventsByDay.get(dateKey) || [];

      let dayIncome = 0;
      let dayExpense = 0;

      for (const ev of dayEvents) {
        if (ev.type === 'RECEITA') {
          dayIncome = roundCurrency(dayIncome + ev.amount);
        } else {
          dayExpense = roundCurrency(dayExpense + ev.amount);
        }
      }

      if (dayEvents.length > 0) {
        runningBalance = roundCurrency(runningBalance + dayIncome - dayExpense);
        if (runningBalance < minimumProjectedBalance) {
          minimumProjectedBalance = runningBalance;
        }

        dailyPoints.push({
          date: dateKey,
          totalIncome: dayIncome,
          totalExpense: dayExpense,
          projectedBalance: runningBalance,
        });
      }

      dateIter.setUTCDate(dateIter.getUTCDate() + 1);
    }

    const finalProjectedBalance = runningBalance;
    const safeToSpendToday = Math.max(0, minimumProjectedBalance);

    // 6. Resumo Mensal Consolidado (Monthly Summaries)
    const monthlyMap = new Map<
      string,
      {
        month: string;
        initialBalance: number;
        totalIncome: number;
        totalExpense: number;
        finalBalance: number;
        minimumBalance: number;
      }
    >();

    let currentMonthRunningBalance = currentBalance;

    // Constrói meses cobertos de todayStr até dataFimStr
    const mIter = parseDateUtc(todayStr);
    mIter.setUTCDate(1);
    const mLimit = parseDateUtc(dataFimStr);

    while (mIter <= mLimit) {
      const y = mIter.getUTCFullYear();
      const m = String(mIter.getUTCMonth() + 1).padStart(2, '0');
      const monthKey = `${y}-${m}`;

      monthlyMap.set(monthKey, {
        month: monthKey,
        initialBalance: currentMonthRunningBalance,
        totalIncome: 0,
        totalExpense: 0,
        finalBalance: currentMonthRunningBalance,
        minimumBalance: currentMonthRunningBalance,
      });

      mIter.setUTCMonth(mIter.getUTCMonth() + 1);
    }

    // Alimenta eventos nos meses correspondentes e calcula saldos
    for (const [monthKey, summary] of monthlyMap.entries()) {
      summary.initialBalance = currentMonthRunningBalance;
      let monthMin = currentMonthRunningBalance;
      let monthBal = currentMonthRunningBalance;

      // Eventos que caem neste mês
      const monthEvents = allEvents.filter((e) => e.date.startsWith(monthKey));
      for (const ev of monthEvents) {
        if (ev.type === 'RECEITA') {
          summary.totalIncome = roundCurrency(summary.totalIncome + ev.amount);
          monthBal = roundCurrency(monthBal + ev.amount);
        } else {
          summary.totalExpense = roundCurrency(summary.totalExpense + ev.amount);
          monthBal = roundCurrency(monthBal - ev.amount);
        }
        if (monthBal < monthMin) {
          monthMin = monthBal;
        }
      }

      summary.finalBalance = monthBal;
      summary.minimumBalance = monthMin;
      currentMonthRunningBalance = monthBal;
    }

    const monthlySummaries: MonthlyForecastSummaryDto[] = Array.from(monthlyMap.values());

    // 7. Simulação de Compra / Meta Financeira (Affordability Simulation)
    let simulationResult: ForecastSimulationResultDto | undefined;

    if (query.targetExpenseAmount && Number(query.targetExpenseAmount) > 0) {
      const targetAmount = roundCurrency(Number(query.targetExpenseAmount));
      const targetDateStr = query.targetExpenseDate
        ? formatDateIso(query.targetExpenseDate)
        : todayStr;

      // Saldo projetado no dia da compra imediatamente antes da dedução
      let balanceAtTarget = currentBalance;
      for (const ev of allEvents) {
        if (ev.date < targetDateStr) {
          balanceAtTarget =
            ev.type === 'RECEITA'
              ? roundCurrency(balanceAtTarget + ev.amount)
              : roundCurrency(balanceAtTarget - ev.amount);
        }
      }

      // Projeta o saldo a partir da data da compra com o valor deduzido
      let simRunningBalance = roundCurrency(balanceAtTarget - targetAmount);
      let simMinBalance = simRunningBalance;

      for (const ev of allEvents) {
        if (ev.date >= targetDateStr) {
          simRunningBalance =
            ev.type === 'RECEITA'
              ? roundCurrency(simRunningBalance + ev.amount)
              : roundCurrency(simRunningBalance - ev.amount);
          if (simRunningBalance < simMinBalance) {
            simMinBalance = simRunningBalance;
          }
        }
      }

      const isAffordable = simMinBalance >= 0;

      simulationResult = {
        isAffordable,
        projectedBalanceAtTargetDate: balanceAtTarget,
        remainingMarginAfterTarget: roundCurrency(simMinBalance),
        targetAmount,
        targetDate: targetDateStr,
      };
    }

    return {
      currentBalance,
      finalProjectedBalance,
      minimumProjectedBalance,
      safeToSpendToday,
      simulationResult,
      monthlySummaries,
      events: allEvents,
      dailyPoints,
    };
  },
};

