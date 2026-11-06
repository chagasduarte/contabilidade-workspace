import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../../core/config/database';
import { CardBusiness, calcularDatasFatura } from './card.business';
import { CardRepository } from './card.repository';
import { CardInvoiceEntity, CreditCardEntity, InvoiceStatus } from './card.entity';
vi.mock('../../core/config/database', () => ({ pool: { connect: vi.fn() } }));
vi.mock('./card.repository', () => ({ CardRepository: {
  buscarCartaoPorId: vi.fn(), obterLimiteComprometido: vi.fn(), buscarFaturaPorMesAno: vi.fn(),
  criarFatura: vi.fn(), criarTransacao: vi.fn(), criarItensFatura: vi.fn(),
} }));
const cartao: CreditCardEntity = { id: 'cartao', usuario_id: 7, nome: 'Cartão', limite_total: 10000,
  dia_fechamento: 20, dia_vencimento: 28, cor_identificacao: '#fff', ativo: true };
function fatura(mes: number, ano: number, status: InvoiceStatus = 'OPEN', vencimento = 28): CardInvoiceEntity {
  return { id: `${ano}-${mes}`, cartao_id: cartao.id, mes_referencia: mes, ano_referencia: ano,
    ...(() => { const d = calcularDatasFatura(20, vencimento, mes, ano);
      return { data_fechamento: d.dataFechamento, data_vencimento: d.dataVencimento }; })(), status };
}
describe('Alocação de novas compras nas faturas', () => {
  const client = { query: vi.fn(), release: vi.fn() };
  beforeEach(() => {
    vi.clearAllMocks();
    client.query.mockResolvedValue({ rows: [] });
    vi.mocked(pool.connect).mockResolvedValue(client as never);
    vi.mocked(CardRepository.buscarCartaoPorId).mockResolvedValue(cartao);
    vi.mocked(CardRepository.obterLimiteComprometido).mockResolvedValue(0);
    vi.mocked(CardRepository.buscarFaturaPorMesAno).mockResolvedValue(undefined);
    vi.mocked(CardRepository.criarFatura).mockImplementation(async dados => ({ id: `${dados.ano_referencia}-${dados.mes_referencia}`, ...dados, status: 'OPEN' }));
    vi.mocked(CardRepository.criarTransacao).mockResolvedValue({ id: 'compra', cartao_id: cartao.id,
      descricao: 'Compra', valor_total: 100, quantidade_parcelas: 3, data_compra: new Date('2026-11-06') });
    vi.mocked(CardRepository.criarItensFatura).mockResolvedValue([]);
    vi.spyOn(CardBusiness, 'obterDetalhesCartao').mockResolvedValue({ cartao, limite_total: 10000,
      limite_disponivel: 9900, limite_comprometido: 100 });
  });
  async function comprar(data = '2026-11-06', parcelas = 3) {
    await CardBusiness.lancarTransacao({ cartao_id: cartao.id, descricao: 'Compra', valor_total: 100,
      quantidade_parcelas: parcelas, data_compra: data }, 7);
    return vi.mocked(CardRepository.criarItensFatura).mock.calls[0][0];
  }
  it.each(['PAID', 'CLOSED', 'OVERDUE'] as const)('compra em 06/11 pula novembro %s e começa em dezembro, mantendo parcelas e centavos', async status => {
    vi.mocked(CardRepository.buscarFaturaPorMesAno).mockImplementation(async (_, mes, ano) => mes === 11 && ano === 2026 ? fatura(mes, ano, status) : undefined);
    const itens = await comprar();
    expect(itens.map(i => i.fatura_id)).toEqual(['2026-12', '2027-1', '2027-2']);
    expect(itens.map(i => i.numero_parcela)).toEqual([1, 2, 3]);
    expect(itens.map(i => i.valor_parcela)).toEqual([33.34, 33.33, 33.33]);
    expect(CardRepository.criarFatura).not.toHaveBeenCalledWith(expect.objectContaining({ mes_referencia: 11 }), client);
  });
  it('mantém novembro se a fatura ainda está aberta e a compra é anterior ao fechamento', async () => {
    vi.mocked(CardRepository.buscarFaturaPorMesAno).mockResolvedValueOnce(fatura(11, 2026));
    expect((await comprar('2026-11-06', 1))[0].fatura_id).toBe('2026-11');
  });
  it('respeita o fechamento mesmo quando não existe fatura do mês anterior', async () => {
    expect((await comprar('2026-11-21', 1))[0].fatura_id).toBe('2026-12');
  });
  it('compra no próprio dia do fechamento vai para a próxima fatura mesmo com a atual aberta', async () => {
    expect((await comprar('2026-11-20', 1))[0].fatura_id).toBe('2026-12');
    expect(CardRepository.buscarFaturaPorMesAno).not.toHaveBeenCalledWith('cartao', 11, 2026, client);
  });
  it('não inclui compra na data de fechamento registrada diferente do cadastro atual', async () => {
    vi.mocked(CardRepository.buscarFaturaPorMesAno).mockResolvedValueOnce({ ...fatura(11, 2026), data_fechamento: new Date('2026-11-06') });
    expect((await comprar('2026-11-06', 1))[0].fatura_id).toBe('2026-12');
  });
  it('ignora fatura com pagamento antecipado e status ainda OPEN', async () => {
    vi.mocked(CardRepository.buscarFaturaPorMesAno).mockResolvedValueOnce({ ...fatura(11, 2026), valor_pago: 10 });
    expect((await comprar('2026-11-06', 1))[0].fatura_id).toBe('2026-12');
  });
  it('respeita a data de fechamento já registrada na fatura', async () => {
    vi.mocked(CardRepository.buscarFaturaPorMesAno).mockResolvedValueOnce({ ...fatura(11, 2026), data_fechamento: new Date('2026-11-05') });
    expect((await comprar('2026-11-06', 1))[0].fatura_id).toBe('2026-12');
  });
  it('mantém dezembro como vencimento quando o vencimento é no mês seguinte à referência', async () => {
    vi.mocked(CardRepository.buscarCartaoPorId).mockResolvedValue({ ...cartao, dia_vencimento: 5 });
    await comprar('2026-11-06', 1);
    const dados = vi.mocked(CardRepository.criarFatura).mock.calls[0][0];
    expect(dados.mes_referencia).toBe(11);
    expect(dados.data_vencimento.toISOString().substring(0, 10)).toBe('2026-12-05');
  });
  it('pula uma fatura futura paga e continua sem duplicar meses ou números de parcelas', async () => {
    vi.mocked(CardRepository.buscarFaturaPorMesAno).mockImplementation(async (_, mes, ano) =>
      (mes === 11 || mes === 12) && ano === 2026 ? fatura(mes, ano, 'PAID') : undefined);
    expect((await comprar()).map(i => i.fatura_id)).toEqual(['2027-1', '2027-2', '2027-3']);
  });
  it('revalida o estado retornado pelo upsert antes de inserir a parcela', async () => {
    vi.mocked(CardRepository.criarFatura).mockResolvedValueOnce(fatura(11, 2026, 'PAID'));
    expect((await comprar('2026-11-06', 1))[0].fatura_id).toBe('2026-12');
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
  });
  it.each([
    ['2026-10-31', ['2026-11', '2026-12']],
    ['2026-11-01', ['2026-12', '2027-1']],
    ['2026-11-30', ['2026-12', '2027-1']],
    ['2026-12-01', ['2027-1', '2027-2']],
  ])('com fechamento dia 1, aloca compra de %s e mantém a parcela mensal correta', async (data, faturasEsperadas) => {
    vi.mocked(CardRepository.buscarCartaoPorId).mockResolvedValue({ ...cartao, dia_fechamento: 1, dia_vencimento: 7 });
    const itens = await comprar(data, 2);
    expect(itens.map(i => i.fatura_id)).toEqual(faturasEsperadas);
    expect(itens.map(i => i.numero_parcela)).toEqual([1, 2]);
    const vencimentos = vi.mocked(CardRepository.criarFatura).mock.calls.map(([f]) => f.data_vencimento.toISOString().substring(0, 10));
    expect(vencimentos).toEqual(faturasEsperadas.map(chave => {
      const [ano, mes] = chave.split('-');
      return `${ano}-${mes.padStart(2, '0')}-07`;
    }));
    expect(itens.reduce((soma, i) => soma + i.valor_parcela, 0)).toBe(100);
  });

});
