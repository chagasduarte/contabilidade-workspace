import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ParcelamentoBusiness } from './parcelamento.business';
import {
  ParcelaRegistro,
  ParcelamentoRepository,
} from './parcelamento.repository';
import { TransacaoNotFoundError } from './transacao.types';
vi.mock('./parcelamento.repository', () => ({
  ParcelamentoRepository: { listar: vi.fn(), excluir: vi.fn() },
}));
const parcela = (
  numero: number,
  valor: number,
  status: 'pago' | 'pendente',
): ParcelaRegistro => ({
  id: String(numero),
  numero,
  quantidade: 3,
  valor,
  status,
  descricao: 'Compra',
  vencimento: `2026-0${numero}-10`,
});
describe('Detalhes de parcelamento', () => {
  beforeEach(() => vi.resetAllMocks());
  it('consulta a compra inteira pelo usuário e soma em centavos', async () => {
    vi.mocked(ParcelamentoRepository.listar).mockResolvedValue([
      parcela(1, 33.34, 'pago'),
      parcela(2, 33.33, 'pendente'),
      parcela(3, 33.33, 'pendente'),
    ]);
    const result = await ParcelamentoBusiness.detalhar('compra', 'conta', 7);
    expect(ParcelamentoRepository.listar).toHaveBeenCalledWith(
      'compra',
      'conta',
      7,
    );
    expect(result).toMatchObject({
      total: 100,
      totalPago: 33.34,
      saldoRestante: 66.66,
      parcelasPagas: 1,
      parcelasPendentes: 2,
      historicoCompleto: true,
    });
    expect(result.progresso).toBeCloseTo(33.34);
  });
  it('informa histórico incompleto sem inventar as parcelas ausentes', async () => {
    vi.mocked(ParcelamentoRepository.listar).mockResolvedValue([
      parcela(1, 33.34, 'pago'),
      parcela(3, 33.33, 'pendente'),
    ]);
    expect(
      await ParcelamentoBusiness.detalhar('compra', 'conta', 7),
    ).toMatchObject({
      historicoCompleto: false,
      totalParcelas: 3,
      total: 66.67,
    });
  });
  it('retorna o mesmo erro para registro inexistente ou de outro usuário', async () => {
    vi.mocked(ParcelamentoRepository.listar).mockResolvedValue([]);
    await expect(
      ParcelamentoBusiness.detalhar('compra', 'cartao', 8),
    ).rejects.toBeInstanceOf(TransacaoNotFoundError);
  });
  it('indica quitação completa e evita divisão por zero', async () => {
    vi.mocked(ParcelamentoRepository.listar).mockResolvedValue(
      [1, 2, 3].map((i) => parcela(i, 10, 'pago')),
    );
    expect(
      await ParcelamentoBusiness.detalhar('compra', 'cartao', 8),
    ).toMatchObject({ progresso: 100, saldoRestante: 0, parcelasPendentes: 0 });
    vi.mocked(ParcelamentoRepository.listar).mockResolvedValue([
      parcela(1, 0, 'pago'),
    ]);
    expect(
      (await ParcelamentoBusiness.detalhar('compra', 'conta', 8)).progresso,
    ).toBe(0);
  });
  it('exclui o grupo pelo usuário autenticado e trata ausência sem sucesso falso', async () => {
    vi.mocked(ParcelamentoRepository.excluir)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    await expect(
      ParcelamentoBusiness.excluir('compra', 'conta', 7),
    ).resolves.toBeUndefined();
    expect(ParcelamentoRepository.excluir).toHaveBeenCalledWith(
      'compra',
      'conta',
      7,
    );
    await expect(
      ParcelamentoBusiness.excluir('compra', 'cartao', 99),
    ).rejects.toBeInstanceOf(TransacaoNotFoundError);
  });
});
