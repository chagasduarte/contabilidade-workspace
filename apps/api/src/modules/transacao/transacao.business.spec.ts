import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransacaoBusiness } from './transacao.business';
import { TransacaoRepository } from './transacao.repository';
import { CardBusiness } from '../card/card.business';

vi.mock('./transacao.repository', () => ({
  TransacaoRepository: {
    criar: vi.fn(),
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
    vi.mocked(TransacaoRepository.criar).mockImplementation(async (tr) => ({
      id: Math.floor(Math.random() * 1000),
      tipo: tr.tipo,
      descricao: tr.descricao,
      valor: tr.valor,
      categoria: tr.categoria,
      data: tr.data,
      status: tr.status ?? 'pendente',
      userid: 1,
    }));

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
    expect(TransacaoRepository.criar).toHaveBeenCalledTimes(3);
    expect(CardBusiness.lancarTransacao).not.toHaveBeenCalled();
  });
});
