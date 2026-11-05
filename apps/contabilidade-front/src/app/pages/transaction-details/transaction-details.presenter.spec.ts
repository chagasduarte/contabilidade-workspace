import { summarizeInstallments } from './transaction-details.presenter';
import { Transacao } from '@contabilidade/models';
const item = (
  id: number,
  valor: number,
  status: 'pago' | 'pendente',
): Transacao => ({
  id,
  valor,
  status,
  descricao: 'Compra',
  tipo: 'saida',
  data: '2026-01-01',
});
describe('Resumo do parcelamento', () => {
  it('calcula totais e progresso pelo valor pago em centavos', () => {
    const result = summarizeInstallments([
      item(1, 33.34, 'pago'),
      item(2, 33.33, 'pendente'),
      item(3, 33.33, 'pendente'),
    ]);
    expect(result.total).toBe(100);
    expect(result.paid).toBe(33.34);
    expect(result.remaining).toBe(66.66);
    expect(result.progress).toBeCloseTo(33.34);
    expect(result.paidCount).toBe(1);
    expect(result.pendingCount).toBe(2);
    expect(result.next?.id).toBe(2);
  });
  it('trata compra quitada e lista vazia', () => {
    expect(summarizeInstallments([item(1, 100, 'pago')])).toMatchObject({
      progress: 100,
      remaining: 0,
      next: null,
    });
    expect(summarizeInstallments([])).toMatchObject({
      progress: 0,
      total: 0,
      next: null,
    });
  });
});
