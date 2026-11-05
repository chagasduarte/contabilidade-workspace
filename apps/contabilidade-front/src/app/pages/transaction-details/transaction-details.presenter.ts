import { Transacao } from '@contabilidade/models';

/** Calcula em centavos para evitar resíduos de ponto flutuante nos totais. */
export function summarizeInstallments(items: Transacao[]) {
  const totalCents = items.reduce(
    (sum, item) => sum + Math.round(Number(item.valor) * 100),
    0,
  );
  const paid = items.filter((item) => item.status === 'pago');
  const paidCents = paid.reduce(
    (sum, item) => sum + Math.round(Number(item.valor) * 100),
    0,
  );
  const pending = items.filter((item) => item.status === 'pendente');
  return {
    total: totalCents / 100,
    paid: paidCents / 100,
    remaining: (totalCents - paidCents) / 100,
    paidCount: paid.length,
    pendingCount: pending.length,
    progress: totalCents > 0 ? (paidCents / totalCents) * 100 : 0,
    next: pending[0] ?? null,
  };
}
