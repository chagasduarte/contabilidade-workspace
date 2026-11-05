import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransacaoBusiness } from './transacao.business';
import { TransacaoRepository } from './transacao.repository';
import { CardBusiness } from '../card/card.business';

vi.mock('./transacao.repository', () => ({
  TransacaoRepository: {
    criar: vi.fn(),
    criarParcelamento: vi.fn(),
    parcelasDaCompra: vi.fn(),
    parcelasCartao: vi.fn(),
    buscarPorId: vi.fn(),
    atualizar: vi.fn(),
    excluir: vi.fn(),
    listaParceladas: vi.fn(),
    listaAdicionais: vi.fn(),
    listaTransacoes: vi.fn(),
  },
}));

vi.mock('../cartao/cartao.repository', () => ({
  CartaoRepository: {
    listar: vi.fn().mockResolvedValue([]),
    buscar: vi.fn(),
  },
}));

vi.mock('../card/card.business', () => ({
  CardBusiness: {
    lancarTransacao: vi.fn(),
  },
}));

vi.mock('../../core/config/database', () => ({
  pool: {
    query: vi.fn().mockResolvedValue({
      rows: [{ id: '038d70c8-5141-4894-8395-3ed40bc50eed' }],
    }),
  },
}));

describe('TransacaoBusiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve validar tipo inválido ao criar transação', async () => {
    await expect(
      TransacaoBusiness.criar(
        // @ts-expect-error teste de tipo invalido
        { tipo: 'invalido', descricao: 'Teste', valor: 50, data: '2026-05-01' },
        1
      )
    ).rejects.toThrow("Tipo deve ser 'entrada' ou 'saida'.");
  });

  it('deve validar descrição ou valor ausentes', async () => {
    await expect(
      TransacaoBusiness.criar(
        { tipo: 'saida', descricao: '', valor: 50, data: '2026-05-01' },
        1
      )
    ).rejects.toThrow('Descrição e valor são obrigatórios.');
  });

  it('deve criar transação regular (conta corrente) salvando na tabela transacoes', async () => {
    vi.mocked(TransacaoRepository.criar).mockResolvedValueOnce({
      id: 10,
      tipo: 'saida',
      descricao: 'Padaria',
      valor: 25,
      data: '2026-10-18',
      status: 'pago',
      userid: 1,
    });

    const res = await TransacaoBusiness.criar(
      {
        tipo: 'saida',
        descricao: 'Padaria',
        valor: 25,
        data: '2026-10-18',
        ispaycart: false,
      },
      1
    );

    expect(TransacaoRepository.criar).toHaveBeenCalledTimes(1);
    expect(CardBusiness.lancarTransacao).not.toHaveBeenCalled();
    expect(res.id).toBe(10);
    expect(res.descricao).toBe('Padaria');
  });

  it('deve redirecionar transação no cartão para card_transactions via CardBusiness e NÃO chamar TransacaoRepository.criar', async () => {
    vi.mocked(CardBusiness.lancarTransacao).mockResolvedValueOnce({
      transacao: {
        id: 'tx-card-uuid-1',
        cartao_id: '038d70c8-5141-4894-8395-3ed40bc50eed',
        descricao: 'Supermercado Mensal',
        valor_total: 450,
        quantidade_parcelas: 1,
        data_compra: new Date('2026-10-18T12:00:00Z'),
        categoria_id: 2,
        criado_em: new Date('2026-10-18T12:00:00Z'),
      },
      itens: [],
      cartaoAtualizado: {} as any,
    });

    const res = await TransacaoBusiness.criar(
      {
        tipo: 'saida',
        descricao: 'Supermercado Mensal',
        valor: 450,
        data: '2026-10-18',
        ispaycart: true,
        cartaoid: '038d70c8-5141-4894-8395-3ed40bc50eed',
        idcategoria: 2,
      },
      1
    );

    // Garante que NÃO salvou na tabela transacoes
    expect(TransacaoRepository.criar).not.toHaveBeenCalled();

    // Garante que direcionou para CardBusiness.lancarTransacao (card_transactions)
    expect(CardBusiness.lancarTransacao).toHaveBeenCalledWith(
      expect.objectContaining({
        cartao_id: '038d70c8-5141-4894-8395-3ed40bc50eed',
        descricao: 'Supermercado Mensal',
        valor_total: 450,
        quantidade_parcelas: 1,
        categoria_id: 2,
      }),
      1
    );

    expect(res.id).toBe('tx-card-uuid-1');
    expect(res.source_type).toBe('CREDIT_CARD_TRANSACTION');
  });

  it('deve redirecionar compra parcelada no cartão para card_transactions e invoice_items sem chamar TransacaoRepository.criar', async () => {
    vi.mocked(CardBusiness.lancarTransacao).mockResolvedValueOnce({
      transacao: {
        id: 'tx-card-uuid-2',
        cartao_id: '038d70c8-5141-4894-8395-3ed40bc50eed',
        descricao: 'Notebook',
        valor_total: 3000,
        quantidade_parcelas: 3,
        data_compra: new Date('2026-10-18T12:00:00Z'),
        categoria_id: 5,
        criado_em: new Date('2026-10-18T12:00:00Z'),
      },
      itens: [
        {
          id: 'item-1',
          fatura_id: 'fat-1',
          transacao_id: 'tx-card-uuid-2',
          numero_parcela: 1,
          valor_parcela: 1000,
          data_compra: new Date('2026-10-18T12:00:00Z'),
        },
        {
          id: 'item-2',
          fatura_id: 'fat-2',
          transacao_id: 'tx-card-uuid-2',
          numero_parcela: 2,
          valor_parcela: 1000,
          data_compra: new Date('2026-10-18T12:00:00Z'),
        },
        {
          id: 'item-3',
          fatura_id: 'fat-3',
          transacao_id: 'tx-card-uuid-2',
          numero_parcela: 3,
          valor_parcela: 1000,
          data_compra: new Date('2026-10-18T12:00:00Z'),
        },
      ],
      cartaoAtualizado: {} as any,
    });

    const parcelas = await TransacaoBusiness.criarParcelada(
      {
        descricao: 'Notebook',
        valor: 3000,
        data: '2026-10-18',
        parcelado: true,
        ispaycart: true,
        cartaoid: '038d70c8-5141-4894-8395-3ed40bc50eed',
        idcategoria: 5,
        parcelas: {
          QtdParcelas: 3,
          Valor: 1000,
        },
      },
      1
    );

    // Garante que NÃO salvou na tabela transacoes
    expect(TransacaoRepository.criar).not.toHaveBeenCalled();

    // Garante que enviou as 3 parcelas para card_transactions
    expect(CardBusiness.lancarTransacao).toHaveBeenCalledWith(
      expect.objectContaining({
        cartao_id: '038d70c8-5141-4894-8395-3ed40bc50eed',
        descricao: 'Notebook',
        valor_total: 3000,
        quantidade_parcelas: 3,
        categoria_id: 5,
      }),
      1
    );

    expect(parcelas).toHaveLength(3);
    expect(parcelas[0].source_type).toBe('CREDIT_CARD_INVOICE_ITEM');
  });

  it('deve criar parcelas não-cartão salvando na tabela transacoes', async () => {
    vi.mocked(TransacaoRepository.criarParcelamento).mockImplementation(async (items) => items.map((tr, i) => ({ ...tr, id: i + 1, status: 'pendente', userid: 1 })));

    const parcelas = await TransacaoBusiness.criarParcelada(
      {
        descricao: 'Carnê Reforma',
        valor: 300,
        data: '2026-01-15',
        parcelado: true,
        ispaycart: false,
        parcelas: {
          QtdParcelas: 3,
          Valor: 100,
        },
      },
      1
    );

    expect(parcelas).toHaveLength(3);
    expect(TransacaoRepository.criarParcelamento).toHaveBeenCalledTimes(1);
    expect(new Set(parcelas.map(item => item.source_id)).size).toBe(1);
    expect(parcelas.every(item => item.source_type === 'INSTALLMENT')).toBe(true);
    expect(CardBusiness.lancarTransacao).not.toHaveBeenCalled();
  });
  it('distribui centavos sem alterar o total da compra e respeita o fim do mês', async () => {
    vi.mocked(TransacaoRepository.criarParcelamento).mockImplementation(async items => items.map((tr, i) => ({ ...tr, id: i + 1, status: 'pendente', userid: 1 })));
    const items = await TransacaoBusiness.criarParcelada({ descricao: 'Compra', valor: 100, data: '2026-01-31', parcelado: true, parcelas: { QtdParcelas: 3, Valor: 33.33 } }, 7);
    expect(items.map(item => item.valor)).toEqual([33.34, 33.33, 33.33]);
    expect(items.map(item => item.data)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
    expect(TransacaoRepository.criarParcelamento).toHaveBeenCalledWith(expect.any(Array), 7);
  });

  it('consulta todas as parcelas pelo vínculo da compra e pelo usuário', async () => {
    const item = { id: 12, tipo: 'saida' as const, descricao: 'Compra', data: '2026-01-01', valor: 10, status: 'pago' as const, userid: 7, source_type: 'INSTALLMENT' };
    vi.mocked(TransacaoRepository.buscarPorId).mockResolvedValue(item);
    vi.mocked(TransacaoRepository.parcelasDaCompra).mockResolvedValue([item]);
    expect(await TransacaoBusiness.detalhes('12', 7, false)).toEqual({ lancamento: item, parcelas: [item], parcelado: true });
    expect(TransacaoRepository.buscarPorId).toHaveBeenCalledWith('12', 7);
    expect(TransacaoRepository.parcelasDaCompra).toHaveBeenCalledWith('12', 7);
  });

  it('não retorna detalhes para lançamento de outro usuário', async () => {
    vi.mocked(TransacaoRepository.buscarPorId).mockResolvedValue(undefined);
    expect(await TransacaoBusiness.detalhes('12', 99, false)).toBeNull();
  });

  it('não agrupa lançamentos antigos apenas por descrição', async () => {
    const item = { id: 12, tipo: 'saida' as const, descricao: 'Compra - Parcela', data: '2026-01-01', valor: 10, status: 'pago' as const, userid: 7 };
    vi.mocked(TransacaoRepository.buscarPorId).mockResolvedValue(item);
    expect(await TransacaoBusiness.detalhes('12', 7, false)).toEqual({ lancamento: item, parcelas: [], parcelado: false });
    expect(TransacaoRepository.parcelasDaCompra).not.toHaveBeenCalled();
  });

  it('consulta parcelas do cartão limitadas ao usuário', async () => {
    vi.mocked(TransacaoRepository.parcelasCartao).mockResolvedValue([]);
    expect(await TransacaoBusiness.detalhes('uuid', 99, true)).toBeNull();
    expect(TransacaoRepository.parcelasCartao).toHaveBeenCalledWith('uuid', 99);
  });

  it('impede atualização de lançamento sem acesso pelo usuário', async () => {
    vi.mocked(TransacaoRepository.buscarPorId).mockResolvedValue(undefined);
    await expect(TransacaoBusiness.atualizar('12', { valor: 20 }, 99)).rejects.toThrow('Transação não encontrada');
    expect(TransacaoRepository.atualizar).not.toHaveBeenCalled();
  });

});
