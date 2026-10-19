// planned-transaction.utils.ts
// Utilitários de manipulação de data e cálculo de recorrência com janela deslizante

/**
 * Adiciona meses a uma data base preservando com segurança o dia original do mês,
 * evitando problemas de overflow (ex: 31 de janeiro -> 28/29 de fevereiro)
 * e recuperando o dia original em meses futuros (ex: 31 de março).
 *
 * @param baseDateInput Data base (Date ou string YYYY-MM-DD)
 * @param monthsToAdd Quantidade de meses a avançar (positivo ou negativo)
 * @param originalDayOverride Opcional: dia do mês original do mestre (1..31)
 */
export function addMonthsPreservingDay(
  baseDateInput: string | Date,
  monthsToAdd: number,
  originalDayOverride?: number
): Date {
  let y: number;
  let m: number;
  let d: number;

  if (typeof baseDateInput === 'string' && /^\d{4}-\d{2}-\d{2}/.test(baseDateInput.trim())) {
    const parts = baseDateInput.trim().substring(0, 10).split('-').map(Number);
    y = parts[0];
    m = parts[1] - 1; // 0-indexed no JS Date
    d = originalDayOverride ?? parts[2];
  } else {
    const base = new Date(baseDateInput);
    y = base.getUTCFullYear();
    m = base.getUTCMonth();
    d = originalDayOverride ?? base.getUTCDate();
  }

  const targetMonthIndex = m + monthsToAdd;
  const targetYear = y + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;

  // Último dia do mês alvo (UTC)
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(d, daysInTargetMonth);

  return new Date(Date.UTC(targetYear, targetMonth, targetDay, 12, 0, 0));
}

/**
 * Converte Date para formato YYYY-MM-DD em UTC.
 */
export function toIsoDateString(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

