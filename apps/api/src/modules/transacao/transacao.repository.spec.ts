import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pool } from '../../core/config/database';
import { TransacaoRepository } from './transacao.repository';

vi.mock('../../core/config/database', () => ({
  pool: {
    query: vi.fn(),
  },
}));

describe('TransacaoRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never);
  });

  describe('listaDespesasParceladas (isolamento por usuário)', () => {
    const periodos = [
      { cartaoid: null, inicio: '2026-02-01', fim: '2026-02-28' },
      { cartaoid: 10, inicio: '2026-01-08', fim: '2026-02-07' },
    ];

    it('filtra pelo userid e não usa subquery sem dono', async () => {
      await TransacaoRepository.listaDespesasParceladas(7, periodos);

      expect(pool.query).toHaveBeenCalledTimes(1);
      const [sql, params] = vi.mocked(pool.query).mock.calls[0] as unknown as [string, unknown[]];

      // Usuário é o primeiro parâmetro e a junção exige t.userid = $1
      expect(params[0]).toBe(7);
      expect(sql).toMatch(/t\.userid\s*=\s*\$1/);
      // A versão antiga tinha "descricao in (select descricao from transacoes ...)" sem filtro de
      // userid/cartaoid: um grupo entrava na lista porque OUTRO usuário pagava algo com a mesma descrição
      expect(sql).not.toMatch(/in\s*\(\s*select/i);
      // Cada período restringe também o cartão (conta corrente = NULL)
      expect(sql).toMatch(/t\.cartaoid IS NOT DISTINCT FROM p\.cartaoid/);
    });

    it('envia os períodos de conta e cartões como arrays', async () => {
      await TransacaoRepository.listaDespesasParceladas(7, periodos);

      const [, params] = vi.mocked(pool.query).mock.calls[0] as unknown as [string, unknown[]];
      expect(params).toEqual([
        7,
        [null, 10],
        ['2026-02-01', '2026-01-08'],
        ['2026-02-28', '2026-02-07'],
      ]);
    });

    it('sem períodos não consulta o banco', async () => {
      expect(await TransacaoRepository.listaDespesasParceladas(7, [])).toEqual([]);
      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  it('retorna os totais de cartão do período completo separados por pagamento', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{
      entradas: '10000', saidas: '8000', pendentes: '5',
      cartao: '2000', cartao_pago: '500', cartao_pendente: '1500',
    }] } as never);
    const totais = await TransacaoRepository.extratoTotais(7, '2026-11-01', '2026-12-01');
    expect(totais).toMatchObject({ saidas: 8000, cartao: 2000, cartao_pago: 500, cartao_pendente: 1500 });
    const [sql, params] = vi.mocked(pool.query).mock.calls[0];
    expect(sql).toContain("t.cartaoid IS NOT NULL OR t.tipo = 'cartao'");
    expect(sql).toContain("ci.status <> 'PAID', true");
    expect(params?.slice(0, 3)).toEqual([7, '2026-11-01', '2026-12-01']);
  });

  describe('listarMes (isolamento por usuário)', () => {
    it('filtra pelo userid', async () => {
      await TransacaoRepository.listarMes(7, [{ cartaoid: null, inicio: '2026-02-01', fim: '2026-02-28' }]);

      const [sql, params] = vi.mocked(pool.query).mock.calls[0] as unknown as [string, unknown[]];
      expect(params[0]).toBe(7);
      expect(sql).toMatch(/t\.userid\s*=\s*\$1/);
    });
  });
});
