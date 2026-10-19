import { describe, it, expect } from 'vitest';
import { getPeriodoFatura } from './periodo-fatura';

describe('getPeriodoFatura', () => {
  it('deve calcular o período quando o dia da fatura é 1', () => {
    const periodo = getPeriodoFatura(1, 5, 2026);
    expect(periodo.inicio).toBe('2026-04-01');
    expect(periodo.fim).toBe('2026-04-30');
  });

  it('deve calcular o período quando o dia da fatura é 10', () => {
    const periodo = getPeriodoFatura(10, 5, 2026);
    expect(periodo.inicio).toBe('2026-04-10');
    expect(periodo.fim).toBe('2026-05-09');
  });

  it('deve ajustar o ano quando o mês é janeiro (mês 1)', () => {
    const periodo = getPeriodoFatura(15, 1, 2026);
    expect(periodo.inicio).toBe('2025-12-15');
    expect(periodo.fim).toBe('2026-01-14');
  });
});

